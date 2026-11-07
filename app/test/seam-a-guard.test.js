/**
 * 接缝 A 的守卫与只读护栏（工单 11「健壮与刷新」）。
 *
 * 同机任何进程都能连本地端口，所以取数路由必须先问访问守卫；
 * 工作台是只读视图（ADR-0006），所以除 GET 以外的方法进不来，更不会去动滴答。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/execution-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
const GENERATED_AT = '2026-11-05T00:00:00.000Z';
const EXECUTION_PROJECT_ID = '7c4e00000000000000000002';

test('接缝 A：访问守卫每次都问，不该来的连接读不到取数结果', async () => {
  const calls = [];
  const asked = [];
  const handler = createTasksHandler({
    connection: {
      requestRejection: (req) => {
        asked.push(req.headers['x-foreign'] ?? null);
        return req.headers['x-foreign'] === undefined ? undefined : 403;
      },
    },
    runDida: async ({ projectId }) => {
      calls.push(projectId);
      return rawTasks;
    },
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
  });
  const result = await withRoute(handler, async (baseUrl) => {
    const foreign = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`, { headers: { 'x-foreign': 'yes' } });
    const foreignBody = await foreign.text();
    const own = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    const ownBody = await own.json();
    return {
      foreign: { status: foreign.status, body: foreignBody },
      own: { status: own.status, body: ownBody },
    };
  });
  assert.equal(result.foreign.status, 403, '无关连接没被守卫挡住');
  assert.equal(result.foreign.body, '', '无关连接读到了取数结果');
  assert.equal(result.own.status, 200);
  assert.equal(result.own.body.containers.length, 6);
  assert.equal(asked.length, 2, '访问守卫没有每次都问');
  // 被拒的那一次一次 CLI 都没跑：六个容器各一次，全在「自己那条连接」上。
  assert.equal(calls.length, 6, '被拒的连接仍然触发了取数');
  assert.equal(new Set(calls).size, 6);
});

test('接缝 A：写方法进不来，也不碰滴答', async () => {
  const calls = [];
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async ({ projectId }) => {
      calls.push(projectId);
      return rawTasks;
    },
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
  });
  const result = await withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`, { method: 'POST' });
    return {
      status: response.status,
      allow: response.headers.get('allow'),
      body: await response.text(),
    };
  });
  assert.equal(result.status, 405, '写方法没有进不来');
  assert.equal(result.allow, 'GET');
  assert.equal(result.body, '');
  assert.deepEqual(calls, [], '写方法触发了取数');
});
