/**
 * 容量参数的 schema（`app/capacity.schema.json`）。
 *
 * 公开仓库里关于容量参数只有三样东西：**schema**、**通用默认值**、**虚构的示例**。
 * 真实数值属于个人工作容量，不进本仓库（ADR-0011、AGENTS.md 的隐私线）。
 *
 * 这一层守住两件事：
 * - schema 与通用默认值**不漂移**（字段名改了，两边一起改）；
 * - schema 与读取器**口径一致**（schema 说不行的，读取器也判无效）。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CAPACITY_CONFIG } from '../lib/capacity.js';
import { isValidCapacityConfig } from '../lib/config.js';
import { validateAgainstSchema } from './helpers/schema-lite.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(path.join(here, '..', 'capacity.schema.json'), 'utf8'));

/**
 * 一份**虚构**的完整配置。
 * @param {object} [overrides] - 顶层字段覆盖。
 * @returns {object} 配置。
 */
function config(overrides = {}) {
  return {
    定于: '2026-01-01',
    窗口: [
      { 起: '09:00', 止: '12:00', 类: '连续' },
      { 起: '13:30', 止: '16:00', 类: '可打断' },
    ],
    不可占: [{ 起: '12:00', 止: '13:30', 说明: '示例午休' }],
    日清: [
      { 名: '示例固定成本', 时段: '09:00', 成本分: 15 },
      { 名: '示例窗口外固定成本', 时段: '18:30', 成本分: 30 },
    ],
    插入损耗分钟: 45,
    深度: { 单日上限分钟: 180, 单日配额: 1, 估时系数: 2 },
    番茄分钟: 25,
    ...overrides,
  };
}

test('schema：是一份机器可读的 JSON Schema（draft 2020-12）', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.type, 'object');
  assert.ok(Array.isArray(schema.examples) && schema.examples.length > 0);
});

test('schema：字段与通用默认值一致——改了要两边一起改', () => {
  assert.deepEqual(
    Object.keys(schema.properties).sort(),
    Object.keys(DEFAULT_CAPACITY_CONFIG).sort(),
  );
  assert.deepEqual(schema.required.slice().sort(), Object.keys(DEFAULT_CAPACITY_CONFIG).sort());
});

test('schema：自带的示例自己就通过自己的校验', () => {
  for (const example of schema.examples) {
    const result = validateAgainstSchema(schema, example);
    assert.ok(result.valid, `示例没过校验：${result.errors.join('；')}`);
  }
});

test('schema：通用默认值（把「定于」换成某一天后）也符合这份 schema', () => {
  const dated = { ...DEFAULT_CAPACITY_CONFIG, 定于: '2026-01-01' };
  const result = validateAgainstSchema(schema, dated);
  assert.ok(result.valid, `通用默认值没过校验：${result.errors.join('；')}`);
});

test('schema：日清项的时段可以落在可用窗口之外', () => {
  // 18:30 在两个窗口（09:00–12:00、13:30–16:00）之外——这被允许，而且是有意义的：
  // 这样的固定成本不占可排时间，但仍然算今天的日清。
  const outside = config({
    日清: [{ 名: '示例窗口外固定成本', 时段: '18:30', 成本分: 30 }],
  });
  const result = validateAgainstSchema(schema, outside);
  assert.ok(result.valid, result.errors.join('；'));
});

test('schema：坏配置过不了校验', () => {
  const bad = [
    config({ 窗口: [{ 起: '9点', 止: '12:00' }] }),
    config({ 插入损耗分钟: '半小时' }),
    config({ 番茄分钟: 0 }),
    config({ 日清: [{ 名: '示例', 时段: '09:00' }] }),
    config({ 深度: { 单日上限分钟: 180 } }),
  ];
  for (const value of bad) {
    const result = validateAgainstSchema(schema, value);
    assert.equal(result.valid, false, `这份本该不过：${JSON.stringify(value)}`);
  }
});

test('schema 与读取器口径一致——除了「起止先后」这一条 schema 表达不了', () => {
  // JSON Schema 只能查形状（字段、类型、格式），**比不了两个时刻谁在前**；
  // 「止晚于起」由读取器兜住：起止颠倒的配置照样退回通用默认值。
  const cases = [
    { value: config(), bySchema: true, byReader: true },
    { value: config({ 窗口: [{ 起: '09:00', 止: '12:00' }] }), bySchema: true, byReader: true },
    { value: config({ 深度: { 单日上限分钟: 180, 单日配额: 1 } }), bySchema: true, byReader: true },
    { value: config({ 窗口: [{ 起: '9点', 止: '12:00' }] }), bySchema: false, byReader: false },
    { value: config({ 插入损耗分钟: '半小时' }), bySchema: false, byReader: false },
    { value: config({ 番茄分钟: 0 }), bySchema: false, byReader: false },
    { value: config({ 日清: [{ 名: '示例', 时段: '09:00' }] }), bySchema: false, byReader: false },
    { value: config({ 深度: { 单日上限分钟: 180 } }), bySchema: false, byReader: false },
    { value: { ...config(), 多余字段: true }, bySchema: false, byReader: false },
    // 起止颠倒：schema 查不出来，读取器兜住。
    { value: config({ 窗口: [{ 起: '12:00', 止: '09:00' }] }), bySchema: true, byReader: false },
  ];
  for (const item of cases) {
    assert.equal(
      validateAgainstSchema(schema, item.value).valid,
      item.bySchema,
      `schema 口径不对：${JSON.stringify(item.value)}`,
    );
    assert.equal(
      isValidCapacityConfig(item.value),
      item.byReader,
      `读取器口径不对：${JSON.stringify(item.value)}`,
    );
  }
});
