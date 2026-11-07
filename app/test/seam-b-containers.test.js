/**
 * 接缝 B（渲染边界，快照 → 画布）：六个容器各归其位。
 *
 * 快照由接缝 A 的同一条路由用固定夹具生成（不手写快照，免得数据与渲染各说一套），
 * 然后交给渲染层，断言画布 DOM。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';

import { createTasksHandler } from '../lib/route.js';
import { createClientModule } from './helpers/client-harness.js';
import { withRoute } from './helpers/http-harness.js';

const nodeRequire = createRequire(import.meta.url);
const React = nodeRequire('react');

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 用固定夹具生成一份六箱快照。
 * @returns {Promise<object>} 快照。
 */
async function snapshotOfSixBoxes() {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/gtd-workbench/tasks`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

/**
 * 渲染面板并把结果读成 DOM。
 * @param {object} snapshot - 交给面板的快照。
 * @returns {Promise<object>} jsdom 的 document。
 */
async function renderBoard(snapshot) {
  const { module } = createClientModule(clientPath);
  const html = renderToStaticMarkup(React.createElement(module.components.WorkbenchPanel, { initialSnapshot: snapshot, initialView: 'canvas' }));
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
}

test('接缝 B：纸箱数量与顺序与快照的容器一致', async () => {
  const snapshot = await snapshotOfSixBoxes();
  const document = await renderBoard(snapshot);
  const boxes = [...document.querySelectorAll('[data-role="box"]')];
  assert.equal(boxes.length, snapshot.containers.length);
  assert.deepEqual(
    boxes.map((box) => box.getAttribute('data-container')),
    snapshot.containers.map((container) => container.key),
  );
  assert.deepEqual(
    boxes.map((box) => box.querySelector('[data-role="box-title"]').textContent),
    ['收集箱', '项目', '执行', '等待', '日历', '可能'],
  );
});

test('接缝 B：每个纸箱只装自己容器的条目', async () => {
  const snapshot = await snapshotOfSixBoxes();
  const document = await renderBoard(snapshot);
  const boxOf = (key) => document.querySelector(`[data-role="box"][data-container="${key}"]`);
  for (const container of snapshot.containers) {
    const box = boxOf(container.key);
    assert.ok(box, `${container.name} 纸箱没画出来`);
    const openNotes = container.notes.filter((note) => note.status === 0);
    // 默认折叠的纸箱不铺便贴，只留一条计数——它的条目已在折叠断言里核过。
    if (box.getAttribute('data-collapsed') === 'true') {
      assert.equal(box.querySelectorAll('[data-note-id]').length, 0);
      assert.equal(box.querySelector('[data-role="box-collapsed"]').textContent, `${openNotes.length} 条`);
      continue;
    }
    // 视野外的段（明天／以后）只进计数条，不铺便贴（工单 03），所以这里只核默认展开的段。
    if (box.getAttribute('data-box-kind') === 'tag') {
      // 箱签不排时间轴，两条都直接画出来。
      const ids = [...box.querySelectorAll('[data-note-id]')].map((node) => node.getAttribute('data-note-id'));
      assert.deepEqual(ids, openNotes.map((note) => note.id), `${container.name} 箱里的条目与快照对不上`);
      continue;
    }
    const expanded = new Set(snapshot.timeline.defaultExpanded);
    const expected = openNotes.filter((note) => expanded.has(note.segment)).map((note) => note.id);
    const ids = [...box.querySelectorAll('[data-note-id]')].map((node) => node.getAttribute('data-note-id'));
    assert.deepEqual(ids, expected, `${container.name} 箱里的条目与快照对不上`);
  }
});

test('接缝 B：项目以箱签贴在纸箱外沿，不画成便贴', async () => {
  const snapshot = await snapshotOfSixBoxes();
  const document = await renderBoard(snapshot);
  const projectBox = document.querySelector('[data-role="box"][data-container="project"]');
  assert.equal(projectBox.getAttribute('data-box-kind'), 'tag');
  const tags = [...projectBox.querySelectorAll('[data-role="box-tag"]')];
  assert.equal(tags.length, 2);
  // 项目不画成便贴——便贴会让画布变成挂子任务的地方（ADR-0004 / ADR-0007）。
  assert.equal(projectBox.querySelectorAll('[data-role="note"]').length, 0);
  // 箱签只写项目名和下一步指针。
  const firstTag = tags[0];
  assert.match(firstTag.querySelector('[data-role="box-tag-title"]').textContent, /部门职责分工/);
  assert.match(firstTag.querySelector('[data-role="box-tag-next"]').textContent, /^下一步：/);
});

test('接缝 B：收集箱保持展开，未判定条目可见', async () => {
  const snapshot = await snapshotOfSixBoxes();
  const document = await renderBoard(snapshot);
  const inbox = document.querySelector('[data-role="box"][data-container="inbox"]');
  assert.equal(inbox.getAttribute('data-collapsed'), 'false');
  assert.equal(inbox.querySelectorAll('[data-role="box-collapsed"]').length, 0);
  assert.equal(inbox.querySelectorAll('[data-role="note"]').length, 4);
});

test('接缝 B：可能清单默认折叠，显示的计数与实际条数一致', async () => {
  const snapshot = await snapshotOfSixBoxes();
  const document = await renderBoard(snapshot);
  const maybe = document.querySelector('[data-role="box"][data-container="maybe"]');
  assert.equal(maybe.getAttribute('data-collapsed'), 'true');
  const collapsed = maybe.querySelector('[data-role="box-collapsed"]');
  assert.ok(collapsed, '可能清单没有折叠成一条计数');
  const expected = snapshot.containers.find((container) => container.key === 'maybe').notes.length;
  assert.equal(expected, 3);
  assert.equal(collapsed.textContent, `${expected} 条`);
  // 折叠了就不再铺便贴，免得占了版面。
  assert.equal(maybe.querySelectorAll('[data-role="note"]').length, 0);
  // 头部的计数与折叠条上的计数是同一个数。
  assert.equal(maybe.querySelector('[data-role="box-count"]').textContent, `${expected} 条`);
});

test('接缝 B：日历箱只画有外部约定时刻的条目', async () => {
  const snapshot = await snapshotOfSixBoxes();
  const calendar = snapshot.containers.find((container) => container.key === 'calendar');
  // 口径在 Host 侧过滤：日历箱只剩开庭那一条（周期日常不进未完成取数）。
  assert.deepEqual(
    calendar.notes.map((note) => note.title),
    ['沅川建业混凝土有限公司，开庭时间12月12日下午2点周六，'],
  );
  const document = await renderBoard(snapshot);
  const box = document.querySelector('[data-role="box"][data-container="calendar"]');
  // 开庭在 12/12，落在「以后」，默认视野外——所以它进的是折叠条的计数，不是一段便贴。
  assert.equal(box.querySelectorAll('[data-role="note"]').length, 0);
  const collapsed = box.querySelector('[data-role="timeline-collapsed"]');
  assert.ok(collapsed, '日历箱既没有便贴也没有折叠计数');
  assert.equal(collapsed.getAttribute('data-count'), '1');
});

test('接缝 B：快照缺 kind 字段时按便贴画，不崩', async () => {
  const snapshot = await snapshotOfSixBoxes();
  // 老形状的快照（没有 kind / collapsedByDefault）也要能画。
  const legacy = {
    ...snapshot,
    containers: snapshot.containers.map(({ kind, collapsedByDefault, ...rest }) => rest),
  };
  const document = await renderBoard(legacy);
  const boxes = [...document.querySelectorAll('[data-role="box"]')];
  assert.equal(boxes.length, 6);
  for (const box of boxes) assert.equal(box.getAttribute('data-box-kind'), 'note');
});
