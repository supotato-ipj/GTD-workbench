/**
 * 接缝 B（渲染边界）：质感与主题。
 *
 * 断言的是一条边界：**配色与字体全部来自宿主令牌**，质感只来自折角、阴影与纸纹。
 * 画布自己写死颜色的话，暗色主题下必有一块刺眼，而那种问题在测试里最难靠肉眼发现。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';

import { createRequire } from 'node:module';

import { createClientModule } from './helpers/client-harness.js';

const nodeRequire = createRequire(import.meta.url);
const React = nodeRequire('react');

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const snapshot = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

/**
 * 允许自己写死的颜色：时间档三色与图标是非文字图形（artwork），宿主政策允许。
 * `#ffffff` 是压在那三色小标签上的字——它属于同一块 artwork：底是固定色相，字就必须是固定的浅色，
 * 跟着主题翻色反而会在深蓝／深绿底上读不清。
 */
const ARTWORK_COLORS = new Set(['#5b8def', '#35b98a', '#d99a3f', '#7ea6f5', '#3f6fd8', '#2f57b0', '#ffffff']);

/**
 * 造一份能渲染出六箱的固定快照（不经过路由，质感与数据无关）。
 * @returns {object} 快照。
 */
function boardSnapshot() {
  const byContainer = new Map();
  for (const task of snapshot) {
    if (!byContainer.has(task.projectId)) byContainer.set(task.projectId, []);
    byContainer.get(task.projectId).push(task);
  }
  const containerKeys = [
    ['inbox', '收集箱', '收集箱', 'inbox9000000001'],
    ['project', '项目', '项目清单', '7c4e00000000000000000000'],
    ['execution', '执行', '执行清单', '7c4e00000000000000000002'],
    ['waiting', '等待', '等待清单', '7c4e00000000000000000001'],
  ];
  return {
    generatedAt: '2026-11-05T00:00:00.000Z',
    timeZone: 'Asia/Shanghai',
    timeline: { today: '2026-11-05', segments: ['today', 'tomorrow', 'thisWeek', 'later'], defaultExpanded: ['today', 'thisWeek'] },
    records: [],
    focus: [],
    sunk: { windowDays: 7, from: '2026-10-30', to: '2026-11-05', days: [], counts: {} },
    containers: containerKeys.map(([key, name, listName, projectId]) => ({
      key,
      name,
      listName,
      projectId,
      kind: key === 'project' ? 'tag' : 'note',
      collapsedByDefault: false,
      notes: (byContainer.get(projectId) ?? []).map((task, index) => ({
        id: task.id,
        title: task.title,
        content: task.content ?? '',
        dueLocal: '2026-11-05 10:00',
        dueAt: task.dueDate ?? null,
        dueDate: '2026-11-05',
        dueAllDay: false,
        timeBand: index === 0 ? '深度' : '事务',
        timeBands: index === 0 ? ['深度'] : ['事务'],
        priority: 5,
        priorityLabel: '高',
        status: 0,
        statusLabel: '未完成',
        tags: [],
        segment: 'today',
        overdue: false,
        violations: [],
        record: null,
        nextStep: null,
        hasChildren: false,
      })),
    })),
  };
}

/**
 * 静态渲染面板。
 * @param {object} snap - 快照。
 * @returns {object} jsdom document。
 */
function renderPanel(snap) {
  const { module } = createClientModule(clientPath);
  const html = renderToStaticMarkup(React.createElement(module.components.WorkbenchPanel, { initialSnapshot: snap, initialView: 'canvas' }));
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
}

test('质感：样式表随插件安装，只装一次，拆掉就干净了', () => {
  const { module } = createClientModule(clientPath);
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  const dispose = module.components.installStyles(dom.window.document);
  const tags = dom.window.document.querySelectorAll('style[data-plugin-gtd-workbench]');
  assert.equal(tags.length, 1);
  // 重复安装不重复插。
  const disposeAgain = module.components.installStyles(dom.window.document);
  assert.equal(dom.window.document.querySelectorAll('style[data-plugin-gtd-workbench]').length, 1);
  disposeAgain();
  assert.equal(dom.window.document.querySelectorAll('style[data-plugin-gtd-workbench]').length, 1, '重复安装的那次不该拆掉原来那个');
  dispose();
  assert.equal(dom.window.document.querySelectorAll('style[data-plugin-gtd-workbench]').length, 0);
});

