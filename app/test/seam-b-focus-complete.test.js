/**
 * 接缝 B（渲染边界，快照 → DOM）：行动卡上的**完成写口**（issue #9「08 · 完成写口」的 Client 侧）。
 *
 * 完成口径不变：完成 = 滴答勾选，单口径。写口走工作台自己的 HTTP 契约的写方向
 * （`POST /gtd-workbench/actions`），**这一层只写不算**：写完回来的快照整体替换面板的快照，
 * 主卡因此自动换成下一件，不必再发一次读请求。
 *
 * 断言只碰外部可观察行为：发出去的请求体、按钮的等待态、DOM 上出现什么字。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { createFetchController, mountPanel } from './helpers/client-interaction.js';
import { focusSnapshotUnderTest } from './helpers/focus-fixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'client.js');

/** 写路由的路径（与 Host 侧同一个接缝的写方向）。 */
const ACTIONS_URL = '/gtd-workbench/actions';

test('焦点视图：点「完成」按契约写出去，目标就是卡上那一条', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    const card = panel.document.querySelector('[data-role="focus-card"]');
    const button = panel.document.querySelector('[data-role="focus-card-complete"]');
    assert.ok(button, '卡上没有「完成」按钮');
    await panel.click(button);

    assert.equal(controller.calls.length, 1, '点一次只该发一次写请求');
    const call = controller.calls[0];
    assert.equal(call.url, ACTIONS_URL);
    assert.equal(call.init.method, 'POST');
    const body = JSON.parse(call.init.body);
    assert.equal(body.action, 'complete');
    assert.equal(body.taskId, card.getAttribute('data-note-ref'), '写出去的目标不是卡上那一条');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：写口等待期间按钮进等待态，连点不会写两次', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await panel.click(panel.document.querySelector('[data-role="focus-card-complete"]'));
    const pending = panel.document.querySelector('[data-role="focus-card-complete"]');
    assert.ok(pending, '等待期间按钮不见了');
    assert.equal(pending.getAttribute('data-state'), 'pending');
    assert.equal(pending.disabled, true, '等待期间按钮还能点');
    // 再点一下：不许再写一次。
    await panel.click(pending);
    assert.equal(controller.calls.length, 1, '等待期间又发了一次写请求');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：写成功后主卡自动换成下一件，不用再拉一次数', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await panel.click(panel.document.querySelector('[data-role="focus-card-complete"]'));
    const taskId = snapshot.focus.card.id;
    const next = {
      ...snapshot,
      focus: {
        ...snapshot.focus,
        card: { ...snapshot.focus.card, id: 'next-card-id', title: '下一件该做的事' },
      },
    };
    controller.respond({ status: 200, body: { ok: true, action: 'complete', taskId, snapshot: next, refreshError: null } });
    await panel.flush();

    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.ok(card, '写完之后主卡不见了');
    assert.equal(card.querySelector('[data-role="focus-card-title"]').textContent, '下一件该做的事');
    assert.equal(card.getAttribute('data-note-ref'), 'next-card-id');
    // 换卡靠的是响应里那份快照：不用再发一次读请求。
    assert.equal(controller.calls.length, 1, '写完又去拉了一次快照');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：写成功但刷新失败时说「已完成，但刷新失败」，并给一次手动刷新', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await panel.click(panel.document.querySelector('[data-role="focus-card-complete"]'));
    controller.respond({
      status: 200,
      body: {
        ok: true,
        action: 'complete',
        taskId: snapshot.focus.card.id,
        snapshot: null,
        refreshError: { code: 'internal-error', message: '刷新快照失败' },
      },
    });
    await panel.flush();

    const notice = panel.document.querySelector('[data-role="focus-complete-refresh-failed"]');
    assert.ok(notice, '没有说清「已完成，但刷新失败」');
    assert.match(notice.textContent, /已完成/);
    // 刷新失败**不是**写失败：不能画成写失败。
    assert.equal(panel.document.querySelector('[data-role="focus-complete-error"]'), null, '把刷新失败说成了写失败');
    // 给一次手动刷新。
    const refresh = panel.document.querySelector('[data-role="focus-complete-refresh"]');
    assert.ok(refresh, '没有手动刷新这一条路');
    await panel.click(refresh);
    assert.ok(controller.calls.length >= 2, '手动刷新没有重新取数');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：写失败时把原因说出来，不把它画成已完成', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await panel.click(panel.document.querySelector('[data-role="focus-card-complete"]'));
    controller.respond({
      status: 502,
      body: { error: { code: 'cli-failed', message: '滴答那边没能勾上这一条' } },
    });
    await panel.flush();

    const error = panel.document.querySelector('[data-role="focus-complete-error"]');
    assert.ok(error, '写失败没有告诉用户为什么');
    assert.match(error.textContent, /滴答那边没能勾上这一条/);
    assert.match(error.textContent, /cli-failed/);
    // 失败不是完成：不能出现「已完成」那一套。
    assert.equal(panel.document.querySelector('[data-role="focus-complete-refresh-failed"]'), null);
    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.ok(card, '写失败之后主卡不见了');
    assert.equal(card.getAttribute('data-note-ref'), snapshot.focus.card.id);
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：没登录时走既有的未登录那条路', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await panel.click(panel.document.querySelector('[data-role="focus-card-complete"]'));
    controller.respond({
      status: 401,
      body: { error: { code: 'not-authenticated', message: '滴答没登录' } },
    });
    await panel.flush();

    assert.ok(panel.document.querySelector('[data-role="login-prompt"]'), '没登录没有给登录提示');
    assert.ok(panel.document.querySelector('[data-role="login-command"]'), '没登录没有给登录命令');
  } finally {
    await panel.cleanup();
  }
});
