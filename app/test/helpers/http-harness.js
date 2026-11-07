import http from 'node:http';

/**
 * 把一个路由处理函数挂到真的 HTTP 服务器上，用真的请求打进去。
 *
 * 接缝 A 断的是「请求那条本机 HTTP 路由，断言响应体」，所以测试要真的发一次请求，
 * 而不是直接调处理函数。
 * @param {(req: object, res: object) => Promise<void>} handler - 路由处理函数。
 * @param {(baseUrl: string) => Promise<T>} run - 拿到 baseUrl 后要跑的东西。
 * @returns {Promise<T>} run 的返回值。
 * @template T
 */
export async function withRoute(handler, run) {
  const server = http.createServer((req, res) => {
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
