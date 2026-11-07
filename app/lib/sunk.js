/**
 * 已沉底区的组装（纯逻辑）。
 *
 * GLOSSARY「已沉底」：滴答里已勾选完成的条目在工作台上的归集区，按天堆叠。
 * 它是**展示区，不是回收箱**——回收箱不建，直接删（ADR-0004）。
 * 所以这里只做「把已完成的条目按完成日摆好」，不提供删除、不提供归还。
 *
 * 完成情况 = 滴答的 `status === 2`（ADR-0006）。单口径，没有第二口径，也没有核销台账。
 * **已知代价**：勾选失真会如实呈现——11/4 15:08 那批三条同刻批量勾选也会被算作完成。
 */

/** 已沉底区只看最近七天（ADR-0007），更早的不上画布。 */
export const SUNK_WINDOW_DAYS = 7;

/** 一天多少毫秒。 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 把一个时刻在指定时区里的本地日期取出来。
 * @param {string | null | undefined} iso - 时刻（滴答的 `completedTime`，UTC 带 +0000）。
 * @param {string} timeZone - 目标时区。
 * @returns {{ date: string, time: string } | null} 本地日期与时刻；非法时为 null。
 */
export function localStampOf(iso, timeZone) {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const date = `${pick('year')}-${pick('month')}-${pick('day')}`;
  const time = `${pick('hour')}:${pick('minute')}`;
  if (date.length < 10 || time.length < 5) return null;
  return { date, time };
}

/**
 * 日期文本加减天数。全走 UTC，避免本地时区把「加一天」算歪。
 * @param {string} dateText - `YYYY-MM-DD`。
 * @param {number} days - 要加的天数（可为负）。
 * @returns {string | null} 新日期文本；原文本非法时为 null。
 */
export function shiftDate(dateText, days) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof dateText === 'string' ? dateText : '');
  if (matched === null) return null;
  const stamp = Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])) + days * DAY_MS;
  const date = new Date(stamp);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * 已沉底窗口的起止日期（含当天）。
 * @param {string} today - 本地时间的今天，`YYYY-MM-DD`。
 * @param {number} [windowDays] - 窗口天数，默认七天。
 * @returns {{ from: string, to: string }} 起止日期。
 */
export function windowOf(today, windowDays = SUNK_WINDOW_DAYS) {
  const from = shiftDate(today, -(windowDays - 1));
  return { from: from === null ? today : from, to: today };
}

/**
 * 组装已沉底区。
 *
 * 输入是 `dida task completed` 的原始结果（跨清单混在一起的扁平数组），靠 `projectId` 归箱。
 * 落在窗口外、或归不到任何一个纸箱的条目一律丢掉——已沉底区只摆六个纸箱里的东西。
 * @param {object} options - 选项。
 * @param {object[]} options.tasks - 已完成的原始任务。
 * @param {object[]} options.containers - 六个纸箱（要有 key 与 projectId）。
 * @param {string} options.timeZone - 目标时区。
 * @param {string} options.today - 本地时间的今天。
 * @param {number} [options.windowDays] - 窗口天数，默认七天。
 * @returns {{ windowDays: number, from: string, to: string, days: object[], counts: object }} 已沉底区。
 */
export function sunkOf({ tasks, containers, timeZone, today, windowDays = SUNK_WINDOW_DAYS }) {
  const { from, to } = windowOf(today, windowDays);
  const keyByProject = new Map();
  for (const container of Array.isArray(containers) ? containers : []) keyByProject.set(container.projectId, container.key);

  const counts = {};
  for (const container of Array.isArray(containers) ? containers : []) counts[container.key] = 0;
  const byDay = new Map();

  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task === null || typeof task !== 'object') continue;
    // 完成情况只认滴答勾选（ADR-0006）；`task completed` 给的本来就是已完成，再核一次状态防手滑。
    if (task.status !== 2) continue;
    const containerKey = keyByProject.get(task.projectId);
    if (containerKey === undefined) continue;
    const stamp = localStampOf(task.completedTime, timeZone);
    if (stamp === null) continue;
    // 只保留最近七天，更早的不上画布。
    if (stamp.date < from || stamp.date > to) continue;

    counts[containerKey] += 1;
    if (!byDay.has(stamp.date)) byDay.set(stamp.date, []);
    byDay.get(stamp.date).push({
      id: String(task.id ?? ''),
      title: typeof task.title === 'string' ? task.title : '',
      container: containerKey,
      completedAt: new Date(task.completedTime).toISOString(),
      completedTime: stamp.time,
    });
  }

  const days = [...byDay.entries()]
    .map(([date, notes]) => ({
      date,
      // 同一天内按完成时刻先后排，读起来像「这一天做了什么」。
      notes: notes.sort((left, right) => {
        if (left.completedAt !== right.completedAt) return left.completedAt < right.completedAt ? -1 : 1;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      }),
    }))
    // 最近的日期在最上面：越往下越久，这就是「沉底」。
    .sort((left, right) => (left.date < right.date ? 1 : left.date > right.date ? -1 : 0));

  return { windowDays, from, to, days, counts };
}
