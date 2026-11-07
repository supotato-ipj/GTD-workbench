/**
 * 接缝 A（数据边界，Host → 客户端）：**容量参数接进路由**。
 *
 * 容量参数是**本机文件**（不进公开仓库）：`local-config.json` 的「容量」字段。
 * 这一层断言的是**外部可观察行为**：
 * - 配置生效时，快照里的 `capacity.asOf` 是配置里的「定于」，`today.remainingMinutes` 按配置算；
 * - 没有配置时，`asOf` 为 `null`、剩余按**通用默认值**算；
 * - 改完配置 → 刷新 → 立刻生效（每次请求都重新读）。
 *
 * 夹具里的数值全是编出来的，不是任何人的真实容量（真实容量数值属于个人工作容量）。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { DEFAULT_CAPACITY_CONFIG } from '../lib/capacity.js';
import { readCapacityConfig } from '../lib/config.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { ACTIONS_ROUTE_PATH, createActionsHandler } from '../lib/write-route.js';
import { withRoute } from './helpers/http-harness.js';

const TIME_ZONE = 'Asia/Shanghai';
/** 本地 2026-11-05 08:00（窗口 09:00 之前）。 */
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 一份**虚构**的容量配置。
 *
 * 口径（手算得出来，断言里的期望值就是按这份配置手算的）：
 * - 窗口 09:00–12:00 = 180 分钟；
 * - 日清一项 09:00 成本 20 分钟（落在窗口内）→ 从可排时间里扣；
 * - 插入损耗 10 分钟；
 * - 08:00 时剩余窗口 180 分钟、日清剩余 20 分钟 → 剩余可排时间 = 180 − 20 − 10 = **150**。
 * @param {object} [overrides] - 顶层字段覆盖。
 * @returns {object} 配置。
 */
function capacityConfig(overrides = {}) {
  return {
    定于: '2026-01-01',
    窗口: [{ 起: '09:00', 止: '12:00', 类: '连续' }],
    不可占: [],
    日清: [{ 名: '示例固定成本', 时段: '09:00', 成本分: 20 }],
    插入损耗分钟: 10,
    深度: { 单日上限分钟: 120, 单日配额: 1, 估时系数: 2 },
    番茄分钟: 25,
    ...overrides,
  };
}

/**
 * 造一个临时「仓库根」，写一份 `local-config.json`。
 * @param {object} [config] - 配置内容。
 * @returns {string} 临时目录的绝对路径。
 */
function tempRoot(config) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gtd-capacity-route-'));
  writeFileSync(path.join(root, 'local-config.json'), JSON.stringify(config), 'utf8');
  return root;
}

/**
 * 造一条只喂容量配置的读路由。
 * @param {object} [overrides] - 覆盖项。
 * @returns {Function} 路由处理函数。
 */
function routeUnderTest(overrides = {}) {
  return createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async () => [],
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    ...overrides,
  });
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

test('接缝 A：容量配置生效时，asOf 是配置里的「定于」，剩余可排时间按配置算', async () => {
  const root = tempRoot({ 容量: capacityConfig() });
  const snapshot = await readSnapshot(
    routeUnderTest({ capacityConfig: () => readCapacityConfig({ root }) }),
  );
  assert.equal(snapshot.capacity.asOf, '2026-01-01');
  // 180 − 20（日清，落在窗口内）− 10（插入损耗）= 150。
  assert.equal(snapshot.capacity.windowMinutes, 180);
  assert.equal(snapshot.capacity.dailyMinutes, 20);
  assert.equal(snapshot.capacity.interruptionMinutes, 10);
  assert.equal(snapshot.capacity.schedulableMinutes, 150);
  assert.equal(snapshot.capacity.remainingMinutes, 150);
  assert.equal(snapshot.today.remainingMinutes, 150);
  rmSync(root, { recursive: true, force: true });
});

