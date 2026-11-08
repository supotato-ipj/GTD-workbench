/**
 * 接缝 B（渲染边界，快照 → DOM）：**焦点视图是像素工位**（issue #13、ADR-0012）。
 *
 * 断言的是外部可观察行为：工位上出现了哪些语义锚点、既有 DOM 角色是否还在、
 * 缩放取整与字号对齐写成了什么样式属性、点卡夹／左右划有没有发请求、
 * 便签叠与小旗点开看见什么、空态是什么。
 *
 * **观感本身不进测试**（它靠一次性假数据原型过门禁）：这里不测像素坐标、不测具体色值。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { createFetchController, mountPanel } from './helpers/client-interaction.js';
import { focusSnapshotUnderTest, withFocus } from './helpers/focus-fixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'client.js');

/**
 * 挂一个焦点视图的面板（快照走真的路由生成）。
 * @param {object} [options] - 选项。
 * @param {object} [options.snapshot] - 换一份快照。
 * @returns {Promise<object>} 挂好的面板。
 */
async function mountFocus({ snapshot } = {}) {
  const base = snapshot === undefined ? await focusSnapshotUnderTest() : snapshot;
  return mountPanel({ clientPath, props: { initialSnapshot: base } });
}

/**
 * 造一张四要素齐全、挂在项目上的主卡（只在需要这些角色的用例里用）。
 * @param {object} snapshot - 原快照。
 * @returns {object} 换过的快照。
 */
function snapshotWithFullCard(snapshot) {
  return withFocus(snapshot, {
    card: {
      ...snapshot.focus.card,
      requirement: { text: '逐条核对模板，标出不一致的三处并留痕', source: '记录页' },
      estimateMinutes: 45,
      capacityHint: { fits: true, remainingMinutes: 90, schedulableMinutes: 90 },
      project: { id: '7c4e00000000000000000000', name: '季度自查', record: '④' },
    },
  });
}

test('工位：桌面、台灯、卡夹、便签叠、小屏、小旗、抽屉、标牌、开关都有语义锚点', async () => {
  const panel = await mountFocus();
  try {
    for (const role of [
      'gtd-desk',
      'gtd-desk-room',
      'gtd-desk-tabletop',
      'gtd-desk-scene',
      'gtd-desk-lamp',
      'gtd-desk-screen',
      'gtd-desk-holder',
      'gtd-desk-notes',
      'gtd-desk-quota',
      'gtd-desk-flag',
      'gtd-desk-drawer',
      'gtd-desk-plaques',
      'gtd-desk-switch',
    ]) {
      assert.ok(panel.document.querySelector(`[data-role="${role}"]`), `工位上没有 ${role}`);
    }
    // 桌面上的场景与纸纹都是随包素材（Host 的 prefix 路由），不是内联的 base64。
    assert.match(
      panel.document.querySelector('[data-role="gtd-desk-scene"]').getAttribute('src') ?? '',
      /^\/gtd-workbench\/assets\/pixel\/desk-scene\.png$/,
    );
    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.match(card.getAttribute('style') ?? '', /\/gtd-workbench\/assets\/pixel\/paper-grain\.png/);
  } finally {
    await panel.cleanup();
  }
});

test('工位：既有焦点视图的 DOM 角色全部保住（卡、卡夹、提醒位、下钻入口、三项读数）', async () => {
  const panel = await mountFocus({ snapshot: snapshotWithFullCard(await focusSnapshotUnderTest()) });
  try {
    const roles = [
      'focus-view',
      'focus-stat',
      'focus-capacity-bar',
      'focus-capacity-asof',
      'focus-card',
      'focus-card-title',
      'focus-card-open',
      'focus-card-due',
      'focus-card-requirement',
      'focus-card-requirement-source',
      'focus-card-estimate',
      'focus-card-capacity',
      'focus-card-actions',
      'focus-card-complete',
      'focus-card-reschedule',
      'focus-card-actions-sep',
      'focus-card-skip',
      'focus-card-skip-note',
      'focus-card-foot',
      'focus-card-foot-project',
      'focus-card-foot-project-link',
      'focus-next',
      'focus-next-item',
      'focus-reminders',
      'focus-drill-entry',
      'view-switch-canvas',
      'view-switch-focus',
      'refresh',
    ];
    for (const role of roles) {
      assert.ok(panel.document.querySelector(`[data-role="${role}"]`), `焦点视图少了 ${role}`);
    }
    for (const stat of ['daily', 'remaining', 'deep-quota']) {
      assert.ok(
        panel.document.querySelector(`[data-role="focus-stat"][data-stat="${stat}"]`),
        `三项读数里少了 ${stat}`,
      );
    }
    // 焦点视图里不出现 data-note-id（它只属于画布上的便贴）。
    assert.equal(panel.document.querySelector('[data-role="focus-view"] [data-note-id]'), null);
  } finally {
    await panel.cleanup();
  }
});

