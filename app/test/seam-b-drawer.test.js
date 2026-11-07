/**
 * 接缝 B（渲染边界，快照 → 画布）：详情抽屉。
 *
 * 抽屉是「点开才出现」的东西，`renderToStaticMarkup` 是静态渲染、没有交互，
 * 所以这里用 jsdom + `react-dom/client` 的 `act` 在真 DOM 上模拟点击。
 * 不需要交互的画布断言仍留在 `seam-b.test.js`。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { mountClientPanel } from './helpers/client-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const snapshot = JSON.parse(readFileSync(path.join(here, 'fixtures/drawer-snapshot.json'), 'utf8'));

/** 短正文那条：字段齐、标签多。 */
const SHORT_NOTE = snapshot.containers[0].notes[0];
/** 长正文那条：二十行清单，要能完整滚动读完。 */
const LONG_NOTE = snapshot.containers[0].notes[1];

/**
 * 挂上面板并点开一张便贴。
 * @param {string} noteId - 便贴 id。
 * @returns {Promise<object>} 挂好的环境。
 */
async function openDrawer(noteId) {
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  const note = env.document.querySelector(`[data-note-id="${noteId}"]`);
  assert.ok(note, `画布上找不到便贴 ${noteId}`);
  await env.click(note);
  return env;
}

test('接缝 B：点开便贴，抽屉显示该便贴的完整正文与原始字段', async () => {
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  const note = env.document.querySelector(`[data-note-id="${SHORT_NOTE.id}"]`);
  assert.ok(note, '画布上找不到那张便贴');
  assert.equal(env.document.querySelector('[data-role="drawer"]'), null, '点开之前抽屉不该在');
  await env.click(note);

  const drawer = env.document.querySelector('[data-role="drawer"]');
  assert.ok(drawer, '点开便贴后抽屉没有打开');
  assert.equal(drawer.querySelector('[data-role="drawer-title"]').textContent, SHORT_NOTE.title);

  // 完整正文：原文一字不改。
  const content = drawer.querySelector('[data-role="drawer-content"]');
  assert.equal(content.textContent, SHORT_NOTE.content);

  // 原始字段：截止时间、时间档、优先级、状态，加上快照里已有的其它原始字段。
  const fields = Object.fromEntries(
    [...drawer.querySelectorAll('[data-role="drawer-field"]')].map((row) => [
      row.getAttribute('data-field'),
      row.querySelector('[data-role="drawer-field-value"]').textContent,
    ]),
  );
  assert.deepEqual(fields, {
    dueLocal: '2026-11-04 14:15',
    dueAllDay: '否',
    dueAt: '2026-11-04T06:15:00.000Z',
    timeBand: '事务',
    priority: '中',
    status: '未完成',
    tags: 'q2-重要,事务',
    id: '6ad5b0aa1e4b0c399cc072706',
  });

  // 字段名用中文标签呈现。
  const labels = [...drawer.querySelectorAll('[data-role="drawer-field-label"]')].map((node) => node.textContent);
  assert.deepEqual(labels, ['截止时间', '全天', '截止时间（UTC）', '时间档', '优先级', '状态', '滴答标签', '标识']);
});

test('接缝 B：正文很长时抽屉可完整滚动读完', async () => {
  const { document } = await openDrawer(LONG_NOTE.id);
  const drawer = document.querySelector('[data-role="drawer"]');
  assert.ok(drawer, '抽屉没有打开');

  // 正文区域可滚动（jsdom 不排版，只能断言「这是个滚动容器」）。
  const body = drawer.querySelector('[data-role="drawer-body"]');
  assert.match(body.getAttribute('style') ?? '', /overflow-y:\s*auto/);

  // 原文一行不少地摆在里面，且保留原来的换行。
  const content = drawer.querySelector('[data-role="drawer-content"]');
  assert.equal(content.textContent, LONG_NOTE.content);
  assert.match(content.getAttribute('style') ?? '', /white-space:\s*pre-wrap/);
  assert.equal(content.textContent.split('\n').length, 20);
});

test('接缝 B：关闭抽屉后画布状态不变', async () => {
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  const board = env.document.querySelector('[data-role="board"]');
  const before = board.innerHTML;

  await env.click(env.document.querySelector(`[data-note-id="${SHORT_NOTE.id}"]`));
  assert.ok(env.document.querySelector('[data-role="drawer"]'), '抽屉没有打开');
  assert.equal(board.innerHTML, before, '打开抽屉动了画布');

  await env.click(env.document.querySelector('[data-role="drawer-close"]'));
  assert.equal(env.document.querySelector('[data-role="drawer"]'), null, '关闭按钮没有关上抽屉');
  assert.equal(board.innerHTML, before, '关闭抽屉后画布变了');

  // Escape 也能关。
  await env.click(env.document.querySelector(`[data-note-id="${SHORT_NOTE.id}"]`));
  assert.ok(env.document.querySelector('[data-role="drawer"]'), '抽屉没有重新打开');
  await env.pressKey(env.document, 'Escape');
  assert.equal(env.document.querySelector('[data-role="drawer"]'), null, 'Escape 没有关上抽屉');
  assert.equal(board.innerHTML, before, 'Escape 关抽屉后画布变了');
});

test('接缝 B：抽屉里不出现对正文的摘要或改写，只有原文与原始字段', async () => {
  const { document } = await openDrawer(LONG_NOTE.id);
  const drawer = document.querySelector('[data-role="drawer"]');
  const content = drawer.querySelector('[data-role="drawer-content"]');

  assert.equal(content.textContent, LONG_NOTE.content, '正文被改写了');
  assert.equal(content.textContent.length, LONG_NOTE.content.length);
  assert.equal(drawer.querySelector('[data-role="summary"]'), null, '抽屉里不该有摘要区');
  assert.doesNotMatch(drawer.textContent, /摘要|总结|要点|概括|简介/);
});

test('接缝 B：抽屉是覆盖层，不改变画布的版式', async () => {
  const { document } = await openDrawer(SHORT_NOTE.id);
  const drawer = document.querySelector('[data-role="drawer"]');
  assert.match(drawer.getAttribute('style') ?? '', /position:\s*absolute/);
  assert.equal(document.querySelector('[data-role="board"] [data-role="drawer"]'), null, '抽屉不该长在画布里');
});

test('接缝 B：抽屉打开时焦点落在关闭按钮上，关掉后回到那张便贴', async () => {
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  await env.click(env.document.querySelector(`[data-note-id="${SHORT_NOTE.id}"]`));
  assert.equal(env.document.activeElement, env.document.querySelector('[data-role="drawer-close"]'));

  await env.click(env.document.querySelector('[data-role="drawer-close"]'));
  assert.equal(env.document.activeElement.getAttribute('data-note-id'), SHORT_NOTE.id);
});
