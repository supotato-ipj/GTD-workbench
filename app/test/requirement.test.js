/**
 * 完成要求的解析（纯函数单元测试）。
 *
 * 完成要求有两条来源，**主次分明**：
 * 1. 与动作编号匹配的 markdown 记录页里的「验收标准」（优先）；
 * 2. 动作正文里的结构化前缀 `完成要求：`（回退）。
 *
 * 这两条**不是双写**：记录页承载的是项目级的验收标准，正文前缀承载的是这一条动作的完成要求，
 * 层级不同。所以解析结果**只取其一**，并说清是从哪一条来的。
 *
 * 断言的是纯函数的输出（外部可观察），不碰内部结构。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REQUIREMENT_SOURCES, requirementOf } from '../lib/requirement.js';

/** 两条记录：一页有验收标准，一页没有。 */
const RECORDS = [
  {
    number: '⑥',
    title: '岗位职责分工梳理',
    acceptance: '每个版块的职责数量与口径对得上：一条职责只在一处出现。',
  },
  {
    number: '①',
    title: '单据分桶归档',
    acceptance: null,
  },
];

test('完成要求：编号匹配到记录页时，取那一页的验收标准', () => {
  const result = requirementOf(
    { record: '⑥', title: '⑥ 汇总：各岗位意见', content: '10:00 封箱后一次做完。' },
    RECORDS,
  );
  assert.equal(result.text, '每个版块的职责数量与口径对得上：一条职责只在一处出现。');
  assert.equal(result.source, '记录页');
});

test('完成要求：记录页优先——两条都有时只取记录页那一侧，不拼在一起', () => {
  const result = requirementOf(
    {
      record: '⑥',
      title: '⑥ 汇总：各岗位意见',
      content: '完成要求：这一条动作自己的完成要求',
    },
    RECORDS,
  );
  assert.equal(result.source, '记录页');
  assert.equal(result.text, '每个版块的职责数量与口径对得上：一条职责只在一处出现。');
  // 不是两边的拼接。
  assert.doesNotMatch(result.text, /这一条动作自己的完成要求/);
});

test('完成要求：编号匹配到了、但那一页没有验收标准，回退正文前缀', () => {
  const result = requirementOf(
    {
      record: '①',
      title: '① 单据分桶归档：核对一遍',
      content: '完成要求：逐张对齐分桶规则',
    },
    RECORDS,
  );
  assert.equal(result.text, '逐张对齐分桶规则');
  assert.equal(result.source, '正文前缀');
});

test('完成要求：编号没匹配上，回退正文前缀', () => {
  const result = requirementOf(
    {
      record: null,
      title: '没有编号的一条动作',
      content: '完成要求：把当天记录归到一处并标好索引',
    },
    RECORDS,
  );
  assert.equal(result.text, '把当天记录归到一处并标好索引');
  assert.equal(result.source, '正文前缀');
});

test('完成要求：两条都没有时是空的——空说明判定没做完，不编也不拿标题充数', () => {
  const result = requirementOf(
    { record: null, title: '没有编号、也没写完成要求', content: '随手记一句。' },
    RECORDS,
  );
  assert.equal(result.text, null);
  assert.equal(result.source, null);
});

test('完成要求：正文前缀认全角冒号与半角冒号', () => {
  const full = requirementOf(
    { record: null, title: '甲', content: '完成要求：全角冒号写的要求' },
    RECORDS,
  );
  const half = requirementOf(
    { record: null, title: '甲', content: '完成要求: 半角冒号写的要求' },
    RECORDS,
  );
  assert.equal(full.text, '全角冒号写的要求');
  assert.equal(half.text, '半角冒号写的要求');
  assert.equal(full.source, '正文前缀');
  assert.equal(half.source, '正文前缀');
});

test('完成要求：前缀后面没内容时不算完成要求', () => {
  const result = requirementOf(
    { record: null, title: '甲', content: '完成要求：' },
    RECORDS,
  );
  assert.equal(result.text, null);
  assert.equal(result.source, null);
});

test('完成要求：来源标记的取值只有三种', () => {
  const sources = [
    requirementOf({ record: '⑥', title: '⑥ 甲', content: '' }, RECORDS).source,
    requirementOf({ record: '①', title: '① 甲', content: '完成要求：乙' }, RECORDS).source,
    requirementOf({ record: null, title: '丙', content: '' }, RECORDS).source,
  ];
  assert.deepEqual(sources.sort(), ['记录页', '正文前缀', null].sort());
  assert.equal(REQUIREMENT_SOURCES.RECORD, '记录页');
  assert.equal(REQUIREMENT_SOURCES.PREFIX, '正文前缀');
});

test('完成要求：便贴上没有记录编号时，函数自己按标题对一次记录页', () => {
  // 便贴上的 `record` 是 matchRecordNumber 的结果；没有这个指针时用同一条匹配口径自己找一次。
  const result = requirementOf(
    { title: '⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）', content: '' },
    RECORDS,
  );
  assert.equal(result.source, '记录页');
  assert.equal(result.text, '每个版块的职责数量与口径对得上：一条职责只在一处出现。');
});

test('完成要求：坏输入不抛，一律按「没有完成要求」处理', () => {
  for (const bad of [null, undefined, {}, '不是便贴', 42]) {
    const result = requirementOf(bad, RECORDS);
    assert.deepEqual(result, { text: null, source: null });
  }
  const noRecords = requirementOf({ record: '⑥', title: '甲', content: '完成要求：乙' }, null);
  assert.deepEqual(noRecords, { text: '乙', source: '正文前缀' });
});
