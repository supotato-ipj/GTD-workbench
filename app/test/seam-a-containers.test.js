/**
 * 接缝 A（数据边界，Host → 客户端）：六个容器各归其位。
 *
 * 断言的是**外部可观察行为**：请求那条本机 HTTP 路由，响应体里六个容器各成一组、
 * 容器名与滴答清单名一一对应、取数按容器分别调用、条目不串位、日历箱只留有外部约定时刻的条目。
 * 夹具是固定的，不依赖本机实时滴答数据（真实滴答那一层是接缝 C，手动验收）。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CONTAINERS } from '../lib/containers.js';
import { buildDidaArgs } from '../lib/dida.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
/** 快照生成时刻（本地 2026-11-05 08:00）。 */
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

const INBOX_ID = 'inbox9000000001';
const CALENDAR_ID = '7c4e00000000000000000003';
const WAITING_ID = '7c4e00000000000000000001';

/**
 * 造一条喂固定夹具的路由。
 * @param {object} [overrides] - 覆盖项（换掉 runDida 就能模拟空容器）。
 * @returns {{ handler: Function, calls: object[] }} 路由与它被问过的取数参数。
 */
function routeUnderTest(overrides = {}) {
  const calls = [];
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => {
      calls.push(args);
      return rawTasks.filter((task) => task.projectId === args.projectId);
    },
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    ...overrides,
  });
  return { handler, calls };
}

/**
 * 请求那条路由并读回响应体。
 * @param {Function} handler - 路由处理函数。
 * @returns {Promise<object>} 响应体。
 */
async function readSnapshot(handler) {
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

test('接缝 A：六个容器各成一组，顺序是收集箱、项目、执行、等待、日历、可能', async () => {
  const { handler } = routeUnderTest();
  const body = await readSnapshot(handler);
  assert.equal(body.containers.length, 6);
  assert.deepEqual(
    body.containers.map((container) => container.key),
    ['inbox', 'project', 'execution', 'waiting', 'calendar', 'maybe'],
  );
  assert.deepEqual(
    body.containers.map((container) => container.name),
    ['收集箱', '项目', '执行', '等待', '日历', '可能'],
  );
});

test('接缝 A：容器名与滴答清单名一一对应', async () => {
  const { handler } = routeUnderTest();
  const body = await readSnapshot(handler);
  assert.deepEqual(
    body.containers.map((container) => container.listName),
    ['收集箱', '项目清单', '执行清单', '等待清单', '待办日历', '💭可能'],
  );
  assert.deepEqual(
    body.containers.map((container) => container.projectId),
    CONTAINERS.map((container) => container.projectId),
  );
  // 清单 id 一律是完整的 24 位（收集箱是 inbox id），不用被截断的 22 位。
  for (const container of body.containers) {
    if (container.key !== 'inbox') assert.equal(container.projectId.length, 24);
  }
});

test('接缝 A：容器为空时该组仍存在且为空数组（不省略键）', async () => {
  const { handler } = routeUnderTest({
    runDida: async (args) =>
      args.projectId === WAITING_ID ? [] : rawTasks.filter((task) => task.projectId === args.projectId),
  });
  const body = await readSnapshot(handler);
  const waiting = body.containers.find((container) => container.key === 'waiting');
  assert.ok(waiting, '等待这一组不见了');
  assert.deepEqual(waiting.notes, []);
  assert.ok(Object.prototype.hasOwnProperty.call(waiting, 'notes'));
});

test('接缝 A：取数按容器分别调用，一次一个清单，且只取未完成', async () => {
  const { handler, calls } = routeUnderTest();
  await readSnapshot(handler);
  assert.equal(calls.length, 6);
  assert.deepEqual(
    calls.map((call) => call.projectId),
    CONTAINERS.map((container) => container.projectId),
  );
  // 单次只取未完成，才不会撞上 CLI 的 200 条上限（实测：不带 status 时收集箱与日历都撞满 200 条）。
  for (const call of calls) assert.equal(call.status, 0);
});

test('接缝 A：只取未完成的取数命令带 --status 0', () => {
  const argv = buildDidaArgs('task filter', { projectId: INBOX_ID, status: 0 });
  assert.deepEqual(argv, ['task', 'filter', '--projects', INBOX_ID, '--status', '0', '--json']);
  // 写命令仍然拼不进来（ADR-0006 护栏：写口只开「完成」一个）。
  assert.throws(() => buildDidaArgs('task create', { projectId: INBOX_ID }), /拒绝执行/);
});

test('接缝 A：跨容器串位数为零——每个条目只出现在自己容器的组里', async () => {
  const { handler } = routeUnderTest();
  const body = await readSnapshot(handler);
  const seen = new Map();
  for (const container of body.containers) {
    const expected = new Set(
      rawTasks.filter((task) => task.projectId === container.projectId).map((task) => task.id),
    );
    for (const note of container.notes) {
      assert.ok(expected.has(note.id), `${note.id} 串到了 ${container.name} 箱里`);
      assert.equal(seen.has(note.id), false, `${note.id} 出现在两个箱里`);
      seen.set(note.id, container.key);
    }
  }
  // 每条夹具条目都归了位（除了被日历口径挡掉的两条，见下一条断言）。
  assert.equal(seen.size, rawTasks.length - 2);
});

test('接缝 A：日历箱只显示有外部约定时刻的条目', async () => {
  const { handler } = routeUnderTest();
  const body = await readSnapshot(handler);
  const calendar = body.containers.find((container) => container.key === 'calendar');
  assert.ok(calendar, '日历这一组不见了');
  assert.deepEqual(
    calendar.notes.map((note) => note.title),
    ['某混凝土公司，开庭时间12月12日下午2点周六，'],
  );
  // 被挡掉的两条：传递法律文书（周期日常，时段已经开始）与查询被执行案件（只是一个时间点，是期限不是时刻）。
  const titles = calendar.notes.map((note) => note.title);
  assert.equal(titles.includes('传递法律文书'), false);
  assert.equal(titles.includes('查询被执行案件'), false);
});
