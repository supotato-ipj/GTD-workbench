/**
 * 接缝 B（渲染边界，快照 → DOM）：**焦点视图**（工单 06「05 · 焦点只读上线」的 Client 侧）。
 *
 * 焦点视图是四层结构（照工单 04 的观感原型）：
 *   ① 顶部常驻：今日日清 + 今日剩余可排时间（+ 深度名额）；
 *   ② 一张行动卡（主位）：工作内容、完成时限、完成要求、预计耗时，外加一句容量提示；
 *   ③「接下来」窄条：只写标题与时限，点一条即换主卡；
 *   ④ 下钻层：点开是 v1 的六箱画布原样，带一个「回到焦点」。
 *
 * 断言只碰外部可观察行为：DOM 上出现什么、点了发生什么。
 * 快照是固定夹具（真的走一遍 Host 的路由生成），不依赖本机实时滴答数据。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TASKS_ROUTE_PATH, createTasksHandler } from '../lib/route.js';
import { mountClientPanel } from './helpers/client-harness.js';
import { withRoute } from './helpers/http-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..');
const clientPath = path.join(appRoot, 'client.js');
const rawTasks = JSON.parse(readFileSync(path.join(here, 'fixtures/board-tasks.json'), 'utf8'));

const TIME_ZONE = 'Asia/Shanghai';
const GENERATED_AT = '2026-11-05T00:00:00.000Z';

/**
 * 用固定夹具生成一份快照（走真的路由，字段与 Host 侧一致）。
 * @returns {Promise<object>} 快照。
 */
