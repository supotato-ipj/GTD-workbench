/**
 * 本地私有配置（`local-config.json`）：只读，不写、不进仓库。
 *
 * 这个文件是**本机指针**：它告诉插件「我的真实记录页在哪儿」「我的容量参数长什么样」，
 * 但它自己被 `.gitignore` 挡掉，永远不进版本库——仓库里只留**虚构的默认值**与**schema**。
 *
 * 字段（都可以省掉，省掉就用默认）：
 * - `记录目录`：记录页（markdown issue 页）所在目录。相对路径按**仓库根**解，
 *   绝对路径原样用。
 * - `容量`：整份容量参数（ADR-0011）。形状见 `app/capacity.schema.json`。
 * - `清单`：滴答清单 id，按纸箱 key 分（`inbox`／`project`／`execution`／`waiting`／
 *   `calendar`／`maybe`）→ 清单 id（字符串）。形状见 {@link readContainers}。
 * - `两分钟`：两分钟规则的参数（启用、阈值、日回顾窗口）。形状见 {@link readTwoMinutePolicy}。
 *
 * 读不到、不是合法 JSON、不是对象——都当没有这份配置，走默认值，不抛。
 * 本地配置是可选的，缺它不该让工作台起不来。
 *
 * **每次读都重新读盘**（不缓存）：手改配置 → 刷新页面 → 立刻生效。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CAPACITY_CONFIG, WINDOW_KINDS } from './capacity.js';
import { CONTAINERS } from './containers.js';
import { DEFAULT_TWO_MINUTE_POLICY } from './focus-guide.js';

/** 仓库根：本文件在 `<repo>/app/lib/config.js`，往上两级。 */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/** 本地配置文件名（在仓库根，被 `.gitignore` 挡掉，不进版本库）。 */
export const LOCAL_CONFIG_FILE = 'local-config.json';

/** 本机配置里放容量参数的字段名。 */
export const CAPACITY_FIELD = '容量';

/** 本机配置里放滴答清单 id 的字段名。 */
export const CONTAINERS_FIELD = '清单';

/** 本机配置里放两分钟规则参数的字段名。 */
export const TWO_MINUTE_FIELD = '两分钟';

/** 容量配置的顶层字段全集（与 `app/capacity.schema.json` 一致）。 */
const CAPACITY_KEYS = ['定于', '窗口', '不可占', '日清', '插入损耗分钟', '深度', '番茄分钟'];

/** 「窗口」条目认识的字段。 */
const WINDOW_KEYS = ['起', '止', '类'];

/** 「不可占」条目认识的字段。 */
const BLOCKED_KEYS = ['起', '止', '说明'];

/** 「日清」条目认识的字段。 */
const DAILY_KEYS = ['名', '时段', '成本分'];

/** 「深度」一组认识的字段（`估时系数` 是惰性字段，可以不写）。 */
const DEEP_KEYS = ['单日上限分钟', '单日配额', '估时系数'];

/**
 * 读本地配置。
 * @param {object} [options] - 选项。
 * @param {string} [options.root] - 仓库根（默认本仓库根）。
 * @returns {object} 配置对象；没有或读不了时是空对象。
 */
