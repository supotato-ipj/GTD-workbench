/**
 * 焦点资格与排序（纯逻辑）。
 *
 * 断言的是「谁有资格上卡」与「多个候选怎么排」：
 * 资格是**过滤**（GTD 明晰流程图），排序是**四标准映射**（GTD 选择行动）。
 * 每条不合格的都要能说出原因——下钻层要把它显示出来（ADR-0010）。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { capacityFor } from '../lib/capacity.js';
import {
  INELIGIBLE_REASONS,
  eligibilityOf,
  focusGuideOf,
  rankOf,
  withEligibility,
} from '../lib/focus-guide.js';

const TODAY = '2026-11-05';
const NOW = '09:30';

/**
 * 造一份上下文。
 * @param {object} [overrides] - 覆盖项。
 * @returns {object} 上下文。
 */
function context(overrides = {}) {
  const time = typeof overrides.nowTime === 'string' ? overrides.nowTime : NOW;
  const capacity = capacityFor({ date: TODAY, time });
  return { today: TODAY, nowTime: time, capacity, ...overrides };
}

/**
 * 造一个容器组。
 * @param {string} key - 容器标识。
 * @param {object[]} notes - 便贴。
 * @returns {object} 容器组。
 */
function container(key, notes) {
  return { key, name: key, notes };
}

/**
 * 造一条便贴。
 * @param {object} overrides - 覆盖项。
 * @returns {object} 便贴。
 */
function note(overrides = {}) {
  return {
    id: 'n1',
    title: '某事',
    status: 0,
    content: '',
    timeBand: '事务',
    timeBands: ['事务'],
    segment: 'today',
    dueAt: '2026-11-05T02:00:00.000Z',
    dueLocal: '2026-11-05 10:00',
    dueDate: '2026-11-05',
    dueTime: '10:00',
    dueAllDay: false,
    startAt: null,
    startLocal: null,
    priority: 0,
    ...overrides,
  };
}

test('资格：执行清单里带唯一时间档的动作有资格', () => {
  assert.deepEqual(eligibilityOf(note(), 'execution', context()), { eligible: true, reason: null });
});

test('资格：缺时间档视为未判定，不进焦点', () => {
  const result = eligibilityOf(note({ timeBand: null, timeBands: [] }), 'execution', context());
  assert.deepEqual(result, { eligible: false, reason: '未判定' });
});

test('资格：挂了两个时间档的也算未判定', () => {
  const result = eligibilityOf(
    note({ timeBand: null, timeBands: ['深度', '事务'] }),
    'execution',
    context(),
  );
  assert.deepEqual(result, { eligible: false, reason: '未判定' });
});

test('资格：收集箱里未判定的捕获不进焦点', () => {
  const result = eligibilityOf(note({ timeBand: null, timeBands: [] }), 'inbox', context());
  assert.deepEqual(result, { eligible: false, reason: '收集箱未明晰' });
});

test('资格：项目清单不出卡', () => {
  assert.deepEqual(eligibilityOf(note(), 'project', context()), {
    eligible: false,
    reason: '项目不出卡',
  });
});

test('资格：等待清单永不占主卡', () => {
  assert.deepEqual(eligibilityOf(note(), 'waiting', context()), { eligible: false, reason: '等待' });
});

test('资格：日清不参与排序，顶部常驻', () => {
  const result = eligibilityOf(
    note({ timeBand: '日清', timeBands: ['日清'] }),
    'execution',
    context(),
  );
  assert.deepEqual(result, { eligible: false, reason: '日清常驻顶部' });
});

test('资格：日历项只在它那一个时刻有资格', () => {
  const future = note({
    startAt: '2026-12-12T06:00:00.000Z',
    startLocal: '2026-12-12 14:00',
    dueLocal: '2026-12-12 15:00',
    dueDate: '2026-12-12',
    dueTime: '15:00',
    segment: 'later',
  });
  assert.deepEqual(eligibilityOf(future, 'calendar', context()), {
    eligible: false,
    reason: '未来日历项',
  });

  // 就在当前窗口（09:00–12:00）里开始的那一个 → 即将到，有资格。
  const soon = note({
    startAt: '2026-11-05T01:30:00.000Z',
    startLocal: '2026-11-05 09:30',
    dueLocal: '2026-11-05 10:30',
    dueTime: '10:30',
  });
  assert.deepEqual(eligibilityOf(soon, 'calendar', context()), { eligible: true, reason: null });

  // 已经过了开始时刻（还开着）→ 有资格。
  const started = note({
    startAt: '2026-11-05T00:30:00.000Z',
    startLocal: '2026-11-05 08:30',
    dueLocal: '2026-11-05 10:30',
    dueTime: '10:30',
  });
  assert.deepEqual(eligibilityOf(started, 'calendar', context()), { eligible: true, reason: null });
});

