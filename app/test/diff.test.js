/**
 * 状态迁移的差异检测（纯逻辑）。
 *
 * ADR-0007：动画**只演真实发生过的差异**。这里断言的就是「什么算差异、什么不算」。
 *
 * 关键一条：**新完成只能从已沉底区比出来**。未完成取数带 `--status 0`，一条事勾完就从纸箱里消失了，
 * 靠未完成那份永远看不到它变成已完成。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { diffSnapshots, motionsOf, summarize } from '../lib/diff.js';

/**
 * 造一份快照。
 * @param {object} containers - 容器键 → 便贴数组。
 * @param {object[]} [sunkNotes] - 已沉底区的条目（都算同一天）。
 * @returns {object} 快照。
 */
function snapshotOf(containers, sunkNotes = []) {
  return {
    containers: Object.entries(containers).map(([key, notes]) => ({ key, name: key, notes })),
    sunk: {
      windowDays: 7,
      from: '2026-10-30',
      to: '2026-11-05',
      days: sunkNotes.length === 0 ? [] : [{ date: '2026-11-05', notes: sunkNotes }],
      counts: {},
    },
  };
}

/**
 * 造一条便贴。
 * @param {object} overrides - 覆盖项。
 * @returns {object} 便贴。
 */
function note(overrides = {}) {
  return { id: 'n1', title: '某事', status: 0, dueDate: '2026-11-05', ...overrides };
}

test('差异：摘要只留未完成条目的容器／到期日／状态，外加已沉底的 id', () => {
  const summary = summarize(
    snapshotOf({ execution: [note({ id: 'a', title: '标题', content: '正文' })] }, [{ id: 's1', container: 'waiting', title: '沉下去了' }]),
  );
  assert.deepEqual(summary.notes, { a: { container: 'execution', dueDate: '2026-11-05', status: 0 } });
  assert.deepEqual(summary.sunk, { s1: { date: '2026-11-05', container: 'waiting' } });
  // 标题与正文不进摘要：改一个字不该触发动画。
  assert.equal(JSON.stringify(summary).includes('标题'), false);
  assert.equal(JSON.stringify(summary).includes('正文'), false);
});

test('差异：新完成会被认出来——它新出现在已沉底区里', () => {
  const before = summarize(snapshotOf({ execution: [note({ id: 'a' })] }, []));
  const after = summarize(snapshotOf({ execution: [] }, [{ id: 'a', container: 'execution' }]));
  assert.deepEqual(diffSnapshots(before, after), { completed: ['a'], rescheduled: [], moved: [] });
  assert.deepEqual(motionsOf(diffSnapshots(before, after)), { a: 'completed' });
});

test('差异：光在未完成那份里改成 status=2 不算新完成——那条已经从取数里消失了', () => {
  const before = summarize(snapshotOf({ execution: [note({ id: 'a' })] }));
  const after = summarize(snapshotOf({ execution: [note({ id: 'a', status: 2 })] }));
  assert.deepEqual(diffSnapshots(before, after), { completed: [], rescheduled: [], moved: [] });
});

test('差异：已经沉下去很久的条目不算这次的完成', () => {
  const sunk = [{ id: 'old', container: 'execution' }];
  const before = summarize(snapshotOf({ execution: [] }, sunk));
  const after = summarize(snapshotOf({ execution: [] }, sunk));
  assert.deepEqual(diffSnapshots(before, after), { completed: [], rescheduled: [], moved: [] });
});

test('差异：新改期会被认出来', () => {
  const before = summarize(snapshotOf({ execution: [note({ id: 'a' })] }));
  const after = summarize(snapshotOf({ execution: [note({ id: 'a', dueDate: '2026-11-09' })] }));
  assert.deepEqual(diffSnapshots(before, after), { completed: [], rescheduled: ['a'], moved: [] });
});

test('差异：新换容器会被认出来', () => {
  const before = summarize(snapshotOf({ execution: [note({ id: 'a' })], waiting: [] }));
  const after = summarize(snapshotOf({ execution: [], waiting: [note({ id: 'a' })] }));
  assert.deepEqual(diffSnapshots(before, after), { completed: [], rescheduled: [], moved: ['a'] });
});

test('差异：没变化就是没有差异——不重播动画', () => {
  const before = summarize(snapshotOf({ execution: [note({ id: 'a' }), note({ id: 'b' })] }, [{ id: 's1', container: 'waiting' }]));
  const after = summarize(snapshotOf({ execution: [note({ id: 'a' }), note({ id: 'b' })] }, [{ id: 's1', container: 'waiting' }]));
  assert.deepEqual(diffSnapshots(before, after), { completed: [], rescheduled: [], moved: [] });
  assert.deepEqual(motionsOf(diffSnapshots(before, after)), {});
});

test('差异：第一次拉数（没有基线）不演任何变化', () => {
  const after = summarize(snapshotOf({ execution: [note({ id: 'a' })] }, [{ id: 's1', container: 'execution' }]));
  assert.deepEqual(diffSnapshots(null, after), { completed: [], rescheduled: [], moved: [] });
  assert.deepEqual(diffSnapshots(undefined, after), { completed: [], rescheduled: [], moved: [] });
});

test('差异：新出现的未完成条目不算迁移——它没有「上次」', () => {
  const before = summarize(snapshotOf({ execution: [] }));
  const after = summarize(snapshotOf({ execution: [note({ id: 'new' })] }));
  assert.deepEqual(diffSnapshots(before, after), { completed: [], rescheduled: [], moved: [] });
});

test('差异：已经消失的未完成条目不算迁移——它不在画布上了', () => {
  const before = summarize(snapshotOf({ execution: [note({ id: 'gone' })] }));
  const after = summarize(snapshotOf({ execution: [] }));
  assert.deepEqual(diffSnapshots(before, after), { completed: [], rescheduled: [], moved: [] });
});

test('差异：换容器优先于改期，一次只动一下', () => {
  const before = summarize(snapshotOf({ execution: [note({ id: 'a' })] }));
  const after = summarize(snapshotOf({ waiting: [note({ id: 'a', dueDate: '2026-11-30' })] }));
  const diff = diffSnapshots(before, after);
  assert.deepEqual(diff.moved, ['a']);
  assert.deepEqual(diff.rescheduled, []);
  assert.deepEqual(motionsOf(diff), { a: 'moved' });
});

test('差异：坏输入不抛', () => {
  assert.deepEqual(summarize(null), { notes: {}, sunk: {} });
  assert.deepEqual(summarize({ containers: null, sunk: null }), { notes: {}, sunk: {} });
  assert.deepEqual(diffSnapshots({ notes: null }, { notes: null }), { completed: [], rescheduled: [], moved: [] });
  assert.deepEqual(motionsOf(null), {});
});
