/**
 * 焦点的资格判定与排序（纯逻辑）。
 *
 * ADR-0010：资格是**过滤**（来自 GTD 明晰流程图），排序是**四标准映射**（GTD 选择行动）。
 * 分开之后，"这条没上卡"和"这条排第一"各自有一个可查的答案；
 * 揉在一起就成了一个说不清来源的分数，用户看不懂，测试也断言不了。
 *
 * 这里的「焦点」是 v2 的焦点引导器（GLOSSARY「行动卡」），
 * **不是** v1 的「本周主攻」——那一条在 `app/lib/focus.js`，快照字段是 `mainPush`。
 *
 * 这一层是**纯函数**：不读时钟（时刻由调用方给）、不碰滴答、不写任何文件。
 * 渲染层只负责画：资格与顺序都随快照过界（与分段、违规、主攻同一层）。
 */

import { estimateOf } from './capacity.js';
import { isFocusNote } from './focus.js';

/**
 * 不合格原因的取值全集。
 *
 * 每一项都要能对用户说清「为什么它没进焦点」；下钻层直接显示这些字。
 */
export const INELIGIBLE_REASONS = [
  '未判定',
  '等待',
  '收集箱未明晰',
  '未来日历项',
  '项目不出卡',
  '未到触碰日',
  '日清常驻顶部',
  '深度配额已用',
  '已完成',
];

/**
 * 一条动作的预计耗时（分钟），按容量参数里的番茄分钟折算。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文（带 capacity）。
 * @returns {number | null} 分钟数；未估算时为 null。
 */
/**
 * 一条动作的预计耗时（分钟），按上下文里的容量参数（番茄分钟）折算。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文（带 capacity）。
 * @returns {{ minutes: number | null, source: string | null }} 分钟数与来源；未估算时 minutes 为 null。
 */
function estimateIn(note, context) {
  const pomodoro = context?.capacity?.pomodoroMinutes;
  return estimateOf(note, { pomodoroMinutes: typeof pomodoro === 'number' ? pomodoro : 25 });
}

/**
 * 收集箱里的捕获能不能走两分钟规则。
 *
 * 两分钟规则是**后续一票**的事（issue #11），本票只留接口、不启用：
 * `twoMinute.enabled` 不为 true 时，收集箱里的捕获一律按「未明晰」处理。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文。
 * @returns {boolean} 走两分钟规则就是 true。
 */
function fitsTwoMinute(note, context) {
  const option = context?.twoMinute;
  if (option === null || typeof option !== 'object') return false;
  if (option.enabled !== true) return false;
  // 深度块进行中不许两分钟卡抢位（ADR-0010）。
  if (option.allowed === false) return false;
  const minutes = estimateIn(note, context).minutes;
  const max = typeof option.maxMinutes === 'number' ? option.maxMinutes : 2;
  return minutes !== null && minutes <= max;
}

/**
 * 日历项在不在它那一个时刻上。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文。
 * @returns {{ eligible: boolean, reason: string | null }} 判定结果。
 */
function calendarEligibility(note, context) {
  const start = typeof note.startLocal === 'string' ? note.startLocal : null;
  if (start === null) return { eligible: false, reason: '未来日历项' };
  const now = `${context.today} ${context.nowTime}`;
  // 已到：约定时刻已经过去，这一刻正在发生或刚开始。
  if (start <= now) return { eligible: true, reason: null };
  // 即将到：就在当前所处的时间窗口里。
  const window = context?.capacity?.currentWindow ?? null;
  if (window !== null && typeof window.end === 'string') {
    if (start <= `${context.today} ${window.end}`) return { eligible: true, reason: null };
  }
  return { eligible: false, reason: '未来日历项' };
}

/**
 * 可能清单的条目到没到触碰日。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文。
 * @returns {{ eligible: boolean, reason: string | null }} 判定结果。
 */
function maybeEligibility(note, context) {
  const touchDate = typeof note.dueDate === 'string' ? note.dueDate : null;
  if (touchDate === null || touchDate.length === 0) return { eligible: false, reason: '未到触碰日' };
  if (touchDate > context.today) return { eligible: false, reason: '未到触碰日' };
  return { eligible: true, reason: null };
}

