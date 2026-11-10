/**
 * 接缝 B（渲染边界）：行动卡长文本的结构契约（issue #14）。
 *
 * 这里测的不是观感，而是**结构上不可能再压字**的那几条：
 * 卡身是 flex 列、写口与卡脚在流里、完成要求单独一块且可滚、卡脚单行省略、
 * 标题字号按缩放落到清晰档。真排版（压不压字、滚不滚得动）由一次性探针验收。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { createClientModule } from './helpers/client-harness.js';
import { mountPanel } from './helpers/client-interaction.js';
import { focusSnapshotUnderTest, withFocus } from './helpers/focus-fixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'client.js');

/**
 * 取样式表里某个选择器的规则块（只取第一条，够用）。
 * @param {string} styles - 样式表原文。
 * @param {string} selector - 选择器。
 * @returns {string} 规则块（含选择器）。
 */
function blockOf(styles, selector) {
  const start = styles.indexOf(selector);
  if (start < 0) throw new Error(`样式表里没有 ${selector}`);
  const end = styles.indexOf('}', start);
  return styles.slice(start, end + 1);
}

/**
 * 造一张四要素齐全、挂在项目上的主卡。
 * @param {object} snapshot - 原快照。
 * @param {object} [requirement] - 完成要求。
 * @returns {object} 换过的快照。
 */
function snapshotWithFullCard(snapshot, requirement = { text: '逐条核对模板，标出不一致的三处并留痕', source: '记录页' }) {
  return withFocus(snapshot, {
    card: {
      ...snapshot.focus.card,
      requirement,
      project: { id: '7c4e00000000000000000000', name: '季度自查', record: '④' },
    },
  });
}

test('行动卡长文本：卡身是 flex 列，写口与卡脚在流里（不再绝对定位压正文）', async () => {
  const panel = await mountPanel({
    clientPath,
    props: { initialSnapshot: snapshotWithFullCard(await focusSnapshotUnderTest()) },
  });
  try {
    const { module } = createClientModule(clientPath);
    const styles = module.styles;
    assert.match(blockOf(styles, '.gtd-desk__card {'), /display:\s*flex/);
    assert.match(blockOf(styles, '.gtd-desk__card {'), /flex-direction:\s*column/);
    assert.match(blockOf(styles, '.gtd-desk__card-facts {'), /flex:\s*1 1 auto/);
    assert.match(blockOf(styles, '.gtd-desk__card-facts {'), /min-height:\s*0/);
    assert.match(blockOf(styles, '.gtd-desk__card-actions {'), /flex:\s*none/);
    assert.doesNotMatch(blockOf(styles, '.gtd-desk__card-actions {'), /position:\s*absolute/);
    assert.match(blockOf(styles, '.gtd-desk__card-foot {'), /flex:\s*none/);
    assert.doesNotMatch(blockOf(styles, '.gtd-desk__card-foot {'), /position:\s*absolute/);
  } finally {
    await panel.cleanup();
  }
});

test('行动卡长文本：完成要求单独一块、限高可滚，标签与正文上下组合', async () => {
  const panel = await mountPanel({
    clientPath,
    props: { initialSnapshot: snapshotWithFullCard(await focusSnapshotUnderTest()) },
  });
  try {
    const { module } = createClientModule(clientPath);
    const styles = module.styles;
    assert.match(blockOf(styles, '.gtd-desk__card-reqscroll {'), /overflow-y:\s*auto/);
    assert.match(blockOf(styles, '.gtd-desk__card-reqscroll {'), /min-height:\s*0/);
    /* 完成要求正文不再用三行截断：它靠滚动看全。 */
    assert.doesNotMatch(blockOf(styles, '.gtd-desk__card-req-text {'), /line-clamp/);
    /* 标签在正文上面一行。 */
    assert.match(blockOf(styles, '.gtd-desk__card-req-key {'), /display:\s*block/);
    /* 卡上不出现系统滚动条：自绘滑轨。 */
    assert.match(blockOf(styles, '.gtd-desk__card-reqscroll {'), /scrollbar-width:\s*none/);
    assert.match(blockOf(styles, '.gtd-desk__card-sbar-thumb {'), /background:/);

    const facts = panel.document.querySelector('[data-role="focus-card-facts"]');
    const reqFact = facts.querySelector('[data-fact="requirement"]');
    assert.ok(reqFact, '完成要求那一块不在事实区里');
    const scroller = reqFact.querySelector('.gtd-desk__card-reqscroll');
    assert.ok(scroller, '完成要求没有独立的滚动区');
    assert.ok(scroller.querySelector('[data-role="focus-card-requirement"]'), '滚动区里没有完成要求正文');
    assert.ok(reqFact.querySelector('.gtd-desk__card-sbar'), '完成要求没有自绘滑轨');
    const key = reqFact.querySelector('.gtd-desk__card-req-key');
    const text = reqFact.querySelector('[data-role="focus-card-requirement"]');
    assert.ok(key && text, '完成要求缺标签或正文');
    assert.equal(key.nextElementSibling, text, '完成要求不是「标签一行、正文一行」的上下组合');
  } finally {
    await panel.cleanup();
  }
});

