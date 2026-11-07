/**
 * 滴答 CLI 的写命令：允许集合、argv 拼装、超时。
 *
 * argv 是**全仓库唯一**拼出来的地方（`buildDidaArgs`）：这里断言数组本身，不真跑滴答。
 * 超时那一条会真 spawn 一个 node——但跑的是测试自己造的假入口，不是滴答 CLI。
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  ALLOWED_COMMANDS,
  DEFAULT_DIDA_TIMEOUT_MS,
  DidaError,
  READ_COMMANDS,
  buildDidaArgs,
  didaTimeoutMs,
  runDidaTaskComplete,
} from '../lib/dida.js';

const EXECUTION_PROJECT_ID = '7c4e00000000000000000002';
const TASK_ID = '7c4e0000000000000000000d';

test('命令集合：读命令照旧，写口只开「完成」一个', () => {
  assert.deepEqual([...ALLOWED_COMMANDS].sort(), ['task complete', 'task completed', 'task filter']);
  // 允许集合里**只有一条**写命令：「完成」。「改期」留给 issue #10。
  const writes = [...ALLOWED_COMMANDS].filter((command) => !READ_COMMANDS.has(command));
  assert.deepEqual(writes, ['task complete']);
});

test('argv：完成是位置参数——清单 id 与动作 id 各一个', () => {
  assert.deepEqual(buildDidaArgs('task complete', { projectId: EXECUTION_PROJECT_ID, taskId: TASK_ID }), [
    'task',
    'complete',
    EXECUTION_PROJECT_ID,
    TASK_ID,
  ]);
});

test('argv：完成缺清单 id 或动作 id → 当场报错，不去拼一条废命令', () => {
  assert.throws(() => buildDidaArgs('task complete', { taskId: TASK_ID }), /清单 id/);
  assert.throws(() => buildDidaArgs('task complete', { projectId: EXECUTION_PROJECT_ID }), /动作 id/);
  assert.throws(() => buildDidaArgs('task complete', { projectId: '  ', taskId: TASK_ID }), /清单 id/);
});

test('argv：读命令照旧（分清单 + 状态过滤 + json）', () => {
  assert.deepEqual(buildDidaArgs('task filter', { projectId: EXECUTION_PROJECT_ID, status: 0 }), [
    'task',
    'filter',
    '--projects',
    EXECUTION_PROJECT_ID,
    '--status',
    '0',
    '--json',
  ]);
});

test('argv：其它写命令一律拼不进来', () => {
  for (const command of ['task create', 'task delete', 'task update', 'task move', 'project delete']) {
    assert.throws(
      () => buildDidaArgs(command, { projectId: EXECUTION_PROJECT_ID, taskId: TASK_ID }),
      /拒绝执行/,
      `${command} 不该被放行`,
    );
  }
});

test('超时：默认给一个合理的值，环境变量能改它', () => {
  assert.ok(DEFAULT_DIDA_TIMEOUT_MS >= 30000 && DEFAULT_DIDA_TIMEOUT_MS <= 60000);
  const previous = process.env.GTD_DIDA_TIMEOUT_MS;
  try {
    delete process.env.GTD_DIDA_TIMEOUT_MS;
    assert.equal(didaTimeoutMs(), DEFAULT_DIDA_TIMEOUT_MS);
    process.env.GTD_DIDA_TIMEOUT_MS = '1234';
    assert.equal(didaTimeoutMs(), 1234);
    process.env.GTD_DIDA_TIMEOUT_MS = '不是数字';
    assert.equal(didaTimeoutMs(), DEFAULT_DIDA_TIMEOUT_MS);
  } finally {
    if (previous === undefined) delete process.env.GTD_DIDA_TIMEOUT_MS;
    else process.env.GTD_DIDA_TIMEOUT_MS = previous;
  }
});

test('超时：CLI 卡住时按失败收场（cli-failed），不等它自己回来', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gtd-hang-'));
  const entry = path.join(dir, 'hang.js');
  // 一个只挂着不出来的入口：模拟 CLI 卡住。
  writeFileSync(entry, 'setInterval(() => {}, 1000);\n');
  try {
    await assert.rejects(
      () =>
        runDidaTaskComplete({
          projectId: EXECUTION_PROJECT_ID,
          taskId: TASK_ID,
          entry,
          node: process.execPath,
          timeoutMs: 300,
        }),
      (error) => {
        assert.ok(error instanceof DidaError);
        assert.equal(error.code, 'cli-failed');
        assert.match(error.message, /超时/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
