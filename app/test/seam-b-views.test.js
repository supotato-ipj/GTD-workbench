/**
 * 接缝 B 的视图层（工单 05「面板外壳拆分」）：外壳与视图分开了，视图怎么切、切了会怎样。
 *
 * 断言只碰外部可观察行为：面板上出现什么、点了切换发生什么、发出去的请求长什么样。
 * 「旧画布仍是默认视图」与「画布那一段的 DOM 层级没变」是这一票最要紧的两条——
 * 它们保证拆外壳这件事对既有行为是**零影响**。
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

/**
 * 点一下面板上的某个控件。
 * @param {object} panel - 挂好的面板。
 * @param {string} role - 控件的 data-role。
 * @returns {Promise<void>} 完成。
 */
async function clickRole(panel, role) {
  const target = panel.container.querySelector(`[data-role="${role}"]`);
  assert.ok(target, `面板上没有 ${role}`);
  await panel.act(async () => {
    target.click();
  });
}

test('视图层：默认画的还是旧画布，画的是哪一个摆在面板上', async () => {
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const root = panel.container.querySelector('[data-role="panel"]');
    assert.equal(root.getAttribute('data-view'), 'canvas', '默认视图不是旧画布');
    assert.ok(panel.container.querySelector('[data-role="board"]'), '默认没有画旧画布');
    assert.equal(panel.container.querySelector('[data-role="focus-view"]'), null, '默认就画了焦点视图');
  } finally {
    await panel.cleanup();
  }
});

test('视图层：切到焦点视图，占位块明说「焦点视图待接入」', async () => {
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    await clickRole(panel, 'view-switch-focus');
    assert.equal(
      panel.container.querySelector('[data-role="panel"]').getAttribute('data-view'),
      'focus',
      '切了视图，面板上没说是哪个视图',
    );
    const view = panel.container.querySelector('[data-role="focus-view"]');
    assert.ok(view, '切到焦点视图后没有焦点视图');
    assert.match(view.textContent, /焦点视图待接入/, '焦点视图的占位块没说要接入');
    assert.equal(panel.container.querySelector('[data-role="board"]'), null, '切到焦点视图后旧画布还留在画面上');
  } finally {
    await panel.cleanup();
  }
});

test('视图层：切回旧画布，画布原样回来', async () => {
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    await clickRole(panel, 'view-switch-focus');
    await clickRole(panel, 'view-switch-canvas');
    assert.equal(panel.container.querySelector('[data-role="panel"]').getAttribute('data-view'), 'canvas');
    assert.ok(panel.container.querySelector('[data-role="board"]'), '切回来没有旧画布');
    assert.equal(panel.container.querySelector('[data-role="focus-view"]'), null, '切回来焦点视图还留着');
    const titles = [...panel.container.querySelectorAll('[data-role="note"] [data-role="title"]')].map(
      (node) => node.textContent,
    );
    assert.equal(titles.length, 4, '切回来画布上的便贴不是原来那些');
  } finally {
    await panel.cleanup();
  }
});

test('视图层：切换视图不重新拉数——视图层没有碰取数', async () => {
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: {}, fetchImpl: controller.fetchImpl });
  try {
    controller.respond({ status: 200, body: snapshot });
    await panel.flush();
    assert.equal(controller.calls.length, 1, '打开面板应该拉一次数');
    await clickRole(panel, 'view-switch-focus');
    assert.equal(controller.calls.length, 1, '切视图重新拉了数');
    await clickRole(panel, 'view-switch-canvas');
    assert.equal(controller.calls.length, 1, '切回来重新拉了数');
  } finally {
    await panel.cleanup();
  }
});

test('视图层：焦点视图下刷新照旧工作，切回来是新的数', async () => {
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: {}, fetchImpl: controller.fetchImpl });
  try {
    controller.respond({ status: 200, body: snapshot });
    await panel.flush();
    await clickRole(panel, 'view-switch-focus');
    await clickRole(panel, 'refresh');
    assert.equal(controller.calls.length, 2, '焦点视图下点刷新没有重新拉数');
    controller.respond({ status: 200, body: refreshed });
    await panel.flush();
    await clickRole(panel, 'view-switch-canvas');
    const titles = [...panel.container.querySelectorAll('[data-role="note"] [data-role="title"]')].map(
      (node) => node.textContent,
    );
    assert.ok(titles.includes('⑧ 自学终稿（11/5 深度）'), '刷新后切回画布，看到的还是旧数');
  } finally {
    await panel.cleanup();
  }
});

test('视图层：画布那一段没有被塞进新的包裹元素——既有选择器路径不变', async () => {
  const withSunk = {
    ...snapshot,
    sunk: { windowDays: 7, from: '2026-11-01', to: '2026-11-07', days: [], counts: {} },
  };
  const panel = await mountPanel({ clientPath, props: { initialSnapshot: withSunk } });
  try {
    const root = panel.container.querySelector('[data-role="panel"]');
    for (const role of ['focus', 'board', 'sunk']) {
      const element = root.querySelector(`[data-role="${role}"]`);
      assert.ok(element, `画布上少了 ${role}`);
      assert.equal(element.parentElement, root, `${role} 被塞进了新的包裹元素里，既有选择器路径变了`);
    }
  } finally {
    await panel.cleanup();
  }
});
