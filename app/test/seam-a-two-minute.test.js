/**
 * 接缝 A（数据边界，Host → 客户端）：两分钟卡在**响应体**里的样子。
 *
 * 断言的是外部可观察行为：
 * - 在日回顾窗口里，收集箱里那条估时两分钟的捕获**占住主卡位**，卡上带两分钟标记；
 * - 同一条便贴在收集箱里带 `eligible: true`（收集箱里唯一能有资格的条目就是两分钟卡）；
 * - 不在日回顾窗口里、或深度块进行中时，它不占主卡位（主卡仍是正常动作）；
 * - **勾完成之后**它既不在焦点、也不在六箱画布的收集箱里——它不做完就消失，
 *   不进任何分类。
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
/** 本地 2026-11-05（周四）14:50 —— 落在日回顾窗口（14:45–15:00）内。 */
const IN_REVIEW_WINDOW = '2026-11-05T06:50:00.000Z';
/** 本地 2026-11-05（周四）09:30 —— 落在连续窗口（深度块）内。 */
const IN_DEEP_WINDOW = '2026-11-05T01:30:00.000Z';
/** 本地 2026-11-05（周四）08:00 —— 不在日回顾窗口内。 */
const OUTSIDE_REVIEW_WINDOW = '2026-11-05T00:00:00.000Z';

/** 收集箱里那条被估成两分钟的捕获（夹具里的 id，标题是虚构示例）。 */
const CAPTURE_ID = '7c4e00000000000000000018';

/** 两分钟规则的参数（显式给，别让本机配置决定这条断言的结果）。 */
const POLICY = {
  enabled: true,
  maxMinutes: 2,
  reviewWindow: { start: '14:45', end: '15:00' },
};

/**
 * 造一份带两分钟估算的夹具。
 * @param {object} [options] - 选项。
 * @param {number} [options.estimateMinutes] - 给收集箱那条捕获的估算分钟；不给就不加估算。
 * @param {number} [options.status] - 那条捕获的滴答状态（默认未完成）。
 * @returns {object[]} 原始任务。
 */
function tasksWith({ estimateMinutes = 2, status = 0 } = {}) {
  return rawTasks.map((task) =>
    task.id === CAPTURE_ID
      ? {
          ...task,
          status,
          focusSummaries: { estimatedDuration: estimateMinutes },
        }
      : task,
  );
}

/**
 * 请求那条本机 HTTP 路由并读回快照。
 * @param {object[]} tasks - 原始任务。
 * @param {object} [options] - 选项。
 * @param {string} [options.now] - 生成时刻（ISO）。
 * @param {object} [options.policy] - 两分钟规则参数。
 * @returns {Promise<object>} 快照。
 */
async function snapshotOf(tasks, { now = IN_REVIEW_WINDOW, policy = POLICY } = {}) {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    // 与生产同口径：只取**未完成**（滴答 `--status 0`），完成的那条自然不在快照里。
    runDida: async ({ projectId, status }) =>
      tasks.filter((task) => task.projectId === projectId && task.status === status),
    timeZone: TIME_ZONE,
    now: () => new Date(now),
    // 显式给「通用默认值」：本机有没有 `local-config.json` 不该决定这条断言的结果。
    capacityConfig: () => DEFAULT_CAPACITY_CONFIG,
    twoMinutePolicy: () => policy,
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

/**
 * 某个纸箱里的便贴 id 清单。
 * @param {object} snapshot - 快照。
 * @param {string} key - 纸箱标识。
 * @returns {string[]} 便贴 id。
 */
function idsIn(snapshot, key) {
  const container = snapshot.containers.find((item) => item.key === key);
  assert.ok(container, `快照里没有 ${key} 那个纸箱`);
  return container.notes.map((note) => note.id);
}

test('接缝 A：日回顾窗口里，两分钟的收集箱捕获占住主卡位，卡上带两分钟标记', async () => {
  const snapshot = await snapshotOf(tasksWith());
  const card = snapshot.focus.card;
  assert.ok(card !== null, '主卡是空的');
  assert.equal(card.id, CAPTURE_ID);
  assert.equal(card.container, 'inbox');
  // 引导标记：Client 侧据此显示「直接做掉、别判定」。
  assert.equal(card.twoMinute, true);
  // 事实也一起过界：预计耗时与来源由 Host 算，Client 不重算。
  assert.equal(card.estimateMinutes, 2);
  assert.equal(card.estimateSource, 'estimatedDuration');
});

test('接缝 A：收集箱里那条两分钟捕获带 eligible：true', async () => {
  const snapshot = await snapshotOf(tasksWith());
  const note = noteOf(snapshot, CAPTURE_ID);
  assert.equal(note.eligible, true);
  assert.equal(note.ineligibleReason, null);
});

test('接缝 A：不在日回顾窗口里，它不占主卡位，主卡仍是正常动作', async () => {
  const snapshot = await snapshotOf(tasksWith(), { now: OUTSIDE_REVIEW_WINDOW });
  const card = snapshot.focus.card;
  assert.ok(card !== null, '主卡是空的');
  assert.notEqual(card.id, CAPTURE_ID);
  assert.equal(card.twoMinute, false);
  // 收集箱里那条还是「未明晰」——它没有资格，只是没到整理的时候。
  const note = noteOf(snapshot, CAPTURE_ID);
  assert.equal(note.eligible, false);
  assert.equal(note.ineligibleReason, '收集箱未明晰');
});

test('接缝 A：深度块进行中，它不抢主卡位', async () => {
  // 日回顾窗口压在连续窗口上：09:30 落在连续窗口内，今天还有深度档动作 → 深度块进行中。
  const snapshot = await snapshotOf(tasksWith(), {
    now: IN_DEEP_WINDOW,
    policy: { ...POLICY, reviewWindow: { start: '09:00', end: '10:00' } },
  });
  const card = snapshot.focus.card;
  assert.ok(card !== null, '主卡是空的');
  assert.notEqual(card.id, CAPTURE_ID);
  assert.equal(card.twoMinute, false);
  // 今天的深度名额被深度档动作占着——这就是「深度块进行中」的那一半。
  assert.equal(snapshot.today.deepQuotaUsed, true);
  const note = noteOf(snapshot, CAPTURE_ID);
  assert.equal(note.eligible, false);
  assert.equal(note.ineligibleReason, '收集箱未明晰');
});

test('接缝 A：勾完成之后，它既不在焦点、也不在收集箱里', async () => {
  const snapshot = await snapshotOf(tasksWith({ status: 2 }));
  // 不在收集箱的便贴里（取数只取未完成）。
  assert.equal(idsIn(snapshot, 'inbox').includes(CAPTURE_ID), false);
  // 也不在焦点上：主卡不是它，「接下来」里也没有它。
  const card = snapshot.focus.card;
  assert.ok(card !== null, '主卡是空的');
  assert.notEqual(card.id, CAPTURE_ID);
  assert.equal(
    snapshot.focus.next.some((item) => item.id === CAPTURE_ID),
    false,
  );
});
