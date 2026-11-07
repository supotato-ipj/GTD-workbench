/**
 * 跑滴答 CLI 用哪个 Node（`nodeBinary`）与它在 PATH 里的查找（`findOnPath`）。
 *
 * 这条守的是一个真踩到的坑：DSH 桌面版是 Electron，`process.execPath` 指向
 * `DeepSeek Harness.exe` 而不是 node。拿它去跑 CLI，dida 的 commander 看到
 * `process.versions.electron` 就把 argv 多切一位，于是报
 * `error: unknown command '<入口路径>'`，画布上表现为「取数失败」。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { DidaError, findOnPath, nodeBinary, runDidaTaskFilter } from '../lib/dida.js';

/**
 * 造一个装着假 `node` 的临时目录，并把它设成 PATH。
 * @returns {{ dir: string, restore: () => void }} 目录与还原函数。
 */
function fakePathDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'gtd-node-'));
  const name = process.platform === 'win32' ? 'node.exe' : 'node';
  writeFileSync(path.join(dir, name), '');
  const previous = process.env.PATH;
  process.env.PATH = dir;
  return {
    dir,
    restore() {
      if (previous === undefined) delete process.env.PATH;
      else process.env.PATH = previous;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * 临时改一个环境变量并在结束时还原。
 * @param {string} name - 变量名。
 * @param {string | undefined} value - 新值；undefined 表示删掉。
 * @returns {() => void} 还原函数。
 */
function withEnv(name, value) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  };
}

test('Node 解析：PATH 里能找到 node 就返回它的绝对路径', () => {
  const fake = fakePathDir();
  try {
    const found = findOnPath(['node.exe', 'node']);
    assert.ok(found !== null, 'PATH 里有 node 却没找到');
    assert.equal(path.dirname(found), fake.dir);
  } finally {
    fake.restore();
  }
});

test('Node 解析：PATH 里没有就返回 null，不抛', () => {
  const fake = fakePathDir();
  try {
    assert.equal(findOnPath(['完全不存在的可执行文件']), null);
  } finally {
    fake.restore();
  }
});

test('Node 解析：GTD_NODE_BIN 优先，且只认真实存在的路径', () => {
  const fake = fakePathDir();
  const fakeNode = path.join(fake.dir, process.platform === 'win32' ? 'node.exe' : 'node');
  const restore = withEnv('GTD_NODE_BIN', fakeNode);
  try {
    assert.equal(nodeBinary(), fakeNode);
  } finally {
    restore();
    fake.restore();
  }
  // 指到一个不存在的地方就当没设，不能把 CLI 带沟里。
  const restoreBad = withEnv('GTD_NODE_BIN', path.join(tmpdir(), '绝对不存在的-node'));
  try {
    assert.notEqual(nodeBinary(), path.join(tmpdir(), '绝对不存在的-node'));
  } finally {
    restoreBad();
  }
});

test('Node 解析：不在 Electron 里就用 process.execPath', () => {
  // 测试进程是普通 node，`process.versions.electron` 不存在——这正是「不经 Electron 跑」那一支。
  assert.equal(process.versions.electron, undefined);
  const restore = withEnv('GTD_NODE_BIN', undefined);
  try {
    assert.equal(nodeBinary(), process.execPath);
  } finally {
    restore();
  }
});

test('Node 解析：跑 CLI 的 Node 找不到时给明确的失败原因，不是空板', async () => {
  await assert.rejects(
    () => runDidaTaskFilter({ projectId: 'inbox9000000001', status: 0, node: path.join(tmpdir(), 'no-node-here.exe') }),
    (error) => {
      assert.ok(error instanceof DidaError);
      assert.equal(error.code, 'cli-unavailable');
      assert.match(error.message, /GTD_NODE_BIN/);
      return true;
    },
  );
});
