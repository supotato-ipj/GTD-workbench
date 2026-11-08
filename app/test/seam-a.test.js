/**
 * 接缝 A（数据边界，Host → 客户端）：请求那条本机 HTTP 路由，断言响应体。
 *
 * 快照用固定夹具，不依赖本机实时滴答数据——真实滴答那一层是接缝 C，手动验收。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CONTAINERS, INBOX_PROJECT_ID } from '../lib/containers.js';
import { DEFAULT_DIDA_ENTRY, DidaError, buildDidaArgs, classifyDidaFailure } from '../lib/dida.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/execution-tasks.json'), 'utf8'));
const expectedSnapshot = JSON.parse(readFileSync(path.join(here, 'fixtures/execution-snapshot.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
const GENERATED_AT = '2026-11-05T00:00:00.000Z';
const EXECUTION_PROJECT_ID = '7c4e00000000000000000002';

/**
 * 造一条用固定夹具喂数据、时区固定的路由。
 * @param {object} [overrides] - 覆盖项（换掉 connection / runDida 就能测失败面）。
 * @returns {{ handler: Function, calls: string[] }} 路由与它被问过的清单 id。
 */
function routeUnderTest(overrides = {}) {
  const calls = [];
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async ({ projectId }) => {
      calls.push(projectId);
      return rawTasks;
    },
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    ...overrides,
  });
  return { handler, calls };
}

test('接缝 A：取数走一条顶层、带命名空间前缀的本机路由', () => {
  assert.equal(TASKS_ROUTE_PATH, '/gtd-workbench/tasks');
  assert.match(TASKS_ROUTE_PATH, /^\/[a-z0-9-]+\/[a-z0-9-]+$/);
});

test('接缝 A：六个容器各成一组，执行清单那一组名字对得上', async () => {
  const { handler } = routeUnderTest();
  const body = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    return response.json();
  });
  assert.equal(body.containers.length, 6);
  const execution = body.containers.find((container) => container.key === 'execution');
  assert.ok(execution, '六个容器里没有执行清单');
  assert.equal(execution.name, '执行');
  assert.equal(execution.listName, '执行清单');
  assert.equal(execution.projectId, EXECUTION_PROJECT_ID);
  assert.equal(execution.notes.length, expectedSnapshot.containers[0].notes.length);
});

test('接缝 A：每条动作带齐标题、截止时间、时间档标签、优先级、状态、正文', async () => {
  const { handler } = routeUnderTest();
  const body = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    return response.json();
  });
  const execution = body.containers.find((container) => container.key === 'execution');
  const notes = execution.notes;
  assert.equal(notes.length, 5);
  for (const note of notes) {
    assert.equal(typeof note.title, 'string');
    assert.notEqual(note.title, '');
    assert.equal(typeof note.content, 'string');
    assert.notEqual(note.content, '');
    assert.equal(typeof note.dueLocal, 'string');
    assert.match(note.dueLocal, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    assert.ok(note.timeBand === null || ['深度', '事务', '日清'].includes(note.timeBand));
    assert.equal(typeof note.priority, 'number');
    assert.equal(typeof note.priorityLabel, 'string');
    assert.equal(typeof note.status, 'number');
    assert.equal(typeof note.statusLabel, 'string');
  }
  assert.deepEqual(
    notes.map((note) => [note.title, note.dueLocal, note.timeBand, note.priorityLabel, note.statusLabel]),
    [
      ['08:00 自学 20 分钟', '2026-11-04 09:15', null, '无', '已完成'],
      ['追问运营部：归期 + 5 课题反馈', '2026-11-04 14:15', '事务', '中', '未完成'],
      ['文书传递（11/4 日清）', '2026-11-04 17:30', '日清', '高', '未完成'],
      ['⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）', '2026-11-05 10:00', '深度', '高', '未完成'],
      ['⑨ 案件留痕清单（③④⑦ 各 5 行）', '2026-11-06 15:00', '深度', '低', '未完成'],
    ],
  );
});

test('接缝 A：截止时间换算到本地时区，与滴答里的时间一致', async () => {
  const { handler } = routeUnderTest();
  const body = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    return response.json();
  });
  assert.equal(body.timeZone, TIME_ZONE);
  // 滴答的 dueDate 是 UTC 带 +0000；Asia/Shanghai 是 UTC+8，所以 02:00Z 是本地 10:00。
  const note = body.containers[0].notes.find((item) => item.id === '7c4e0000000000000000000d');
  assert.equal(note.dueAt, '2026-11-05T02:00:00.000Z');
  assert.equal(note.dueLocal, '2026-11-05 10:00');
  assert.equal(note.dueDate, '2026-11-05');
  assert.equal(note.dueTime, '10:00');
});

test('接缝 A：同一批动作在两次请求之间的排序稳定', async () => {
  const { handler } = routeUnderTest();
  const bodies = await withRoute(handler, async (baseUrl) => {
    const first = await (await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`)).json();
    const second = await (await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`)).json();
    return [first, second];
  });
  const order = (body) => body.containers[0].notes.map((note) => note.id);
  assert.deepEqual(order(bodies[0]), order(bodies[1]));
  assert.deepEqual(order(bodies[0]), [
    '7c4e0000000000000000000a',
    '7c4e0000000000000000000a',
    '7c4e0000000000000000000b',
    '7c4e0000000000000000000d',
    '7c4e00000000000000000008',
  ]);
});

