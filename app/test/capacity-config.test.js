/**
 * 本机容量配置的读取（`local-config.json` 的「容量」字段）。
 *
 * 这一层回答一个问题：**工作台该按哪一份容量参数算今天还剩多少**。
 * 本机配置不进公开仓库（真实容量数值属于个人工作容量），
 * 仓库里只有通用默认值与一份虚构的 schema。
 *
 * 断言的是外部可观察行为：读回来的配置长什么样、读不到时退回什么、
 * 改完文件刷新是不是立刻生效（**每次都重读，不缓存**）。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { DEFAULT_CAPACITY_CONFIG } from '../lib/capacity.js';
import { isValidCapacityConfig, readCapacityConfig } from '../lib/config.js';

/**
 * 一份**虚构**的本机容量配置（数值是编的，不是任何人的真实容量）。
 * @param {object} [overrides] - 顶层字段覆盖。
 * @returns {object} 配置。
 */
function capacityConfig(overrides = {}) {
  return {
    定于: '2026-01-01',
    窗口: [
      { 起: '08:00', 止: '11:30', 类: '连续' },
      { 起: '13:00', 止: '15:00', 类: '可打断' },
    ],
    不可占: [{ 起: '11:30', 止: '13:00', 说明: '示例午休' }],
    日清: [{ 名: '示例固定成本', 时段: '08:30', 成本分: 20 }],
    插入损耗分钟: 30,
    深度: { 单日上限分钟: 120, 单日配额: 1, 估时系数: 2 },
    番茄分钟: 30,
    ...overrides,
  };
}

/**
 * 造一个临时「仓库根」，可选地写一份 `local-config.json`。
 * @param {object} [options] - 选项。
 * @param {object} [options.config] - 写进 `local-config.json` 的内容（对象）。
 * @param {string} [options.raw] - 直接写进 `local-config.json` 的原文（用来测坏 JSON）。
 * @returns {string} 临时目录的绝对路径。
 */
function tempRoot({ config, raw } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gtd-capacity-'));
  if (raw !== undefined) {
    writeFileSync(path.join(root, 'local-config.json'), raw, 'utf8');
  } else if (config !== undefined) {
    writeFileSync(path.join(root, 'local-config.json'), JSON.stringify(config), 'utf8');
  }
  return root;
}

test('本机配置：有「容量」字段时读得到，参数原样带过来', () => {
  const root = tempRoot({ config: { 容量: capacityConfig() } });
  const config = readCapacityConfig({ root });
  assert.equal(config.定于, '2026-01-01');
  assert.equal(config.窗口.length, 2);
  assert.equal(config.窗口[0].类, '连续');
  assert.equal(config.日清[0].名, '示例固定成本');
  assert.equal(config.插入损耗分钟, 30);
  assert.equal(config.深度.单日上限分钟, 120);
  assert.equal(config.番茄分钟, 30);
});

test('本机配置：没有配置文件时退回通用默认值，参数标记为未定', () => {
  const root = tempRoot();
  const config = readCapacityConfig({ root });
  assert.deepEqual(config, DEFAULT_CAPACITY_CONFIG);
  assert.equal(config.定于, null);
});

test('本机配置：没有「容量」字段时退回通用默认值', () => {
  const root = tempRoot({ config: { 记录目录: 'my-records' } });
  assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：配置读不到（目录不存在）时不抛，退回通用默认值', () => {
  const missing = path.join(tempRoot(), 'no-such-dir');
  assert.deepEqual(readCapacityConfig({ root: missing }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：文件不是合法 JSON 时退回通用默认值', () => {
  const root = tempRoot({ raw: '{ not json' });
  assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：「容量」不是对象时退回通用默认值', () => {
  for (const bad of ['字符串', 42, true, ['数组']]) {
    const root = tempRoot({ config: { 容量: bad } });
    assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
  }
});

test('本机配置：时刻格式不对时退回通用默认值', () => {
  const root = tempRoot({
    config: { 容量: capacityConfig({ 窗口: [{ 起: '9点', 止: '11:30' }] }) },
  });
  assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：窗口起止颠倒时退回通用默认值', () => {
  const root = tempRoot({
    config: { 容量: capacityConfig({ 窗口: [{ 起: '11:30', 止: '08:00' }] }) },
  });
  assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：字段缺失时退回通用默认值', () => {
  const incomplete = capacityConfig();
  delete incomplete.番茄分钟;
  const root = tempRoot({ config: { 容量: incomplete } });
  assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：类型不对时退回通用默认值', () => {
  const root = tempRoot({ config: { 容量: capacityConfig({ 插入损耗分钟: '半小时' }) } });
  assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：窗口的「类」写了不认识的值时退回通用默认值', () => {
  const root = tempRoot({
    config: { 容量: capacityConfig({ 窗口: [{ 起: '08:00', 止: '11:30', 类: '随便写' }] }) },
  });
  assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：多一个不认识的字段时退回通用默认值', () => {
  const root = tempRoot({ config: { 容量: { ...capacityConfig(), 多余字段: true } } });
  assert.deepEqual(readCapacityConfig({ root }), DEFAULT_CAPACITY_CONFIG);
});

test('本机配置：每次都重读——改完文件刷新就生效，不缓存', () => {
  const root = tempRoot({ config: { 容量: capacityConfig() } });
  assert.equal(readCapacityConfig({ root }).番茄分钟, 30);
  // 改配置：番茄分钟从 30 改成 20。
  writeFileSync(
    path.join(root, 'local-config.json'),
    JSON.stringify({ 容量: capacityConfig({ 番茄分钟: 20 }) }),
    'utf8',
  );
  assert.equal(readCapacityConfig({ root }).番茄分钟, 20);
});

test('本机配置：退回的默认值是副本——改动它不会影响下一次读', () => {
  const root = tempRoot();
  const first = readCapacityConfig({ root });
  first.窗口.push({ 起: '20:00', 止: '21:00' });
  first.番茄分钟 = 999;
  const second = readCapacityConfig({ root });
  assert.equal(second.窗口.length, DEFAULT_CAPACITY_CONFIG.窗口.length);
  assert.equal(second.番茄分钟, DEFAULT_CAPACITY_CONFIG.番茄分钟);
});

test('本机配置：校验器认得一份完整的配置', () => {
  assert.equal(isValidCapacityConfig(capacityConfig()), true);
  assert.equal(isValidCapacityConfig(DEFAULT_CAPACITY_CONFIG), false);
  assert.equal(isValidCapacityConfig(null), false);
  assert.equal(isValidCapacityConfig('不是对象'), false);
});

test('本机配置：读到的配置能直接喂给容量计算', () => {
  const root = tempRoot({ config: { 容量: capacityConfig() } });
  const config = readCapacityConfig({ root });
  // 番茄分钟是配置里那份：估时按它折算。
  assert.equal(config.番茄分钟, 30);
  rmSync(root, { recursive: true, force: true });
});
