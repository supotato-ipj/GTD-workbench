/**
 * 接缝 B（渲染边界，快照 → DOM）：焦点视图上的**容量**（issue #8「07 · 容量与本机配置」的 Client 侧）。
 *
 * 容量这一层的规矩：**Client 只画不算**。可排时间、装不装得下、日清成本全都是 Host 算好过界的，
 * 这一层一个字都不重算，只把它们摆出来：
 *
 * - 顶部常驻三个数：日清几笔未还、今日剩余可排时间、深度名额；
 * - 顶部下面一行：容量参数「定于 <日期>」；没初始化就说清楚没初始化；
 * - 有日清落在可用窗口之外时，顶部说一句它不占可排时间；
 * - 行动卡：预计耗时与容量提示（装得下／装不下／装不装得下未知，各带还剩多少分钟）。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { mountClientPanel } from './helpers/client-harness.js';
import { focusSnapshotUnderTest, withFocus } from './helpers/focus-fixture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'client.js');

/**
 * 换掉快照里的容量参数（其余原样）。
 * @param {object} snapshot - 原快照。
 * @param {object} patch - 要换的容量字段。
 * @returns {object} 换过的快照。
 */
function withCapacity(snapshot, patch) {
  return { ...snapshot, capacity: { ...snapshot.capacity, ...patch } };
}

test('焦点视图：顶部写明容量参数定于哪一天', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: withCapacity(snapshot, { asOf: '2026-11-05' }) },
  });
  try {
    const asOf = env.document.querySelector('[data-role="focus-capacity-asof"]');
    assert.ok(asOf, '顶部没有容量参数那一行');
    assert.match(asOf.textContent, /2026-11-05/);
    assert.equal(asOf.getAttribute('data-state'), 'set');
  } finally {
    await env.unmount();
  }
});

test('焦点视图：容量参数没初始化时说清楚「未定」', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: withCapacity(snapshot, { asOf: null }) },
  });
  try {
    const asOf = env.document.querySelector('[data-role="focus-capacity-asof"]');
    assert.ok(asOf, '顶部没有容量参数那一行');
    assert.equal(asOf.getAttribute('data-state'), 'unset', '没初始化这件事一眼看不出来');
    assert.match(asOf.textContent, /未定|未初始化/);
  } finally {
    await env.unmount();
  }
});

test('焦点视图：有日清落在可用窗口之外时，顶部说一句它不占可排时间', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: withCapacity(snapshot, { dailyMinutesOutsideWindow: 120 }) },
  });
  try {
    const outside = env.document.querySelector('[data-role="focus-capacity-outside"]');
    assert.ok(outside, '窗口外的那笔日清没有说');
    assert.match(outside.textContent, /120/);
    assert.match(outside.textContent, /不占可排时间/);
  } finally {
    await env.unmount();
  }
});

test('焦点视图：没有日清落在窗口之外时，顶部不多说这一句', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: withCapacity(snapshot, { dailyMinutesOutsideWindow: 0 }) },
  });
  try {
    assert.equal(env.document.querySelector('[data-role="focus-capacity-outside"]'), null);
  } finally {
    await env.unmount();
  }
});

test('焦点视图：小屏说清装不装得下；剩余时间只在「可排」这一行出现一次', async () => {
  const snapshot = await focusSnapshotUnderTest();
  const cases = [
    { fits: true, state: '装得下' },
    { fits: false, state: '装不下' },
    { fits: null, state: '装不装得下未知' },
  ];
  for (const item of cases) {
    const card = {
      ...snapshot.focus.card,
      estimateMinutes: item.fits === null ? null : 45,
      capacityHint: { fits: item.fits, remainingMinutes: 90, schedulableMinutes: 90 },
    };
    const env = await mountClientPanel({
      clientPath,
      props: { initialSnapshot: withFocus(snapshot, { card }) },
    });
    try {
      const capacity = env.document.querySelector('[data-role="focus-card-capacity"]');
      assert.ok(capacity, '小屏上没有容量提示');
      assert.equal(capacity.getAttribute('data-state'), item.fits === true ? 'fits' : item.fits === false ? 'no' : 'unknown');
      assert.match(capacity.textContent, new RegExp(item.state));
      // 剩余可排时间只在「可排」这一行出现一次（ADR-0012 修订 2 的「一个数不出现两遍」）。
      const remaining = env.document.querySelector('[data-role="focus-stat"][data-stat="remaining"]');
      assert.match(remaining.textContent, new RegExp(String(snapshot.today.remainingMinutes)));
      assert.doesNotMatch(capacity.textContent, new RegExp(String(snapshot.today.remainingMinutes)));
    } finally {
      await env.unmount();
    }
  }
});
