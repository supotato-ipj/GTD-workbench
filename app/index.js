/**
 * Host 半边：跑滴答、读仓库里的 markdown 记录，把快照经一条本机 HTTP 路由递给 Client（ADR-0008）。
 *
 * 两条路由，同一条 HTTP 契约的两个方向：
 * - 读：`GET /gtd-workbench/tasks` → 一份快照；
 * - 写：`POST /gtd-workbench/actions` → 完成等写动作，成功后回一份新快照。
 *
 * 不写任何本地文件（ADR-0006）；写滴答只开「完成」这一个写口（ADR-0006 修订）。
 */

import { createTasksHandler, TASKS_ROUTE_PATH } from './lib/route.js';
import { createActionsHandler, ACTIONS_ROUTE_PATH } from './lib/write-route.js';
import { runDidaAction, runDidaTaskCompleted, runDidaTaskFilter } from './lib/dida.js';
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
  };
  const handler = createTasksHandler(shared);
  // 写方向：写动作的执行由 CLI 层注入（现在只有「完成」一个动作类型）。
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
}
