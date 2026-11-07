/**
 * 容量计算（纯逻辑）。
 *
 * GLOSSARY「可排时间」：名义工时扣掉日清之后、理论上能装任务的那部分时间。
 * 它**随可用窗口与插入损耗变动，由插件实时算出，不落配置**（ADR-0011）。
 *
 * 所以这个模块里：
 * - **配置只存输入**：窗口、不可占、日清、插入损耗、深度一组、番茄分钟。
 *   没有任何一个字段是「今天还剩多少」这种推导值——推导值会与输入不同步。
 * - **推导实时算**：`capacityFor(now, config)` 每次调用都从输入重新算一遍。
 *
 * 公开仓库只提供**通用默认值**（`DEFAULT_CAPACITY_CONFIG`），示例值全是虚构的：
 * 真实容量数值属于个人的工作容量，不进本仓库（ADR-0011、AGENTS.md 的隐私线）。
 * 本机真实值由后续一票从本机配置读进来，从 `capacityFor` 的 `config` 形参注入。
 *
 * 配置形状与 ADR-0011 内联的形状一致（字段名是中文，因为那份文件就是给会话里的 agent 写的）：
 *
 * ```jsonc
 * {
 *   "定于": "YYYY-MM-DD",
 *   "窗口":   [{ "起": "09:00", "止": "12:00", "类": "连续" }, …],
 *   "不可占": [{ "起": "12:00", "止": "13:30", "说明": "午休" }],
 *   "日清":   [{ "名": "示例固定成本", "时段": "09:00", "成本分": 15 }],
 *   "插入损耗分钟": 45,
 *   "深度":   { "单日上限分钟": 180, "单日配额": 1, "估时系数": 2 },
 *   "番茄分钟": 25
 * }
 * ```
 *
 * `窗口` 条目上的 `类` 是本模块对 ADR-0011 形状的**唯一扩展**：`连续` 的窗口适合派深度活，
 * `可打断` 的窗口适合派事务活（ADR-0010「时段驱动」）。不写就按 `可打断` 算。
 */

/** 通用默认容量配置。示例值全部虚构，真实值不进本仓库（ADR-0011）。 */
export const DEFAULT_CAPACITY_CONFIG = {
  // 参数定于哪一天；null = 未定（用的是通用默认值，不是这个人的一天）。
  定于: null,
  窗口: [
    { 起: '09:00', 止: '12:00', 类: '连续' },
    { 起: '13:30', 止: '16:00', 类: '可打断' },
  ],
  不可占: [{ 起: '12:00', 止: '13:30', 说明: '午休' }],
  日清: [{ 名: '示例固定成本', 时段: '09:00', 成本分: 15 }],
  插入损耗分钟: 45,
  深度: { 单日上限分钟: 180, 单日配额: 1, 估时系数: 2 },
  番茄分钟: 25,
};

/** 窗口的两种性质：连续（不被打断，派深度）／可打断（能随时停下，派事务）。 */
export const WINDOW_KINDS = ['连续', '可打断'];

/**
 * 把 `HH:mm` 换成当天第几分钟。
 * @param {unknown} text - 时刻文本。
 * @returns {number | null} 分钟数；文本非法时为 null。
 */
