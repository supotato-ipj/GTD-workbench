/**
 * 接缝 B 的失败面与刷新：断「画布上看得见的」东西（工单 11「健壮与刷新」）。
 *
 * 断言只碰外部可观察行为：画布上出现什么、点了刷新发生什么、发出去的请求长什么样。
 * 失败面与刷新都必须在真 DOM 上发生才算数，所以这里用 jsdom + `react-dom/client` 的 `act`。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createFetchController, mountPanel } from './helpers/client-interaction.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const snapshot = JSON.parse(readFileSync(path.join(here, 'fixtures/execution-snapshot.json'), 'utf8'));
const refreshed = JSON.parse(readFileSync(path.join(here, 'fixtures/refresh-snapshot.json'), 'utf8'));

/** Host 回的「滴答未登录」。 */
const NOT_LOGGED_IN = {
  status: 401,
  body: {
    error: {
      code: 'not-authenticated',
      message: '未找到 access token。请先运行 dida auth login 登录。',
    },
  },
};

/** Host 回的「滴答执行失败」。 */
const CLI_FAILED = {
  status: 502,
  body: {
    error: {
      code: 'cli-failed',
      message: 'DIDA API 错误 500: boom',
    },
  },
};

test('接缝 B：滴答未登录时画布给登录提示，不是空板', async () => {
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: {}, fetchImpl: controller.fetchImpl });
  try {
    controller.respond(NOT_LOGGED_IN);
    await panel.flush();
    assert.equal(
      panel.container.querySelectorAll('[data-role="box"]').length,
      0,
      '未登录时画成了空板——空板会被读成「今天没任务」',
    );
    assert.ok(
      panel.container.querySelector('[data-role="login-prompt"]'),
      '未登录时画布上没有登录提示',
    );
    assert.equal(
      panel.container.querySelector('[data-role="login-command"]').textContent,
      'dida auth login',
      '登录提示没告诉人去登录的命令',
    );
    assert.equal(
      panel.container.querySelector('[data-role="panel"]').getAttribute('data-state'),
      'not-authenticated',
    );
  } finally {
    await panel.cleanup();
  }
});

test('接缝 B：滴答执行失败时画布说失败原因，不是空板', async () => {
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: {}, fetchImpl: controller.fetchImpl });
  try {
    controller.respond(CLI_FAILED);
    await panel.flush();
    assert.equal(
      panel.container.querySelectorAll('[data-role="box"]').length,
      0,
      '失败时画成了空板——空板会被读成「今天没任务」',
    );
    assert.equal(
      panel.container.querySelector('[data-role="error-message"]').textContent,
      'DIDA API 错误 500: boom',
      '失败原因没显示出来',
    );
    assert.equal(
      panel.container.querySelector('[data-role="panel"]').getAttribute('data-state'),
      'error',
    );
    assert.equal(
      panel.container.querySelector('[data-role="panel"]').getAttribute('data-error-code'),
      'cli-failed',
    );
  } finally {
    await panel.cleanup();
  }
});

test('接缝 B：未登录与别的失败在画布上说得不一样', async () => {
  const notLoggedIn = createFetchController();
  const failed = createFetchController();
  const loginPanel = await mountPanel({ clientPath, props: {}, fetchImpl: notLoggedIn.fetchImpl });
  const failPanel = await mountPanel({ clientPath, props: {}, fetchImpl: failed.fetchImpl });
  try {
    notLoggedIn.respond(NOT_LOGGED_IN);
    failed.respond(CLI_FAILED);
    await loginPanel.flush();
    await failPanel.flush();
    const loginHeading = loginPanel.container.querySelector('[data-role="error-heading"]').textContent;
    const failHeading = failPanel.container.querySelector('[data-role="error-heading"]').textContent;
    assert.notEqual(loginHeading, failHeading, '未登录与别的失败说得一样');
    assert.ok(
      failPanel.container.querySelector('[data-role="login-prompt"]') === null,
      '别的失败也去喊人登录，就分不清该重试还是该修环境',
    );
    assert.ok(
      loginPanel.container.querySelector('[data-role="login-prompt"]') !== null,
      '未登录没有登录提示',
    );
  } finally {
    await loginPanel.cleanup();
    await failPanel.cleanup();
  }
});

