/**
 * 容量计算（纯逻辑）。
 *
 * 断言的是「今天还剩多少可排时间」「这一件装不装得下」这两个数怎么来的：
 * 可排时间 = 窗口时长 − 日清成本 − 插入损耗，**实时算**，不落配置（ADR-0011）。
 * 配置只存输入；本票用通用默认值，示例值全是虚构的。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_CAPACITY_CONFIG,
  capacityFor,
  estimateMinutes,
  estimateWithConfig,
  fitsWithin,
  schedulableMinutesOf,
} from '../lib/capacity.js';

/**
 * 造一个容量配置（局部覆盖默认值）。
 * @param {object} overrides - 覆盖项。
 * @returns {object} 配置。
 */
function config(overrides = {}) {
  return { ...DEFAULT_CAPACITY_CONFIG, ...overrides };
}

/**
 * 造一条便贴（只带估时相关的字段）。
 * @param {object} overrides - 覆盖项。
 * @returns {object} 便贴。
 */
function note(overrides = {}) {
  return { id: 'n1', title: '某事', ...overrides };
}

test('容量：通用默认值只存输入，推导值一个都不存', () => {
  // 配置里只有窗口、不可占、日清、插入损耗、深度一组、番茄分钟——没有「可排时间」这种推导值。
  const keys = Object.keys(DEFAULT_CAPACITY_CONFIG);
  assert.equal(keys.length, 7);
  for (const key of ['定于', '窗口', '不可占', '日清', '插入损耗分钟', '深度', '番茄分钟']) {
    assert.ok(keys.includes(key), `通用默认值里少了「${key}」`);
  }
  assert.equal(DEFAULT_CAPACITY_CONFIG.定于, null);
  assert.equal(DEFAULT_CAPACITY_CONFIG.深度.单日配额, 1);
  assert.equal(DEFAULT_CAPACITY_CONFIG.番茄分钟, 25);
});

test('容量：可排时间 = 窗口时长 − 日清成本 − 插入损耗', () => {
  const capacity = capacityFor({ date: '2026-11-05', time: '09:00' });
  // 默认窗口 09:00–12:00（180 分）与 13:30–16:00（150 分）。
  assert.equal(capacity.windowMinutes, 330);
  assert.equal(capacity.dailyMinutes, 15);
  assert.equal(capacity.interruptionMinutes, 45);
  assert.equal(capacity.schedulableMinutes, 330 - 15 - 45);
});

test('容量：不可占的时段从窗口里扣掉——跨午休的窗口只算可支配的那段', () => {
  const capacity = capacityFor(
    { date: '2026-11-05', time: '09:00' },
    config({
      窗口: [{ 起: '09:00', 止: '13:00' }],
      不可占: [{ 起: '12:00', 止: '13:00', 说明: '午休' }],
    }),
  );
  assert.equal(capacity.windowMinutes, 180);
});

test('容量：剩余可排时间随时刻递减，且永远不是负数', () => {
  const early = capacityFor({ date: '2026-11-05', time: '09:00' });
  const late = capacityFor({ date: '2026-11-05', time: '15:30' });
  assert.ok(early.remainingMinutes > late.remainingMinutes);
  assert.ok(late.remainingMinutes >= 0);
  // 15:30 之后只剩 30 分钟窗口，扣掉 45 分钟插入损耗 → 归零，不出现负数。
  assert.equal(late.remainingMinutes, 0);
});

test('容量：窗口边界——起点算窗口内，终点算窗口外', () => {
  const atStart = capacityFor({ date: '2026-11-05', time: '09:00' });
  const atEnd = capacityFor({ date: '2026-11-05', time: '12:00' });
  assert.notEqual(atStart.currentWindow, null);
  assert.equal(atStart.currentWindow.start, '09:00');
  assert.equal(atEnd.currentWindow, null);
});

test('容量：当前时刻落在窗口外不算错——没有当前窗口，但剩余时间照算', () => {
  const capacity = capacityFor({ date: '2026-11-05', time: '20:00' });
  assert.equal(capacity.currentWindow, null);
  assert.equal(capacity.remainingMinutes, 0);
});

