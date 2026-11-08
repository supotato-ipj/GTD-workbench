/**
 * 工位的静态素材：点阵字体与像素素材随包发，由一条**本机前缀路由**送出（ADR-0012）。
 *
 * 为什么不是内联进 `client.js`：字体约 600 KB，内联会把单文件撑成不可维护的二进制块；
 * 而宿主本来就开着 `webServer.register`（见 `app/index.js`），加一条 prefix 路由就够了。
 * 客户端仍然只有一个入口 `client.js`——素材走 URL，不走模块。
 *
 * 这条路由只发**白名单里的素材类型**，并且把路径钉死在 `app/assets` 里面：
 * 越界、未知、目录都按 404 收场，别让它变成读仓库任意文件的洞。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 工位素材的路径前缀（客户端按它拼 URL）。 */
export const ASSETS_ROUTE_PREFIX = '/gtd-workbench/assets';

/** 素材根目录：随包发的 `app/assets/`。 */
const DEFAULT_ASSET_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/**
 * 允许送的素材类型。**白名单**：扩展名不在这里的一律 404——
 * 这条路由只负责素材，不是通用静态文件服务器。
 */
const ASSET_CONTENT_TYPES = {
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * 回一个 404（纯文本，不是 HTML——客户端不该把一张 404 页面当成素材）。
 * @param {object} res - 响应对象。
 */
function notFound(res) {
  res.statusCode = 404;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end('not found');
}

/**
 * 把请求路径解析成素材根目录下的一个真实文件路径。
 *
 * 三道门：路径必须落在前缀下、解码后不能带 `..` 或反斜杠、解析后的绝对路径必须仍在素材根里。
 * @param {string} pathname - 请求的 pathname。
 * @param {string} root - 素材根目录的绝对路径。
 * @returns {string | null} 文件路径；不合法时为 null。
 */
function resolveAssetPath(pathname, root) {
  if (typeof pathname !== 'string' || !pathname.startsWith(`${ASSETS_ROUTE_PREFIX}/`)) return null;
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(ASSETS_ROUTE_PREFIX.length + 1));
  } catch {
    // `%` 写得不成对：解码失败就当没有这个素材。
    return null;
  }
  if (relative.length === 0) return null;
  if (relative.includes('\0') || relative.includes('\\')) return null;
  if (relative.split('/').some((segment) => segment.length === 0 || segment === '..' || segment === '.')) return null;
  const resolved = path.resolve(root, relative);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

/**
 * 造一条**前缀路由**的处理函数：只发 `app/assets/` 下的字体与像素素材。
 *
 * 只认 `GET` 与 `HEAD`；其余方法 405（带 `Allow`）。读不到、越界、类型不在白名单里都是 404。
 * @param {object | null | undefined} options - 选项。
 * @param {object | null | undefined} [options.assetRoot] - 素材根目录（测试可换到临时目录）。
 * @returns {(req: object, res: object) => Promise<void>} 路由处理函数。
 */
export function createAssetsHandler({ assetRoot } = {}) {
  const root = path.resolve(typeof assetRoot === 'string' && assetRoot.length > 0 ? assetRoot : DEFAULT_ASSET_ROOT);
  return async function assetsHandler(req, res) {
    const method = typeof req.method === 'string' ? req.method.toUpperCase() : 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET, HEAD');
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('method not allowed');
      return;
    }
    const url = new URL(typeof req.url === 'string' ? req.url : '/', 'http://127.0.0.1');
    const filePath = url.pathname.startsWith(ASSETS_ROUTE_PREFIX) ? resolveAssetPath(url.pathname, root) : null;
    const contentType =
      filePath === null ? null : ASSET_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? null;
    if (filePath === null || contentType === null) {
      notFound(res);
      return;
    }
    let body;
    try {
      body = await readFile(filePath);
    } catch {
      // 不存在、是目录、读不动：一律当成「没有这个素材」，不泄漏文件系统细节。
      notFound(res);
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.setHeader('content-length', String(body.length));
    res.setHeader('cache-control', 'public, max-age=3600');
    res.setHeader('x-content-type-options', 'nosniff');
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(body);
  };
}
