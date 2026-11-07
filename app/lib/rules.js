/**
 * 容器规则的检查（纯逻辑）。
 *
 * **规则角标是标记，不是一份清单**（ADR-0007）：只在违反检查项的便贴上亮一个角标，
 * 不做独立校验面板、不产生第二个待办池。所以这一层只回答一个问题：
 * 「这条便贴违反了哪几项」，不负责汇总、不负责排序、不负责生成待办。
 *
 * 四项检查的出处：
 * - 等待清单四样齐不齐 → GLOSSARY「等待清单」（等谁／等什么／什么时候回／到期没回做什么）
 * - 执行清单恰好一个时间档标签 → ADR-0005 的硬不变式
 * - 项目不带子任务 → ADR-0004 的警戒线
 * - 正文是否为空 → spec「画布」一节
 */

/** 等待清单必须在正文里写清的四样，前缀写在正文里。 */
export const WAITING_ITEMS = [
  { key: 'waiting-missing-who', prefix: '等谁', label: '等谁' },
  { key: 'waiting-missing-what', prefix: '等什么', label: '等什么' },
  { key: 'waiting-missing-when', prefix: '什么时候回', label: '什么时候回' },
  { key: 'waiting-missing-fallback', prefix: '到期没回', label: '到期没回做什么' },
];

/** 四项检查的键，按这个顺序亮；顺序固定，角标上的说法才稳定。 */
export const VIOLATION_KEYS = [
  'waiting-missing-who',
  'waiting-missing-what',
  'waiting-missing-when',
  'waiting-missing-fallback',
  'time-band-missing',
  'time-band-multiple',
  'project-has-children',
  'empty-content',
];

/**
 * 正文里写没写某一项。
 * @param {string} content - 便贴正文。
 * @param {string} prefix - 要求的前缀。
 * @returns {boolean} 写了就是 true。
 */
function mentions(content, prefix) {
  return content.includes(`${prefix}：`) || content.includes(`${prefix}:`);
}

/**
 * 一条便贴违反了哪几项。
 *
 * 时间档检查只看**执行清单**：别的容器的条目本来就不该挂时间档标签（ADR-0005 只约束执行清单）。
 * 子任务检查只看**项目清单**：别的容器挂子任务是正常的（例如执行清单里的动作可能有自己的检查项）。
 * 正文为空与等待四样是跨容器／单容器的独立检查，各自触发。
 * @param {object} note - 快照里的一条便贴。
 * @param {string} containerKey - 它所在的容器。
 * @returns {string[]} 违反的项，按 {@link VIOLATION_KEYS} 的顺序。
 */
export function violationsOf(note, containerKey) {
  if (note === null || typeof note !== 'object') return [];
  const found = new Set();
  const content = typeof note.content === 'string' ? note.content : '';
  const trimmed = content.trim();
  const bands = Array.isArray(note.timeBands) ? note.timeBands : [];

  if (containerKey === 'waiting') {
    for (const item of WAITING_ITEMS) {
      if (!mentions(content, item.prefix)) found.add(item.key);
    }
  }
  if (containerKey === 'execution') {
    if (bands.length === 0) found.add('time-band-missing');
    if (bands.length > 1) found.add('time-band-multiple');
  }
  if (containerKey === 'project' && note.hasChildren === true) found.add('project-has-children');
  if (trimmed.length === 0) found.add('empty-content');

  return VIOLATION_KEYS.filter((key) => found.has(key));
}

/**
 * 给一条便贴补上它违反的项。
 * @param {object} note - 便贴数据。
 * @param {string} containerKey - 它所在的容器。
 * @returns {object} 补了 violations 的新便贴。
 */
export function withViolations(note, containerKey) {
  return { ...note, violations: violationsOf(note, containerKey) };
}
