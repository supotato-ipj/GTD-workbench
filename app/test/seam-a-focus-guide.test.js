/**
 * 接缝 A（数据边界，Host → 客户端）：v2 焦点引导器的快照契约。
 *
 * 断言的是**响应体**：主位行动卡至多一条、「接下来」不超过四条、
 * 每条便贴都带资格与不合格原因、容量字段齐全且算得出来、两次请求顺序稳定。
 *
 * 快照用固定夹具，不依赖本机实时滴答数据——真实滴答那一层是接缝 C，手动验收。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CAPACITY_CONFIG } from '../lib/capacity.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
/** 本地 2026-11-05（周四）08:00。 */
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 用一份滴答原始任务取快照（真的起一条本机 HTTP 路由、真的发一次请求）。
 * @param {object[]} tasks - 原始任务。
 * @returns {Promise<object>} 快照。
 */
async function snapshotOf(tasks) {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => tasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    // 显式给「通用默认值」：路由默认会去读本机配置，
    // 那台机器上有没有 `local-config.json` 不该决定这条断言的结果。
    capacityConfig: () => DEFAULT_CAPACITY_CONFIG,
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

/**
 * 在快照里找到一条便贴。
 * @param {object} snapshot - 快照。
 * @param {string} id - 便贴 id。
 * @returns {object} 便贴。
 */
function noteOf(snapshot, id) {
  for (const container of snapshot.containers) {
    for (const note of container.notes) {
      if (note.id === id) return note;
    }
  }
  throw new Error(`快照里没有 id 为 ${id} 的便贴`);
}

test('接缝 A：焦点是一个对象，主卡至多一条、「接下来」不超过四条', async () => {
  const snapshot = await snapshotOf(rawTasks);
  assert.equal(typeof snapshot.focus, 'object');
  assert.ok(snapshot.focus !== null);
  assert.ok(snapshot.focus.card === null || typeof snapshot.focus.card === 'object');
  assert.ok(Array.isArray(snapshot.focus.next));
  assert.ok(snapshot.focus.next.length <= 4, `「接下来」有 ${snapshot.focus.next.length} 条`);
});

test('接缝 A：主卡带齐工作内容、完成时限、完成要求、预计耗时与容量提示', async () => {
  const snapshot = await snapshotOf(rawTasks);
  const card = snapshot.focus.card;
  assert.ok(card !== null, '主卡是空的');
  assert.equal(typeof card.id, 'string');
  assert.equal(typeof card.title, 'string');
  assert.notEqual(card.title, '');
  // 完成时限
  assert.equal(typeof card.dueLocal, 'string');
  // 时间档
  assert.ok(['深度', '事务'].includes(card.timeBand));
  // 完成要求（本票只留位置，完成要求由后续一票填）
  assert.equal(typeof card.requirement, 'object');
  assert.ok('text' in card.requirement);
  assert.ok('source' in card.requirement);
  // 预计耗时：夹具里没有专注估算 → 未估算（null），不是 0
  assert.equal(card.estimateMinutes, null);
  assert.equal(card.estimateSource, null);
  // 容量提示
  assert.equal(typeof card.capacityHint, 'object');
  assert.equal(typeof card.capacityHint.remainingMinutes, 'number');
  assert.ok('fits' in card.capacityHint);
});

test('接缝 A：滴答的专注估算字段换算成预计耗时', async () => {
  const estimated = rawTasks.map((task) =>
    task.id === '6ad5b0aa1e4b0c399cc072706'
      ? { ...task, focusSummaries: { estimatedPomo: 2, estimatedDuration: 30 } }
      : task,
  );
  const snapshot = await snapshotOf(estimated);
  const card = snapshot.focus.card;
  assert.ok(card !== null);
  assert.equal(card.estimateMinutes, 50);
  assert.equal(card.estimateSource, 'estimatedPomo');
  // 装不装得下：估时 50 分钟，剩余可排时间远不止 50。
  assert.equal(card.capacityHint.fits, true);
});

test('接缝 A：每条便贴都带资格与不合格原因，落在正确的条目上', async () => {
  const snapshot = await snapshotOf(rawTasks);
  // 收集箱里的捕获：未明晰，不进焦点。
  const inbox = noteOf(snapshot, '7c4e00000000000000000015');
  assert.equal(inbox.eligible, false);
  assert.equal(inbox.ineligibleReason, '收集箱未明晰');
  // 项目清单：不出卡。
  const project = noteOf(snapshot, '7c4e00000000000000000007');
  assert.equal(project.eligible, false);
  assert.equal(project.ineligibleReason, '项目不出卡');
  // 等待清单：永不占主卡。
  const waiting = noteOf(snapshot, '7c4e00000000000000000012');
  assert.equal(waiting.eligible, false);
  assert.equal(waiting.ineligibleReason, '等待');
  // 日历项：还没到它那一个时刻。
  const calendar = noteOf(snapshot, '7c4e0000000000000000000e');
  assert.equal(calendar.eligible, false);
  assert.equal(calendar.ineligibleReason, '未来日历项');
  // 可能清单：还没到触碰日。
  const maybe = noteOf(snapshot, '7c4e00000000000000000006');
  assert.equal(maybe.eligible, false);
  assert.equal(maybe.ineligibleReason, '未到触碰日');
  // 日清：顶部常驻，不参与排序。
  const daily = noteOf(snapshot, '7c4e0000000000000000000b');
  assert.equal(daily.eligible, false);
  assert.equal(daily.ineligibleReason, '日清常驻顶部');
  // 执行清单里带唯一时间档的动作：有资格。
  const action = noteOf(snapshot, '6ad5b0aa1e4b0c399cc072706');
  assert.equal(action.eligible, true);
  assert.equal(action.ineligibleReason, null);
});

test('接缝 A：深度名额只有一个，第二个深度动作被推到明天并说清原因', async () => {
  const snapshot = await snapshotOf(rawTasks);
  const pushed = noteOf(snapshot, '7c4e00000000000000000008');
  assert.equal(pushed.eligible, false);
  assert.equal(pushed.ineligibleReason, '深度配额已用');
  assert.equal(snapshot.today.deepQuotaUsed, true);
  // 被推走的那条不进「接下来」。
  assert.equal(
    snapshot.focus.next.some((item) => item.id === '7c4e00000000000000000008'),
    false,
  );
});

test('接缝 A：今日日清状态与剩余可排时间在快照顶层', async () => {
  const snapshot = await snapshotOf(rawTasks);
  assert.ok(Array.isArray(snapshot.today.daily));
  const daily = snapshot.today.daily.find((item) => item.id === '7c4e0000000000000000000b');
  assert.ok(daily, '日清清单里没有那条日清项');
  assert.equal(daily.state, '未还清');
  assert.equal(typeof snapshot.today.remainingMinutes, 'number');
  assert.ok(snapshot.today.remainingMinutes >= 0);
  assert.equal(typeof snapshot.today.deepQuotaUsed, 'boolean');
});

test('接缝 A：容量字段齐全且算得出来', async () => {
  const snapshot = await snapshotOf(rawTasks);
  assert.ok('asOf' in snapshot.capacity);
  // 通用默认值 = 未定于某日。
  assert.equal(snapshot.capacity.asOf, null);
  // 可排时间 = 窗口时长 − 日清成本 − 插入损耗（算得出来，不是黑箱）。
  assert.equal(
    snapshot.capacity.schedulableMinutes,
    snapshot.capacity.windowMinutes - snapshot.capacity.dailyMinutes - snapshot.capacity.interruptionMinutes,
  );
  assert.ok(snapshot.capacity.remainingMinutes >= 0);
  assert.ok(snapshot.capacity.remainingMinutes <= snapshot.capacity.schedulableMinutes);
  assert.equal(snapshot.today.remainingMinutes, snapshot.capacity.remainingMinutes);
  // 主卡上的容量提示与容量口径一致。
  const card = snapshot.focus.card;
  assert.equal(card.capacityHint.remainingMinutes, snapshot.capacity.remainingMinutes);
  assert.equal(card.capacityHint.schedulableMinutes, snapshot.capacity.schedulableMinutes);
});

test('接缝 A：两次请求之间的焦点与顺序稳定', async () => {
  const first = await snapshotOf(rawTasks);
  const second = await snapshotOf(rawTasks);
  assert.equal(first.focus.card.id, second.focus.card.id);
  assert.deepEqual(
    first.focus.next.map((item) => item.id),
    second.focus.next.map((item) => item.id),
  );
});

test('接缝 A：本周主攻仍在，只是字段改名叫 mainPush', async () => {
  const snapshot = await snapshotOf(rawTasks);
  assert.ok(Array.isArray(snapshot.mainPush));
  assert.deepEqual(
    snapshot.mainPush.map((item) => item.title),
    ['⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）', '⑨ 案件留痕清单（③④⑦ 各 5 行）'],
  );
  // 焦点是另一个东西，不再和本周主攻共用一个名字。
  assert.notEqual(snapshot.focus, undefined);
  assert.equal(Array.isArray(snapshot.focus), false);
});

test('接缝 A：空容器仍然存在，且是空数组', async () => {
  const snapshot = await snapshotOf([]);
  assert.equal(snapshot.containers.length, 6);
  for (const container of snapshot.containers) {
    assert.deepEqual(container.notes, []);
  }
  assert.equal(snapshot.focus.card, null);
  assert.deepEqual(snapshot.focus.next, []);
  assert.deepEqual(snapshot.focus.reminders, []);
  assert.deepEqual(snapshot.today.daily, []);
});

test('接缝 A：等待项「到期没回」出现在提醒位上，不占主卡', async () => {
  const overdue = rawTasks.map((task) =>
    task.id === '7c4e00000000000000000012'
      ? {
          ...task,
          content: '等谁：某单位；等什么：回函；什么时候回：11/4 08:30；到期没回：改走分管领导',
          dueDate: '2026-11-04T00:30:00.000+0000',
        }
      : task,
  );
  const snapshot = await snapshotOf(overdue);
  const reminder = snapshot.focus.reminders.find((item) => item.id === '7c4e00000000000000000012');
  assert.ok(reminder, '到期没回的等待项没有进提醒位');
  assert.equal(reminder.replyDue, '2026-11-04 08:30');
  // 提醒位不占主卡。
  assert.notEqual(snapshot.focus.card.id, '7c4e00000000000000000012');
  // 还没到期的那条不进提醒位。
  assert.equal(
    snapshot.focus.reminders.some((item) => item.id === '7c4e00000000000000000006'),
    false,
  );
});
