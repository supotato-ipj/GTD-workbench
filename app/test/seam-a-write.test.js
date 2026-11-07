/**
 * 接缝 A 的**写方向**：请求那条本机 HTTP 写路由，断言响应体。
 *
 * 滴答 CLI 在这里是**替身**：自动测试不许真调滴答（真实滴答是接缝 C，手动验收）。
 * 断言的是外部可观察行为——HTTP 状态码与响应体，不断言内部调用了哪个 CLI。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DidaError } from '../lib/dida.js';
import { ACTIONS_ROUTE_PATH, createActionsHandler } from '../lib/write-route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/execution-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
const GENERATED_AT = '2026-11-05T00:00:00.000Z';
const EXECUTION_PROJECT_ID = '7c4e00000000000000000002';
const TARGET_ID = '7c4e0000000000000000000d';

/**
 * 造一条写路由：滴答那边是替身，写动作会真的把那条动作标成已完成。
 * @param {object} [overrides] - 覆盖项（换掉 connection / runAction 就能测失败面）。
 * @returns {{ handler: Function, writes: object[], reads: number }} 路由与它做过的动作、读过的次数。
 */
function actionsRouteUnderTest(overrides = {}) {
  const writes = [];
  let reads = 0;
  const tasks = rawTasks.map((task) => ({ ...task }));
  const handler = createActionsHandler({
    connection: { requestRejection: () => undefined },
    runDida: async ({ projectId }) => {
      reads += 1;
      return tasks.filter((task) => task.projectId === projectId);
    },
    runCompleted: async () => [],
    runAction: async ({ action, projectId, taskId }) => {
      writes.push({ action, projectId, taskId });
      const task = tasks.find((item) => item.id === taskId);
      if (task !== undefined) {
        task.status = 2;
        task.completedTime = '2026-11-05T02:00:00.000+0000';
      }
      return { ok: true };
    },
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    ...overrides,
  });
  return { handler, writes, reads: () => reads };
}

/**
 * POST 一次写路由。
 * @param {string} baseUrl - 服务器地址。
 * @param {unknown} body - 请求体（会被序列化成 JSON）。
 * @returns {Promise<{ status: number, body: any }>} 状态码与响应体。
 */
