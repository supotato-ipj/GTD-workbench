/**
 * 读仓库里的记录页，解析成工作台抽屉要的记录（Host 半边）。
 *
 * 只在 Host 半边跑：Client 那半边在浏览器里，读不到本地文件（ADR-0008 的通路分工）。
 * **只读**：这里没有任何写文件的路径——markdown 侧只读（ADR-0003／ADR-0006）。
 *
 * ## 记录页目录从哪儿来
 *
 * 仓库自带一册**虚构样本**（`<repo>/records/`），开箱即用、公开可看。
 * 真实记录页留在本地，只用一处指针指过来，仓库里不出现任何个人记录：
 *
 * 1. 环境变量 `GTD_RECORDS_DIR`（绝对路径）——最高优先级，临时换册最方便；
 * 2. 仓库根的 `local-config.json` 里的 `记录目录` 字段——该文件被 `.gitignore` 挡掉；
 * 3. 默认：仓库根的 `records/`。
 *
 * 指针指错了也不要紧：目录读不到就返回空数组，工作台照常画画布，
 * 抽屉里显示「无对应记录」——**不因为一份文档缺失就把整块板子打掉**。
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, readLocalConfig, stringField } from './config.js';
import { numberOf, parseRecord } from './markdown.js';

/** 仓库根：本文件在 `<repo>/app/lib/records.js`，往上两级。 */
export { REPO_ROOT };

/** 默认记录页目录（相对仓库根）。仓库自带的是**虚构样本**。 */
export const RECORDS_DIR = 'records';

/** 环境变量名：记录页目录（绝对路径），优先级最高。 */
export const RECORDS_DIR_ENV = 'GTD_RECORDS_DIR';

/** 本地配置文件里指向记录页目录的字段名。 */
export const LOCAL_CONFIG_KEY = '记录目录';

/** 文件名形如 `06-<slug>.md`。 */
const RECORD_FILE_PATTERN = /^(\d{2})-(.+)\.md$/;

/**
 * 算出这一轮该读哪一册记录页。
 *
 * 优先级是硬的：环境变量 > `local-config.json` > 仓库自带的样本。
 * 相对路径一律按**仓库根**解——这样 `local-config.json` 里写 `records` 与写绝对路径等价。
 * @param {object} [options] - 选项。
 * @param {object} [options.env] - 环境变量来源（默认 `process.env`）。
 * @param {string} [options.root] - 仓库根（默认本仓库根）。
 * @returns {string} 记录页目录的绝对路径。
 */
export function resolveRecordsDir({ env = process.env, root = REPO_ROOT } = {}) {
  const fromEnv = stringField(env, RECORDS_DIR_ENV);
  if (fromEnv !== null) {
    return path.resolve(fromEnv);
  }
  const fromConfig = stringField(readLocalConfig({ root }), LOCAL_CONFIG_KEY);
  if (fromConfig !== null) {
    return path.resolve(root, fromConfig);
  }
  return path.join(root, RECORDS_DIR);
}

/**
 * 给人看的来源路径。
 *
 * 目录在仓库内就写仓库相对路径（短、能照着去找）；在仓库外就写绝对路径——
 * 那正是「我自己那册记录」的指针指向的地方，写全了才找得到。
 * @param {string} dir - 记录页目录（绝对路径）。
 * @param {string} fileName - 文件名。
 * @returns {string} 来源路径（一律用 `/` 分隔）。
 */
function sourceOf(dir, fileName) {
  const absolute = path.join(dir, fileName);
  const relative = path.relative(REPO_ROOT, absolute);
  if (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  return absolute.split(path.sep).join('/');
}

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
    source: sourceOf(dir, fileName),
  });
}

/**
 * 读全部记录。
 *
 * 目录不存在或读不动就返回空数组——工作台照常画，只是抽屉里显示「无对应记录」，
 * 不因为 markdown 侧缺文件就把整块板子打掉。
 * @param {object} [options] - 选项。
 * @param {string} [options.dir] - 记录页目录（绝对路径），默认按 {@link resolveRecordsDir} 解析。
 * @returns {object[]} 记录，按编号顺序。
 */
export function loadRecords({ dir = resolveRecordsDir() } = {}) {
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
