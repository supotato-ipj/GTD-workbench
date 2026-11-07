/**
 * markdown 记录的解析与匹配（纯逻辑）。
 *
 * 两个来源的边界写死（spec「数据」）：滴答负责「完成/未完成、在哪个容器、什么时候到期、占哪一档」；
 * markdown 负责「为什么这么定、验收标准是什么、卡在谁手上」。这一层只做后者：
 * 把 issue 页读成三段，再把它对到一条动作上。
 *
 * 匹配靠 ①–⑨ 编号，标题关键词只做回退——滴答里没有任何一条任务的正文指向 markdown 项目页
 * （实测为零条），所以没有指针可依，只能回退。
 *
 * 这一层**不写任何文件**：markdown 侧只读（ADR-0003／ADR-0006）。
 */

/** ①–⑨ 的编号字符，顺序与记录页 `NN-*.md` 一一对应。 */
export const RECORD_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

/**
 * 把 `NN` 转成编号字符。
 * @param {string} digits - 两位数字，例如 `'06'`。
 * @returns {string | null} 编号字符；越界时为 null。
 */
export function numberOf(digits) {
  const index = Number.parseInt(String(digits), 10) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= RECORD_NUMBERS.length) return null;
  return RECORD_NUMBERS[index];
}

/**
 * 取标题里**第一个**编号字符。
 *
 * 一定要取第一个：`⑨ 案件留痕清单（③④⑦ 各 5 行）` 里的 ③④⑦ 说的是它涉及哪些案子，
 * 取错就整条对到别的记录上。
 * @param {unknown} title - 动作标题。
 * @returns {string | null} 编号字符；标题里没有则为 null。
 */
export function firstNumberOf(title) {
  if (typeof title !== 'string') return null;
  let best = null;
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const number of RECORD_NUMBERS) {
    const at = title.indexOf(number);
    if (at !== -1 && at < bestIndex) {
      best = number;
      bestIndex = at;
    }
  }
  return best;
}

/** 三级小标题：`## X`。 */
const SECTION_PATTERN = /^##\s+(.+?)\s*$/;

/**
 * 把一份 issue 页拆成标题与小节。
 * @param {string} text - markdown 原文。
 * @returns {{ title: string, sections: Array<{ title: string, body: string }> }} 标题与小节。
 */
export function parseSections(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  let title = '';
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (title === '' && /^#\s+/.test(line)) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }
    const heading = SECTION_PATTERN.exec(line);
    if (heading !== null) {
      current = { title: heading[1], lines: [] };
      sections.push(current);
      continue;
    }
    if (current !== null) current.lines.push(line);
  }
  return {
    title,
    sections: sections.map((section) => ({ title: section.title, body: section.lines.join('\n').trim() })),
  };
}

/**
 * 在小节里按标题优先级找一段。
 * @param {Array<{ title: string, body: string }>} sections - 小节。
 * @param {RegExp[]} patterns - 从高到低的小节名匹配。
 * @returns {string | null} 找到的正文；没有则为 null。
 */
function findSection(sections, patterns) {
  for (const pattern of patterns) {
    for (const section of sections) {
      if (pattern.test(section.title) && section.body.length > 0) return section.body;
    }
  }
  return null;
}

/**
 * 把一段正文压成一句话。
 *
 * 抽屉里放的是 markdown 的原话，不是模型现编的推断（spec 故事 31）；
 * 所以这里只做「取第一段非空、去掉 markdown 记号」，不改写内容。
 * @param {string | null} body - 小节正文。
 * @returns {string | null} 压缩后的一句话；没有正文时为 null。
 */
export function firstParagraph(body) {
  if (typeof body !== 'string') return null;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine
      .replace(/^>\s*/, '')
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .trim();
    if (line.length === 0) continue;
    return line;
  }
  return null;
}

/**
 * 从全文里捞提到「验收标准」的那一句。
 *
 * 有的记录没有「验收」小节，但正文里写清了验收标准是什么（例如 ⑥：
 * 「四条意见里只有第 4 条没有验收标准」）。捞原句，不总结。
 * @param {Array<{ title: string, body: string }>} sections - 小节。
 * @returns {string | null} 原句；没有则为 null。
 */
function findAcceptanceSentence(sections) {
  for (const section of sections) {
    for (const rawLine of section.body.split(/\r?\n/)) {
      if (!rawLine.includes('验收')) continue;
      const line = rawLine.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
      if (line.length > 0) return line;
    }
  }
  return null;
}

/**
 * 把一份 issue 页解析成工作台要的三段：为什么／验收标准／卡点。
 *
 * 三段都可能缺。缺就是缺——不编（spec 故事 31：不能把推测说成依据）。
 * @param {object} options - 选项。
 * @param {string} options.text - markdown 原文。
 * @param {string} options.number - 编号字符（①–⑨）。
 * @param {string} options.source - 来源路径（相对仓库根，给人看）。
 * @param {string} [options.fileTitle] - 页内一级标题；缺省用页内标题。
 * @returns {object} 记录。
 */
export function parseRecord({ text, number, source, fileTitle }) {
  const { title, sections } = parseSections(text);
  const heading = typeof fileTitle === 'string' && fileTitle.length > 0 ? fileTitle : title;
  return {
    number,
    title: heading,
    source,
    why: firstParagraph(
      findSection(sections, [/为什么/, /现状/, /关键判断/, /背景/, /策略/, /目标/]),
    ),
    acceptance: firstParagraph(findSection(sections, [/验收/])) ?? firstParagraph(findAcceptanceSentence(sections) ?? ''),
    blocker: firstParagraph(findSection(sections, [/卡在/, /卡点/, /阻塞/])),
  };
}

/**
 * 标题里的关键词：去掉编号、括注、标点，余下的按中文/英文切片。
 * @param {unknown} title - 标题。
 * @returns {string[]} 关键词（长度 ≥ 2）。
 */
export function keywordsOf(title) {
  if (typeof title !== 'string') return [];
  const stripped = title
    .replace(/[①②③④⑤⑥⑦⑧⑨]/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[：:，,。.、；;！!？?、·\-—–_/|]/g, ' ');
  return [...new Set(stripped.split(/\s+/).map((token) => token.trim()).filter((token) => token.length >= 2))];
}

/**
 * 把一条动作对到一份记录上。
 *
 * 先按编号（唯一、不会错）；标题里没编号才回退到关键词重合，且要求至少压中一个关键词。
 * 编号优先是因为标题里的关键词可能同时出现在几件事上。
 * @param {string} noteTitle - 动作标题。
 * @param {object[]} records - 全部记录。
 * @returns {string | null} 命中的记录编号；对不上时为 null。
 */
export function matchRecordNumber(noteTitle, records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const byNumber = new Map(records.map((record) => [record.number, record]));
  const direct = firstNumberOf(noteTitle);
  if (direct !== null && byNumber.has(direct)) return direct;
  let best = null;
  let bestScore = 0;
  for (const record of records) {
    const tokens = keywordsOf(record.title);
    if (tokens.length === 0) continue;
    const score = tokens.filter((token) => typeof noteTitle === 'string' && noteTitle.includes(token)).length;
    if (score > bestScore) {
      best = record.number;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}
