/**
 * 滴答原始任务 → 工作台快照。
 *
 * 快照是 Host 半边与 Client 半边之间唯一的契约（两个进程，只能靠 JSON 过界）：
 * 每个容器一组，每条动作带齐标题、截止时间（已换算到本地时区）、时间档标签、优先级、状态、正文。
 * 这一层只做**翻译**，不做判断：完成情况等于滴答勾选（ADR-0006），工作台不写回（ADR-0006）。
 * 唯一的例外是日历箱的口径（ADR-0007「外部约定时刻」），它决定什么算日历条目——
 * 那不是判断完成情况，是判断**这条东西属于哪个箱子**。
 */

import { BOX_RULES, DEFAULT_BOX_RULE, filterContainerNotes, nextStepOf } from './board.js';
import { focusOf } from './focus.js';
import { matchRecordNumber } from './markdown.js';
import { withViolations } from './rules.js';
import { sunkOf } from './sunk.js';
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
 * 组装一份快照。
 * @param {object} options - 组装选项。
 * @param {object[]} options.containers - 参与本次取数的纸箱（各自一组）。
 * @param {Map<string, object[]>} options.tasksByProject - 按 projectId 归好的原始任务。
 * @param {string} options.timeZone - 目标时区。
 * @param {string} options.generatedAt - 生成时刻（ISO）。
 * @param {string} [options.today] - 本地时间的今天；不给就按生成时刻与时区算。
 * @param {object[]} [options.records] - markdown 侧记录（Host 从仓库读的）。
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
}) {
  const todayText = typeof today === 'string' && today.length > 0 ? today : localDateText(new Date(generatedAt), timeZone);
  const recordList = Array.isArray(records) ? records : [];
  const groups = containers.map((container) => {
    const notes = sortNotes(
      (tasksByProject.get(container.projectId) ?? []).map((task) =>
        withRecord(
          withSegment(withViolations(noteOf(task, timeZone), container.key), todayText),
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
    focus: focusOf(groups),
    // 已沉底：只摆最近七天已勾选完成的条目，按天堆叠（见 app/lib/sunk.js）。
    sunk: sunkOf({
      tasks: completedTasks,
      containers,
      timeZone,
      today: todayText,
    }),
    containers: groups,
  };
}
