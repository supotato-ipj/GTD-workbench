/**
 * 接缝 B（渲染边界）：动画三件——入场、拿起弹回、状态迁移。
 *
 * 动画只演真实发生过的差异（ADR-0007），所以这里的断言都对着「有没有变化」而不是「好不好看」。
 * 样式上的动效与 `prefers-reduced-motion` 在 `seam-b-texture.test.js` 里核。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { diffSnapshots, motionsOf, summarize } from '../lib/diff.js';
import { createClientModule, mountClientPanel } from './helpers/client-harness.js';
import { createFetchController, mountPanel } from './helpers/client-interaction.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const GENERATED_AT = '2026-11-05T00:00:00.000Z';
const TIME_ZONE = 'Asia/Shanghai';

/**
 * 用固定夹具造一份快照（直接用 lib 里的组装函数，不走 HTTP）。
 * @param {object} [overrides] - 覆盖项。
 * @returns {Promise<object>} 快照。
 */
async function snapshotOf(overrides = {}) {
  const { buildSnapshot } = await import('../lib/snapshot.js');
  const tasksByProject = new Map();
  for (const task of rawTasks) {
    if (!tasksByProject.has(task.projectId)) tasksByProject.set(task.projectId, []);
    tasksByProject.get(task.projectId).push(task);
  }
  const { CONTAINERS } = await import('../lib/containers.js');
  return buildSnapshot({
    containers: CONTAINERS,
    tasksByProject,
    timeZone: TIME_ZONE,
    generatedAt: GENERATED_AT,
    ...overrides,
  });
}

test('入场：便贴按时间轴顺序依次贴上', async () => {
  const snapshot = await snapshotOf();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  try {
    const notes = [...env.document.querySelectorAll('[data-role="note"]')];
    assert.ok(notes.length >= 3, '画布上的便贴太少，测不出顺序');
    const orders = notes.map((note) => Number(note.getAttribute('data-enter-order')));
    // 顺序严格递增：一条一条贴上，不是一起冒出来。
    for (let index = 1; index < orders.length; index += 1) {
      assert.ok(orders[index] > orders[index - 1], '入场顺序没有递增');
    }
    // 每条的动画延迟按顺序错开。
    for (const note of notes) {
      const order = Number(note.getAttribute('data-enter-order'));
      assert.match(note.getAttribute('style') ?? '', new RegExp(`animation-delay:\\s*${order * 40}ms`));
    }
  } finally {
    await env.unmount();
  }
});

test('拿起弹回：拖起来有位移与倾斜，松手回原位，不落位', async () => {
  const snapshot = await snapshotOf();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  try {
    const note = env.document.querySelector('[data-role="note"]');
    assert.ok(note, '画布上没有便贴');
    assert.equal(note.getAttribute('data-dragging'), 'false');

    // 按下 + 拖出阈值：出现位移与倾斜。
    await env.dispatch(note, 'pointerdown', { clientX: 100, clientY: 100 });
    await env.dispatch(env.document, 'pointermove', { clientX: 160, clientY: 130 });
    const dragging = env.document.querySelector('[data-role="note"]');
    assert.equal(dragging.getAttribute('data-dragging'), 'true');
    const style = dragging.getAttribute('style') ?? '';
    assert.match(style, /transform:\s*translate\(33px, 14px\) rotate\(3\.6deg\)/);
    // 只挪了皮，没落位：位置不是持久状态，快照里没有坐标这回事。
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot.containers[0].notes[0], 'position'), false);

    // 松手：位移清空，弹回原位。
    await env.dispatch(env.document, 'pointerup', {});
    const released = env.document.querySelector('[data-role="note"]');
    assert.equal(released.getAttribute('data-dragging'), 'false');
    assert.doesNotMatch(released.getAttribute('style') ?? '', /translate\(/);
  } finally {
    await env.unmount();
  }
});

test('拿起弹回：手抖不到阈值不算拖，那一下仍然是「点开抽屉」', async () => {
  const snapshot = await snapshotOf();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  try {
    const note = env.document.querySelector('[data-role="note"]');
    const noteId = note.getAttribute('data-note-id');
    await env.dispatch(note, 'pointerdown', { clientX: 100, clientY: 100 });
    await env.dispatch(env.document, 'pointermove', { clientX: 102, clientY: 101 });
    assert.equal(env.document.querySelector('[data-role="note"]').getAttribute('data-dragging'), 'false');
    await env.dispatch(env.document, 'pointerup', {});
    await env.click(env.document.querySelector(`[data-note-id="${noteId}"]`));
    assert.ok(env.document.querySelector('[data-role="drawer"]'), '手抖一下就打不开抽屉了');
  } finally {
    await env.unmount();
  }
});

