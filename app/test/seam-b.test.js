/**
 * 接缝 B（渲染边界，快照 → 画布）：给渲染层一份固定快照，断言画布 DOM。
 *
 * 快照是固定夹具，不依赖本机实时滴答数据。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';

import { createClientModule, createFakeClientContext } from './helpers/client-harness.js';

const nodeRequire = createRequire(import.meta.url);
const React = nodeRequire('react');

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const clientSource = readFileSync(clientPath, 'utf8');
const snapshot = JSON.parse(readFileSync(path.join(here, 'fixtures/execution-snapshot.json'), 'utf8'));
const zhLocale = JSON.parse(readFileSync(path.join(appRoot, 'locale', 'zh.json'), 'utf8'));
const enLocale = JSON.parse(readFileSync(path.join(appRoot, 'locale', 'en.json'), 'utf8'));

const PANEL_ID = '@local/gtd-workbench';

/**
 * 把一个颜色写法归一，好比较。
 * @param {string} value - 颜色字符串。
 * @returns {string} 归一后的颜色。
 */
function normalizeColor(value) {
  const text = String(value).trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(text);
  if (hex !== null) {
    const packed = Number.parseInt(hex[1], 16);
    return `rgb(${(packed >> 16) & 255}, ${(packed >> 8) & 255}, ${packed & 255})`;
  }
  return text.replace(/\s+/g, ' ');
}

/**
 * 取元素上某个属性的背景色。
 * @param {object} element - DOM 元素。
 * @returns {string} 背景色。
 */
function backgroundOf(element) {
  const style = element.getAttribute('style') ?? '';
  const matched = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(style);
  return matched === null ? '' : normalizeColor(matched[1]);
}

/**
 * 渲染面板并把结果读成 DOM。
 * @param {object} props - 传给面板的 props。
 * @returns {object} jsdom 的 document。
 */
function renderPanel(props) {
  const { module } = createClientModule(clientPath);
  const html = renderToStaticMarkup(React.createElement(module.components.WorkbenchPanel, props));
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
}

test('接缝 B：浏览器工件的 id 等于包名', () => {
  const { artifact } = createClientModule(clientPath);
  assert.equal(artifact.id, PANEL_ID);
  assert.equal(PANEL_ID, '@local/gtd-workbench');
});

test('接缝 B：左栏图标与主区面板共用同一个 id', () => {
  const { module } = createClientModule(clientPath);
  const { ctx, slotRegistrations } = createFakeClientContext();
  module.apply(ctx);
  const main = slotRegistrations.find((entry) => entry.options.name === 'main');
  const sidebar = slotRegistrations.find((entry) => entry.options.name === 'sidebar.panellist');
  assert.ok(main, 'main 槽没有注册面板');
  assert.ok(sidebar, 'sidebar.panellist 槽没有注册图标');
  assert.equal(main.options.key, PANEL_ID);
  assert.equal(sidebar.options.id, PANEL_ID);
  assert.equal(sidebar.options.order, 20);
  assert.equal(sidebar.options.label(), '任务梳理台');
  assert.equal(typeof main.component, 'function');
  assert.equal(typeof sidebar.component, 'function');
});

test('接缝 B：界面文案与 locale 文件一致（中文、英文都不漂移）', () => {
  const { module } = createClientModule(clientPath);
  const { ctx, localeRegistrations } = createFakeClientContext();
  module.apply(ctx);
  assert.equal(localeRegistrations.length, 1);
  const dictionaries = localeRegistrations[0].dictionaries;
  const { meta: zhMeta, ...zhText } = zhLocale;
  const { meta: enMeta, ...enText } = enLocale;
  // 客户端在 vm 上下文里跑，对象原型来自那个 realm；先拍平成纯数据再比。
  assert.deepEqual(JSON.parse(JSON.stringify(dictionaries.zh)), zhText);
  assert.deepEqual(JSON.parse(JSON.stringify(dictionaries.en)), enText);
  assert.equal(zhMeta.title, '任务梳理台');
  assert.equal(enMeta.title, 'Task workbench');
});