test('资格：可能清单到触碰日才进焦点', () => {
  const later = note({ dueDate: '2026-12-01', dueLocal: '2026-12-01 08:20', segment: 'later' });
  assert.deepEqual(eligibilityOf(later, 'maybe', context()), {
    eligible: false,
    reason: '未到触碰日',
  });
  const arrived = note({ dueDate: '2026-11-05', dueLocal: '2026-11-05 08:20' });
  assert.deepEqual(eligibilityOf(arrived, 'maybe', context()), { eligible: true, reason: null });
});

test('资格：不合格原因都在词表里', () => {
  assert.ok(INELIGIBLE_REASONS.includes('未判定'));
  assert.ok(INELIGIBLE_REASONS.includes('等待'));
  assert.ok(INELIGIBLE_REASONS.includes('收集箱未明晰'));
  assert.ok(INELIGIBLE_REASONS.includes('未来日历项'));
  assert.ok(INELIGIBLE_REASONS.includes('项目不出卡'));
  assert.ok(INELIGIBLE_REASONS.includes('未到触碰日'));
  assert.ok(INELIGIBLE_REASONS.includes('日清常驻顶部'));
  assert.ok(INELIGIBLE_REASONS.includes('深度配额已用'));
});

test('资格：补上 eligible 与 ineligibleReason 两个字段', () => {
  const tagged = withEligibility(note(), 'execution', context());
  assert.equal(tagged.eligible, true);
  assert.equal(tagged.ineligibleReason, null);
  const rejected = withEligibility(note({ timeBand: null, timeBands: [] }), 'execution', context());
  assert.equal(rejected.eligible, false);
  assert.equal(rejected.ineligibleReason, '未判定');
});

test('资格：坏输入不抛', () => {
  assert.deepEqual(eligibilityOf(null, 'execution', context()), { eligible: false, reason: '未判定' });
  assert.deepEqual(eligibilityOf(note(), 'execution', undefined), { eligible: false, reason: '未判定' });
});

test('排序：逾期或今天到期排最前', () => {
  const rows = rankOf(
    [
      note({
        id: 'b',
        dueDate: '2026-11-10',
        dueLocal: '2026-11-10 10:00',
        dueAt: '2026-11-10T02:00:00.000Z',
        segment: 'thisWeek',
      }),
      note({
        id: 'a',
        dueDate: '2026-11-03',
        dueLocal: '2026-11-03 10:00',
        dueAt: '2026-11-03T02:00:00.000Z',
        overdue: true,
      }),
      note({
        id: 'c',
        dueDate: '2026-11-05',
        dueLocal: '2026-11-05 18:00',
        dueAt: '2026-11-05T10:00:00.000Z',
      }),
    ],
    context(),
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['a', 'c', 'b'],
  );
});

test('排序：本周主攻排在事务前面', () => {
  const rows = rankOf(
    [
      note({
        id: '事务',
        timeBand: '事务',
        timeBands: ['事务'],
        dueDate: '2026-11-06',
        dueLocal: '2026-11-06 10:00',
        dueAt: '2026-11-06T02:00:00.000Z',
        segment: 'tomorrow',
      }),
      note({
        id: '主攻',
        timeBand: '深度',
        timeBands: ['深度'],
        dueDate: '2026-11-07',
        dueLocal: '2026-11-07 10:00',
        dueAt: '2026-11-07T02:00:00.000Z',
        segment: 'thisWeek',
      }),
    ],
    context(),
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['主攻', '事务'],
  );
});

test('排序：本周内到期排在事务填充前面', () => {
  const rows = rankOf(
    [
      note({
        id: '事务',
        timeBand: '事务',
        timeBands: ['事务'],
        dueDate: '2026-11-06',
        dueLocal: '2026-11-06 10:00',
        dueAt: '2026-11-06T02:00:00.000Z',
        segment: 'tomorrow',
      }),
      note({
        id: '本周',
        timeBand: '事务',
        timeBands: ['事务'],
        dueDate: '2026-11-07',
        dueLocal: '2026-11-07 10:00',
        dueAt: '2026-11-07T02:00:00.000Z',
        segment: 'thisWeek',
      }),
    ],
    context(),
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['本周', '事务'],
  );
});

test('排序：同组内按到期时间升序，再按 id 稳定排序', () => {
  const rows = rankOf(
    [
      note({ id: 'b', dueLocal: '2026-11-05 10:00', dueAt: '2026-11-05T02:00:00.000Z' }),
      note({ id: 'a', dueLocal: '2026-11-05 10:00', dueAt: '2026-11-05T02:00:00.000Z' }),
      note({ id: 'c', dueLocal: '2026-11-05 09:00', dueAt: '2026-11-05T01:00:00.000Z' }),
    ],
    context(),
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['c', 'a', 'b'],
  );
});

