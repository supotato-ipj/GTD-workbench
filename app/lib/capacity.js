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
 *
 * 口径（ADR-0011 修订）：
 * - **窗口时长** = 窗口扣掉不可占段之后的可支配时长；
 * - **日清成本**分两拨：落在可用窗口内的从可排时间里扣，落在窗口外的不占可排时间
 *   （那个时刻本来就不装活），但仍然算进「今日日清」的总数；
 * - **插入损耗**按全天全额预留（保守口径）；
 * - 可排时间与剩余可排时间**都不为负**。
 *
 * `深度.估时系数` **不参与估时**（估时改用滴答的专注估算字段），它是惰性字段：
 * 保留在形状里是为了不破坏既有配置，但别以为它还在起作用。
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
 * 某个时刻落在**可用窗口**里没有。
 *
 * 「可用窗口」= 窗口扣掉与不可占段重叠的那部分：
 * 午休那段既不是窗口，也不是可支配时间——落在那里的日清项不占可排时间。
 * @param {number | null} at - 时刻（当天第几分钟）；null = 时段没写。
 * @param {object[]} windows - 窗口。
 * @param {object[]} blocked - 不可占段。
 * @returns {boolean} 落在可用窗口里就是 true。
 */
function isAtAvailableInWindow(at, windows, blocked) {
  // 时段没写（写坏了）：当它是今天的固定成本，保守地按「落在窗口内」算——
  // 宁可少报可排时间，也不要报一个装不下的数。
  if (at === null) return true;
  for (const window of windows) {
    if (at < window.start || at >= window.end) continue;
    const inBlocked = blocked.some((segment) => at >= segment.start && at < segment.end);
    if (!inBlocked) return true;
  }
  return false;
}

/**
 * 一个窗口扣掉与不可占段重叠的部分之后，还剩下哪些**可支配**片段。
 *
 * 午休不是可支配时间：窗口 09:00–13:00 里午休 12:00–13:00 时，可用片段只有 09:00–12:00。
 * @param {object} window - 窗口（`start`／`end` 是分钟）。
 * @param {object[]} blocked - 不可占段。
 * @returns {object[]} 可支配片段（`start`／`end` 是分钟）。
 */
