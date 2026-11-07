/**
 * 接缝 A（数据边界，Host → 客户端）：完成要求随快照过界。
 *
 * 断言的是**响应体**：每条便贴都带 `requirement`（键不能省），主位行动卡的 `requirement`
 * 有原文、有来源标记，而且与便贴上那一份是**同一口径**（同一处算出来的，不各算各的）。
 *
 * 来源有两条，主次分明：编号匹配到的 markdown 记录页的「验收标准」优先，
 * 记录页那一页没有验收标准或根本没匹配上时，回退正文里的 `完成要求：` 前缀。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { RECORDS_DIR, REPO_ROOT, loadRecords } from '../lib/records.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

/** 仓库自带的样本记录页目录（虚构样本）。 */
const SAMPLE_DIR = path.join(REPO_ROOT, RECORDS_DIR);

const TIME_ZONE = 'Asia/Shanghai';
/** 本地 2026-11-05（周四）08:00。 */
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 请求那条路由并读回响应体。
 * @param {object[]} tasks - 滴答原始任务。
 * @returns {Promise<object>} 快照。
 */
async function snapshotOf(tasks) {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => tasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    loadRecords: () => loadRecords({ dir: SAMPLE_DIR }),
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
 * 把主卡让给那条「⑥ 汇总」——它的标题带编号，能对到记录页。
 *
 * 夹具里主卡本来是那条逾期的事务活（逾期优先），它没有编号、对不到记录页，
 * 完成要求自然是空的；要断言「记录页那一侧」得先把主卡换成带编号的那一条。
 * @returns {object[]} 改造后的滴答原始任务。
 */
function tasksWithNumberedCard() {
  return rawTasks.map((task) =>
    task.id === '6ad5b0aa1e4b0c399cc072706'
      ? { ...task, dueDate: '2026-11-06T06:15:00.000+0000' }
      : task,
  );
}

test('接缝 A：每条便贴都带完成要求，键不能省', async () => {
  const snapshot = await snapshotOf(rawTasks);
  const notes = snapshot.containers.flatMap((container) => container.notes);
  assert.ok(notes.length > 0, '快照里一条便贴都没有');
  for (const note of notes) {
    assert.ok(Object.prototype.hasOwnProperty.call(note, 'requirement'), `便贴 ${note.id} 没有 requirement 键`);
    assert.equal(typeof note.requirement, 'object');
    assert.ok('text' in note.requirement);
    assert.ok('source' in note.requirement);
    assert.ok(note.requirement.text === null || typeof note.requirement.text === 'string');
    assert.ok(note.requirement.source === null || typeof note.requirement.source === 'string');
  }
});

test('接缝 A：主卡的完成要求来自编号匹配到的记录页', async () => {
  const snapshot = await snapshotOf(tasksWithNumberedCard());
  const card = snapshot.focus.card;
  assert.ok(card !== null, '主卡是空的');
  assert.equal(card.title, '⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）');
  assert.equal(card.requirement.source, '记录页');
  assert.equal(card.requirement.text, '每个版块的职责数量与口径对得上：一条职责只在一处出现。');
});

test('接缝 A：主卡与便贴上的完成要求是同一口径——同一个值，不是各算各的', async () => {
  const snapshot = await snapshotOf(tasksWithNumberedCard());
  const card = snapshot.focus.card;
  const note = noteOf(snapshot, card.id);
  assert.deepEqual(note.requirement, card.requirement);
});

test('接缝 A：编号匹配到、但那一页没有验收标准时，回退正文前缀', async () => {
  // ① 那一页没有「验收标准」段（样本里 acceptance 为 null）。
  const rewritten = rawTasks.map((task) =>
    task.id === '7c4e00000000000000000015'
      ? { ...task, title: '① 单据分桶归档：核对一遍', content: '完成要求：逐张对齐分桶规则' }
      : task,
  );
  const snapshot = await snapshotOf(rewritten);
  const note = noteOf(snapshot, '7c4e00000000000000000015');
  assert.equal(note.record, '①');
  assert.deepEqual(note.requirement, { text: '逐张对齐分桶规则', source: '正文前缀' });
});

test('接缝 A：编号没匹配上时，回退正文前缀', async () => {
  const rewritten = rawTasks.map((task) =>
    task.id === '7c4e00000000000000000015'
      ? { ...task, title: '没有编号的一条动作', content: '完成要求：把当天记录归到一处并标好索引' }
      : task,
  );
  const snapshot = await snapshotOf(rewritten);
  const note = noteOf(snapshot, '7c4e00000000000000000015');
  assert.equal(note.record, null);
  assert.deepEqual(note.requirement, { text: '把当天记录归到一处并标好索引', source: '正文前缀' });
});

test('接缝 A：两条都没有时完成要求是空的——空说明判定没做完', async () => {
  const snapshot = await snapshotOf(rawTasks);
  const note = noteOf(snapshot, '7c4e00000000000000000015');
  assert.equal(note.record, null);
  assert.deepEqual(note.requirement, { text: null, source: null });
});

test('接缝 A：读不到记录页时完成要求照样是空，不打掉板子', async () => {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    loadRecords: () => {
      throw new Error('EACCES: 读不到 records');
    },
  });
  const snapshot = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
  const note = noteOf(snapshot, '7c4e0000000000000000000d');
  assert.deepEqual(note.requirement, { text: null, source: null });
});
