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

import { DEFAULT_CAPACITY_CONFIG, estimateOf, minutesOfClock } from './capacity.js';
import { isFocusNote } from './focus.js';
import { projectPointerOf } from './project.js';
import { requirementOf } from './requirement.js';

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
 * 上下文里的番茄分钟（估时的折算单位）。
 *
 * 番茄分钟是**容量参数**的一部分（ADR-0011）：上下文里没带就用通用默认值。
 * @param {object} context - 上下文（带 capacity）。
 * @returns {number} 番茄分钟数。
 */
function pomodoroOf(context) {
  const value = context?.capacity?.pomodoroMinutes;
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : DEFAULT_CAPACITY_CONFIG.番茄分钟;
}

/**
 * 两分钟规则的**通用默认值**（虚构值；本机可在 `local-config.json` 的「两分钟」字段里改）。
 *
 * - `enabled`：规则开着没有。开着的意思是「收集箱里两分钟能做完的捕获可以顶主卡位」。
 * - `maxMinutes`：阈值（分钟）。**不写死在判断逻辑里**——判断只读上下文里的这个数。
 * - `reviewWindow`：**日回顾窗口**（每天固定的一段时刻，`HH:mm`），也就是「整理收集箱」的时段。
 *
 * **「整理收集箱」的口径 = 当前时刻落在日回顾窗口内。**
 * GLOSSARY「日回顾」：每天一次、约 10 分钟，清空收集箱、把明天要动的动作排进时间档。
 *
 * 为什么不用「收集箱非空」当闸门：两分钟卡本身就在收集箱里，收集箱非空时它必然成立——
 * 那等于没有闸门，规则会在一天的任何时刻生效，琐事就把上午唯一的连续块切碎了（ADR-0010）。
 * 闸门必须落在**时刻**上。
 *
 * 默认窗口为什么落在下午尾段（14:45–15:00）：它必须**避开连续（深度）窗口**。
 * 默认容量参数里的连续窗口是 09:00–12:00，日回顾窗口若压在它上面，
 * 这条规则会被「深度块进行中」永久挡掉，等于没实现。
 */
export const DEFAULT_TWO_MINUTE_POLICY = {
  enabled: true,
  maxMinutes: 2,
  reviewWindow: { start: '14:45', end: '15:00' },
};

/**
 * 把一段时刻读成「起—止」；不合法就是 null。
 * @param {unknown} value - 候选值。
 * @returns {{ start: string, end: string } | null} 合法时给出，否则 null。
 */
function readReviewWindow(value) {
  if (value === null || typeof value !== 'object') return null;
  const start = typeof value.start === 'string' ? value.start.trim() : '';
  const end = typeof value.end === 'string' ? value.end.trim() : '';
  if (minutesOfClock(start) === null || minutesOfClock(end) === null) return null;
  // 止不晚于起：当成没配（跨零点的窗口不做，交给通用默认值兜着）。
  if (minutesOfClock(end) <= minutesOfClock(start)) return null;
  return { start, end };
}

/**
 * 把一份两分钟规则的参数读成可用形状（缺省用通用默认值）。
 *
 * 认得的字段：
 * - `enabled`：规则开着没有。**缺省即关**——上下文里没给 `enabled: true` 就不启用。
 * - `maxMinutes`：阈值（分钟）。缺省用通用默认值。
 * - `reviewWindow`：日回顾窗口 `{ start, end }`（`HH:mm`）。写坏了退回通用默认值。
 *
 * `allowed` **不在这里算**：它要看今天还有没有深度动作（那是整份快照的事），
 * 由 {@link twoMinuteStateOf} 算好后随上下文带下来。
 * @param {unknown} policy - 候选参数。
 * @returns {{ enabled: boolean, maxMinutes: number, reviewWindow: { start: string, end: string } }} 读好的参数。
 */