test('工位：缩放取整、字号落在 12 的整数倍上', async () => {
  const panel = await mountFocus();
  try {
    const desk = panel.document.querySelector('[data-role="gtd-desk"]');
    const scale = Number(desk.getAttribute('data-scale'));
    assert.ok([1, 2, 3].includes(scale), `缩放倍数不是整数台阶：${scale}`);
    const unitMatch = /--gtd-u:\s*([\d.]+)px/.exec(desk.getAttribute('style') ?? '');
    assert.ok(unitMatch, '工位根没有声明 --gtd-u');
    const dpr = panel.window.devicePixelRatio || 1;
    assert.equal(Number(unitMatch[1]), scale / dpr, '--gtd-u 不等于 缩放倍数 / DPR');
    const title = panel.document.querySelector('[data-role="focus-card-open"]');
    assert.match(title.getAttribute('style') ?? '', /font-size:\s*calc\(var\(--gtd-u\)\s*\*\s*24\)/);
    // 字号 × DPR = 24 × scale 个设备像素，一定是 12 的整数倍。
    assert.equal((24 * scale) % 12, 0);
    // 版式有一个可断言的形态（宽窗 / 窄窗），窄窗时卡会变宽。
    assert.ok(['wide', 'narrow'].includes(desk.getAttribute('data-layout')));
  } finally {
    await panel.cleanup();
  }
});

test('工位：子树里不借宿主令牌，字体族自带兜底链', async () => {
  const panel = await mountFocus({ snapshot: snapshotWithFullCard(await focusSnapshotUnderTest()) });
  try {
    const markup = panel.document.querySelector('[data-role="focus-view"]').outerHTML;
    assert.doesNotMatch(markup, /--dsw-alias-/, '工位子树里借了宿主令牌');
    // 工位根声明字体族（带兜底链），而不是在 :root/body 上覆盖宿主。
    assert.match(markup, /--gtd-u:/);
  } finally {
    await panel.cleanup();
  }
});

test('工位：点卡夹里的一张就抽到主位——零写入、不发请求', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({
    clientPath,
    props: { initialSnapshot: snapshot },
    fetchImpl: controller.fetchImpl,
  });
  try {
    const picked = snapshot.focus.next[0];
    const slot = panel.document.querySelector(`[data-role="focus-next-item"][data-note-ref="${picked.id}"]`);
    await panel.click(slot);
    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.equal(card.querySelector('[data-role="focus-card-title"]').textContent, picked.title);
    assert.equal(controller.calls.length, 0, '换卡发了请求（换卡应当零写入）');
  } finally {
    await panel.cleanup();
  }
});

test('工位：左右划只换卡——零写入，右划回到上一张', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({
    clientPath,
    props: { initialSnapshot: snapshot },
    fetchImpl: controller.fetchImpl,
  });
  try {
    const first = panel.document.querySelector('[data-role="focus-card"]');
    const originalId = first.getAttribute('data-note-ref');

    await panel.act(async () => {
      first.dispatchEvent(
        new panel.window.MouseEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: 320,
          clientY: 120,
          view: panel.window,
        }),
      );
      first.dispatchEvent(
        new panel.window.MouseEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 124,
          view: panel.window,
        }),
      );
    });
    const nextCard = panel.document.querySelector('[data-role="focus-card"]');
    assert.equal(nextCard.getAttribute('data-note-ref'), snapshot.focus.next[0].id, '左划没有换到下一张');

    await panel.act(async () => {
      nextCard.dispatchEvent(
        new panel.window.MouseEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: 120,
          view: panel.window,
        }),
      );
      nextCard.dispatchEvent(
        new panel.window.MouseEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          clientX: 320,
          clientY: 126,
          view: panel.window,
        }),
      );
    });
    const back = panel.document.querySelector('[data-role="focus-card"]');
    assert.equal(back.getAttribute('data-note-ref'), originalId, '右划没有回到上一张');
    assert.equal(controller.calls.length, 0, '划动发了请求（划动应当零写入）');
  } finally {
    await panel.cleanup();
  }
});

