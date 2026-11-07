/**
 * 本机清单 id 的读取（`local-config.json` 的「清单」字段）。
 *
 * 这一层回答一个问题：**工作台该按哪一份滴答清单 id 取数**。
 * 仓库里 `lib/containers.js` 的 id 是**虚构占位**（真实 id 属于个人信息，不进公开仓库），
 * 真机上由本机配置覆盖。
 *
 * 断言的是外部可观察行为：读回来的纸箱长什么样、读不到时退回什么、
 * 改完文件刷新是不是立刻生效（**每次都重读，不缓存**）。
 * 夹具里的 id 全是编出来的，不是任何人的真实清单。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { CONTAINERS } from '../lib/containers.js';
import { readContainers } from '../lib/config.js';

/**
 * 编一个清单 id（**虚构**）：前缀 `f00d` 一眼看出是占位，后面补零凑满 24 位。
 * @param {number} n - 序号。
 * @returns {string} 清单 id。
 */
function fakeId(n) {
  return `f00d${String(n).padStart(20, '0')}`;
}

/**
 * 造一个临时「仓库根」，可选地写一份 `local-config.json`。
 * @param {object} [options] - 选项。
 * @param {object} [options.config] - 写进 `local-config.json` 的内容（对象）。
 * @param {string} [options.raw] - 直接写进 `local-config.json` 的原文（用来测坏 JSON）。
 * @returns {string} 临时目录的绝对路径。
 */
function tempRoot({ config, raw } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gtd-containers-'));
  if (raw !== undefined) {
    writeFileSync(path.join(root, 'local-config.json'), raw, 'utf8');
  } else if (config !== undefined) {
    writeFileSync(path.join(root, 'local-config.json'), JSON.stringify(config), 'utf8');
  }
  return root;
}

/**
 * 按 key 找纸箱。
 * @param {object[]} containers - 纸箱数组。
 * @param {string} key - 纸箱 key。
 * @returns {object} 纸箱。
 */
function containerOf(containers, key) {
  const found = containers.find((container) => container.key === key);
  assert.ok(found !== undefined, `纸箱 ${key} 不见了`);
  return found;
}

test('本机清单：配置里有 id 就用配置里的，没写的纸箱保持仓库占位', () => {
  const root = tempRoot({
    config: { 清单: { execution: fakeId(2), waiting: fakeId(1) } },
  });
  const containers = readContainers({ root });
  assert.equal(containerOf(containers, 'execution').projectId, fakeId(2));
  assert.equal(containerOf(containers, 'waiting').projectId, fakeId(1));
  // 没配的纸箱：仓库里的虚构占位原样留着。
  const placeholder = containerOf(CONTAINERS, 'project');
  assert.equal(containerOf(containers, 'project').projectId, placeholder.projectId);
  // 纸箱的其余字段（key / 名字 / 滴答清单名）不受配置影响。
  assert.equal(containerOf(containers, 'execution').key, 'execution');
  assert.equal(containerOf(containers, 'execution').name, '执行');
  assert.equal(containerOf(containers, 'execution').listName, '执行清单');
});

test('本机清单：没有配置文件时全部保持仓库占位', () => {
  const root = tempRoot();
  const containers = readContainers({ root });
  assert.deepEqual(
    containers.map((container) => container.projectId),
    CONTAINERS.map((container) => container.projectId),
  );
});

test('本机清单：没有「清单」字段时全部保持仓库占位', () => {
  const root = tempRoot({ config: { 记录目录: 'my-records' } });
  const containers = readContainers({ root });
  assert.deepEqual(
    containers.map((container) => container.projectId),
    CONTAINERS.map((container) => container.projectId),
  );
});

test('本机清单：配置读不到（目录不存在）时不抛，全部保持仓库占位', () => {
  const missing = path.join(tempRoot(), 'no-such-dir');
  const containers = readContainers({ root: missing });
  assert.deepEqual(
    containers.map((container) => container.projectId),
    CONTAINERS.map((container) => container.projectId),
  );
});

test('本机清单：文件不是合法 JSON 时不抛，全部保持仓库占位', () => {
  const root = tempRoot({ raw: '{ not json' });
  const containers = readContainers({ root });
  assert.deepEqual(
    containers.map((container) => container.projectId),
    CONTAINERS.map((container) => container.projectId),
  );
});

test('本机清单：「清单」不是对象时全部保持仓库占位', () => {
  for (const bad of ['字符串', 42, true, ['数组'], null]) {
    const root = tempRoot({ config: { 清单: bad } });
    const containers = readContainers({ root });
    assert.deepEqual(
      containers.map((container) => container.projectId),
      CONTAINERS.map((container) => container.projectId),
      `「清单」是 ${JSON.stringify(bad)} 时不该改纸箱`,
    );
  }
});

test('本机清单：某个值不是非空字符串时，那一个纸箱退回占位，其他照用', () => {
  for (const bad of [42, '', '   ', null, undefined, {}, ['id']]) {
    const root = tempRoot({
      config: { 清单: { execution: bad, waiting: fakeId(1) } },
    });
    const containers = readContainers({ root });
    assert.equal(
      containerOf(containers, 'execution').projectId,
      containerOf(CONTAINERS, 'execution').projectId,
      `值是 ${JSON.stringify(bad)} 时不该改执行清单`,
    );
    assert.equal(containerOf(containers, 'waiting').projectId, fakeId(1));
  }
});

test('本机清单：不认识的 key 被忽略，不会多出纸箱', () => {
  const root = tempRoot({ config: { 清单: { 不存在的纸箱: fakeId(9) } } });
  const containers = readContainers({ root });
  assert.equal(containers.length, CONTAINERS.length);
  assert.deepEqual(
    containers.map((container) => container.key),
    CONTAINERS.map((container) => container.key),
  );
});

test('本机清单：每次都重读——改完文件刷新就生效，不缓存', () => {
  const root = tempRoot({ config: { 清单: { execution: fakeId(2) } } });
  assert.equal(containerOf(readContainers({ root }), 'execution').projectId, fakeId(2));
  writeFileSync(
    path.join(root, 'local-config.json'),
    JSON.stringify({ 清单: { execution: fakeId(7) } }),
    'utf8',
  );
  assert.equal(containerOf(readContainers({ root }), 'execution').projectId, fakeId(7));
});

test('本机清单：读回来的是副本——改动它不会污染仓库里的纸箱', () => {
  const root = tempRoot({ config: { 清单: { execution: fakeId(2) } } });
  const containers = readContainers({ root });
  containers[0].projectId = '改坏了';
  containers.push({ key: '多一个', name: '多一个', listName: '多一个', projectId: fakeId(9) });
  assert.notEqual(containerOf(CONTAINERS, 'inbox').projectId, '改坏了');
  assert.equal(CONTAINERS.length, 6);
});
