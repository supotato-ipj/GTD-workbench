/**
 * 本地私有配置（`local-config.json`）：只读，不写、不进仓库。
 *
 * 这个文件是**本机指针**：它告诉插件「我的真实记录页在哪儿」，
 * 但它自己被 `.gitignore` 挡掉，永远不进版本库——仓库里只留**虚构的默认值**。
 *
 * 字段（都可以省掉，省掉就用默认）：
 * - `记录目录`：记录页（markdown issue 页）所在目录。相对路径按**仓库根**解，
 *   绝对路径原样用。
 *
 * 读不到、不是合法 JSON、不是对象——都当没有这份配置，走默认值，不抛。
 * 本地配置是可选的，缺它不该让工作台起不来。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 仓库根：本文件在 `<repo>/app/lib/config.js`，往上两级。 */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/** 本地配置文件名（在仓库根，被 `.gitignore` 挡掉，不进版本库）。 */
export const LOCAL_CONFIG_FILE = 'local-config.json';

/**
 * 读本地配置。
 * @param {object} [options] - 选项。
 * @param {string} [options.root] - 仓库根（默认本仓库根）。
 * @returns {object} 配置对象；没有或读不了时是空对象。
 */
export function readLocalConfig({ root = REPO_ROOT } = {}) {
  try {
    const parsed = JSON.parse(readFileSync(path.join(root, LOCAL_CONFIG_FILE), 'utf8'));
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * 从配置里取一个非空字符串字段。
 * @param {object} config - 配置对象。
 * @param {string} key - 字段名。
 * @returns {string | null} 字段值；没有或不是非空字符串时为 null。
 */
export function stringField(config, key) {
  const value = config !== null && typeof config === 'object' ? config[key] : undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
