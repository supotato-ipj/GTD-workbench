/**
 * 接缝 B（渲染边界，快照 → DOM）：行动卡上的**跳过**（issue #10「09 · 改期与跳过」Client 侧）。
 *
 * 跳过**不是写口**：Host 那侧没有 `skip` 这个动作，发过去会被当场拒掉。
 * 它是**本次会话里的纯视图状态**——这一条不再出现在焦点里，主卡换下一件；
 * 不发任何请求、不写任何东西（连 localStorage 都不碰），刷新页面它就回来。
 *
 * 断言只碰外部可观察行为：DOM 上还剩什么、发出去几个请求、存了几个键。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { createFetchController, mountPanel } from './helpers/client-interaction.js';
import { focusSnapshotUnderTest } from './helpers/focus-fixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'client.js');

/**
 * 数一数往 localStorage 里写了几次（写口一次也不许有）。
 * @param {object} panel - 挂好的面板。
 * @returns {{ count: () => number, restore: () => void }} 计数与还原。
 */
function watchStorageWrites(panel) {
  const prototype = Object.getPrototypeOf(panel.window.localStorage);
  const original = prototype.setItem;
  let writes = 0;
  prototype.setItem = function patched(...args) {
    writes += 1;
    return original.apply(this, args);
  };
  return {
    count: () => writes,
    restore: () => {
      prototype.setItem = original;
    },
  };
}

test('焦点视图：「跳过」与两个写口位置分开——它在分隔线之后，自己也弱', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    const row = panel.document.querySelector('[data-role="focus-card-actions"]');
    assert.ok(row, '卡上没有写口那一行');
    const roles = [...row.children].map((node) => node.getAttribute('data-role'));
    assert.deepEqual(roles, [
      'focus-card-complete',
      'focus-card-reschedule',
      'focus-card-actions-sep',
      'focus-card-skip',
      'focus-card-skip-note',
    ]);
    // 「跳过」是零写入的弱化项：它自己带着「零写入」的说明。
    const note = panel.document.querySelector('[data-role="focus-card-skip-note"]');
    assert.match(note.textContent, /零写入/);
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：点「跳过」零请求零写入——这条只活在本次会话里', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  const storage = watchStorageWrites(panel);
  try {
    const before = storage.count();
    const skip = panel.document.querySelector('[data-role="focus-card-skip"]');
    assert.ok(skip, '卡上没有「跳过」按钮');
    await panel.click(skip);

    assert.equal(controller.calls.length, 0, '「跳过」发了请求');
    assert.equal(storage.count(), before, '「跳过」写了 localStorage');
  } finally {
    storage.restore();
    await panel.cleanup();
  }
});

test('焦点视图：跳过后主卡换下一件，那一条插到卡夹末尾', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    const card = panel.document.querySelector('[data-role="focus-card"]');
    const skippedId = card.getAttribute('data-note-ref');
    await panel.click(panel.document.querySelector('[data-role="focus-card-skip"]'));

    const nextCard = panel.document.querySelector('[data-role="focus-card"]');
    assert.ok(nextCard, '跳过后主卡不见了');
    assert.notEqual(nextCard.getAttribute('data-note-ref'), skippedId, '跳过的这条还占着主卡');
    assert.equal(nextCard.getAttribute('data-note-ref'), snapshot.focus.next[0].id, '主卡没有换到下一件');
    const queue = [...panel.document.querySelectorAll('[data-role="focus-next-item"]')].map((node) =>
      node.getAttribute('data-note-ref'),
    );
    // 跳过 = 插回卡夹末尾（故事 14），不是从焦点里消失。
    assert.equal(queue[queue.length - 1], skippedId, '跳过的这条没有插到卡夹末尾');
    assert.equal(queue.length, snapshot.focus.next.length, '卡夹的条数不对');
    // 跳过之后说清楚它去哪了。
    const notice = panel.document.querySelector('[data-role="focus-skip-notice"]');
    assert.ok(notice, '跳过之后没有交代它去哪了');
    assert.match(notice.textContent, /卡夹末尾/);
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：跳过只活在本次会话里——刷新页面它就回来', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const first = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await first.click(first.document.querySelector('[data-role="focus-card-skip"]'));
    assert.notEqual(
      first.document.querySelector('[data-role="focus-card"]').getAttribute('data-note-ref'),
      snapshot.focus.card.id,
      '跳过后主卡没有换',
    );
  } finally {
    await first.cleanup();
  }

  // 刷新页面 = 重新挂一个面板（内存里的状态全没了）。
  const second = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    const card = second.document.querySelector('[data-role="focus-card"]');
    assert.ok(card, '刷新之后主卡不见了');
    assert.equal(card.getAttribute('data-note-ref'), snapshot.focus.card.id, '刷新之后跳过的那条没有回来');
  } finally {
    await second.cleanup();
  }
});
