/**
 * markdown 记录的解析与匹配（纯逻辑）。
 *
 * 这些函数决定抽屉里那三段字从哪来、一条动作对到哪一页。
 * 断言的是**结果**：解析出什么、对到谁，不碰 DOM、不碰文件。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RECORD_NUMBERS,
  firstNumberOf,
  keywordsOf,
  matchRecordNumber,
  numberOf,
  parseRecord,
  parseSections,
} from '../lib/markdown.js';

/** 一份带三段的样本（形状照 `records/` 里那些虚构样本页）。 */
const SAMPLE = `# ① 单据分桶归档

Status: ready-for-human

## 现状

单据**尚未开始归档**。它们分散在三个月里，谁也没动过。

第二段不该被取到。

## 卡在

只有自己能干（没有别人可以代劳）。缺的是时间，不是材料。

## 备注

- 目标不是"一次报完"，是"在期限前把 8 月那批清掉"。
`;

test('markdown：编号字符与文件序号一一对应', () => {
  assert.deepEqual(RECORD_NUMBERS, ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']);
  assert.equal(numberOf('01'), '①');
  assert.equal(numberOf('09'), '⑨');
  assert.equal(numberOf('10'), null);
  assert.equal(numberOf('00'), null);
});

test('markdown：取标题里第一个编号，不被括注里的编号带偏', () => {
  // ⑨ 案件留痕清单（③④⑦ 各 5 行）说的是它涉及哪些案子，编号是 ⑨。
  assert.equal(firstNumberOf('⑨ 案件留痕清单（③④⑦ 各 5 行）'), '⑨');
  assert.equal(firstNumberOf('⑥ 汇总：各岗位意见'), '⑥');
  assert.equal(firstNumberOf('08:00 自学 20 分钟'), null);
  assert.equal(firstNumberOf(''), null);
});

test('markdown：拆分标题与小节', () => {
  const parsed = parseSections(SAMPLE);
  assert.equal(parsed.title, '① 单据分桶归档');
  assert.deepEqual(
    parsed.sections.map((section) => section.title),
    ['现状', '卡在', '备注'],
  );
  // 一级标题前的 Status 行不进任何小节。
  assert.equal(parsed.sections[0].body.startsWith('单据'), true);
});

test('markdown：解析出为什么／验收标准／卡点三段', () => {
  const record = parseRecord({ text: SAMPLE, number: '①', source: 'records/x/01.md' });
  assert.equal(record.number, '①');
  assert.equal(record.title, '① 单据分桶归档');
  assert.equal(record.source, 'records/x/01.md');
  // 为什么取「现状」的第一段，不是整节。
  assert.equal(record.why, '单据**尚未开始归档**。它们分散在三个月里，谁也没动过。');
  // 卡点取「卡在」那一节。
  assert.equal(record.blocker, '只有自己能干（没有别人可以代劳）。缺的是时间，不是材料。');
  // 这份样本没有验收小节，正文里也没提验收标准 → 就是 null，不编。
  assert.equal(record.acceptance, null);
});

test('markdown：有验收小节就取验收小节', () => {
  const text = `# ③ 子公司清算争议

## 验收清单（审稿时逐条勾）

1. 事实部分只写有证据的。
2. 结论部分不出现"建议集团介入"。
`;
  const record = parseRecord({ text, number: '③', source: 'records/x/03.md' });
  assert.equal(record.acceptance, '事实部分只写有证据的。');
});

test('markdown：没有验收小节时，捞提到「验收标准」的原句', () => {
  const text = `# ⑥ 部门职责分工梳理

## 现状

初版已完成。

## 范围决定（10/20）：第 4 条推到下一版

四条意见里只有第 4 条没有验收标准——"能合并的尽量合并"可以无限吃时间。
`;
  const record = parseRecord({ text, number: '⑥', source: 'records/x/06.md' });
  assert.match(record.acceptance, /没有验收标准/);
});

test('markdown：三段都缺时全是 null，不编造', () => {
  const record = parseRecord({ text: '# ⑤ 某事\n\n只有一句话。\n', number: '⑤', source: 'records/x/05.md' });
  assert.equal(record.why, null);
  assert.equal(record.acceptance, null);
  assert.equal(record.blocker, null);
});

test('markdown：标题关键词去掉编号、括注与标点', () => {
  assert.deepEqual(keywordsOf('① 出差报销（8 月 10 日 – 10 月 14 日）'), ['出差报销']);
  assert.deepEqual(keywordsOf('⑧ 自学（下班后）'), ['自学']);
});

test('markdown：按编号匹配——编号唯一，命中就是它', () => {
  const records = [
    { number: '①', title: '① 出差报销' },
    { number: '⑥', title: '⑥ 部门职责分工梳理' },
    { number: '⑨', title: '⑨ 案件留痕清单' },
  ];
  assert.equal(matchRecordNumber('⑨ 案件留痕清单（③④⑦ 各 5 行）', records), '⑨');
  assert.equal(matchRecordNumber('⑥ 汇总：各岗位意见（采纳/不采纳 + 理由）', records), '⑥');
  assert.equal(matchRecordNumber('⑥ 回收截止（11/4 10:00，之后不纳入）', records), '⑥');
});

test('markdown：标题里没编号时回退到关键词', () => {
  const records = [
    { number: '①', title: '① 出差报销（8 月 10 日 – 10 月 14 日）' },
    { number: '⑧', title: '⑧ 自学（下班后）' },
  ];
  // 滴答里这条叫「08:00 自学 20 分钟」，没有 ⑧，靠关键词「自学」对上。
  assert.equal(matchRecordNumber('08:00 自学 20 分钟', records), '⑧');
  // 一个关键词都压不中就诚实地返回 null。
  assert.equal(matchRecordNumber('同事甲让我帮忙查几个案子的发案单位', records), null);
});

test('markdown：没有记录时匹配返回 null，不抛', () => {
  assert.equal(matchRecordNumber('⑨ 案件留痕清单', []), null);
  assert.equal(matchRecordNumber('⑨ 案件留痕清单', undefined), null);
});
