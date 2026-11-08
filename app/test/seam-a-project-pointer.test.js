/**
 * 接缝 A（数据边界，Host → 客户端）：**卡脚的项目指针**在响应体里的样子。
 *
 * 规格 issue #1 的用户故事 22–24：
 * - 22：卡脚有项目的下一步指针（做这一件的时候知道它在哪条线上）；
 * - 23：点项目能看项目清单的全貌；
 * - 24：点项目能看那页 markdown 记录。
 *
 * 数据现实：滴答里项目与动作之间**没有关联字段**，所以指针靠既有口径推——
 * 动作的 markdown 记录编号（①–⑨）与**项目箱箱签标题的编号**对上。
 * 推导在 Host 侧（`app/lib/project.js`），Client 只画不算。
 *
 * 断言的是外部可观察行为：响应体里的 `focus.card.project`。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CAPACITY_CONFIG } from '../lib/capacity.js';
import { RECORDS_DIR, REPO_ROOT, loadRecords } from '../lib/records.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

/** 仓库自带的样本记录页目录：测试读它，不读本机的真实记录页。 */
const SAMPLE_DIR = path.join(REPO_ROOT, RECORDS_DIR);

const TIME_ZONE = 'Asia/Shanghai';
/** 本地 2026-11-03 09:00——此刻主卡是那条 ⑥ 的动作。 */
const AT_PROJECT_ACTION = '2026-11-03T01:00:00.000Z';
/** 本地 2026-11-05 08:00——此刻主卡是那条没有记录编号的动作。 */
const AT_PLAIN_ACTION = '2026-11-05T00:00:00.000Z';

/** 项目箱里那张 ⑥ 箱签（夹具里的 id）。 */
const PROJECT_TAG_ID = '7c4e00000000000000000007';

/**
 * 请求那条本机 HTTP 路由并读回快照。
 * @param {string} [now] - 生成时刻（ISO）。
 * @returns {Promise<object>} 快照。
 */
async function snapshotOf(now) {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(now),
    // 显式给「通用默认值」与仓库自带的样本记录页：本机配置不该决定这条断言的结果。
    capacityConfig: () => DEFAULT_CAPACITY_CONFIG,
    loadRecords: () => loadRecords({ dir: SAMPLE_DIR }),
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

test('接缝 A：主卡带项目指针——推自记录编号与项目箱箱签的编号', async () => {
  const snapshot = await snapshotOf(AT_PROJECT_ACTION);
  const card = snapshot.focus.card;
  assert.ok(card !== null, '主卡是空的');
  // 这条动作的记录编号是 ⑥。
  assert.equal(card.record, '⑥');
  // 项目指针指到项目箱里那张 ⑥ 箱签。
  assert.deepEqual(card.project, {
    id: PROJECT_TAG_ID,
    name: '部门职责分工（定稿交领导）',
    record: '⑥',
  });
});

test('接缝 A：推不出项目的卡不带指针——键在，值是 null（缺就是缺，不编）', async () => {
  const snapshot = await snapshotOf(AT_PLAIN_ACTION);
  const card = snapshot.focus.card;
  assert.ok(card !== null, '主卡是空的');
  // 这条动作没有记录编号 → 推不出项目。
  assert.equal(card.record, null);
  assert.ok(Object.prototype.hasOwnProperty.call(card, 'project'), 'project 键被省掉了');
  assert.equal(card.project, null);
});

test('接缝 A：「接下来」里的窄条也带项目指针（点它换主卡时卡脚照样在）', async () => {
  const snapshot = await snapshotOf(AT_PROJECT_ACTION);
  const next = snapshot.focus.next;
  assert.ok(next.length > 0, '「接下来」是空的');
  // 窄条与主卡是同一份形状：都带卡脚要用的字段。
  for (const item of next) {
    assert.ok(Object.prototype.hasOwnProperty.call(item, 'project'), '窄条上少了 project 键');
    assert.ok(Object.prototype.hasOwnProperty.call(item, 'requirement'), '窄条上少了 requirement 键');
    assert.ok(Object.prototype.hasOwnProperty.call(item, 'estimateMinutes'), '窄条上少了 estimateMinutes 键');
  }
});
