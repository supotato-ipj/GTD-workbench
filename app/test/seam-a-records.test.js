/**
 * 接缝 A（数据边界，Host → 客户端）：markdown 侧记录随快照过界。
 *
 * 断言的是外部可观察行为：请求那条本机 HTTP 路由，响应体里有没有 records、
 * 每条便贴有没有对到记录编号；以及「markdown 读不到」时整块板子不出错。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { RECORDS_DIR, REPO_ROOT, loadRecords, resolveRecordsDir } from '../lib/records.js';
import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

/** 仓库自带的样本记录页目录。测试读它，不读本机的真实记录页。 */
const SAMPLE_DIR = path.join(REPO_ROOT, RECORDS_DIR);

const TIME_ZONE = 'Asia/Shanghai';
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 造一条喂固定夹具的路由。
 * @param {object} [overrides] - 覆盖项（换掉 loadRecords 就能测降级）。
 * @returns {Function} 路由处理函数。
 */
function routeUnderTest(overrides = {}) {
  return createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
    ...overrides,
  });
}

/**
 * 请求那条路由并读回响应体。
 * @param {Function} handler - 路由处理函数。
 * @returns {Promise<{ status: number, body: object }>} 状态与响应体。
 */
async function readSnapshot(handler) {
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    return { status: response.status, body: await response.json() };
  });
}

test('接缝 A：markdown 记录随快照一起过界，每条带三段与来源', async () => {
  const { status, body } = await readSnapshot(routeUnderTest({ loadRecords: () => loadRecords({ dir: SAMPLE_DIR }) }));
  assert.equal(status, 200);
  assert.equal(body.records.length, 9);
  assert.deepEqual(
    body.records.map((record) => record.number),
    ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'],
  );
  for (const record of body.records) {
    assert.equal(typeof record.title, 'string');
    assert.notEqual(record.title, '');
    // 来源是给人看的路径：仓库内写仓库相对路径，能照着去找。
    assert.match(record.source, /^records\/\d{2}-.+\.md$/);
    for (const key of ['why', 'acceptance', 'blocker']) {
      assert.ok(record[key] === null || typeof record[key] === 'string', `${record.number} 的 ${key} 不是字符串也不是 null`);
    }
  }
  // 至少有几页真解析出了内容，不是整片 null。
  assert.ok(body.records.some((record) => record.why !== null), '没有任何一页解析出「为什么」');
  assert.ok(body.records.some((record) => record.blocker !== null), '没有任何一页解析出「卡点」');
});

test('接缝 A：便贴带上它对应的记录编号，按 ①–⑨ 与关键词回退', async () => {
  const { body } = await readSnapshot(routeUnderTest({ loadRecords: () => loadRecords({ dir: SAMPLE_DIR }) }));
  const notes = body.containers.flatMap((container) => container.notes);
  const byTitle = new Map(notes.map((note) => [note.title, note.record]));
  // 标题里有编号的按编号对。
  assert.equal(byTitle.get('⑨ 案件留痕清单（③④⑦ 各 5 行）'), '⑨');
  assert.equal(byTitle.get('⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）'), '⑥');
  // 标题里没编号的靠关键词回退：「乙公司工程项目案@同事乙」对不上任何一页。
  assert.equal(byTitle.get('乙公司工程项目案@同事乙'), null);
  // 每条便贴都要有这个键（哪怕是 null），不省略。
  for (const note of notes) assert.ok(Object.prototype.hasOwnProperty.call(note, 'record'));
});

test('接缝 A：markdown 读不到时不打掉板子——记录为空，快照照常返回', async () => {
  const { status, body } = await readSnapshot(
    routeUnderTest({
      loadRecords: () => {
        throw new Error('EACCES: 读不到 records');
      },
    }),
  );
  assert.equal(status, 200);
  assert.deepEqual(body.records, []);
  assert.equal(body.containers.length, 6);
  for (const note of body.containers.flatMap((container) => container.notes)) assert.equal(note.record, null);
});

test('接缝 A：没接记录读取器时默认空数组，不抛', async () => {
  const { status, body } = await readSnapshot(routeUnderTest());
  assert.equal(status, 200);
  assert.deepEqual(body.records, []);
});

test('记录读取：仓库自带的九页样本都能读出来', () => {
  const records = loadRecords({ dir: SAMPLE_DIR });
  assert.equal(records.length, 9);
  assert.deepEqual(
    records.map((record) => record.number),
    ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'],
  );
  // ① 有「为什么」与「卡点」，两段都该解析出来。
  const first = records[0];
  assert.match(first.title, /单据分桶归档/);
  assert.notEqual(first.why, null);
  assert.notEqual(first.blocker, null);
  assert.equal(first.source, 'records/01-invoice-buckets.md');
});

test('记录读取：没有覆盖时默认目录就是仓库里的 records/ 样本', () => {
  // 本机可能配了 `local-config.json`（指向自己的真实记录页），所以默认目录的判定
  // 必须在「没有覆盖」的前提下断言：给一个没有本地配置的根目录与空环境。
  const bareRoot = path.join(here, 'fixtures', 'no-local-config');
  assert.equal(resolveRecordsDir({ env: {}, root: bareRoot }), path.join(bareRoot, RECORDS_DIR));
  // 仓库自带的那九页样本按默认目录读得出来。
  assert.equal(loadRecords({ dir: SAMPLE_DIR }).length, 9);
});

test('记录读取：目录不存在时返回空数组，不抛', () => {
  const missing = path.join(REPO_ROOT, RECORDS_DIR, 'no-such-directory');
  assert.deepEqual(loadRecords({ dir: missing }), []);
});

test('记录读取：markdown 侧只读——解析与读取模块里没有写文件的调用', () => {
  const markdown = readFileSync(path.join(appRoot, 'lib', 'markdown.js'), 'utf8');
  const records = readFileSync(path.join(appRoot, 'lib', 'records.js'), 'utf8');
  for (const source of [markdown, records]) {
    assert.doesNotMatch(source, /writeFile|appendFile|mkdir|rmSync|unlink|renameSync|createWriteStream/);
  }
  // 读取模块只从 node:fs 取读能力。
  assert.match(records, /readdirSync, readFileSync/);
});
