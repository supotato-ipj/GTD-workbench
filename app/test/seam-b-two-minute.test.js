/**
 * 接缝 B（渲染边界，快照 → DOM）：**两分钟卡**在行动卡上的样子（issue #11 的 Client 侧）。
 *
 * 资格是 Host 侧的事（能不能抢主卡位由 Host 定），Client 侧只按 `focus.card.twoMinute`
 * 这个标记显示——**不重算资格**。
 *
 * 断言只碰外部可观察行为：卡面上有没有那一句引导、它带什么可断言的标记、
 * 普通行动卡上有没有多出这句话。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { createFetchController, mountPanel } from './helpers/client-interaction.js';
import { TWO_MINUTE_CAPTURE_ID, focusSnapshotUnderTest, twoMinuteSnapshotUnderTest } from './helpers/focus-fixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'client.js');

test('接缝 B：主卡是两分钟卡时，卡上有一句引导与一个可断言的标记', async () => {
  const snapshot = await twoMinuteSnapshotUnderTest();
  // 前提：Host 把那条收集箱捕获排到了主卡位。
  assert.equal(snapshot.focus.card.id, TWO_MINUTE_CAPTURE_ID);
  assert.equal(snapshot.focus.card.twoMinute, true);

  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.ok(card, '主卡不见了');
    assert.equal(card.getAttribute('data-state'), 'two-minute', '主卡上没标出这是两分钟卡');

    const guide = panel.document.querySelector('[data-role="focus-card-two-minute"]');
    assert.ok(guide, '两分钟卡上没有引导');
    assert.equal(guide.getAttribute('data-state'), 'two-minute');
    // 一句短话：说清「这是什么」与「该怎么办」，不是一段说明文字。
    assert.match(guide.textContent, /两分钟卡/);
    assert.match(guide.textContent, /直接做掉/);
    assert.ok(guide.textContent.length <= 30, '引导写太长了');
  } finally {
    await panel.cleanup();
  }
});

test('接缝 B：普通行动卡上没有两分钟卡的引导', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.ok(card, '主卡不见了');
    assert.equal(card.getAttribute('data-state'), 'normal');
    assert.equal(panel.document.querySelector('[data-role="focus-card-two-minute"]'), null, '普通卡上多了一句引导');
  } finally {
    await panel.cleanup();
  }
});

test('接缝 B：勾完成两分钟卡之后它就消失——主卡换成别的，队列与收集箱里都没有它', async () => {
  const before = await twoMinuteSnapshotUnderTest();
  /* 勾完成之后的样子：Host 重新取数（只取未完成），那条捕获自然不在快照里了。 */
  const after = await twoMinuteSnapshotUnderTest({ status: 2 });
  const controller = createFetchController();
  const panel = await mountPanel({
    clientPath,
    props: { initialSnapshot: before },
    fetchImpl: controller.fetchImpl,
  });
  try {
    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.equal(card.getAttribute('data-note-ref'), TWO_MINUTE_CAPTURE_ID, '主卡上不是那条两分钟捕获');

    await panel.click(panel.document.querySelector('[data-role="focus-card-complete"]'));
    const call = controller.calls[0];
    assert.equal(call.url, '/gtd-workbench/actions');
    assert.equal(JSON.parse(call.init.body).action, 'complete');
    controller.respond({
      status: 200,
      body: {
        ok: true,
        action: 'complete',
        taskId: TWO_MINUTE_CAPTURE_ID,
        snapshot: after,
        refreshError: null,
      },
    });
    await panel.flush();

    /* 主卡换成了别的。 */
    const nextCard = panel.document.querySelector('[data-role="focus-card"]');
    assert.ok(nextCard, '写完之后主卡不见了');
    assert.notEqual(nextCard.getAttribute('data-note-ref'), TWO_MINUTE_CAPTURE_ID);
    /* 「接下来」队列里没有它。 */
    const queued = [...panel.document.querySelectorAll('[data-role="focus-next-item"]')].map((node) =>
      node.getAttribute('data-note-ref'),
    );
    assert.equal(queued.includes(TWO_MINUTE_CAPTURE_ID), false, '它还在队列里');
    /* 六箱画布的收集箱里也没有它：勾完就消失，不进任何分类。 */
    await panel.click(panel.document.querySelector('[data-role="focus-drill-entry"]'));
    const inbox = panel.document.querySelector('[data-role="box"][data-container="inbox"]');
    assert.ok(inbox, '画布里没有收集箱那个纸箱');
    const inboxIds = [...inbox.querySelectorAll('[data-role="note"]')].map((node) =>
      node.getAttribute('data-note-id'),
    );
    assert.equal(inboxIds.includes(TWO_MINUTE_CAPTURE_ID), false, '它还在收集箱里');
    /* 整个界面上都没有它了。 */
    assert.equal(panel.document.querySelector(`[data-note-ref="${TWO_MINUTE_CAPTURE_ID}"]`), null);
    assert.equal(panel.document.querySelector(`[data-note-id="${TWO_MINUTE_CAPTURE_ID}"]`), null);
  } finally {
    await panel.cleanup();
  }
});
