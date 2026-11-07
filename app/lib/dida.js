/**
 * 调滴答 CLI。
 *
 * 三条硬约束（ADR-0008，都是实测出来的）：
 * 1. **不能用 `dida` 这个名字直接 spawn**——它是 npm 的 `.cmd` shim，Node 的 spawn 不带
 *    `shell:true` 解析不了。必须用 `process.execPath` + 真实入口文件。
 * 2. **`dida task search` 恒返回空数组**——取数一律用 `dida task filter --projects <完整 24 位 id>`。
 * 3. **未登录不能画空板**——CLI 会报错，工作台必须把「未登录」和「别的失败」分开说。
 *
 * 这个模块跑**读**命令，外加**一个**写命令：`task complete`（完成，ADR-0006 的修订）。
 * 其余写命令（新建、删除、改期……）一律拼不进 argv——工作台只开「完成」这一个写口。
 *
 * 每条命令都有**超时**：CLI 卡住就把路由挂住，客户端只会一直转圈。
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

/**
 * 允许跑的**命令集合**（显式允许，不是「只读白名单」）。
 *
 * 读命令照旧两条；写口只开**一个**：`task complete`（完成）。
 * 「改期」那条命令留给 issue #10，届时往这个集合里加一条即可。
 * 其余写命令（新建、删除、改期……）一律拼不进 argv。
 */
export const ALLOWED_COMMANDS = new Set(['task filter', 'task completed', 'task complete']);

/** 读命令（只取数，不改滴答）。 */
export const READ_COMMANDS = new Set(['task filter', 'task completed']);

/** 默认超时：一分钟之内 CLI 还没回来，就当它卡住了。 */
export const DEFAULT_DIDA_TIMEOUT_MS = 30000;

/**
 * 滴答调用失败。`code` 区分「未登录」与「别的失败」，两种原因在看板上必须说得不一样。
 */
