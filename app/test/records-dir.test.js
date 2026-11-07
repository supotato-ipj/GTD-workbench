/**
 * 记录页目录的解析（纯逻辑，只碰文件系统的存在性，不写任何文件）。
 *
 * 这一层回答一个问题：**工作台该读哪一册记录页**。
 * 仓库自带一本虚构样本（`records/`），本机可以把指针指到别处——
 * 真实记录页留在本地，只用一处配置指过来，仓库里不出现任何个人记录。
 *
 * 优先级（硬的，从高到低）：
 * 1. 环境变量 `GTD_RECORDS_DIR`（绝对路径）；
 * 2. 仓库根的 `local-config.json` 里的 `记录目录` 字段（相对路径按仓库根解）；
 * 3. 默认：仓库根的 `records/`。
 *
 * 断言的是**外部可观察行为**：解析出来的目录是不是指对了地方、
 * 读到的记录是不是按 ①–⑨ 排好、缺目录时是不是安静地返回空数组。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { REPO_ROOT, RECORDS_DIR, resolveRecordsDir, loadRecords } from '../lib/records.js';

/**
 * 造一个临时「仓库根」。
 * @param {object} [options] - 选项。
 * @param {object} [options.config] - 要写进 `local-config.json` 的内容。
 * @returns {string} 临时目录的绝对路径。
 */
function tempRoot({ config } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gtd-records-'));
  if (config !== undefined) {
    writeFileSync(path.join(root, 'local-config.json'), JSON.stringify(config), 'utf8');
  }
  return root;
}

/**
 * 造一册记录页。
 * @param {string} dir - 目录（绝对路径）。
 * @param {string} fileName - 文件名（`NN-slug.md`）。
 * @param {string} title - 页内一级标题。
 * @returns {void}
 */
function writePage(dir, fileName, title) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, fileName),
    `# ${title}\n\n## 为什么这么定\n\n这是示例正文。\n\n## 卡点\n\n这是示例卡点。\n`,
    'utf8',
  );
}

test('记录目录：没有覆盖时用仓库根的 records/', () => {
  const root = tempRoot();
  assert.equal(resolveRecordsDir({ env: {}, root }), path.join(root, RECORDS_DIR));
});

test('记录目录：环境变量 GTD_RECORDS_DIR 优先于 local-config.json', () => {
  const root = tempRoot({ config: { 记录目录: 'from-config' } });
  const fromEnv = path.join(root, 'from-env');
  assert.equal(
    resolveRecordsDir({ env: { GTD_RECORDS_DIR: fromEnv }, root }),
    fromEnv,
  );
});

test('记录目录：local-config.json 的「记录目录」字段在没有环境变量时生效', () => {
  const root = tempRoot({ config: { 记录目录: 'my-records' } });
  assert.equal(resolveRecordsDir({ env: {}, root }), path.join(root, 'my-records'));
});

test('记录目录：local-config.json 里的绝对路径原样用', () => {
  const root = tempRoot();
  const absolute = path.join(root, 'elsewhere');
  const withConfig = tempRoot({ config: { 记录目录: absolute } });
  assert.equal(resolveRecordsDir({ env: {}, root: withConfig }), absolute);
});

test('记录目录：local-config.json 坏了或没有该字段时退回默认', () => {
  const broken = tempRoot();
  writeFileSync(path.join(broken, 'local-config.json'), '{ not json', 'utf8');
  assert.equal(resolveRecordsDir({ env: {}, root: broken }), path.join(broken, RECORDS_DIR));

  const noField = tempRoot({ config: { 别的字段: 'x' } });
  assert.equal(resolveRecordsDir({ env: {}, root: noField }), path.join(noField, RECORDS_DIR));
});

test('记录目录：空的覆盖值当没有覆盖', () => {
  const root = tempRoot({ config: { 记录目录: '   ' } });
  assert.equal(resolveRecordsDir({ env: { GTD_RECORDS_DIR: '  ' }, root }), path.join(root, RECORDS_DIR));
});

test('记录读取：读一册按 NN-*.md 排好的记录页，编号 ①–⑨ 从小到大', () => {
  const root = tempRoot();
  const dir = path.join(root, 'records');
  writePage(dir, '09-ninth.md', '⑨ 第九页');
  writePage(dir, '01-first.md', '① 第一页');
  writePage(dir, '05-fifth.md', '⑤ 第五页');
  writePage(dir, 'not-a-record.md', '无关文件');

  const records = loadRecords({ dir });
  assert.deepEqual(records.map((record) => record.number), ['①', '⑤', '⑨']);
  assert.equal(records[0].title, '① 第一页');
});

test('记录读取：来源路径在仓库内是相对路径，在仓库外是绝对路径', () => {
  // 仓库自带的那一册：来源写仓库相对路径，短、能照着去找。
  const inside = loadRecords({ dir: path.join(REPO_ROOT, RECORDS_DIR) });
  assert.equal(inside.length, 9);
  assert.match(inside[0].source, new RegExp(`^${RECORDS_DIR}/\\d{2}-.+\\.md$`));

  // 仓库外的那一册（本机自己那册真实记录）：来源写绝对路径——指针指向哪儿，就得写到哪儿。
  const outside = mkdtempSync(path.join(os.tmpdir(), 'gtd-outside-'));
  writePage(outside, '01-first.md', '① 第一页');
  const outsideRecords = loadRecords({ dir: outside });
  assert.equal(outsideRecords[0].source, path.join(outside, '01-first.md').split(path.sep).join('/'));
});

test('记录读取：目录不存在时安静地返回空数组，不抛', () => {
  assert.deepEqual(loadRecords({ dir: path.join(tempRoot(), 'no-such-dir') }), []);
});

test('记录读取：仓库自带的样本有九页，且解析出为什么与卡点', () => {
  const records = loadRecords({ dir: path.join(REPO_ROOT, RECORDS_DIR) });
  assert.equal(records.length, 9);
  assert.deepEqual(
    records.map((record) => record.number),
    ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'],
  );
  for (const record of records) {
    assert.equal(typeof record.title, 'string');
    assert.notEqual(record.title, '');
    assert.ok(record.why === null || typeof record.why === 'string');
    assert.ok(record.acceptance === null || typeof record.acceptance === 'string');
    assert.ok(record.blocker === null || typeof record.blocker === 'string');
  }
  // 「为什么」与「卡点」这两段每页都有——它们是抽屉里最常被读的两段。
  assert.ok(records.every((record) => record.why !== null));
  assert.ok(records.every((record) => record.blocker !== null));
  // ① 故意不写「验收标准」：缺项必须解析成 null，而不是编一段出来。
  assert.equal(records[0].acceptance, null);
});
