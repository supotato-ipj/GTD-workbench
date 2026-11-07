/**
 * 容器规则的检查（纯逻辑）。
 *
 * 断言的是「谁违反了哪几项」——角标亮不亮、亮几项，全在这里定。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { VIOLATION_KEYS, WAITING_ITEMS, violationsOf } from '../lib/rules.js';

/**
 * 造一条便贴。
 * @param {object} overrides - 覆盖项。
 * @returns {object} 便贴。
 */
function note(overrides = {}) {
  return { id: 'n1', title: '某事', content: '有正文', timeBands: ['事务'], hasChildren: false, ...overrides };
}

/** 四样写全的等待条目正文。 */
const WAITING_COMPLETE =
  '等谁：供应商；等什么：研究结论；什么时候回：11/4 白天；到期没回：17:30 前主动约下一轮。';

test('规则：等待清单四样齐就不亮角标', () => {
  assert.deepEqual(violationsOf(note({ content: WAITING_COMPLETE }), 'waiting'), []);
});

test('规则：等待清单缺哪样就报哪样，缺几样报几样', () => {
  assert.deepEqual(
    violationsOf(note({ content: '等谁：供应商；等什么：结论；什么时候回：11/4。' }), 'waiting'),
    ['waiting-missing-fallback'],
  );
  assert.deepEqual(violationsOf(note({ content: '等谁：供应商' }), 'waiting'), [
    'waiting-missing-what',
    'waiting-missing-when',
    'waiting-missing-fallback',
  ]);
  assert.deepEqual(
    violationsOf(note({ content: '' }), 'waiting'),
    ['waiting-missing-who', 'waiting-missing-what', 'waiting-missing-when', 'waiting-missing-fallback', 'empty-content'],
  );
});

test('规则：四样的前缀认全角冒号也认半角冒号', () => {
  const halfWidth = '等谁: a; 等什么: b; 什么时候回: c; 到期没回: d;';
  assert.deepEqual(violationsOf(note({ content: halfWidth }), 'waiting'), []);
  // 一样的正文放到执行清单里，就不该按等待清单的规则判。
  assert.deepEqual(violationsOf(note({ content: '等谁: a;', timeBands: ['事务'] }), 'execution'), []);
  assert.equal(WAITING_ITEMS.length, 4);
});

test('规则：执行清单没有时间档标签要亮', () => {
  assert.deepEqual(violationsOf(note({ timeBands: [] }), 'execution'), ['time-band-missing']);
});

test('规则：执行清单带多于一个时间档标签要亮', () => {
  assert.deepEqual(violationsOf(note({ timeBands: ['深度', '事务'] }), 'execution'), ['time-band-multiple']);
});

test('规则：执行清单恰好一个标签就不亮', () => {
  for (const band of ['深度', '事务', '日清']) {
    assert.deepEqual(violationsOf(note({ timeBands: [band] }), 'execution'), []);
  }
});

test('规则：时间档检查只约束执行清单——别的容器没标签不算违规', () => {
  assert.deepEqual(violationsOf(note({ content: WAITING_COMPLETE, timeBands: [] }), 'waiting'), []);
  assert.deepEqual(violationsOf(note({ timeBands: [] }), 'inbox'), []);
  assert.deepEqual(violationsOf(note({ timeBands: ['深度', '事务'] }), 'calendar'), []);
});

test('规则：项目挂了子任务要亮，别的容器挂子任务不算', () => {
  assert.deepEqual(violationsOf(note({ hasChildren: true }), 'project'), ['project-has-children']);
  assert.deepEqual(violationsOf(note({ hasChildren: false }), 'project'), []);
  assert.deepEqual(violationsOf(note({ hasChildren: true }), 'execution'), []);
});

test('规则：正文为空要亮，只看空白也算空', () => {
  assert.deepEqual(violationsOf(note({ content: '' }), 'execution'), ['empty-content']);
  assert.deepEqual(violationsOf(note({ content: '   \n\t ' }), 'execution'), ['empty-content']);
  assert.deepEqual(violationsOf(note({ content: 'x' }), 'execution'), []);
});

test('规则：多项同时违反时按固定顺序报', () => {
  const violations = violationsOf(note({ content: '' }), 'waiting');
  assert.deepEqual(violations, [
    'waiting-missing-who',
    'waiting-missing-what',
    'waiting-missing-when',
    'waiting-missing-fallback',
    'empty-content',
  ]);
  // 顺序固定，角标上的说法才稳定。
  assert.deepEqual([...violations].sort((a, b) => VIOLATION_KEYS.indexOf(a) - VIOLATION_KEYS.indexOf(b)), violations);
});

test('规则：坏输入不抛', () => {
  assert.deepEqual(violationsOf(null, 'execution'), []);
  assert.deepEqual(violationsOf(undefined, 'execution'), []);
  assert.deepEqual(violationsOf(42, 'execution'), []);
});
