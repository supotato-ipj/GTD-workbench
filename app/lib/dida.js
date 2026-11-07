/**
 * 调滴答 CLI。
 *
 * 三条硬约束（ADR-0008，都是实测出来的）：
 * 1. **不能用 `dida` 这个名字直接 spawn**——它是 npm 的 `.cmd` shim，Node 的 spawn 不带
 *    `shell:true` 解析不了。必须用 `process.execPath` + 真实入口文件。
 * 2. **`dida task search` 恒返回空数组**——取数一律用 `dida task filter --projects <完整 24 位 id>`。
 * 3. **未登录不能画空板**——CLI 会报错，工作台必须把「未登录」和「别的失败」分开说。
 *
 * 这个模块只跑**读**命令。工作台是只读视图（ADR-0006），不写滴答。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 滴答 CLI 的真实入口（npm 全局包里的 dist/index.js）。
 *
 * 从**用户主目录**推出来，而不是把某台机器上的账号名写死——
 * 仓库是公开的，路径里不该出现任何人的登录名；换台机器它照样指对。
 * 装在别处时用 `GTD_DIDA_ENTRY` 覆盖（见 {@link didaEntry}）。
 */
export const DEFAULT_DIDA_ENTRY = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'npm',
  'node_modules',
  '@suibiji',
  'dida-cli',
  'dist',
  'index.js',
);

/** 允许跑的读命令；写命令一律不拼进 argv。 */
const READ_ONLY_COMMANDS = new Set(['task filter', 'task completed']);

/**
 * 滴答调用失败。`code` 区分「未登录」与「别的失败」，两种原因在看板上必须说得不一样。
 */
export class DidaError extends Error {
  /**
   * @param {'not-authenticated' | 'cli-unavailable' | 'cli-failed'} code - 失败类别。
   * @param {string} message - 人能读的失败原因。
   */
  constructor(code, message) {
    super(message);
    this.name = 'DidaError';
    this.code = code;
  }
}

/**
 * 真实入口路径：环境变量优先，其次默认路径。
 * @returns {string} 入口文件路径。
 */
export function didaEntry() {
  const override = process.env.GTD_DIDA_ENTRY;
  return typeof override === 'string' && override.length > 0 ? override : DEFAULT_DIDA_ENTRY;
}

/**
 * 在 PATH 里找一个可执行文件。
 * @param {string[]} names - 候选文件名，按顺序试。
 * @returns {string | null} 找到的绝对路径；找不到为 null。
 */
export function findOnPath(names) {
  const dirs = String(process.env.PATH ?? process.env.Path ?? '')
    .split(path.delimiter)
    .filter((dir) => dir.length > 0);
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (existsSync(candidate)) return candidate;
      } catch {
        /* 某个目录读不动就跳过 */
      }
    }
  }
  return null;
}

/**
 * 跑滴答 CLI 用的 Node 可执行文件。
 *
 * **不能用 `process.execPath`。** DSH 桌面版是 Electron，`process.execPath` 指向
 * `DeepSeek Harness.exe`——那不是 node。用它去跑 CLI 时，dida 的 commander 看到
 * `process.versions.electron` 存在，会把 argv 多切一位，于是 `task` 被当成参数、
 * 入口路径被当成命令名，报：
 *
 * ```
 * error: unknown command 'C:\...\dida-cli\dist\index.js'
 * ```
 *
 * 所以：有 `GTD_NODE_BIN` 就用它；跑在 Electron 里就回退到 PATH 上的真 `node`；
 * 都不是（例如 `dsh web` 直接跑在 node 上）才用 `process.execPath`。
 * @returns {string} Node 可执行文件路径。
 */
export function nodeBinary() {
  const override = process.env.GTD_NODE_BIN;
  if (typeof override === 'string' && override.length > 0 && existsSync(override)) return override;
  const electronVersion = process.versions === undefined ? undefined : process.versions.electron;
  if (typeof electronVersion === 'string' && electronVersion.length > 0) {
    const found = findOnPath(process.platform === 'win32' ? ['node.exe', 'node'] : ['node', 'node.exe']);
    if (found !== null) return found;
  }
  return process.execPath;
}

/**
 * 把 CLI 的 stderr 归类。
 *
 * - 未登录：CLI 抛 `未找到 access token。请先运行 dida auth login 登录。`
 * - token 失效：API 层报 `DIDA API 错误 401: …`
 * @param {string} stderr - CLI 的 stderr。
 * @returns {'not-authenticated' | 'cli-failed'} 失败类别。
 */
export function classifyDidaFailure(stderr) {
  const text = String(stderr ?? '');
  if (text.includes('未找到 access token')) return 'not-authenticated';
  if (text.includes('DIDA API 错误 401')) return 'not-authenticated';
  if (/\b401\b/.test(text)) return 'not-authenticated';
  return 'cli-failed';
}

/**
 * 用 Node 自己跑 CLI 入口，收集 stdout／stderr。
 * @param {string[]} argv - 传给 CLI 的参数。
 * @param {object} options - 运行选项。
 * @param {string} options.entry - CLI 入口文件。
 * @param {string} options.node - 跑 CLI 的 Node 可执行文件（见 {@link nodeBinary}）。
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>} 运行结果。
 */
