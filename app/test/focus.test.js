/**
 * 本周主攻的推导（纯逻辑）。
 *
 * 断言的是「谁算主攻」：只认滴答的 `深度` 标签 + 本周内 + 未完成，且**不读手写名单**。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { THIS_WEEK_SEGMENTS, focusOf, isFocusNote } from '../lib/focus.js';

/**
 * 造一条便贴。
 * @param {object} overrides - 覆盖项。
 * @returns {object} 便贴。
 */
function note(overrides = {}) {
  return {
    id: 'n1',
    title: '某事',
    status: 0,
    timeBand: '深度',
    segment: 'today',
    dueLocal: '2026-11-05 10:00',
    ...overrides,
  };
}

/**
 * 造一个容器组。
 * @param {object[]} notes - 便贴。
 * @returns {object} 容器组。
 */
function container(notes, key = 'execution', name = '执行') {
  return { key, name, notes };
}

test('主攻：深度标签 + 本周内 + 未完成，三条都满足才算', () => {
  assert.equal(isFocusNote(note()), true);
  // 不是深度
  assert.equal(isFocusNote(note({ timeBand: '事务' })), false);
  // 已完成
  assert.equal(isFocusNote(note({ status: 2 })), false);
  // 不在本周（「以后」）
  assert.equal(isFocusNote(note({ segment: 'later' })), false);
  assert.equal(isFocusNote(note({ timeBand: null })), false);
});

test('主攻：今天、明天、本周都算本周之内', () => {
  assert.deepEqual(THIS_WEEK_SEGMENTS, ['today', 'tomorrow', 'thisWeek']);
  for (const segment of THIS_WEEK_SEGMENTS) assert.equal(isFocusNote(note({ segment })), true);
});

test('主攻：条数与滴答一致——不截断到 3 项', () => {
  const rows = focusOf([
    container([
      note({ id: 'a', segment: 'today', dueLocal: '2026-11-05 09:00' }),
      note({ id: 'b', segment: 'today', dueLocal: '2026-11-05 10:00' }),
      note({ id: 'c', segment: 'tomorrow', dueLocal: '2026-11-06 09:00' }),
      note({ id: 'd', segment: 'thisWeek', dueLocal: '2026-11-08 09:00' }),
    ]),
  ]);
  assert.equal(rows.length, 4);
});

test('主攻：按今天 → 明天 → 本周排，同段按到期时间', () => {
  const rows = focusOf([
    container([
      note({ id: 'later-week', segment: 'thisWeek', dueLocal: '2026-11-08 15:00' }),
      note({ id: 'today-late', segment: 'today', dueLocal: '2026-11-05 15:00' }),
      note({ id: 'tomorrow', segment: 'tomorrow', dueLocal: '2026-11-06 09:00' }),
      note({ id: 'today-early', segment: 'today', dueLocal: '2026-11-05 08:30' }),
    ]),
  ]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ['today-early', 'today-late', 'tomorrow', 'later-week'],
  );
});

test('主攻：跨容器一起收，带上容器名便于定位', () => {
  const rows = focusOf([
    container([note({ id: 'e1' })], 'execution', '执行'),
    container([note({ id: 'w1', segment: 'tomorrow' })], 'waiting', '等待'),
  ]);
  assert.deepEqual(
    rows.map((row) => [row.id, row.container, row.containerName]),
    [
      ['e1', 'execution', '执行'],
      ['w1', 'waiting', '等待'],
    ],
  );
});

test('主攻：把深度标签换掉，主攻就少一条——改标签不改编名单', () => {
  const before = focusOf([container([note({ id: 'a' }), note({ id: 'b', title: '另一件' })])]);
  assert.equal(before.length, 2);
  const after = focusOf([container([note({ id: 'a' }), note({ id: 'b', title: '另一件', timeBand: '事务' })])]);
  assert.equal(after.length, 1);
  assert.equal(after[0].id, 'a');
});

test('主攻：不读手写名单——手写名单说什么都不影响推导', () => {
  // 推导只看便贴上的 timeBand／segment／status，函数根本没有读文件的口子。
  const rows = focusOf([container([note({ id: 'only-ticktick' })])]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ['only-ticktick'],
  );
});

test('主攻：空容器、坏输入都不抛', () => {
  assert.deepEqual(focusOf([]), []);
  assert.deepEqual(focusOf(undefined), []);
  assert.deepEqual(focusOf([{ key: 'x', name: 'x' }]), []);
  assert.deepEqual(focusOf([container([null, undefined, 42])]), []);
});
