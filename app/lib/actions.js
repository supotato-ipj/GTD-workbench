/**
 * 写动作：校验与定位（纯函数）。
 *
 * 工作台只开**一个**写口：**完成**（滴答勾选，`status=2`，单口径）。
 * 「改期」是下一票（issue #10）——届时往 {@link WRITE_ACTIONS} 里加一个动作类型即可，
 * **不新开一条路由**：写入始终走同一条 HTTP 契约的写方向。
 *
 * 这一层不碰滴答、不碰 HTTP：只回答「这个请求说得通吗」「目标动作在哪个清单里」。
 */

/** 支持的写动作类型。现在只有「完成」。 */
export const WRITE_ACTIONS = ['complete'];

/** 「完成」的动作类型名。 */
export const COMPLETE_ACTION = 'complete';

/**
 * 写方向上的失败。`code` 是可判别的失败类别，与读方向同一套语义。
 */
export class ActionError extends Error {
  /**
   * @param {'invalid-argument' | 'not-found'} code - 失败类别。
   * @param {string} message - 人能读的失败原因。
   */
  constructor(code, message) {
    super(message);
    this.name = 'ActionError';
    this.code = code;
  }
}

/**
 * 校验一个写请求体。
 *
 * 请求体形如 `{ "action": "complete", "taskId": "<动作 id>", "params": { … } }`：
 * 「params」是留给后续动作类型的（「改期」要带新的截止日），「完成」用不上就省略。
 *
 * 键名是**英文**：写方向与读方向（快照契约）用同一套英文键，一条契约两种写法是 bug 的温床。
 * @param {unknown} body - 解析后的请求体。
 * @returns {{ ok: true, value: { action: string, taskId: string, params: object } }
 *   | { ok: false, code: 'invalid-argument', message: string }} 校验结果。
 */
export function validateAction(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'invalid-argument', message: '请求体必须是一个 JSON 对象' };
  }
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (action.length === 0) {
    return { ok: false, code: 'invalid-argument', message: '缺少动作类型：「action」必须是非空字符串' };
  }
  if (!WRITE_ACTIONS.includes(action)) {
    return {
      ok: false,
      code: 'invalid-argument',
      message: `不支持的动作：${action}（工作台只开了「完成」这一个写口）`,
    };
  }
  const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : '';
  if (taskId.length === 0) {
    return { ok: false, code: 'invalid-argument', message: '缺少目标：「taskId」必须是非空字符串' };
  }
  const params = body.params;
  if (params !== undefined && (params === null || typeof params !== 'object' || Array.isArray(params))) {
    return { ok: false, code: 'invalid-argument', message: '「params」必须是一个 JSON 对象' };
  }
  return { ok: true, value: { action, taskId, params: params ?? {} } };
}

/**
 * 在一个纸箱取回来的条目里找目标动作。
 *
 * 写动作要带清单 id（`dida task complete <清单 id> <动作 id>`），
 * 清单 id 从**这条动作自己所在的纸箱**来——快照里每个容器都带 `projectId`。
 * 收集箱的 id 不是 24 位（是 `inbox…`），照样能用：它就是滴答那边的收集箱 id。
 * @param {object} options - 选项。
 * @param {object} options.container - 纸箱。
 * @param {object[]} options.tasks - 这个纸箱取回来的原始条目。
 * @param {string} options.taskId - 目标动作的 id。
 * @returns {{ container: object, task: object, projectId: string } | null} 找到时给出容器、原始条目与清单 id；没找到为 null。
 */
export function locateInContainer({ container, tasks, taskId }) {
  const wanted = typeof taskId === 'string' ? taskId.trim() : '';
  if (wanted.length === 0) return null;
  const list = Array.isArray(tasks) ? tasks : [];
  const task = list.find((item) => item !== null && typeof item === 'object' && String(item.id ?? '') === wanted);
  if (task === undefined) return null;
  // 清单 id 优先取条目自己带的 projectId（那是滴答那边的**完整** id），
  // 条目上没带才退回纸箱配置的 id。
  const own = typeof task.projectId === 'string' ? task.projectId.trim() : '';
  return {
    container,
    task,
    projectId: own.length > 0 ? own : container.projectId,
  };
}
