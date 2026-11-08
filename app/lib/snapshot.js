/**
 * 滴答原始任务 → 工作台快照。
 *
 * 快照是 Host 半边与 Client 半边之间唯一的契约（两个进程，只能靠 JSON 过界）：
 * 每个容器一组，每条动作带齐标题、截止时间（已换算到本地时区）、时间档标签、优先级、状态、正文。
 * 这一层只做**翻译**，不做判断：完成情况等于滴答勾选（ADR-0006），工作台不写回（ADR-0006）。
 * 唯一的例外是日历箱的口径（ADR-0007「外部约定时刻」），它决定什么算日历条目——
 * 那不是判断完成情况，是判断**这条东西属于哪个箱子**。
 *
 * v2 起（ADR-0009）快照多两块：
 * - `focus`：焦点引导器的主位行动卡与「接下来」队列（推导在 app/lib/focus-guide.js）；
 * - `today`：今日日清状态与剩余可排时间（容量计算在 app/lib/capacity.js）。
 *
 * 注意别把两个「焦点」混成一个：v1 的**本周主攻**数组在本快照里叫 `mainPush`，
 * v2 的**焦点**是 `focus` 对象（`focus.card` / `focus.next`），两者语义不同、名字不重叠。
 */

import { BOX_RULES, DEFAULT_BOX_RULE, filterContainerNotes, nextStepOf } from './board.js';
import { capacityFor } from './capacity.js';
import { focusOf } from './focus.js';
import {
  DEFAULT_TWO_MINUTE_POLICY,
  eligibilityOf,
  focusGuideOf,
} from './focus-guide.js';
import { matchRecordNumber } from './markdown.js';
import { requirementOf } from './requirement.js';
import { withViolations } from './rules.js';
import { localStampOf, sunkOf } from './sunk.js';
import {
  DEFAULT_EXPANDED_SEGMENTS,
  SEGMENTS,
  isOverdue,
  localDateText,
  segmentOf,
} from './timeline.js';

/** 时间档三档（GLOSSARY「时间档」）：深度／事务／日清。2026-11-04 起是标签，不占清单。 */
export const TIME_BANDS = ['深度', '事务', '日清'];

/** 滴答优先级取值 → 工作台显示的档。 */
export const PRIORITY_LABELS = { 0: '无', 1: '低', 3: '中', 5: '高' };

/** 滴答状态取值 → 工作台显示的档。 */
export const STATUS_LABELS = { '-1': '已放弃', 0: '未完成', 2: '已完成' };

/** 未完成动作在画布上画成便贴；已完成的归「已沉底」（本票只画未完成）。 */
export const OPEN_STATUS = 0;

/**
 * 拆出任务身上的时间档标签。
 *
 * 滴答的 tags 里一个标签可能是逗号串（例如 `"q2-重要,日清"`），所以先按逗号拆平再比对。
 * @param {unknown} tags - 滴答任务上的 tags 数组。
 * @returns {string[]} 命中的时间档（可能多个——「恰好一个」是容器规则，不在这里判）。
 */
export function bandsOf(tags) {
  const flat = (Array.isArray(tags) ? tags : [])
    .filter((tag) => typeof tag === 'string')
    .flatMap((tag) => tag.split(','))
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return TIME_BANDS.filter((band) => flat.includes(band));
}

/**
 * 把一个时间点换算到指定时区，输出 "YYYY-MM-DD HH:mm"。
 *
 * 用 `Intl.DateTimeFormat` 而不是手算偏移：滴答的 dueDate 是 UTC 带 +0000，
 * 任务自带 `timeZone: "Asia/Shanghai"`，本机时区不是 Asia/Shanghai 时必须显式换算（ADR-0008）。
 * @param {string | null | undefined} iso - 滴答的 dueDate 字符串。
 * @param {string} timeZone - 目标时区（IANA 名）。
 * @returns {{ date: string, time: string, text: string } | null} 换算结果；日期非法时为 null。
 */
export function localDueOf(iso, timeZone) {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const date = `${pick('year')}-${pick('month')}-${pick('day')}`;
  const time = `${pick('hour')}:${pick('minute')}`;
  return { date, time, text: `${date} ${time}` };
}

/**
 * 把一个时间点归一成 ISO 字符串。
 * @param {unknown} value - 滴答的时间字段。
 * @returns {string | null} ISO 字符串；没有或非法时为 null。
 */
