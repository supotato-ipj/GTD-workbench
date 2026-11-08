/**
 * 卡脚的项目指针（纯逻辑）。
 *
 * 滴答里项目与动作之间**没有关联字段**，所以「这一件属于哪条项目线」靠既有口径推：
 * markdown 记录编号（①–⑨）与项目箱箱签标题的编号对上。
 *
 * 断言的是这个口径本身：对得上就是那个项目，对不上就是**没有**——缺就是缺，不编。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { projectNameOf, projectPointerOf } from '../lib/project.js';

/**
 * 造一个容器组（项目箱 + 别的箱）。
 * @param {object[]} notes - 项目箱里的箱签。
 * @returns {object[]} 容器组。
 */
function containersWith(notes) {
  return [
    { key: 'inbox', notes: [] },
    { key: 'project', notes },
    { key: 'execution', notes: [] },
  ];
}

test('项目指针：动作的记录编号对上项目箱箱签的编号，就是它的项目', () => {
  const containers = containersWith([
    { id: 'p1', title: '⑥ 岗位职责分工梳理' },
    { id: 'p2', title: '⑨ 事项留痕清单（只给自己看）' },
  ]);
  assert.deepEqual(projectPointerOf('⑥', containers), {
    id: 'p1',
    name: '岗位职责分工梳理',
    record: '⑥',
  });
  assert.deepEqual(projectPointerOf('⑨', containers), {
    id: 'p2',
    name: '事项留痕清单（只给自己看）',
    record: '⑨',
  });
});

test('项目指针：推不出就是 null——缺就是缺，不编', () => {
  const containers = containersWith([{ id: 'p1', title: '⑥ 岗位职责分工梳理' }]);
  // 动作身上没有记录编号。
  assert.equal(projectPointerOf(null, containers), null);
  assert.equal(projectPointerOf('', containers), null);
  // 编号对不上任何一张箱签。
  assert.equal(projectPointerOf('⑦', containers), null);
  // 快照里没有项目箱。
  assert.equal(projectPointerOf('⑥', []), null);
  assert.equal(projectPointerOf('⑥', [{ key: 'execution', notes: [] }]), null);
});

test('项目指针：箱签标题里没有编号就对不上——项目名原样留着', () => {
  const containers = containersWith([{ id: 'p3', title: '某项目（没有编号）' }]);
  assert.equal(projectPointerOf('⑥', containers), null);
  assert.equal(projectNameOf('某项目（没有编号）'), '某项目（没有编号）');
});

test('项目指针：项目名去掉开头的编号字符', () => {
  assert.equal(projectNameOf('⑥ 岗位职责分工梳理'), '岗位职责分工梳理');
  assert.equal(projectNameOf('⑨ 事项留痕清单（只给自己看）'), '事项留痕清单（只给自己看）');
  // 没有编号就是标题本身。
  assert.equal(projectNameOf('没有编号的项目'), '没有编号的项目');
  // 坏输入不抛。
  assert.equal(projectNameOf(null), '');
});
