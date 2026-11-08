/**
 * 接缝 B（渲染边界，快照 → DOM）：行动卡上的**改期写口**（issue #10「09 · 改期与跳过」Client 侧）。
 *
 * 改期 = 写新的完成时限，粒度到天。请求体是
 * `{ "action": "reschedule", "taskId": "<动作 id>", "params": { "dueDate": "YYYY-MM-DD" } }`
 * ——键是英文，`params` 里只有新的截止日。带时刻的字符串 Host 会当场拒掉，
 * 所以日期输入用 `<input type="date">`：它的值形状天生就是一天。
 *
 * 断言只碰外部可观察行为：发出去的请求体、按钮的等待态、DOM 上出现什么字。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { createFetchController, mountPanel } from './helpers/client-interaction.js';
import { focusSnapshotUnderTest, withFocus } from './helpers/focus-fixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'client.js');

/** 写路由的路径（与 Host 侧同一个接缝的写方向）。 */
const ACTIONS_URL = '/gtd-workbench/actions';

/**
 * 点开改期编辑器（不填日期）。
 * @param {object} panel - 挂好的面板。
 * @returns {Promise<object>} 日期输入框。
 */
async function openReschedule(panel) {
  const button = panel.document.querySelector('[data-role="focus-card-reschedule"]');
  assert.ok(button, '卡上没有「改期」按钮');
  await panel.click(button);
  const input = panel.document.querySelector('[data-role="focus-card-reschedule-date"]');
  assert.ok(input, '点「改期」没有打开日期输入');
  return input;
}

/**
 * 填好日期并提交。
 * @param {object} panel - 挂好的面板。
 * @param {string} dueDate - 要写出去的截止日（`YYYY-MM-DD`）。
 * @returns {Promise<void>} 完成。
 */
async function submitReschedule(panel, dueDate) {
  const input = await openReschedule(panel);
  input.value = dueDate;
  const submit = panel.document.querySelector('[data-role="focus-card-reschedule-submit"]');
  assert.ok(submit, '改期编辑器没有提交这一条路');
  await panel.click(submit);
}