function isoOf(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/**
 * 把一条滴答原始任务翻成一条便贴数据。
 * @param {object} task - 滴答原始任务。
 * @param {string} timeZone - 目标时区。
 * @returns {object} 便贴数据。
 */
export function noteOf(task, timeZone) {
  const bands = bandsOf(task.tags);
  const due = localDueOf(task.dueDate, timeZone);
  const start = localDueOf(task.startDate, timeZone);
  // 预计耗时来自滴答的专注估算字段，**不在顶层**（在 `focusSummaries` 里）。
  const summaries = task.focusSummaries !== null && typeof task.focusSummaries === 'object'
    ? task.focusSummaries
    : {};
  return {
    id: String(task.id ?? ''),
    title: typeof task.title === 'string' ? task.title : '',
    content: typeof task.content === 'string' ? task.content : '',
    dueAt: due === null ? null : isoOf(task.dueDate),
    dueLocal: due === null ? null : due.text,
    dueDate: due === null ? null : due.date,
    dueTime: due === null ? null : due.time,
    dueAllDay: task.isAllDay === true,
    startAt: isoOf(task.startDate),
    startLocal: start === null ? null : start.text,
    timeBand: bands.length === 1 ? bands[0] : null,
    timeBands: bands,
    priority: typeof task.priority === 'number' ? task.priority : 0,
    priorityLabel: PRIORITY_LABELS[String(task.priority)] ?? '无',
    status: typeof task.status === 'number' ? task.status : 0,
    statusLabel: STATUS_LABELS[String(task.status)] ?? '未完成',
    tags: Array.isArray(task.tags) ? task.tags.filter((tag) => typeof tag === 'string') : [],
    nextStep: nextStepOf(task.content),
    // 项目不带子任务（ADR-0004）：这里只记事实，判不判由 app/lib/rules.js 决定。
    hasChildren: Array.isArray(task.childIds) ? task.childIds.length > 0 : false,
    // 专注估算：番茄数与专注时长（**时长单位是秒**，见 app/lib/capacity.js 的 estimateOf）。
    estimatePomo: typeof summaries.estimatedPomo === 'number' ? summaries.estimatedPomo : null,
    estimateDuration: typeof summaries.estimatedDuration === 'number' ? summaries.estimatedDuration : null,
  };
}

/**
 * 排序：先按到期时间从早到晚，没到期日的排在最后；同一时刻按 id 排，保证两次请求顺序稳定。
 * @param {object[]} notes - 便贴数据。
 * @returns {object[]} 排好序的新数组。
 */
export function sortNotes(notes) {
  return [...notes].sort((left, right) => {
    const leftAt = left.dueAt ?? '9999-12-31T23:59:59.999Z';
    const rightAt = right.dueAt ?? '9999-12-31T23:59:59.999Z';
    if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

/**
 * 给一条便贴补上它落在时间轴的哪一段。
 *
 * 分段由 Host 算、随快照过界：Client 半边不重算「今天」是哪天——它只看快照里的 `segment`。
 * 这样画布上的四段与快照的 `timeline.today` 永远是同一个基准，不会因为浏览器时钟漂移而错位。
 * @param {object} note - 便贴数据。
 * @param {string} today - 本地时间的今天，`YYYY-MM-DD`。
 * @returns {object} 补了 segment 与 overdue 的新便贴。
 */
export function withSegment(note, today) {
  return {
    ...note,
    segment: segmentOf(note.dueDate, today),
    overdue: isOverdue(note.dueDate, today),
  };
}

/**
 * 给一条便贴补上它对应的 markdown 记录编号。
 *
 * 只给指针，不把整页塞进每条便贴里：一页记录可能对上好几条动作，
 * 快照顶层放一份 `records`，便贴上只放编号。
 * @param {object} note - 便贴数据。
 * @param {object[]} records - 全部记录。
 * @returns {object} 补了 record 的新便贴。
 */
export function withRecord(note, records) {
  return { ...note, record: matchRecordNumber(note.title, records) };
}

/**
 * 给一条便贴补上它的完成要求。
 *
 * 完成要求有两条来源、主次分明：编号匹配到的 markdown 记录页的「验收标准」优先，
 * 记录页那一页没有验收标准或没匹配上时，回退正文里的 `完成要求：` 前缀；
 * 两条都没有就是空（空说明判定没做完，不编）。
 * **单一口径**：解析只出自 `app/lib/requirement.js` 的 `requirementOf`，便贴与行动卡共用它。
 * @param {object} note - 便贴数据（已带 `record` 指针）。
 * @param {object[]} records - 全部记录。
 * @returns {object} 补了 requirement 的新便贴。
 */
export function withRequirement(note, records) {
  const { text, source } = requirementOf(note, records);
  return { ...note, requirement: { text, source } };
}

/**
 * 组装今日日清清单。
 *
 * 还开着的日清项来自快照本身；今天已经还清的日清项来自已完成的那一批
 * （完成情况只认滴答勾选，ADR-0006）。两段合成一份，前端数「几笔未还」用。
 * @param {object[]} dailyOpen - 还开着的日清项（来自焦点推导）。
 * @param {object[]} completedTasks - 已完成的原始任务。
 * @param {string} timeZone - 目标时区。
 * @param {string} today - 本地时间的今天。
 * @returns {object[]} 日清清单。
 */
function dailyOf({ dailyOpen, completedTasks, timeZone, today }) {
  const rows = Array.isArray(dailyOpen) ? [...dailyOpen] : [];
  for (const task of Array.isArray(completedTasks) ? completedTasks : []) {
    if (task === null || typeof task !== 'object') continue;
    if (task.status !== 2) continue;
    if (!bandsOf(task.tags).includes('日清')) continue;
    const stamp = localStampOf(task.completedTime, timeZone);
    if (stamp === null || stamp.date !== today) continue;
    const due = localDueOf(task.dueDate, timeZone);
    rows.push({
      id: String(task.id ?? ''),
      title: typeof task.title === 'string' ? task.title : '',
      timeBand: '日清',
      dueLocal: due === null ? null : due.text,
      dueDate: due === null ? null : due.date,
      dueTime: due === null ? null : due.time,
      overdue: false,
      state: '已还清',
    });
  }
  return rows.sort((left, right) => {
    const leftDue = left.dueLocal ?? '9999-12-31 23:59';
    const rightDue = right.dueLocal ?? '9999-12-31 23:59';
    if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

/**
 * 组装一份快照。
 * @param {object} options - 组装选项。
 * @param {object[]} options.containers - 参与本次取数的纸箱（各自一组）。
 * @param {Map<string, object[]>} options.tasksByProject - 按 projectId 归好的原始任务。
 * @param {string} options.timeZone - 目标时区。
 * @param {string} options.generatedAt - 生成时刻（ISO）。
 * @param {string} [options.today] - 本地时间的今天；不给就按生成时刻与时区算。
 * @param {object[]} [options.records] - markdown 侧记录（Host 从仓库读的）。
 * @param {object[]} [options.completedTasks] - 已完成的原始任务（已沉底区用）。
 * @param {object} [options.capacityConfig] - 容量配置；不给就用通用默认值（ADR-0011）。
 * @param {object} [options.twoMinutePolicy] - 两分钟规则的参数：`enabled`（开着没有）、
 *   `maxMinutes`（阈值，分钟）、`reviewWindow`（日回顾窗口 `{ start, end }`）、
 *   可选 `allowed: false`（否决位：显式不许）。
 *   不给就用通用默认值（app/lib/focus-guide.js 的 DEFAULT_TWO_MINUTE_POLICY）。
 * @returns {object} 快照。
 */
export function buildSnapshot({
  containers,
  tasksByProject,
  timeZone,
  generatedAt,
  today,
  records = [],
  completedTasks = [],
  capacityConfig,
  twoMinutePolicy = DEFAULT_TWO_MINUTE_POLICY,
}) {
  const todayText = typeof today === 'string' && today.length > 0 ? today : localDateText(new Date(generatedAt), timeZone);
  const recordList = Array.isArray(records) ? records : [];
  const groups = containers.map((container) => {
    const notes = sortNotes(
      (tasksByProject.get(container.projectId) ?? []).map((task) =>
        withRequirement(
          withRecord(
            withSegment(withViolations(noteOf(task, timeZone), container.key), todayText),
            recordList,
          ),
          recordList,
        ),
      ),
    );
    const rule = BOX_RULES[container.key] ?? DEFAULT_BOX_RULE;
    return {
      key: container.key,
      name: container.name,
      listName: container.listName,
      projectId: container.projectId,
      // 呈现规则随快照过界：Client 半边不重算「这个箱子画便贴还是箱签、默不默认折叠」，
      // 只照 kind 与 collapsedByDefault 画（规则的真身在 app/lib/board.js）。
      kind: rule.kind,
      collapsedByDefault: rule.collapsedByDefault,
      notes: filterContainerNotes(container.key, notes, generatedAt),
    };
  });

  // 容量与焦点：都在 Host 侧算好随快照过界，Client 半边只画不算（ADR-0010）。
  const localNow = localDueOf(generatedAt, timeZone);
  const capacity = capacityFor(
    { date: todayText, time: localNow === null ? '00:00' : localNow.time },
    capacityConfig,
  );
  const guideContext = {
    today: todayText,
    nowTime: localNow === null ? '00:00' : localNow.time,
    capacity,
    // markdown 侧记录：主卡的完成要求与便贴上的那一份出自同一口径（app/lib/requirement.js）。
    records: recordList,
    // 两分钟规则的参数（启用、阈值、日回顾窗口）。
    // **不在这儿归一化**：归一化会丢掉 `allowed: false` 这个否决位。
    twoMinute: twoMinutePolicy,
  };
  const guide = focusGuideOf(groups, guideContext);
  const pushed = new Set(guide.pushed);
  // 资格判断随便贴过界：每条便贴都带 eligible 与 ineligibleReason，
  // Client 半边只照着显示「为什么它没进焦点」，不重算资格。
  // 用的上下文与焦点推导是**同一份**（含两分钟规则此刻的状态）——
  // 两处口径不一致会出现「主卡是两分钟卡、画布上却说它没资格」。
  const eligibilityContext = { ...guideContext, twoMinute: guide.twoMinute };
  const tagged = groups.map((group) => ({
    ...group,
    notes: group.notes.map((note) => {
      const { eligible, reason } = eligibilityOf(note, group.key, eligibilityContext);
      // 深度名额用完的动作被推到明天——它今天没有资格，但原因要说得清。
      if (pushed.has(note.id)) return { ...note, eligible: false, ineligibleReason: '深度配额已用' };
      return { ...note, eligible, ineligibleReason: eligible ? null : reason };
    }),
  }));

  return {
    generatedAt,
    timeZone,
    // 时间轴的骨架随快照过界：哪一天算「今天」、四段叫什么、默认铺哪几段。
    timeline: {
      today: todayText,
      segments: [...SEGMENTS],
      defaultExpanded: [...DEFAULT_EXPANDED_SEGMENTS],
    },
    // markdown 侧的「为什么／验收标准／卡点」整页放一份，便贴上只放编号（见 withRecord）。
    records: recordList,
    // 本周主攻由滴答的 `深度` 标签推导，不读手写名单（ADR-0007，见 app/lib/focus.js）。
    // 字段名是 `mainPush`：v2 的焦点是下面的 `focus`，两个「焦点」语义不同、名字不重叠。
    mainPush: focusOf(tagged),
    // v2 焦点引导器（ADR-0009）：至多一条主位行动卡 + 0–4 条「接下来」+ 等待到期没回的提醒位。
    focus: {
      card: guide.card,
      next: guide.next,
      reminders: guide.reminders,
    },
    // 顶部常驻：今日日清状态与剩余可排时间。
    today: {
      daily: dailyOf({
        dailyOpen: guide.daily,
        completedTasks,
        timeZone,
        today: todayText,
      }),
      remainingMinutes: capacity.remainingMinutes,
      deepQuotaUsed: guide.deepQuotaUsed,
    },
    // 容量参数来源标记：`asOf` 为 null = 未定于某日（用的是通用默认值，ADR-0011）。
    capacity: {
      asOf: capacity.asOf,
      deepQuota: capacity.deepQuota,
      pomodoroMinutes: capacity.pomodoroMinutes,
      // 三个输入的当前值与它们的差，前端与人都能自己算一遍（ADR-0011：只存输入，推导实时算）。
      windowMinutes: capacity.windowMinutes,
      dailyMinutes: capacity.dailyMinutes,
      // 日清成本分两拨：落在可用窗口内的（从可排时间里扣）与落在窗口外的（不占可排时间）。
      // 「窗口外那笔不占可排时间」这件事要能过界，前端与人才看得见。
      dailyMinutesInWindow: capacity.dailyMinutesInWindow,
      dailyMinutesOutsideWindow: capacity.dailyMinutesOutsideWindow,
      interruptionMinutes: capacity.interruptionMinutes,
      schedulableMinutes: capacity.schedulableMinutes,
      remainingMinutes: capacity.remainingMinutes,
      currentWindow: capacity.currentWindow,
    },
    // 已沉底：只摆最近七天已勾选完成的条目，按天堆叠（见 app/lib/sunk.js）。
    sunk: sunkOf({
      tasks: completedTasks,
      containers,
      timeZone,
      today: todayText,
    }),
    containers: tagged,
  };
}
