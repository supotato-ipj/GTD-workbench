/**
 * 接缝 B（渲染边界，快照 → 画布）：便贴按到期日落在正确的时间轴分段。
 *
 * 快照由接缝 A 的同一条路由用固定夹具生成，然后交给渲染层断言画布 DOM。
 * 固定夹具的基准日：生成时刻 2026-11-05T00:00:00Z → 本地（Asia/Shanghai）2026-11-05 08:00，
 * 所以「今天」= 2026-11-05（周四），「本周日」= 2026-11-08。
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
import { mountPanel } from './helpers/client-interaction.js';
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
 * 用固定夹具生成一份快照。
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

/**
 * 取一个纸箱里的段与折叠条。
 * @param {object} document - jsdom document。
 * @param {string} key - 容器 key。
 * @returns {object} 段标题、段内便贴 id、折叠条计数。
 */
function timelineOfBox(document, key) {
  const box = document.querySelector(`[data-role="box"][data-container="${key}"]`);
  assert.ok(box, `${key} 纸箱没画出来`);
  const segments = [...box.querySelectorAll('[data-role="segment"]')].map((node) => ({
    segment: node.getAttribute('data-segment'),
    title: node.querySelector('[data-role="segment-title"]').textContent,
    noteIds: [...node.querySelectorAll('[data-note-id]')].map((item) => item.getAttribute('data-note-id')),
  }));
  const collapsed = box.querySelector('[data-role="timeline-collapsed"]');
  return {
    box,
    segments,
    collapsedText: collapsed === null ? null : collapsed.textContent,
    collapsedSegments: collapsed === null ? null : collapsed.getAttribute('data-segments'),
  };
}

test('接缝 B：快照带上时间轴的骨架——今天、四段、默认铺哪几段', async () => {
  const snapshot = await snapshotUnderTest();
  assert.equal(snapshot.timeline.today, '2026-11-05');
  assert.deepEqual(snapshot.timeline.segments, ['today', 'tomorrow', 'thisWeek', 'later']);
  assert.deepEqual(snapshot.timeline.defaultExpanded, ['today', 'thisWeek']);
  // 每条便贴都带 segment 与 overdue，Client 不重算。
  for (const container of snapshot.containers) {
    for (const note of container.notes) {
      assert.ok(['today', 'tomorrow', 'thisWeek', 'later'].includes(note.segment), `${note.title} 没有分段`);
      assert.equal(typeof note.overdue, 'boolean');
    }
  }
});

test('接缝 B：便贴按到期日落在正确的时间轴分段', async () => {
  const snapshot = await snapshotUnderTest();
  const document = await renderBoard(snapshot);
  // 逐箱核对：快照里每一条便贴都要出现在它自己那一段的 DOM 里（默认展开的段）。
  for (const container of snapshot.containers) {
    if (container.collapsedByDefault === true) continue; // 整箱折叠的另算，见工单 02 的断言。
    if (container.kind === 'tag') continue; // 箱签箱不排时间轴，见「无截止时间」那条断言。
    const { segments } = timelineOfBox(document, container.key);
    const expanded = new Set(snapshot.timeline.defaultExpanded);
    const rendered = new Map(segments.map((segment) => [segment.segment, segment.noteIds]));
    for (const segment of snapshot.timeline.segments) {
      if (!expanded.has(segment)) continue;
      const expected = container.notes.filter((note) => note.segment === segment).map((note) => note.id);
      assert.deepEqual(rendered.get(segment), expected, `${container.name} 箱的「${segment}」段对不上`);
    }
  }
});

test('接缝 B：抓一张具体便贴——过期未完成归「今天」', async () => {
  const snapshot = await snapshotUnderTest();
  const document = await renderBoard(snapshot);
  const execution = timelineOfBox(document, 'execution');
  const todaySegment = execution.segments.find((segment) => segment.segment === 'today');
  assert.ok(todaySegment, '执行箱里没有「今天」段');
  assert.equal(todaySegment.title, '今天');
  // 追问业务部截止 11/4（已过期）、⑥ 汇总截止 11/5（今天）、文书传递截止 11/4（已过期）。
  assert.deepEqual(todaySegment.noteIds, [
    '6ad5b0aa1e4b0c399cc072706',
    '7c4e0000000000000000000b',
    '7c4e0000000000000000000d',
  ]);
});

test('接缝 B：打开画布时默认只展开今天与本周两段', async () => {
  const snapshot = await snapshotUnderTest();
  const document = await renderBoard(snapshot);
  const inbox = timelineOfBox(document, 'inbox');
  assert.deepEqual(
    inbox.segments.map((segment) => segment.segment),
    ['today', 'thisWeek'],
  );
  assert.deepEqual(
    inbox.segments.map((segment) => segment.title),
    ['今天', '本周'],
  );
});