test('焦点视图：卡上「完成」旁边有「改期」，点开是粒度到天的日期输入，默认值是这条动作当前的截止日', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    const complete = panel.document.querySelector('[data-role="focus-card-complete"]');
    const reschedule = panel.document.querySelector('[data-role="focus-card-reschedule"]');
    assert.ok(complete, '卡上没有「完成」按钮');
    assert.ok(reschedule, '卡上没有「改期」按钮');
    assert.notEqual(complete, reschedule, '「完成」与「改期」是同一个控件');

    const input = await openReschedule(panel);
    assert.equal(input.getAttribute('type'), 'date', '改期用的不是粒度到天的日期输入');
    assert.equal(input.value, snapshot.focus.card.dueDate, '默认值不是这条动作当前的完成时限');
    // 点开编辑器不写任何东西。
    assert.equal(controller.calls.length, 0, '点开「改期」就发请求了');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：提交改期写出去的请求体是「动作类型 + 目标 id + 新的截止日」', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    const card = panel.document.querySelector('[data-role="focus-card"]');
    await submitReschedule(panel, '2026-12-01');

    assert.equal(controller.calls.length, 1, '点一次只该发一次写请求');
    const call = controller.calls[0];
    assert.equal(call.url, ACTIONS_URL);
    assert.equal(call.init.method, 'POST');
    const body = JSON.parse(call.init.body);
    assert.deepEqual(body, {
      action: 'reschedule',
      taskId: card.getAttribute('data-note-ref'),
      params: { dueDate: '2026-12-01' },
    });
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：改期不许发带时刻的字符串——值不成立就不发请求', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    const input = await openReschedule(panel);
    // `<input type="date">` 收不下带时刻的字符串：值会被清空。
    input.value = '2026-12-01T10:00';
    await panel.click(panel.document.querySelector('[data-role="focus-card-reschedule-submit"]'));

    assert.equal(controller.calls.length, 0, '把带时刻的字符串发出去了');
    const notice = panel.document.querySelector('[data-role="focus-reschedule-need-date"]');
    assert.ok(notice, '没告诉用户要先选一个完成时限');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：改期成功后用响应里的快照整体替换面板的快照，不自己重排', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await submitReschedule(panel, '2026-12-01');
    const taskId = snapshot.focus.card.id;
    // Host 排好的样子：主卡换了人，「接下来」的顺序也换了。
    const next = {
      ...snapshot,
      focus: {
        ...snapshot.focus,
        card: { ...snapshot.focus.card, id: 'host-picked-id', title: 'Host 排出来的那一件' },
        next: [
          { id: 'host-next-1', title: 'Host 排的第一条' },
          { id: 'host-next-2', title: 'Host 排的第二条' },
        ],
      },
    };
    controller.respond({ status: 200, body: { ok: true, action: 'reschedule', taskId, snapshot: next, refreshError: null } });
    await panel.flush();

    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.ok(card, '改期之后主卡不见了');
    assert.equal(card.getAttribute('data-note-ref'), 'host-picked-id', '主卡不是 Host 排出来的那一件');
    const first = panel.document.querySelector('[data-role="focus-next-item"]');
    assert.ok(first, '「接下来」空了');
    assert.equal(first.getAttribute('data-note-ref'), 'host-next-1', '「接下来」不是 Host 排的顺序');
    // 换卡靠的是响应里那份快照：不用再发一次读请求。
    assert.equal(controller.calls.length, 1, '改期完又去拉了一次快照');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：改期成功但刷新失败时说「已改期，但刷新失败」，并给一次手动刷新', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await submitReschedule(panel, '2026-12-01');
    controller.respond({
      status: 200,
      body: {
        ok: true,
        action: 'reschedule',
        taskId: snapshot.focus.card.id,
        snapshot: null,
        refreshError: { code: 'internal-error', message: '刷新快照失败' },
      },
    });
    await panel.flush();

    const notice = panel.document.querySelector('[data-role="focus-reschedule-refresh-failed"]');
    assert.ok(notice, '没有说清「已改期，但刷新失败」');
    assert.match(notice.textContent, /已改期/);
    // 刷新失败**不是**写失败：不能画成写失败。
    assert.equal(panel.document.querySelector('[data-role="focus-reschedule-error"]'), null, '把刷新失败说成了写失败');
    const refresh = panel.document.querySelector('[data-role="focus-reschedule-refresh"]');
    assert.ok(refresh, '没有手动刷新这一条路');
    await panel.click(refresh);
    assert.ok(controller.calls.length >= 2, '手动刷新没有重新取数');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：改期失败时把原因与 code 说出来，不本地改期限', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await submitReschedule(panel, '2026-12-01');
    controller.respond({
      status: 502,
      body: { error: { code: 'cli-failed', message: '滴答那边没能改期' } },
    });
    await panel.flush();

    const error = panel.document.querySelector('[data-role="focus-reschedule-error"]');
    assert.ok(error, '改期失败没有告诉用户为什么');
    assert.match(error.textContent, /滴答那边没能改期/);
    assert.match(error.textContent, /cli-failed/);
    // 失败不是改成了：不能出现「已改期」那一套。
    assert.equal(panel.document.querySelector('[data-role="focus-reschedule-refresh-failed"]'), null);
    // 期限不许在本地偷偷改掉。
    const due = panel.document.querySelector('[data-role="focus-card-due"]');
    assert.match(due.textContent, /2026-11-04 14:15/, 'the due date on the card is not the original one');
    assert.ok(!due.textContent.includes('2026-12-01'), '失败之后本地把期限改了');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：改期时没登录走既有的未登录那条路', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await submitReschedule(panel, '2026-12-01');
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

test('焦点视图：改期在飞时按钮进等待态，连点不会写两次', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await submitReschedule(panel, '2026-12-01');
    const button = panel.document.querySelector('[data-role="focus-card-reschedule"]');
    assert.ok(button, '等待期间按钮不见了');
    assert.equal(button.getAttribute('data-state'), 'pending');
    assert.equal(button.disabled, true, '等待期间按钮还能点');
    // 再点一下：不许再写一次。
    await panel.click(button);
    assert.equal(controller.calls.length, 1, '等待期间又发了一次写请求');
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：改期写成功后编辑器收起来——别让人以为还没改', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot }, fetchImpl: controller.fetchImpl });
  try {
    await submitReschedule(panel, '2026-12-01');
    controller.respond({
      status: 200,
      body: {
        ok: true,
        action: 'reschedule',
        taskId: snapshot.focus.card.id,
        snapshot,
        refreshError: null,
      },
    });
    await panel.flush();

    assert.equal(
      panel.document.querySelector('[data-role="focus-card-reschedule-editor"]'),
      null,
      '写成功了编辑器还开着',
    );
  } finally {
    await panel.cleanup();
  }
});

test('焦点视图：这条动作没有完成时限时，不替用户猜一个日子', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const noDue = withFocus(snapshot, { card: { ...snapshot.focus.card, dueDate: null } });
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: noDue }, fetchImpl: controller.fetchImpl });
  try {
    const input = await openReschedule(panel);
    assert.equal(input.value, '', '没有期限却给了一个日子');
  } finally {
    await panel.cleanup();
  }
});