function runNode(node, entry, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(node, [entry, ...argv], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => reject(new DidaError('cli-unavailable', `启动滴答 CLI 失败：${error.message}`)));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

/**
 * 拼一条**只读**命令的 argv。
 *
 * 只读是硬护栏（ADR-0006）：工作台不写滴答。写命令拼不进来。
 * @param {string} command - 命令名，例如 `'task filter'`。
 * @param {object} [options] - 参数。
 * @param {string | string[]} [options.projectId] - 清单的完整 24 位 id；数组会按逗号拼成一条
 *   （`dida task completed --projects` 接受多个 id，返回混在一起的扁平数组）。
 * @param {string} [options.startDate] - 起始日期（`task filter` 用 `YYYY-MM-DD`，
 *   `task completed` 用 `YYYY-MM-DDTHH:mm:ssZ`）。
 * @param {string} [options.endDate] - 结束日期，格式同上。
 * @param {number} [options.status] - 状态过滤（-1 已放弃／0 未完成／2 已完成）。
 * @returns {string[]} argv。
 */
export function buildDidaArgs(command, { projectId, startDate, endDate, status } = {}) {
  if (!READ_ONLY_COMMANDS.has(command)) {
    throw new DidaError('cli-failed', `拒绝执行非只读命令：${command}`);
  }
  const argv = command.split(' ');
  if (projectId !== undefined) {
    const ids = Array.isArray(projectId) ? projectId : [projectId];
    if (ids.length > 0) argv.push('--projects', ids.join(','));
  }
  // 状态过滤是**必须**的：不带 `--status` 时单次返回上限 200 条会被撞满，
  // 分容器调用也救不回来（实测收集箱与日历都会撞满 200 条）。拉未完成一律带 `--status 0`。
  if (status !== undefined) argv.push('--status', String(status));
  if (startDate !== undefined) argv.push('--start-date', startDate);
  if (endDate !== undefined) argv.push('--end-date', endDate);
  argv.push('--json');
  return argv;
}

/**
 * 取一个清单下的动作。
 *
 * `dida task filter --projects <id> --json` 返回该清单的任务数组；
 * `dida task search` 恒返回空数组，不要用（ADR-0008）。
 * @param {object} options - 调用选项。
 * @param {string} options.projectId - 清单的**完整 24 位 id**。
 * @param {number} [options.status] - 状态过滤；拉未完成传 `0`（单次 200 条上限）。
 * @param {string} [options.entry] - CLI 入口文件，默认取本机真实入口。
 * @param {string} [options.node] - 跑 CLI 的 Node 可执行文件，默认按 {@link nodeBinary} 解析。
 * @returns {Promise<object[]>} 滴答原始任务数组。
 */
export async function runDidaTaskFilter({ projectId, status, entry = didaEntry(), node = nodeBinary() }) {
  return runReadCommand({ command: 'task filter', projectId, status, entry, node });
}

/**
 * 取一个日期区间内的已完成条目（已沉底区用）。
 *
 * 走的是另一条命令，**不与未完成混在一次调用里**：`task completed` 按 `completedTime` 区间取，
 * 返回的是跨清单混在一起的扁平数组，靠每条的 `projectId` 归箱。
 * 日期格式是 `yyyy-MM-ddTHH:mm:ssZ`，与 `task filter` 的 `yyyy-MM-dd` 不同。
 * @param {object} options - 调用选项。
 * @param {string | string[]} options.projectId - 一个或多个清单的完整 24 位 id。
 * @param {string} options.startDate - 区间起点（`yyyy-MM-ddTHH:mm:ssZ`）。
 * @param {string} options.endDate - 区间终点（`yyyy-MM-ddTHH:mm:ssZ`）。
 * @param {string} [options.entry] - CLI 入口文件，默认取本机真实入口。
 * @param {string} [options.node] - 跑 CLI 的 Node 可执行文件，默认按 {@link nodeBinary} 解析。
 * @returns {Promise<object[]>} 滴答原始任务数组（已完成）。
 */
export async function runDidaTaskCompleted({ projectId, startDate, endDate, entry = didaEntry(), node = nodeBinary() }) {
  if (startDate === undefined || endDate === undefined) {
    throw new DidaError('cli-failed', '取已完成条目必须给日期区间：不带区间会撞上单次 200 条上限');
  }
  return runReadCommand({ command: 'task completed', projectId, startDate, endDate, entry, node });
}

/**
 * 跑一条只读命令并解析 JSON。
 * @param {object} options - 选项。
 * @param {string} options.command - 只读命令名。
 * @param {string | string[]} [options.projectId] - 清单 id。
 * @param {string} [options.startDate] - 起始日期。
 * @param {string} [options.endDate] - 结束日期。
 * @param {number} [options.status] - 状态过滤。
 * @param {string} options.entry - CLI 入口文件。
 * @param {string} options.node - 跑 CLI 的 Node 可执行文件。
 * @returns {Promise<object[]>} 原始任务数组。
 */
async function runReadCommand({ command, projectId, startDate, endDate, status, entry, node }) {
  if (!existsSync(entry)) {
    throw new DidaError('cli-unavailable', `找不到滴答 CLI 入口：${entry}（用 GTD_DIDA_ENTRY 指定）`);
  }
  if (!existsSync(node)) {
    throw new DidaError('cli-unavailable', `找不到跑滴答 CLI 的 Node：${node}（用 GTD_NODE_BIN 指定）`);
  }
  const argv = buildDidaArgs(command, { projectId, startDate, endDate, status });
  const { code, stdout, stderr } = await runNode(node, entry, argv);
  if (code !== 0) {
    const detail = stderr.trim() || stdout.trim() || `dida 退出码 ${code}`;
    throw new DidaError(classifyDidaFailure(stderr), detail);
  }
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new DidaError('cli-failed', '滴答 CLI 输出不是合法 JSON');
  }
}