export function twoMinutePolicyOf(policy) {
  const source = policy !== null && typeof policy === 'object' ? policy : {};
  const maxMinutes =
    typeof source.maxMinutes === 'number' && Number.isFinite(source.maxMinutes) && source.maxMinutes > 0
      ? source.maxMinutes
      : DEFAULT_TWO_MINUTE_POLICY.maxMinutes;
  return {
    enabled: source.enabled === true,
    maxMinutes,
    reviewWindow: readReviewWindow(source.reviewWindow) ?? DEFAULT_TWO_MINUTE_POLICY.reviewWindow,
  };
}

/**
 * 当前时刻是不是落在日回顾窗口里。
 * @param {string} nowTime - 当前时刻（`HH:mm`）。
 * @param {{ start: string, end: string }} window - 日回顾窗口。
 * @returns {boolean} 在窗口里就是 true。
 */
function inReviewWindow(nowTime, window) {
  const now = minutesOfClock(nowTime);
  const start = minutesOfClock(window?.start);
  const end = minutesOfClock(window?.end);
  if (now === null || start === null || end === null) return false;
  return now >= start && now < end;
}

/**
 * 今天那个**深度名额**还挂着一条深度档动作没有。
 *
 * 「够格」= 执行清单里带唯一深度时间档的未完成动作——它会占掉今天那个深度名额。
 * @param {object[]} containers - 快照的容器组。
 * @returns {boolean} 还挂着就是 true。
 */
function deepPendingOf(containers) {
  const groups = Array.isArray(containers) ? containers : [];
  for (const group of groups) {
    if (group === null || typeof group !== 'object') continue;
    if (group.key !== 'execution') continue;
    const notes = Array.isArray(group.notes) ? group.notes : [];
    for (const note of notes) {
      if (note === null || typeof note !== 'object') continue;
      if (note.status !== undefined && note.status !== 0) continue;
      if (note.timeBand === '深度') return true;
    }
  }
  return false;
}

/**
 * **深度块进行中**没有。
 *
 * 口径（两个条件同时成立）：
 * 1. 当前时刻落在**连续窗口**内——连续窗口是深度块的地盘（ADR-0010「时段驱动」）；
 * 2. 今天的**深度名额还没被占用**：名额还挂着一条未完成的**深度档动作**
 *    （它会占掉今天那个名额；`深度.单日配额` 为 0 时没有深度块这一说）。
 *
 * 名额没人挂（今天没有深度档动作）时，那段时间就没被深度占着，两分钟卡可以抢位。
 * @param {object[]} containers - 快照的容器组。
 * @param {object} context - 上下文（带 capacity）。
 * @returns {boolean} 深度块进行中就是 true。
 */
function deepBlockInProgressOf(containers, context) {
  const capacity = context?.capacity;
  const window = capacity?.currentWindow ?? null;
  if (window === null || window.kind !== '连续') return false;
  const quota = typeof capacity.deepQuota === 'number' ? capacity.deepQuota : 1;
  if (quota <= 0) return false;
  return deepPendingOf(containers);
}

/**
 * 两分钟规则此刻的状态：允许不允许、为什么。
 *
 * 「整理收集箱」= 当前时刻落在**日回顾窗口**内；
 * 「深度块进行中」= 落在连续窗口内且今天的深度名额还挂着深度档动作。
 * 三个条件同时成立才允许两分钟卡抢主卡位：
 * **规则开着** ∧ **在日回顾窗口内** ∧ **深度块没有在跑**。
 *
 * 上下文里的 `allowed: false` 是**否决位**：上层可以按别的理由禁掉这条规则
 * （显式给 `false` 才否决；不给就按这里算出来的）。
 * @param {object[]} containers - 快照的容器组。
 * @param {object} context - 上下文（今天、当前时刻、容量、两分钟规则参数）。
 * @returns {{ enabled: boolean, maxMinutes: number, reviewWindow: object, inReviewWindow: boolean, deepBlockInProgress: boolean, allowed: boolean }} 状态。
 */