async function post(baseUrl, body) {
  const response = await fetch(`${baseUrl}${ACTIONS_ROUTE_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text.length === 0 ? '' : JSON.parse(text) };
}

test('接缝 A（写）：写动作走一条顶层、带命名空间前缀的本机路由', () => {
  assert.equal(ACTIONS_ROUTE_PATH, '/gtd-workbench/actions');
  assert.match(ACTIONS_ROUTE_PATH, /^\/[a-z0-9-]+\/[a-z0-9-]+$/);
});

test('接缝 A（写）：完成成功 → 明确成功，并带一份重新取过数的快照', async () => {
  const { handler, writes } = actionsRouteUnderTest();
  const result = await withRoute(handler, async (baseUrl) => post(baseUrl, { action: 'complete', taskId: TARGET_ID }));
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.action, 'complete');
  assert.equal(result.body.taskId, TARGET_ID);
  // 写动作是替身做的：它拿到的是「目标动作所在清单的 id + 动作 id」。
  assert.deepEqual(writes, [{ action: 'complete', projectId: EXECUTION_PROJECT_ID, taskId: TARGET_ID }]);
  // 快照是写完之后重新取的：那条动作已经变成「已完成」。
  const execution = result.body.snapshot.containers.find((container) => container.key === 'execution');
  const note = execution.notes.find((item) => item.id === TARGET_ID);
  assert.ok(note, '快照里没有刚完成的那条动作');
  assert.equal(note.status, 2);
  assert.equal(note.statusLabel, '已完成');
});

test('接缝 A（写）：动作类型缺失 → invalid-argument，不是 500', async () => {
  const { handler, writes } = actionsRouteUnderTest();
  const result = await withRoute(handler, async (baseUrl) => post(baseUrl, { taskId: TARGET_ID }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'invalid-argument');
  assert.equal(typeof result.body.error.message, 'string');
  assert.notEqual(result.body.error.code, 'internal-error');
  assert.deepEqual(writes, [], '参数非法却写了滴答');
});

test('接缝 A（写）：动作类型不支持 → invalid-argument，不是 500', async () => {
  const { handler, writes } = actionsRouteUnderTest();
  const result = await withRoute(handler, async (baseUrl) =>
    post(baseUrl, { action: 'reschedule', taskId: TARGET_ID, params: { 截止日: '2026-11-09' } }),
  );
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'invalid-argument');
  assert.deepEqual(writes, [], '不支持的动作却写了滴答');
});

test('接缝 A（写）：目标 id 不是字符串 → invalid-argument，不是 500', async () => {
  const { handler, writes } = actionsRouteUnderTest();
  const result = await withRoute(handler, async (baseUrl) => post(baseUrl, { action: 'complete', taskId: 123 }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'invalid-argument');
  assert.deepEqual(writes, [], '目标 id 非法却写了滴答');
});

test('接缝 A（写）：请求体不是合法 JSON → invalid-argument，不是 500', async () => {
  const { handler, writes } = actionsRouteUnderTest();
  const result = await withRoute(handler, async (baseUrl) => post(baseUrl, '{ 这不是 JSON'));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'invalid-argument');
  assert.deepEqual(writes, []);
});

test('接缝 A（写）：目标不存在 → not-found，不是 500', async () => {
  const { handler, writes } = actionsRouteUnderTest();
  const result = await withRoute(handler, async (baseUrl) =>
    post(baseUrl, { action: 'complete', taskId: '根本不存在的那条' }),
  );
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'not-found');
  assert.deepEqual(writes, [], '目标不存在却写了滴答');
});

test('接缝 A（写）：滴答执行失败 → cli-failed，与读方向同一套语义', async () => {
  const { handler } = actionsRouteUnderTest({
    runAction: async () => {
      throw new DidaError('cli-failed', 'DIDA API 错误 500: boom');
    },
  });
  const result = await withRoute(handler, async (baseUrl) => post(baseUrl, { action: 'complete', taskId: TARGET_ID }));
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, 'cli-failed');
  assert.notEqual(result.body.error.code, 'not-authenticated');
  // 写失败不能表现为已完成：响应体里没有成功，也没有快照。
  assert.equal(result.body.ok, undefined);
  assert.equal(result.body.snapshot, undefined);
});

test('接缝 A（写）：滴答未登录 → not-authenticated，与读方向同一套语义', async () => {
  const { handler } = actionsRouteUnderTest({
    runAction: async () => {
      throw new DidaError('not-authenticated', '未找到 access token。请先运行 `dida auth login` 登录。');
    },
  });
  const result = await withRoute(handler, async (baseUrl) => post(baseUrl, { action: 'complete', taskId: TARGET_ID }));
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'not-authenticated');
  assert.match(result.body.error.message, /dida auth login/);
  assert.equal(result.body.ok, undefined);
});

test('接缝 A（写）：取数就失败时也是同一套失败语义', async () => {
  const { handler, writes } = actionsRouteUnderTest({
    runDida: async () => {
      throw new DidaError('not-authenticated', '未找到 access token。请先运行 `dida auth login` 登录。');
    },
  });
  const result = await withRoute(handler, async (baseUrl) => post(baseUrl, { action: 'complete', taskId: TARGET_ID }));
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'not-authenticated');
  assert.deepEqual(writes, []);
});

test('接缝 A（写）：访问守卫挡住的连接读不到写结果，也没碰滴答', async () => {
  const { handler, writes } = actionsRouteUnderTest({
    connection: { requestRejection: () => 403 },
  });
  const result = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${ACTIONS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete', taskId: TARGET_ID }),
    });
    return { status: response.status, text: await response.text() };
  });
  assert.equal(result.status, 403);
  assert.equal(result.text, '');
  assert.deepEqual(writes, [], '被拒的连接仍然触发了写入');
});

test('接缝 A（写）：写成功了但刷新没成 → 说清是刷新失败，不说成写失败', async () => {
  let written = false;
  const { handler, writes } = actionsRouteUnderTest({
    runDida: async ({ projectId }) => {
      // 写之后的取数（刷新）挂；写之前那次（找目标）成。
      if (written) throw new DidaError('cli-failed', 'DIDA API 错误 500: boom');
      return rawTasks.filter((task) => task.projectId === projectId);
    },
    runAction: async ({ action, projectId, taskId }) => {
      writes.push({ action, projectId, taskId });
      written = true;
      return { ok: true };
    },
  });
  const result = await withRoute(handler, async (baseUrl) => post(baseUrl, { action: 'complete', taskId: TARGET_ID }));
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true, '写成功了却被说成失败');
  assert.equal(result.body.snapshot, null);
  assert.equal(result.body.refreshError.code, 'cli-failed');
  assert.equal(writes.length, 1);
});

test('接缝 A（写）：读方法进不来写路由', async () => {
  const { handler, writes } = actionsRouteUnderTest();
  const result = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${ACTIONS_ROUTE_PATH}`);
    return { status: response.status, allow: response.headers.get('allow'), text: await response.text() };
  });
  assert.equal(result.status, 405);
  assert.equal(result.allow, 'POST');
  assert.equal(result.text, '');
  assert.deepEqual(writes, []);
});
