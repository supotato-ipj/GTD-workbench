/**
 * 本机 HTTP 路由：工作台的取数入口（读方向）。
 *
 * 写方向（完成等写动作）在 `app/lib/write-route.js`，走同一条 HTTP 契约的另一个方向。
 *
 * 为什么走 HTTP 路由而不是自定义 remote（ADR-0008）：客户端那侧的 remote 命名空间是静态生成进
 * `dsh-api-remotes` 的，新增命名空间要走 typert 代码生成；HTTP 路由是已验证的路。
 *
 * 路由必须带访问守卫：同机任何进程都能连本地端口，所以先问 `connection.requestRejection(req)`。
 * 失败要给出**可区分**的原因——「未登录」和「别的失败」在看板上不能混成一句话，也不能返回空快照。
 */

import { ActionError } from './actions.js';
import { CONTAINERS } from './containers.js';
import { readCapacityConfig, readTwoMinutePolicy } from './config.js';
import { buildSnapshot, OPEN_STATUS } from './snapshot.js';
import { DidaError } from './dida.js';
import { shiftDate, windowOf } from './sunk.js';
import { localDateText } from './timeline.js';

/** 取数路由的路径：顶层路径，带命名空间前缀。 */
export const TASKS_ROUTE_PATH = '/gtd-workbench/tasks';

/** 失败类别 → HTTP 状态码。读方向与写方向同一套。 */
export const FAILURE_STATUS = {
  'not-authenticated': 401,
  'cli-unavailable': 503,
  'cli-failed': 502,
  'not-found': 404,
  'invalid-argument': 400,
};

/**
 * 写一个 JSON 响应。
 * @param {object} res - 响应对象。
 * @param {number} status - HTTP 状态码。
 * @param {object} payload - 响应体。
 */
export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

/**
 * 把一次失败归成「可区分的原因」。
 * @param {unknown} error - 捕获到的错误。
 * @returns {{ status: number, code: string, message: string }} 失败描述。
 */
