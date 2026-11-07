/**
 * 完成要求的解析（纯逻辑，单一口径）。
 *
 * 完成要求有**两条来源**，主次分明（规格 issue #1「数据来源与边界」）：
 *
 * 1. **与动作编号匹配的 markdown 记录页**里的「验收标准」——**优先**；
 * 2. **动作正文里的结构化前缀 `完成要求：…`**——**回退**。
 *
 * 两条来源**不是双写**：记录页承载的是项目级的验收标准，正文前缀承载的是这一条动作的完成要求，
 * 层级不同。所以这里**只取其一**，并用 `source` 说清是从哪一条来的——
 * 不把两边拼在一起，也不让同一个概念在两处各有一份定义。
 *
 * 三种结果：
 * - 编号匹配到了、那一页**有**验收标准 → 取那一页的原文，来源是「记录页」；
 * - 编号匹配到了、但那一页**没有**验收标准（`acceptance === null`）→ 回退正文前缀；
 * - 编号没匹配上 → 回退正文前缀；
 * - 两条都没有 → `{ text: null, source: null }`。**空是对的**——它说明判定没做完，不编、也不拿标题充数。
 *
 * 这一层是**纯函数**：不读时钟、不碰滴答、不写任何文件。
 */

import { matchRecordNumber } from './markdown.js';

/** 完成要求的来源标记（取值全集）。 */
export const REQUIREMENT_SOURCES = {
  /** 来自与动作编号匹配的 markdown 记录页的「验收标准」。 */
  RECORD: '记录页',
  /** 来自动作正文里的结构化前缀 `完成要求：`。 */
  PREFIX: '正文前缀',
};

/**
 * 正文里的完成要求前缀：`完成要求：X`。
 *
 * 写法与既有的 `下一步：`／`等谁：`／`什么时候回：`／`到期没回做什么：` 同一套约定，
 * 正则也照 `app/lib/board.js` 的 `nextStepOf` 那样写——**全角冒号与半角冒号都认**，
 * 值到分号、句号或换行为止。
 */
const REQUIREMENT_PATTERN = /完成要求\s*[：:]\s*([^；;。\n]*)/;

/**
 * 从正文里取「完成要求：」后面那段。
 * @param {unknown} content - 滴答任务的正文。
 * @returns {string | null} 完成要求；正文里没写就是 null。
 */
export function requirementPrefixOf(content) {
  if (typeof content !== 'string') return null;
  const matched = REQUIREMENT_PATTERN.exec(content);
  if (matched === null) return null;
  const text = matched[1].trim();
  return text.length === 0 ? null : text;
}

/**
 * 找到便贴对应的那一页记录。
 *
 * 便贴上的 `record` 是 `matchRecordNumber` 的结果（快照里由 `withRecord` 写上）；
 * 没有这个指针时，用**同一条**匹配口径自己找一次——不另立一套匹配规则。
 * @param {object} note - 便贴。
 * @param {object[]} records - 全部记录。
 * @returns {object | null} 那一页记录；对不上时为 null。
 */
function recordOf(note, records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  let number = typeof note.record === 'string' && note.record.length > 0 ? note.record : null;
  if (number === null) number = matchRecordNumber(note.title, records);
  if (number === null) return null;
  for (const record of records) {
    if (record !== null && typeof record === 'object' && record.number === number) return record;
  }
  return null;
}

/**
 * 一条动作的完成要求。
 *
 * **唯一的入口**：便贴上的完成要求、行动卡上的完成要求，都出自这一个函数——
 * 所以不会出现「从两处读到两个不同的完成定义」。
 * @param {object} note - 便贴（带 `record` 指针与正文 `content`）。
 * @param {object[]} records - 全部记录（markdown 侧）。
 * @returns {{ text: string | null, source: string | null }} 完成要求原文与来源标记；
 *   没有时 `text` 与 `source` 都是 null。
 */
export function requirementOf(note, records) {
  const empty = { text: null, source: null };
  if (note === null || typeof note !== 'object') return empty;

  // 一、记录页优先：编号匹配到的那一页的「验收标准」。
  const record = recordOf(note, records);
  if (record !== null && typeof record.acceptance === 'string') {
    const acceptance = record.acceptance.trim();
    if (acceptance.length > 0) return { text: acceptance, source: REQUIREMENT_SOURCES.RECORD };
  }

  // 二、回退正文前缀：这一条动作自己的完成要求。
  const prefix = requirementPrefixOf(note.content);
  if (prefix !== null) return { text: prefix, source: REQUIREMENT_SOURCES.PREFIX };

  // 三、两条都没有：空是对的——判定没做完。
  return empty;
}
