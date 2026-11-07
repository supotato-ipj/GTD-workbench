/**
 * **本周主攻**的推导（纯逻辑）。
 *
 * GLOSSARY「主攻」：本周承诺投入深度时间、必须交付的事项；每周不超过 3 项。
 *
 * ⚠️ 这里的「主攻」**不是 v2 的「焦点」**，两件事语义不同、名字不重叠：
 * - 本模块 = v1 遗留的「本周主攻」：**本周**承诺投入深度时间的那几件事，导出成快照的 `mainPush`；
 * - v2 的「焦点」= 焦点引导器的主位行动卡与「接下来」队列，推导在 `app/lib/focus-guide.js`，
 *   导出成快照的 `focus`（`focus.card` / `focus.next`）。
 *
 * 主攻**从滴答推导**，不读手写名单里的「本周三件主攻」段落（ADR-0007）：
 * 一份动作只允许存在一次；两份名单并存就是 ADR-0003 判为失败的双写，而它已经漂过一次
 * （实测：手写名单说本周剩两件，滴答 `深度` 标签推出来的是另外两件，其中一件两边一致）。
 *
 * 所以：**要降级一件主攻，改它的时间档标签，不要改名单。**
 */

/** 本周内的时间轴段。今天、明天都在本周之内；「以后」不是本周。 */
export const THIS_WEEK_SEGMENTS = ['today', 'tomorrow', 'thisWeek'];

/**
 * 一条便贴算不算**本周主攻**。
 *
 * 三个条件缺一不可：未完成、带 `深度` 时间档、落在本周内的时间轴段。
 * @param {object} note - 快照里的一条便贴。
 * @returns {boolean} 是不是主攻。
 */
export function isFocusNote(note) {
  if (note === null || typeof note !== 'object') return false;
  if (note.status !== 0) return false;
  if (note.timeBand !== '深度') return false;
  return THIS_WEEK_SEGMENTS.includes(note.segment);
}

/**
 * 推导**本周主攻**。
 *
 * 条数与滴答一致——不截断到 3 项。超过 3 项是本周排期本身出了问题，
 * 画布该如实照出来，而不是悄悄砍掉第四条（工作台是只读视图，不做判断）。
 *
 * 产物挂快照顶层的 `mainPush`（**不是** `focus`——那是 v2 的焦点引导器）。
 * @param {object[]} containers - 快照的容器组。
 * @returns {object[]} 主攻条目，按时间轴顺序与截止时间排。
 */
export function focusOf(containers) {
  const rows = [];
  for (const container of Array.isArray(containers) ? containers : []) {
    for (const note of Array.isArray(container.notes) ? container.notes : []) {
      if (!isFocusNote(note)) continue;
      rows.push({
        id: note.id,
        title: note.title,
        dueLocal: note.dueLocal ?? null,
        segment: note.segment,
        container: container.key,
        containerName: container.name,
      });
    }
  }
  const segmentOrder = (segment) => {
    const index = THIS_WEEK_SEGMENTS.indexOf(segment);
    return index === -1 ? THIS_WEEK_SEGMENTS.length : index;
  };
  // 先按「今天 → 明天 → 本周」排，同段内按到期时间，最后按 id 兜底稳定。
  rows.sort((left, right) => {
    const bySegment = segmentOrder(left.segment) - segmentOrder(right.segment);
    if (bySegment !== 0) return bySegment;
    const leftDue = left.dueLocal ?? '9999-12-31 23:59';
    const rightDue = right.dueLocal ?? '9999-12-31 23:59';
    if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return rows;
}
