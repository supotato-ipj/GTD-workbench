/**
 * 接缝 B（渲染边界，快照 → 画布）：抽屉里 markdown 侧那一块。
 *
 * 「为什么这么定」来自仓库里的 issue 页，不是模型现编的（spec 故事 31）。
 * 这里断言抽屉里出现了那三段原文、标了来源；对不上时明说「无对应记录」，不留空白。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { RECORDS_DIR, REPO_ROOT, loadRecords } from '../lib/records.js';
import { mountClientPanel } from './helpers/client-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const baseSnapshot = JSON.parse(readFileSync(path.join(here, 'fixtures/drawer-snapshot.json'), 'utf8'));

/** 仓库自带的样本记录页目录。测试读它，不读本机的真实记录页。 */
const SAMPLE_DIR = path.join(REPO_ROOT, RECORDS_DIR);

/** 有记录的那条便贴（短正文）。 */
const MATCHED = baseSnapshot.containers[0].notes[0];
/** 对不上任何记录的那条便贴（长正文）。 */
const UNMATCHED = baseSnapshot.containers[0].notes[1];

/**
 * 造一份带 markdown 记录的快照：第一条对到 ①，第二条对不上。
 * @returns {object} 快照。
 */
function snapshotWithRecords() {
  const records = loadRecords({ dir: SAMPLE_DIR });
  return {
    ...baseSnapshot,
    records,
    containers: baseSnapshot.containers.map((container) => ({
      ...container,
      notes: container.notes.map((note) => ({
        ...note,
        record: note.id === MATCHED.id ? '①' : null,
      })),
    })),
  };
}

/**
 * 挂上面板并点开一张便贴。
 * @param {object} snapshot - 交给面板的快照。
 * @param {string} noteId - 便贴 id。
 * @returns {Promise<object>} 挂好的环境。
 */
async function openDrawerFor(snapshot, noteId) {
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  const note = env.document.querySelector(`[data-note-id="${noteId}"]`);
  assert.ok(note, `画布上找不到便贴 ${noteId}`);
  await env.click(note);
  return env;
}

test('接缝 B：抽屉里显示与该动作对应的 markdown 记录，含为什么／验收标准／卡点', async () => {
  const snapshot = snapshotWithRecords();
  const env = await openDrawerFor(snapshot, MATCHED.id);
  try {
    const drawer = env.document.querySelector('[data-role="drawer"]');
    assert.ok(drawer, '抽屉没有打开');

    const record = drawer.querySelector('[data-role="drawer-record"]');
    assert.ok(record, '抽屉里没有 markdown 侧那一块');
    assert.equal(record.getAttribute('data-record'), '①');
    assert.equal(record.querySelector('[data-role="drawer-record-heading"]').textContent, '为什么这么定');

    // 三项齐：为什么、验收标准、卡点。缺的那项明说「未写明」，不编。
    const fields = Object.fromEntries(
      [...record.querySelectorAll('[data-role="drawer-record-field"]')].map((row) => [
        row.getAttribute('data-field'),
        row.querySelector('[data-role="drawer-record-value"]').textContent,
      ]),
    );
    assert.deepEqual(Object.keys(fields), ['why', 'acceptance', 'blocker']);
    const expected = snapshot.records.find((item) => item.number === '①');
    assert.equal(fields.why, expected.why);
    assert.equal(fields.blocker, expected.blocker);
    if (expected.acceptance === null) assert.equal(fields.acceptance, '未写明');
    else assert.equal(fields.acceptance, expected.acceptance);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：匹配到的记录标注来源（哪一份、哪个路径）', async () => {
  const snapshot = snapshotWithRecords();
  const env = await openDrawerFor(snapshot, MATCHED.id);
  try {
    const record = env.document.querySelector('[data-role="drawer-record"]');
    const source = record.querySelector('[data-role="drawer-record-source"]');
    assert.ok(source, '没有标来源');
    assert.match(source.textContent, /^来源：/);
    assert.match(source.textContent, /^来源：records\/01-invoice-buckets\.md$/);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：匹配不到时显示「无对应记录」，不留空白区', async () => {
  const snapshot = snapshotWithRecords();
  const env = await openDrawerFor(snapshot, UNMATCHED.id);
  try {
    const record = env.document.querySelector('[data-role="drawer-record"]');
    assert.ok(record, '对不上时也该有 markdown 那一块，不能留空白');
    assert.equal(record.getAttribute('data-record'), '');
    assert.equal(record.querySelector('[data-role="drawer-no-record"]').textContent, '无对应记录');
    // 对不上就不摆三段空壳。
    assert.equal(record.querySelectorAll('[data-role="drawer-record-field"]').length, 0);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：markdown 侧与滴答侧分区呈现，不混作一段', async () => {
  const snapshot = snapshotWithRecords();
  const env = await openDrawerFor(snapshot, MATCHED.id);
  try {
    const drawer = env.document.querySelector('[data-role="drawer"]');
    const tickFields = drawer.querySelector('[data-role="drawer-fields"]');
    const markdownBlock = drawer.querySelector('[data-role="drawer-record"]');
    assert.ok(tickFields, '没有滴答原始字段那一块');
    assert.ok(markdownBlock, '没有 markdown 那一块');
    // 两块互不包含：滴答那侧只有原始字段，markdown 那侧只有三段。
    assert.equal(markdownBlock.querySelectorAll('[data-role="drawer-field"]').length, 0);
    assert.equal(tickFields.querySelectorAll('[data-role="drawer-record-field"]').length, 0);
    assert.notEqual(markdownBlock.parentNode, tickFields);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：markdown 侧的字是原文，不改写', async () => {
  const snapshot = snapshotWithRecords();
  const env = await openDrawerFor(snapshot, MATCHED.id);
  try {
    const expected = snapshot.records.find((item) => item.number === '①');
    const record = env.document.querySelector('[data-role="drawer-record"]');
    const why = record.querySelector('[data-role="drawer-record-field"][data-field="why"] [data-role="drawer-record-value"]');
    assert.equal(why.textContent, expected.why);
    assert.equal(why.textContent.length, expected.why.length);
  } finally {
    await env.unmount();
  }
});