/**
 * 执行清单里的动作：缺时间档即未判定；日清不参与排序。
 * @param {object} note - 便贴。
 * @returns {{ eligible: boolean, reason: string | null }} 判定结果。
 */
function executionEligibility(note) {
  if (note.timeBand === '日清') return { eligible: false, reason: '日清常驻顶部' };
  if (typeof note.timeBand !== 'string' || note.timeBand.length === 0) {
    return { eligible: false, reason: '未判定' };
  }
  return { eligible: true, reason: null };
}

/**
 * 一条便贴有没有资格进焦点。
 *
 * 八条规则（ADR-0010）：
 * 1. 已明晰、落在执行清单的动作；
 * 2. 日历项仅在它那一个时刻；
 * 3. 等待清单永不占主卡（到期没回走提醒位，另算）；
 * 4. 项目清单不出卡；
 * 5. 可能清单到触碰日才进焦点；
 * 6. 日清不参与排序，顶部常驻；
 * 7. 收集箱里未判定的捕获不进焦点（两分钟规则是后续一票，本票留接口不启用）；
 * 8. 缺时间档视为未判定。
 * @param {object} note - 便贴。
 * @param {string} containerKey - 它所在的容器。
 * @param {object} context - 上下文（今天、当前时刻、容量）。
 * @returns {{ eligible: boolean, reason: string | null }} 判定结果；`reason` 就是不合格原因。
 */
export function eligibilityOf(note, containerKey, context) {
  if (note === null || typeof note !== 'object') return { eligible: false, reason: '未判定' };
  if (context === null || typeof context !== 'object') return { eligible: false, reason: '未判定' };
  // 完成情况只认滴答勾选（ADR-0006）：已完成的没有「下一步可做」这回事。
  if (note.status !== undefined && note.status !== 0) return { eligible: false, reason: '已完成' };

  switch (containerKey) {
    case 'inbox':
      if (fitsTwoMinute(note, context)) return { eligible: true, reason: null };
      return { eligible: false, reason: '收集箱未明晰' };
    case 'project':
      return { eligible: false, reason: '项目不出卡' };
    case 'waiting':
      return { eligible: false, reason: '等待' };
    case 'calendar':
      return calendarEligibility(note, context);
    case 'maybe':
      return maybeEligibility(note, context);
    case 'execution':
      return executionEligibility(note);
    default:
      return { eligible: false, reason: '未判定' };
  }
}

/**
 * 给一条便贴补上资格标记。
 * @param {object} note - 便贴。
 * @param {string} containerKey - 它所在的容器。
 * @param {object} context - 上下文。
 * @returns {object} 补了 eligible 与 ineligibleReason 的新便贴。
 */
export function withEligibility(note, containerKey, context) {
  const { eligible, reason } = eligibilityOf(note, containerKey, context);
  return { ...note, eligible, ineligibleReason: eligible ? null : reason };
}

/**
 * 一条动作落在排序的第几组（GTD 选择行动四标准的「优先级」那一列）。
 *
 * ① 逾期或今天到期 → ② 本周主攻（深度档）→ ③ 本周内到期 → ④ 事务档填充 → ⑤ 其余有期限 → ⑥ 无期限。
 * 日清不在这条链里。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文。
 * @returns {number} 组号（越小越靠前）。
 */
export function rankGroupOf(note, context) {
  const today = typeof context?.today === 'string' ? context.today : '';
  if (note.overdue === true) return 0;
  if (typeof note.dueDate === 'string' && note.dueDate === today) return 0;
  if (isFocusNote(note)) return 1;
  if (note.segment === 'thisWeek') return 2;
  if (note.timeBand === '事务') return 3;
  if (typeof note.dueDate === 'string' && note.dueDate.length > 0) return 4;
  return 5;
}

/**
 * 给候选动作排序。
 *
 * 组别优先；**优先级字段只做同组内 tiebreaker**，不跨组（ADR-0010：那个字段实测聚集在中档，
 * 单独用没有区分力，跨组用会得到「明显该在后面的却排前面」的结果）。
 * 同组内按到期时间升序、再按优先级降序、最后按 id 兜底稳定——两次请求之间顺序必须一致。
 * @param {object[]} notes - 候选动作（已过资格这一关）。
 * @param {object} context - 上下文。
 * @returns {object[]} 排好序的新数组。
 */
