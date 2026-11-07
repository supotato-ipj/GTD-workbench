/**
 * 接缝 A（数据边界，Host → 客户端）与渲染接缝：已沉底区。
 *
 * 断言的是外部可观察行为：路由是不是用**另一条命令、按日期区间**取已完成，
 * 快照里的已沉底区是不是只留最近七天，画布上是不是按天堆、每个纸箱是不是另标完成数。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { mountClientPanel } from './helpers/client-harness.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
/** 本地 2026-11-05（周四）08:00；七天窗口 = 2026-10-30 .. 2026-11-05。 */
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/** 已完成条目：窗口内三条（跨两个纸箱）+ 一条出窗口 + 一条不是已完成。 */
const COMPLETED = [
  {
    id: 'done-exec-1',
    projectId: '7c4e00000000000000000002',
    title: '文书传递（11/4 日清）',
    status: 2,
    completedTime: '2026-11-04T11:26:38.000+0000',
  },
  {
    id: 'done-exec-2',
    projectId: '7c4e00000000000000000002',
    title: '08:00 自学 20 分钟',
    status: 2,
    completedTime: '2026-11-05T00:30:00.000+0000',
  },
  {
    id: 'done-wait-1',
    projectId: '7c4e00000000000000000001',
    title: '供应商：大家签电子签章需求内部研究结论',
    status: 2,
    completedTime: '2026-11-04T03:26:43.000+0000',
  },
  {
    id: 'done-too-old',
    projectId: '7c4e00000000000000000002',
    title: '很久以前做完的',
    status: 2,
    completedTime: '2026-10-01T03:00:00.000+0000',
  },
  {
    id: 'not-completed',
    projectId: '7c4e00000000000000000002',
    title: '其实没完成',
    status: 0,
    completedTime: '2026-11-04T03:00:00.000+0000',
  },
];

/**
 * 造一条路由，并记下已完成取数的入参。
 * @param {object} [overrides] - 覆盖项。
 * @returns {{ handler: Function, completedCalls: object[], openCalls: object[] }} 路由与调用记录。
 */
function routeUnderTest(overrides = {}) {
  const completedCalls = [];
  const openCalls = [];
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => {
      openCalls.push(args);
      return rawTasks.filter((task) => task.projectId === args.projectId);
    },
    runCompleted: async (args) => {
      completedCalls.push(args);
      return COMPLETED;
    },
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    ...overrides,
  });
  return { handler, completedCalls, openCalls };
}

/**
 * 请求那条路由并读回快照。
 * @param {Function} handler - 路由处理函数。
 * @returns {Promise<object>} 快照。
 */
