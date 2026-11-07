/**
 * 状态迁移的差异检测（纯逻辑）。
 *
 * ADR-0007：动画**只演真实发生过的差异**——拉数后与上次快照比对，检测到「新完成 / 新改期 / 新换容器」
 * 才播对应动画。不演「时间流逝」，也不演假的进度。
 *
 * 差异基准存在浏览器本地（localStorage），不落仓库文件——所以这一层只负责算差异，
 * 存哪儿由调用方决定（见 `client.js` 的 `MOTION_KEY`）。
 */

/**
 * 把一份快照压成「只够比差异」的摘要。
 *
 * 两部分：
 * - `notes`：**未完成**的条目，只留在哪个容器、什么时候到期、完成没完成。正文改一个字不该触发动画。
 * - `sunk`：**已沉底**的条目 id。完成情况只能从这里比出来——未完成取数带 `--status 0`，
 *   一条事一旦勾完就从 `notes` 里消失了，靠 `notes` 永远看不到「新完成」。
 * @param {object} snapshot - 快照。
 * @returns {{ notes: Record<string, object>, sunk: Record<string, { date: string, container: string }> }} 摘要。
 */
export function summarize(snapshot) {
  const notes = {};
  const sunk = {};
  const containers = snapshot !== null && typeof snapshot === 'object' && Array.isArray(snapshot.containers) ? snapshot.containers : [];
  for (const container of containers) {
    if (container === null || typeof container !== 'object') continue;
    const key = typeof container.key === 'string' ? container.key : '';
    for (const note of Array.isArray(container.notes) ? container.notes : []) {
      if (note === null || typeof note !== 'object') continue;
      const id = typeof note.id === 'string' ? note.id : '';
      if (id.length === 0) continue;
      notes[id] = {
        container: key,
        dueDate: typeof note.dueDate === 'string' ? note.dueDate : null,
        status: typeof note.status === 'number' ? note.status : 0,
      };
    }
  }
  const days = snapshot !== null && typeof snapshot === 'object' && snapshot.sunk !== null && typeof snapshot.sunk === 'object' && Array.isArray(snapshot.sunk.days) ? snapshot.sunk.days : [];
  for (const day of days) {
    if (day === null || typeof day !== 'object') continue;
    const date = typeof day.date === 'string' ? day.date : '';
    for (const note of Array.isArray(day.notes) ? day.notes : []) {
      if (note === null || typeof note !== 'object') continue;
      const id = typeof note.id === 'string' ? note.id : '';
      if (id.length === 0) continue;
      sunk[id] = { date, container: typeof note.container === 'string' ? note.container : '' };
    }
  }
  return { notes, sunk };
}

/**
 * 比对两份摘要，找出真实发生过的变化。
 *
 * 三种变化各自对应一种动画（ADR-0007）：
 * - `completed`：新完成——这一条**新出现在已沉底区**里。
 * - `rescheduled`：新改期（未完成条目的到期日变了）。
 * - `moved`：新换容器（未完成条目换了纸箱）。
 *
 * 没有基线（第一次拉数）时一律返回空：第一次打开画布不该演「变化」，那时还没有「上次」。
 * 从快照里消失的条目不算迁移，也不播——它不在画布上了，没有可演的位置。
 * @param {object | null} previous - 上次的摘要。
 * @param {object | null} next - 这次的摘要。
 * @returns {{ completed: string[], rescheduled: string[], moved: string[] }} 三类变化的 id。
 */
export function diffSnapshots(previous, next) {
  const result = { completed: [], rescheduled: [], moved: [] };
  if (previous === null || typeof previous !== 'object' || next === null || typeof next !== 'object') return result;
  const beforeNotes = typeof previous.notes === 'object' && previous.notes !== null ? previous.notes : null;
  const afterNotes = typeof next.notes === 'object' && next.notes !== null ? next.notes : null;
  if (beforeNotes === null || afterNotes === null) return result;
  const beforeSunk = typeof previous.sunk === 'object' && previous.sunk !== null ? previous.sunk : {};
  const afterSunk = typeof next.sunk === 'object' && next.sunk !== null ? next.sunk : {};

  // 新完成 = 这一条新出现在已沉底区里。
  for (const id of Object.keys(afterSunk)) {
    if (beforeSunk[id] === undefined) result.completed.push(id);
  }

  for (const [id, current] of Object.entries(afterNotes)) {
    const old = beforeNotes[id];
    if (old === undefined || old === null) continue;
    if (old.container !== current.container) {
      result.moved.push(id);
      continue;
    }
    if (old.dueDate !== current.dueDate) result.rescheduled.push(id);
  }
  return result;
}

/**
 * 把差异摊成「id → 动画名」，方便渲染层一条一条查。
 *
 * 同一时刻只演一种：完成的优先于换容器、换容器优先于改期——一次只动一下，别叠三种动画。
 * @param {object} diff - {@link diffSnapshots} 的结果。
 * @returns {Record<string, string>} id → `'completed' | 'moved' | 'rescheduled'`。
 */
export function motionsOf(diff) {
  const motions = {};
  for (const id of Array.isArray(diff?.rescheduled) ? diff.rescheduled : []) motions[id] = 'rescheduled';
  for (const id of Array.isArray(diff?.moved) ? diff.moved : []) motions[id] = 'moved';
  for (const id of Array.isArray(diff?.completed) ? diff.completed : []) motions[id] = 'completed';
  return motions;
}
