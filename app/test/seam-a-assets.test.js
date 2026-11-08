/**
 * 接缝 A（数据边界，Host → 客户端）：**工位的静态素材**（issue #13）。
 *
 * 点阵字体与像素素材随包发，由 Host 的一条 **prefix 路由**送出——客户端仍然是单文件，
 * 素材不内联进 `client.js`。这里真的起一个本机 HTTP 服务器去取，断言的是响应本身：
 * 状态码、content-type、内容不是 HTML，以及目录逃逸与未知文件都 404。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { ASSETS_ROUTE_PREFIX, createAssetsHandler } from '../lib/assets.js';
import { apply } from '../index.js';
import { withRoute } from './helpers/http-harness.js';

/**
 * 用一条 prefix 路由起一个真服务器，取一个路径。
 * @param {string} pathname - 资源路径（含前缀）。
 * @returns {Promise<{ status: number, type: string | null, body: Buffer }>} 响应。
 */
async function fetchAsset(pathname) {
  const handler = createAssetsHandler();
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${pathname}`);
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      body: Buffer.from(await response.arrayBuffer()),
    };
  });
}

test('接缝 A：Host 登记了一条工位素材的 prefix 路由', () => {
  const routes = [];
  const ctx = {
    connection: { requestRejection: () => undefined },
    webServer: {
      register(route) {
        routes.push(route);
        return () => {};
      },
    },
    effect(callback) {
      const dispose = callback();
      return () => {
        if (typeof dispose === 'function') dispose();
      };
    },
  };
  apply(ctx);
  const assetRoute = routes.find((route) => route.path === ASSETS_ROUTE_PREFIX);
  assert.ok(assetRoute, `没有登记 ${ASSETS_ROUTE_PREFIX} 这条路由`);
  assert.equal(assetRoute.kind, 'prefix', '素材路由不是 prefix 路由');
  assert.equal(typeof assetRoute.handler, 'function');
});

test('接缝 A：点阵字体 200，content-type 是 woff2，响应不是 HTML', async () => {
  const { status, type, body } = await fetchAsset(`${ASSETS_ROUTE_PREFIX}/fonts/fusion-pixel-12px.woff2`);
  assert.equal(status, 200);
  assert.equal(type, 'font/woff2');
  // woff2 的签名是 wOF2；字体是二进制的，绝不该是 HTML。
  assert.equal(body.subarray(0, 4).toString('latin1'), 'wOF2');
  assert.ok(body.length > 100000, `字体太小了：${body.length} 字节`);
  assert.doesNotMatch(body.subarray(0, 64).toString('utf8'), /<html/i);
});

test('接缝 A：桌面场景素材 200，content-type 是 png，尺寸与美术网格一致', async () => {
  const { status, type, body } = await fetchAsset(`${ASSETS_ROUTE_PREFIX}/pixel/desk-scene.png`);
  assert.equal(status, 200);
  assert.equal(type, 'image/png');
  assert.equal(body.subarray(1, 4).toString('latin1'), 'PNG');
  // IHDR 紧跟在 8 字节签名之后：宽 600、高 420，正好是美术网格。
  assert.equal(body.readUInt32BE(16), 600);
  assert.equal(body.readUInt32BE(20), 420);
});

test('接缝 A：纸纹素材 200，content-type 是 png', async () => {
  const { status, type, body } = await fetchAsset(`${ASSETS_ROUTE_PREFIX}/pixel/paper-grain.png`);
  assert.equal(status, 200);
  assert.equal(type, 'image/png');
  assert.equal(body.subarray(1, 4).toString('latin1'), 'PNG');
});

test('接缝 A：字体许可文本随包发，是纯文本', async () => {
  const { status, type, body } = await fetchAsset(`${ASSETS_ROUTE_PREFIX}/fonts/LICENSE-OFL.txt`);
  assert.equal(status, 200);
  assert.match(type ?? '', /^text\/plain/);
  assert.match(body.toString('utf8'), /SIL OPEN FONT LICENSE/);
});

test('接缝 A：未知素材 404，而且不是 HTML（别把 404 页当成素材）', async () => {
  const { status, type, body } = await fetchAsset(`${ASSETS_ROUTE_PREFIX}/pixel/nope.png`);
  assert.equal(status, 404);
  assert.doesNotMatch(type ?? '', /text\/html/);
  assert.doesNotMatch(body.toString('utf8'), /<html/i);
});

test('接缝 A：目录逃逸 404——不能从素材路由读到仓库里的别的东西', async () => {
  for (const pathname of [
    `${ASSETS_ROUTE_PREFIX}/../index.js`,
    `${ASSETS_ROUTE_PREFIX}/%2e%2e/index.js`,
    `${ASSETS_ROUTE_PREFIX}/fonts/..%2f..%2findex.js`,
  ]) {
    const { status, body } = await fetchAsset(pathname);
    assert.equal(status, 404, `${pathname} 没有被拦住`);
    assert.doesNotMatch(body.toString('utf8'), /createTasksHandler/, `${pathname} 读到了源码`);
  }
});

test('接缝 A：只发白名单类型，HEAD 不送正文（素材目录可换）', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gtd-assets-'));
  writeFileSync(path.join(dir, 'ok.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  writeFileSync(path.join(dir, 'note.html'), '<html></html>');
  try {
    const handler = createAssetsHandler({ assetRoot: dir });
    const result = await withRoute(handler, async (baseUrl) => {
      const ok = await fetch(`${baseUrl}${ASSETS_ROUTE_PREFIX}/ok.png`);
      const html = await fetch(`${baseUrl}${ASSETS_ROUTE_PREFIX}/note.html`);
      const head = await fetch(`${baseUrl}${ASSETS_ROUTE_PREFIX}/ok.png`, { method: 'HEAD' });
      return {
        okStatus: ok.status,
        okType: ok.headers.get('content-type'),
        htmlStatus: html.status,
        headStatus: head.status,
        headLength: (await head.arrayBuffer()).byteLength,
      };
    });
    assert.equal(result.okStatus, 200);
    assert.equal(result.okType, 'image/png');
    // HTML 不在白名单里：素材路由不是通用静态文件服务器。
    assert.equal(result.htmlStatus, 404);
    assert.equal(result.headStatus, 200);
    assert.equal(result.headLength, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
