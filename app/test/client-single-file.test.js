/**
 * 客户端单文件约束的护栏（工单 05）。
 *
 * 三条约束都是**形状**上的，测不了运行时行为，只能读源码与 `package.json`：
 *
 * 1. **只有一个 client 入口**：`window.__ModuleLoader__.load(...)` 在整个客户端里只出现一次；
 *    `components.WorkbenchPanel`、`components.FocusView`、`components.CanvasView` 都由它导出。
 * 2. **无构建步骤**：不引打包器、不引 TypeScript、不写 JSX；元素一律 `React.createElement` 手写。
 * 3. **`require` 只用于取依赖包**：`require` 只用来取宿主模块表里的依赖（当前只有 `react`），
 *    不用来引本地的 `lib/*.js`——`client.js` 是经典脚本，不能用 ES 模块的 import 语法。
 *
 * 理由写在 `app/README.md`（「客户端单文件约束」一节）。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createClientModule } from './helpers/client-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const clientSource = readFileSync(clientPath, 'utf8');
const packageJson = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const readme = readFileSync(path.join(appRoot, 'README.md'), 'utf8');

/** 打包器一类的构建工具。 */
const BUILD_TOOLS = /^(?:esbuild|webpack|rollup|vite|swc|babel|typescript|ts-loader|@swc\/.+|@babel\/.+)$/;

test('客户端单文件：只有一个 client 入口，部件都由它导出', () => {
  // 入口在代码里是独占一行的（注释里提到它不算数）。
  const entries = clientSource.match(/^\s*window\.__ModuleLoader__\.load\s*\(/gm) ?? [];
  assert.equal(entries.length, 1, `client.js 里有 ${entries.length} 个 window.__ModuleLoader__.load 入口`);
  const { module } = createClientModule(clientPath);
  for (const name of ['WorkbenchPanel', 'CanvasView', 'FocusView']) {
    assert.equal(typeof module.components[name], 'function', `${name} 没有从唯一的 client 入口导出`);
  }
});

test('客户端单文件：没有构建步骤——不引打包器、不引 TypeScript、不写 JSX', () => {
  // 经典脚本，不是 ES 模块：没有 import / export 语句，也没有动态 import。
  assert.doesNotMatch(clientSource, /^\s*import\s+[^;]*\bfrom\b/m, 'client.js 里有 import 语句');
  assert.doesNotMatch(clientSource, /^\s*export\s+(?:\{|const|let|var|function|class|default)/m, 'client.js 里有 export 语句');
  assert.doesNotMatch(clientSource, /[^.\w]import\s*\(/, 'client.js 里有动态 import');
  // 不写 JSX：JSX 一定有闭合标签，而闭合标签意味着要构建步骤。
  assert.doesNotMatch(clientSource, /<\/[A-Za-z]/, 'client.js 里有 JSX 闭合标签');
  // 依赖只能从宿主模块表里取，不能引打包器。
  assert.doesNotMatch(
    clientSource,
    /require\(\s*['"](?:esbuild|webpack|rollup|vite|swc|babel|typescript)['"]/,
    'client.js 里 require 了构建工具',
  );
  // package.json 里也没有构建脚本与打包器依赖。
  for (const script of Object.keys(packageJson.scripts ?? {})) {
    assert.doesNotMatch(script, /^(?:build|compile|bundle|prebuild|watch)$/, `package.json 里有构建脚本：${script}`);
  }
  const dependencies = Object.keys({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) });
  for (const name of dependencies) {
    assert.doesNotMatch(name, BUILD_TOOLS, `依赖里出现了构建工具：${name}`);
  }
});

test('客户端单文件：require 只用于取依赖包，不引本地 lib/*.js', () => {
  const specifiers = [...clientSource.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(specifiers)], ['react'], 'client.js 里 require 的不只是宿主模块表里的依赖');
  // 浏览器里跑不了 node 内置模块。
  assert.doesNotMatch(clientSource, /require\(\s*['"]node:/, 'client.js 里 require 了 node 内置模块');
  // 本地的 lib/*.js 是 Host 侧的 ES 模块，经典脚本引不动——数据只能靠快照契约过来。
  assert.doesNotMatch(clientSource, /require\(\s*['"][^'"]*lib\//, 'client.js 里 require 了本地的 lib/*.js');
  assert.doesNotMatch(clientSource, /from\s+['"][^'"]*lib\//, 'client.js 里引了本地的 lib/*.js');
});

test('客户端单文件：README 记着这三条约束', () => {
  assert.match(readme, /## 客户端单文件约束/, 'README 里没有「客户端单文件约束」这一节');
  assert.match(readme, /client-single-file\.test\.js/, 'README 里没有指到守这三条约束的测试');
});
