/**
 * 六个纸箱的归位规则（纯逻辑）。
 *
 * 这里只做**判断**：一条东西算不算这个箱子的东西、算不算箱签、箱子的下一步指针写什么。
 * 不碰滴答、不碰 DOM，所以可以在接缝 A 上直接断言。
 *
 * 规则来源：
 * - ADR-0007：日历箱按「外部约定时刻」口径过滤；可能清单默认折叠；项目画成箱签，不画成便贴。
 * - ADR-0004：日历只装外部约定时刻（开庭、送达截止、约定的会、回收截止），期限不是日历条目；
 *   项目不带子任务。
 * - GLOSSARY「箱签」：贴在纸箱外沿的项目标签，只写项目名和下一步指针。
 */

/** 纸箱里条目的呈现方式：便贴（note）或箱签（tag）。 */
export const BOX_KIND = { NOTE: 'note', TAG: 'tag' };

/**
 * 六个纸箱的呈现规则（ADR-0007）。
 *
 * `collapsedByDefault` 是**默认**折叠，不是不许展开——可能清单当前不投入，
 * 本就不该占版面（GLOSSARY「可能清单」）。
 */
export const BOX_RULES = {
  inbox: { kind: BOX_KIND.NOTE, collapsedByDefault: false },
  project: { kind: BOX_KIND.TAG, collapsedByDefault: false },
  execution: { kind: BOX_KIND.NOTE, collapsedByDefault: false },
  waiting: { kind: BOX_KIND.NOTE, collapsedByDefault: false },
  calendar: { kind: BOX_KIND.NOTE, collapsedByDefault: false },
  maybe: { kind: BOX_KIND.NOTE, collapsedByDefault: true },
};

/** 没有登记在册的容器按普通纸箱处理：便贴、展开。 */
export const DEFAULT_BOX_RULE = { kind: BOX_KIND.NOTE, collapsedByDefault: false };

/** 「下一步指针」的写法：下一步：X。 */
const NEXT_STEP_PATTERN = /下一步\s*[：:]\s*([^；;。\n]*)/;

/**
 * 抽出箱签上的下一步指针。
 *
 * 箱签只写项目名和下一步指针，不展开成一堆便贴（GLOSSARY「箱签」）。
 * 项目页在 markdown 里，滴答的备注只留一句指向，所以指针就藏在正文里。
 * @param {unknown} content - 滴答任务的正文。
 * @returns {string | null} 下一步指针；正文里没有就返回 null。
 */
export function nextStepOf(content) {
  if (typeof content !== 'string') return null;
  const matched = NEXT_STEP_PATTERN.exec(content);
  if (matched === null) return null;
  const step = matched[1].trim();
  return step.length === 0 ? null : step;
}

/**
 * 一条东西算不算日历箱里的「外部约定时刻」。
 *
 * ADR-0004：日历只装外部约定时刻（开庭、送达截止、约定的会、回收截止），期限不是日历条目。
 * ADR-0007：日历箱按这个口径过滤——底下 200 多条周期项，过滤后未完成只剩 1 条
 * （沅川建业混凝土案 12/12 14:00 开庭）。空箱是结论，不是缺陷。
 *
 * 滴答没有「这条是不是外部约定的」这一栏，所以口径落在能判的信号上：
 * 1. 未完成——已完成的归已沉底区（ADR-0007），不占日历箱的位。
 * 2. 有钟点——不是全天。全天只有「哪一天」，那是期限；约定时刻有「几点」。
 * 3. 占用一个时段——有起点，且起点与终点不是同一时刻。一个点只是「在某天之前做完」，那是期限；
 *    一个起点加一个终点才是约好的时段。
 * 4. 这个时段还没开始——已经开过的事不再是「约定」，只是逾期或已过期的日常。
 *
 * 已知代价：滴答没有字段能认出「外部约定」，第 4 条是近似。实测日历里未完成的只剩开庭那一条，
 * 周期日常（传递法律文书、查询被执行案件、授权资料审批用印）因为已完成而不进未完成取数。
 * @param {object} note - 快照里的一条便贴数据。
 * @param {string | number | Date} now - 参照时刻（通常是快照生成时刻）。
 * @returns {boolean} 是不是日历箱要留的那一条。
 */
export function isCalendarEntry(note, now) {
  if (note.status !== 0) return false;
  if (note.dueAt === null || note.dueTime === null) return false;
  if (note.dueAllDay === true) return false;
  if (note.startAt === null) return false;
  if (note.startAt === note.dueAt) return false;
  return Date.parse(note.startAt) > Date.parse(now);
}

/**
 * 容器自己的口径：日历箱按「外部约定时刻」过滤，其余容器原样收下。
 * @param {string} key - 容器标识。
 * @param {object[]} notes - 该容器取回来的条目。
 * @param {string | number | Date} now - 参照时刻。
 * @returns {object[]} 留在该容器里的条目。
 */
export function filterContainerNotes(key, notes, now) {
  return key === 'calendar' ? notes.filter((note) => isCalendarEntry(note, now)) : notes;
}