test('容量：深度名额是参数，不是写死的数', () => {
  assert.equal(capacityFor({ date: '2026-11-05', time: '09:00' }).deepQuota, 1);
  const two = capacityFor(
    { date: '2026-11-05', time: '09:00' },
    config({ 深度: { ...DEFAULT_CAPACITY_CONFIG.深度, 单日配额: 2 } }),
  );
  assert.equal(two.deepQuota, 2);
});

test('容量：参数来源标记「定于」——通用默认值是未定于某日', () => {
  assert.equal(capacityFor({ date: '2026-11-05', time: '09:00' }).asOf, null);
  const dated = capacityFor(
    { date: '2026-11-05', time: '09:00' },
    config({ 定于: '2026-11-01' }),
  );
  assert.equal(dated.asOf, '2026-11-01');
});

test('容量：坏输入不抛，退回通用默认值', () => {
  assert.equal(capacityFor(undefined).schedulableMinutes, 270);
  assert.equal(capacityFor({ date: '不是日期', time: '不是时刻' }).schedulableMinutes, 270);
  assert.equal(capacityFor({ date: '2026-11-05', time: '09:00' }, null).schedulableMinutes, 270);
});

test('容量：日清成本只从落在可用窗口里的那些扣——窗口外的固定成本不占可排时间', () => {
  const capacity = capacityFor(
    { date: '2026-11-05', time: '09:00' },
    config({
      日清: [
        { 名: '示例固定成本', 时段: '09:00', 成本分: 15 },
        // 落在窗口外（窗口到 16:00 结束）：今天必须还清，但不占可排时间。
        { 名: '示例窗口外固定成本', 时段: '18:30', 成本分: 30 },
      ],
    }),
  );
  // 全部日清成本都算进总数——顶部「今日日清未还几笔」统计的是全部，不管时段在不在窗口内。
  assert.equal(capacity.dailyMinutes, 45);
  // 只有窗口内的那 15 分钟从可排时间里扣。
  assert.equal(capacity.dailyMinutesInWindow, 15);
  assert.equal(capacity.dailyMinutesOutsideWindow, 30);
  assert.equal(capacity.schedulableMinutes, 330 - 15 - 45);
});

test('容量：日清时段落在不可占段里，不占可排时间', () => {
  const capacity = capacityFor(
    { date: '2026-11-05', time: '09:00' },
    config({
      窗口: [{ 起: '09:00', 止: '13:00' }],
      不可占: [{ 起: '12:00', 止: '13:00', 说明: '示例不可占段' }],
      日清: [{ 名: '示例不可占段里的固定成本', 时段: '12:30', 成本分: 20 }],
    }),
  );
  // 窗口跨过了不可占段，但 12:30 那段本来就不支配——不算落在可用窗口内。
  assert.equal(capacity.dailyMinutes, 20);
  assert.equal(capacity.dailyMinutesInWindow, 0);
  assert.equal(capacity.dailyMinutesOutsideWindow, 20);
  assert.equal(capacity.schedulableMinutes, 180 - 0 - 45);
});

test('容量：剩余可排时间也只扣窗口内的日清——窗口外的那笔不占剩余', () => {
  const capacity = capacityFor(
    { date: '2026-11-05', time: '13:30' },
    config({
      日清: [
        { 名: '示例窗口内固定成本', 时段: '14:00', 成本分: 15 },
        { 名: '示例窗口外固定成本', 时段: '18:30', 成本分: 30 },
      ],
    }),
  );
  // 13:30 起还剩 150 分钟窗口；14:00 那笔还没到，扣 15；插入损耗 45。
  assert.equal(capacity.remainingMinutes, 150 - 15 - 45);
});

