/**
 * 接缝 B（渲染边界，快照 → DOM）：**卡脚的项目指针**在界面上的三个入口。
 *
 * 规格 issue #1 的用户故事 22–24：
 * - 22：卡脚有项目的下一步指针 → 卡上有一行「项目 <项目名> · 项目清单 →」；
 * - 23：点项目能看项目清单的全貌 → 点「项目清单 →」打开下钻层并把项目箱摆在那儿；
 * - 24：点项目能看那页 markdown 记录 → 点项目箱签打开抽屉，抽屉里是那页记录。
 *
 * 断言只碰外部可观察行为：DOM 上出现什么、点了发生什么。
 * 快照是固定夹具（真的走一遍 Host 的路由生成），不依赖本机实时滴答数据。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CAPACITY_CONFIG } from '../lib/capacity.js';
import { RECORDS_DIR, REPO_ROOT, loadRecords } from '../lib/records.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { mountClientPanel } from './helpers/client-harness.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

/** 仓库自带的样本记录页目录：测试读它，不读本机的真实记录页。 */
const SAMPLE_DIR = path.join(REPO_ROOT, RECORDS_DIR);

const TIME_ZONE = 'Asia/Shanghai';
/** 本地 2026-11-03 09:00——此刻主卡是那条 ⑥ 的动作，它推得出项目。 */
const AT_PROJECT_ACTION = '2026-11-03T01:00:00.000Z';
/** 本地 2026-11-05 08:00——此刻主卡是那条没有记录编号的动作，推不出项目。 */
const AT_PLAIN_ACTION = '2026-11-05T00:00:00.000Z';

/**
 * 用固定夹具生成一份快照（走真的路由，字段与 Host 侧一致）。
 * @param {string} now - 生成时刻（ISO）。
 * @returns {Promise<object>} 快照。
 */
async function snapshotUnderTest(now) {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(now),
    capacityConfig: () => DEFAULT_CAPACITY_CONFIG,
    loadRecords: () => loadRecords({ dir: SAMPLE_DIR }),
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

test('接缝 B：卡脚有一行项目指针——项目名与「项目清单 →」', async () => {
  const snapshot = await snapshotUnderTest(AT_PROJECT_ACTION);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const foot = env.document.querySelector('[data-role="focus-card-foot"]');
    assert.ok(foot, '卡上没有卡脚');
    // 写着项目名。
    const name = foot.querySelector('[data-role="focus-card-foot-project"]');
    assert.ok(name, '卡脚上没有项目名');
    assert.equal(name.textContent, '部门职责分工（定稿交领导）');
    // 还有一个进项目清单的入口。
    const link = foot.querySelector('[data-role="focus-card-foot-project-link"]');
    assert.ok(link, '卡脚上没有「项目清单」入口');
    assert.match(link.textContent, /项目清单/);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：推不出项目时不画卡脚——缺就是缺，不编', async () => {
  const snapshot = await snapshotUnderTest(AT_PLAIN_ACTION);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    assert.equal(
      env.document.querySelector('[data-role="focus-card-foot"]'),
      null,
      '推不出项目却画了卡脚',
    );
    // 主卡还在——少一行不是整卡消失。
    assert.ok(env.document.querySelector('[data-role="focus-card"]'), '主卡不见了');
  } finally {
    await env.unmount();
  }
});

test('接缝 B：点卡脚的项目指针，打开下钻层并把项目箱摆在那儿', async () => {
  const snapshot = await snapshotUnderTest(AT_PROJECT_ACTION);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    assert.equal(env.document.querySelector('[data-role="focus-drill"]'), null, '下钻层一开始就摊开了');
    await env.click(env.document.querySelector('[data-role="focus-card-foot-project-link"]'));

    // 下钻层打开了。
    const drill = env.document.querySelector('[data-role="focus-drill"]');
    assert.ok(drill, '点卡脚没有打开下钻层');
    // 项目箱在那儿，而且是摆开的、还被标出来。
    const projectBox = drill.querySelector('[data-role="box"][data-container="project"]');
    assert.ok(projectBox, '下钻层里没有项目那个纸箱');
    assert.equal(projectBox.getAttribute('data-collapsed'), 'false', '项目箱折起来了');
    assert.equal(projectBox.getAttribute('data-focus-target'), 'true', '项目箱没有被标出来');
    // 项目箱里能看到那张箱签。
    assert.ok(projectBox.querySelector('[data-role="box-tag"]'), '项目箱里没有箱签');
  } finally {
    await env.unmount();
  }
});

test('接缝 B：点项目箱签，打开那个项目的 markdown 记录页', async () => {
  const snapshot = await snapshotUnderTest(AT_PROJECT_ACTION);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    await env.click(env.document.querySelector('[data-role="focus-drill-entry"]'));
    const drill = env.document.querySelector('[data-role="focus-drill"]');
    assert.ok(drill, '下钻层没有打开');
    const tag = drill.querySelector('[data-role="box-tag"]');
    assert.ok(tag, '项目箱里没有箱签');
    await env.click(tag);

    // 抽屉里是那一页 markdown 记录（为什么／验收标准／卡点）。
    const drawer = env.document.querySelector('[data-role="drawer"]');
    assert.ok(drawer, '点箱签没有打开抽屉');
    const record = drawer.querySelector('[data-role="drawer-record"]');
    assert.ok(record, '抽屉里没有记录页那一块');
    assert.equal(record.getAttribute('data-record'), '⑥');
    const acceptance = record.querySelector('[data-role="drawer-record-field"][data-field="acceptance"]');
    assert.ok(acceptance, '记录页里没有「验收标准」');
    assert.match(acceptance.textContent, /职责数量与口径对得上/);
  } finally {
    await env.unmount();
  }
});
