/**
 * 接缝 B（渲染边界，快照 → 画布）：规则角标。
 *
 * 断言的是画布上看得见的东西：角标**只**出现在违反检查项的便贴上，
 * 合规的便贴没有角标，点开便贴能看到缺了哪几样，而且角标**不产生第二份清单**。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { mountClientPanel } from './helpers/client-harness.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 用固定夹具生成一份快照（与接缝 A 同一条路由）。
 * @returns {Promise<object>} 快照。
 */
async function snapshotUnderTest() {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

/**
 * 快照里真正会被画出来的便贴（默认折叠的箱子与视野外的段不铺便贴）。
 * @param {object} snapshot - 快照。
 * @returns {object[]} 会被画出来的便贴，带所在的容器键。
 */
function renderedNotes(snapshot) {
  const expanded = new Set(snapshot.timeline.defaultExpanded);
  const rows = [];
  for (const container of snapshot.containers) {
    if (container.collapsedByDefault === true) continue;
    const open = container.notes.filter((note) => note.status === 0);
    if (container.kind === 'tag') {
      for (const note of open) rows.push({ note, container });
      continue;
    }
    for (const note of open) {
      if (expanded.has(note.segment)) rows.push({ note, container });
    }
  }
  return rows;
}

test('接缝 B：快照里每条便贴都带 violations，规则在 Host 侧就算好了', async () => {
  const snapshot = await snapshotUnderTest();
  for (const container of snapshot.containers) {
    for (const note of container.notes) {
      assert.ok(Array.isArray(note.violations), `${note.title} 没有 violations`);
    }
  }
  // 等待清单那条正文为空 → 四样缺 + 空正文。
  const waiting = snapshot.containers.find((container) => container.key === 'waiting');
  const emptyOne = waiting.notes.find((note) => note.title.includes('回收截止'));
  assert.deepEqual(emptyOne.violations, [
    'waiting-missing-who',
    'waiting-missing-what',
    'waiting-missing-when',
    'waiting-missing-fallback',
    'empty-content',
  ]);
  // 项目那条挂了 11 个子任务。
  const project = snapshot.containers.find((container) => container.key === 'project');
  assert.deepEqual(
    project.notes.find((note) => note.title.includes('部门职责分工')).violations,
    ['project-has-children'],
  );
});

test('接缝 B：规则角标出现在且仅出现在违反检查项的便贴上', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  try {
    const rows = renderedNotes(snapshot);
    assert.ok(rows.length > 0, '夹具里没有会被画出来的便贴，测试没有意义');
    const expected = new Set(rows.filter((row) => row.note.violations.length > 0).map((row) => row.note.id));
    assert.ok(expected.size > 0, '夹具里没有任何违规条目，测试没有意义');

    for (const row of rows) {
      const node = env.document.querySelector(`[data-note-id="${row.note.id}"]`);
      if (node === null) continue; // 箱签之外的隐藏条目
      const badge = node.querySelector('[data-role="rule-badge"]');
      if (expected.has(row.note.id)) {
        assert.ok(badge, `${row.note.title} 违规了却没有角标`);
        assert.equal(badge.getAttribute('data-violations'), row.note.violations.join(','));
      } else {
        assert.equal(badge, null, `${row.note.title} 没违规却亮了角标`);
      }
    }
  } finally {
    await env.unmount();
  }
});

test('接缝 B：合规的便贴一个角标都没有', async () => {
  const snapshot = await snapshotUnderTest();
  // 把三条正文为空的收集箱条目的正文补上，它们就该全合规。
  const patched = {
    ...snapshot,
    containers: snapshot.containers.map((container) => ({
      ...container,
      notes: container.notes.map((note) => ({
        ...note,
        violations: [],
        content: note.content.length > 0 ? note.content : '补上了正文',
      })),
    })),
  };
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: patched, initialView: 'canvas' } });
  try {
    assert.equal(env.document.querySelectorAll('[data-role="rule-badge"]').length, 0);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：点开便贴能看见缺了哪几样', async () => {
  const snapshot = await snapshotUnderTest();
  const waiting = snapshot.containers.find((container) => container.key === 'waiting');
  const target = waiting.notes.find((note) => note.violations.length > 0);
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  try {
    await env.click(env.document.querySelector(`[data-note-id="${target.id}"]`));
    const rules = env.document.querySelector('[data-role="drawer-rules"]');
    assert.ok(rules, '抽屉里没有规则那一块');
    const items = [...rules.querySelectorAll('[data-role="drawer-rule-item"]')];
    assert.deepEqual(
      items.map((item) => item.getAttribute('data-violation')),
      target.violations,
    );
    // 写的是人话，不是键名。
    for (const item of items) assert.doesNotMatch(item.textContent, /^[a-z-]+$/);
    assert.match(rules.textContent, /到期没回做什么/);
  } finally {
    await env.unmount();
  }
});

test('接缝 B：角标不产生独立清单或独立面板', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  try {
    // 角标只在便贴或箱签里，不另起一块板子。
    for (const badge of env.document.querySelectorAll('[data-role="rule-badge"]')) {
      const host = badge.closest('[data-role="note"]') ?? badge.closest('[data-role="box-tag"]');
      assert.ok(host, '角标长在了便贴与箱签之外');
    }
    // 画布上没有「规则清单」这类第二份待办池。
    const roles = [...env.document.querySelectorAll('[data-role]')].map((node) => node.getAttribute('data-role'));
    const ruleRoles = new Set(roles.filter((role) => role.startsWith('rule')));
    assert.deepEqual([...ruleRoles], ['rule-badge']);
  } finally {
    await env.unmount();
  }
});