export function rankOf(notes, context) {
  const list = (Array.isArray(notes) ? notes : []).filter(
    (note) => note !== null && typeof note === 'object',
  );
  return [...list].sort((left, right) => {
    const byGroup = rankGroupOf(left, context) - rankGroupOf(right, context);
    if (byGroup !== 0) return byGroup;
    const leftDue = typeof left.dueAt === 'string' ? left.dueAt : '9999-12-31T23:59:59.999Z';
    const rightDue = typeof right.dueAt === 'string' ? right.dueAt : '9999-12-31T23:59:59.999Z';
    if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1;
    const leftPriority = typeof left.priority === 'number' ? left.priority : 0;
    const rightPriority = typeof right.priority === 'number' ? right.priority : 0;
    if (leftPriority !== rightPriority) return rightPriority - leftPriority;
    const leftId = typeof left.id === 'string' ? left.id : '';
    const rightId = typeof right.id === 'string' ? right.id : '';
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
}

/** 「接下来」窄条队列最多几条（规格：2–4 条）。 */
export const NEXT_QUEUE_LIMIT = 4;

/** 等待清单的「什么时候回」前缀（GLOSSARY「等待清单」四样之一）。 */
const REPLY_WHEN_PATTERN = /什么时候回\s*[：:]\s*([^\n；;]*)/;

/**
 * 补两位。
 * @param {number | string} value - 数字或文本。
 * @returns {string} 两位文本。
 */
function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * 把上下文补齐成一份可用的上下文。
 * @param {object} context - 上下文。
 * @returns {object} 补齐后的上下文。
 */
function normalizeContext(context) {
  const source = context !== null && typeof context === 'object' ? context : {};
  return {
    today: typeof source.today === 'string' ? source.today : '',
    nowTime: typeof source.nowTime === 'string' ? source.nowTime : '00:00',
    capacity: source.capacity !== null && typeof source.capacity === 'object' ? source.capacity : null,
    twoMinute: source.twoMinute,
  };
}

/**
 * 一条等待项「什么时候回」的那一刻。
 *
 * 优先从正文前缀 `什么时候回：` 里取（GLOSSARY「等待清单」四样之一）；
 * 取不到就退回滴答的到期时间——那通常是同一个约定时刻。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文。
 * @returns {string | null} `YYYY-MM-DD HH:mm`；取不到时为 null。
 */
export function replyDueOf(note, context) {
  if (note === null || typeof note !== 'object') return null;
  const content = typeof note.content === 'string' ? note.content : '';
  const matched = REPLY_WHEN_PATTERN.exec(content);
  let dateText = null;
  let timeText = null;
  if (matched !== null) {
    const value = matched[1];
    const full = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
    const short = /(\d{1,2})\/(\d{1,2})/.exec(value);
    const clock = /(\d{1,2}):(\d{2})/.exec(value);
    if (full !== null) {
      dateText = `${full[1]}-${pad2(full[2])}-${pad2(full[3])}`;
    } else if (short !== null) {
      // 只写了「11/9」这种月/日：年份取滴答到期日的年份，取不到就用今年。
      const year =
        typeof note.dueDate === 'string' && note.dueDate.length >= 4
          ? note.dueDate.slice(0, 4)
          : String(context?.today ?? '').slice(0, 4);
      dateText = `${year}-${pad2(short[1])}-${pad2(short[2])}`;
    }
    if (clock !== null) timeText = `${pad2(clock[1])}:${clock[2]}`;
  }
  if (dateText === null) {
    if (typeof note.dueDate !== 'string' || note.dueDate.length === 0) return null;
    dateText = note.dueDate;
    timeText = typeof note.dueTime === 'string' ? note.dueTime : '23:59';
  }
  if (timeText === null) timeText = '23:59';
  return `${dateText} ${timeText}`;
}

/**
 * 一条日清项到了它的时段没有。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文。
 * @returns {boolean} 到了就是 true。
 */
function dailyArrived(note, context) {
  if (note.overdue === true) return true;
  if (note.dueDate !== context.today) return false;
  if (typeof note.dueTime !== 'string' || note.dueTime.length === 0) return true;
  return note.dueTime <= context.nowTime;
}

/**
 * 选主卡。
 *
 * 时段驱动：连续窗口优先派深度，可打断窗口派事务（ADR-0010）。
 * 窗口是**默认建议不是锁**：当前时刻落在窗口外时按实际位置重算，不报错、不空转。
 * 逾期的动作例外——破掉的外部时间点不可逆，它不受时段偏好影响。
 * @param {object[]} ranked - 排好序的候选。
 * @param {object} context - 上下文。
 * @returns {object | null} 主卡那条动作；没有候选时为 null。
 */
function pickCard(ranked, context) {
  if (ranked.length === 0) return null;
  const overdue = ranked.find((note) => note.overdue === true);
  if (overdue !== undefined) return overdue;
  const window = context.capacity?.currentWindow ?? null;
  if (window === null) return ranked[0];
  const preferred = window.kind === '连续' ? ['深度'] : ['事务'];
  const pool = ranked.filter((note) => preferred.includes(note.timeBand));
  return pool.length > 0 ? pool[0] : ranked[0];
}

/**
 * 装配主卡。
 * @param {object} note - 便贴。
 * @param {string} containerKey - 容器标识。
 * @param {string} containerName - 容器名。
 * @param {object} context - 上下文。
 * @returns {object} 行动卡。
 */
function cardOf(note, containerKey, containerName, context) {
  const estimate = estimateIn(note, context);
  const remaining = context.capacity?.remainingMinutes ?? 0;
  const deepCap = context.capacity?.deepDailyCapMinutes ?? 0;
  // 深度动作还要受单日深度上限约束。
  const limit = note.timeBand === '深度' && deepCap > 0 ? Math.min(remaining, deepCap) : remaining;
  return {
    id: note.id,
    title: note.title,
    container: containerKey,
    containerName,
    timeBand: note.timeBand ?? null,
    dueLocal: note.dueLocal ?? null,
    dueDate: note.dueDate ?? null,
    dueTime: note.dueTime ?? null,
    dueAllDay: note.dueAllDay === true,
    overdue: note.overdue === true,
    segment: note.segment ?? null,
    record: note.record ?? null,
    // 完成要求由后续一票填（markdown 记录页的验收标准，或正文 `完成要求：` 前缀）；
    // 本票只留位置，source 标出它是从哪来的。
    requirement: { text: null, source: null },
    // 预计耗时：null = 未估算（不是 0 分钟）。
    estimateMinutes: estimate.minutes,
    estimateSource: estimate.source,
    capacityHint: {
      // 装不装得下；未估算时为 null（未知），不装作知道。
      fits: estimate.minutes === null ? null : estimate.minutes <= limit,
      remainingMinutes: remaining,
      schedulableMinutes: context.capacity?.schedulableMinutes ?? 0,
    },
  };
}

/**
 * 装配「接下来」窄条队列里的一条。
 * @param {object} note - 便贴。
 * @param {string} containerKey - 容器标识。
 * @param {string} containerName - 容器名。
 * @param {'action' | 'daily'} kind - 是动作还是日清项。
 * @returns {object} 窄条。
 */
function nextOf(note, containerKey, containerName, kind) {
  return {
    id: note.id,
    title: note.title,
    kind,
    container: containerKey,
    containerName,
    timeBand: note.timeBand ?? null,
    dueLocal: note.dueLocal ?? null,
    dueDate: note.dueDate ?? null,
    dueTime: note.dueTime ?? null,
    overdue: note.overdue === true,
    record: note.record ?? null,
  };
}

/**
 * 装配日清清单里的一条。
 * @param {object} note - 便贴。
 * @returns {object} 日清项。
 */
function dailyOf(note) {
  return {
    id: note.id,
    title: note.title,
    timeBand: '日清',
    dueLocal: note.dueLocal ?? null,
    dueDate: note.dueDate ?? null,
    dueTime: note.dueTime ?? null,
    overdue: note.overdue === true,
    // 完成情况只认滴答勾选（ADR-0006）；这里列的是还开着的那些。
    state: '未还清',
  };
}

/**
 * 组装焦点：主卡 + 接下来 + 提醒位 + 日清。
 *
 * 全是纯函数：输入是快照的容器组与一份上下文（今天、当前时刻、容量），输出是一个焦点对象。
 * @param {object[]} containers - 快照的容器组。
 * @param {object} context - 上下文（今天、当前时刻、容量）。
 * @returns {object} 焦点。
 */
export function focusGuideOf(containers, context) {
  const ctx = normalizeContext(context);
  const groups = Array.isArray(containers) ? containers : [];
  const entries = [];
  for (const group of groups) {
    if (group === null || typeof group !== 'object') continue;
    const notes = Array.isArray(group.notes) ? group.notes : [];
    for (const note of notes) {
      entries.push({
        note,
        containerKey: typeof group.key === 'string' ? group.key : '',
        containerName: typeof group.name === 'string' ? group.name : '',
      });
    }
  }

  const eligible = [];
  const dailyEntries = [];
  const waitingEntries = [];
  for (const entry of entries) {
    const { eligible: ok, reason } = eligibilityOf(entry.note, entry.containerKey, ctx);
    if (ok) {
      eligible.push(entry);
      continue;
    }
    if (reason === '日清常驻顶部') dailyEntries.push(entry);
    if (entry.containerKey === 'waiting') waitingEntries.push(entry);
  }

  // 排序 → 深度配额 → 主卡。
  const ranked = rankOf(
    eligible.map((entry) => entry.note),
    ctx,
  );
  const byId = new Map(eligible.map((entry) => [entry.note.id, entry]));
  const quota = typeof ctx.capacity?.deepQuota === 'number' ? ctx.capacity.deepQuota : 1;
  let quotaLeft = quota;
  const kept = [];
  const pushed = [];
  for (const note of ranked) {
    if (note.timeBand === '深度') {
      // 单日深度名额用完后，后续深度动作自动推到下一天（ADR-0010）。
      if (quotaLeft > 0) {
        quotaLeft -= 1;
        kept.push(note);
      } else {
        pushed.push(note.id);
      }
      continue;
    }
    kept.push(note);
  }

  const cardNote = pickCard(kept, ctx);
  const cardEntry = cardNote === null ? null : byId.get(cardNote.id) ?? null;

  // 「接下来」：到了时段的日清项在前（当天必须还清），其余按排序，最多四条。
  const arrived = dailyEntries.filter((entry) => dailyArrived(entry.note, ctx));
  const rest = kept.filter((note) => cardNote === null || note.id !== cardNote.id);
  const next = [
    ...arrived.map((entry) => nextOf(entry.note, entry.containerKey, entry.containerName, 'daily')),
    ...rest.map((note) => {
      const entry = byId.get(note.id);
      return nextOf(note, entry?.containerKey ?? '', entry?.containerName ?? '', 'action');
    }),
  ].slice(0, NEXT_QUEUE_LIMIT);

  // 提醒位：等待清单里「到期没回」的。它永不占主卡，只在这里冒出来。
  const now = `${ctx.today} ${ctx.nowTime}`;
  const reminders = [];
  for (const entry of waitingEntries) {
    const replyDue = replyDueOf(entry.note, ctx);
    if (replyDue === null || replyDue > now) continue;
    reminders.push({
      id: entry.note.id,
      title: entry.note.title,
      container: entry.containerKey,
      containerName: entry.containerName,
      dueLocal: entry.note.dueLocal ?? null,
      replyDue,
    });
  }

  return {
    card: cardEntry === null ? null : cardOf(cardEntry.note, cardEntry.containerKey, cardEntry.containerName, ctx),
    next,
    reminders,
    daily: dailyEntries.map((entry) => dailyOf(entry.note)),
    deepQuotaUsed: quota - quotaLeft > 0,
    // 被推到下一天的深度动作（快照里要把它们标成「深度配额已用」）。
    pushed,
  };
}
