/**
 * 读仓库里的记录页，解析成工作台抽屉要的记录（Host 半边）。
 *
 * 只在 Host 半边跑：Client 那半边在浏览器里，读不到本地文件（ADR-0008 的通路分工）。
 * **只读**：这里没有任何写文件的路径——markdown 侧只读（ADR-0003／ADR-0006）。
 *
 * 目录读不到就返回空数组——工作台照常画，只是抽屉里显示「无对应记录」，
 * 不因为一份文档缺失就把整块板子打掉。
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { numberOf, parseRecord } from './markdown.js';

/** 仓库根：本文件在 `<repo>/app/lib/records.js`，往上两级。 */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/** 默认记录页目录（相对仓库根）。仓库自带的是**虚构样本**。 */
export const RECORDS_DIR = 'records';

/** 文件名形如 `06-bumen-zhize.md`。 */
const RECORD_FILE_PATTERN = /^(\d{2})-(.+)\.md$/;

/**
 * 读一页 issue 并解析成记录。
 * @param {object} options - 选项。
 * @param {string} options.dir - 目录（绝对路径）。
 * @param {string} options.fileName - 文件名。
 * @returns {object | null} 记录；文件名不是 `NN-*.md` 时为 null。
 */
function recordOfFile({ dir, fileName }) {
  const matched = RECORD_FILE_PATTERN.exec(fileName);
  if (matched === null) return null;
  const number = numberOf(matched[1]);
  if (number === null) return null;
  let text;
  try {
    text = readFileSync(path.join(dir, fileName), 'utf8');
  } catch {
    return null;
  }
  return parseRecord({
    text,
    number,
    source: path.join(RECORDS_DIR, fileName).split(path.sep).join('/'),
  });
}

/**
 * 读全部记录。
 *
 * 目录不存在或读不动就返回空数组——工作台照常画，只是抽屉里显示「无对应记录」，
 * 不因为 markdown 侧缺文件就把整块板子打掉。
 * @param {object} [options] - 选项。
 * @param {string} [options.dir] - 记录页目录（绝对路径），默认仓库里那一份。
 * @returns {object[]} 记录，按编号顺序。
 */
export function loadRecords({ dir = path.join(REPO_ROOT, RECORDS_DIR) } = {}) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const records = [];
  for (const fileName of names) {
    const record = recordOfFile({ dir, fileName });
    if (record !== null) records.push(record);
  }
  // 编号顺序是 ①–⑨，编号字符的先后就是它。
  records.sort((left, right) => (left.number < right.number ? -1 : left.number > right.number ? 1 : 0));
  return records;
}