test('接缝 B：画布上画出一个纸箱，箱内是执行清单的便贴', () => {
  const document = renderPanel({ initialSnapshot: snapshot, initialView: 'canvas' });
  const boxes = document.querySelectorAll('[data-role="box"]');
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].getAttribute('data-container'), 'execution');
  assert.equal(boxes[0].querySelector('[data-role="box-title"]').textContent, '执行');
  const notes = document.querySelectorAll('[data-role="note"]');
  assert.ok(notes.length >= 1, '画布上没有任何便贴');
  assert.equal(notes.length, 4);
});

test('接缝 B：便贴渲染出标题', () => {
  const document = renderPanel({ initialSnapshot: snapshot, initialView: 'canvas' });
  const titles = [...document.querySelectorAll('[data-role="note"] [data-role="title"]')].map((node) => node.textContent);
  assert.deepEqual(titles, [
    '追问运营部：归期 + 5 课题反馈',
    '文书传递（11/4 日清）',
    '⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）',
    '⑨ 案件留痕清单（③④⑦ 各 5 行）',
  ]);
});

test('接缝 B：便贴渲染出时间档色条，深度／事务／日清三色可辨', () => {
  const document = renderPanel({ initialSnapshot: snapshot, initialView: 'canvas' });
  const bands = [...document.querySelectorAll('[data-role="time-band"]')];
  assert.equal(bands.length, 4);
  const colors = new Map();
  for (const band of bands) {
    const name = band.getAttribute('data-band');
    const color = backgroundOf(band);
    assert.notEqual(color, '', '时间档色条没有颜色');
    if (!colors.has(name)) colors.set(name, color);
  }
  assert.deepEqual([...colors.keys()].sort(), ['事务', '日清', '深度']);
  const distinct = new Set(colors.values());
  assert.equal(distinct.size, 3, '三档时间档的颜色没有区分开');
  assert.deepEqual(
    Object.fromEntries([...colors.entries()].sort(([left], [right]) => (left < right ? -1 : 1))),
    {
      事务: 'rgb(53, 185, 138)',
      日清: 'rgb(217, 154, 63)',
      深度: 'rgb(91, 141, 239)',
    },
  );
});

test('接缝 B：便贴渲染出优先级角标', () => {
  const document = renderPanel({ initialSnapshot: snapshot, initialView: 'canvas' });
  const badges = [...document.querySelectorAll('[data-role="note"] [data-role="priority"]')];
  assert.equal(badges.length, 4);
  assert.deepEqual(
    badges.map((node) => node.textContent),
    ['中', '高', '高', '低'],
  );
});

test('接缝 B：便贴上的截止时间按本地时区显示', () => {
  const document = renderPanel({ initialSnapshot: snapshot, initialView: 'canvas' });
  const dues = [...document.querySelectorAll('[data-role="note"] [data-role="due"]')].map((node) => node.textContent);
  assert.deepEqual(dues, ['2026-11-04 14:15', '2026-11-04 17:30', '2026-11-05 10:00', '2026-11-06 15:00']);
});

test('接缝 B：Client 半边不直接访问滴答', () => {
  // 取数只走 Host 开的那条本机路由（ADR-0008）。
  assert.match(clientSource, /\/gtd-workbench\/tasks/);
  // 浏览器里跑不了进程，也不该试着跑：不引 node 内置模块、不 spawn、不 require 进程能力。
  assert.doesNotMatch(clientSource, /require\(['"]node:/);
  assert.doesNotMatch(clientSource, /\bchild_process\b/);
  assert.doesNotMatch(clientSource, /\bexecSync\b|\bspawnSync\b|\bexecFile\b/);
  // 不调 CLI：连只读命令也不该在浏览器侧拼。
  assert.doesNotMatch(clientSource, /task (?:filter|completed|search)\b/);
  // 「dida auth login」只是未登录时给人看的提示，不是一次访问——允许它出现。
  assert.doesNotMatch(clientSource, /require\(['"]@deepseek-ai\/dsh-client-ui-primitives/);
});