export function twoMinuteStateOf(containers, context) {
  const policy = twoMinutePolicyOf(context?.twoMinute);
  const inWindow = inReviewWindow(context?.nowTime, policy.reviewWindow);
  const deepBlock = deepBlockInProgressOf(containers, context);
  const vetoed = context?.twoMinute?.allowed === false;
  return {
    enabled: policy.enabled,
    maxMinutes: policy.maxMinutes,
    reviewWindow: policy.reviewWindow,
    inReviewWindow: inWindow,
    deepBlockInProgress: deepBlock,
    allowed: policy.enabled && !vetoed && inWindow && !deepBlock,
  };
}

/**
 * 收集箱里的捕获能不能走两分钟规则。
 *
 * 三个条件同时成立才走（规格 issue #1「焦点资格」第 7 条）：
 * 1. 规则开着（`twoMinute.enabled`）；
 * 2. **此刻允许**（`twoMinute.allowed`）——它由 {@link twoMinuteStateOf} 算好：
 *    在日回顾窗口内（= 整理收集箱）且深度块没有在跑；
 *    这一项**必须由调用方给**：深度块进行中与否要看今天还有没有深度动作，
 *    那是整份快照的事，单看一条便贴判不出来。
 * 3. **估时不超过阈值**——估时来自滴答已有的专注估算字段；
 *    **未估算（null）不算**：没有估时就不能说它两分钟能做完。
 * @param {object} note - 便贴。
 * @param {object} context - 上下文。
 * @returns {boolean} 走两分钟规则就是 true。
 */
function fitsTwoMinute(note, context) {
  const option = context?.twoMinute;
  if (option === null || typeof option !== 'object') return false;
  if (option.enabled !== true) return false;
  // 不在日回顾窗口内，或深度块正在跑 → 不抢主卡位（不报错、不空转）。
  if (option.allowed !== true) return false;
  const minutes = estimateOf(note, { pomodoroMinutes: pomodoroOf(context) }).minutes;
  if (minutes === null) return false;
  const max =
    typeof option.maxMinutes === 'number' && Number.isFinite(option.maxMinutes) && option.maxMinutes > 0
      ? option.maxMinutes
      : DEFAULT_TWO_MINUTE_POLICY.maxMinutes;
  return minutes <= max;
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
 * 7. 收集箱里未判定的捕获不进焦点——**唯一例外是两分钟规则**：
 *    估时不超过两分钟的捕获在**整理收集箱**（当前时刻落在日回顾窗口内）时直接顶到主卡位；
 *    深度块进行中（在连续窗口内且今天的深度名额还挂着深度档动作）不许抢位；
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
    // markdown 侧记录：主卡的完成要求从它来（与便贴上那一份同一口径）。
    records: Array.isArray(source.records) ? source.records : [],
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
 * 行动卡与「接下来」窄条**共用**的那几个字段。
 *
 * 形状只有这一份：主卡与「接下来」里那些被提升上来的窄条长得一样，
 * Client 侧直接用快照里 Host 给的字段，**不再自己重造一遍**（重造就会漂）。
 * @param {object} note - 便贴。
 * @param {string} containerKey - 容器标识。
 * @param {string} containerName - 容器名。
 * @param {object} context - 上下文。
 * @param {object} [options] - 选项。
 * @param {object | null} [options.project] - 卡脚的项目指针；推不出就是 null。
 * @returns {object} 卡片字段。
 */
function cardFieldsOf(note, containerKey, containerName, context, { project = null } = {}) {
  const estimate = estimateOf(note, { pomodoroMinutes: pomodoroOf(context) });
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
    // 完成要求：编号匹配到的 markdown 记录页的「验收标准」优先，否则回退正文 `完成要求：` 前缀；
    // 单一口径在 app/lib/requirement.js（便贴上的那一份也是它算的），source 标出它是从哪来的。
    requirement: requirementOf(note, context.records),
    // 预计耗时：null = 未估算（不是 0 分钟）。
    estimateMinutes: estimate.minutes,
    estimateSource: estimate.source,
    capacityHint: {
      // 装不装得下；未估算时为 null（未知），不装作知道。
      fits: estimate.minutes === null ? null : estimate.minutes <= limit,
      remainingMinutes: remaining,
      schedulableMinutes: context.capacity?.schedulableMinutes ?? 0,
    },
    // 卡脚的项目指针（规格故事 22–24）：推不出就是 null——缺就是缺，不编。
    project,
  };
}

