/**
 * 截止日文本（粒度到天）与时刻之间的换算：纯函数。
 *
 * 「改期」给的是一天，滴答要的是带时刻的时间戳——换算规则只有一条：
 * 截止日按**给定时区**取那天的 `23:59:59`。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cliTimestamp, endOfDayInstant, parseDueDate } from '../lib/dates.js';

const SHANGHAI = 'Asia/Shanghai';

test('截止日文本：形状必须是 YYYY-MM-DD', () => {
  const parsed = parseDueDate('2026-11-09');
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, { text: '2026-11-09', year: 2026, month: 11, day: 9 });
  for (const text of ['2026-11-09T10:00:00Z', '2026-11-9', '20261109', '2026/11/09', '', '  ', '2026-11-09 ']) {
    const bad = parseDueDate(text);
    if (text === '2026-11-09 ') {
      // 前后空格是允许的（客户端可能带着空格过来）。
      assert.equal(bad.ok, true, `「${text}」不该被拒`);
      continue;
    }
    assert.equal(bad.ok, false, `「${text}」不该通过`);
    assert.equal(typeof bad.message, 'string');
  }
});

test('截止日文本：必须是真实存在的日期', () => {
  for (const text of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31']) {
    const parsed = parseDueDate(text);
    assert.equal(parsed.ok, false, `「${text}」不是真实存在的日期`);
  }
  assert.equal(parseDueDate('2028-02-29').ok, true, '2028 是闰年');
  assert.equal(parseDueDate('2026-02-29').ok, false, '2026 不是闰年');
});

test('截止日文本：年份越界不给改', () => {
  for (const text of ['1900-01-01', '1899-12-31', '3000-01-01', '9999-12-31']) {
    assert.equal(parseDueDate(text).ok, false, `「${text}」越界`);
  }
  assert.equal(parseDueDate('1970-01-01').ok, true);
  assert.equal(parseDueDate('2999-12-31').ok, true);
});

test('截止日换算成时刻：取那天的 23:59:59（按给定时区）', () => {
  // Asia/Shanghai 是 UTC+8：当天结束的那一刻是 UTC 的 15:59:59。
  const instant = endOfDayInstant('2026-11-09', SHANGHAI);
  assert.ok(instant instanceof Date);
  assert.equal(instant.toISOString(), '2026-11-09T15:59:59.000Z');
});

test('截止日换算成时刻：跟着时区走', () => {
  assert.equal(endOfDayInstant('2026-11-09', 'UTC').toISOString(), '2026-11-09T23:59:59.000Z');
  // 美东是 UTC-5（11 月是标准时）：当天结束是 UTC 次日 04:59:59。
  assert.equal(endOfDayInstant('2026-11-09', 'America/New_York').toISOString(), '2026-11-10T04:59:59.000Z');
});

test('截止日换算成时刻：闰日也算得出来', () => {
  assert.equal(endOfDayInstant('2028-02-29', SHANGHAI).toISOString(), '2028-02-29T15:59:59.000Z');
});

test('截止日换算成时刻：非法截止日换不出来', () => {
  for (const text of ['2026-02-30', '2026-11-09T10:00:00Z', '1900-01-01', '']) {
    assert.equal(endOfDayInstant(text, SHANGHAI), null, `「${text}」不该换出时刻`);
  }
});

test('时刻写成滴答要的时间戳（yyyy-MM-ddTHH:mm:ss+0000）', () => {
  assert.equal(cliTimestamp(new Date('2026-11-09T15:59:59.000Z')), '2026-11-09T15:59:59+0000');
  assert.equal(cliTimestamp(new Date('2026-01-02T03:04:05.000Z')), '2026-01-02T03:04:05+0000');
});
