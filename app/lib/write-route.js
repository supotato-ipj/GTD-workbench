/**
 * 本机 HTTP 路由：工作台的**写方向**（同一个接缝的另一个方向）。
 *
 * 写动作走 `POST /gtd-workbench/actions`，请求体是「动作类型 + 目标 id + 参数」：
 *
 * ```json
 * { "action": "complete", "taskId": "<动作 id>", "params": {} }
 * ```
 *
 * 键名是**英文**：与读方向的快照契约同一套写法——一条契约两种写法是 bug 的温床。
 *
 * 认**两个**动作类型：`complete`（完成 = 滴答勾选，`status=2`，单口径）与
 * `reschedule`（改期 = 写新的 `dueDate`，粒度到天）。两个写口走**同一条路由**。
 * 「跳过」不是写口：它是纯视图状态、零写入。
 *
 * 写成功之后**重新取一次数**再回给客户端（响应体里的 `snapshot`），
 * 客户端换主卡不必再发一次读请求，画布与滴答也不会差一拍。
 *
 * 写失败**不能表现为已完成**：失败响应体一律是 `{ "error": { "code", "message" } }`，
 * 失败类别与读方向同一套（未登录／CLI 不可用／CLI 失败／内部错误），
 * 写方向另加「目标不存在」与「参数非法」两类。
 */

import { ActionError, locateInContainer, validateAction } from './actions.js';
import { CONTAINERS } from './containers.js';
import { readCapacityConfig, readTwoMinutePolicy } from './config.js';
import { OPEN_STATUS } from './snapshot.js';
import {
  collectSnapshot,
  describeFailure,
  resolveCapacityConfig,
  resolveContainers,
  resolveTwoMinutePolicy,
  sendJson,
} from './route.js';

/** 写路由的路径：顶层路径，带命名空间前缀。 */
export const ACTIONS_ROUTE_PATH = '/gtd-workbench/actions';

/** 请求体最大字节数：写动作的体很小，超了就是发错了。 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * 读请求体并解析 JSON。
 * @param {object} req - 请求对象。
 * @returns {Promise<{ ok: true, value: unknown } | { ok: false, message: string }>} 解析结果。
 */
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return { ok: false, message: '请求体太大了' };
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim().length === 0) return { ok: false, message: '请求体是空的' };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, message: '请求体不是合法 JSON' };
  }
}

/**
 * 找出目标动作在哪个清单里。
 *
 * 一个纸箱一个纸箱地问，**找到了就停**：写动作只关心目标在哪，不必把六个纸箱都拉一遍。
 * @param {object} options - 选项。
 * @param {object[]} options.containers - 六个纸箱。
 * @param {(args: { projectId: string, status: number }) => Promise<object[]>} options.runDida - 取一个清单下的动作。
 * @param {string} options.taskId - 目标动作的 id。
 * @returns {Promise<{ container: object, task: object, projectId: string } | null>} 找到时给出容器、原始条目与清单 id；没找到为 null。
 */
async function locateTarget({ containers, runDida, taskId }) {
  for (const container of containers) {
    const tasks = await runDida({ projectId: container.projectId, status: OPEN_STATUS });
    const located = locateInContainer({ container, tasks, taskId });
    if (located !== null) return located;
  }
  return null;
}