test('行动卡长文本：卡脚单行、项目名省略，完整名留在 title 上', async () => {
  const panel = await mountPanel({
    clientPath,
    props: {
      initialSnapshot: snapshotWithFullCard(await focusSnapshotUnderTest()),
    },
  });
  try {
    const { module } = createClientModule(clientPath);
    const styles = module.styles;
    assert.match(blockOf(styles, '.gtd-desk__card-foot-project {'), /text-overflow:\s*ellipsis/);
    assert.match(blockOf(styles, '.gtd-desk__card-foot {'), /white-space:\s*nowrap/);

    const project = panel.document.querySelector('[data-role="focus-card-foot-project"]');
    assert.ok(project, '卡脚没有项目名');
    assert.equal(project.getAttribute('title'), project.textContent, '卡脚没有把完整项目名放进 title');
    assert.ok(project.classList.contains('gtd-desk__card-foot-project'), '卡脚项目名没有省略号那一类的钩子');
  } finally {
    await panel.cleanup();
  }
});

test('行动卡长文本：没有完成要求时，要求那一块与滑轨都不画', async () => {
  const panel = await mountPanel({
    clientPath,
    props: { initialSnapshot: snapshotWithFullCard(await focusSnapshotUnderTest(), { text: null, source: null }) },
  });
  try {
    const card = panel.document.querySelector('[data-role="focus-card"]');
    assert.equal(card.querySelector('[data-role="focus-card-requirement"]'), null, '空要求也画了正文');
    assert.equal(card.querySelector('.gtd-desk__card-reqscroll'), null, '空要求也画了滚动区');
    assert.equal(card.querySelector('.gtd-desk__card-sbar'), null, '空要求也画了滑轨');
  } finally {
    await panel.cleanup();
  }
});

test('行动卡长文本：标题字号按缩放取清晰档（目标 16，k=2 退 18，k=1 退 24）', async () => {
  const { module } = createClientModule(clientPath);
  const tierOf = module.components.deskTitleTierOf;
  /* 跨 vm 上下文的对象原型不同，比形状用 JSON。 */
  assert.equal(JSON.stringify(tierOf(3)), JSON.stringify({ size: 16, line: 17 }));
  assert.equal(JSON.stringify(tierOf(2)), JSON.stringify({ size: 18, line: 20 }));
  assert.equal(JSON.stringify(tierOf(1)), JSON.stringify({ size: 24, line: 26 }));
  /* 清晰档的硬条件：字号 × 缩放必须是 12 的整数倍。 */
  for (const scale of [1, 2, 3]) {
    const tier = tierOf(scale);
    assert.equal((tier.size * scale) % 12, 0, `k=${scale} 的标题字号不清晰`);
  }

  const panel = await mountPanel({
    clientPath,
    props: { initialSnapshot: snapshotWithFullCard(await focusSnapshotUnderTest()) },
  });
  try {
    const desk = panel.document.querySelector('[data-role="gtd-desk"]');
    const renderedScale = Number(desk.getAttribute('data-scale'));
    const title = panel.document.querySelector('[data-role="focus-card-open"]');
    const expected = tierOf(renderedScale);
    assert.match(
      title.getAttribute('style') ?? '',
      new RegExp(`font-size:\\s*calc\\(var\\(--gtd-u\\)\\s*\\*\\s*${expected.size}\\)`),
      `k=${renderedScale} 的标题字号不是 ${expected.size}`,
    );
  } finally {
    await panel.cleanup();
  }
});
