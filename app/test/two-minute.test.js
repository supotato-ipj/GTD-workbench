/**
 * 两分钟卡（issue #11）：收集箱里「两分钟就能做完」的捕获顶到主卡位。
 *
 * 这一票定下两个口径（规格 issue #1「焦点资格」第 7 条）：
 *
 * - **整理收集箱** = 当前时刻落在**日回顾窗口**内（一天里的固定时段）。
 *   不用「收集箱非空」：两分钟卡本身就在收集箱里，收集箱非空时它必然成立，等于没有闸门。
 * - **深度块进行中** = 当前时刻落在**连续窗口**内，**且**今天的深度名额还挂着一条
 *   未完成的深度档动作。这时两分钟卡不抢主卡位（不报错、不空转）。
 *
 * 另外两条从既有口径继承下来的：
 * - **逾期的动作不受时段偏好影响**，但两分钟规则不是时段偏好，是一条**资格例外**：
 *   它顶主卡位，被挤下去的逾期动作进「接下来」的第一位。
 * - **未估算（null）不算两分钟**：没估时就不能说它两分钟能做完。
 *
 * 断言的是纯函数输出：谁占主卡、卡上有没有引导标记、便贴的资格与原因。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { capacityFor } from '../lib/capacity.js';
import { readTwoMinutePolicy } from '../lib/config.js';
import {
  DEFAULT_TWO_MINUTE_POLICY,
  eligibilityOf,
  focusGuideOf,
  twoMinutePolicyOf,
  twoMinuteStateOf,
} from '../lib/focus-guide.js';

const TODAY = '2026-11-05';

/** 容量参数（虚构）：上午一段连续窗口、下午一段可打断窗口、中间一段不可占。 */
const CAPACITY_CONFIG = {
  定于: '2026-11-05',
  窗口: [
    { 起: '09:00', 止: '12:00', 类: '连续' },
    { 起: '13:30', 止: '16:00', 类: '可打断' },
  ],
  不可占: [{ 起: '12:00', 止: '13:30', 说明: '示例午休' }],
  日清: [],
  插入损耗分钟: 0,
  深度: { 单日上限分钟: 180, 单日配额: 1 },
  番茄分钟: 25,
};

/** 日回顾窗口（虚构）：默认落在下午可打断窗口的尾段，避开连续窗口。 */
const REVIEW_WINDOW = { start: '14:45', end: '15:00' };

/**
 * 造一份上下文（带两分钟规则的**参数**，不含 `allowed`）。
 * @param {object} [options] - 选项。
 * @param {string} [options.time] - 当前时刻（`HH:mm`）。
 * @param {object} [options.policy] - 两分钟规则参数（覆盖默认值）。
 * @param {object} [options.capacityConfig] - 容量配置（覆盖默认值）。
 * @returns {object} 上下文。
 */
function context({ time = '14:50', policy = {}, capacityConfig = CAPACITY_CONFIG } = {}) {
  return {
    today: TODAY,
    nowTime: time,
    capacity: capacityFor({ date: TODAY, time }, capacityConfig),
    twoMinute: {
      enabled: true,
      maxMinutes: 2,
      reviewWindow: REVIEW_WINDOW,
      ...policy,
    },
  };
}

/**
 * 造一份**判定用**的上下文：把此刻的两分钟状态算好带进来。
 *
 * 这就是 `focusGuideOf` 内部做的事（`twoMinuteStateOf` → 带进上下文 → `eligibilityOf`）。
 * 单条便贴的资格判定要判断「深度块进行中」，那要看今天还有没有深度动作——
 * 那是整份快照的事，所以状态得由拿着容器组的那一层算。
 * @param {object[]} containers - 容器组。
 * @param {object} [options] - 选项（同 {@link context}）。
 * @returns {object} 判定用上下文。
 */
function judgeContext(containers, options = {}) {
  const ctx = context(options);
  const state = twoMinuteStateOf(containers, ctx);
  return { ...ctx, twoMinute: { ...ctx.twoMinute, ...state } };
}

