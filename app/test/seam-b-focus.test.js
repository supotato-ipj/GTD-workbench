/**
 * 接缝 B（渲染边界，快照 → 画布）：本周主攻与深度色条。
 *
 * 断言的是画布上看得见的东西：主攻有一条自己的带子、位置在纸箱之外、
 * 深度色条与事务／日清明显不同，点主攻能开到那条便贴。
 *
 * ⚠️ **两个「焦点」不要混**：v1 的**本周主攻**在快照里叫 `mainPush`、DOM 角色叫 `main-push`；
 * v2 的**焦点**是 `focus` 对象（`focus.card` / `focus.next`），角色叫 `focus-card` / `focus-next`。
 * （工单 06「焦点只读上线」做的语义改名。）
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { mountClientPanel } from './helpers/client-harness.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 用固定夹具生成一份快照（与接缝 A 同一条路由，不手写快照）。
 * @returns {Promise<object>} 快照。
 */
async function snapshotUnderTest() {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

/**
 * 取元素上某个属性的宽度。
 * @param {object} element - DOM 元素。
 * @returns {number} 像素宽度；读不到为 NaN。
 */
function barWidthOf(element) {
  const style = element.getAttribute('style') ?? '';
  const matched = /(?:^|;)\s*width\s*:\s*([\d.]+)px/.exec(style);
  return matched === null ? Number.NaN : Number(matched[1]);
}

test('接缝 B：主攻有一条自己的带子，条数与快照一致', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: snapshot, initialView: 'canvas' },
  });
  try {
    const strip = env.document.querySelector('[data-role="main-push"]');
    assert.ok(strip, '画布上没有主攻带子');
    assert.equal(strip.getAttribute('data-count'), String(snapshot.mainPush.length));
    assert.equal(strip.getAttribute('data-count'), '2');
    const items = [...strip.querySelectorAll('[data-role="main-push-item"]')];
    assert.deepEqual(
      items.map((item) => item.getAttribute('data-note-id')),
      snapshot.mainPush.map((item) => item.id),
    );
    assert.deepEqual(
      items.map((item) => item.querySelector('[data-role="main-push-title"]').textContent),
      snapshot.mainPush.map((item) => item.title),
    );
  } finally {
    await env.unmount();
  }
});

test('接缝 B：主攻不混进任何纸箱——它不在纸箱里，纸箱也不在它里面', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: snapshot, initialView: 'canvas' },
  });
  try {
    const strip = env.document.querySelector('[data-role="main-push"]');
    const board = env.document.querySelector('[data-role="board"]');
    // 主攻带子是画布的**兄弟**，不在画布里面，也不在任何纸箱里面。
    assert.notEqual(strip.parentNode, board);
    assert.equal(board.contains(strip), false, '主攻带子长在画布里');
    for (const box of board.querySelectorAll('[data-role="box"]')) {
      assert.equal(box.contains(strip), false, '主攻带子长在纸箱里');
    }
    // 纸箱里的便贴不是主攻条目：两者的 data-role 分开，不互相冒充。
    assert.ok(board.querySelectorAll('[data-role="note"]').length > 0);
    assert.equal(board.querySelectorAll('[data-role="main-push-item"]').length, 0);
    assert.equal(strip.querySelectorAll('[data-role="box"]').length, 0);
    assert.equal(strip.querySelectorAll('[data-role="note"]').length, 0);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：深度色条与事务／日清明显不同（颜色与宽度都分开）', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: snapshot, initialView: 'canvas' },
  });
  try {
    const bands = [...env.document.querySelectorAll('[data-role="time-band"]')];
    assert.ok(bands.length >= 3, '画布上的时间档色条太少');
    const byBand = new Map();
    for (const band of bands) {
      const name = band.getAttribute('data-band');
      if (name === '') continue;
      if (!byBand.has(name)) byBand.set(name, []);
      byBand.get(name).push(band);
    }
    assert.deepEqual([...byBand.keys()].sort(), ['事务', '日清', '深度'].sort());
    // 三档的颜色互不相同。
    const colors = new Set(
      [...byBand.entries()].map(([, nodes]) => {
        const style = nodes[0].getAttribute('style') ?? '';
        const matched = /background\s*:\s*([^;]+)/.exec(style);
        return matched === null ? '' : matched[1].trim();
      }),
    );
    assert.equal(colors.size, 3, '三档的时间档颜色没有分开');
    // 深度还要更宽，边缘更打眼。
    const deep = byBand.get('深度')[0];
    const shallow = byBand.get('事务')[0];
    assert.equal(deep.getAttribute('data-band-emphasis'), 'deep');
    assert.equal(shallow.getAttribute('data-band-emphasis'), '');
    assert.ok(barWidthOf(deep) > barWidthOf(shallow), '深度色条没有比其他档更宽');
  } finally {
    await env.unmount();
  }
});

test('接缝 B：点主攻带上的条目，打开的是那条便贴的抽屉', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: snapshot, initialView: 'canvas' },
  });
  try {
    const first = snapshot.mainPush[0];
    const item = env.document.querySelector(`[data-role="main-push-item"][data-note-id="${first.id}"]`);
    assert.ok(item, '主攻带子上找不到第一条');
    await env.click(item);
    const drawer = env.document.querySelector('[data-role="drawer"]');
    assert.ok(drawer, '点主攻没有打开抽屉');
    assert.equal(drawer.getAttribute('data-note-id'), first.id);
    assert.equal(drawer.querySelector('[data-role="drawer-title"]').textContent, first.title);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：快照没有 mainPush 字段时主攻带子说「本周没有」，不崩', async () => {
  const snapshot = await snapshotUnderTest();
  const legacy = { ...snapshot, mainPush: undefined };
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: legacy, initialView: 'canvas' },
  });
  try {
    const strip = env.document.querySelector('[data-role="main-push"]');
    assert.ok(strip, '没有 mainPush 时主攻带子整个消失了');
    assert.equal(strip.getAttribute('data-count'), '0');
    assert.equal(strip.querySelectorAll('[data-role="main-push-item"]').length, 0);
    assert.match(strip.textContent, /本周主攻/);
  } finally {
    await env.unmount();
  }
});
