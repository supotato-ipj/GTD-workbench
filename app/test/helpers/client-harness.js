import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

import { JSDOM } from 'jsdom';

const nodeRequire = createRequire(import.meta.url);
const React = nodeRequire('react');

/**
 * 在 Node 里加载浏览器工件。
 *
 * `client.js` 是**经典脚本**（不是 ES 模块）：浏览器端它由 `window.__ModuleLoader__` 收下，
 * Node 端它在一个带 `window` 桩的 vm 上下文里跑，桩把工件截下来。
 *
 * `globals` 用来往这个 vm 上下文里补全局（例如可控的 `fetch`）。脚本里的自由变量
 * 先在沙箱里找，所以补进去的 `fetch` 就是 client.js 看到的那一个。
 * @param {string} clientPath - client.js 的路径。
 * @param {object} [options] - 选项。
 * @param {object} [options.globals] - 往 vm 上下文里补的全局。
 * @returns {{ id: string, factory: (require: (specifier: string) => unknown) => object }} 截下来的工件。
 */
export function loadClientArtifact(clientPath, { globals = {} } = {}) {
  const source = readFileSync(clientPath, 'utf8');
  let captured = null;
  const sandbox = {
    console,
    window: {
      __ModuleLoader__: {
        load: (artifact) => {
          captured = artifact;
        },
      },
    },
    ...globals,
  };
  // 浏览器里 `document` 是全局；vm 上下文要手动补上，否则组件里的 DOM 调用会炸。
  if (globals.document !== undefined) {
    sandbox.document = globals.document;
    sandbox.window.document = globals.document;
  }
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: clientPath });
  if (captured === null) throw new Error('client.js 没有向 window.__ModuleLoader__ 注册');
  return captured;
}

/**
 * 加载浏览器工件并跑它的工厂，拿到插件的 Client 半边。
 * @param {string} clientPath - client.js 的路径。
 * @param {object} [options] - 选项。
 * @param {object} [options.globals] - 往 vm 上下文里补的全局（例如可控的 `fetch`）。
 * @returns {{ artifact: object, module: object }} 工件与插件模块。
 */
export function createClientModule(clientPath, options = {}) {
  const artifact = loadClientArtifact(clientPath, options);
  const module = artifact.factory((specifier) => {
    if (specifier === 'react') return nodeRequire('react');
    throw new Error(`client.js 请求了未预期的模块：${specifier}`);
  });
  return { artifact, module };
}

/**
 * 把一个 DOM 环境装到 Node 的全局上。
 *
 * react-dom 在**模块加载时**判定有没有 DOM（`canUseDOM`），所以这些全局必须在
 * `import('react-dom/client')` 之前装好——装晚了，React 会走无 DOM 的分支。
 * @param {object} domWindow - JSDOM 的 window。
 */
function applyDomGlobals(domWindow) {
  const define = (name, value) => {
    try {
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    } catch {
      // Node 自带的只读全局（navigator 等）覆盖不了就算了，React 有兜底。
    }
  };
  define('window', domWindow);
  define('document', domWindow.document);
  define('navigator', domWindow.navigator);
  define('HTMLElement', domWindow.HTMLElement);
  define('Element', domWindow.Element);
  define('Node', domWindow.Node);
  define('Event', domWindow.Event);
  define('KeyboardEvent', domWindow.KeyboardEvent);
  define('MouseEvent', domWindow.MouseEvent);
  define('getComputedStyle', domWindow.getComputedStyle.bind(domWindow));
  define('requestAnimationFrame', domWindow.requestAnimationFrame.bind(domWindow));
  define('cancelAnimationFrame', domWindow.cancelAnimationFrame.bind(domWindow));
  define('IS_REACT_ACT_ENVIRONMENT', true);
}

/**
 * 拍下要被 {@link applyDomGlobals} 改动的那几个全局。
 * @returns {object} 之前的值（不存在时为 undefined）。
 */
function snapshotDomGlobals() {
  const saved = {};
  for (const name of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'KeyboardEvent',
    'MouseEvent',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'IS_REACT_ACT_ENVIRONMENT',
  ]) {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
  }
  return saved;
}

