/**
 * 接缝 A（数据边界，Host → 客户端）：本周主攻随快照过界。
 *
 * 断言的是外部可观察行为：响应体里的 `focus` 是从滴答的 `深度` 标签推出来的，
 * 改标签它就跟变——而手写名单一个字都影响不到它。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
/** 本地 2026-11-05（周四）08:00。 */
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 用一份滴答原始任务取快照。
 * @param {object[]} tasks - 原始任务。
 * @returns {Promise<object>} 快照。
 */
async function snapshotOf(tasks) {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => tasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

test('接缝 A：本周主攻由本周内未完成且带深度标签的动作推导', async () => {
  const snapshot = await snapshotOf(rawTasks);
  // 夹具里带 `深度` 的两条都在本周内：⑥ 汇总（今天）、⑨ 案件留痕（明天）。
  assert.deepEqual(
    snapshot.focus.map((item) => item.title),
    ['⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）', '⑨ 案件留痕清单（③④⑦ 各 5 行）'],
  );
  assert.deepEqual(
    snapshot.focus.map((item) => item.segment),
    ['today', 'tomorrow'],
  );
  // 每条主攻都能在便贴里找到，不存在「名单里有、板子上没有」。
  const noteIds = new Set(snapshot.containers.flatMap((container) => container.notes.map((note) => note.id)));
  for (const item of snapshot.focus) assert.ok(noteIds.has(item.id));
});

test('接缝 A：条数与滴答一致——把「深度」改成「事务」后重新拉数，主攻随之少一条', async () => {
  const degraded = rawTasks.map((task) =>
    task.id === '7c4e0000000000000000000d' ? { ...task, tags: ['事务'] } : task,
  );
  const before = await snapshotOf(rawTasks);
  const after = await snapshotOf(degraded);
  assert.equal(before.focus.length, 2);
  assert.equal(after.focus.length, 1);
  assert.equal(after.focus[0].id, '7c4e00000000000000000008');
});

test('接缝 A：只依据滴答的深度标签——把标签全摘掉，主攻就空了', async () => {
  const stripped = rawTasks.map((task) => (Array.isArray(task.tags) ? { ...task, tags: [] } : task));
  const snapshot = await snapshotOf(stripped);
  assert.deepEqual(snapshot.focus, []);
});

test('接缝 A：已完成或落在「以后」的深度动作不进主攻', async () => {
  const later = rawTasks.map((task) =>
    task.id === '7c4e00000000000000000008' ? { ...task, dueDate: '2026-12-20T07:00:00.000+0000' } : task,
  );
  const snapshot = await snapshotOf(later);
  assert.deepEqual(
    snapshot.focus.map((item) => item.id),
    ['7c4e0000000000000000000d'],
  );
  const done = rawTasks.map((task) => (task.id === '7c4e0000000000000000000d' ? { ...task, status: 2 } : task));
  const snapshotDone = await snapshotOf(done);
  assert.deepEqual(
    snapshotDone.focus.map((item) => item.id),
    ['7c4e00000000000000000008'],
  );
});

test('接缝 A：每条便贴都带 segment，主攻的推导才有据可依', async () => {
  const snapshot = await snapshotOf(rawTasks);
  for (const container of snapshot.containers) {
    for (const note of container.notes) {
      assert.ok(['today', 'tomorrow', 'thisWeek', 'later'].includes(note.segment));
    }
  }
});