/**
 * 造一个容器组。
 * @param {string} key - 容器标识。
 * @param {object[]} notes - 便贴。
 * @returns {object} 容器组。
 */
function container(key, notes) {
  return { key, name: key, notes };
}

/**
 * 造一条收集箱里的捕获（未判定：没有时间档）。
 * @param {object} [overrides] - 覆盖项。
 * @returns {object} 便贴。
 */
function capture(overrides = {}) {
  return {
    id: '捕获',
    title: '示例：签收一张回执',
    status: 0,
    content: '',
    timeBand: null,
    timeBands: [],
    segment: 'later',
    dueAt: null,
    dueLocal: null,
    dueDate: null,
    dueTime: null,
    dueAllDay: false,
    startAt: null,
    startLocal: null,
    priority: 0,
    estimatePomo: null,
    // 专注时长的单位是**秒**：120 秒 = 两分钟。
    estimateDuration: 120,
    ...overrides,
  };
}

/**
 * 造一条执行清单里的动作。
 * @param {object} [overrides] - 覆盖项。
 * @returns {object} 便贴。
 */
function action(overrides = {}) {
  return {
    id: '动作',
    title: '示例：把材料补齐',
    status: 0,
    content: '',
    timeBand: '事务',
    timeBands: ['事务'],
    segment: 'today',
    dueAt: '2026-11-05T02:00:00.000Z',
    dueLocal: '2026-11-05 10:00',
    dueDate: '2026-11-05',
    dueTime: '10:00',
    dueAllDay: false,
    startAt: null,
    startLocal: null,
    priority: 0,
    estimatePomo: null,
    // 专注时长的单位是**秒**：1800 秒 = 三十分钟。
    estimateDuration: 1800,
    ...overrides,
  };
}

test('两分钟卡：整理收集箱（日回顾窗口内）时，估时不超过两分钟的捕获顶到主卡位', () => {
  const containers = [container('inbox', [capture()]), container('execution', [action()])];
  const guide = focusGuideOf(containers, context());
  assert.equal(guide.card.id, '捕获');
  assert.equal(guide.card.container, 'inbox');
  // 引导标记：Client 侧据此显示「直接做掉、别判定」。
  assert.equal(guide.card.twoMinute, true);
  // 事实也一起过界：Client 不用自己算估时。
  assert.equal(guide.card.estimateMinutes, 2);
  assert.equal(guide.card.estimateSource, 'estimatedDuration');
});

test('两分钟卡：估时为 null（未估算）不算两分钟', () => {
  const containers = [
    container('inbox', [capture({ estimateDuration: null })]),
    container('execution', [action()]),
  ];
  const ctx = judgeContext(containers);
  assert.deepEqual(eligibilityOf(capture({ estimateDuration: null }), 'inbox', ctx), {
    eligible: false,
    reason: '收集箱未明晰',
  });
  const guide = focusGuideOf(containers, context());
  assert.equal(guide.card.id, '动作');
  assert.equal(guide.card.twoMinute, false);
});

test('两分钟卡：估时超过两分钟不算两分钟', () => {
  const containers = [
    container('inbox', [capture({ estimateDuration: 300 })]),
    container('execution', [action()]),
  ];
  const ctx = judgeContext(containers);
  assert.deepEqual(eligibilityOf(capture({ estimateDuration: 300 }), 'inbox', ctx), {
    eligible: false,
    reason: '收集箱未明晰',
  });
  const guide = focusGuideOf(containers, context());
  assert.equal(guide.card.id, '动作');
  assert.equal(guide.card.twoMinute, false);
});