async function snapshotOf(handler) {
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

test('接缝 A：已完成条目走另一条调用，按日期区间取，不与未完成混在一起', async () => {
  const { handler, completedCalls, openCalls } = routeUnderTest();
  await snapshotOf(handler);
  assert.equal(completedCalls.length, 1);
  // 未完成那六次不带日期区间；已完成这一次带区间。两条通路分开。
  assert.equal(openCalls.length, 6);
  for (const call of openCalls) {
    assert.equal(call.startDate, undefined);
    assert.equal(call.endDate, undefined);
  }
  const call = completedCalls[0];
  // 六个清单 id 一次问完（`task completed` 的 --projects 接受逗号分隔）。
  assert.equal(call.projectIds.length, 6);
  // 区间两头各放宽一天，精确的七天由 sunk.js 按本地日期筛。
  assert.equal(call.startDate, '2026-10-29T00:00:00Z');
  assert.equal(call.endDate, '2026-11-06T23:59:59Z');
});

test('接缝 A：快照里的已沉底区只含最近七天，更早的不出现', async () => {
  const { handler } = routeUnderTest();
  const snapshot = await snapshotOf(handler);
  const sunk = snapshot.sunk;
  assert.equal(sunk.windowDays, 7);
  assert.equal(sunk.from, '2026-10-30');
  assert.equal(sunk.to, '2026-11-05');
  const ids = sunk.days.flatMap((day) => day.notes.map((note) => note.id));
  assert.deepEqual(ids.sort(), ['done-exec-1', 'done-exec-2', 'done-wait-1']);
  assert.equal(ids.includes('done-too-old'), false);
  assert.equal(ids.includes('not-completed'), false);
});

test('接缝 A：每个纸箱的完成数在快照里算好', async () => {
  const { handler } = routeUnderTest();
  const snapshot = await snapshotOf(handler);
  assert.equal(snapshot.sunk.counts.execution, 2);
  assert.equal(snapshot.sunk.counts.waiting, 1);
  assert.equal(snapshot.sunk.counts.inbox, 0);
  // 六个纸箱都有键，不省略。
  assert.equal(Object.keys(snapshot.sunk.counts).length, 6);
});

test('接缝 A：已完成取数失败时不打掉板子——已沉底空着，未完成照常', async () => {
  const { handler } = routeUnderTest({
    runCompleted: async () => {
      throw new Error('DIDA API 错误 500');
    },
  });
  const snapshot = await snapshotOf(handler);
  assert.deepEqual(snapshot.sunk.days, []);
  assert.equal(snapshot.sunk.counts.execution, 0);
  assert.equal(snapshot.containers.length, 6);
});

test('接缝 B：画布上有已沉底区，条目按完成日堆叠', async () => {
  const { handler } = routeUnderTest();
  const snapshot = await snapshotOf(handler);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const sunk = env.document.querySelector('[data-role="sunk"]');
    assert.ok(sunk, '画布上没有已沉底区');
    assert.equal(sunk.getAttribute('data-window-days'), '7');
    const days = [...sunk.querySelectorAll('[data-role="sunk-day"]')];
    assert.deepEqual(
      days.map((day) => day.getAttribute('data-date')),
      ['2026-11-05', '2026-11-04'],
    );
    assert.deepEqual(
      days.map((day) => day.getAttribute('data-count')),
      ['1', '2'],
    );
  } finally {
    await env.unmount();
  }
});

test('接缝 B：每个纸箱角标显示该容器的完成数', async () => {
  const { handler } = routeUnderTest();
  const snapshot = await snapshotOf(handler);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const badges = [...env.document.querySelectorAll('[data-role="box-completions"]')];
    assert.equal(badges.length, 6);
    const byBox = new Map(
      [...env.document.querySelectorAll('[data-role="box"]')].map((box) => [
        box.getAttribute('data-container'),
        box.querySelector('[data-role="box-completions"]').getAttribute('data-count'),
      ]),
    );
    assert.equal(byBox.get('execution'), '2');
    assert.equal(byBox.get('waiting'), '1');
    assert.equal(byBox.get('inbox'), '0');
  } finally {
    await env.unmount();
  }
});

test('接缝 B：已沉底区不提供任何删除或归还动作', async () => {
  const { handler } = routeUnderTest();
  const snapshot = await snapshotOf(handler);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const sunk = env.document.querySelector('[data-role="sunk"]');
    // 一个按钮都没有：已沉底是展示区，不是回收箱（ADR-0004）。
    assert.equal(sunk.querySelectorAll('button').length, 0);
    assert.equal(sunk.querySelectorAll('a').length, 0);
    // 也没有任何写回的口子。
    for (const node of sunk.querySelectorAll('*')) {
      assert.equal(node.getAttribute('onclick'), null);
    }
    // 入口文案里不出现「删除」「恢复」「还原」。
    assert.doesNotMatch(sunk.textContent, /删除|恢复|还原|回收/);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：没有完成条目时已沉底区说「最近七天没有完成的事」', async () => {
  const { handler } = routeUnderTest({ runCompleted: async () => [] });
  const snapshot = await snapshotOf(handler);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const sunk = env.document.querySelector('[data-role="sunk"]');
    assert.ok(sunk, '没有完成条目时已沉底区整个消失了');
    assert.equal(sunk.querySelectorAll('[data-role="sunk-day"]').length, 0);
    assert.equal(sunk.querySelector('[data-role="sunk-empty"]').textContent, '最近七天没有完成的事');
  } finally {
    await env.unmount();
  }
});