export function describeFailure(error) {
  if (error instanceof DidaError || error instanceof ActionError) {
    const status = FAILURE_STATUS[error.code];
    if (status === undefined) {
      return { status: 500, code: 'internal-error', message: error.message };
    }
    return {
      status,
      code: error.code,
      message: error.message,
    };
  }
  return {
    status: 500,
    code: 'internal-error',
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * 读 markdown 记录，失败降级成空数组。
 *
 * markdown 侧是辅助信息（「为什么」）。它读不到时画布照画、抽屉显示「无对应记录」，
 * 不因为一份文档缺失就让整块板子返回失败。
 * @param {() => object[]} loadRecords - 记录读取器。
 * @returns {object[]} 记录；读取器抛错时为空数组。
 */
function safeRecords(loadRecords) {
  if (typeof loadRecords !== 'function') return [];
  try {
    const records = loadRecords();
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

/**
 * 分容器取数：一次一个清单。
 *
 * 一次拉全部容器会撞上 CLI 单次 200 条的上限，所以必须分容器调用；
 * 只取未完成（`--status 0`），否则同一个容器自己就能撞满上限。
 * @param {object} options - 选项。
 * @param {object[]} options.containers - 六个纸箱。
 * @param {(args: { projectId: string, status: number }) => Promise<object[]>} options.runDida - 取一个清单下的动作。
 * @returns {Promise<Map<string, object[]>>} 按清单 id 归好的原始条目。
 */
export async function readTasksByProject({ containers, runDida }) {
  const tasksByProject = new Map();
  for (const container of containers) {
    tasksByProject.set(
      container.projectId,
      await runDida({ projectId: container.projectId, status: OPEN_STATUS }),
    );
  }
  return tasksByProject;
}

/**
 * 解析**本次请求**用的纸箱。
 *
 * 纸箱来源可以是数组，也可以是**返回数组的函数**——函数每次调用现取，
 * 这样改完 `local-config.json` 刷新页面就立刻生效（与容量配置同一口径）。
 * 解析不出来（函数抛错、返回的不是数组）就退回仓库里的那六个纸箱：**不因为本机配置坏了就把工作台打掉**。
 * @param {object[] | (() => object[])} source - 纸箱数组或读取器。
 * @returns {object[]} 本次请求用的纸箱。
 */
export function resolveContainers(source) {
  const value = typeof source === 'function' ? safeCall(source) : source;
  return Array.isArray(value) ? value : CONTAINERS;
}

/**
 * 解析**本次请求**用的容量配置。
 *
 * 口径与纸箱一样：可以是对象，也可以是**返回对象的函数**（每次调用现取）。
 * 解析不出来（函数抛错、返回的不是对象）就当**没有配置**——
 * 快照那边退回通用默认值（`capacity.asOf` 为 null = 参数未定）。
 * @param {object | (() => object)} source - 容量配置或读取器。
 * @returns {object | undefined} 容量配置；没有时是 undefined。
 */
export function resolveCapacityConfig(source) {
  return resolveOptionalObject(source);
}

/**
 * 解析**本次请求**用的两分钟规则参数。
 *
 * 口径与容量配置一样：可以是对象，也可以是**返回对象的函数**（每次调用现取）。
 * 解析不出来（函数抛错、返回的不是对象）就当**没有配置**——
 * 快照那边退回通用默认值（app/lib/focus-guide.js 的 DEFAULT_TWO_MINUTE_POLICY）。
 * @param {object | (() => object)} source - 规则参数或读取器。
 * @returns {object | undefined} 规则参数；没有时是 undefined。
 */
export function resolveTwoMinutePolicy(source) {
  return resolveOptionalObject(source);
}

/**
 * 解析一个「可能带默认值的依赖」：函数就调它、对象就直接用、坏值退回默认。
 *
 * 容量配置与两分钟规则参数是同一套口径（都可以是值，也可以是每次请求现取的函数），
 * 所以共用这一个解析器——**别把同一段逻辑抄两遍**，抄一遍就会漂。
 * @param {object | (() => object)} source - 依赖或读取器。
 * @returns {object | undefined} 解析出来的对象；没有或坏值时是 undefined。
 */
function resolveOptionalObject(source) {
  const value = typeof source === 'function' ? safeCall(source) : source;
  if (value === null || value === undefined) return undefined;
  return typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

/**
 * 调一个读取器，抛错就当它没给出东西（不把异常往上抛）。
 * @param {() => unknown} reader - 读取器。
 * @returns {unknown} 读到的值；抛错时是 undefined。
 */
function safeCall(reader) {
  try {
    return reader();
  } catch {
    return undefined;
  }
}

/**
 * 取数并组装一份快照（读方向与写方向共用）。
 *
 * 写成功之后要**重新取一次数**再回给客户端，靠的就是这一段——
 * 客户端换主卡不必再发一次读请求。
 * @param {object} options - 选项。
 * @param {object[]} options.containers - 六个纸箱（本次请求解析出来的那一份）。
 * @param {(args: { projectId: string, status: number }) => Promise<object[]>} options.runDida - 取一个清单下的动作。
 * @param {string} options.timeZone - 截止时间换算到的时区。
 * @param {Date} options.generatedAt - 生成时刻。
 * @param {() => object[]} [options.loadRecords] - 读 markdown 侧记录。
 * @param {(args: { projectIds: string[], startDate: string, endDate: string }) => Promise<object[]>} [options.runCompleted]
 *   按日期区间取已完成条目（已沉底区用）。
 * @param {object} [options.capacityConfig] - 容量配置（本次请求解析出来的那一份）。
 * @param {object} [options.twoMinutePolicy] - 两分钟规则参数（本次请求解析出来的那一份）。
 * @returns {Promise<object>} 快照。
 */
export async function collectSnapshot({
  containers,
  runDida,
  timeZone,
  generatedAt,
  loadRecords = () => [],
  runCompleted,
  capacityConfig,
  twoMinutePolicy,
}) {
  const tasksByProject = await readTasksByProject({ containers, runDida });
  // 已沉底区走另一条命令、按日期区间取已完成，**不与未完成混在一次调用里**。
  const completedTasks = await readCompleted({ runCompleted, containers, timeZone, generatedAt });
  return buildSnapshot({
    containers,
    tasksByProject,
    timeZone,
    generatedAt: generatedAt.toISOString(),
    // markdown 侧读不到不该把整块板子打掉：loadRecords 自己兜住，这里再兜一层。
    records: safeRecords(loadRecords),
    completedTasks,
    capacityConfig,
    twoMinutePolicy,
  });
}

/**
 * 造这条路由的处理函数。
 *
 * 依赖全部从外面注入，所以测试能用固定夹具跑同一条路由，不必碰真实滴答。
 *
 * `containers` 与 `capacityConfig` **既可以是值，也可以是返回值的函数**：
 * 函数在**每次请求**里现取——改完本机配置（清单 id／容量参数）刷新页面就立刻生效。
 * 一次请求内只解析一次：取数、已沉底区与快照用的是同一份。
 * @param {object} options - 处理函数的依赖。
 * @param {{ requestRejection: (req: object) => number | undefined }} options.connection - 宿主连接服务（访问守卫）。
 * @param {(args: { projectId: string, status: number }) => Promise<object[]>} options.runDida - 取一个清单下的动作。
 * @param {string} options.timeZone - 截止时间换算到的时区。
 * @param {() => Date} [options.now] - 生成时刻。
 * @param {object[] | (() => object[])} [options.containers] - 本次取数的纸箱，默认六个容器（ADR-0007 的固定顺序）。
 * @param {object | (() => object)} [options.capacityConfig] - 容量配置，默认每次请求重读本机配置。
 * @param {object | (() => object)} [options.twoMinutePolicy] - 两分钟规则参数，默认每次请求重读本机配置。
 * @param {() => object[]} [options.loadRecords] - 读 markdown 侧记录（Host 从仓库读）。
 * @param {(args: { projectIds: string[], startDate: string, endDate: string }) => Promise<object[]>} [options.runCompleted]
 *   按日期区间取已完成条目（已沉底区用）；不给就当没有已完成条目。
 * @returns {(req: object, res: object) => Promise<void>} 路由处理函数。
 */
export function createTasksHandler({
  connection,
  runDida,
  timeZone,
  now = () => new Date(),
  containers = CONTAINERS,
  capacityConfig = () => readCapacityConfig(),
  twoMinutePolicy = () => readTwoMinutePolicy(),
  loadRecords = () => [],
  runCompleted = async () => [],
}) {
  return async function handleTasks(req, res) {
    const rejection = connection.requestRejection(req);
    if (rejection !== undefined) {
      res.statusCode = rejection;
      res.end();
      return;
    }
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET');
      res.end();
      return;
    }
    try {
      // 本次请求解析一次：纸箱、容量配置与两分钟规则都用这一份，下面全程不再解析。
      const resolvedContainers = resolveContainers(containers);
      const resolvedCapacity = resolveCapacityConfig(capacityConfig);
      const resolvedTwoMinute = resolveTwoMinutePolicy(twoMinutePolicy);
      const snapshot = await collectSnapshot({
        containers: resolvedContainers,
        runDida,
        runCompleted,
        loadRecords,
        timeZone,
        generatedAt: now(),
        capacityConfig: resolvedCapacity,
        twoMinutePolicy: resolvedTwoMinute,
      });
      sendJson(res, 200, snapshot);
    } catch (error) {
      const failure = describeFailure(error);
      sendJson(res, failure.status, { error: { code: failure.code, message: failure.message } });
    }
  };
}

/**
 * 取已沉底窗口里的已完成条目。
 *
 * CLI 的区间按 UTC 比，而窗口按本地日期算（ADR-0008：画布的时间基准是浏览器本地时间）。
 * 所以这里把区间**两头各放宽一天**，精确的「只留最近七天」由 `app/lib/sunk.js` 按本地日期再筛一次——
 * 放宽是廉价的，漏掉本地凌晨完成的那几条是看不见的错。
 * @param {object} options - 选项。
 * @param {Function} options.runCompleted - 取已完成条目的函数。
 * @param {object[]} options.containers - 六个纸箱。
 * @param {string} options.timeZone - 目标时区。
 * @param {Date} options.generatedAt - 生成时刻。
 * @returns {Promise<object[]>} 已完成的原始任务；取不到时为空数组。
 */
async function readCompleted({ runCompleted, containers, timeZone, generatedAt }) {
  if (typeof runCompleted !== 'function') return [];
  const today = localDateText(generatedAt, timeZone);
  if (today === null) return [];
  const { from, to } = windowOf(today);
  const startDate = `${shiftDate(from, -1)}T00:00:00Z`;
  const endDate = `${shiftDate(to, 1)}T23:59:59Z`;
  try {
    const tasks = await runCompleted({
      projectIds: containers.map((container) => container.projectId),
      startDate,
      endDate,
    });
    return Array.isArray(tasks) ? tasks : [];
  } catch {
    // 已沉底区是展示区：取不到就空着，不把整块板子打成失败。
    return [];
  }
}