test('两分钟卡：估时按滴答的番茄估算折算（估时 = 番茄数 × 番茄分钟）', () => {
  // 一个番茄 25 分钟 → 25 分钟，不是两分钟卡。
  const big = [container('inbox', [capture({ estimatePomo: 1, estimateDuration: null })]), container('execution', [action()])];
  assert.equal(focusGuideOf(big, context()).card.id, '动作');
  // 番茄本身就是 2 分钟 → 2 分钟，就是两分钟卡。
  const small = [
    container('inbox', [capture({ estimatePomo: 1, estimateDuration: null })]),
    container('execution', [action()]),
  ];
  const config = { ...CAPACITY_CONFIG, 番茄分钟: 2 };
  const guide = focusGuideOf(small, context({ capacityConfig: config }));
  assert.equal(guide.card.id, '捕获');
  assert.equal(guide.card.estimateMinutes, 2);
  assert.equal(guide.card.estimateSource, 'estimatedPomo');
});

test('两分钟卡：阈值来自上下文，不写死在判断里', () => {
  const containers = [
    container('inbox', [capture({ estimateDuration: 240 })]),
    container('execution', [action()]),
  ];
  const ctx = judgeContext(containers, { policy: { maxMinutes: 5 } });
  assert.equal(ctx.twoMinute.maxMinutes, 5);
  assert.deepEqual(eligibilityOf(capture({ estimateDuration: 240 }), 'inbox', ctx), {
    eligible: true,
    reason: null,
  });
  const guide = focusGuideOf(containers, context({ policy: { maxMinutes: 5 } }));
  assert.equal(guide.card.id, '捕获');
});

test('两分钟卡：规则没启用时收集箱一律「收集箱未明晰」', () => {
  const containers = [container('inbox', [capture()]), container('execution', [action()])];
  const ctx = judgeContext(containers, { policy: { enabled: false } });
  assert.deepEqual(eligibilityOf(capture(), 'inbox', ctx), {
    eligible: false,
    reason: '收集箱未明晰',
  });
  const guide = focusGuideOf(containers, context({ policy: { enabled: false } }));
  assert.equal(guide.card.id, '动作');
  assert.equal(guide.twoMinute.allowed, false);
});

test('两分钟卡：不在日回顾窗口内不抢主卡位', () => {
  // 10:00 在连续窗口里，但不是日回顾窗口。
  const containers = [container('inbox', [capture()]), container('execution', [action()])];
  const ctx = judgeContext(containers, { time: '10:00' });
  assert.equal(ctx.twoMinute.inReviewWindow, false);
  assert.deepEqual(eligibilityOf(capture(), 'inbox', ctx), {
    eligible: false,
    reason: '收集箱未明晰',
  });
  const guide = focusGuideOf(containers, context({ time: '10:00' }));
  assert.equal(guide.card.id, '动作');
  assert.equal(guide.card.twoMinute, false);
});

test('两分钟卡：深度块进行中不抢主卡位（不报错、不空转）', () => {
  // 09:30 落在连续窗口内，今天还有一条深度动作没派出去 → 深度块进行中。
  const containers = [
    container('inbox', [capture()]),
    container('execution', [action({ id: '深度', timeBand: '深度', timeBands: ['深度'] }), action()]),
  ];
  const policy = { reviewWindow: { start: '09:00', end: '10:00' } };
  const ctx = judgeContext(containers, { time: '09:30', policy });
  assert.equal(ctx.twoMinute.deepBlockInProgress, true);
  assert.equal(ctx.twoMinute.allowed, false);
  assert.deepEqual(eligibilityOf(capture(), 'inbox', ctx), {
    eligible: false,
    reason: '收集箱未明晰',
  });
  const guide = focusGuideOf(containers, context({ time: '09:30', policy }));
  // 主卡回到深度动作，不是空的。
  assert.equal(guide.card.id, '深度');
  assert.equal(guide.card.twoMinute, false);
});

test('两分钟卡：深度名额没人挂时，连续窗口里也可以抢位', () => {
  // 同样在连续窗口里，但今天没有深度档动作 → 深度名额没人挂 → 深度块没有进行中。
  const containers = [container('inbox', [capture()]), container('execution', [action()])];
  const policy = { reviewWindow: { start: '09:00', end: '10:00' } };
  const ctx = judgeContext(containers, { time: '09:30', policy });
  assert.equal(ctx.twoMinute.deepBlockInProgress, false);
  const guide = focusGuideOf(containers, context({ time: '09:30', policy }));
  assert.equal(guide.card.id, '捕获');
  assert.equal(guide.card.twoMinute, true);
});