export function minutesOfClock(text) {
  if (typeof text !== 'string') return null;
  const matched = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (matched === null) return null;
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (hour > 24 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * 两段时间的重叠长度。
 * @param {number} leftStart - 左边起点（分钟）。
 * @param {number} leftEnd - 左边终点（分钟）。
 * @param {number} rightStart - 右边起点（分钟）。
 * @param {number} rightEnd - 右边终点（分钟）。
 * @returns {number} 重叠的分钟数。
 */
function overlapMinutes(leftStart, leftEnd, rightStart, rightEnd) {
  const start = Math.max(leftStart, rightStart);
  const end = Math.min(leftEnd, rightEnd);
  return end > start ? end - start : 0;
}

/**
 * 把配置里的窗口、不可占、日清读成算得动的形状；坏条目直接丢掉，不抛。
 * @param {object} config - 容量配置。
 * @returns {object} 归一化后的输入。
 */
function readConfig(config) {
  const source = config !== null && typeof config === 'object' ? config : {};
  const windows = [];
  for (const window of Array.isArray(source.窗口) ? source.窗口 : []) {
    if (window === null || typeof window !== 'object') continue;
    const start = minutesOfClock(window.起);
    const end = minutesOfClock(window.止);
    if (start === null || end === null || end <= start) continue;
    const kind = WINDOW_KINDS.includes(window.类) ? window.类 : '可打断';
    windows.push({ start, end, startText: window.起, endText: window.止, kind });
  }
  const blocked = [];
  for (const segment of Array.isArray(source.不可占) ? source.不可占 : []) {
    if (segment === null || typeof segment !== 'object') continue;
    const start = minutesOfClock(segment.起);
    const end = minutesOfClock(segment.止);
    if (start === null || end === null || end <= start) continue;
    blocked.push({ start, end });
  }
  const daily = [];
  for (const item of Array.isArray(source.日清) ? source.日清 : []) {
    if (item === null || typeof item !== 'object') continue;
    const minutes = typeof item.成本分 === 'number' && Number.isFinite(item.成本分) ? item.成本分 : 0;
    const at = minutesOfClock(item.时段);
    daily.push({ name: typeof item.名 === 'string' ? item.名 : '', minutes, at });
  }
  const interruption =
    typeof source.插入损耗分钟 === 'number' && Number.isFinite(source.插入损耗分钟)
      ? source.插入损耗分钟
      : 0;
  const deep = source.深度 !== null && typeof source.深度 === 'object' ? source.深度 : {};
  const deepQuota =
    typeof deep.单日配额 === 'number' && Number.isFinite(deep.单日配额) ? deep.单日配额 : 1;
  const deepDailyCapMinutes =
    typeof deep.单日上限分钟 === 'number' && Number.isFinite(deep.单日上限分钟)
      ? deep.单日上限分钟
      : 0;
  const estimateMultiplier =
    typeof deep.估时系数 === 'number' && Number.isFinite(deep.估时系数) ? deep.估时系数 : 1;
  const pomodoroMinutes =
    typeof source.番茄分钟 === 'number' && Number.isFinite(source.番茄分钟) ? source.番茄分钟 : 25;
  const asOf = typeof source.定于 === 'string' && source.定于.length > 0 ? source.定于 : null;
  return {
    windows,
    blocked,
    daily,
    interruption,
    deepQuota,
    deepDailyCapMinutes,
    estimateMultiplier,
    pomodoroMinutes,
    asOf,
  };
}

/**
 * 取「现在」在本地时钟上的位置。
 * @param {object | Date | undefined} now - 参照时刻；给 `{ date, time }` 就按它算，给 Date 就取本机本地时间。
 * @returns {{ date: string, time: string, minutes: number }} 本地日期、时刻与当天分钟数。
 */
function localNow(now) {
  if (now instanceof Date && !Number.isNaN(now.getTime())) {
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { date, time: `${hours}:${minutes}`, minutes: now.getHours() * 60 + now.getMinutes() };
  }
  const source = now !== null && typeof now === 'object' ? now : {};
  const time = typeof source.time === 'string' ? source.time : '00:00';
  const minutes = minutesOfClock(time);
  return {
    date: typeof source.date === 'string' ? source.date : '',
    time,
    minutes: minutes === null ? 0 : minutes,
  };
}

/**
 * 算今天的容量。
 *
 * 可排时间 = 窗口时长 − 日清成本 − 插入损耗；剩余可排时间 = 从现在起还剩的窗口时长
 * − 还没到时段的日清成本 − 插入损耗。两者都**实时算**，不落配置（ADR-0011）。
 * @param {object | Date} now - 参照时刻（本地时钟：`{ date, time }`）。
 * @param {object} [config] - 容量配置；不给就用通用默认值。
 * @returns {object} 今天的容量。
 */
export function capacityFor(now, config = DEFAULT_CAPACITY_CONFIG) {
  // 显式传 null 也当「没给配置」：退回通用默认值，不给出一个全 0 的假容量。
  const input = readConfig(config === null || config === undefined ? DEFAULT_CAPACITY_CONFIG : config);
  const clock = localNow(now);

  const windows = input.windows.map((window) => {
    // 不可占的段从窗口里扣掉：午休不是可支配时间。
    let blocked = 0;
    for (const segment of input.blocked) {
      blocked += overlapMinutes(window.start, window.end, segment.start, segment.end);
    }
    return { ...window, minutes: window.end - window.start - blocked };
  });

  const windowMinutes = windows.reduce((sum, window) => sum + window.minutes, 0);
  const dailyMinutes = input.daily.reduce((sum, item) => sum + item.minutes, 0);
  const schedulableMinutes = Math.max(0, windowMinutes - dailyMinutes - input.interruption);

  const remainingWindowMinutes = windows.reduce((sum, window) => {
    if (clock.minutes <= window.start) return sum + window.minutes;
    if (clock.minutes < window.end) return sum + (window.end - clock.minutes);
    return sum;
  }, 0);
  // 日清成本按「时段」计：时段已经过去的算已经花掉了，还没到的才算今天的剩余负担。
  const remainingDailyMinutes = input.daily.reduce((sum, item) => {
    if (item.at === null || item.at > clock.minutes) return sum + item.minutes;
    return sum;
  }, 0);
  const remainingMinutes = Math.max(
    0,
    remainingWindowMinutes - remainingDailyMinutes - input.interruption,
  );

  const current = windows.find((window) => clock.minutes >= window.start && clock.minutes < window.end) ?? null;

  return {
    // 容量参数来源标记：null = 未定于某日（用的是通用默认值）。
    asOf: input.asOf,
    date: clock.date,
    time: clock.time,
    windows: windows.map((window) => ({
      start: window.startText,
      end: window.endText,
      kind: window.kind,
      minutes: window.minutes,
    })),
    // 当前所处的时间窗口；落在窗口外（插入损耗、临时离岗、加班）时为 null——不是错，是「按实际位置重算」。
    currentWindow:
      current === null
        ? null
        : {
            start: current.startText,
            end: current.endText,
            kind: current.kind,
            minutes: current.minutes,
            remainingMinutes: current.end - clock.minutes,
          },
    windowMinutes,
    dailyMinutes,
    interruptionMinutes: input.interruption,
    schedulableMinutes,
    remainingMinutes,
    // 深度名额是**参数**，不写死在代码里（ADR-0010）。
    deepQuota: input.deepQuota,
    deepDailyCapMinutes: input.deepDailyCapMinutes,
    estimateMultiplier: input.estimateMultiplier,
    pomodoroMinutes: input.pomodoroMinutes,
  };
}

/**
 * 一条动作的预计耗时（分钟）与它的来源。
 *
 * 来源是滴答任务 JSON 里的 `focusSummaries.estimatedPomo` 与 `focusSummaries.estimatedDuration`
 * （**不在顶层**）。口径：
 * - 估时分钟 = `estimatedPomo` × 番茄分钟；
 * - `estimatedPomo` 为 0 或缺失 = **未估算**（不是 0 分钟）；
 * - `estimatedDuration` 作备选，**单位按分钟处理——这是假设**，见 app/README.md。
 * @param {object} note - 便贴（带 estimatePomo / estimateDuration）。
 * @param {object} [options] - 选项。
 * @param {number} [options.pomodoroMinutes] - 一个番茄多少分钟，默认 25。
 * @returns {{ minutes: number | null, source: string | null }} 分钟数与来源；未估算时 minutes 为 null。
 */
export function estimateOf(note, { pomodoroMinutes = 25 } = {}) {
  if (note === null || typeof note !== 'object') return { minutes: null, source: null };
  const pomo = note.estimatePomo;
  if (typeof pomo === 'number' && Number.isFinite(pomo) && pomo > 0) {
    const minutes = typeof pomodoroMinutes === 'number' && Number.isFinite(pomodoroMinutes)
      ? pomodoroMinutes
      : 25;
    return { minutes: pomo * minutes, source: 'estimatedPomo' };
  }
  const duration = note.estimateDuration;
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    return { minutes: duration, source: 'estimatedDuration' };
  }
  return { minutes: null, source: null };
}

/**
 * 一条动作的预计耗时（分钟）。
 *
 * 口径见 {@link estimateOf}：番茄数 × 番茄分钟；番茄数缺失或为 0 = **未估算**（不是 0 分钟）；
 * `estimatedDuration` 作备选，单位按分钟处理（这是假设）。
 * @param {object} note - 便贴（带 estimatePomo / estimateDuration）。
 * @param {object} [options] - 选项。
 * @param {number} [options.pomodoroMinutes] - 一个番茄多少分钟，默认 25。
 * @returns {number | null} 预计分钟数；未估算时为 null。
 */
export function estimateMinutes(note, options = {}) {
  return estimateOf(note, options).minutes;
}

/**
 * 这件东西今天装不装得下。
 * @param {object} capacity - 今天���容量。
 * @param {number} minutes - 预计耗时（分钟）。
 * @returns {boolean} 装得下就是 true。
 */
export function fitsWithin(capacity, minutes) {
  if (capacity === null || typeof capacity !== 'object') return false;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return false;
  return minutes <= capacity.remainingMinutes;
}