/**
 * 把 {@link snapshotDomGlobals} 拍下的全局还回去。
 *
 * 这一步是必需的：同一进程里跑多个测试文件时，前一个文件挂的 jsdom 会漏给后一个，
 * 后一个的「静态渲染」断言就会拿到别人的 document 而表现成随机失败。
 * @param {object} saved - 之前的描述符。
 */
function restoreDomGlobals(saved) {
  for (const [name, descriptor] of Object.entries(saved)) {
    try {
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    } catch {
      // 只读的全局还原不了就算了，下一个挂载会重新装一遍。
    }
  }
}

/**
 * 在**真 DOM** 上挂载面板，供交互断言用（点开便贴 → 抽屉打开）。
 *
 * `renderToStaticMarkup` 是静态渲染，没有交互；抽屉这类「点开才出现」的东西得在
 * jsdom + `react-dom/client` 上跑，事件用 `act` 包起来，React 才会把状态变化刷到 DOM 上。
 * @param {object} options - 选项。
 * @param {string} options.clientPath - client.js 的路径。
 * @param {object} [options.props] - 传给面板的 props。
 * @returns {Promise<object>} 挂好的环境：document、click、pressKey、unmount。
 */
export async function mountClientPanel({ clientPath, props = {} }) {
  const dom = new JSDOM('<!doctype html><html><body><div id="gtd-root"></div></body></html>', {
    pretendToBeVisual: true,
    url: 'http://127.0.0.1/',
  });
  const savedGlobals = snapshotDomGlobals();
  applyDomGlobals(dom.window);
  const { module } = createClientModule(clientPath, { globals: { document: dom.window.document } });
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.getElementById('gtd-root');
  const root = createRoot(container);
  const act = React.act;
  await act(async () => {
    root.render(React.createElement(module.components.WorkbenchPanel, props));
  });
  return {
    window: dom.window,
    document: dom.window.document,
    container,
    /**
     * 点一下某个元素（冒泡的 click）。
     * @param {object} target - 被点的元素。
     */
    async click(target) {
      await act(async () => {
        target.dispatchEvent(
          new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, view: dom.window }),
        );
      });
    },
    /**
     * 按一个键（冒泡的 keydown）。
     * @param {object} target - 事件目标。
     * @param {string} key - 键名。
     */
    async pressKey(target, key) {
      await act(async () => {
        target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      });
    },
    /**
     * 甩一个任意类型的事件过去（`pointerdown` / `pointermove` / `pointerup` 这类 jsdom 没有专门构造器的）。
     *
     * 用 `MouseEvent` 造：它带 `clientX`/`clientY` 与 `button`，而拖动只读这几样。
     * @param {object} target - 事件目标。
     * @param {string} type - 事件类型。
     * @param {object} [init] - 事件初始化项。
     */
    async dispatch(target, type, init = {}) {
      await act(async () => {
        target.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
      });
    },
    /**
     * 卸掉 React 树，并把全局还回挂载前的样子。
     */
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      restoreDomGlobals(savedGlobals);
      dom.window.close();
    },
  };
}

/**
 * 造一个假客户端上下文，把槽位注册与文案注册都记下来。
 * @param {object} [options] - 选项。
 * @param {string} [options.locale] - 界面语言，默认 zh。
 * @returns {object} 记录下来的注册与上下文。
 */
export function createFakeClientContext({ locale = 'zh' } = {}) {
  const slotRegistrations = [];
  const localeRegistrations = [];
  const effectDisposers = [];
  const ctx = {
    slots: {
      inject(slotName, callback) {
        const disposer = callback();
        return () => {
          if (typeof disposer === 'function') disposer();
        };
      },
      register(options, component) {
        slotRegistrations.push({ options, component });
        return () => {};
      },
    },
    locale: {
      register(namespace, dictionaries) {
        localeRegistrations.push({ namespace, dictionaries });
        return () => {};
      },
      bind(namespace) {
        const entry = localeRegistrations.find((item) => item.namespace === namespace);
        const table = entry === undefined ? {} : entry.dictionaries[locale] ?? {};
        return (key) => table[key] ?? key;
      },
    },
    effect(callback, label) {
      const disposer = callback();
      effectDisposers.push(disposer);
      return disposer;
    },
  };
  return { ctx, slotRegistrations, localeRegistrations, effectDisposers };
}