test('两分钟卡：状态里说得清此刻为什么允许（或不允许）', () => {
  const containers = [container('inbox', [capture()])];
  const state = twoMinuteStateOf(containers, context());
  assert.equal(state.enabled, true);
  assert.equal(state.maxMinutes, 2);
  assert.equal(state.inReviewWindow, true);
  assert.equal(state.deepBlockInProgress, false);
  assert.equal(state.allowed, true);

  const outside = twoMinuteStateOf(containers, context({ time: '10:00' }));
  assert.equal(outside.inReviewWindow, false);
  assert.equal(outside.allowed, false);
});

test('两分钟卡：上层可以否决这条规则（allowed: false）', () => {
  const containers = [container('inbox', [capture()]), container('execution', [action()])];
  const guide = focusGuideOf(containers, context({ policy: { allowed: false } }));
  assert.equal(guide.twoMinute.allowed, false);
  assert.equal(guide.card.id, '动作');
  assert.equal(guide.card.twoMinute, false);
});

test('两分钟卡：普通卡上没有引导标记', () => {
  const containers = [container('execution', [action()])];
  const guide = focusGuideOf(containers, context());
  assert.equal(guide.card.id, '动作');
  assert.equal(guide.card.twoMinute, false);
});

test('两分钟卡：它不进「接下来」——两分钟卡是要直接做掉的，不是排队等的', () => {
  const containers = [
    container('inbox', [capture({ id: '捕获一' }), capture({ id: '捕获二' })]),
    container('execution', [action()]),
  ];
  const guide = focusGuideOf(containers, context());
  // 顶主卡的是其中一条。
  assert.equal(guide.card.id, '捕获一');
  assert.equal(guide.card.twoMinute, true);
  // 队列里既没有占卡的那条，也没有另一条两分钟捕获。
  assert.deepEqual(
    guide.next.map((item) => item.id),
    ['动作'],
  );
});

test('两分钟卡：顶到主卡位时，逾期的动作仍然是「接下来」的第一条', () => {
  // 两分钟规则不是时段偏好，是一条资格例外：它顶主卡位。
  // 被挤下去的逾期动作不会消失——它按排序进「接下来」的第一位。
  const containers = [
    container('inbox', [capture()]),
    container('execution', [
      action({ id: '逾期', dueDate: '2026-11-04', dueLocal: '2026-11-04 10:00', overdue: true }),
    ]),
  ];
  const guide = focusGuideOf(containers, context());
  assert.equal(guide.card.id, '捕获');
  assert.equal(guide.card.twoMinute, true);
  assert.deepEqual(
    guide.next.map((item) => item.id),
    ['逾期'],
  );
});

test('两分钟卡：完成之后它就不再是候选（已完成不是两分钟）', () => {
  const containers = [
    container('inbox', [capture({ status: 2 })]),
    container('execution', [action()]),
  ];
  const ctx = judgeContext(containers);
  assert.deepEqual(eligibilityOf(capture({ status: 2 }), 'inbox', ctx), {
    eligible: false,
    reason: '已完成',
  });
  const guide = focusGuideOf(containers, context());
  assert.equal(guide.card.id, '动作');
  assert.equal(guide.card.twoMinute, false);
});

test('两分钟卡：坏输入不抛', () => {
  const guide = focusGuideOf(undefined, undefined);
  assert.equal(guide.card, null);
  assert.deepEqual(guide.next, []);
  assert.equal(guide.twoMinute.allowed, false);
});

test('两分钟卡：通用默认值写在规则里，不是散落在判断逻辑里', () => {
  assert.deepEqual(DEFAULT_TWO_MINUTE_POLICY, {
    enabled: true,
    maxMinutes: 2,
    reviewWindow: { start: '14:45', end: '15:00' },
  });
});

