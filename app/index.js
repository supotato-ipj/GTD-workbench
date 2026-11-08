/**
 * Host 半边：跑滴答、读仓库里的 markdown 记录，把快照经一条本机 HTTP 路由递给 Client（ADR-0008）。
 *
 * 两条路由，同一条 HTTP 契约的两个方向：
 * - 读：`GET /gtd-workbench/tasks` → 一份快照；
 * - 写：`POST /gtd-workbench/actions` → 完成等写动作，成功后回一份新快照。
 *
 * 不写任何本地文件（ADR-0006）；写滴答只开「完成」与「改期」这两个写口（ADR-0006 修订）。
 */

import { ASSETS_ROUTE_PREFIX, createAssetsHandler } from './lib/assets.js';
import { createTasksHandler, TASKS_ROUTE_PATH } from './lib/route.js';
import { createActionsHandler, ACTIONS_ROUTE_PATH } from './lib/write-route.js';
import { runDidaAction, runDidaTaskCompleted, runDidaTaskFilter } from './lib/dida.js';
import { readCapacityConfig, readContainers } from './lib/config.js';
import { loadRecords } from './lib/records.js';

/** 宿主服务：`webServer` 开路由，`connection` 做访问守卫。 */
export const inject = ['webServer', 'connection'];

/**
 * 装上这两条路由。
 * @param {object} ctx - 插件上下文。
 */
export function apply(ctx) {
  const shared = {
    connection: ctx.connection,
    runDida: runDidaTaskFilter,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // markdown 侧的「为什么／验收标准／卡点」由 Host 从仓库读，Client 只负责画。
    loadRecords: () => loadRecords(),
    // 已沉底区按日期区间取已完成条目，走的是另一条读命令。
    runCompleted: runDidaTaskCompleted,
    // 纸箱与容量参数都从**本机配置**读（`local-config.json`，不进仓库）：
    // 传函数而不是值——每次请求现取，改完配置刷新页面就立刻生效。
    // 读不到就退回仓库里的虚构占位与通用默认值，不抛。
    containers: () => readContainers(),
    capacityConfig: () => readCapacityConfig(),
  };
  const handler = createTasksHandler(shared);
  // 写方向：写动作的执行由 CLI 层注入（「完成」与「改期」两个动作类型）。
  const actionsHandler = createActionsHandler({ ...shared, runAction: runDidaAction });
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: TASKS_ROUTE_PATH,
        handler,
      }),
    `gtd-workbench: GET ${TASKS_ROUTE_PATH}`,
  );
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: ACTIONS_ROUTE_PATH,
        handler: actionsHandler,
      }),
    `gtd-workbench: POST ${ACTIONS_ROUTE_PATH}`,
  );
  // 工位素材：点阵字体与像素素材随包发，走一条**前缀路由**（ADR-0012）。
  // 客户端仍是单文件——素材是 URL，不是模块。
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ASSETS_ROUTE_PREFIX,
        handler: createAssetsHandler(),
      }),
    `gtd-workbench: GET ${ASSETS_ROUTE_PREFIX}/*`,
  );
}