/**
 * 造写路由的处理函数。
 *
 * 依赖全部从外面注入，所以测试能用替身跑同一条路由，不必碰真实滴答。
 *
 * `containers` 与 `capacityConfig` **既可以是值，也可以是返回值的函数**：
 * 函数在**每次请求**里现取（改完本机配置刷新就生效），一次请求内只解析一次——
 * 「找目标」与「写完重新取数」用的是**同一份**清单 id 与容量口径。
 * @param {object} options - 处理函数的依赖。
 * @param {{ requestRejection: (req: object) => number | undefined }} options.connection - 宿主连接服务（访问守卫）。
 * @param {(args: { projectId: string, status: number }) => Promise<object[]>} options.runDida - 取一个清单下的动作。
 * @param {(args: { action: string, projectId: string, taskId: string, params: object, timeZone: string }) => Promise<unknown>} options.runAction - 执行写动作。
 * @param {string} options.timeZone - 截止时间换算到的时区。
 * @param {() => Date} [options.now] - 生成时刻。
 * @param {object[] | (() => object[])} [options.containers] - 六个纸箱，默认六个容器（ADR-0007 的固定顺序）。
 * @param {object | (() => object)} [options.capacityConfig] - 容量配置，默认每次请求重读本机配置。
 * @param {object | (() => object)} [options.twoMinutePolicy] - 两分钟规则参数，默认每次请求重读本机配置。
 * @param {() => object[]} [options.loadRecords] - 读 markdown 侧记录。
 * @param {(args: { projectIds: string[], startDate: string, endDate: string }) => Promise<object[]>} [options.runCompleted]
 *   按日期区间取已完成条目（已沉底区用）。
 * @returns {(req: object, res: object) => Promise<void>} 路由处理函数。
 */
export function createActionsHandler({
  connection,
  runDida,
  runAction,
  timeZone,
  now = () => new Date(),
  containers = CONTAINERS,
  capacityConfig = () => readCapacityConfig(),
  twoMinutePolicy = () => readTwoMinutePolicy(),
  loadRecords = () => [],
  runCompleted = async () => [],
}) {
  return async function handleActions(req, res) {
    const rejection = connection.requestRejection(req);
    if (rejection !== undefined) {
      res.statusCode = rejection;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('allow', 'POST');
      res.end();
      return;
    }
    try {
      const body = await readJsonBody(req);
      if (!body.ok) throw new ActionError('invalid-argument', body.message);
      const parsed = validateAction(body.value);
      if (!parsed.ok) throw new ActionError(parsed.code, parsed.message);
      const { action, taskId, params } = parsed.value;

      // 本次请求解析一次：找目标与写完刷新用的是同一份纸箱、容量口径与两分钟规则。
      const resolvedContainers = resolveContainers(containers);
      const resolvedCapacity = resolveCapacityConfig(capacityConfig);
      const resolvedTwoMinute = resolveTwoMinutePolicy(twoMinutePolicy);

      // 写动作要带清单 id（`dida task complete <清单 id> <动作 id>`）：
      // 先把目标动作找出来，顺带确认它存在——不存在就说「目标不存在」，不去瞎写。
      const located = await locateTarget({ containers: resolvedContainers, runDida, taskId });
      if (located === null) {
        throw new ActionError('not-found', `找不到目标动作：${taskId}`);
      }

      // 改期按**动作自己的时区**解释新日期（滴答那侧是 Asia/Shanghai，ADR-0008）；
      // 动作上没带时区才退回宿主时区。改期**不改**动作的时区。
      const ownZone = typeof located.task?.timeZone === 'string' ? located.task.timeZone.trim() : '';
      await runAction({
        action,
        projectId: located.projectId,
        taskId,
        params,
        timeZone: ownZone.length > 0 ? ownZone : timeZone,
      });

      // 写成功 → 重新取数，把新快照一并回给客户端。
      let snapshot = null;
      let refreshFailure = null;
      try {
        snapshot = await collectSnapshot({
          containers: resolvedContainers,
          runDida,
          runCompleted,
          loadRecords,
          timeZone,
          generatedAt: now(),
          capacityConfig: resolvedCapacity,
          twoMinutePolicy: resolvedTwoMinute,
        });
      } catch (error) {
        // 写已经成功了，只是刷新没成：说清楚是「刷新失败」，别把它说成「写失败」。
        refreshFailure = describeFailure(error);
      }
      const payload = { ok: true, action, taskId, snapshot };
      if (refreshFailure !== null) {
        payload.refreshError = { code: refreshFailure.code, message: refreshFailure.message };
      }
      sendJson(res, 200, payload);
    } catch (error) {
      const failure = describeFailure(error);
      sendJson(res, failure.status, { error: { code: failure.code, message: failure.message } });
    }
  };
}