test('两分钟卡：参数读坏了退回通用默认值，缺省即关', () => {
  // 没给 `enabled` → 规则没启用（上下文里没有参数就不启用这条规则）。
  assert.equal(twoMinutePolicyOf({}).enabled, false);
  assert.equal(twoMinutePolicyOf(null).enabled, false);
  // 阈值写坏了退回通用默认值。
  assert.equal(twoMinutePolicyOf({ enabled: true, maxMinutes: 0 }).maxMinutes, 2);
  assert.equal(twoMinutePolicyOf({ enabled: true, maxMinutes: -1 }).maxMinutes, 2);
  // 日回顾窗口写坏了（时刻不合法、止不晚于起）退回通用默认值。
  const bad = twoMinutePolicyOf({ enabled: true, reviewWindow: { start: '25:00', end: '26:00' } });
  assert.deepEqual(bad.reviewWindow, { start: '14:45', end: '15:00' });
  const reversed = twoMinutePolicyOf({ enabled: true, reviewWindow: { start: '15:00', end: '14:45' } });
  assert.deepEqual(reversed.reviewWindow, { start: '14:45', end: '15:00' });
});

/**
 * 造一个临时「仓库根」，写一份 `local-config.json`。
 * @param {object | null} config - 配置内容；null = 不写文件。
 * @returns {string} 临时目录的绝对路径。
 */
function tempRoot(config) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gtd-two-minute-'));
  if (config !== null) {
    writeFileSync(path.join(root, 'local-config.json'), JSON.stringify(config), 'utf8');
  }
  return root;
}

test('两分钟卡：本机配置里的「两分钟」字段读得出来', () => {
  const root = tempRoot({
    两分钟: { 启用: true, 上限分钟: 3, 日回顾窗口: { 起: '13:00', 止: '13:20' } },
  });
  const policy = readTwoMinutePolicy({ root });
  assert.equal(policy.enabled, true);
  assert.equal(policy.maxMinutes, 3);
  assert.deepEqual(policy.reviewWindow, { start: '13:00', end: '13:20' });
  rmSync(root, { recursive: true, force: true });
});

test('两分钟卡：本机配置写坏了退回通用默认值，不抛', () => {
  // 没有这个字段 / 不是对象 / 字段缺了 / 时刻不合法——一律退回通用默认值。
  for (const config of [
    null,
    {},
    { 两分钟: '开' },
    { 两分钟: { 上限分钟: 2, 日回顾窗口: { 起: '13:00', 止: '13:20' } } },
    { 两分钟: { 启用: true, 上限分钟: 2 } },
    { 两分钟: { 启用: true, 上限分钟: 2, 日回顾窗口: { 起: '25:00', 止: '26:00' } } },
    { 两分钟: { 启用: true, 上限分钟: 2, 日回顾窗口: { 起: '13:20', 止: '13:00' } } },
  ]) {
    const root = tempRoot(config);
    const policy = readTwoMinutePolicy({ root });
    assert.equal(policy.enabled, DEFAULT_TWO_MINUTE_POLICY.enabled);
    assert.equal(policy.maxMinutes, DEFAULT_TWO_MINUTE_POLICY.maxMinutes);
    assert.deepEqual(policy.reviewWindow, DEFAULT_TWO_MINUTE_POLICY.reviewWindow);
    rmSync(root, { recursive: true, force: true });
  }
});

test('两分钟卡：「启用: false」是合法配置——用户主动关掉这条规则', () => {
  const root = tempRoot({
    两分钟: { 启用: false, 上限分钟: 2, 日回顾窗口: { 起: '13:00', 止: '13:20' } },
  });
  const policy = readTwoMinutePolicy({ root });
  assert.equal(policy.enabled, false);
  assert.equal(policy.maxMinutes, 2);
  rmSync(root, { recursive: true, force: true });
});