async function snapshotUnderTest() {
  const handler = createTasksHandler({
    connection: { requestRejection: () => undefined },
    runDida: async (args) => rawTasks.filter((task) => task.projectId === args.projectId),
    timeZone: TIME_ZONE,
    now: () => new Date(GENERATED_AT),
  });
  return withRoute(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TASKS_ROUTE_PATH}`);
    assert.equal(response.status, 200);
    return response.json();
  });
}

/**
 * 把快照里焦点契约的某一段换掉（其余原样）。
 * @param {object} snapshot - 原快照。
 * @param {object} patch - 要替换的片段。
 * @returns {object} 换过的快照。
 */
function withFocus(snapshot, patch) {
  return { ...snapshot, focus: { ...snapshot.focus, ...patch } };
}

test('焦点视图：顶部常驻同时摆着日清状态与剩余可排时间（还有深度名额）', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const daily = env.document.querySelector('[data-role="focus-stat"][data-stat="daily"]');
    const remaining = env.document.querySelector('[data-role="focus-stat"][data-stat="remaining"]');
    const quota = env.document.querySelector('[data-role="focus-stat"][data-stat="deep-quota"]');
    assert.ok(daily, '顶部没有日清状态');
    assert.ok(remaining, '顶部没有剩余可排时间');
    assert.ok(quota, '顶部没有深度名额');

    // 日清：几笔未还 / 共几笔。
    const dailyValue = daily.querySelector('[data-role="focus-stat-value"]');
    assert.equal(dailyValue.getAttribute('data-open'), '1');
    assert.equal(dailyValue.getAttribute('data-total'), '1');
    assert.match(daily.textContent, /未还/);
    // 剩余可排时间：照快照里的值。
    const remainingValue = remaining.querySelector('[data-role="focus-stat-value"]');
    assert.equal(remainingValue.getAttribute('data-minutes'), String(snapshot.today.remainingMinutes));
    assert.match(remaining.textContent, /分钟/);
    // 深度名额：用了没有 / 一共几个。
    const quotaValue = quota.querySelector('[data-role="focus-stat-value"]');
    assert.equal(quotaValue.getAttribute('data-used'), snapshot.today.deepQuotaUsed ? '1' : '0');
    assert.equal(quotaValue.getAttribute('data-total'), String(snapshot.capacity.deepQuota));
  } finally {
    await env.unmount();
  }
});

test('焦点视图：剩余时间为零或为负时不崩，也不显示负数', async () => {
  const snapshot = await snapshotUnderTest();
  for (const minutes of [0, -30]) {
    const env = await mountClientPanel({
      clientPath,
      props: {
        initialSnapshot: { ...snapshot, today: { ...snapshot.today, remainingMinutes: minutes } },
      },
    });
    try {
      const value = env.document.querySelector(
        '[data-role="focus-stat"][data-stat="remaining"] [data-role="focus-stat-value"]',
      );
      assert.ok(value, '剩余时间整个不见了');
      assert.equal(value.getAttribute('data-minutes'), '0', `剩余 ${minutes} 分钟时画出了 ${value.getAttribute('data-minutes')}`);
      assert.doesNotMatch(value.textContent, /-\d/, '界面上出现了负的剩余时间');
    } finally {
      await env.unmount();
    }
  }
});

test('焦点视图：主位恰好一张行动卡，四要素按约定出现', async () => {
  const snapshot = await snapshotUnderTest();
  const card = {
    ...snapshot.focus.card,
    requirement: { text: '逐条核对模板，标出不一致的三处并留痕', source: '正文前缀' },
    estimateMinutes: 45,
    capacityHint: { fits: true, remainingMinutes: 90, schedulableMinutes: 90 },
  };
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: withFocus(snapshot, { card }) },
  });
  try {
    const cards = [...env.document.querySelectorAll('[data-role="focus-card"]')];
    assert.equal(cards.length, 1, '主位不是恰好一张行动卡');
    const main = cards[0];
    // 工作内容：卡上写的就是那条动作的内容。
    assert.equal(main.querySelector('[data-role="focus-card-title"]').textContent, card.title);
    // 完成时限（逾期时另有一个标记，不混进时限本身）。
    const due = main.querySelector('[data-role="focus-card-due"]');
    assert.ok(due.textContent.startsWith(card.dueLocal), '完成时限与快照对不上');
    if (card.overdue === true) {
      assert.ok(main.querySelector('[data-role="focus-card-overdue"]'), '逾期的没有标出来');
    }
    // 完成要求。
    assert.match(main.querySelector('[data-role="focus-card-requirement"]').textContent, /逐条核对模板/);
    // 预计耗时。
    assert.match(main.querySelector('[data-role="focus-card-estimate"]').textContent, /45/);
    // 容量提示：装不装得下由 Host 说了算。
    const capacity = main.querySelector('[data-role="focus-card-capacity"]');
    assert.ok(capacity, '卡上没有容量提示');
    assert.equal(capacity.getAttribute('data-state'), 'fits');
  } finally {
    await env.unmount();
  }
});

test('焦点视图：字段缺失时那一行降级，整卡不消失', async () => {
  const snapshot = await snapshotUnderTest();
  const card = {
    ...snapshot.focus.card,
    requirement: { text: null, source: null },
    estimateMinutes: null,
    capacityHint: { fits: null, remainingMinutes: 90, schedulableMinutes: 90 },
  };
  const env = await mountClientPanel({
    clientPath,
    props: { initialSnapshot: withFocus(snapshot, { card }) },
  });
  try {
    const main = env.document.querySelector('[data-role="focus-card"]');
    assert.ok(main, '字段缺了就整张卡不见了');
    // 工作内容与完成时限还在。
    assert.equal(main.querySelector('[data-role="focus-card-title"]').textContent, card.title);
    assert.ok(main.querySelector('[data-role="focus-card-due"]'), '完成时限那一行没了');
    // 完成要求缺了 → 那一行不画，但卡还在。
    assert.equal(main.querySelector('[data-role="focus-card-requirement"]'), null);
    // 预计耗时未估算 → 说「未估算」，不能画成 0 分钟。
    assert.match(main.querySelector('[data-role="focus-card-estimate"]').textContent, /未估算/);
    assert.doesNotMatch(main.querySelector('[data-role="focus-card-estimate"]').textContent, /0 分钟/);
    // 装不装得下不知道 → 不装作知道。
    assert.equal(
      main.querySelector('[data-role="focus-card-capacity"]').getAttribute('data-state'),
      'unknown',
    );
  } finally {
    await env.unmount();
  }
});

test('焦点视图：「接下来」的条数与快照一致，窄条只写标题与时限', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const queue = env.document.querySelector('[data-role="focus-next"]');
    assert.ok(queue, '没有「接下来」队列');
    const items = [...queue.querySelectorAll('[data-role="focus-next-item"]')];
    assert.equal(items.length, snapshot.focus.next.length);
    assert.deepEqual(
      items.map((item) => item.getAttribute('data-note-ref')),
      snapshot.focus.next.map((item) => item.id),
    );
    assert.deepEqual(
      items.map((item) => item.querySelector('[data-role="focus-next-title"]').textContent),
      snapshot.focus.next.map((item) => item.title),
    );
    // 窄条只有标题与时限两样。
    for (const item of items) {
      assert.ok(item.querySelector('[data-role="focus-next-title"]'));
      assert.ok(item.querySelector('[data-role="focus-next-due"]'));
    }
  } finally {
    await env.unmount();
  }
});

test('焦点视图：点一条窄条，它就成了主卡（视图内状态，不写任何数据）', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const picked = snapshot.focus.next[1];
    const strip = env.document.querySelector(`[data-role="focus-next-item"][data-note-ref="${picked.id}"]`);
    assert.ok(strip, '找不到那条窄条');
    await env.click(strip);
    const cards = [...env.document.querySelectorAll('[data-role="focus-card"]')];
    assert.equal(cards.length, 1, '换主卡之后主位不止一张卡');
    assert.equal(cards[0].querySelector('[data-role="focus-card-title"]').textContent, picked.title);
    // 换主卡不写任何数据：快照没被动过。
    assert.equal(snapshot.focus.card.title, '追问运营部：归期 + 5 课题反馈');
  } finally {
    await env.unmount();
  }
});

test('焦点视图：下钻入口点开后是 v1 六箱画布原样，「回到焦点」能退回', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const entry = env.document.querySelector('[data-role="focus-drill-entry"]');
    assert.ok(entry, '没有下钻入口');
    assert.equal(env.document.querySelector('[data-role="focus-drill"]'), null, '下钻层默认就摊开了');

    await env.click(entry);
    const drill = env.document.querySelector('[data-role="focus-drill"]');
    assert.ok(drill, '点开下钻入口没有出现六箱全景');
    // 纸箱、便贴、箱签、已沉底、规则角标全在。
    assert.ok(drill.querySelectorAll('[data-role="box"]').length > 0, '下钻层里没有纸箱');
    assert.ok(drill.querySelectorAll('[data-role="note"]').length > 0, '下钻层里没有便贴');
    assert.ok(drill.querySelectorAll('[data-role="box-tag"]').length > 0, '下钻层里没有箱签');
    assert.ok(drill.querySelector('[data-role="sunk"]'), '下钻层里没有已沉底区');
    assert.ok(drill.querySelectorAll('[data-role="rule-badge"]').length > 0, '下钻层里没有规则角标');
    // 本周主攻带也在（改名叫 main-push，但它还是那条带子）。
    assert.ok(drill.querySelector('[data-role="main-push"]'), '下钻层里没有本周主攻带');

    const back = drill.querySelector('[data-role="focus-back"]');
    assert.ok(back, '下钻层里没有「回到焦点」');
    await env.click(back);
    assert.equal(env.document.querySelector('[data-role="focus-drill"]'), null, '点了「回到焦点」还留在下钻层');
    assert.ok(env.document.querySelector('[data-role="focus-card"]'), '退回之后焦点视图不见了');
  } finally {
    await env.unmount();
  }
});

test('焦点视图：抽屉里说清某条动作为什么没进焦点', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    await env.click(env.document.querySelector('[data-role="focus-drill-entry"]'));
    // 收集箱里未判定的捕获：没有资格进焦点，原因是 Host 给的 `ineligibleReason`。
    const inbox = snapshot.containers.find((container) => container.key === 'inbox');
    const target = inbox.notes.find((note) => note.eligible === false && note.ineligibleReason !== null);
    assert.ok(target, '夹具里没有没进焦点的条目');
    const note = env.document.querySelector(`[data-role="note"][data-note-id="${target.id}"]`);
    assert.ok(note, '下钻层里找不到那条便贴');
    await env.click(note);

    const drawer = env.document.querySelector('[data-role="drawer"]');
    assert.ok(drawer, '点便贴没有打开抽屉');
    const reason = drawer.querySelector('[data-role="drawer-ineligible"]');
    assert.ok(reason, '抽屉里没有「为什么没进焦点」那一块');
    assert.equal(reason.getAttribute('data-reason'), target.ineligibleReason);
    assert.equal(reason.querySelector('[data-role="drawer-ineligible-reason"]').textContent, target.ineligibleReason);
  } finally {
    await env.unmount();
  }
});

test('焦点视图：主卡弱化纸感——没有折角与纸纹；画布里的纸箱照旧有纸感', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const card = env.document.querySelector('[data-role="focus-card"]');
    assert.ok(card, '没有主卡');
    // 主卡没有折角，也没有任何纸纹装饰。
    assert.equal(card.querySelector('.gtd-focus-card__fold'), null, '主卡上还有折角');
    assert.doesNotMatch(card.getAttribute('style') ?? '', /repeating-linear-gradient/, '主卡上还有纸纹');
    // 纸色调留着。
    assert.match(card.getAttribute('style') ?? '', /background:\s*var\(--dsw-alias-bg-base\)/);

    // 下钻层里的 v1 纸箱：纸感原样保留。
    await env.click(env.document.querySelector('[data-role="focus-drill-entry"]'));
    const box = env.document.querySelector('[data-role="focus-drill"] [data-role="box"]');
    assert.ok(box, '下钻层里没有纸箱');
    assert.ok(box.querySelector('.gtd-box__fold'), '纸箱的折角没了');
  } finally {
    await env.unmount();
  }
});

test('焦点视图：点主卡上的工作内容，打开的是那条动作的抽屉', async () => {
  const snapshot = await snapshotUnderTest();
  const env = await mountClientPanel({ clientPath, props: { initialSnapshot: snapshot } });
  try {
    const open = env.document.querySelector('[data-role="focus-card-open"]');
    assert.ok(open, '主卡上的工作内容不是可点的');
    await env.click(open);
    const drawer = env.document.querySelector('[data-role="drawer"]');
    assert.ok(drawer, '点主卡没有打开抽屉');
    assert.equal(drawer.getAttribute('data-note-id'), snapshot.focus.card.id);
    assert.equal(drawer.querySelector('[data-role="drawer-title"]').textContent, snapshot.focus.card.title);
  } finally {
    await env.unmount();
  }
});

test('焦点视图：取数失败与未登录仍然明确说原因，不画空板', async () => {
  const { createFetchController, mountPanel } = await import('./helpers/client-interaction.js');
  const controller = createFetchController();
  const panel = await mountPanel({ clientPath, props: {}, fetchImpl: controller.fetchImpl });
  try {
    controller.respond({ status: 401, body: { error: { code: 'not-authenticated', message: '没登录' } } });
    await panel.flush();
    assert.equal(panel.container.querySelector('[data-role="panel"]').getAttribute('data-state'), 'not-authenticated');
    assert.ok(panel.container.querySelector('[data-role="login-prompt"]'), '未登录没有给登录提示');
    // 焦点视图是默认视图，但它不能把错误态吞掉。
    assert.equal(panel.container.querySelector('[data-role="focus-view"]'), null, '失败时还在画焦点视图');
  } finally {
    await panel.cleanup();
  }
});