/**
 * 装配主卡。
 * @param {object} note - 便贴。
 * @param {string} containerKey - 容器标识。
 * @param {string} containerName - 容器名。
 * @param {object} context - 上下文。
 * @param {object} [options] - 选项。
 * @param {boolean} [options.twoMinute] - 这张卡是不是两分钟卡（收集箱里直接做掉的那种）。
 * @param {object | null} [options.project] - 卡脚的项目指针。
 * @returns {object} 行动卡。
 */
function cardOf(note, containerKey, containerName, context, { twoMinute = false, project = null } = {}) {
  return {
    ...cardFieldsOf(note, containerKey, containerName, context, { project }),
    // 两分钟卡的引导标记：true = 这条是收集箱里「两分钟就能做完」的捕获，
    // 应当**直接做掉、别判定**。文案归 Client，Host 只给这个标记与事实。
    twoMinute: twoMinute === true,
  };
}

/**
 * 装配「接下来」窄条队列里的一条。
 *
 * 字段与主卡**同一份**（`cardFieldsOf`）：点一条窄条把它换成主卡时，
 * 换上来的卡带的是 Host 算好的那些事实，Client 不重造。
 * @param {object} note - 便贴。
 * @param {string} containerKey - 容器标识。
 * @param {string} containerName - 容器名。
 * @param {'action' | 'daily'} kind - 是动作还是日清项。
 * @param {object} context - 上下文。
 * @param {object} [options] - 选项。
 * @param {object | null} [options.project] - 卡脚的项目指针。
 * @returns {object} 窄条。
 */