test('接缝 B：视野外的分段折叠为一条计数，计数与其中实际条数一致', async () => {
  const snapshot = await snapshotUnderTest();
  const document = await renderBoard(snapshot);
  for (const container of snapshot.containers) {
    if (container.collapsedByDefault === true) continue;
    if (container.kind === 'tag') continue;
    const expanded = new Set(snapshot.timeline.defaultExpanded);
    const hiddenNotes = container.notes.filter((note) => !expanded.has(note.segment));
    const { collapsedText, collapsedSegments } = timelineOfBox(document, container.key);
    if (hiddenNotes.length === 0) {
      assert.equal(collapsedText, null, `${container.name} 箱不该有折叠条`);
      continue;
    }
    assert.ok(collapsedText !== null, `${container.name} 箱的视野外条目没有折叠成计数`);
    assert.equal(collapsedSegments, 'tomorrow,later');
    // 计数条上写的条数 = 视野外条目的实际条数。
    assert.match(collapsedText, new RegExp(`\\b${hiddenNotes.length}\\b`));
  }
});

test('接缝 B：无截止时间的条目有明确归属，不静默消失', async () => {
  const snapshot = await snapshotUnderTest();
  const document = await renderBoard(snapshot);
  // 项目箱画的是箱签，不排时间轴（ADR-0007：项目不是一摞按天排的动作），所以两条都直接画出来。
  // 「郑某案件·代理律师定标」没有截止日——它仍然在画布上，没有静默消失。
  const projectBox = document.querySelector('[data-role="box"][data-container="project"]');
  const projectIds = [...projectBox.querySelectorAll('[data-note-id]')].map((node) => node.getAttribute('data-note-id'));
  assert.deepEqual(projectIds, ['7c4e00000000000000000007', '7c4e00000000000000000011']);
  assert.equal(projectBox.querySelectorAll('[data-role="timeline"]').length, 0, '箱签不该排进时间轴');
  // 便贴箱里无截止日的那条由快照归到「以后」，并计入折叠条的计数（见上一条断言）。
  const noDueNote = snapshot.containers
    .flatMap((container) => container.notes)
    .find((note) => note.dueDate === null);
  assert.ok(noDueNote, '夹具里应当有一条无截止日的条目');
  assert.equal(noDueNote.segment, 'later');
});

test('接缝 B：点折叠条能看到视野外的段，再点收起', async () => {
  const snapshot = await snapshotUnderTest();
  const mount = await mountPanel({ clientPath, props: { initialSnapshot: snapshot, initialView: 'canvas' } });
  try {
    const executionBox = () => mount.document.querySelector('[data-role="box"][data-container="execution"]');
    const segmentsOf = () => [...executionBox().querySelectorAll('[data-role="segment"]')].map((node) => node.getAttribute('data-segment'));
    // 默认只铺今天与本周。
    assert.deepEqual(segmentsOf(), ['today', 'thisWeek']);
    const collapsed = executionBox().querySelector('[data-role="timeline-collapsed"]');
    assert.ok(collapsed, '执行箱的明天／以后没有折叠成计数');
    assert.equal(collapsed.getAttribute('data-count'), '1');
    await mount.act(async () => {
      collapsed.dispatchEvent(new mount.window.MouseEvent('click', { bubbles: true }));
    });
    // 点开之后四段都铺出来，那条明天的事也看得见了。
    assert.deepEqual(segmentsOf(), ['today', 'tomorrow', 'thisWeek', 'later']);
    assert.equal(
      executionBox().querySelector('[data-role="segment"][data-segment="tomorrow"] [data-note-id]').getAttribute('data-note-id'),
      '7c4e00000000000000000008',
    );
    assert.equal(executionBox().querySelector('[data-role="timeline-collapsed"]'), null);
    // 再点收起，回到默认视野。
    await mount.act(async () => {
      executionBox().querySelector('[data-role="timeline-fold"]').dispatchEvent(new mount.window.MouseEvent('click', { bubbles: true }));
    });
    assert.deepEqual(segmentsOf(), ['today', 'thisWeek']);
  } finally {
    await mount.cleanup();
  }
});

test('接缝 B：快照缺 timeline 字段时按兜底的四段与默认视野画，不崩', async () => {
  const snapshot = await snapshotUnderTest();
  const legacy = { ...snapshot, timeline: undefined };
  const document = await renderBoard(legacy);
  const inbox = timelineOfBox(document, 'inbox');
  assert.deepEqual(
    inbox.segments.map((segment) => segment.segment),
    ['today', 'thisWeek'],
  );
  const boxes = [...document.querySelectorAll('[data-role="box"]')];
  assert.equal(boxes.length, 6);
});
