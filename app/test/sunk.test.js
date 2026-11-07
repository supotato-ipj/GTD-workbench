/**
 * 已沉底区的组装（纯逻辑）。
 *
 * 断言的是「哪些完成条目上画布、按什么堆、每个纸箱几个」。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SUNK_WINDOW_DAYS, localStampOf, shiftDate, sunkOf, windowOf } from '../lib/sunk.js';

const TIME_ZONE = 'Asia/Shanghai';
const TODAY = '2026-11-05';

/** 两个纸箱。 */
const CONTAINERS = [
  { key: 'execution', projectId: 'p-exec' },
  { key: 'waiting', projectId: 'p-wait' },
];

/**
 * 造一条已完成任务。
 * @param {object} overrides - 覆盖项。
 * @returns {object} 原始任务。
 */
function done(overrides = {}) {
  return {
    id: 'c1',
    projectId: 'p-exec',
    title: '某事',
    status: 2,
    completedTime: '2026-11-04T11:26:38.000+0000',
    ...overrides,
  };
}

test('已沉底：本地日期按指定时区算', () => {
  // 2026-11-04T11:26:38Z 在北京是 11/4 19:26。
  assert.deepEqual(localStampOf('2026-11-04T11:26:38.000+0000', TIME_ZONE), { date: '2026-11-04', time: '19:26' });
  // 2026-11-03T16:00:00Z 在北京已经是 11/4 00:00。
  assert.deepEqual(localStampOf('2026-11-03T16:00:00.000+0000', TIME_ZONE), { date: '2026-11-04', time: '00:00' });
  assert.equal(localStampOf(null, TIME_ZONE), null);
  assert.equal(localStampOf('不是时间', TIME_ZONE), null);
});

test('已沉底：窗口是最近七天（含今天）', () => {
  assert.equal(SUNK_WINDOW_DAYS, 7);
  assert.deepEqual(windowOf(TODAY), { from: '2026-10-30', to: '2026-11-05' });
  assert.equal(shiftDate('2026-11-05', -6), '2026-10-30');
  assert.equal(shiftDate('2026-11-05', 1), '2026-11-06');
  assert.equal(shiftDate('不是日期', 1), null);
});

test('已沉底：只留最近七天的完成条目，更早的不出现', () => {
  const sunk = sunkOf({
    tasks: [
      done({ id: 'in-1', completedTime: '2026-11-04T11:26:38.000+0000' }),
      done({ id: 'edge-from', completedTime: '2026-10-29T16:30:00.000+0000' }), // 本地 10/30 00:30，在窗口内
      done({ id: 'too-old', completedTime: '2026-10-28T11:00:00.000+0000' }), // 本地 10/28，出窗口
      done({ id: 'edge-to', completedTime: '2026-11-05T15:00:00.000+0000' }), // 本地 11/5 23:00，在窗口内
    ],
    containers: CONTAINERS,
    timeZone: TIME_ZONE,
    today: TODAY,
  });
  const ids = sunk.days.flatMap((day) => day.notes.map((note) => note.id));
  assert.deepEqual(ids.sort(), ['edge-from', 'edge-to', 'in-1']);
  assert.equal(ids.includes('too-old'), false);
});

test('已沉底：按完成日堆叠，最近的日期在最上面', () => {
  const sunk = sunkOf({
    tasks: [
      done({ id: 'old', completedTime: '2026-11-01T02:00:00.000+0000' }),
      done({ id: 'new', completedTime: '2026-11-04T02:00:00.000+0000' }),
      done({ id: 'mid', completedTime: '2026-11-02T02:00:00.000+0000' }),
    ],
    containers: CONTAINERS,
    timeZone: TIME_ZONE,
    today: TODAY,
  });
  assert.deepEqual(
    sunk.days.map((day) => day.date),
    ['2026-11-04', '2026-11-02', '2026-11-01'],
  );
});

test('已沉底：同一天内按完成时刻先后排', () => {
  const sunk = sunkOf({
    tasks: [
      done({ id: 'late', completedTime: '2026-11-04T10:00:00.000+0000' }),
      done({ id: 'early', completedTime: '2026-11-04T02:00:00.000+0000' }),
    ],
    containers: CONTAINERS,
    timeZone: TIME_ZONE,
    today: TODAY,
  });
  assert.equal(sunk.days.length, 1);
  assert.deepEqual(
    sunk.days[0].notes.map((note) => note.id),
    ['early', 'late'],
  );
});

test('已沉底：每个纸箱另记一个完成数', () => {
  const sunk = sunkOf({
    tasks: [
      done({ id: 'a', projectId: 'p-exec' }),
      done({ id: 'b', projectId: 'p-exec' }),
      done({ id: 'c', projectId: 'p-wait' }),
      done({ id: 'out', projectId: 'p-exec', completedTime: '2026-10-01T02:00:00.000+0000' }),
    ],
    containers: CONTAINERS,
    timeZone: TIME_ZONE,
    today: TODAY,
  });
  // 出窗口的那条不计入。
  assert.deepEqual(sunk.counts, { execution: 2, waiting: 1 });
});

test('已沉底：完成情况以滴答勾选为准——批量勾选也算完成', () => {
  // 11/4 15:08 三条同刻批量勾选：如实算三条完成，不试图纠正（ADR-0006 的已知代价）。
  const batch = ['b1', 'b2', 'b3'].map((id) =>
    done({ id, completedTime: '2026-11-04T07:08:00.000+0000' }),
  );
  const sunk = sunkOf({ tasks: batch, containers: CONTAINERS, timeZone: TIME_ZONE, today: TODAY });
  assert.equal(sunk.counts.execution, 3);
  assert.equal(sunk.days[0].notes.length, 3);
});

test('已沉底：不是已完成状态的、归不到纸箱的、缺完成时刻的都不上画布', () => {
  const sunk = sunkOf({
    tasks: [
      done({ id: 'open', status: 0 }),
      done({ id: 'foreign', projectId: 'p-unknown' }),
      done({ id: 'no-time', completedTime: undefined }),
      done({ id: 'ok' }),
    ],
    containers: CONTAINERS,
    timeZone: TIME_ZONE,
    today: TODAY,
  });
  assert.deepEqual(sunk.days.flatMap((day) => day.notes.map((note) => note.id)), ['ok']);
});

test('已沉底：没有完成条目时是空的天堆，不是崩', () => {
  const sunk = sunkOf({ tasks: [], containers: CONTAINERS, timeZone: TIME_ZONE, today: TODAY });
  assert.deepEqual(sunk.days, []);
  assert.deepEqual(sunk.counts, { execution: 0, waiting: 0 });
  assert.equal(sunk.windowDays, 7);
  assert.equal(sunk.from, '2026-10-30');
  assert.equal(sunk.to, '2026-11-05');
});
