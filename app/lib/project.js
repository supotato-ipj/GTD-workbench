/**
 * 卡脚的项目指针（纯逻辑）。
 *
 * 滴答里**项目与动作之间没有关联字段**（项目不带子任务，动作也不指向项目），
 * 所以「这一件属于哪条项目线」推不出来一个直接指针，只能靠既有口径推：
 * **markdown 记录编号**（①–⑨）与**项目箱箱签标题的编号**对上。
 *
 * 口径（与规格 issue #1 的用户故事 22–24 对齐）：
 * - 动作 → 项目：动作身上的记录编号（`note.record`）与项目箱里那张箱签标题的编号相同，
 *   那张箱签就是它所属的项目。**对不上就不给指针**——缺就是缺，不编。
 * - 项目清单的全貌 = 下钻层里的「项目」纸箱（纸箱 + 箱签 + 下一步指针）。
 * - 项目的 markdown 记录 = 记录页里同编号那页的「为什么／验收标准／卡点」（v1 既有那套，只读）。
 *
 * 这一层只**算**指针：项目名、箱签 id 与编号都随快照过界，Client 侧只画不算。
 */

import { RECORD_NUMBERS, firstNumberOf } from './markdown.js';

/** 项目箱的纸箱标识（快照里容器组的 key）。 */
export const PROJECT_CONTAINER_KEY = 'project';

/**
 * 项目名：箱签标题去掉开头的编号字符。
 *
 * `⑥ 岗位职责分工梳理` 的项目名是「岗位职责分工梳理」——
 * 编号是 markdown 记录页的编号，不是项目名的一部分。
 * @param {unknown} title - 箱签标题。
 * @returns {string} 项目名；没有标题就是空串。
 */
export function projectNameOf(title) {
  const text = typeof title === 'string' ? title : '';
  for (const number of RECORD_NUMBERS) {
    if (!text.startsWith(number)) continue;
    const rest = text.slice(number.length).trim();
    return rest.length > 0 ? rest : text.trim();
  }
  return text.trim();
}

/**
 * 推出一个动作所属的项目指针。
 *
 * @param {unknown} recordNumber - 动作身上的 markdown 记录编号（①–⑨）；没有就是 null。
 * @param {object[]} containers - 快照的容器组。
 * @returns {{ id: string, name: string, record: string } | null} 项目指针；推不出就是 null。
 */
export function projectPointerOf(recordNumber, containers) {
  if (typeof recordNumber !== 'string' || recordNumber.length === 0) return null;
  const groups = Array.isArray(containers) ? containers : [];
  const project = groups.find(
    (group) => group !== null && typeof group === 'object' && group.key === PROJECT_CONTAINER_KEY,
  );
  if (project === undefined) return null;
  const notes = Array.isArray(project.notes) ? project.notes : [];
  for (const note of notes) {
    if (note === null || typeof note !== 'object') continue;
    const number = firstNumberOf(note.title);
    if (number === null || number !== recordNumber) continue;
    return {
      id: typeof note.id === 'string' ? note.id : '',
      name: projectNameOf(note.title),
      record: number,
    };
  }
  return null;
}