export function readLocalConfig({ root = REPO_ROOT } = {}) {
  try {
    const parsed = JSON.parse(readFileSync(path.join(root, LOCAL_CONFIG_FILE), 'utf8'));
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * 从配置里取一个非空字符串字段。
 * @param {object} config - 配置对象。
 * @param {string} key - 字段名。
 * @returns {string | null} 字段值；没有或不是非空字符串时为 null。
 */
export function stringField(config, key) {
  const value = config !== null && typeof config === 'object' ? config[key] : undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 是不是一个普通对象（不是数组、不是 null）。
 * @param {unknown} value - 待查的值。
 * @returns {boolean} 是普通对象就是 true。
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 是不是一个非负的有限数。
 * @param {unknown} value - 待查的值。
 * @returns {boolean} 是就是 true。
 */
function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * 时刻文本（`HH:mm`）合不合法。
 * @param {unknown} text - 时刻文本。
 * @returns {boolean} 合法就是 true。
 */
function isClockText(text) {
  if (typeof text !== 'string') return false;
  const matched = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (matched === null) return false;
  return Number(matched[1]) <= 24 && Number(matched[2]) <= 59;
}

/**
 * 日期文本（`YYYY-MM-DD`）合不合法。
 * @param {unknown} text - 日期文本。
 * @returns {boolean} 合法就是 true。
 */
function isDateText(text) {
  if (typeof text !== 'string') return false;
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (matched === null) return false;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * 一段「起—止」合不合法（时刻合法，且止晚于起）。
 * @param {unknown} segment - 形如 `{ 起, 止 }` 的对象。
 * @returns {boolean} 合法就是 true。
 */
function isValidSegment(segment) {
  if (!isPlainObject(segment)) return false;
  if (!isClockText(segment.起) || !isClockText(segment.止)) return false;
  const start = clockMinutesOf(segment.起);
  const end = clockMinutesOf(segment.止);
  return end > start;
}

/**
 * 时刻文本换算成当天第几分钟（只在校验里用，文本已确认合法）。
 * @param {string} text - 时刻文本。
 * @returns {number} 分钟数。
 */
function clockMinutesOf(text) {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim());
  return Number(matched[1]) * 60 + Number(matched[2]);
}

/**
 * 一个对象里有没有不认识的字段。
 * @param {object} value - 对象。
 * @param {string[]} allowed - 认识的字段名。
 * @returns {boolean} 全是认识的字段就是 true。
 */
function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/**
 * 一份容量配置**整体**合不合法。
 *
 * 口径：**要么整体有效，要么整体退回通用默认值**——不做「半坏的配置」，
 * 因为半坏的配置会算出一个看起来准、其实错的剩余时间（ADR-0011：猜出来的数比没有数更危险）。
 * 退回之后 `asOf` 是 null，界面显示「参数未定」，用户看得见自己得改。
 *
 * 合法的形状就是 `app/capacity.schema.json` 写的那一份：多一个不认识的字段也算不合法
 * （免得写错了字段名却以为配置生效了）。
 * @param {unknown} value - 待校验的配置。
 * @returns {boolean} 合法就是 true。
 */
export function isValidCapacityConfig(value) {
  if (!isPlainObject(value)) return false;
  if (!hasOnlyKeys(value, CAPACITY_KEYS)) return false;

  // 「定于」：参数是哪一天定的。本机配置必须写——没有它就分不清「这是谁的参数」。
  if (!isDateText(value.定于)) return false;

  // 「窗口」：每天真正能装活的那几段工时。
  if (!Array.isArray(value.窗口)) return false;
  for (const window of value.窗口) {
    if (!isValidSegment(window)) return false;
    if (!hasOnlyKeys(window, WINDOW_KEYS)) return false;
    // 「类」可以不写（默认「可打断」）；写了就只能是认识的两个值之一。
    if (window.类 !== undefined && !WINDOW_KINDS.includes(window.类)) return false;
  }

  // 「不可占」：从窗口里扣掉的不可支配段。
  if (!Array.isArray(value.不可占)) return false;
  for (const segment of value.不可占) {
    if (!isValidSegment(segment)) return false;
    if (!hasOnlyKeys(segment, BLOCKED_KEYS)) return false;
    if (segment.说明 !== undefined && typeof segment.说明 !== 'string') return false;
  }

  // 「日清」：当天必须还清的固定成本清单。
  if (!Array.isArray(value.日清)) return false;
  for (const item of value.日清) {
    if (!isPlainObject(item)) return false;
    if (!hasOnlyKeys(item, DAILY_KEYS)) return false;
    if (typeof item.名 !== 'string' || item.名.trim().length === 0) return false;
    if (!isClockText(item.时段)) return false;
    if (!isNonNegativeNumber(item.成本分)) return false;
  }

  // 「插入损耗分钟」：外部随时占用的预留。
  if (!isNonNegativeNumber(value.插入损耗分钟)) return false;

  // 「深度」一组：单日上限与单日名额。「估时系数」是惰性字段，可以不写。
  if (!isPlainObject(value.深度)) return false;
  if (!hasOnlyKeys(value.深度, DEEP_KEYS)) return false;
  if (!isNonNegativeNumber(value.深度.单日上限分钟)) return false;
  if (!isNonNegativeNumber(value.深度.单日配额)) return false;
  if (value.深度.估时系数 !== undefined && !isNonNegativeNumber(value.深度.估时系数)) {
    return false;
  }

  // 「番茄分钟」：估时的折算单位。
  if (typeof value.番茄分钟 !== 'number' || !Number.isFinite(value.番茄分钟) || value.番茄分钟 <= 0) {
    return false;
  }

  return true;
}

/**
 * 深拷贝一份配置（不让调用方改到共享的那一份）。
 * @param {object} config - 配置。
 * @returns {object} 副本。
 */
function copyCapacityConfig(config) {
  return structuredClone(config);
}

/**
 * 读本机容量配置。
 *
 * 读的是仓库根的 `local-config.json` 里的「容量」字段——**整份容量参数**。
 * 任何一步不顺利（文件读不到、不是合法 JSON、没有这个字段、类型不对、时刻格式不对、
 * 窗口起止颠倒……）都**降级为通用默认值**：不抛、不让工作台起不来。
 *
 * 每次调用都重新读盘（不缓存）：手改配置 → 刷新页面 → 立刻生效。
 * @param {object} [options] - 选项。
 * @param {string} [options.root] - 仓库根（默认本仓库根）。
 * @returns {object} 容量配置；用通用默认值时 `定于` 是 null（= 未初始化）。
 */
export function readCapacityConfig({ root = REPO_ROOT } = {}) {
  const local = readLocalConfig({ root });
  const candidate = local[CAPACITY_FIELD];
  if (!isValidCapacityConfig(candidate)) {
    return copyCapacityConfig(DEFAULT_CAPACITY_CONFIG);
  }
  return copyCapacityConfig(candidate);
}

/**
 * 把「两分钟」字段读成规则参数；不合法就是 null。
 *
 * 字段形状（中文，因为这份文件就是给会话里的 agent 写的）：
 *
 * ```jsonc
 * { "两分钟": { "启用": true, "上限分钟": 2, "日回顾窗口": { "起": "14:45", "止": "15:00" } } }
 * ```
 *
 * 口径与容量配置**同一套**：要么整体有效，要么整体退回通用默认值——
 * 半坏的配置会算出一个看着准、其实错的阈值。
 * 「启用: false」是**合法配置**（用户主动关掉这条规则），不是半坏。
 * @param {unknown} value - 「两分钟」字段。
 * @returns {{ enabled: boolean, maxMinutes: number, reviewWindow: { start: string, end: string } } | null} 读好的参数；不合法时为 null。
 */
function readTwoMinuteField(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.启用 !== 'boolean') return null;
  if (!isNonNegativeNumber(value.上限分钟) || value.上限分钟 <= 0) return null;
  const window = value.日回顾窗口;
  if (!isPlainObject(window)) return null;
  if (!isClockText(window.起) || !isClockText(window.止)) return null;
  if (clockMinutesOf(window.止) <= clockMinutesOf(window.起)) return null;
  return {
    enabled: value.启用,
    maxMinutes: value.上限分钟,
    reviewWindow: { start: window.起.trim(), end: window.止.trim() },
  };
}

/**
 * 读本机的两分钟规则参数。
 *
 * 读的是仓库根的 `local-config.json` 里的「两分钟」字段。
 * 任何一步不顺利（文件读不到、不是合法 JSON、没有这个字段、字段不是对象、
 * 类型不对、时刻格式不对、窗口起止颠倒……）都**退回通用默认值**：不抛、不让工作台起不来。
 *
 * 每次调用都重新读盘（不缓存）：手改配置 → 刷新页面 → 立刻生效。
 * @param {object} [options] - 选项。
 * @param {string} [options.root] - 仓库根（默认本仓库根）。
 * @returns {{ enabled: boolean, maxMinutes: number, reviewWindow: { start: string, end: string } }} 规则参数。
 */
export function readTwoMinutePolicy({ root = REPO_ROOT } = {}) {
  const local = readLocalConfig({ root });
  const parsed = readTwoMinuteField(local[TWO_MINUTE_FIELD]);
  if (parsed !== null) return parsed;
  return {
    ...DEFAULT_TWO_MINUTE_POLICY,
    reviewWindow: { ...DEFAULT_TWO_MINUTE_POLICY.reviewWindow },
  };
}

/**
 * 读本机的滴答清单 id，覆盖到六个纸箱上。
 *
 * 读的是仓库根的 `local-config.json` 里的「清单」字段——形状是
 * `{ "<纸箱 key>": "<清单 id>" }`，key 取 `lib/containers.js` 里的 `key`
 * （`inbox`／`project`／`execution`／`waiting`／`calendar`／`maybe`）：
 *
 * ```jsonc
 * { "清单": { "inbox": "inbox…", "execution": "<24 位 id>", … } }
 * ```
 *
 * 仓库里 `lib/containers.js` 的 id 是**虚构占位**（真实清单 id 是个人信息，不进公开仓库），
 * 所以真机上必须靠这一份本机配置覆盖。
 *
 * 降级口径与容量配置**同一套**：任何一步不顺利（文件读不到、不是合法 JSON、
 * 没有这个字段、字段不是对象、某个值不是非空字符串）都**不抛**——
 * **那一个纸箱**退回仓库里的虚构占位，其余纸箱照常用配置里的值。
 * 「半个纸箱」不算配置坏了：清单 id 是逐个纸箱独立的。
 *
 * 每次调用都重新读盘（不缓存）：手改配置 → 刷新页面 → 立刻生效。
 * @param {object} [options] - 选项。
 * @param {string} [options.root] - 仓库根（默认本仓库根）。
 * @returns {object[]} 六个纸箱（副本；改它不会动到仓库里的那一份）。
 */
export function readContainers({ root = REPO_ROOT } = {}) {
  const local = readLocalConfig({ root });
  const ids = local[CONTAINERS_FIELD];
  const table = isPlainObject(ids) ? ids : {};
  return CONTAINERS.map((container) => {
    const value = table[container.key];
    if (typeof value !== 'string') return { ...container };
    const trimmed = value.trim();
    // 值不是非空字符串：这个纸箱退回仓库里的虚构占位，不抛。
    if (trimmed.length === 0) return { ...container };
    return { ...container, projectId: trimmed };
  });
}