test('排序：同组内优先级只做 tiebreaker，不跨组', () => {
  const rows = rankOf(
    [
      note({ id: '低优先', priority: 1, dueLocal: '2026-11-05 10:00' }),
      note({ id: '高优先', priority: 5, dueLocal: '2026-11-05 10:00' }),
      note({ id: '本周高优先', priority: 5, dueDate: '2026-11-07', dueLocal: '2026-11-07 10:00', segment: 'thisWeek' }),
    ],
    context(),
  );
  // 今天到期的两条仍在前面（组别优先），组内高优先在前。
  assert.deepEqual(
    rows.map((row) => row.id),
    ['高优先', '低优先', '本周高优先'],
  );
});

test('排序：两次排序结果一致', () => {
  const notes = [
    note({ id: 'b', dueLocal: '2026-11-05 10:00' }),
    note({ id: 'a', dueLocal: '2026-11-05 10:00' }),
    note({ id: 'c', dueLocal: '2026-11-06 10:00', dueDate: '2026-11-06', segment: 'tomorrow' }),
  ];
  assert.deepEqual(
    rankOf(notes, context()).map((row) => row.id),
    rankOf([...notes].reverse(), context()).map((row) => row.id),
  );
});

test('焦点：主卡至多一条', () => {
  const guide = focusGuideOf(
    [
      container('execution', [
        note({ id: 'a', dueLocal: '2026-11-05 10:00' }),
        note({ id: 'b', dueLocal: '2026-11-05 14:00', dueAt: '2026-11-05T06:00:00.000Z', dueTime: '14:00' }),
      ]),
    ],
    context(),
  );
  assert.ok(guide.card !== null);
  assert.equal(typeof guide.card.id, 'string');
});

test('焦点：连续窗口优先派深度', () => {
  const guide = focusGuideOf(
    [
      container('execution', [
        note({ id: '事务', timeBand: '事务', timeBands: ['事务'], dueLocal: '2026-11-05 10:00' }),
        note({
          id: '深度',
          timeBand: '深度',
          timeBands: ['深度'],
          dueLocal: '2026-11-05 14:00',
          dueAt: '2026-11-05T06:00:00.000Z',
          dueTime: '14:00',
        }),
      ]),
    ],
    context({ nowTime: '09:30' }),
  );
  assert.equal(guide.card.id, '深度');
});

test('焦点：可打断窗口派事务', () => {
  const guide = focusGuideOf(
    [
      container('execution', [
        note({
          id: '事务',
          timeBand: '事务',
          timeBands: ['事务'],
          dueLocal: '2026-11-05 15:00',
          dueAt: '2026-11-05T07:00:00.000Z',
          dueTime: '15:00',
        }),
        note({
          id: '深度',
          timeBand: '深度',
          timeBands: ['深度'],
          dueLocal: '2026-11-05 18:00',
          dueAt: '2026-11-05T10:00:00.000Z',
          dueTime: '18:00',
        }),
      ]),
    ],
    context({ nowTime: '14:00' }),
  );
  assert.equal(guide.card.id, '事务');
});

test('焦点：当前时刻落在窗口外时不报错，按排序取第一条', () => {
  const guide = focusGuideOf(
    [
      container('execution', [
        note({ id: 'a', dueLocal: '2026-11-05 10:00' }),
        note({
          id: 'b',
          dueLocal: '2026-11-05 14:00',
          dueAt: '2026-11-05T06:00:00.000Z',
          dueTime: '14:00',
        }),
      ]),
    ],
    context({ nowTime: '20:00' }),
  );
  assert.ok(guide.card !== null);
  assert.equal(guide.card.id, 'a');
});

test('焦点：逾期的动作优先于时段偏好——破掉的外部时间点不可逆', () => {
  const guide = focusGuideOf(
    [
      container('execution', [
        note({
          id: '逾期事务',
          timeBand: '事务',
          timeBands: ['事务'],
          dueDate: '2026-11-03',
          dueLocal: '2026-11-03 10:00',
          dueAt: '2026-11-03T02:00:00.000Z',
          overdue: true,
        }),
        note({
          id: '深度',
          timeBand: '深度',
          timeBands: ['深度'],
          dueLocal: '2026-11-05 14:00',
          dueAt: '2026-11-05T06:00:00.000Z',
          dueTime: '14:00',
        }),
      ]),
    ],
    context({ nowTime: '09:30' }),
  );
  assert.equal(guide.card.id, '逾期事务');
});

