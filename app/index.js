/**
 * Host 半边：跑滴答、读仓库里的 markdown 记录，把快照经一条本机 HTTP 路由递给 Client（ADR-0008）。
 *
 * 只读：这里只跑 `dida task filter` 这类读命令、只读 markdown，不写滴答，也不写任何本地文件（ADR-0006）。
 */

import { createTasksHandler, TASKS_ROUTE_PATH } from './lib/route.js';
import { runDidaTaskCompleted, runDidaTaskFilter } from './lib/dida.js';
import { loadRecords } from './lib/records.js';

/** 宿主服务：`webServer` 开路由，`connection` 做访问守卫。 */
export const inject = ['webServer', 'connection'];

/**
 * 装上这条路由。
 * @param {object} ctx - 插件上下文。
 */
export function apply(ctx) {
  const handler = createTasksHandler({
    connection: ctx.connection,
    runDida: runDidaTaskFilter,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // markdown 侧的「为什么／验收标准／卡点」由 Host 从仓库读，Client 只负责画。
    loadRecords: () => loadRecords(),
    // 已沉底区按日期区间取已完成条目，走的是另一条读命令。
    runCompleted: runDidaTaskCompleted,
  });
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: TASKS_ROUTE_PATH,
        handler,
      }),
    `gtd-workbench: GET ${TASKS_ROUTE_PATH}`,
  );
}