test('接缝 A：容量配置生效时，日清成本分两拨过界（窗口内 / 窗口外）', async () => {
  const root = tempRoot({
    容量: capacityConfig({
      日清: [
        { 名: '示例窗口内成本', 时段: '09:00', 成本分: 20 },
        { 名: '示例窗口外成本', 时段: '15:00', 成本分: 30 },
      ],
    }),
  });
  const snapshot = await readSnapshot(
    routeUnderTest({ capacityConfig: () => readCapacityConfig({ root }) }),
  );
  assert.equal(snapshot.capacity.dailyMinutes, 50);
  assert.equal(snapshot.capacity.dailyMinutesInWindow, 20);
  assert.equal(snapshot.capacity.dailyMinutesOutsideWindow, 30);
  // 窗口外那笔不占可排时间：180 − 20 − 10 = 150。
  assert.equal(snapshot.capacity.schedulableMinutes, 150);
  rmSync(root, { recursive: true, force: true });
});

test('接缝 A：没有容量配置时，asOf 为 null、剩余按通用默认值算', async () => {
  const snapshot = await readSnapshot(
    routeUnderTest({ capacityConfig: () => DEFAULT_CAPACITY_CONFIG }),
  );
  assert.equal(snapshot.capacity.asOf, null);
  // 通用默认值：窗口 330、日清 15（窗口内）、插入损耗 45 → 剩余 270。
  assert.equal(snapshot.capacity.windowMinutes, 330);
  assert.equal(snapshot.capacity.dailyMinutes, 15);
  assert.equal(snapshot.capacity.interruptionMinutes, 45);
  assert.equal(snapshot.capacity.schedulableMinutes, 270);
  assert.equal(snapshot.capacity.remainingMinutes, 270);
  assert.equal(snapshot.today.remainingMinutes, 270);
});

test('接缝 A：改完容量配置刷新就生效——每次请求都重新读', async () => {
  const root = tempRoot({ 容量: capacityConfig() });
  const handler = routeUnderTest({ capacityConfig: () => readCapacityConfig({ root }) });
  const first = await readSnapshot(handler);
  assert.equal(first.capacity.asOf, '2026-01-01');
  assert.equal(first.capacity.remainingMinutes, 150);
  // 改配置：窗口拉长、番茄分钟也改。
  writeFileSync(
    path.join(root, 'local-config.json'),
    JSON.stringify({ 容量: capacityConfig({ 定于: '2026-02-02', 窗口: [{ 起: '09:00', 止: '13:00' }] }) }),
    'utf8',
  );
  const second = await readSnapshot(handler);
  assert.equal(second.capacity.asOf, '2026-02-02');
  // 240 − 20 − 10 = 210。
  assert.equal(second.capacity.windowMinutes, 240);
  assert.equal(second.capacity.remainingMinutes, 210);
  rmSync(root, { recursive: true, force: true });
});

test('接缝 A（写）：写完重新取的那份快照，容量也是本次请求解析出来的那一份', async () => {
  const root = tempRoot({ 容量: capacityConfig() });
  const handler = createActionsHandler({
    connection: { requestRejection: () => undefined },
    runDida: async () => [],
    runAction: async () => ({ ok: true }),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    capacityConfig: () => readCapacityConfig({ root }),
  });
  const result = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${ACTIONS_ROUTE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete', taskId: 'target-1' }),
    });
    return { status: response.status, body: await response.json() };
  });
  // 目标不存在 → 写没发生；但容量口径与路由一致，不该在这一步炸。
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'not-found');
  rmSync(root, { recursive: true, force: true });
});

test('接缝 A（写）：写成功后的刷新快照带着同一份容量口径', async () => {
  const root = tempRoot({ 容量: capacityConfig() });
  const handler = createActionsHandler({
    connection: { requestRejection: () => undefined },
    runDida: async () => [{ id: 'target-1', projectId: 'inbox9000000001', title: '示例动作', status: 0 }],
    runAction: async () => ({ ok: true }),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    containers: [{ key: 'inbox', name: '收集箱', listName: '收集箱', projectId: 'inbox9000000001' }],
    capacityConfig: () => readCapacityConfig({ root }),
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
  assert.equal(result.body.snapshot.capacity.asOf, '2026-01-01');
  assert.equal(result.body.snapshot.capacity.remainingMinutes, 150);
  rmSync(root, { recursive: true, force: true });
});