test('容量：跨不可占时段的窗口，剩余时间也不把不可占那段算进去', () => {
  const capacity = capacityFor(
    { date: '2026-11-05', time: '11:00' },
    config({
      窗口: [{ 起: '09:00', 止: '13:00' }],
      不可占: [{ 起: '12:00', 止: '13:00', 说明: '示例不可占段' }],
      日清: [],
      插入损耗分钟: 0,
    }),
  );
  // 11:00 到 12:00 还有 60 分钟可用；12:00–13:00 不可占，不算进剩余。
  assert.equal(capacity.windowMinutes, 180);
  assert.equal(capacity.remainingMinutes, 60);
});

test('容量：剩余可排时间不为负——窗口外的日清再多也不扣成负数', () => {
  const capacity = capacityFor(
    { date: '2026-11-05', time: '09:00' },
    config({
      日清: [{ 名: '示例窗口外固定成本', 时段: '18:30', 成本分: 999 }],
    }),
  );
  assert.ok(capacity.remainingMinutes >= 0);
  assert.equal(capacity.remainingMinutes, 330 - 45);
});

test('容量：可排时间是纯函数——同一份配置算两次结果一样，不看时钟', () => {
  const cfg = config({ 日清: [{ 名: '示例固定成本', 时段: '09:00', 成本分: 15 }] });
  const first = schedulableMinutesOf(cfg);
  const second = schedulableMinutesOf(cfg);
  assert.deepEqual(first, second);
  assert.equal(first.windowMinutes, 330);
  assert.equal(first.dailyMinutes, 15);
  assert.equal(first.dailyMinutesInWindow, 15);
  assert.equal(first.dailyMinutesOutsideWindow, 0);
  assert.equal(first.schedulableMinutes, 270);
  // 不给配置就用通用默认值。
  assert.equal(schedulableMinutesOf().schedulableMinutes, 270);
});

test('预计耗时：番茄分钟来自本机配置——配置里没有就用通用默认值', () => {
  assert.equal(estimateWithConfig(note({ estimatePomo: 2 }), config({ 番茄分钟: 30 })).minutes, 60);
  // 配置里没写番茄分钟 → 通用默认值的 25。
  assert.equal(estimateWithConfig(note({ estimatePomo: 2 })).minutes, 50);
  // 配置里的番茄分钟不是数 → 也退回通用默认值，不算出一个 0 分钟。
  assert.equal(estimateWithConfig(note({ estimatePomo: 2 }), config({ 番茄分钟: '不是数' })).minutes, 50);
});

test('预计耗时：番茄数 × 番茄分钟', () => {
  assert.equal(estimateMinutes(note({ estimatePomo: 2 })), 50);
  assert.equal(estimateMinutes(note({ estimatePomo: 1 }), { pomodoroMinutes: 30 }), 30);
});

test('预计耗时：番茄数为 0 或缺失 = 未估算，不是 0 分钟', () => {
  assert.equal(estimateMinutes(note({ estimatePomo: 0 })), null);
  assert.equal(estimateMinutes(note({})), null);
  assert.equal(estimateMinutes(note({ estimatePomo: 0, estimateDuration: 30 })), 30);
});

test('预计耗时：estimatedDuration 作备选，单位按分钟处理（这是假设）', () => {
  assert.equal(estimateMinutes(note({ estimateDuration: 30 })), 30);
  // 番茄数优先于时长。
  assert.equal(estimateMinutes(note({ estimatePomo: 2, estimateDuration: 5 })), 50);
  // 两个都没有 → 未估算。
  assert.equal(estimateMinutes(note({ estimateDuration: 0 })), null);
});

test('预计耗时：便贴上没有估时字段就是未估算', () => {
  assert.equal(estimateMinutes(note()), null);
  assert.equal(estimateMinutes(null), null);
});

test('装得下：估时不超过今日剩余可排时间就是装得下', () => {
  const capacity = capacityFor({ date: '2026-11-05', time: '09:00' });
  assert.equal(fitsWithin(capacity, 60), true);
  assert.equal(fitsWithin(capacity, capacity.remainingMinutes), true);
  assert.equal(fitsWithin(capacity, capacity.remainingMinutes + 1), false);
});