function availableSegmentsOf(window, blocked) {
  const segments = [];
  const sorted = [...blocked].sort((left, right) => left.start - right.start);
  let cursor = window.start;
  for (const segment of sorted) {
    if (segment.end <= cursor) continue;
    if (segment.start >= window.end) break;
    if (segment.start > cursor) segments.push({ start: cursor, end: segment.start });
    cursor = Math.max(cursor, segment.end);
  }
  if (cursor < window.end) segments.push({ start: cursor, end: window.end });
  return segments;
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
 * 把一份配置算成「今天一共有多少可排时间」的那几个数（纯函数，不看时钟）。
 *
 * 口径（ADR-0011 修订）：
 * - 窗口时长 = 窗口扣掉不可占段之后的**可支配**时长；
 * - 日清成本分两拨：落在可用窗口内的从可排时间里扣，落在窗口外的不占可排时间
 *   （但仍然算进「今日日清」的总数）；
 * - 插入损耗按**全天全额**预留（保守口径）；
 * - 可排时间不为负——不够就是 0，不报负数。
 * @param {object} config - 容量配置。
 * @returns {object} 归一化后的输入与算出来的数。
 */
function analyze(config) {
  // 显式传 null 也当「没给配置」：退回通用默认值，不给出一个全 0 的假容量。
  const input = readConfig(config === null || config === undefined ? DEFAULT_CAPACITY_CONFIG : config);

  const windows = input.windows.map((window) => {
    // 不可占的段从窗口里扣掉：午休不是可支配时间。
    const segments = availableSegmentsOf(window, input.blocked);
    const minutes = segments.reduce((sum, segment) => sum + (segment.end - segment.start), 0);
    return { ...window, segments, minutes };
  });

  const windowMinutes = windows.reduce((sum, window) => sum + window.minutes, 0);
  // 日清分两拨（ADR-0011 修订）：
  // - 落在**可用窗口内**的：从可排时间里扣——它要占掉窗口里的时间。
  // - 落在**窗口外**的：不占可排时间（那个时刻本来就不装活），但仍然是今天的固定成本，
  //   仍然进顶部「今日日清未还几笔」的统计。
  const daily = input.daily.map((item) => ({
    ...item,
    inWindow: isAtAvailableInWindow(item.at, input.windows, input.blocked),
  }));
  const dailyMinutes = daily.reduce((sum, item) => sum + item.minutes, 0);
  const dailyMinutesInWindow = daily.reduce(
    (sum, item) => sum + (item.inWindow ? item.minutes : 0),
    0,
  );
  const dailyMinutesOutsideWindow = dailyMinutes - dailyMinutesInWindow;
  const schedulableMinutes = Math.max(
    0,
    windowMinutes - dailyMinutesInWindow - input.interruption,
  );

  return {
    input,
    windows,
    daily,
    windowMinutes,
    dailyMinutes,
    dailyMinutesInWindow,
    dailyMinutesOutsideWindow,
    interruptionMinutes: input.interruption,
    schedulableMinutes,
  };
}

/**
 * 今天的**可排时间**（纯函数，不看时钟）。
 *
 * 口径见 {@link analyze}：窗口时长 − 落在可用窗口内的日清成本 − 插入损耗。
 * 这是容量口径里唯一的那一处推导，抽成独立函数是为了能单独喂一份配置断言它。
 * @param {object} [config] - 容量配置；不给就用通用默认值。
 * @returns {object} 窗口时长、日清成本（总数／窗口内／窗口外）、插入损耗与可排时间。
 */
export function schedulableMinutesOf(config = DEFAULT_CAPACITY_CONFIG) {
  const { windowMinutes, dailyMinutes, dailyMinutesInWindow, dailyMinutesOutsideWindow, interruptionMinutes, schedulableMinutes } =
    analyze(config);
  return {
    windowMinutes,
    dailyMinutes,
    dailyMinutesInWindow,
    dailyMinutesOutsideWindow,
    interruptionMinutes,
    schedulableMinutes,
  };
}

/**
 * 算今天的容量。
 *
 * 可排时间 = 窗口时长 − **落在可用窗口内的**日清成本 − 插入损耗；
 * 剩余可排时间 = 从现在起还剩的可支配窗口时长 − 还没到时段的（窗口内的）日清成本 − 插入损耗。
 * 两者都**实时算**，不落配置（ADR-0011）。
 * @param {object | Date} now - 参照时刻（本地时钟：`{ date, time }`）。
 * @param {object} [config] - 容量配置；不给就用通用默认值。
 * @returns {object} 今天的容量。
 */
export function capacityFor(now, config = DEFAULT_CAPACITY_CONFIG) {
  const { input, windows, daily, windowMinutes, dailyMinutes, dailyMinutesInWindow, dailyMinutesOutsideWindow, interruptionMinutes, schedulableMinutes } =
    analyze(config);
  const clock = localNow(now);

  // 剩余窗口时长：只算**可支配片段**——不可占的那段不装活，不进剩余。
  const remainingWindowMinutes = windows.reduce(
    (sum, window) =>
      sum +
      window.segments.reduce(
        (inner, segment) =>
          inner + Math.max(0, segment.end - Math.max(segment.start, clock.minutes)),
        0,
      ),
    0,
  );
  // 日清成本按「时段」计：时段已经过去的算已经花掉了，还没到的才算今天的剩余负担。
  // 只算落在可用窗口里的那些——窗口外的那笔不占剩余。
  const remainingDailyMinutes = daily.reduce((sum, item) => {
    if (!item.inWindow) return sum;
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
            // 这个窗口里还剩多少**可支配**时间（不可占的那段不算）。
            remainingMinutes: current.segments.reduce(
              (sum, segment) =>
                sum + Math.max(0, segment.end - Math.max(segment.start, clock.minutes)),
              0,
            ),
          },
    windowMinutes,
    // 全部日清成本（顶部统计口径：不管时段在不在窗口内都算）。
    dailyMinutes,
    // 其中落在可用窗口内的（从可排时间里扣的）与落在窗口外的（不占可排时间的）。
    dailyMinutesInWindow,
    dailyMinutesOutsideWindow,
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
 * @param {number} [options.pomodoroMinutes] - 一个番茄多少分钟，默认取通用默认值（25）。
 * @returns {{ minutes: number | null, source: string | null }} 分钟数与来源；未估算时 minutes 为 null。
 */
export function estimateOf(note, { pomodoroMinutes = DEFAULT_CAPACITY_CONFIG.番茄分钟 } = {}) {
  if (note === null || typeof note !== 'object') return { minutes: null, source: null };
  const pomo = note.estimatePomo;
  if (typeof pomo === 'number' && Number.isFinite(pomo) && pomo > 0) {
    const minutes =
      typeof pomodoroMinutes === 'number' && Number.isFinite(pomodoroMinutes)
        ? pomodoroMinutes
        : DEFAULT_CAPACITY_CONFIG.番茄分钟;
    return { minutes: pomo * minutes, source: 'estimatedPomo' };
  }
  const duration = note.estimateDuration;
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    return { minutes: duration, source: 'estimatedDuration' };
  }
  return { minutes: null, source: null };
}

/**
 * 一条动作的预计耗时（分钟）与来源，番茄分钟取自**容量配置**。
 *
 * 番茄分钟是容量参数的一部分（ADR-0011）：配置里写多少就按多少折算；
 * 配置里没有、或者写坏了，就用通用默认值。
 * @param {object} note - 便贴（带 estimatePomo / estimateDuration）。
 * @param {object} [config] - 容量配置；不给就用通用默认值。
 * @returns {{ minutes: number | null, source: string | null }} 分钟数与来源；未估算时 minutes 为 null。
 */
export function estimateWithConfig(note, config = DEFAULT_CAPACITY_CONFIG) {
  const input = readConfig(config === null || config === undefined ? DEFAULT_CAPACITY_CONFIG : config);
  return estimateOf(note, { pomodoroMinutes: input.pomodoroMinutes });
}

/**
 * 一条动作的预计耗时（分钟）。
 *
 * 口径见 {@link estimateOf}：番茄数 × 番茄分钟；番茄数缺失或为 0 = **未估算**（不是 0 分钟）；
 * `estimatedDuration` 作备选，单位按分钟处理（这是假设）。
 * @param {object} note - 便贴（带 estimatePomo / estimateDuration）。
 * @param {object} [options] - 选项。
 * @param {number} [options.pomodoroMinutes] - 一个番茄多少分钟，默认取通用默认值（25）。
 * @returns {number | null} 预计分钟数；未估算时为 null。
 */
export function estimateMinutes(note, options = {}) {
  return estimateOf(note, options).minutes;
}

/**
 * 这件东西今天装不装得下。
 * @param {object} capacity - 今天的容量。
 * @param {number} minutes - 预计耗时（分钟）。
 * @returns {boolean} 装得下就是 true。
 */
export function fitsWithin(capacity, minutes) {
  if (capacity === null || typeof capacity !== 'object') return false;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return false;
  return minutes <= capacity.remainingMinutes;
}
