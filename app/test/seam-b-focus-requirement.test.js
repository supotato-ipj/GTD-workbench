/**
 * 接缝 B（渲染边界，快照 → DOM）：焦点视图上的**完成要求**（issue #7「06 · 完成要求」的 Client 侧）。
 *
 * 完成要求有两条来源（记录页的验收标准、正文里的 `完成要求：` 前缀），
 * 单一口径在 Host 侧（`app/lib/requirement.js`）；这一层只把它画出来：
 *
 * - 卡面上：完成要求那一行用原文，来源标记写成「来自记录页」／「来自正文前缀」；
 * - 没有完成要求：那一行不画（整卡不受影响）；
 * - 抽屉里：多一行写这条动作的完成要求原文与来源标记；
 *   它与记录页那一段的「验收标准」层级不同、可以并存，但**同一段文字不画两遍**。
 *
 * 断言只碰外部可观察行为：DOM 上出现什么字。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { mountClientPanel } from './helpers/client-harness.js';
import { focusSnapshotUnderTest, patchNote, withFocus } from './helpers/focus-fixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'client.js');

test('焦点视图：完成要求带来源标记，写成「来自记录页」', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const card = { ...snapshot.focus.card, requirement: { text: '逐条核对模板并留痕', source: '记录页' } };
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: withFocus(snapshot, { card }) } });
  try {
    const source = env.document.querySelector('[data-role="focus-card-requirement-source"]');
    assert.ok(source, '卡上没有来源标记');
    assert.equal(source.textContent, '来自记录页');
    // 原文还在，来源标记是加在原文旁边的一小段。
    assert.match(env.document.querySelector('[data-role="focus-card-requirement"]').textContent, /逐条核对模板并留痕/);
  } finally {
    await env.unmount();
  }
});

test('焦点视图：来源是正文前缀时写成「来自正文前缀」', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const card = { ...snapshot.focus.card, requirement: { text: '交齐三份签字件', source: '正文前缀' } };
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: withFocus(snapshot, { card }) } });
  try {
    const source = env.document.querySelector('[data-role="focus-card-requirement-source"]');
    assert.ok(source, '卡上没有来源标记');
    assert.equal(source.textContent, '来自正文前缀');
  } finally {
    await env.unmount();
  }
});

test('焦点视图：没有完成要求就不画那一行，整卡还在', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const card = { ...snapshot.focus.card, requirement: { text: null, source: null } };
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: withFocus(snapshot, { card }) } });
  try {
    const main = env.document.querySelector('[data-role="focus-card"]');
    assert.ok(main, '没有完成要求就把整张卡弄没了');
    assert.equal(main.querySelector('[data-role="focus-card-requirement"]'), null, '空要求也画了一行');
    assert.ok(main.querySelector('[data-role="focus-card-due"]'), '完成时限那一行没了');
  } finally {
    await env.unmount();
  }
});

test('抽屉：多一行写这条动作的完成要求原文与来源标记', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const target = snapshot.focus.card.id;
  const patched = patchNote(snapshot, target, {
    requirement: { text: '把三处不一致都标出来并留痕', source: '正文前缀' },
  });
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: patched } });
  try {
    await env.click(env.document.querySelector('[data-role="focus-card-open"]'));
    const drawer = env.document.querySelector('[data-role="drawer"]');
    assert.ok(drawer, '抽屉没有打开');
    const requirement = drawer.querySelector('[data-role="drawer-requirement"]');
    assert.ok(requirement, '抽屉里没有完成要求那一行');
    assert.match(requirement.textContent, /把三处不一致都标出来并留痕/);
    const source = drawer.querySelector('[data-role="drawer-requirement-source"]');
    assert.ok(source, '抽屉里没有完成要求的来源标记');
    assert.equal(source.textContent, '来自正文前缀');
  } finally {
    await env.unmount();
  }
});

test('抽屉：完成要求与记录页的验收标准是同一段文字时，不画第二遍', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const target = snapshot.focus.card.id;
  const patched = patchNote(snapshot, target, {
    record: 'A-01',
    requirement: { text: '三处不一致都标出来并留痕', source: '记录页' },
  });
  patched.records = [
    {
      number: 'A-01',
      why: '因为交付要有痕',
      acceptance: '三处不一致都标出来并留痕',
      blocker: null,
      source: 'records/a-01.md',
    },
  ];
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: patched } });
  try {
    await env.click(env.document.querySelector('[data-role="focus-card-open"]'));
    const drawer = env.document.querySelector('[data-role="drawer"]');
    assert.ok(drawer, '抽屉没有打开');
    // 记录页那一段照旧在（它是 markdown 侧的项目级验收标准）。
    const acceptance = drawer.querySelector('[data-role="drawer-record-field"][data-field="acceptance"]');
    assert.ok(acceptance, '抽屉里没有记录页的验收标准');
    assert.match(acceptance.textContent, /三处不一致都标出来并留痕/);
    // 同一段文字不画两遍。
    assert.equal(drawer.querySelector('[data-role="drawer-requirement"]'), null, '同一段完成要求画了两遍');
  } finally {
    await env.unmount();
  }
});

test('抽屉：这条动作没有完成要求时，说一句「未写完成要求」', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const target = snapshot.focus.card.id;
  const patched = patchNote(snapshot, target, { requirement: { text: null, source: null } });
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: patched } });
  try {
    await env.click(env.document.querySelector('[data-role="focus-card-open"]'));
    const drawer = env.document.querySelector('[data-role="drawer"]');
    assert.ok(drawer, '抽屉没有打开');
    const requirement = drawer.querySelector('[data-role="drawer-requirement"]');
    assert.ok(requirement, '抽屉里没有完成要求那一行');
    assert.match(requirement.textContent, /未写完成要求/);
    assert.equal(drawer.querySelector('[data-role="drawer-requirement-source"]'), null, '没有来源就别画来源标记');
  } finally {
    await env.unmount();
  }
});