test('焦点：深度名额用完后，后续深度动作推到下一天', () => {
  const guide = focusGuideOf(
    [
      container('execution', [
        note({
          id: '深度一',
          timeBand: '深度',
          timeBands: ['深度'],
          dueLocal: '2026-11-05 10:00',
        }),
        note({
          id: '深度二',
          timeBand: '深度',
          timeBands: ['深度'],
          dueLocal: '2026-11-05 14:00',
          dueAt: '2026-11-05T06:00:00.000Z',
          dueTime: '14:00',
        }),
      ]),
    ],
    context({ nowTime: '09:30' }),
  );
  assert.equal(guide.card.id, '深度一');
  assert.deepEqual(guide.pushed, ['深度二']);
  assert.equal(guide.deepQuotaUsed, true);
  // 被推走的那条不进「接下来」。
  assert.equal(
    guide.next.some((item) => item.id === '深度二'),
    false,
  );
});

test('焦点：「接下来」最多四条', () => {
  const notes = [];
  for (let index = 0; index < 6; index += 1) {
    notes.push(
      note({
        id: `n${index}`,
        dueLocal: `2026-11-05 ${String(10 + index).padStart(2, '0')}:00`,
        dueAt: `2026-11-05T${String(2 + index).padStart(2, '0')}:00:00.000Z`,
        dueTime: `${String(10 + index).padStart(2, '0')}:00`,
      }),
    );
  }
  const guide = focusGuideOf([container('execution', notes)], context({ nowTime: '09:30' }));
  assert.equal(guide.next.length, 4);
  assert.ok(guide.card !== null);
});

test('焦点：等待清单「到期没回」只进提醒位，不占主卡', () => {
  const guide = focusGuideOf(
    [
      container('execution', [note({ id: '动作', dueLocal: '2026-11-05 10:00' })]),
      container('waiting', [
        note({
          id: '等待件',
          timeBand: null,
          timeBands: [],
          content: '等谁：某单位；等什么：回函；什么时候回：11/4 08:30；到期没回：改走分管领导',
          dueDate: '2026-11-04',
          dueLocal: '2026-11-04 08:30',
          dueAt: '2026-11-04T00:30:00.000Z',
          dueTime: '08:30',
        }),
      ]),
    ],
    context({ nowTime: '09:30' }),
  );
  assert.equal(guide.card.id, '动作');
  assert.equal(guide.reminders.length, 1);
  assert.equal(guide.reminders[0].id, '等待件');
  assert.equal(guide.reminders[0].replyDue, '2026-11-04 08:30');
});

test('焦点：等待清单还没到期就不提醒', () => {
  const guide = focusGuideOf(
    [
      container('waiting', [
        note({
          id: '等待件',
          timeBand: null,
          timeBands: [],
          content: '等谁：某单位；等什么：回函；什么时候回：11/9 08:30；到期没回：改走分管领导',
          dueDate: '2026-11-09',
          dueLocal: '2026-11-09 08:30',
          dueAt: '2026-11-09T00:30:00.000Z',
          dueTime: '08:30',
        }),
      ]),
    ],
    context({ nowTime: '09:30' }),
  );
  assert.deepEqual(guide.reminders, []);
  assert.equal(guide.card, null);
});

test('焦点：日清不占主卡，列在日清清单里；到了它的时段才进「接下来」', () => {
  const daily = note({
    id: '日清件',
    timeBand: '日清',
    timeBands: ['日清'],
    dueLocal: '2026-11-05 08:00',
    dueAt: '2026-11-05T00:00:00.000Z',
    dueTime: '08:00',
  });
  const guide = focusGuideOf([container('execution', [daily])], context({ nowTime: '09:30' }));
  assert.equal(guide.card, null);
  assert.equal(guide.daily.length, 1);
  assert.equal(guide.daily[0].state, '未还清');
  // 它的时段（08:00）已经到了 → 进「接下来」。
  assert.deepEqual(
    guide.next.map((item) => item.id),
    ['日清件'],
  );
  assert.equal(guide.next[0].kind, 'daily');
});

test('焦点：没有够格的动作时主卡为空，不是崩', () => {
  const guide = focusGuideOf([container('inbox', [note({ timeBand: null, timeBands: [] })])], context());
  assert.equal(guide.card, null);
  assert.deepEqual(guide.next, []);
  assert.equal(guide.deepQuotaUsed, false);
});

test('焦点：坏输入不抛', () => {
  const guide = focusGuideOf(undefined, undefined);
  assert.equal(guide.card, null);
  assert.deepEqual(guide.next, []);
  assert.deepEqual(guide.reminders, []);
  assert.deepEqual(guide.daily, []);
});
