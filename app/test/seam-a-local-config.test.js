/**
 * 接缝 A（数据边界，Host → 客户端）：**本机清单 id 接进路由**。
 *
 * 仓库里的滴答清单 id 是**虚构占位**（真实 id 是个人信息，不进公开仓库），
 * 真机上由仓库根的 `local-config.json` 的「清单」字段覆盖。
 * 这一层断言的是**外部可观察行为**：
 * - 请求那条本机 HTTP 路由，取数用的是配置里的清单 id，响应体里的 `projectId` 也是它；
 * - **每次请求都重新解析一次**：改完配置 → 刷新 → 立刻生效；
 * - 写方向的「找目标」与「写完重新取数」用的是**同一份**解析结果。
 *
 * 夹具里的 id 全是编出来的，不是任何人的真实清单。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { readContainers } from '../lib/config.js';
import { CONTAINERS } from '../lib/containers.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { ACTIONS_ROUTE_PATH, createActionsHandler } from '../lib/write-route.js';
import { withRoute } from './helpers/http-harness.js';

const TIME_ZONE = 'Asia/Shanghai';
/** 本地 2026-11-05 08:00。 */
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 编一个清单 id（**虚构**）：前缀 `f00d` 一眼看出是占位。
 * @param {number} n - 序号。
 * @returns {string} 清单 id。
 */
function fakeId(n) {
  return `f00d${String(n).padStart(20, '0')}`;
}

/**
 * 造一份「清单」字段（按纸箱 key → 清单 id）。
 * @param {object} [overrides] - 覆盖某个纸箱的 id。
 * @returns {object} 配置里的「清单」字段。
 */
function idsOf(overrides = {}) {
  const table = {};
  for (const container of CONTAINERS) {
    table[container.key] = fakeId(container.key.length + 1);
  }
  return { ...table, ...overrides };
}

/**
 * 造一个临时「仓库根」，写一份 `local-config.json`。
 * @param {object} [config] - 配置内容。
 * @returns {string} 临时目录的绝对路径。
 */
function tempRoot(config) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gtd-route-'));
  writeFileSync(path.join(root, 'local-config.json'), JSON.stringify(config), 'utf8');
  return root;
}

/**
 * 请求读路由并读回响应体。
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

test('接缝 A：取数用本机配置里的清单 id，响应体里的 projectId 也是它', async () => {
  const root = tempRoot({ 清单: idsOf() });
  const asked = [];
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => {
      asked.push(args.projectId);
      return [];
    },
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    containers: () => readContainers({ root }),
  });
  const body = await readSnapshot(handler);
  const configured = readContainers({ root });
  // 六个纸箱逐个取数，用的都是配置里的 id。
  assert.deepEqual(asked, configured.map((container) => container.projectId));
  assert.deepEqual(
    body.containers.map((container) => container.projectId),
    configured.map((container) => container.projectId),
  );
  // 仓库里的占位没有漏进真实取数。
  for (const id of asked) {
    assert.notEqual(id, '7c4e00000000000000000002');
  }
  rmSync(root, { recursive: true, force: true });
});

test('接缝 A：每次请求都重新解析一次——改完配置刷新就生效', async () => {
  const root = tempRoot({ 清单: idsOf() });
  let parsed = 0;
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async () => [],
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    containers: () => {
      parsed += 1;
      return readContainers({ root });
    },
  });
  const first = await readSnapshot(handler);
  assert.equal(parsed, 1);
  // 改配置：换一个清单 id。
  writeFileSync(
    path.join(root, 'local-config.json'),
    JSON.stringify({ 清单: idsOf({ execution: fakeId(99) }) }),
    'utf8',
  );
  const second = await readSnapshot(handler);
  assert.equal(parsed, 2, '第二次请求没有重新解析');
  const execution = second.containers.find((container) => container.key === 'execution');
  assert.equal(execution.projectId, fakeId(99));
  assert.notEqual(
    first.containers.find((container) => container.key === 'execution').projectId,
    execution.projectId,
  );
  rmSync(root, { recursive: true, force: true });
});

test('接缝 A（写）：找目标与写完重新取数用的是同一份解析结果', async () => {
  const root = tempRoot({ 清单: idsOf() });
  const configured = readContainers({ root });
  const executionId = configured.find((container) => container.key === 'execution').projectId;
  const task = { id: 'target-1', projectId: executionId, title: '示例动作', status: 0 };
  const writes = [];
  const handler = createActionsHandler({
    connection: { requestRejection: () => undefined },
    runDida: async ({ projectId }) => (projectId === executionId ? [task] : []),
    runAction: async ({ action, projectId, taskId }) => {
      writes.push({ action, projectId, taskId });
      task.status = 2;
      return { ok: true };
    },
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    containers: () => readContainers({ root }),
  });
  const result = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${ACTIONS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete', taskId: 'target-1' }),
    });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  // 写动作带的是配置里的清单 id（不是仓库占位）。
  assert.deepEqual(writes, [{ action: 'complete', projectId: executionId, taskId: 'target-1' }]);
  // 写完重新取的那份快照，用的也是同一份清单 id。
  const execution = result.body.snapshot.containers.find((container) => container.key === 'execution');
  assert.equal(execution.projectId, executionId);
  rmSync(root, { recursive: true, force: true });
});
