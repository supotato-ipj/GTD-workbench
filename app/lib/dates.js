/**
 * 截止日文本（**粒度到天**）与时刻之间的换算（纯函数）。
 *
 * 「改期」的参数是**一天**：客户端给的是 `YYYY-MM-DD`，滴答那边要的却是带时刻的时间戳。
 * 换算规则只有一条，写在这里，别散落在别处：
 *
 * - 截止日 `YYYY-MM-DD` 按**给定时区**解释成那天的 `23:59:59`（一天结束的时刻）；
 * - 时区默认是**动作自己的时区**（滴答那侧是 `Asia/Shanghai`，ADR-0008），
 *   动作上没带才退回宿主时区。
 *
 * 换算与校验都是纯函数：不碰滴答、不碰 HTTP，也不读本机时钟。
 */

/** 截止日文本的形状：`YYYY-MM-DD`（粒度到天）。 */
export const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 可改期的年份下界（闭区间）。 */
export const DUE_DATE_MIN_YEAR = 1970;

/** 可改期的年份上界（闭区间）。 */
export const DUE_DATE_MAX_YEAR = 2999;

/**
 * 解析一个截止日文本。
 *
 * 三道关：形状必须是 `YYYY-MM-DD`、必须是**真实存在**的日期（`2026-02-30` 不存在）、
 * 年份必须在可改期范围内（`1900` 年、`3000` 年都不给改）。
 * @param {unknown} value - 候选文本。
 * @returns {{ ok: true, value: { text: string, year: number, month: number, day: number } }
 *   | { ok: false, message: string }} 解析结果；不合法时给出人能读的失败原因。
 */
export function parseDueDate(value) {
  if (typeof value !== 'string') {
    return { ok: false, message: '「dueDate」必须是字符串（YYYY-MM-DD，粒度到天）' };
  }
  const text = value.trim();
  if (!DUE_DATE_PATTERN.test(text)) {
    return {
      ok: false,
      message: `「dueDate」必须是 YYYY-MM-DD 格式（粒度到天，不接受带时刻的字符串）：${text}`,
    };
  }
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  if (year < DUE_DATE_MIN_YEAR || year > DUE_DATE_MAX_YEAR) {
    return {
      ok: false,
      message: `「dueDate」的年份超出可改期范围（${DUE_DATE_MIN_YEAR}–${DUE_DATE_MAX_YEAR}）：${text}`,
    };
  }
  // 真实存在的日期：2 月 30 日、4 月 31 日都不存在。
  // （年份先过了范围，所以 Date.UTC 不会把 0–99 映射到 1900 年代。）
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return { ok: false, message: `「dueDate」不是真实存在的日期：${text}` };
  }
  return { ok: true, value: { text, year, month, day } };
}

/**
 * 某个时刻在指定时区里的「墙上时间」与真实时刻差多少（毫秒）。
 *
 * 用 `Intl.DateTimeFormat` 取时区里的年月日时分秒，再当成 UTC 读一遍——
 * 和 UTC 的差就是这个时区的偏移。不用手算偏移：偏移会随夏令时变。
 * @param {Date} instant - 真实时刻。
 * @param {string} timeZone - IANA 时区名。
 * @returns {number} 偏移毫秒（东八区是 `+28800000`）。
 */
function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const wall = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour'),
    pick('minute'),
    pick('second'),
  );
  return wall - instant.getTime();
}

/**
 * 截止日那天的 `23:59:59`（给定时区）对应哪个真实时刻。
 *
 * 「粒度到天」的含义：**那一天的结束时刻**。这样一条今天改到今天的动作，
 * 在这一天里都不会显得已经过期。
 * @param {string} dateText - 截止日文本（`YYYY-MM-DD`）。
 * @param {string} timeZone - 解释这个日期的时区（IANA 名）。
 * @returns {Date | null} 真实时刻；日期非法时为 null。
 */
export function endOfDayInstant(dateText, timeZone) {
  const parsed = parseDueDate(dateText);
  if (!parsed.ok) return null;
  const { year, month, day } = parsed.value;
  // 先把墙上时间当成 UTC，再按该时区的偏移校正（夏令时切换那天要校正两次）。
  const wall = Date.UTC(year, month - 1, day, 23, 59, 59);
  let instant = wall;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = wall - zoneOffsetMs(new Date(instant), timeZone);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

/**
 * 把时刻写成滴答 CLI 要的时间戳（`yyyy-MM-ddTHH:mm:ss+0000`）。
 *
 * 滴答那边的时间戳带显式偏移；这里统一写 UTC（`+0000`），
 * 偏移本身由 `--due-date` 里的这个后缀说明，不靠猜。
 * @param {Date} instant - 真实时刻。
 * @returns {string} 时间戳文本。
 */
export function cliTimestamp(instant) {
  const pad = (value) => String(value).padStart(2, '0');
  const date = `${instant.getUTCFullYear()}-${pad(instant.getUTCMonth() + 1)}-${pad(instant.getUTCDate())}`;
  const time = `${pad(instant.getUTCHours())}:${pad(instant.getUTCMinutes())}:${pad(instant.getUTCSeconds())}`;
  return `${date}T${time}+0000`;
}