test('质感：纸箱有折角、阴影与纸纹', () => {
  const { module } = createClientModule(clientPath);
  const styles = module.styles;
  const document = renderPanel(boardSnapshot());
  // 折角：每个纸箱右上角有一个三角形折角元素。
  for (const box of document.querySelectorAll('[data-role="box"]')) {
    const fold = box.querySelector('.gtd-box__fold');
    assert.ok(fold, '纸箱没有折角');
    const style = fold.getAttribute('style') ?? '';
    assert.match(style, /border-top:\s*20px solid/);
    assert.match(style, /border-left:\s*20px solid transparent/);
  }
  // 纸纹：两道极淡的重复线性渐变，从当前文字色派生（暗色主题下也可用）。
  assert.match(styles, /repeating-linear-gradient/);
  assert.match(styles, /color-mix\(in srgb, var\(--dsw-alias-label-primary\)/);
  // 阴影：折角与便贴都靠 shadow 立起来。
  assert.match(styles, /box-shadow|drop-shadow/);
});

test('质感：字体与配色跟随宿主主题——不写死字体，文字与边框全走令牌', () => {
  const { module } = createClientModule(clientPath);
  assert.match(module.styles, /font-family:\s*var\(--dsw-font-family\)/);
  // 样式表里每一处 font-family 都必须指向宿主的字体令牌，不出现写死的字体族名。
  const families = [...module.styles.matchAll(/font-family:\s*([^;]+)/g)].map((match) => match[1].trim());
  assert.ok(families.length > 0, '样式表没有声明字体');
  for (const family of families) assert.equal(family, 'var(--dsw-font-family)');

  const document = renderPanel(boardSnapshot());
  const markup = document.body.innerHTML;
  // 画布上出现的颜色只能是宿主令牌，或者非文字图形的那几种。
  const colors = [...markup.matchAll(/(?:^|[;:\s])(#[0-9a-fA-F]{3,8})/g)].map((match) => match[1].toLowerCase());
  for (const color of colors) {
    assert.ok(ARTWORK_COLORS.has(color), `画布上写死了一个非图形颜色：${color}`);
  }
  // 文字与边框用的都是 --dsw-alias-*。
  assert.match(markup, /var\(--dsw-alias-label-primary\)/);
  assert.match(markup, /var\(--dsw-alias-border-l[234]\)/);
});

test('质感：便贴与纸箱分成两层，标题读得出来', () => {
  const document = renderPanel(boardSnapshot());
  const box = document.querySelector('[data-role="box"]');
  const note = document.querySelector('[data-role="note"]');
  assert.ok(box, '没有画纸箱');
  assert.ok(note, '没有画便贴');
  const backgroundOf = (element) => {
    const matched = /background(?:-color)?:\s*([^;]+)/.exec(element.getAttribute('style') ?? '');
    return matched === null ? '' : matched[1].trim();
  };
  const title = note.querySelector('[data-role="title"]');
  // 便贴底色与纸箱底色必须是两个不同的令牌：两片纸叠在一起才有层次。
  assert.notEqual(backgroundOf(note), backgroundOf(box));
  // 标题用主文字色，不是次要色或说明色。
  assert.match(title.getAttribute('style') ?? '', /color:\s*var\(--dsw-alias-label-primary\)/);
});

test('质感：尊重系统的减少动效偏好', () => {
  const { module } = createClientModule(clientPath);
  const styles = module.styles;
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  // 动画与过渡都压到近乎为零，倾斜也取消。
  assert.match(styles, /animation-duration:\s*1ms !important/);
  assert.match(styles, /transition-duration:\s*1ms !important/);
  assert.match(styles, /transform:\s*none !important/);
});