test('状态迁移：拉数后只给真实变化的便贴打标记', async () => {
  const first = await snapshotOf();
  const changed = await snapshotOf();
  // ⑥ 汇总被勾完 → 从纸箱里消失、沉进已沉底区（新完成只能从这里看出来）。
  const execution = changed.containers.find((container) => container.key === 'execution');
  for (const note of execution.notes) {
    if (note.id === '7c4e0000000000000000000d') Object.assign(note, { status: 2, statusLabel: '已完成' });
    if (note.id === '7c4e0000000000000000000b') Object.assign(note, { dueDate: '2026-11-02', dueLocal: '2026-11-02 17:30' });
  }
  changed.sunk = {
    ...changed.sunk,
    days: [
      {
        date: '2026-11-05',
        notes: [{ id: '7c4e0000000000000000000d', title: '⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）', container: 'execution', completedAt: '2026-11-05T02:30:00.000Z', completedTime: '10:30' }],
      },
    ],
    counts: { ...changed.sunk.counts, execution: 1 },
  };
  // 旧快照里已沉底区是空的：所以这条是「新沉进来的」。
  const initial = { ...first, sunk: { ...first.sunk, days: [], counts: {} } };

  const fetcher = createFetchController();
  const env = await mountPanel({ clientPath, props: { initialSnapshot: initial, initialView: 'canvas' }, fetchImpl: fetcher.fetchImpl });
  try {
    // 第一次打开：没有「上次」，不该演任何变化。
    assert.equal(env.document.querySelectorAll('[data-motion="completed"]').length, 0);
    assert.equal(env.document.querySelectorAll('[data-motion="rescheduled"]').length, 0);
    assert.equal(env.document.querySelectorAll('[data-motion="moved"]').length, 0);

    const refresh = env.document.querySelector('[data-role="refresh"]');
    assert.ok(refresh, '没有刷新按钮');
    await env.click(refresh);
    assert.equal(fetcher.calls.length, 1);
    fetcher.respond({ status: 200, body: changed });
    await env.flush();

    const idsWith = (kind) =>
      [...env.document.querySelectorAll(`[data-motion="${kind}"]`)].map((node) => node.getAttribute('data-note-id'));
    // 新完成的在已沉底区亮一下。
    const sunk = env.document.querySelector('[data-role="sunk"]');
    assert.deepEqual(
      [...sunk.querySelectorAll('[data-motion="completed"]')].map((node) => node.getAttribute('data-note-id')),
      ['7c4e0000000000000000000d'],
    );
    assert.deepEqual(idsWith('rescheduled'), ['7c4e0000000000000000000b']);
    assert.deepEqual(idsWith('moved'), []);
    // 没变化的便贴一条标记都没有。
    for (const note of env.document.querySelectorAll('[data-role="note"]')) {
      const id = note.getAttribute('data-note-id');
      if (id === '7c4e0000000000000000000b') continue;
      assert.equal(note.getAttribute('data-motion'), '', `${id} 没变化却打了动画标记`);
    }
  } finally {
    await env.cleanup();
  }
});

test('状态迁移：差异基准存在浏览器本地，不落仓库文件', async () => {
  const first = await snapshotOf();
  const fetcher = createFetchController();
  const env = await mountPanel({ clientPath, props: { initialSnapshot: first, initialView: 'canvas' }, fetchImpl: fetcher.fetchImpl });
  try {
    const keys = Object.keys(env.window.localStorage);
    assert.ok(keys.includes('gtd-workbench.baseline.v1'), `差异基准没写进 localStorage：${keys.join(',')}`);
    const stored = JSON.parse(env.window.localStorage.getItem('gtd-workbench.baseline.v1'));
    assert.ok(stored && typeof stored.notes === 'object');
    // 基准里不放正文、不放标题——只够比差异。
    const sample = Object.values(stored.notes)[0];
    assert.deepEqual(Object.keys(sample).sort(), ['container', 'dueDate', 'status']);
  } finally {
    await env.cleanup();
  }
});

test('状态迁移：浏览器侧的差异逻辑与 app/lib/diff.js 不漂', async () => {
  const before = await snapshotOf();
  const after = await snapshotOf();
  const waiting = after.containers.find((container) => container.key === 'waiting');
  for (const note of waiting.notes) note.status = 2;
  const execution = after.containers.find((container) => container.key === 'execution');
  for (const note of execution.notes) note.dueDate = '2026-12-31';

  const { module } = createClientModule(clientPath);
  // 两边跑在不同的 realm 里，深比较前先拍平成纯数据。
  const mirror = JSON.parse(
    JSON.stringify(
      module.components.motionsFor(
        module.components.summarizeForMotion(before),
        module.components.summarizeForMotion(after),
      ),
    ),
  );
  const spec = motionsOf(diffSnapshots(summarize(before), summarize(after)));
  assert.deepEqual(mirror, spec);
  assert.ok(Object.keys(spec).length > 0, '这份夹具没有造出任何差异，测不出漂移');
});

test('状态迁移：没有基线时第一次拉数不演变化', async () => {
  const snapshot = await snapshotOf();
  const fetcher = createFetchController();
  const env = await mountPanel({ clientPath, props: { initialView: 'canvas' }, fetchImpl: fetcher.fetchImpl });
  try {
    await env.flush();
    fetcher.respond({ status: 200, body: snapshot });
    await env.flush();
    assert.ok(env.document.querySelector('[data-role="board"]'), '第一次拉数没有画出画布');
    assert.equal(env.document.querySelectorAll('[data-motion="completed"], [data-motion="moved"], [data-motion="rescheduled"]').length, 0);
  } finally {
    await env.cleanup();
  }
});

test('动效：状态迁移与减少动效偏好都写在样式表里', async () => {
  const { module } = createClientModule(clientPath);
  for (const kind of ['completed', 'rescheduled', 'moved']) {
    assert.match(module.styles, new RegExp(`\\[data-motion="${kind}"\\]`));
  }
  // 减少动效时动画与过渡都被压到近乎为零。
  assert.match(module.styles, /@media \(prefers-reduced-motion: reduce\)/);
});