test('工位：便签叠点开才看见容量参数与「窗口外不占可排时间」', async () => {
  const snapshot = withFocus(await focusSnapshotUnderTest(), {});
  const withOutside = {
    ...snapshot,
    capacity: { ...snapshot.capacity, asOf: '2026-11-05', dailyMinutesOutsideWindow: 120 },
  };
  const panel = await mountFocus({ snapshot: withOutside });
  try {
    const notes = panel.document.querySelector('[data-role="gtd-desk-notes"]');
    assert.equal(notes.getAttribute('data-state'), 'closed');
    const bar = notes.querySelector('[data-role="focus-capacity-bar"]');
    assert.ok(bar, '便签叠里没有容量说明');
    assert.match(bar.textContent, /2026-11-05/);
    assert.match(bar.textContent, /120/);
    assert.match(bar.textContent, /不占可排时间/);
    await panel.click(notes);
    assert.equal(
      panel.document.querySelector('[data-role="gtd-desk-notes"]').getAttribute('data-state'),
      'open',
    );
  } finally {
    await panel.cleanup();
  }
});

test('工位：到期没回只插一面旗——旗面写几条，点开才列出来', async () => {
  const base = await focusSnapshotUnderTest();
  const reminders = [
    { id: 'reminder-a', title: '等运营部回邮件', replyDue: '2026-11-05' },
    { id: 'reminder-b', title: '等供应商报价', replyDue: '2026-11-05' },
  ];
  const panel = await mountFocus({ snapshot: withFocus(base, { reminders }) });
  try {
    const flag = panel.document.querySelector('[data-role="gtd-desk-flag"]');
    assert.ok(flag, '有到期没回却没有插旗');
    const banner = flag.querySelector('[data-role="focus-reminders"]');
    assert.equal(banner.getAttribute('data-count'), '2');
    assert.match(banner.textContent, /2/);
    // 收着的时候不摊开：桌上只有一面旗。
    assert.equal(panel.document.querySelectorAll('[data-role="focus-reminder"]').length, 0);
    await panel.click(flag.querySelector('button'));
    const items = [...panel.document.querySelectorAll('[data-role="focus-reminder"]')];
    assert.deepEqual(
      items.map((item) => item.getAttribute('data-note-ref')),
      reminders.map((item) => item.id),
    );
  } finally {
    await panel.cleanup();
  }
});

test('工位：按下完成先盖印章，写口照旧发一次 POST', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const controller = createFetchController();
  const panel = await mountPanel({
    clientPath,
    props: { initialSnapshot: snapshot },
    fetchImpl: controller.fetchImpl,
  });
  try {
    await panel.click(panel.document.querySelector('[data-role="focus-card-complete"]'));
    const stamp = panel.document.querySelector('[data-role="gtd-desk-stamp"]');
    assert.ok(stamp, '按下完成后没有盖章');
    assert.equal(stamp.getAttribute('data-stamp'), 'complete');
    assert.equal(controller.calls.length, 1, '盖章把写口吞掉了（完成必须发一次 POST）');
    assert.equal(JSON.parse(controller.calls[0].init.body).action, 'complete');
  } finally {
    await panel.cleanup();
  }
});

test('工位：空态是灯下一张空白卡，写着「现在没有该做的事」', async () => {
  const snapshot = withFocus(await focusSnapshotUnderTest(), { card: null, next: [] });
  const panel = await mountFocus({ snapshot });
  try {
    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.ok(card, '空态没有卡');
    assert.equal(card.getAttribute('data-state'), 'empty');
    assert.match(
      panel.document.querySelector('[data-role="focus-card-empty"]').textContent,
      /现在没有该做的事/,
    );
    assert.match(
      panel.document.querySelector('[data-role="focus-next-empty"]').textContent,
      /卡夹空着/,
    );
  } finally {
    await panel.cleanup();
  }
});
