/**
 * 写动作的纯函数：校验、目标定位、失败码映射。
 *
 * 这一层不碰 HTTP、不碰滴答：只回答「这个请求说得通吗」「目标动作在哪个清单里」。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ActionError, WRITE_ACTIONS, locateInContainer, validateAction } from '../lib/actions.js';
import { describeFailure } from '../lib/route.js';

const CONTAINERS = [
  { key: 'inbox', name: '收集箱', projectId: 'inbox9000000001' },
  { key: 'execution', name: '执行', projectId: '7c4e00000000000000000002' },
];

test('动作校验：动作类型、目标 id、参数都合法时给出规范化的动作', () => {
  const parsed = validateAction({ action: 'complete', taskId: '  abc123  ', params: { 备注: '随手写的' } });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, { action: 'complete', taskId: 'abc123', params: { 备注: '随手写的' } });
});

test('动作校验：没给参数时按空对象算，不算非法', () => {
  const parsed = validateAction({ action: 'complete', taskId: 'abc123' });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value.params, {});
});

test('动作校验：缺动作类型 → invalid-argument', () => {
  for (const body of [{}, { taskId: 'abc123' }, { action: '', taskId: 'abc123' }, { action: 42, taskId: 'abc123' }]) {
    const parsed = validateAction(body);
    assert.equal(parsed.ok, false, `这份请求体不该通过：${JSON.stringify(body)}`);
    assert.equal(parsed.code, 'invalid-argument');
  }
});

test('动作校验：不支持的动作 → invalid-argument', () => {
  // 「跳过」不是写口：它是纯视图状态、零写入（issue #1 的写口一节）。
  for (const action of ['skip', 'delete', 'reschedual', 'Reschedule']) {
    const parsed = validateAction({ action, taskId: 'abc123' });
    assert.equal(parsed.ok, false, `动作 ${action} 不该被放行`);
    assert.equal(parsed.code, 'invalid-argument');
    assert.match(parsed.message, /不支持的动作/);
  }
});

test('动作校验：目标 id 不是非空字符串 → invalid-argument', () => {
  for (const target of [123, '', '   ', null, undefined, {}]) {
    const parsed = validateAction({ action: 'complete', taskId: target });
    assert.equal(parsed.ok, false, `目标 id ${JSON.stringify(target)} 不该通过`);
    assert.equal(parsed.code, 'invalid-argument');
  }
});

test('动作校验：参数不是对象 → invalid-argument', () => {
  for (const params of ['随手写的', 42, [], null]) {
    const parsed = validateAction({ action: 'complete', taskId: 'abc123', params });
    assert.equal(parsed.ok, false, `参数 ${JSON.stringify(params)} 不该通过`);
    assert.equal(parsed.code, 'invalid-argument');
  }
});

test('动作校验：写方向的键是英文——旧的中文键不再被认', () => {
  // 契约改名（动作 → action、目标id → taskId、参数 → params）：
  // 中文键不再是请求体的一部分，认它等于认错契约。
  const parsed = validateAction({ 动作: 'complete', 目标id: 'abc123', 参数: {} });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'invalid-argument');
});

test('动作校验：请求体不是一个 JSON 对象 → invalid-argument', () => {
  for (const body of [null, undefined, '完成', 42, [], true]) {
    const parsed = validateAction(body);
    assert.equal(parsed.ok, false, `请求体 ${JSON.stringify(body)} 不该通过`);
    assert.equal(parsed.code, 'invalid-argument');
  }
});

test('写口：只开了「完成」与「改期」两个动作类型', () => {
  assert.deepEqual(WRITE_ACTIONS, ['complete', 'reschedule']);
});

test('改期：缺截止日 → invalid-argument', () => {
  for (const params of [undefined, {}, { 截止日: '2026-11-09' }]) {
    const parsed = validateAction({ action: 'reschedule', taskId: 'abc123', params });
    assert.equal(parsed.ok, false, `这份参数不该通过：${JSON.stringify(params)}`);
    assert.equal(parsed.code, 'invalid-argument');
    assert.match(parsed.message, /dueDate/);
  }
});

test('改期：截止日必须是 YYYY-MM-DD（粒度到天，不接受带时刻的字符串）', () => {
  for (const dueDate of ['2026-11-09T10:00:00Z', '2026-11-09 10:00', '2026-11-9', '20261109', '2026/11/09', '2026-11', '', '   ', 20261109, null, {}]) {
    const parsed = validateAction({ action: 'reschedule', taskId: 'abc123', params: { dueDate } });
    assert.equal(parsed.ok, false, `截止日 ${JSON.stringify(dueDate)} 不该通过`);
    assert.equal(parsed.code, 'invalid-argument');
  }
});

test('改期：截止日必须是真实存在的日期', () => {
  for (const dueDate of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2026-02-29']) {
    const parsed = validateAction({ action: 'reschedule', taskId: 'abc123', params: { dueDate } });
    assert.equal(parsed.ok, false, `截止日 ${dueDate} 不该通过`);
    assert.equal(parsed.code, 'invalid-argument');
  }
  // 2028 是闰年：2 月 29 日存在。
  const leap = validateAction({ action: 'reschedule', taskId: 'abc123', params: { dueDate: '2028-02-29' } });
  assert.equal(leap.ok, true);
});

test('改期：越界的年份 → invalid-argument', () => {
  for (const dueDate of ['1900-01-01', '1899-12-31', '3000-01-01', '9999-12-31']) {
    const parsed = validateAction({ action: 'reschedule', taskId: 'abc123', params: { dueDate } });
    assert.equal(parsed.ok, false, `截止日 ${dueDate} 不该通过`);
    assert.equal(parsed.code, 'invalid-argument');
  }
});

test('改期：合法的截止日 → 规范化后只带 dueDate', () => {
  const parsed = validateAction({ action: 'reschedule', taskId: '  abc123  ', params: { dueDate: ' 2026-11-09 ' } });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, { action: 'reschedule', taskId: 'abc123', params: { dueDate: '2026-11-09' } });
});

test('改期：参数里多带别的键 → invalid-argument（改期只认截止日）', () => {
  for (const params of [
    { dueDate: '2026-11-09', title: '换个标题' },
    { dueDate: '2026-11-09', content: '换个内容' },
    { dueDate: '2026-11-09', status: 2 },
  ]) {
    const parsed = validateAction({ action: 'reschedule', taskId: 'abc123', params });
    assert.equal(parsed.ok, false, `这份参数不该通过：${JSON.stringify(params)}`);
    assert.equal(parsed.code, 'invalid-argument');
  }
});

test('改期：目标 id 缺失照样 invalid-argument', () => {
  const parsed = validateAction({ action: 'reschedule', params: { dueDate: '2026-11-09' } });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'invalid-argument');
});

test('目标定位：在纸箱里找到目标动作，给出它所在清单的 id', () => {
  const located = locateInContainer({
    container: CONTAINERS[1],
    tasks: [{ id: 'abc123', projectId: '7c4e00000000000000000002' }],
    taskId: 'abc123',
  });
  assert.ok(located !== null);
  assert.equal(located.container.key, 'execution');
  assert.equal(located.projectId, '7c4e00000000000000000002');
});

test('目标定位：收集箱里的动作也认（收集箱的 id 不是 24 位）', () => {
  const located = locateInContainer({
    container: CONTAINERS[0],
    tasks: [{ id: 'inbox-task', projectId: 'inbox9000000001' }],
    taskId: 'inbox-task',
  });
  assert.ok(located !== null);
  assert.equal(located.container.key, 'inbox');
  assert.equal(located.projectId, 'inbox9000000001');
  assert.notEqual(located.projectId.length, 24);
});

test('目标定位：条目上没带清单 id 时退回纸箱配置的 id', () => {
  const located = locateInContainer({
    container: CONTAINERS[1],
    tasks: [{ id: 'abc123' }],
    taskId: 'abc123',
  });
  assert.ok(located !== null);
  assert.equal(located.projectId, '7c4e00000000000000000002');
});

test('目标定位：找不到就是 null，不抛', () => {
  const located = locateInContainer({
    container: CONTAINERS[1],
    tasks: [{ id: 'abc123', projectId: '7c4e00000000000000000002' }],
    taskId: '根本没有的那条',
  });
  assert.equal(located, null);
  assert.equal(locateInContainer({ container: CONTAINERS[1], tasks: [], taskId: '' }), null);
});

test('失败码映射：读方向与写方向同一套语义', () => {
  const cases = [
    ['not-authenticated', 401],
    ['cli-unavailable', 503],
    ['cli-failed', 502],
    ['not-found', 404],
    ['invalid-argument', 400],
  ];
  for (const [code, status] of cases) {
    const failure = describeFailure(new ActionError(code, `失败原因：${code}`));
    assert.equal(failure.status, status, `${code} 的状态码不对`);
    assert.equal(failure.code, code);
    assert.equal(failure.message, `失败原因：${code}`);
  }
});

test('失败码映射：认不出的错误一律 internal-error（500），不糊成别的失败', () => {
  const failure = describeFailure(new Error('炸了'));
  assert.equal(failure.status, 500);
  assert.equal(failure.code, 'internal-error');
  assert.equal(failure.message, '炸了');
});