test('接缝 A：取数按分容器调用，一次一个清单，用完整 24 位 id', async () => {
  const { handler, calls } = routeUnderTest();
  await withRoute(handler, async (baseUrl) => {
    await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
  });
  // 一次调用只问一个清单，六个容器就是六次；顺序与 ADR-0007 的纸箱顺序一致。
  assert.equal(calls.length, 6);
  assert.equal(new Set(calls).size, 6);
  assert.equal(calls[2], EXECUTION_PROJECT_ID);
  // 收集箱在滴答里就是 inbox，没有 24 位 id；其余五个必须是完整 24 位（截断的 22 位查不到）。
  for (const projectId of calls.filter((id) => id !== INBOX_PROJECT_ID)) {
    assert.equal(projectId.length, 24);
  }
  assert.equal(EXECUTION_PROJECT_ID.length, 24);
});

test('接缝 A：路由带访问守卫，同机无关连接读不到取数结果', async () => {
  const { handler, calls } = routeUnderTest({
    connection: { requestRejection: () => 403 },
  });
  const result = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    return { status: response.status, text: await response.text() };
  });
  assert.equal(result.status, 403);
  assert.equal(result.text, '');
  assert.deepEqual(calls, []);
});

test('接缝 A：滴答未登录时，响应体带明确原因，不是空快照', async () => {
  const { handler } = routeUnderTest({
    runDida: async () => {
      throw new DidaError('not-authenticated', '未找到 access token。请先运行 `dida auth login` 登录。');
    },
  });
  const result = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    return { status: response.status, body: await response.json() };
  });
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'not-authenticated');
  assert.match(result.body.error.message, /dida auth login/);
  assert.equal(result.body.containers, undefined);
});

test('接缝 A：滴答执行失败时，原因与未登录可区分，也不是空快照', async () => {
  const { handler } = routeUnderTest({
    runDida: async () => {
      throw new DidaError('cli-failed', 'DIDA API 错误 500: boom');
    },
  });
  const result = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    return { status: response.status, body: await response.json() };
  });
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, 'cli-failed');
  assert.notEqual(result.body.error.code, 'not-authenticated');
  assert.equal(result.body.containers, undefined);
});

test('接缝 A：命令护栏——读命令照旧，除「完成」「改期」外的写命令拼不进滴答 argv', () => {
  assert.deepEqual(buildDidaArgs('task filter', { projectId: EXECUTION_PROJECT_ID }), [
    'task',
    'filter',
    '--projects',
    EXECUTION_PROJECT_ID,
    '--json',
  ]);
  // 写口开「完成」与「改期」两个：新建、删除、移动一律被拒绝。
  assert.throws(() => buildDidaArgs('task create', { projectId: EXECUTION_PROJECT_ID }), /拒绝执行/);
  assert.throws(() => buildDidaArgs('task delete', { projectId: EXECUTION_PROJECT_ID }), /拒绝执行/);
  // 「改期」放行了 `task update`，但**只准改截止日**：没给截止日、或者多带别的参数，都被拒。
  assert.throws(
    () =>
      buildDidaArgs('task update', {
        projectId: EXECUTION_PROJECT_ID,
        taskId: '7c4e0000000000000000000d',
      }),
    /截止日/,
  );
  assert.throws(
    () =>
      buildDidaArgs('task update', {
        projectId: EXECUTION_PROJECT_ID,
        taskId: '7c4e0000000000000000000d',
        dueDate: '2026-11-09',
        timeZone: 'Asia/Shanghai',
        title: '换个标题',
      }),
    /只允许改截止日/,
  );
});

test('接缝 A：滴答 CLI 在 Node 里以真实入口调用', () => {
  // 入口从用户主目录推出来：路径里不写死任何人的登录名，换机器也指得对。
  assert.equal(
    DEFAULT_DIDA_ENTRY,
    path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'npm',
      'node_modules',
      '@suibiji',
      'dida-cli',
      'dist',
      'index.js',
    ),
  );
  assert.match(DEFAULT_DIDA_ENTRY, /dist[\\/]index\.js$/);
});

test('接缝 A：滴答未登录与别的失败分得开', () => {
  assert.equal(classifyDidaFailure('未找到 access token。请先运行 `dida auth login` 登录。'), 'not-authenticated');
  assert.equal(classifyDidaFailure('DIDA API 错误 401: token expired'), 'not-authenticated');
  assert.equal(classifyDidaFailure('DIDA API 错误 500: boom'), 'cli-failed');
  assert.equal(classifyDidaFailure('spawn ENOENT'), 'cli-failed');
});

test('接缝 A：工作台不写任何仓库文件', () => {
  const runtimeSources = [
    'index.js',
    'client.js',
    'lib/containers.js',
    'lib/snapshot.js',
    'lib/dida.js',
    'lib/route.js',
    'lib/actions.js',
    'lib/write-route.js',
    'lib/capacity.js',
    'lib/focus-guide.js',
  ]
    .map((file) => readFileSync(path.join(appRoot, file), 'utf8'))
    .join('\n');
  for (const forbidden of ['writeFile', 'appendFile', 'createWriteStream', 'mkdir', 'rmSync', 'unlink']) {
    assert.doesNotMatch(runtimeSources, new RegExp(forbidden), `运行期代码里出现了写文件调用：${forbidden}`);
  }
});