export class DidaError extends Error {
  /**
   * @param {'not-authenticated' | 'cli-unavailable' | 'cli-failed' | 'invalid-argument'} code - 失败类别。
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
 * 跑一次 CLI 最多等多久。
 *
 * 可配置：环境变量 `GTD_DIDA_TIMEOUT_MS`（毫秒）；没设或设得不合法就用默认值。
 * @returns {number} 超时毫秒数。
 */
export function didaTimeoutMs() {
  const raw = Number.parseInt(String(process.env.GTD_DIDA_TIMEOUT_MS ?? ''), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DIDA_TIMEOUT_MS;
}

/**
 * 用 Node 自己跑 CLI 入口，收集 stdout／stderr。
 *
 * **带超时**：CLI 卡住（网络挂起、登录态弹窗等待……）时把子进程杀掉，按失败收场，
 * 不让路由一直挂着。超时算 `cli-failed`——与读方向的失败语义同一套。
 * @param {string} node - 跑 CLI 的 Node 可执行文件。
 * @param {string} entry - CLI 入口文件。
 * @param {string[]} argv - 传给 CLI 的参数。
 * @param {number} [timeoutMs] - 超时毫秒数，默认见 {@link didaTimeoutMs}。
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>} 运行结果。
 */
function runNode(node, entry, argv, timeoutMs = didaTimeoutMs()) {
  return new Promise((resolve, reject) => {
    const child = spawn(node, [entry, ...argv], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {
        /* 杀不掉就让它去，失败照样报 */
      }
      reject(new DidaError('cli-failed', `滴答 CLI 超时（${timeoutMs} 毫秒）没有返回`));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new DidaError('cli-unavailable', `启动滴答 CLI 失败：${error.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

/**
 * 拼一条命令的 argv——**全仓库唯一拼 argv 的地方**。
 *
 * 允许集合是显式的（{@link ALLOWED_COMMANDS}）：读命令照旧，写口只开「完成」。
 * 其余写命令拼不进来。
 * @param {string} command - 命令名，例如 `'task filter'`、`'task complete'`。
 * @param {object} [options] - 参数。
 * @param {string | string[]} [options.projectId] - 清单的完整 24 位 id；数组会按逗号拼成一条
 *   （`dida task completed --projects` 接受多个 id，返回混在一起的扁平数组）。
 * @param {string} [options.taskId] - 动作 id（只有 `task complete` 用）。
 * @param {string} [options.startDate] - 起始日期（`task filter` 用 `YYYY-MM-DD`，
 *   `task completed` 用 `YYYY-MM-DDTHH:mm:ssZ`）。
 * @param {string} [options.endDate] - 结束日期，格式同上。
 * @param {number} [options.status] - 状态过滤（-1 已放弃／0 未完成／2 已完成）。
 * @returns {string[]} argv。
 */
export function buildDidaArgs(command, { projectId, taskId, startDate, endDate, status } = {}) {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new DidaError('cli-failed', `拒绝执行不在允许集合里的命令：${command}（工作台只允许读命令与「完成」这一个写口）`);
  }
  // 「完成」是位置参数：`dida task complete <清单 id> <动作 id>`。
  if (command === 'task complete') {
    const list = typeof projectId === 'string' ? projectId.trim() : '';
    const target = typeof taskId === 'string' ? taskId.trim() : '';
    if (list.length === 0 || target.length === 0) {
      throw new DidaError('invalid-argument', '完成动作需要清单 id 与动作 id');
    }
    return ['task', 'complete', list, target];
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
export async function runDidaTaskFilter({ projectId, status, entry = didaEntry(), node = nodeBinary(), timeoutMs }) {
  return runReadCommand({ command: 'task filter', projectId, status, entry, node, timeoutMs });
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
export async function runDidaTaskCompleted({ projectId, startDate, endDate, entry = didaEntry(), node = nodeBinary(), timeoutMs }) {
  if (startDate === undefined || endDate === undefined) {
    throw new DidaError('cli-failed', '取已完成条目必须给日期区间：不带区间会撞上单次 200 条上限');
  }
  return runReadCommand({ command: 'task completed', projectId, startDate, endDate, entry, node, timeoutMs });
}

/**
 * 完成一条动作（写口）。
 *
 * `dida task complete <清单 id> <动作 id>`：完成 = 滴答勾选（`status=2`），单口径，
 * 不建核销台账（ADR-0006 修订）。
 * @param {object} options - 调用选项。
 * @param {string} options.projectId - 目标动作所在清单的 id（**完整 id**，收集箱是 `inbox…`）。
 * @param {string} options.taskId - 目标动作的 id。
 * @param {string} [options.entry] - CLI 入口文件，默认取本机真实入口。
 * @param {string} [options.node] - 跑 CLI 的 Node 可执行文件，默认按 {@link nodeBinary} 解析。
 * @param {number} [options.timeoutMs] - 超时毫秒数，默认见 {@link didaTimeoutMs}。
 * @returns {Promise<{ ok: true }>} 写成功了。
 */
export async function runDidaTaskComplete({ projectId, taskId, entry = didaEntry(), node = nodeBinary(), timeoutMs }) {
  const argv = buildDidaArgs('task complete', { projectId, taskId });
  await runCommand({ entry, node, argv, timeoutMs });
  return { ok: true };
}

/**
 * 执行一个写动作（写路由的注入点）。
 *
 * 现在只认「完成」一个动作类型；「改期」是 issue #10，届时在这里加一条分支。
 * @param {object} options - 调用选项。
 * @param {string} options.action - 动作类型（`'complete'`）。
 * @param {string} options.projectId - 目标动作所在清单的 id。
 * @param {string} options.taskId - 目标动作的 id。
 * @param {string} [options.entry] - CLI 入口文件。
 * @param {string} [options.node] - 跑 CLI 的 Node 可执行文件。
 * @param {number} [options.timeoutMs] - 超时毫秒数。
 * @returns {Promise<{ ok: true }>} 写成功了。
 */
export async function runDidaAction({ action, projectId, taskId, entry = didaEntry(), node = nodeBinary(), timeoutMs }) {
  if (action === 'complete') {
    return runDidaTaskComplete({ projectId, taskId, entry, node, timeoutMs });
  }
  throw new DidaError('invalid-argument', `不支持的写动作：${String(action)}`);
}

/**
 * 跑一条读命令并解析 JSON。
 * @param {object} options - 选项。
 * @param {string} options.command - 命令名。
 * @param {string | string[]} [options.projectId] - 清单 id。
 * @param {string} [options.startDate] - 起始日期。
 * @param {string} [options.endDate] - 结束日期。
 * @param {number} [options.status] - 状态过滤。
 * @param {string} options.entry - CLI 入口文件。
 * @param {string} options.node - 跑 CLI 的 Node 可执行文件。
 * @param {number} [options.timeoutMs] - 超时毫秒数。
 * @returns {Promise<object[]>} 原始任务数组。
 */
async function runReadCommand({ command, projectId, startDate, endDate, status, entry, node, timeoutMs }) {
  const argv = buildDidaArgs(command, { projectId, startDate, endDate, status });
  const { stdout } = await runCommand({ entry, node, argv, timeoutMs });
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new DidaError('cli-failed', '滴答 CLI 输出不是合法 JSON');
  }
}

/**
 * 跑一条命令（读命令与写命令共用这一条路）。
 *
 * 入口不存在、Node 找不到 → `cli-unavailable`；退出码非 0 → 按 stderr 归类
 * （未登录是 `not-authenticated`，其余是 `cli-failed`）；超时 → `cli-failed`。
 * @param {object} options - 选项。
 * @param {string} options.entry - CLI 入口文件。
 * @param {string} options.node - 跑 CLI 的 Node 可执行文件。
 * @param {string[]} options.argv - 已经拼好的 argv。
 * @param {number} [options.timeoutMs] - 超时毫秒数。
 * @returns {Promise<{ stdout: string, stderr: string }>} 命令的输出。
 */
async function runCommand({ entry, node, argv, timeoutMs }) {
  if (!existsSync(entry)) {
    throw new DidaError('cli-unavailable', `找不到滴答 CLI 入口：${entry}（用 GTD_DIDA_ENTRY 指定）`);
  }
  if (!existsSync(node)) {
    throw new DidaError('cli-unavailable', `找不到跑滴答 CLI 的 Node：${node}（用 GTD_NODE_BIN 指定）`);
  }
  const { code, stdout, stderr } = await runNode(node, entry, argv, timeoutMs);
  if (code !== 0) {
    const detail = stderr.trim() || stdout.trim() || `dida 退出码 ${code}`;
    throw new DidaError(classifyDidaFailure(stderr), detail);
  }
  return { stdout, stderr };
}