test('接缝 B：有个手动刷新按钮，点它就重新拉数', async () => {
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: {}, fetchImpl: controller.fetchImpl });
  try {
    controller.respond({ status: 200, body: snapshot });
    await panel.flush();
    const button = panel.container.querySelector('[data-role="refresh"]');
    assert.ok(button, '画布上没有手动刷新按钮');
    assert.equal(controller.calls.length, 1, '打开面板应该拉一次数');
    await panel.act(async () => {
      button.click();
    });
    assert.equal(controller.calls.length, 2, '点了刷新没有重新拉数');
    assert.equal(controller.calls[1].url, '/gtd-workbench/tasks');
  } finally {
    await panel.cleanup();
  }
});

test('接缝 B：拉数进行中有明确的加载态', async () => {
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: {}, fetchImpl: controller.fetchImpl });
  try {
    const loading = panel.container.querySelector('[data-role="panel"][data-state="loading"]');
    assert.ok(loading, '拉取进行中没有加载态');
    assert.match(loading.textContent, /正在拉取/);
    controller.respond({ status: 200, body: snapshot });
    await panel.flush();
    assert.equal(
      panel.container.querySelector('[data-role="panel"][data-state="loading"]'),
      null,
      '数拉完了还停在加载态',
    );
    await panel.act(async () => {
      panel.container.querySelector('[data-role="refresh"]').click();
    });
    assert.ok(
      panel.container.querySelector('[data-role="panel"][data-state="loading"]'),
      '刷新拉数时没有加载态',
    );
  } finally {
    await panel.cleanup();
  }
});

test('接缝 B：刷新后画布反映最新数据', async () => {
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: { initialView: 'canvas' }, fetchImpl: controller.fetchImpl });
  try {
    controller.respond({ status: 200, body: snapshot });
    await panel.flush();
    const before = [...panel.container.querySelectorAll('[data-role="note"] [data-role="title"]')].map(
      (node) => node.textContent,
    );
    assert.ok(before.includes('文书传递（11/4 日清）'), '刷新前画布上没有那条便贴');
    await panel.act(async () => {
      panel.container.querySelector('[data-role="refresh"]').click();
    });
    controller.respond({ status: 200, body: refreshed });
    await panel.flush();
    const after = [...panel.container.querySelectorAll('[data-role="note"] [data-role="title"]')].map(
      (node) => node.textContent,
    );
    assert.ok(after.includes('⑧ 自学终稿（11/5 深度）'), '刷新后画布上没有新数据');
    assert.ok(
      !after.includes('文书传递（11/4 日清）'),
      '刷新后画布上还留着已经沉底的旧数据',
    );
    const due = [...panel.container.querySelectorAll('[data-role="note"] [data-role="due"]')].map(
      (node) => node.textContent,
    );
    assert.ok(due.includes('2026-11-05 11:00'), '刷新后画布没反映改期');
  } finally {
    await panel.cleanup();
  }
});

test('接缝 B：刷新全程没有写回动作（只读护栏）', async () => {  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: {}, fetchImpl: controller.fetchImpl });
  try {
    controller.respond({ status: 200, body: snapshot });
    await panel.flush();
    await panel.act(async () => {
      panel.container.querySelector('[data-role="refresh"]').click();
    });
    controller.respond({ status: 200, body: refreshed });
    await panel.flush();
    assert.ok(controller.calls.length >= 2, '刷新没有产生请求');
    for (const call of controller.calls) {
      assert.equal(call.url, '/gtd-workbench/tasks', '刷新时请求了取数路由以外的地方');
      assert.equal(call.init?.method ?? 'GET', 'GET', '刷新时用了非读方法');
      assert.equal(call.init?.body, undefined, '刷新时带了请求体');
    }
  } finally {
    await panel.cleanup();
  }
});
