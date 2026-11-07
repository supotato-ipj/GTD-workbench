/**
 * 时间轴分段规则（纯函数层）：一个截止日落在哪一段。
 *
 * 这是工单 03 的规则层。渲染层只负责画，分段规则在这里定死并测住：
 * 今天 / 明天 / 本周 / 以后四段，天刻度（ADR-0007）。
 *
 * 基准是**本地时间的今天**。`Asia/Shanghai` 是滴答那侧的口径（ADR-0008），
 * 所以这里只拿「今天」当纯文本日期用，不做时区换算。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_EXPANDED_SEGMENTS,
  SEGMENTS,
  isOverdue,
  localDateText,
  segmentOf,
  timelineFor,
} from '../lib/timeline.js';

/** 固定基准日：2026-11-05 是周四；本周日是 2026-11-08，下周一是 2026-11-09。 */
const TODAY = '2026-11-05';

test('时间轴有四段，顺序固定：今天、明天、本周、以后', () => {
  assert.deepEqual(SEGMENTS, ['today', 'tomorrow', 'thisWeek', 'later']);
});

test('截止日就是今天 → 落在「今天」段', () => {
  assert.equal(segmentOf('2026-11-05', TODAY), 'today');
});

test('截止日是明天 → 落在「明天」段', () => {
  assert.equal(segmentOf('2026-11-06', TODAY), 'tomorrow');
});

test('今天之后、到本周日为止 → 落在「本周」段', () => {
  assert.equal(segmentOf('2026-11-07', TODAY), 'thisWeek');
  assert.equal(segmentOf('2026-11-08', TODAY), 'thisWeek');
});

test('本周日之后 → 落在「以后」段', () => {
  assert.equal(segmentOf('2026-11-09', TODAY), 'later');
  assert.equal(segmentOf('2026-12-31', TODAY), 'later');
});

test('明天虽然在本周之内，也归「明天」段——一段只归一段', () => {
  assert.equal(segmentOf('2026-11-06', TODAY), 'tomorrow');
  assert.notEqual(segmentOf('2026-11-06', TODAY), 'thisWeek');
});

test('没有截止日 → 落在「以后」段，不静默消失', () => {
  assert.equal(segmentOf(null, TODAY), 'later');
  assert.equal(segmentOf('', TODAY), 'later');
  assert.equal(segmentOf('不是日期', TODAY), 'later');
});

test('过期未完成 → 归「今天」段，并标出逾期', () => {
  assert.equal(segmentOf('2026-11-03', TODAY), 'today');
  assert.equal(isOverdue('2026-11-03', TODAY), true);
  assert.equal(isOverdue('2026-11-04', TODAY), true);
  assert.equal(isOverdue(TODAY, TODAY), false);
  assert.equal(isOverdue('2026-11-06', TODAY), false);
  assert.equal(isOverdue(null, TODAY), false);
});

test('默认视野只铺今天与本周', () => {
  assert.deepEqual(DEFAULT_EXPANDED_SEGMENTS, ['today', 'thisWeek']);
});

test('时间轴边界按本地时间的今天算：今天、明天、本周日、以后从哪天起', () => {
  assert.deepEqual(timelineFor(TODAY), {
    today: '2026-11-05',
    tomorrow: '2026-11-06',
    weekEnd: '2026-11-08',
    laterFrom: '2026-11-09',
  });
});

test('本周从周一开始，周日是本周最后一天', () => {
  // 周一开局：本周日到 11/08 仍然算本周。
  assert.equal(timelineFor('2026-11-02').weekEnd, '2026-11-08');
  // 周日开局：本周到今天为止，明天就出本周。
  assert.equal(timelineFor('2026-11-08').weekEnd, '2026-11-08');
  assert.equal(timelineFor('2026-11-08').laterFrom, '2026-11-09');
});

test('本地日期按指定时区取——滴答那侧用 Asia/Shanghai（ADR-0008）', () => {
  // 2026-11-04T16:15Z 在 Asia/Shanghai 是 11/05 00:15，在 UTC 还是 11/04。
  assert.equal(localDateText(new Date('2026-11-04T16:15:00.000Z'), 'Asia/Shanghai'), '2026-11-05');
  assert.equal(localDateText(new Date('2026-11-04T16:15:00.000Z'), 'UTC'), '2026-11-04');
});
