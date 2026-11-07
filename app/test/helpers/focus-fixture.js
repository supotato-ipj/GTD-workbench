/**
 * 焦点视图测试用的固定快照（接缝 B）。
 *
 * 快照真的走一遍 Host 的路由生成，字段与 Host 侧一致（不手搓一份假的契约），
 * 只依赖仓库里的固定夹具，不依赖本机实时滴答数据。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TASKS_ROUTE_PATH, createTasksHandler } from '../../lib/route.js';
import { withRoute } from './http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawTasks = JSON.parse(readFileSync(path.join(here, '..', 'fixtures/board-tasks.json'), 'utf8'));

/** 夹具用的时区。 */
export const TIME_ZONE = 'Asia/Shanghai';

/** 夹具用的生成时刻。 */
export const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 用固定夹具生成一份快照（走真的路由，字段与 Host 侧一致）。
 * @returns {Promise<object>} 快照。
 */
export async function focusSnapshotUnderTest() {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    if (response.status !== 200) throw new Error(`夹具快照取不到：HTTP ${response.status}`);
    return response.json();
  });
}

/**
 * 换掉快照里某条便贴的字段（其余原样）。
 * @param {object} snapshot - 原快照。
 * @param {string} id - 便贴 id。
 * @param {object} patch - 要换掉的字段。
 * @returns {object} 换过的快照。
 */
export function patchNote(snapshot, id, patch) {
  return {
    ...snapshot,
    containers: snapshot.containers.map((container) => ({
      ...container,
      notes: container.notes.map((note) => (note.id === id ? { ...note, ...patch } : note)),
    })),
  };
}

/**
 * 换掉焦点契约的某一段（其余原样）。
 * @param {object} snapshot - 原快照。
 * @param {object} patch - 要换的片段。
 * @returns {object} 换过的快照。
 */
export function withFocus(snapshot, patch) {
  return { ...snapshot, focus: { ...snapshot.focus, ...patch } };
}
