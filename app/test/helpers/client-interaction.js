/**
 * 接缝 B 的交互能力：把工作台面板挂到**真的 DOM** 上，用真的点击驱动它。
 *
 * 渲染接缝只有渲染是不完整的——「点刷新会重新拉数」「拉取进行中有加载态」这类行为
 * 必须在真 DOM 上发生才算数。这里摆好宿主会提供的全局（document／window／navigator）、
 * 打开 React 的 act 环境，再把面板挂进容器。
 *
 * fetch 也在这里造：面板只认一个 `fetch`，给它一个由测试掌管的替身，
 * 测试才能断言「点了刷新就重新拉数」「拉取期间停在加载态」。
 */

import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';

import { createClientModule } from './client-harness.js';

const nodeRequire = createRequire(import.meta.url);

/** 还活着的挂载，按挂载先后排；最后一个是当前该用全局的那一个。 */
const mounts = [];
/** 第一次挂载之前的样子，栈空时还原成它。 */
let baseline = null;

/**
 * 拍下当前全局。
 * @returns {object} 全局快照。
 */
function snapshotGlobals() {
  return {
    window: globalThis.window,
    document: globalThis.document,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
}

/**
 * 把某个 jsdom 摆成当前的全局环境。
 * @param {object} win - jsdom 的 window。
 */
function applyGlobals(win) {
  globalThis.window = win;
  globalThis.document = win.document;
  Object.defineProperty(globalThis, 'navigator', {
    value: win.navigator,
    configurable: true,
    writable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

/**
 * 把全局还原成某次快照。
 * @param {object} snapshot - 全局快照。
 */
function restoreGlobals(snapshot) {
  globalThis.window = snapshot.window;
  globalThis.document = snapshot.document;
  if (snapshot.navigator === undefined) {
    delete globalThis.navigator;
  } else {
    Object.defineProperty(globalThis, 'navigator', snapshot.navigator);
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = snapshot.actEnvironment;
}

/**
 * 造一个由测试掌管的 fetch。
 *
 * 调用被记下来（url 与 init），响应什么时候给、给什么，由测试说了算——
 * 这样「请求还在路上」这件事本身可以被断言。
 * @returns {object} fetch 替身与它的控制接口。
 */
export function createFetchController() {
  const calls = [];
  const waiting = [];
  const fetchImpl = (url, init) => {
    calls.push({ url: String(url), init });
    return new Promise((resolve, reject) => {
      waiting.push({ resolve, reject });
    });
  };
  return {
    /** 所有发出去的请求，按先后排。 */
    calls,
    /** fetch 替身本身。 */
    fetchImpl,
    /**
     * 给最早那个还没回应的请求一个响应。
     * @param {object} response - 响应。
     * @param {number} response.status - HTTP 状态码。
     * @param {object} response.body - 响应体（JSON）。
     * @returns {object} 这次请求的记录。
     */
    respond({ status = 200, body }) {
      const entry = waiting.shift();
      if (entry === undefined) throw new Error('没有待回应的请求');
      entry.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      });
      return calls[calls.length - 1];
    },
    /**
     * 让最早那个还没回应的请求以网络错误收场。
     * @param {Error} error - 错误。
     */
    fail(error) {
      const entry = waiting.shift();
      if (entry === undefined) throw new Error('没有待回应的请求');
      entry.reject(error);
    },
  };
}

/**
 * 把面板挂到 jsdom 上。
 *
 * @param {object} options - 选项。
 * @param {string} options.clientPath - client.js 的路径。
 * @param {object} [options.props] - 传给面板的 props。
 * @param {Function} [options.fetchImpl] - 面板会用的 fetch。
 * @returns {Promise<object>} 容器、操作与清理接口。
 */
export async function mountPanel({ clientPath, props = {}, fetchImpl }) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
    // 给一个非 opaque 的 origin：jsdom 在 `about:blank` 下不给 localStorage。
    url: 'http://127.0.0.1/',
  });
  const { window } = dom;
  if (mounts.length === 0) baseline = snapshotGlobals();
  applyGlobals(window);

  const React = nodeRequire('react');
  const { createRoot } = nodeRequire('react-dom/client');
  const { module } = createClientModule(clientPath, {
    globals: { fetch: fetchImpl, localStorage: window.localStorage },
  });
  const container = window.document.getElementById('root');
  const root = createRoot(container);

  /**
   * 在 act 里跑一段异步动作，等 React 把更新都刷完。
   *
   * 每次都把全局摆回本面板的 jsdom——同时挂着两个面板时，全局只归一个所有。
   * @param {Function} callback - 动作。
   * @returns {Promise<void>} 完成。
   */
  const act = async (callback) => {
    applyGlobals(window);
    await React.act(async () => {
      await callback();
    });
    applyGlobals(window);
  };

  const record = { dom, window, root };
  mounts.push(record);

  await act(async () => {
    root.render(React.createElement(module.components.WorkbenchPanel, props));
  });

  return {
    /** 挂载容器。 */
    container,
    /** 面板所在文档。 */
    document: window.document,
    /** 面板所在的 jsdom window（造真的点击事件要用它）。 */
    window,
    /** 在 act 里跑动作。 */
    act,
    /**
     * 点一下某个元素（冒泡的 click）。
     * @param {object} target - 被点的元素。
     */
    async click(target) {
      await act(async () => {
        target.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      });
    },
    /**
     * 等所有微任务与宏任务都过去——面板的取数是异步的，要等它落到稳态。
     * @returns {Promise<void>} 完成。
     */
    async flush() {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    },
    /**
     * 拆掉挂载，把全局还给还活着的那个面板（或回到最初的样子）。
     * @returns {Promise<void>} 完成。
     */
    async cleanup() {
      applyGlobals(window);
      await act(async () => {
        root.unmount();
      });
      const index = mounts.indexOf(record);
      if (index !== -1) mounts.splice(index, 1);
      if (mounts.length > 0) {
        applyGlobals(mounts[mounts.length - 1].window);
      } else {
        restoreGlobals(baseline);
        baseline = null;
      }
      dom.window.close();
    },
  };
}
