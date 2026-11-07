/**
 * 天刻度时间轴的分段规则（ADR-0007）。
 *
 * 纸箱里那条**天刻度时间轴**有四段：`今天 / 明天 / 本周 / 以后`。
 * 选天不选周的理由在 ADR-0007：《工作容量》整份按天排（可用窗口 8:30–11:30、12:00–15:00），
 * 「深度任务一天只排 1 个」是已经付出代价验证过的判断，天刻度能一眼把违规顶出来。
 *
 * 这一层是**纯函数**：只做日期判定，不读时钟、不碰滴答、不写任何文件。
 * 渲染层只负责画（Client 半边不重算分段，只按快照里已经算好的段去画）。
 *
 * 几条口径（都写死在这里，并由 `test/timeline.test.js` 测住）：
 *
 * 1. **基准是本地时间的今天**。`Asia/Shanghai` 是滴答那侧的口径（ADR-0008），
 *    只用来把滴答的 UTC 到期时间换算成日期；「今天」按跑工作台那台机器的本地时区算。
 * 2. **一段只归一段**，判定顺序是 今天 → 明天 → 本周 → 以后：
 *    - 今天：截止日就是今天。
 *    - 明天：截止日是今天 + 1 天（哪怕它落在本周之内，也归明天，不与本周重复）。
 *    - 本周：今天之后、到**本周日（含）**为止。一周从周一开始，周日是最后一天。
 *    - 以后：本周日之后。
 * 3. **没有截止日的条目归「以后」**：它不承诺具体某一天，而「以后」正是唯一不承诺某天的段；
 *    段默认折叠，所以它不占用今天的注意力，但计数条看得见它，不静默消失。
 * 4. **过期未完成的条目归「今天」并标出逾期**：时间轴排的是行动顺序，不是历史；
 *    过期的事必须在今天被处理，埋进「以后」等于把它藏起来。
 */

/** 时间轴的四段，顺序固定：今天、明天、本周、以后。 */
export const SEGMENTS = ['today', 'tomorrow', 'thisWeek', 'later'];

/** 默认展开的视野：只铺今天与本周，其余折叠成一条计数（ADR-0007）。 */
export const DEFAULT_EXPANDED_SEGMENTS = ['today', 'thisWeek'];

/** 一天多少毫秒。日期算术全走 UTC，避免本地时区把「加一天」算歪。 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 把 `YYYY-MM-DD` 文本解析成 UTC 毫秒时间戳。
 * @param {unknown} text - 日期文本。
 * @returns {number | null} 时间戳；文本非法或不是真实日期时为 null。
 */
function parseDateText(text) {
  if (typeof text !== 'string') return null;
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (matched === null) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const stamp = Date.UTC(year, month - 1, day);
  const back = new Date(stamp);
  // 2026-02-30 这种「看着像日期」的日子要挡掉。
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return null;
  return stamp;
}

/**
 * 把 UTC 毫秒时间戳写回 `YYYY-MM-DD` 文本。
 * @param {number} stamp - 时间戳。
 * @returns {string} 日期文本。
 */
function formatDateText(stamp) {
  const date = new Date(stamp);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * 日期加减天数。
 * @param {string} dateText - `YYYY-MM-DD`。
 * @param {number} days - 要加的天数（可以是负数）。
 * @returns {string | null} 新的日期文本；原文本非法时为 null。
 */
export function addDays(dateText, days) {
  const stamp = parseDateText(dateText);
  if (stamp === null) return null;
  return formatDateText(stamp + days * DAY_MS);
}

/**
 * 本周最后一天（周日）。一周从周一开始，周日是最后一天。
 * @param {string} dateText - `YYYY-MM-DD`。
 * @returns {string | null} 本周日；日期非法时为 null。
 */
export function sundayOfWeek(dateText) {
  const stamp = parseDateText(dateText);
  if (stamp === null) return null;
  const weekday = new Date(stamp).getUTCDay(); // 0 = 周日
  const daysToSunday = weekday === 0 ? 0 : 7 - weekday;
  return formatDateText(stamp + daysToSunday * DAY_MS);
}

/**
 * 取一个时刻在指定时区里的本地日期。
 * @param {Date} instant - 时刻。
 * @param {string} timeZone - IANA 时区名。
 * @returns {string | null} `YYYY-MM-DD`；时刻非法时为 null。
 */
export function localDateText(instant, timeZone) {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  if (year === '' || month === '' || day === '') return null;
  return `${year}-${month}-${day}`;
}

/**
 * 时间轴的边界：以今天为基准的四段分界。
 * @param {string} today - 本地时间的今天，`YYYY-MM-DD`。
 * @returns {{ today: string, tomorrow: string, weekEnd: string, laterFrom: string }} 边界。
 */
export function timelineFor(today) {
  const weekEnd = sundayOfWeek(today);
  return {
    today,
    tomorrow: addDays(today, 1),
    weekEnd: weekEnd === null ? today : weekEnd,
    laterFrom: weekEnd === null ? today : addDays(weekEnd, 1),
  };
}

/**
 * 一个截止日落在哪一段。
 * @param {string | null | undefined} dueDate - 截止日的本地日期，`YYYY-MM-DD`；没有截止日为 null。
 * @param {string} today - 本地时间的今天，`YYYY-MM-DD`。
 * @returns {'today' | 'tomorrow' | 'thisWeek' | 'later'} 段名。
 */
export function segmentOf(dueDate, today) {
  const todayStamp = parseDateText(today);
  const dueStamp = parseDateText(dueDate);
  // 没有截止日（或日期非法）→ 以后：不承诺具体某一天，也绝不静默消失。
  if (dueStamp === null || todayStamp === null) return 'later';
  if (dueStamp === todayStamp) return 'today';
  // 过期未完成 → 今天：时间轴排的是行动顺序，过期的事得今天还清。
  if (dueStamp < todayStamp) return 'today';
  if (dueStamp === todayStamp + DAY_MS) return 'tomorrow';
  const weekEnd = parseDateText(sundayOfWeek(today));
  if (weekEnd !== null && dueStamp > todayStamp && dueStamp <= weekEnd) return 'thisWeek';
  return 'later';
}

/**
 * 一个截止日是不是已经过期（早于今天）。
 * @param {string | null | undefined} dueDate - 截止日的本地日期。
 * @param {string} today - 本地时间的今天。
 * @returns {boolean} 是否逾期。
 */
export function isOverdue(dueDate, today) {
  const todayStamp = parseDateText(today);
  const dueStamp = parseDateText(dueDate);
  if (dueStamp === null || todayStamp === null) return false;
  return dueStamp < todayStamp;
}