function nextOf(note, containerKey, containerName, kind, context, { project = null } = {}) {
  return {
    ...cardFieldsOf(note, containerKey, containerName, context, { project }),
    kind,
    /* 「接下来」里的窄条都是已判定的动作，不是两分钟卡（两分钟卡不进队列）。 */
    twoMinute: false,
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
 * 全是纯函数：输入是快照的容器组与一份上下文（今天、当前时刻、容量、两分钟规则参数），
 * 输出是一个焦点对象。
 *
 * 主卡的归属有两条路：**正常候选**按 ADR-0010 挑（深度配额、时段偏好、逾期例外）；
 * **两分钟卡**（收集箱里估时不超过两分钟的捕获）在规则允许时**直接顶到主卡位**。
 * @param {object[]} containers - 快照的容器组。
 * @param {object} context - 上下文（今天、当前时刻、容量、两分钟规则参数）。
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

  // 两分钟规则此刻的状态（口径见 twoMinuteStateOf）：
  // 「整理收集箱」= 在日回顾窗口内；「深度块进行中」= 在连续窗口内且今天的深度名额还挂着深度档动作。
  const twoMinute = twoMinuteStateOf(groups, ctx);
  // 把状态带进上下文：资格判定（单条便贴）与下面的推导用的是**同一份**口径。
  const ctx2 = { ...ctx, twoMinute: { ...(ctx.twoMinute ?? {}), ...twoMinute } };

  const eligible = [];
  const twoMinuteEntries = [];
  const dailyEntries = [];
  const waitingEntries = [];
  for (const entry of entries) {
    const { eligible: ok, reason } = eligibilityOf(entry.note, entry.containerKey, ctx2);
    if (ok) {
      // 收集箱里唯一能有资格的条目就是两分钟卡（其余捕获都「收集箱未明晰」）。
      if (entry.containerKey === 'inbox') twoMinuteEntries.push(entry);
      else eligible.push(entry);
      continue;
    }
    if (reason === '日清常驻顶部') dailyEntries.push(entry);
    if (entry.containerKey === 'waiting') waitingEntries.push(entry);
  }

  // 排序 → 深度配额 → 主卡。
  const ranked = rankOf(
    eligible.map((entry) => entry.note),
    ctx2,
  );
  const byId = new Map(
    [...eligible, ...twoMinuteEntries].map((entry) => [entry.note.id, entry]),
  );
  const quota = typeof ctx2.capacity?.deepQuota === 'number' ? ctx2.capacity.deepQuota : 1;
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

  // 两分钟卡：**直接顶到主卡位**——它是要做掉的，不是排队等的。
  // 好几条都够两分钟时，按同一套排序取第一条（到期早的、id 小的先）。
  const twoMinuteRanked = rankOf(
    twoMinuteEntries.map((entry) => entry.note),
    ctx2,
  );
  const twoMinuteNote = twoMinuteRanked.length > 0 ? twoMinuteRanked[0] : null;

  // 正常候选的主卡（深度配额、时段偏好都在 pickCard 里）。
  const normalCard = pickCard(kept, ctx2);
  // 两分钟卡顶到主卡位：规则允许时，它就是现在该做的那一件。
  //
  // **不受「逾期优先」影响**：那一条例外说的是「不受**时段偏好**影响」，
  // 而两分钟规则不是时段偏好，是一条**资格例外**（GTD 的两分钟规则：当场做掉、别判定）。
  // 真的被它挤下去的逾期动作不会消失——它按排序进「接下来」的第一位。
  const cardNote = twoMinuteNote === null ? normalCard : twoMinuteNote;
  const cardEntry = cardNote === null ? null : byId.get(cardNote.id) ?? null;

  // 「接下来」：到了时段的日清项在前（当天必须还清），其余按排序，最多四条。
  // 两分钟卡**不进队列**：它要么占着主卡，要么还留在收集箱里等下一个日回顾窗口——
  // 队列是**已判定的动作**的队列，而两分钟卡正是「别判定、直接做掉」的那一类。
  const arrived = dailyEntries.filter((entry) => dailyArrived(entry.note, ctx2));
  const rest = kept.filter((note) => cardNote === null || note.id !== cardNote.id);
  const next = [
    ...arrived.map((entry) =>
      nextOf(entry.note, entry.containerKey, entry.containerName, 'daily', ctx2, {
        project: projectPointerOf(entry.note.record, groups),
      }),
    ),
    ...rest.map((note) => {
      const entry = byId.get(note.id);
      return nextOf(note, entry?.containerKey ?? '', entry?.containerName ?? '', 'action', ctx2, {
        project: projectPointerOf(note.record, groups),
      });
    }),
  ].slice(0, NEXT_QUEUE_LIMIT);

  // 提醒位：等待清单里「到期没回」的。它永不占主卡，只在这里冒出来。
  const now = `${ctx2.today} ${ctx2.nowTime}`;
  const reminders = [];
  for (const entry of waitingEntries) {
    const replyDue = replyDueOf(entry.note, ctx2);
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
    card:
      cardEntry === null
        ? null
        : cardOf(cardEntry.note, cardEntry.containerKey, cardEntry.containerName, ctx2, {
            twoMinute: twoMinuteNote !== null && cardEntry.note.id === twoMinuteNote.id,
            // 卡脚的项目指针：靠 markdown 记录编号与项目箱箱签的编号对上（app/lib/project.js）。
            project: projectPointerOf(cardEntry.note.record, groups),
          }),
    next,
    reminders,
    daily: dailyEntries.map((entry) => dailyOf(entry.note)),
    deepQuotaUsed: quota - quotaLeft > 0,
    // 被推到下一天的深度动作（快照里要把它们标成「深度配额已用」）。
    pushed,
    // 两分钟规则此刻的状态（Host 侧算好随快照过界，Client 不重算）。
    twoMinute,
  };
}
