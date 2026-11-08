/**
 * Client 半边：左栏「任务梳理台」图标 + 主区面板。
 *
 * 形状是 `window.__ModuleLoader__.load({ id, factory(require) })`，id 必须等于包名。
 * 不引构建步骤：用 `React.createElement`（对齐官方模板），样式只用宿主主题令牌 `--dsw-alias-*`，
 * 不依赖 `dsh-client-ui-primitives`。
 *
 * **单文件**：这个文件就是全部 Client 半边——只有一个入口（下面这个 `load`），
 * 没有第二个 client 入口、没有构建步骤（不引打包器、不引 TypeScript、不写 JSX），
 * `require` 只用来取依赖包（宿主模块表里的 `react`），不用来引本地的 `lib/*.js`。
 * 三条约束各有一条测试守着（`test/client-single-file.test.js`），理由写在 `app/README.md`。
 *
 * 数据只从本机 HTTP 路由取（ADR-0008）——Client 半边不碰滴答，也不直接访问滴答。
 */

window.__ModuleLoader__.load({
  id: '@local/gtd-workbench',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** 左栏图标与主区面板共用同一个 id 字符串。 */
    const PANEL_ID = '@local/gtd-workbench';
    /** 界面文案的命名空间。 */
    const LOCALE_NAMESPACE = 'gtd-workbench';
    /** 取数路由（Host 半边开的本机路由）。 */
    const TASKS_URL = '/gtd-workbench/tasks';
    /** 写路由（同一个接缝的写方向：动作类型 + 目标 id + 参数）。 */
    const ACTIONS_URL = '/gtd-workbench/actions';

    /** 中文文案。与 `locale/zh.json` 保持一致（测试会核对两处不漂移）。 */
    const zh = {
      panel: '任务梳理台',
      title: '任务梳理台',
      refresh: '刷新',
      loading: '正在拉取滴答…',
      errorHeading: '取数失败',
      loginHeading: '滴答未登录',
      loginHint: '工作台读不到滴答数据。先在终端运行下面的命令登录滴答，再点刷新。',
      retry: '重试',
      sourceLabel: '滴答清单',
      countUnit: '条',
      emptyBox: '这个纸箱还没有动作',
      dueLabel: '截止',
      allDay: '全天',
      bandLabel: '时间档',
      priorityLabel: '优先级',
      statusLabel: '状态',
      unbanded: '未分档',
      nextStepLabel: '下一步',
      expandBox: '展开',
      collapseBox: '收起',
      segmentToday: '今天',
      segmentTomorrow: '明天',
      segmentThisWeek: '本周',
      segmentLater: '以后',
      collapseSegments: '收起其它段',
      closeDrawer: '关闭',
      fieldDue: '截止时间',
      fieldAllDay: '全天',
      fieldDueUtc: '截止时间（UTC）',
      fieldBand: '时间档',
      fieldPriority: '优先级',
      fieldStatus: '状态',
      fieldTags: '滴答标签',
      fieldId: '标识',
      recordHeading: '为什么这么定',
      recordWhy: '为什么',
      recordAcceptance: '验收标准',
      recordBlocker: '卡点',
      recordNone: '无对应记录',
      recordUnwritten: '未写明',
      recordSource: '来源',
      /* 本周主攻带（v1 的「本周主攻」，改名 mainPush 以免与 v2 的焦点混） */
      mainPushHeading: '本周主攻',
      mainPushEmpty: '本周没有带深度标签的动作',
      /* v2:focus 焦点视图：顶部常驻、行动卡、「接下来」、下钻层 */
      viewCanvasLabel: '六箱画布',
      viewFocusLabel: '焦点视图',
      focusViewPending: '焦点视图待接入',
      focusDailyLabel: '今日日清',
      focusDailyUndone: '未还',
      focusRemainingLabel: '剩余可排时间',
      focusMinutesUnit: '分钟',
      focusQuotaLabel: '深度名额',
      focusCapacityAsOf: '容量参数定于',
      focusCapacityAsOfUnset: '容量参数未定（未初始化，用的是通用默认值）',
      focusCapacityOutsideWindow: '有 {minutes} 分钟的日清落在可用窗口之外，不占可排时间',
      focusCardWorkLabel: '工作内容',
      focusCardDueLabel: '完成时限',
      focusCardRequirementLabel: '完成要求',
      /** 来源标记的写法：把来源标记说成「来自记录页」而不是光秃秃的「记录页」。 */
      focusRequirementFrom: '来自{source}',
      focusCardEstimateLabel: '预计耗时',
      focusEstimateUnset: '未估算',
      focusCardOverdue: '已逾期',
      focusCapacityFits: '装得下',
      focusCapacityNoFit: '装不下',
      focusCapacityUnknown: '装不装得下未知',
      focusCapacityNoteFits: '还剩 {minutes} 分钟，这件 {estimate} 分钟',
      focusCapacityNoteNoFits: '还剩 {minutes} 分钟，这件要 {estimate} 分钟',
      focusCapacityNoteUnknown: '还剩 {minutes} 分钟',
      focusNextHeading: '接下来',
      focusNextHint: '点一条即换主卡',
      focusNextEmpty: '接下来没有别的了',
      focusCardEmpty: '现在没有一件该做的事',
      /* v2:two-minute 两分钟卡（issue #11）：Host 说是两分钟卡，这里只画一句引导。 */
      focusCardTwoMinute: '两分钟卡：直接做掉、别判定',
      /* v2:project 卡脚（规格故事 22–24）：这一件在哪条项目线上。 */
      focusCardFootProjectLabel: '项目',
      focusCardFootProjectLink: '项目清单 →',
      /* v2:write 完成写口（issue #9）：完成 = 滴答勾选，单口径。 */
      focusCompleteLabel: '完成',
      focusCompletePending: '完成中…',
      focusCompleteRefreshFailed: '已完成，但刷新失败',
      /* v2:write 改期写口（issue #10）：改期 = 写新的完成时限，粒度到天。 */
      focusRescheduleLabel: '改期',
      focusReschedulePending: '改期中…',
      focusRescheduleDateLabel: '改到',
      focusRescheduleSubmit: '确认改期',
      focusRescheduleCancel: '取消',
      focusRescheduleNeedDate: '先选一个完成时限',
      focusRescheduleRefreshFailed: '已改期，但刷新失败',
      /* v2:write 跳过（issue #10）：零写入的纯视图状态。 */
      focusSkipLabel: '跳过',
      focusSkipNote: '零写入',
      focusSkipNotice: '已跳过：本次会话里它不再出现在焦点里，刷新页面会回来',
      focusDrillEntry: '打开六箱全景',
      focusDrillTitle: '六箱全景',
      focusBackLabel: '回到焦点',
      focusRemindersHeading: '到期没回',
      drawerIneligibleHeading: '为什么没进焦点',
      /** 抽屉里这一条动作自己的完成要求（与记录页那一段的项目级验收标准层级不同）。 */
      drawerRequirementLabel: '完成要求',
      drawerRequirementUnset: '未写完成要求',
      ruleHeading: '规则角标',
      ruleWaitingMissingWho: '等待清单缺「等谁」',
      ruleWaitingMissingWhat: '等待清单缺「等什么」',
      ruleWaitingMissingWhen: '等待清单缺「什么时候回」',
      ruleWaitingMissingFallback: '等待清单缺「到期没回做什么」',
      ruleTimeBandMissing: '执行清单这条没有时间档标签',
      ruleTimeBandMultiple: '执行清单这条带了多于一个时间档标签',
      ruleProjectHasChildren: '项目挂了子任务',
      ruleEmptyContent: '正文为空',
      sunkHeading: '已沉底',
      sunkWindowUnit: '天',
      sunkEmpty: '最近七天没有完成的事',
      boxCompletions: '完成',
      boxCompletionsHint: '最近七天这个纸箱里勾完的条数',
    };

    /** 英文文案。与 `locale/en.json` 保持一致。 */
    const en = {
      panel: 'Task workbench',
      title: 'Task workbench',
      refresh: 'Refresh',
      loading: 'Fetching from TickTick…',
      errorHeading: 'Could not load',
      loginHeading: 'TickTick is not signed in',
      loginHint: 'The workbench cannot read TickTick data. Run the command below in a terminal to sign in, then press Refresh.',
      retry: 'Retry',
      sourceLabel: 'TickTick list',
      countUnit: 'notes',
      emptyBox: 'No actions in this box',
      dueLabel: 'Due',
      allDay: 'all day',
      bandLabel: 'Time band',
      priorityLabel: 'Priority',
      statusLabel: 'Status',
      unbanded: 'unbanded',
      nextStepLabel: 'Next step',
      expandBox: 'Expand',
      collapseBox: 'Collapse',
      segmentToday: 'Today',
      segmentTomorrow: 'Tomorrow',
      segmentThisWeek: 'This week',
      segmentLater: 'Later',
      collapseSegments: 'Collapse the rest',
      closeDrawer: 'Close',
      fieldDue: 'Due',
      fieldAllDay: 'All day',
      fieldDueUtc: 'Due (UTC)',
      fieldBand: 'Time band',
      fieldPriority: 'Priority',
      fieldStatus: 'Status',
      fieldTags: 'TickTick tags',
      fieldId: 'Id',
      recordHeading: 'Why it was decided this way',
      recordWhy: 'Why',
      recordAcceptance: 'Acceptance',
      recordBlocker: 'Blocked by',
      recordNone: 'No matching record',
      recordUnwritten: 'Not stated',
      recordSource: 'Source',
      mainPushHeading: 'This week focus',
      mainPushEmpty: 'No deep-work action this week',
      /* v2:focus 焦点视图 */
      viewCanvasLabel: 'Six boxes',
      viewFocusLabel: 'Focus view',
      focusViewPending: 'Focus view not wired yet',
      focusDailyLabel: 'Daily today',
      focusDailyUndone: 'open',
      focusRemainingLabel: 'Remaining schedulable time',
      focusMinutesUnit: 'min',
      focusQuotaLabel: 'Deep-work slots',
      focusCapacityAsOf: 'Capacity parameters set on',
      focusCapacityAsOfUnset: 'Capacity parameters are not set (not initialised, generic defaults in use)',
      focusCapacityOutsideWindow: '{minutes} min of daily cost falls outside the available windows and does not take schedulable time',
      focusCardWorkLabel: 'What to do',
      focusCardDueLabel: 'Due',
      focusCardRequirementLabel: 'Done means',
      focusRequirementFrom: 'from {source}',
      focusCardEstimateLabel: 'Estimated time',
      focusEstimateUnset: 'Not estimated',
      focusCardOverdue: 'Overdue',
      focusCapacityFits: 'It fits',
      focusCapacityNoFit: 'It does not fit',
      focusCapacityUnknown: 'Unknown whether it fits',
      focusCapacityNoteFits: '{minutes} min left, this takes {estimate} min',
      focusCapacityNoteNoFits: '{minutes} min left, this needs {estimate} min',
      focusCapacityNoteUnknown: '{minutes} min left',
      focusNextHeading: 'Next up',
      focusNextHint: 'click one to make it the main card',
      focusNextEmpty: 'Nothing else queued',
      focusCardEmpty: 'Nothing to do right now',
      /* v2:two-minute 两分钟卡（issue #11）：Host 说是两分钟卡，这里只画一句引导。 */
      focusCardTwoMinute: 'Two-minute card: do it now, skip deciding',
      /* v2:project card foot (spec stories 22-24): which project line this belongs to. */
      focusCardFootProjectLabel: 'Project',
      focusCardFootProjectLink: 'Project list →',
      focusCompleteLabel: 'Done',
      focusCompletePending: 'Completing…',
      focusCompleteRefreshFailed: 'Completed, but refreshing failed',
      focusRescheduleLabel: 'Reschedule',
      focusReschedulePending: 'Rescheduling…',
      focusRescheduleDateLabel: 'Reschedule to',
      focusRescheduleSubmit: 'Confirm reschedule',
      focusRescheduleCancel: 'Cancel',
      focusRescheduleNeedDate: 'Pick a due date first',
      focusRescheduleRefreshFailed: 'Rescheduled, but refreshing failed',
      focusSkipLabel: 'Skip',
      focusSkipNote: 'no writes',
      focusSkipNotice: 'Skipped: it stays out of focus for this session and comes back after a reload',
      focusDrillEntry: 'Open the six-box panorama',
      focusDrillTitle: 'Six-box panorama',
      focusBackLabel: 'Back to focus',
      focusRemindersHeading: 'Overdue replies',
      drawerIneligibleHeading: 'Why it is not in focus',
      drawerRequirementLabel: 'Done means',
      drawerRequirementUnset: 'No completion requirement written',
      ruleHeading: 'Rule flags',
      ruleWaitingMissingWho: 'Waiting list is missing who',
      ruleWaitingMissingWhat: 'Waiting list is missing what',
      ruleWaitingMissingWhen: 'Waiting list is missing when to reply by',
      ruleWaitingMissingFallback: 'Waiting list is missing what to do if no reply',
      ruleTimeBandMissing: 'Execution action has no time band',
      ruleTimeBandMultiple: 'Execution action has more than one time band',
      ruleProjectHasChildren: 'Project has sub-tasks',
      ruleEmptyContent: 'Body is empty',
      sunkHeading: 'Sunk',
      sunkWindowUnit: 'days',
      sunkEmpty: 'Nothing completed in the last seven days',
      boxCompletions: 'Done',
      boxCompletionsHint: 'Completed in this box over the last seven days',
    };

    /**
     * 时间档三色。深度／事务／日清要一眼可辨，所以用三支分开的色相而不是同一支色的深浅。
     * 色条是图形（artwork），宿主政策允许自有颜色；其余版面一律走 `--dsw-alias-*` 令牌。
     */
    const BAND_COLORS = {
      深度: '#5b8def',
      事务: '#35b98a',
      日清: '#d99a3f',
    };

    /**
     * 取文案翻译函数：宿主给了 `t` 就用宿主的（跟随界面语言），没给就退回中文。
     * @param {object} props - 槽位 occupant 的 props。
     * @returns {(key: string) => string} 翻译函数。
     */
    function translatorOf(props) {
      const host = props && typeof props.t === 'function' ? props.t : null;
      return (key) => {
        if (host !== null) {
          const value = host(key);
          if (typeof value === 'string' && value.length > 0 && value !== key) return value;
        }
        return zh[key] !== undefined ? zh[key] : key;
      };
    }

    /* gtd:08 规则角标：只是一个标记，不是一份清单 */
    /** 违反项的键 → 文案键。顺序与 `app/lib/rules.js` 的 VIOLATION_KEYS 一致。 */
    const VIOLATION_LABEL_KEY = {
      'waiting-missing-who': 'ruleWaitingMissingWho',
      'waiting-missing-what': 'ruleWaitingMissingWhat',
      'waiting-missing-when': 'ruleWaitingMissingWhen',
      'waiting-missing-fallback': 'ruleWaitingMissingFallback',
      'time-band-missing': 'ruleTimeBandMissing',
      'time-band-multiple': 'ruleTimeBandMultiple',
      'project-has-children': 'ruleProjectHasChildren',
      'empty-content': 'ruleEmptyContent',
    };

    /**
     * 取一条便贴的违反项。
     * @param {object} note - 便贴数据。
     * @returns {string[]} 违反项键；没有或非法时为空数组。
     */
    function violationsOf(note) {
      return note !== null && typeof note === 'object' && Array.isArray(note.violations)
        ? note.violations.filter((key) => typeof key === 'string')
        : [];
    }

    /**
     * 规则角标：违反容器规则的便贴自己会说话。
     *
     * 它**只是个标记**——不汇总、不排队、不点开成一份待办清单（ADR-0007）。
     * 悬停能看到缺了什么；点开便贴时抽屉里逐条列出。
     * @param {object} props - props。
     * @returns {object} React 元素或 null。
     */
    function RuleBadge(props) {
      const keys = Array.isArray(props.violations) ? props.violations : [];
      if (keys.length === 0) return null;
      const t = props.t;
      const reasons = keys.map((key) => t(VIOLATION_LABEL_KEY[key] ?? key));
      return h(
        'span',
        {
          className: 'gtd-rule-badge',
          'data-role': 'rule-badge',
          'data-violations': keys.join(','),
          'data-count': String(keys.length),
          title: `${t('ruleHeading')}：${reasons.join('；')}`,
          style: {
            position: 'absolute',
            top: '6px',
            right: props.offsetRight === true ? '32px' : '8px',
            padding: '0 5px',
            borderRadius: 'var(--dsw-radius-xs)',
            border: '1px solid var(--dsw-alias-warning-border, var(--dsw-alias-border-l3))',
            background: 'var(--dsw-alias-warning-bg, var(--dsw-alias-bg-module-platform))',
            color: 'var(--dsw-alias-label-primary)',
            fontSize: '10px',
            lineHeight: '15px',
            cursor: 'help',
          },
        },
        '⚑',
      );
    }
    /* gtd:08 end */

    /**
     * 左栏图标：一个纸箱（GLOSSARY「工作台用语」）。
     * 必须返回真正的 React 组件，不能返回 SVG 字符串。
     * @param {object} props - occupant props（size、active）。
     * @returns {object} React 元素。
     */
    function WorkbenchIcon(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 24;
      const active = props.active === true;
      return h(
        'svg',
        {
          viewBox: '0 0 64 64',
          width: size,
          height: size,
          'aria-hidden': true,
          style: { display: 'block', pointerEvents: 'none', opacity: active ? 1 : 0.72 },
        },
        h('path', { d: 'M8 22 L32 12 L56 22 L32 32 Z', fill: '#7ea6f5' }),
        h('path', { d: 'M8 22 L32 32 L32 56 L8 44 Z', fill: '#3f6fd8' }),
        h('path', { d: 'M56 22 L32 32 L32 56 L56 44 Z', fill: '#2f57b0' }),
      );
    }

    /* gtd:09 拿起弹回：有阻尼、有倾斜，松手回原位，不落位 */
    /** 开始算「拖」的位移阈值（px）。手抖不算拖，免得点开抽屉时顺手抖一下。 */
    const DRAG_THRESHOLD = 6;

    /**
     * 便贴的「拿起来」手感。
     *
     * ADR-0006 / ADR-0007：**位置归位置，手感归手感**——拖起来有阻尼和倾斜，
     * 松手弹回原位，**不落位**、不写任何状态、不记任何坐标。所以这个 hook 只有一份瞬时位移，
     * 组件一卸载就没了；刷新页面也不会记住「上次放在哪」。
     * @returns {object} 拖动状态、事件与内联样式。
     */
    function useDragToLift() {
      const [offset, setOffset] = React.useState(null);
      const draggedRef = React.useRef(false);
      const stopRef = React.useRef(null);

      const release = () => {
        if (stopRef.current !== null) {
          stopRef.current();
          stopRef.current = null;
        }
      };
      React.useEffect(() => () => release(), []);

      const onPointerDown = (event) => {
        if (typeof event?.button === 'number' && event.button !== 0) return;
        const doc = typeof document === 'undefined' ? null : document;
        if (doc === null || typeof doc.addEventListener !== 'function') return;
        const startX = typeof event.clientX === 'number' ? event.clientX : 0;
        const startY = typeof event.clientY === 'number' ? event.clientY : 0;
        draggedRef.current = false;
        release();
        const onMove = (moveEvent) => {
          const dx = (typeof moveEvent.clientX === 'number' ? moveEvent.clientX : startX) - startX;
          const dy = (typeof moveEvent.clientY === 'number' ? moveEvent.clientY : startY) - startY;
          if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
          draggedRef.current = true;
          // 阻尼：位置只跟一半多一点；倾斜：横向拖得越远翘得越多，最多 5°。
          setOffset({
            x: Math.round(dx * 0.55),
            y: Math.round(dy * 0.45),
            tilt: Math.max(-5, Math.min(5, Math.round(dx * 0.06 * 100) / 100)),
          });
        };
        const onUp = () => {
          release();
          // 松手回原位：位移清空，过渡交给 CSS。**不落位**，也没有「放到哪」这回事。
          setOffset(null);
        };
        doc.addEventListener('pointermove', onMove);
        doc.addEventListener('pointerup', onUp);
        doc.addEventListener('pointercancel', onUp);
        stopRef.current = () => {
          doc.removeEventListener('pointermove', onMove);
          doc.removeEventListener('pointerup', onUp);
          doc.removeEventListener('pointercancel', onUp);
        };
      };

      return {
        active: offset !== null,
        onPointerDown,
        style:
          offset === null
            ? {}
            : {
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.tilt}deg)`,
                zIndex: 5,
                transition: 'none',
              },
        /**
         * 这一次点击是不是刚拖完的那一下——是就不该顺手打开抽屉。
         * @returns {boolean} 刚拖过就返回 true（并把标记清掉）。
         */
        consumed() {
          const was = draggedRef.current;
          draggedRef.current = false;
          return was;
        },
      };
    }
    /* gtd:09 end */

    /* gtd:09 差异基准存在浏览器本地，不落仓库文件 */
    /** localStorage 里放差异基准的键。 */
    const MOTION_BASELINE_KEY = 'gtd-workbench.baseline.v1';

    /**
     * 把快照压成「只够比差异」的摘要。
     *
     * 这段逻辑在 `app/lib/diff.js` 里有一份带完整注释的权威实现（Host 侧与测试用），
     * 浏览器这边不能 import 那个模块（插件没有构建步骤，client.js 是单文件经典脚本），
     * 所以这里是它的镜像。`app/test/seam-b-motion.test.js` 有一条断言拿同一份夹具跑两边，
     * 保证镜像不会漂。
     * @param {object} snapshot - 快照。
     * @returns {{ notes: Record<string, { container: string, dueDate: string | null, status: number }> }} 摘要。
     */
    function summarizeForMotion(snapshot) {
      const notes = {};
      const sunk = {};
      const containers = snapshot !== null && typeof snapshot === 'object' && Array.isArray(snapshot.containers) ? snapshot.containers : [];
      for (const container of containers) {
        if (container === null || typeof container !== 'object') continue;
        const key = typeof container.key === 'string' ? container.key : '';
        for (const note of Array.isArray(container.notes) ? container.notes : []) {
          if (note === null || typeof note !== 'object') continue;
          const id = typeof note.id === 'string' ? note.id : '';
          if (id.length === 0) continue;
          notes[id] = {
            container: key,
            dueDate: typeof note.dueDate === 'string' ? note.dueDate : null,
            status: typeof note.status === 'number' ? note.status : 0,
          };
        }
      }
      const sunkState = snapshot !== null && typeof snapshot === 'object' && snapshot.sunk !== null && typeof snapshot.sunk === 'object' ? snapshot.sunk : null;
      const days = sunkState !== null && Array.isArray(sunkState.days) ? sunkState.days : [];
      for (const day of days) {
        if (day === null || typeof day !== 'object') continue;
        const date = typeof day.date === 'string' ? day.date : '';
        for (const note of Array.isArray(day.notes) ? day.notes : []) {
          if (note === null || typeof note !== 'object') continue;
          const id = typeof note.id === 'string' ? note.id : '';
          if (id.length === 0) continue;
          sunk[id] = { date, container: typeof note.container === 'string' ? note.container : '' };
        }
      }
      return { notes, sunk };
    }

    /**
     * 比对两份摘要，摊成「id → 动画名」。
     *
     * **新完成只能从已沉底区比出来**：未完成取数带 `--status 0`，一条事一旦勾完就从纸箱里消失了，
     * 靠未完成那份永远看不到「新完成」。换容器优先于改期——一次只动一下。
     * 没有基线（第一次拉数）时返回空：第一次打开画布不该演「变化」。
     * @param {object | null} previous - 上次的摘要。
     * @param {object | null} next - 这次的摘要。
     * @returns {Record<string, string>} id → `'completed' | 'moved' | 'rescheduled'`。
     */
    function motionsFor(previous, next) {
      const motions = {};
      if (previous === null || typeof previous !== 'object' || next === null || typeof next !== 'object') return motions;
      const beforeNotes = previous.notes !== null && typeof previous.notes === 'object' ? previous.notes : null;
      const afterNotes = next.notes !== null && typeof next.notes === 'object' ? next.notes : null;
      if (beforeNotes === null || afterNotes === null) return motions;
      const beforeSunk = previous.sunk !== null && typeof previous.sunk === 'object' ? previous.sunk : {};
      const afterSunk = next.sunk !== null && typeof next.sunk === 'object' ? next.sunk : {};
      for (const id of Object.keys(afterSunk)) {
        if (beforeSunk[id] === undefined) motions[id] = 'completed';
      }
      for (const id of Object.keys(afterNotes)) {
        const old = beforeNotes[id];
        if (old === undefined || old === null) continue;
        const current = afterNotes[id];
        if (old.container !== current.container) motions[id] = 'moved';
        else if (old.dueDate !== current.dueDate) motions[id] = 'rescheduled';
      }
      return motions;
    }

    /**
     * 读上次的差异基准。
     *
     * 存坏了、没存过、或者环境里根本没有 localStorage，都当成「没有上次」。
     * @returns {object | null} 上次的摘要。
     */
    function readBaseline() {
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return null;
        const raw = localStorage.getItem(MOTION_BASELINE_KEY);
        return raw === null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    }

    /**
     * 把这次的摘要写成本地基准。
     *
     * 写不进去也不算错：动画少演一次，数据一点不受影响（工作台本来就不写任何东西到滴答）。
     * @param {object} summary - {@link summarizeForMotion} 的结果。
     */
    function writeBaseline(summary) {
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return;
        localStorage.setItem(MOTION_BASELINE_KEY, JSON.stringify(summary));
      } catch {
        /* 存不了就算了 */
      }
    }
    /* gtd:09 end */

    /**
     * 一张便贴：标题、截止时间、时间档色条、优先级角标。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function WorkbenchNote(props) {
      const note = props.note;
      const t = props.t;
      const band = typeof note.timeBand === 'string' ? note.timeBand : null;
      const bandColor = band !== null ? BAND_COLORS[band] : 'var(--dsw-alias-border-l3)';
      /* gtd:05 点便贴开抽屉（回调由面板经 context 递下来） */
      const openNote = React.useContext(NoteOpenContext);
      /* gtd:05 end */
      /* gtd:09 拿起弹回：拖起来有阻尼与倾斜，松手回原位，**不落位**（ADR-0006：零位置管理） */
      const drag = useDragToLift();
      /* gtd:09 end */
      const motion = typeof props.motion === 'string' ? props.motion : '';
      const enterOrder = typeof props.enterOrder === 'number' && props.enterOrder >= 0 ? props.enterOrder : 0;
      return h(
        'article',
        {
          className: 'gtd-note',
          'data-role': 'note',
          'data-note-id': note.id,
          'data-band': band === null ? '' : band,
          /* gtd:09 状态迁移只演真实差异；入场按时间轴顺序依次贴上 */
          'data-motion': motion,
          'data-enter-order': String(enterOrder),
          'data-dragging': drag.active ? 'true' : 'false',
          onPointerDown: drag.onPointerDown,
          /* gtd:09 end */
          /* gtd:05 便贴是抽屉的入口：可点、可聚焦（关掉抽屉后焦点要回得来） */
          role: 'button',
          tabIndex: 0,
          onClick: () => {
            // 拖完那一下不该顺手把抽屉打开。
            if (drag.consumed()) return;
            if (typeof openNote === 'function') openNote(note);
          },
          onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (typeof openNote === 'function') openNote(note);
          },
          /* gtd:05 end */
          style: {
            position: 'relative',
            overflow: 'hidden',
            padding: '10px 12px 10px 16px',
            borderRadius: 'var(--dsw-radius-md)',
            border: '1px solid var(--dsw-alias-border-l3)',
            background: 'var(--dsw-alias-bg-base)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.10)',
            color: 'var(--dsw-alias-label-primary)',
            cursor: drag.active ? 'grabbing' : 'pointer',
            /* gtd:09 入场依次贴上：一条条错开 40ms，读起来像一天的推进 */
            animationDelay: `${enterOrder * 40}ms`,
            ...drag.style,
            /* gtd:09 end */
          },
        },
        /* gtd:08 这张便贴违反了容器规则？亮一个角标（合规的不亮） */
        h(RuleBadge, { violations: violationsOf(note), t, offsetRight: true }),
        h('span', {
          className: 'gtd-note__band',
          'data-role': 'time-band',
          'data-band': band === null ? '' : band,
          /* gtd:04 深度是唯一要占连续时间的档：色条加宽一倍，一眼看得出哪块该给它 */
          'data-band-emphasis': band === '深度' ? 'deep' : '',
          title: t('bandLabel'),
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: band === '深度' ? '8px' : '4px',
            background: bandColor,
          },
        }),
        h('span', {
          className: 'gtd-note__priority',
          'data-role': 'priority',
          title: t('priorityLabel'),
          style: {
            position: 'absolute',
            top: '8px',
            right: '8px',
            minWidth: '20px',
            padding: '0 5px',
            borderRadius: 'var(--dsw-radius-xs)',
            border: '1px solid var(--dsw-alias-border-l3)',
            background: 'var(--dsw-alias-bg-module-platform)',
            color: 'var(--dsw-alias-label-secondary)',
            fontSize: '11px',
            lineHeight: '18px',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          },
        }, note.priorityLabel),
        h(
          'h3',
          {
            className: 'gtd-note__title',
            'data-role': 'title',
            style: {
              margin: 0,
              paddingRight: '28px',
              fontSize: '13px',
              lineHeight: '19px',
              fontWeight: 600,
              color: 'var(--dsw-alias-label-primary)',
            },
          },
          note.title,
        ),
        h(
          'div',
          {
            className: 'gtd-note__meta',
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '6px',
              fontSize: '11px',
              lineHeight: '16px',
              color: 'var(--dsw-alias-label-tertiary)',
            },
          },
          h('span', { className: 'gtd-note__due', 'data-role': 'due', title: t('dueLabel') }, note.dueLocal === null ? '—' : note.dueLocal),
          h(
            'span',
            {
              className: 'gtd-note__band-label',
              'data-role': 'band-label',
              title: t('bandLabel'),
              style: {
                padding: '0 6px',
                borderRadius: 'var(--dsw-radius-xs)',
                background: band === null ? 'transparent' : bandColor,
                color: band === null ? 'var(--dsw-alias-label-caption)' : '#ffffff',
                border: band === null ? '1px dashed var(--dsw-alias-border-l3)' : 'none',
              },
            },
            band === null ? t('unbanded') : band,
          ),
          h('span', { className: 'gtd-note__status', 'data-role': 'status', title: t('statusLabel') }, note.statusLabel),
        ),
      );
    }

    /* gtd:02 六箱归位：项目画箱签、可能清单默认折叠 */
    /**
     * 纸箱里条目的呈现方式：便贴（note）或箱签（tag）。
     * 规则由 Host 的 `app/lib/board.js` 算好、写进快照的 `kind`，Client 只照画。
     */
    const BOX_KIND = { NOTE: 'note', TAG: 'tag' };

    /**
     * 一张箱签：贴在纸箱外沿的项目标签，只写项目名和下一步指针。
     *
     * 项目**不画成便贴**——项目一旦变成一摞便贴，画布就会诱导人给项目挂子任务，
     * 那是 ADR-0004 明写的警戒线（ADR-0007 沿用）。
     *
     * **点箱签开抽屉**（规格故事 24）：抽屉里是那个项目的 markdown 记录页——
     * 「为什么这么定／验收标准／卡在谁手上」。项目与动作之间没有关联字段，
     * 这条记录页是项目这一层唯一的说明。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function BoxTag(props) {
      const note = props.note;
      const t = props.t;
      const nextStep = typeof note.nextStep === 'string' && note.nextStep.length > 0 ? note.nextStep : null;
      /* gtd:05 抽屉的入口与便贴同一套：可点、可聚焦（回调由面板经 context 递下来）。 */
      const openNote = React.useContext(NoteOpenContext);
      return h(
        'div',
        {
          className: 'gtd-tag',
          'data-role': 'box-tag',
          'data-note-id': note.id,
          title: nextStep === null ? note.title : `${note.title}｜${t('nextStepLabel')}：${nextStep}`,
          /* 箱签是项目记录页的入口：可点、可聚焦。 */
          role: 'button',
          tabIndex: 0,
          'aria-label': note.title,
          onClick: () => {
            if (typeof openNote === 'function') openNote(note);
          },
          onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (typeof openNote === 'function') openNote(note);
          },
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '6px 10px',
            borderRadius: 'var(--dsw-radius-sm)',
            // 箱签贴在纸箱外沿：左侧用一条实色脊线做出「别在箱沿上」的感觉。
            borderLeft: '3px solid var(--dsw-alias-label-tertiary)',
            border: '1px solid var(--dsw-alias-border-l2)',
            background: 'var(--dsw-alias-bg-base)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
            cursor: 'pointer',
            // 角标要绝对定位在箱签右上角。
            position: 'relative',
          },
        },
        /* gtd:08 项目挂了子任务要亮角标（ADR-0004 的警戒线） */
        h(RuleBadge, { violations: violationsOf(note), t }),
        /* gtd:08 end */
        h(
          'span',
          {
            'data-role': 'box-tag-title',
            style: { fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
          },
          note.title,
        ),
        nextStep === null
          ? null
          : h(
              'span',
              {
                'data-role': 'box-tag-next',
                style: { fontSize: '11px', lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' },
              },
              `${t('nextStepLabel')}：${nextStep}`,
            ),
      );
    }
    /* gtd:02 end */

    /* gtd:03 天刻度时间轴：今天／明天／本周／以后，默认只铺今天与本周 */
    /** 段键 → 文案键。段的顺序与「哪一天算今天」由快照的 `timeline` 给，这里只做词表映射。 */
    const SEGMENT_LABEL_KEY = {
      today: 'segmentToday',
      tomorrow: 'segmentTomorrow',
      thisWeek: 'segmentThisWeek',
      later: 'segmentLater',
    };

    /** 时间轴的兜底顺序：快照没带 timeline 时按这个画（ADR-0007）。 */
    const FALLBACK_SEGMENTS = ['today', 'tomorrow', 'thisWeek', 'later'];

    /** 兜底视野：只铺今天与本周。 */
    const FALLBACK_EXPANDED = ['today', 'thisWeek'];

    /**
     * 把便贴按段分组。
     *
     * 段键取快照里每条便贴已经算好的 `segment`；认不出的（缺字段、老快照）落到**第一段**，
     * 也就是默认展开的「今天」——**不静默消失**比排对段更重要，落在看得见的地方才好发现错了。
     * @param {object[]} notes - 一个纸箱里的便贴。
     * @param {string[]} segments - 段的顺序。
     * @returns {Map<string, object[]>} 段键 → 该段的便贴。
     */
    function groupBySegment(notes, segments) {
      const groups = new Map();
      for (const segment of segments) groups.set(segment, []);
      const fallback = segments[0];
      for (const note of notes) {
        const key = typeof note.segment === 'string' && groups.has(note.segment) ? note.segment : fallback;
        groups.get(key).push(note);
      }
      return groups;
    }

    /**
     * 时间轴的一段：段名 + 段内便贴。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function TimelineSegment(props) {
      const t = props.t;
      const segment = props.segment;
      const notes = props.notes;
      return h(
        'section',
        {
          className: 'gtd-segment',
          'data-role': 'segment',
          'data-segment': segment,
          style: { display: 'flex', flexDirection: 'column', gap: '8px' },
        },
        h(
          'h3',
          {
            className: 'gtd-segment__title',
            'data-role': 'segment-title',
            style: {
              margin: 0,
              fontSize: '11px',
              lineHeight: '16px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'var(--dsw-alias-label-caption)',
            },
          },
          t(SEGMENT_LABEL_KEY[segment]),
        ),
        notes.length === 0
          ? h(
              'p',
              {
                className: 'gtd-segment__empty',
                'data-role': 'segment-empty',
                style: { margin: 0, fontSize: '11px', color: 'var(--dsw-alias-label-caption)' },
              },
              '—',
            )
          : notes.map((note) => props.renderNote(note, { enterOrder: props.enterOrder?.get(note.id) ?? 0, motion: props.motions?.[note.id] ?? '' })),
      );
    }

    /**
     * 一条天刻度时间轴：四段依次排开，视野外的段折叠成一条计数。
     *
     * 默认视野只铺今天与本周（ADR-0007），明天与以后折起来——
     * 打开画布时不被以后的事压住，但「还有多少」这件事不能丢。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function Timeline(props) {
      const t = props.t;
      const timeline = props.timeline !== null && typeof props.timeline === 'object' ? props.timeline : {};
      const segments = Array.isArray(timeline.segments) && timeline.segments.length > 0 ? timeline.segments : FALLBACK_SEGMENTS;
      const expandable = Array.isArray(timeline.defaultExpanded) ? timeline.defaultExpanded : FALLBACK_EXPANDED;
      /* gtd:03 「默认」只铺两段：折叠条上留一个展开口，点开看全部四段，不改任何数据 */
      const [opened, setOpened] = React.useState(false);
      const expanded = opened ? segments : expandable;
      /* gtd:03 end */
      const groups = groupBySegment(props.notes, segments);
      const visible = segments.filter((segment) => expanded.includes(segment));
      /* gtd:09 入场顺序：按「今天 → 明天 → 本周 → 以后」铺开的先后，一条一条贴上；
         跨纸箱接着数，整块画布是一条连续的贴纸动作，不是一个箱子各自重来 */
      const enterOrder = new Map();
      let counter = typeof props.enterBase === 'number' && props.enterBase > 0 ? props.enterBase : 0;
      for (const segment of visible) {
        for (const note of groups.get(segment)) {
          enterOrder.set(note.id, counter);
          counter += 1;
        }
      }
      /* gtd:09 end */
      const hidden = segments.filter((segment) => !expanded.includes(segment));
      const hiddenCount = hidden.reduce((total, segment) => total + groups.get(segment).length, 0);
      return h(
        'div',
        {
          className: 'gtd-timeline',
          'data-role': 'timeline',
          'data-today': typeof timeline.today === 'string' ? timeline.today : '',
          'data-expanded-all': opened ? 'true' : 'false',
          style: { display: 'flex', flexDirection: 'column', gap: '12px' },
        },
        visible.map((segment) =>
          h(TimelineSegment, {
            key: segment,
            segment,
            notes: groups.get(segment),
            t,
            renderNote: props.renderNote,
            enterOrder,
            motions: props.motions,
          }),
        ),
        /* gtd:03 折叠成一条计数：还有多少看得见，但不占版面 */
        opened
          ? h(
              'button',
              {
                type: 'button',
                'data-role': 'timeline-fold',
                onClick: () => setOpened(false),
                style: {
                  margin: 0,
                  padding: '4px 8px',
                  border: '1px dashed var(--dsw-alias-border-l2)',
                  borderRadius: 'var(--dsw-radius-xs)',
                  background: 'transparent',
                  font: 'inherit',
                  fontSize: '11px',
                  color: 'var(--dsw-alias-label-caption)',
                  cursor: 'pointer',
                },
              },
              `▲ ${t('collapseSegments')}`,
            )
          : hiddenCount === 0
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  'data-role': 'timeline-collapsed',
                  'data-segments': hidden.join(','),
                  'data-count': String(hiddenCount),
                  onClick: () => setOpened(true),
                  style: {
                    margin: 0,
                    padding: '4px 8px',
                    borderRadius: 'var(--dsw-radius-xs)',
                    border: '1px dashed var(--dsw-alias-border-l2)',
                    background: 'transparent',
                    font: 'inherit',
                    fontSize: '11px',
                    color: 'var(--dsw-alias-label-caption)',
                    cursor: 'pointer',
                  },
                },
                `${hidden.map((segment) => t(SEGMENT_LABEL_KEY[segment])).join(' · ')} ${hiddenCount} ${t('countUnit')}`,
              ),
        /* gtd:03 end */
      );
    }
    /* gtd:03 end */

    /**
     * 一个纸箱：一个 GTD 容器所占的位置，箱内便贴是这个容器里的条目。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function WorkbenchBox(props) {
      const container = props.container;
      const t = props.t;
      const notes = Array.isArray(container.notes) ? container.notes : [];
      const open = notes.filter((note) => note.status === 0);
      /* gtd:02 项目画箱签、可能清单默认折叠 */
      const asTag = container.kind === BOX_KIND.TAG;
      /* v2:project 被指到的那个纸箱（点卡脚的项目指针进来）：摆开着，不许折起来。 */
      const focusTarget = props.focusTarget === true;
      const [collapsed, setCollapsed] = React.useState(container.collapsedByDefault === true);
      const isCollapsed = focusTarget ? false : collapsed;
      const collapseToggle = container.collapsedByDefault === true;
      /* gtd:02 end */
      return h(
        'section',
        {
          className: 'gtd-box',
          'data-role': 'box',
          'data-container': container.key,
          'data-container-name': container.name,
          'data-box-kind': asTag ? BOX_KIND.TAG : BOX_KIND.NOTE,
          'data-collapsed': isCollapsed ? 'true' : 'false',
          /* v2:project 这个纸箱是这次要看的那一个。 */
          'data-focus-target': focusTarget ? 'true' : 'false',
          style: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '260px',
            maxWidth: '320px',
            borderRadius: 'var(--dsw-radius-xl)',
            border: '1px solid var(--dsw-alias-border-l2)',
            background: 'var(--dsw-alias-bg-module-platform)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
          },
        },
        h('span', {
          className: 'gtd-box__fold',
          'aria-hidden': true,
          style: {
            position: 'absolute',
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderTop: '20px solid var(--dsw-alias-bg-base)',
            borderLeft: '20px solid transparent',
          },
        }),
        h(
          'header',
          {
            className: 'gtd-box__header',
            style: {
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              flexWrap: 'wrap',
              padding: '10px 12px 8px',
              borderBottom: '1px solid var(--dsw-alias-border-l2)',
            },
          },
          h(
            'h2',
            {
              className: 'gtd-box__title',
              'data-role': 'box-title',
              style: { margin: 0, fontSize: '14px', lineHeight: '20px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
            },
            container.name,
          ),
          h(
            'span',
            {
              className: 'gtd-box__source',
              'data-role': 'box-source',
              title: t('sourceLabel'),
              style: { fontSize: '11px', color: 'var(--dsw-alias-label-caption)' },
            },
            `${t('sourceLabel')}: ${container.listName}`,
          ),
          collapseToggle
            ? h(
                'button',
                {
                  type: 'button',
                  'data-role': 'box-toggle',
                  'aria-expanded': isCollapsed ? 'false' : 'true',
                  onClick: () => setCollapsed((value) => !value),
                  style: {
                    marginLeft: 'auto',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--dsw-alias-label-secondary)',
                    font: 'inherit',
                    fontSize: '11px',
                    padding: '0 2px',
                    cursor: 'pointer',
                  },
                },
                isCollapsed ? t('expandBox') : t('collapseBox'),
              )
            : null,
          h(
            'span',
            {
              className: 'gtd-box__count',
              'data-role': 'box-count',
              style: {
                marginLeft: collapseToggle ? '0' : 'auto',
                fontSize: '11px',
                color: 'var(--dsw-alias-label-tertiary)',
              },
            },
            `${open.length} ${t('countUnit')}`,
          ),
          /* gtd:07 每个纸箱另标一个完成数：比较哪个容器在出货（ADR-0007） */
          h(
            'span',
            {
              className: 'gtd-box__completions',
              'data-role': 'box-completions',
              'data-count': String(typeof props.completedCount === 'number' ? props.completedCount : 0),
              title: t('boxCompletionsHint'),
              style: { fontSize: '11px', color: 'var(--dsw-alias-label-caption)', fontVariantNumeric: 'tabular-nums' },
            },
            `${t('boxCompletions')} ${typeof props.completedCount === 'number' ? props.completedCount : 0}`,
          ),
        ),
        /* gtd:02 折叠成一条计数：可能清单默认不占版面，但条数看得见 */
        isCollapsed
          ? h(
              'p',
              {
                className: 'gtd-box__collapsed',
                'data-role': 'box-collapsed',
                style: { margin: 0, padding: '10px 12px 12px', fontSize: '12px', color: 'var(--dsw-alias-label-caption)' },
              },
              `${open.length} ${t('countUnit')}`,
            )
          : h(
              'div',
              {
                className: 'gtd-box__body',
                style: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px 12px', overflowY: 'auto', minHeight: 0 },
              },
              open.length === 0
                ? h('p', { className: 'gtd-box__empty', 'data-role': 'empty', style: { margin: 0, fontSize: '12px', color: 'var(--dsw-alias-label-caption)' } }, t('emptyBox'))
                : asTag
                  ? /* gtd:03 箱签不排时间轴：项目是贴在箱外沿的标签，不是一摞按天排的便贴（ADR-0007） */
                    open.map((note) => h(BoxTag, { key: note.id, note, t }))
                  : h(Timeline, {
                      notes: open,
                      timeline: props.timeline,
                      t,
                      /* gtd:09 入场顺序与状态迁移动画由时间轴按段推下来 */
                      renderNote: (note, meta) => h(WorkbenchNote, { key: note.id, note, t, ...meta }),
                      motions: props.motions,
                      enterBase: props.enterBase,
                    }),
            ),
        /* gtd:02 end */
      );
    }

    /* gtd:07 已沉底：展示区，不是回收箱 */
    /**
     * 已沉底区：最近七天已勾选完成的条目，按完成日堆叠。
     *
     * 它是**展示区，不是回收箱**（GLOSSARY「已沉底」／ADR-0004）：这里没有删除、没有归还、没有任何按钮。
     * 完成情况 = 滴答勾选（ADR-0006），单口径——批量勾选也会被如实算作完成。
     * @param {object} props - props。
     * @returns {object} React 元素或 null。
     */
    function SunkArea(props) {
      const t = props.t;
      const sunk = props.sunk !== null && typeof props.sunk === 'object' ? props.sunk : null;
      if (sunk === null) return null;
      const days = Array.isArray(sunk.days) ? sunk.days : [];
      return h(
        'section',
        {
          className: 'gtd-sunk',
          'data-role': 'sunk',
          'data-window-days': String(sunk.windowDays ?? ''),
          'data-from': typeof sunk.from === 'string' ? sunk.from : '',
          'data-to': typeof sunk.to === 'string' ? sunk.to : '',
          style: {
            flex: '0 0 auto',
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '8px 16px 12px',
            borderTop: '1px solid var(--dsw-alias-border-l2)',
            background: 'var(--dsw-alias-bg-module-platform)',
          },
        },
        h(
          'h2',
          {
            'data-role': 'sunk-heading',
            style: { margin: '0 0 6px', fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
          },
          `${t('sunkHeading')} · ${String(sunk.windowDays ?? '')} ${t('sunkWindowUnit')}`,
        ),
        days.length === 0
          ? h(
              'p',
              {
                'data-role': 'sunk-empty',
                style: { margin: 0, fontSize: '11px', color: 'var(--dsw-alias-label-caption)' },
              },
              t('sunkEmpty'),
            )
          : days.map((day) =>
              h(
                'div',
                {
                  key: day.date,
                  className: 'gtd-sunk__day',
                  'data-role': 'sunk-day',
                  'data-date': day.date,
                  'data-count': String(Array.isArray(day.notes) ? day.notes.length : 0),
                  style: { display: 'flex', alignItems: 'baseline', gap: '8px', padding: '2px 0' },
                },
                h(
                  'span',
                  {
                    'data-role': 'sunk-date',
                    style: { flex: '0 0 auto', fontSize: '11px', color: 'var(--dsw-alias-label-caption)', fontVariantNumeric: 'tabular-nums' },
                  },
                  day.date,
                ),
                ...(Array.isArray(day.notes) ? day.notes : []).map((note) =>
                  h(
                    'span',
                    {
                      key: note.id,
                      className: 'gtd-sunk__note',
                      'data-role': 'sunk-note',
                      'data-note-id': note.id,
                      'data-container': note.container,
                      /* gtd:09 刚沉进来的那条在这里亮一下：变化确实发生过 */
                      'data-motion':
                        props.motions !== null && typeof props.motions === 'object' && props.motions[note.id] === 'completed'
                          ? 'completed'
                          : '',
                      /* gtd:09 end */
                      title: `${note.container}｜${note.completedTime}`,
                      style: {
                        padding: '0 6px',
                        borderRadius: 'var(--dsw-radius-xs)',
                        border: '1px solid var(--dsw-alias-border-l2)',
                        background: 'var(--dsw-alias-bg-base)',
                        fontSize: '11px',
                        lineHeight: '17px',
                        color: 'var(--dsw-alias-label-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '220px',
                      },
                    },
                    note.title,
                  ),
                ),
              ),
            ),
      );
    }
    /* gtd:07 end */

    /**
     * 画布：按快照里的容器画纸箱。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function WorkbenchBoard(props) {
      const t = props.t;
      const snapshot = props.snapshot;
      const containers = snapshot && Array.isArray(snapshot.containers) ? snapshot.containers : [];
      /* gtd:07 每个纸箱的完成数从已沉底区的 counts 里拿 */
      const counts =
        snapshot !== null && typeof snapshot === 'object' && snapshot.sunk !== null && typeof snapshot.sunk === 'object'
          ? snapshot.sunk.counts
          : null;
      const completedOf = (key) =>
        counts !== null && typeof counts === 'object' && typeof counts[key] === 'number' ? counts[key] : 0;
      /* gtd:07 end */
      return h(
        'div',
        {
          className: 'gtd-board',
          'data-role': 'board',
          style: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            padding: '16px',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'auto',
            background: 'var(--dsw-alias-bg-base)',
          },
        },
        /* gtd:09 入场顺序跨纸箱接着数：整块画布是一条连续的贴纸动作 */
        (() => {
          let base = 0;
          return containers.map((container) => {
            const box = h(WorkbenchBox, {
              key: container.key,
              container,
              t,
              timeline: snapshot === null || typeof snapshot !== 'object' ? null : snapshot.timeline,
              completedCount: completedOf(container.key),
              motions: props.motions,
              enterBase: base,
              /* v2:project 被指到的那个纸箱：摆开、标出来。 */
              focusTarget: props.focusContainer === container.key,
            });
            const open = Array.isArray(container.notes) ? container.notes.filter((note) => note.status === 0).length : 0;
            base += open;
            return box;
          });
        })(),
        /* gtd:09 end */
      );
    }

    /* gtd:04 本周主攻：从滴答的深度标签推导出来的一条独立带子 */
    /**
     * 本周主攻带。
     *
     * 主攻由 Host 按滴答的 `深度` 标签推导（`app/lib/focus.js`），Client 只画。
     * 它**单独一条带子**摆在六个纸箱上面，不混进任何纸箱——
     * 混进纸箱就变成「第七个容器」，而主攻本来就不是容器，是一周内的排期判断。
     * @param {object} props - props。
     * @returns {object} React 元素或 null。
     */
    function MainPushStrip(props) {
      const t = props.t;
      const mainPush = Array.isArray(props.mainPush) ? props.mainPush : [];
      if (mainPush.length === 0) {
        return h(
          'div',
          {
            className: 'gtd-main-push',
            'data-role': 'main-push',
            'data-count': '0',
            style: {
              padding: '8px 16px',
              borderBottom: '1px solid var(--dsw-alias-border-l2)',
              fontSize: '12px',
              color: 'var(--dsw-alias-label-caption)',
            },
          },
          `${t('mainPushHeading')}：${t('mainPushEmpty')}`,
        );
      }
      return h(
        'div',
        {
          className: 'gtd-main-push',
          'data-role': 'main-push',
          'data-count': String(mainPush.length),
          style: {
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '6px 10px',
            padding: '8px 16px',
            borderBottom: '1px solid var(--dsw-alias-border-l2)',
            background: 'var(--dsw-alias-bg-module-platform)',
          },
        },
        h(
          'strong',
          {
            'data-role': 'main-push-heading',
            style: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-primary)' },
          },
          `${t('mainPushHeading')} ${mainPush.length}`,
        ),
        ...mainPush.map((item, index) =>
          h(
            'button',
            {
              key: item.id,
              type: 'button',
              className: 'gtd-main-push__item',
              'data-role': 'main-push-item',
              'data-note-id': item.id,
              'data-order': String(index + 1),
              title: item.dueLocal === null ? item.title : `${item.title}｜${t('dueLabel')} ${item.dueLocal}`,
              onClick: () => props.onOpen(item),
              style: {
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '6px',
                maxWidth: '320px',
                padding: '1px 8px',
                border: '1px solid var(--dsw-alias-border-l3)',
                borderLeft: '4px solid ' + (BAND_COLORS.深度 ?? 'var(--dsw-alias-border-l3)'),
                borderRadius: 'var(--dsw-radius-xs)',
                background: 'var(--dsw-alias-bg-base)',
                color: 'var(--dsw-alias-label-primary)',
                font: 'inherit',
                fontSize: '12px',
                lineHeight: '19px',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            },
            h('span', { 'data-role': 'main-push-title' }, item.title),
            item.dueLocal === null
              ? null
              : h(
                  'span',
                  { 'data-role': 'main-push-due', style: { fontSize: '11px', color: 'var(--dsw-alias-label-caption)' } },
                  item.dueLocal,
                ),
          ),
        ),
      );
    }
    /* gtd:04 end */

    /* gtd:11 失败面：未登录与别的失败分开说，两种都不画空板 */
    /** 滴答的登录命令。未登录时明确告诉人去登录——空板会被读成「今天没任务」（ADR-0008）。 */
    const LOGIN_COMMAND = 'dida auth login';

    /**
     * 补齐失败类别。
     *
     * Host 已经把失败分成 `not-authenticated`／`cli-unavailable`／`cli-failed`；
     * 响应体没带 code 时按状态码兜底（401 就是没登录）。
     * @param {unknown} failure - Host 回的失败描述。
     * @param {number} status - HTTP 状态码。
     * @returns {object} 带 code 的失败描述。
     */
    function withFailureCode(failure, status) {
      const base = failure !== null && typeof failure === 'object' ? failure : {};
      const code =
        typeof base.code === 'string' && base.code.length > 0
          ? base.code
          : status === 401
            ? 'not-authenticated'
            : 'http-error';
      return { ...base, code };
    }

    /**
     * 失败面板：把「未登录」和「别的失败」说得不一样。
     *
     * 未登录给去登录的命令，别的失败给失败原因。两种情况都不画空板。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function WorkbenchFailure(props) {
      const t = props.t;
      const error = props.error !== null && typeof props.error === 'object' ? props.error : {};
      const code = typeof error.code === 'string' && error.code.length > 0 ? error.code : 'unknown';
      const message = typeof error.message === 'string' ? error.message : '';
      const needsLogin = code === 'not-authenticated';
      return h(
        'div',
        {
          className: 'gtd-workbench gtd-workbench--failure',
          'data-role': 'panel',
          'data-state': needsLogin ? 'not-authenticated' : 'error',
          'data-error-code': code,
          style: { padding: '16px', color: 'var(--dsw-alias-label-primary)' },
        },
        h(
          'h2',
          { 'data-role': 'error-heading', style: { margin: '0 0 8px', fontSize: '15px' } },
          t(needsLogin ? 'loginHeading' : 'errorHeading'),
        ),
        needsLogin
          ? h(
              'p',
              {
                'data-role': 'login-prompt',
                style: { margin: '0 0 8px', fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' },
              },
              t('loginHint'),
              h(
                'code',
                {
                  'data-role': 'login-command',
                  style: {
                    marginLeft: '6px',
                    padding: '1px 6px',
                    borderRadius: 'var(--dsw-radius-xs)',
                    border: '1px solid var(--dsw-alias-border-l3)',
                    background: 'var(--dsw-alias-bg-module-platform)',
                    fontFamily: 'monospace',
                  },
                },
                LOGIN_COMMAND,
              ),
            )
          : null,
        message.length > 0
          ? h(
              'p',
              {
                'data-role': 'error-message',
                style: { margin: '0 0 12px', fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' },
              },
              message,
            )
          : null,
        h(
          'button',
          {
            type: 'button',
            'data-role': 'retry',
            onClick: props.onRetry,
            style: {
              border: '1px solid var(--dsw-alias-border-l3)',
              borderRadius: 'var(--dsw-radius-md)',
              background: 'var(--dsw-alias-bg-module-platform)',
              color: 'var(--dsw-alias-label-primary)',
              font: 'inherit',
              fontSize: '13px',
              padding: '4px 12px',
              cursor: 'pointer',
            },
          },
          t('retry'),
        ),
      );
    }
    /* gtd:11 end */

    /* gtd:05 详情抽屉：点便贴开抽屉，只看原文与滴答原始字段 */
    /** 便贴的「打开抽屉」回调。用 context 递，省得 Board → Box → Timeline 三层各穿一个 prop。 */
    const NoteOpenContext = React.createContext(null);

    /**
     * 抽屉里摆哪些原始字段，按这个顺序摆。
     *
     * 「原始字段」= 滴答那侧的取值，**不是摘要**：便贴上已经收成角标的东西，这里给原文与真值，
     * 让人能对着核（spec「我想要抽屉里能看到滴答的原始字段」）。
     */
    const DRAWER_FIELDS = [
      { key: 'dueLocal', labelKey: 'fieldDue', read: (note) => (note.dueLocal === null || note.dueLocal === undefined ? '—' : String(note.dueLocal)) },
      { key: 'dueAllDay', labelKey: 'fieldAllDay', read: (note) => (note.dueAllDay === true ? '是' : '否') },
      { key: 'dueAt', labelKey: 'fieldDueUtc', read: (note) => (note.dueAt === null || note.dueAt === undefined ? '—' : String(note.dueAt)) },
      { key: 'timeBand', labelKey: 'fieldBand', read: (note, t) => (typeof note.timeBand === 'string' ? note.timeBand : t('unbanded')) },
      { key: 'priority', labelKey: 'fieldPriority', read: (note, t) => (typeof note.priorityLabel === 'string' ? note.priorityLabel : t('unbanded')) },
      { key: 'status', labelKey: 'fieldStatus', read: (note, t) => (typeof note.statusLabel === 'string' ? note.statusLabel : t('unbanded')) },
      { key: 'tags', labelKey: 'fieldTags', read: (note) => (Array.isArray(note.tags) && note.tags.length > 0 ? note.tags.join(',') : '—') },
      { key: 'id', labelKey: 'fieldId', read: (note) => String(note.id === undefined || note.id === null ? '—' : note.id) },
    ];

    /* gtd:06 抽屉里的 markdown 侧：为什么／验收标准／卡点，来自仓库，不是现编 */
    /** 抽屉里 markdown 侧的三项，按这个顺序摆。 */
    const RECORD_FIELDS = [
      { key: 'why', labelKey: 'recordWhy' },
      { key: 'acceptance', labelKey: 'recordAcceptance' },
      { key: 'blocker', labelKey: 'recordBlocker' },
    ];

    /**
     * 在快照的记录里按编号找那一页。
     * @param {object[]} records - 快照的 records。
     * @param {string | null} number - 便贴上的记录编号。
     * @returns {object | null} 命中的记录。
     */
    function recordOf(records, number) {
      if (typeof number !== 'string' || number.length === 0) return null;
      if (!Array.isArray(records)) return null;
      for (const record of records) {
        if (record !== null && typeof record === 'object' && record.number === number) return record;
      }
      return null;
    }

    /**
     * 抽屉里 markdown 那一块：它的「为什么这么定」。
     *
     * 与滴答侧**分区呈现**：滴答管时间／状态／容器，markdown 管为什么／验收标准／卡在谁手上
     * （spec「数据」）。命中不到就明说「无对应记录」，不留一块空白让人以为是没加载出来。
     * 这里的字全部来自仓库里的 issue 页，一个字都不改写。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function DrawerRecord(props) {
      const t = props.t;
      const record = props.record;
      const style = {
        marginTop: '14px',
        paddingTop: '12px',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
      };
      if (record === null) {
        return h(
          'section',
          { className: 'gtd-drawer__record', 'data-role': 'drawer-record', 'data-record': '', style },
          h(
            'h3',
            {
              'data-role': 'drawer-record-heading',
              style: { margin: '0 0 6px', fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
            },
            t('recordHeading'),
          ),
          h(
            'p',
            {
              'data-role': 'drawer-no-record',
              style: { margin: 0, fontSize: '12px', color: 'var(--dsw-alias-label-caption)' },
            },
            t('recordNone'),
          ),
        );
      }
      return h(
        'section',
        { className: 'gtd-drawer__record', 'data-role': 'drawer-record', 'data-record': record.number, style },
        h(
          'h3',
          {
            'data-role': 'drawer-record-heading',
            style: { margin: '0 0 6px', fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
          },
          t('recordHeading'),
        ),
        h(
          'dl',
          {
            'data-role': 'drawer-record-fields',
            style: { margin: '0 0 8px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '11px', lineHeight: '17px' },
          },
          RECORD_FIELDS.flatMap((field) => [
            h(
              'dt',
              {
                key: `${field.key}-label`,
                'data-role': 'drawer-record-label',
                style: { margin: 0, color: 'var(--dsw-alias-label-caption)' },
              },
              t(field.labelKey),
            ),
            h(
              'dd',
              {
                key: `${field.key}-value`,
                'data-role': 'drawer-record-field',
                'data-field': field.key,
                style: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-secondary)' },
              },
              h(
                'span',
                { 'data-role': 'drawer-record-value' },
                typeof record[field.key] === 'string' && record[field.key].length > 0 ? record[field.key] : t('recordUnwritten'),
              ),
            ),
          ]),
        ),
        h(
          'p',
          {
            'data-role': 'drawer-record-source',
            style: { margin: 0, fontSize: '11px', color: 'var(--dsw-alias-label-caption)', wordBreak: 'break-all' },
          },
          `${t('recordSource')}：${record.source}`,
        ),
      );
    }
    /* gtd:06 end */

    /**
     * 详情抽屉：一张便贴的全文与滴答原始字段。
     *
     * 它是**覆盖层**，不是画布的一部分：绝对定位盖在面板上，画布的版面一个像素都不动
     * （打开、关掉画布的 DOM 都不变）。抽屉里**不放摘要、不改写正文**——正文就是原文。
     * 打开时焦点落到关闭按钮上，Esc 或关闭按钮都能关，关掉后焦点回到那张便贴。
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function NoteDrawer(props) {
      const note = props.note;
      const t = props.t;
      const onClose = props.onClose;
      const closeRef = React.useRef(null);
      React.useEffect(() => {
        if (closeRef.current !== null && typeof closeRef.current.focus === 'function') closeRef.current.focus();
        const doc = typeof document === 'undefined' ? null : document;
        const onKeyDown = (event) => {
          if (event.key === 'Escape') onClose();
        };
        if (doc !== null && typeof doc.addEventListener === 'function') doc.addEventListener('keydown', onKeyDown);
        return () => {
          if (doc !== null && typeof doc.removeEventListener === 'function') doc.removeEventListener('keydown', onKeyDown);
          // 关掉之后焦点回到那张便贴：键盘用户不会掉到页面顶上。
          const opener = doc === null || typeof doc.querySelector !== 'function' ? null : doc.querySelector(`[data-note-id="${note.id}"]`);
          if (opener !== null && typeof opener.focus === 'function') opener.focus();
        };
      }, [note.id, onClose]);
      const content = typeof note.content === 'string' ? note.content : '';
      /* markdown 侧那一页记录：抽屉里既画它的「验收标准」，也要拿它判断要不要重复画完成要求。 */
      const record = recordOf(props.records, note.record);
      /* 这一条动作自己的完成要求（单一口径在 Host 侧 `app/lib/requirement.js`）。 */
      const requirement = note.requirement !== null && typeof note.requirement === 'object' ? note.requirement : {};
      const requirementText =
        typeof requirement.text === 'string' && requirement.text.length > 0 ? requirement.text : null;
      const requirementSource =
        typeof requirement.source === 'string' && requirement.source.length > 0 ? requirement.source : null;
      const acceptance =
        record !== null && typeof record.acceptance === 'string' ? record.acceptance.trim() : '';
      /* 记录页的「验收标准」与这条动作的完成要求**层级不同、可以并存**；
         但同一段文字不画两遍。 */
      const repeated = requirementText !== null && requirementText === acceptance;
      return h(
        'aside',
        {
          className: 'gtd-drawer',
          'data-role': 'drawer',
          'data-note-id': note.id,
          role: 'dialog',
          'aria-modal': 'false',
          'aria-label': typeof note.title === 'string' ? note.title : '',
          style: {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '380px',
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderLeft: '1px solid var(--dsw-alias-border-l2)',
            background: 'var(--dsw-alias-bg-base)',
            boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.12)',
          },
        },
        h(
          'header',
          {
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: '1px solid var(--dsw-alias-border-l2)',
            },
          },
          h(
            'h2',
            {
              'data-role': 'drawer-title',
              style: { margin: 0, flex: 1, fontSize: '14px', lineHeight: '20px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
            },
            note.title,
          ),
          h(
            'button',
            {
              type: 'button',
              'data-role': 'drawer-close',
              ref: closeRef,
              'aria-label': t('closeDrawer'),
              onClick: onClose,
              style: {
                border: '1px solid var(--dsw-alias-border-l3)',
                borderRadius: 'var(--dsw-radius-md)',
                background: 'var(--dsw-alias-bg-module-platform)',
                color: 'var(--dsw-alias-label-primary)',
                font: 'inherit',
                fontSize: '12px',
                lineHeight: '18px',
                padding: '1px 8px',
                cursor: 'pointer',
              },
            },
            t('closeDrawer'),
          ),
        ),
        h(
          'div',
          {
            className: 'gtd-drawer__body',
            'data-role': 'drawer-body',
            style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px 16px' },
          },
          h(
            'pre',
            {
              className: 'gtd-drawer__content',
              'data-role': 'drawer-content',
              style: {
                margin: '0 0 12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
                fontSize: '12px',
                lineHeight: '19px',
                color: 'var(--dsw-alias-label-primary)',
              },
            },
            content,
          ),
          h(
            'dl',
            {
              className: 'gtd-drawer__fields',
              'data-role': 'drawer-fields',
              style: { margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '11px', lineHeight: '17px' },
            },
            DRAWER_FIELDS.flatMap((field) => [
              h(
                'dt',
                {
                  key: `${field.key}-label`,
                  className: 'gtd-drawer__field-label',
                  'data-role': 'drawer-field-label',
                  style: { margin: 0, color: 'var(--dsw-alias-label-caption)' },
                },
                t(field.labelKey),
              ),
              h(
                'dd',
                {
                  key: `${field.key}-value`,
                  className: 'gtd-drawer__field',
                  'data-role': 'drawer-field',
                  'data-field': field.key,
                  style: { margin: 0, color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-all' },
                },
                // 值单独包一层，测试与眼睛都对着这一个节点。
                h('span', { 'data-role': 'drawer-field-value' }, field.read(note, t)),
              ),
            ]),
          ),
          /* gtd:08 点开便贴能看见它违反了哪几项——角标自己不说清，抽屉里说清 */
          violationsOf(note).length === 0
            ? null
            : h(
                'section',
                {
                  className: 'gtd-drawer__rules',
                  'data-role': 'drawer-rules',
                  style: {
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--dsw-alias-border-l2)',
                  },
                },
                h(
                  'h3',
                  {
                    'data-role': 'drawer-rules-heading',
                    style: { margin: '0 0 4px', fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
                  },
                  t('ruleHeading'),
                ),
                h(
                  'ul',
                  { style: { margin: 0, paddingLeft: '16px', fontSize: '11px', lineHeight: '17px', color: 'var(--dsw-alias-label-secondary)' } },
                  violationsOf(note).map((key) =>
                    h('li', { key, 'data-role': 'drawer-rule-item', 'data-violation': key }, t(VIOLATION_LABEL_KEY[key] ?? key)),
                  ),
                ),
              ),
          /* gtd:08 end */
          /* v2:focus 没进焦点的动作，在抽屉里说清为什么——角标自己不会说话 */
          typeof note.ineligibleReason === 'string' && note.ineligibleReason.length > 0 && note.eligible !== true
            ? h(
                'section',
                {
                  className: 'gtd-drawer__ineligible',
                  'data-role': 'drawer-ineligible',
                  /* 原因值是 Host 给的稳定契约（`INELIGIBLE_REASONS`），这里原样呈现，不改写。 */
                  'data-reason': note.ineligibleReason,
                  style: {
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--dsw-alias-border-l2)',
                  },
                },
                h(
                  'h3',
                  {
                    'data-role': 'drawer-ineligible-heading',
                    style: { margin: '0 0 4px', fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
                  },
                  t('drawerIneligibleHeading'),
                ),
                h(
                  'p',
                  {
                    'data-role': 'drawer-ineligible-reason',
                    style: { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' },
                  },
                  note.ineligibleReason,
                ),
              )
            : null,
          /* v2:focus end */
          /* v2:focus 这条动作自己的完成要求：记录页那一段是项目级验收标准，层级不同。 */
          repeated
            ? null
            : h(
                'section',
                {
                  className: 'gtd-drawer__requirement',
                  'data-role': 'drawer-requirement-section',
                  style: {
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--dsw-alias-border-l2)',
                  },
                },
                h(
                  'h3',
                  {
                    'data-role': 'drawer-requirement-heading',
                    style: { margin: '0 0 4px', fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
                  },
                  t('drawerRequirementLabel'),
                ),
                h(
                  'p',
                  {
                    'data-role': 'drawer-requirement',
                    style: {
                      margin: 0,
                      fontSize: '12px',
                      lineHeight: '18px',
                      whiteSpace: 'pre-wrap',
                      color:
                        requirementText === null
                          ? 'var(--dsw-alias-label-caption)'
                          : 'var(--dsw-alias-label-secondary)',
                    },
                  },
                  requirementText === null ? t('drawerRequirementUnset') : requirementText,
                ),
                requirementSource === null
                  ? null
                  : h(
                      'span',
                      {
                        'data-role': 'drawer-requirement-source',
                        style: { fontSize: '11px', color: 'var(--dsw-alias-label-caption)' },
                      },
                      fillTemplate(t('focusRequirementFrom'), { source: requirementSource }),
                    ),
              ),
          /* v2:focus end */
          /* gtd:06 markdown 侧与滴答侧分区呈现，不混作一段 */
          h(DrawerRecord, { record, t }),
          /* gtd:06 end */
        ),
      );
    }
    /* gtd:05 end */

    /* v2:shell 面板外壳与视图（GitHub issue #5「04 · 面板外壳拆分」）：外壳管横切的事，视图只画 */
    /**
     * 视图模式的取值。
     *
     * `focus` 是 v2 的焦点引导器（**默认**视图），`canvas` 是 v1 的六箱画布。
     * 焦点视图自己带一个下钻入口，进去就是六箱画布原样——两个入口通向同一张画布。
     */
    const VIEW_MODE = { CANVAS: 'canvas', FOCUS: 'focus' };

    /** 默认画哪个视图。v2 起默认是焦点引导器（issue #1「工作台 v2」）。 */
    const DEFAULT_VIEW_MODE = VIEW_MODE.FOCUS;

    /**
     * 取一句文案：宿主词表里有就用词表里的，没有就退回这里的默认写法。
     *
     * 这一层新增的文案（视图切换、焦点视图占位）还没登记进宿主词表——
     * 词表在 `app/locale/*.json`，登记它要改那个文件，不在本票的文件范围里。
     * 所以先给一个能读的默认写法；等词表登记了，同一个键会自动切到词表的说法。
     * @param {(key: string) => string} t - 翻译函数。
     * @param {string} key - 词表键。
     * @param {string} fallback - 词表里没有时的默认写法。
     * @returns {string} 文案。
     */
    function textOf(t, key, fallback) {
      const value = t(key);
      return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
    }

    /**
     * 六箱画布视图：v1 的版面原样搬过来。
     *
     * **不套任何 DOM 元素**（用 Fragment 返回）：画布这一段的 DOM 层级与拆分前完全一致，
     * 既有选择器（`[data-role="main-push"]`／`[data-role="board"]`／`[data-role="sunk"]`）一条都不用改。
     * @param {object} props - props：`snapshot`、`t`、`motions`、`onOpenNote`、`onReload`。
     * @returns {object} React 元素。
     */
    function CanvasView(props) {
      const t = props.t;
      const snapshot = props.snapshot;
      return h(
        React.Fragment,
        null,
        h(MainPushStrip, {
          mainPush: snapshot !== null && typeof snapshot === 'object' ? snapshot.mainPush : [],
          t,
          onOpen: props.onOpenNote,
        }),
        h(WorkbenchBoard, {
          snapshot,
          t,
          motions: props.motions,
          /* v2:project 点卡脚的项目指针进来时，项目箱是那个要看清的纸箱。 */
          focusContainer: props.focusContainer,
        }),
        h(SunkArea, {
          sunk: snapshot !== null && typeof snapshot === 'object' ? snapshot.sunk : null,
          t,
          motions: props.motions,
        }),
      );
    }

    /**
     * 视图切换：两个按钮，明说现在画的是哪一个视图。
     *
     * 状态住在外壳里（`viewMode`），这里只把状态变成两个可点的控件。
     * @param {object} props - props：`t`、`mode`（当前视图）、`onChange`（切视图）。
     * @returns {object} React 元素。
     */
    function ViewSwitcher(props) {
      const t = props.t;
      const mode = props.mode === VIEW_MODE.FOCUS ? VIEW_MODE.FOCUS : VIEW_MODE.CANVAS;
      const button = (key, label) =>
        h(
          'button',
          {
            type: 'button',
            'data-role': `view-switch-${key}`,
            'data-active': mode === key ? 'true' : 'false',
            onClick: () => props.onChange(key),
            style: {
              padding: '2px 10px',
              border: '1px solid ' + (mode === key ? 'var(--dsw-alias-border-l3)' : 'transparent'),
              borderRadius: 'var(--dsw-radius-md)',
              background: mode === key ? 'var(--dsw-alias-bg-module-platform)' : 'transparent',
              color: mode === key ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
              font: 'inherit',
              fontSize: '12px',
              lineHeight: '19px',
              cursor: 'pointer',
            },
          },
          label,
        );
      return h(
        'div',
        { 'data-role': 'view-switch', 'data-view': mode, style: { display: 'flex', gap: '4px' } },
        button(VIEW_MODE.CANVAS, textOf(t, 'viewCanvasLabel', '六箱画布')),
        button(VIEW_MODE.FOCUS, textOf(t, 'viewFocusLabel', '焦点视图')),
      );
    }
    /* v2:shell end */

    /* v2:focus 焦点引导器（GitHub issue #6「05 · 焦点只读上线」的 Client 侧）
     *
     * 四层结构照 `prototype/index.html`（工单 04 的一次性原型，用户已过观感门禁）：
     *   ① 顶部常驻：今日日清 + 今日剩余可排时间 + 深度名额；
     *   ② 行动卡（主位）：工作内容、完成时限、完成要求、预计耗时，外加一句容量提示；
     *   ③「接下来」窄条队列：只写标题与时限，点一条即换主卡；
     *   ④ 下钻层：点开就是 v1 的六箱画布原样，带一个「回到焦点」。
     *
     * **Client 只画不算**（ADR-0010）：资格、排序、容量、可排时间、主卡与队列的内容
     * 全部由 Host 算好随快照过界（`focus.card` / `focus.next` / `today.*` / `capacity.*`），
     * 这一层只负责把它们摆成原型那个样子。换主卡与下钻都是**纯视图状态**，不写任何数据。
     */

    /**
     * 快照缺失时的兜底对象（模块级常量，身份恒定）。
     */
    const EMPTY_SNAPSHOT = {};

    /**
     * 取一个分钟数：只认数字，负数按 0 算（界面上不显示负的剩余时间）。
     * @param {unknown} value - 候选值。
     * @returns {number} 分钟数；不是数字时为 0。
     */
    function minutesOf(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
      return Math.max(0, Math.floor(value));
    }

    /**
     * 把模板里的占位符换成取值（词表里的句子带 `{minutes}` 这样的占位）。
     * @param {string} template - 模板。
     * @param {Record<string, string | number>} values - 占位符取值。
     * @returns {string} 填好的句子。
     */
    function fillTemplate(template, values) {
      let text = String(template);
      for (const key of Object.keys(values)) {
        text = text.split(`{${key}}`).join(String(values[key]));
      }
      return text;
    }

    /**
     * 顶部常驻：今日日清状态、今日剩余可排时间、深度名额。
     *
     * 三个数一直亮在背景上，但不抢主位（issue #1 第一层）。用户已拍板「保持原型里的分量」，
     * 所以字号与对比都照原型：标签 11px、值 19px 粗体、等宽数字。
     * @param {object} props - props：`today`、`capacity`、`t`。
     * @returns {object} React 元素。
     */
    function FocusTopBar(props) {
      const t = props.t;
      const today = props.today !== null && typeof props.today === 'object' ? props.today : {};
      const capacity = props.capacity !== null && typeof props.capacity === 'object' ? props.capacity : {};
      const daily = Array.isArray(today.daily) ? today.daily : [];
      // 「几笔未还」按 Host 给的 state 数（`未还清` 的那些）——Client 不自己推。
      const open = daily.filter(
        (row) => row !== null && typeof row === 'object' && row.state === '未还清',
      ).length;
      const remaining = minutesOf(today.remainingMinutes);
      const quotaTotal =
        typeof capacity.deepQuota === 'number' && Number.isFinite(capacity.deepQuota)
          ? capacity.deepQuota
          : 1;
      const quotaUsed = today.deepQuotaUsed === true ? 1 : 0;

      /**
       * 一个数位。
       * @param {string} key - 数位键。
       * @param {string} label - 标签文案。
       * @param {string | number} value - 主数值。
       * @param {string | null} unit - 单位（没有单位就是 null）。
       * @param {object} extra - 数值上的额外标记（给测试与眼睛看真值）。
       * @param {boolean} first - 是不是第一个（第一个不画左分隔线）。
       * @returns {object} React 元素。
       */
      const stat = (key, label, value, unit, extra, first) =>
        h(
          'div',
          {
            className: 'gtd-focus-top__stat',
            'data-role': 'focus-stat',
            'data-stat': key,
            style: {
              flex: '1 1 0',
              minWidth: 0,
              padding: first ? '0 10px 0 0' : '0 10px',
              borderLeft: first ? 'none' : '1px solid var(--dsw-alias-border-l2)',
            },
          },
          h(
            'span',
            {
              'data-role': 'focus-stat-label',
              style: {
                display: 'block',
                fontSize: '11px',
                lineHeight: '15px',
                color: 'var(--dsw-alias-label-caption)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            },
            label,
          ),
          h(
            'span',
            {
              className: 'gtd-focus-top__value',
              'data-role': 'focus-stat-value',
              'data-stat': key,
              ...extra,
              style: {
                display: 'block',
                marginTop: '1px',
                fontSize: '19px',
                lineHeight: '24px',
                fontWeight: 650,
                color: 'var(--dsw-alias-label-primary)',
                fontVariantNumeric: 'tabular-nums',
              },
            },
            value,
            unit === null
              ? null
              : h(
                  'small',
                  {
                    style: {
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--dsw-alias-label-caption)',
                      marginLeft: '2px',
                    },
                  },
                  unit,
                ),
          ),
        );

      return h(
        'header',
        {
          className: 'gtd-focus-top',
          'data-role': 'focus-top',
          style: {
            display: 'flex',
            alignItems: 'stretch',
            gap: 0,
            padding: '12px 16px 10px',
            borderBottom: '1px solid var(--dsw-alias-border-l2)',
            background: 'var(--dsw-alias-bg-module-platform)',
          },
        },
        stat(
          'daily',
          t('focusDailyLabel'),
          open,
          `/${daily.length} ${t('focusDailyUndone')}`,
          { 'data-open': String(open), 'data-total': String(daily.length) },
          true,
        ),
        stat(
          'remaining',
          t('focusRemainingLabel'),
          remaining,
          t('focusMinutesUnit'),
          { 'data-minutes': String(remaining) },
          false,
        ),
        stat(
          'deep-quota',
          t('focusQuotaLabel'),
          `${quotaUsed}/${quotaTotal}`,
          null,
          { 'data-used': String(quotaUsed), 'data-total': String(quotaTotal) },
          false,
        ),
      );
    }

    /**
     * 提醒位：等待清单里「到期没回」的那些。
     *
     * 它**不占主卡**（ADR-0010 第三条）：等待清单永远不占主位，只在这里冒一声。
     * @param {object} props - props：`reminders`、`t`。
     * @returns {object} React 元素或 null。
     */
    function FocusReminders(props) {
      const t = props.t;
      const reminders = Array.isArray(props.reminders) ? props.reminders : [];
      if (reminders.length === 0) return null;
      return h(
        'section',
        {
          className: 'gtd-focus-reminders',
          'data-role': 'focus-reminders',
          'data-count': String(reminders.length),
          style: {
            padding: '10px 16px',
            borderBottom: '1px solid var(--dsw-alias-border-l2)',
            background: 'var(--dsw-alias-bg-module-platform)',
          },
        },
        h(
          'h3',
          {
            'data-role': 'focus-reminders-heading',
            style: {
              margin: '0 0 6px',
              fontSize: '11px',
              lineHeight: '16px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'var(--dsw-alias-label-caption)',
            },
          },
          t('focusRemindersHeading'),
        ),
        h(
          'ul',
          {
            style: {
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            },
          },
          reminders.map((item) =>
            h(
              'li',
              {
                key: item.id,
                'data-role': 'focus-reminder',
                'data-note-ref': item.id,
                style: { display: 'flex', alignItems: 'baseline', gap: '8px' },
              },
              h(
                'span',
                {
                  'data-role': 'focus-reminder-title',
                  style: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-primary)' },
                },
                item.title,
              ),
              typeof item.replyDue === 'string' && item.replyDue.length > 0
                ? h(
                    'span',
                    {
                      'data-role': 'focus-reminder-due',
                      style: {
                        fontSize: '11px',
                        lineHeight: '16px',
                        color: 'var(--dsw-alias-label-caption)',
                        fontVariantNumeric: 'tabular-nums',
                      },
                    },
                    item.replyDue,
                  )
                : null,
            ),
          ),
        ),
      );
    }

    /**
     * 行动卡（主位）：一条动作在工作台上的呈现。
     *
     * 卡上写的是那条动作自己的内容（GLOSSARY「行动卡」），**不新造一个卡对象**。
     * 四样必备里缺哪一样，就**少一行**——整卡永远在，不能因为字段缺了就什么都不显示。
     * @param {object} props - props：`card`、`t`、`onOpenNote`。
     * @returns {object} React 元素。
     */
    function FocusActionCard(props) {
      const t = props.t;
      const card = props.card;
      if (card === null || typeof card !== 'object') {
        return h(
          'p',
          {
            'data-role': 'focus-card-empty',
            style: { margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-caption)' },
          },
          t('focusCardEmpty'),
        );
      }
      const requirement = card.requirement !== null && typeof card.requirement === 'object' ? card.requirement : {};
      const requirementText =
        typeof requirement.text === 'string' && requirement.text.length > 0 ? requirement.text : null;
      const requirementSource =
        typeof requirement.source === 'string' && requirement.source.length > 0 ? requirement.source : null;
      // 未估算是 `null`，不是 0 分钟（README「预计耗时」）。
      const estimate =
        typeof card.estimateMinutes === 'number' && Number.isFinite(card.estimateMinutes)
          ? card.estimateMinutes
          : null;
      const hint = card.capacityHint !== null && typeof card.capacityHint === 'object' ? card.capacityHint : null;
      /* v2:project 卡脚的项目指针：Host 侧算好（靠 markdown 记录编号与项目箱箱签对上）。
         没有就是 null——**推不出就不画卡脚**，Client 不自己猜。 */
      const project =
        card.project !== null && typeof card.project === 'object' && typeof card.project.name === 'string'
          ? card.project
          : null;
      const band = typeof card.timeBand === 'string' && card.timeBand.length > 0 ? card.timeBand : null;
      const dueText = typeof card.dueLocal === 'string' && card.dueLocal.length > 0 ? card.dueLocal : '—';
      /* v2:two-minute 两分钟卡（issue #11）：Host 说了算这张卡是不是两分钟卡
         （收集箱里「两分钟就能做完」的捕获）。Client 侧**不重算资格**，
         只按这个标记画一句引导——短，且不与正常动作抢眼。 */
      const twoMinute = card.twoMinute === true;

      /**
       * 卡上的一行（标签 + 值）。
       * @param {string} key - 行键（也当 data-role 用）。
       * @param {string} label - 标签文案。
       * @param {object} value - 值（React 节点）。
       * @param {object} [extra] - 值上的额外标记（给测试与眼睛看真值）。
       * @returns {object} React 元素。
       */
      const fact = (key, label, value, extra) =>
        h(
          'div',
          {
            'data-role': 'focus-card-fact',
            'data-fact': key,
            style: {
              display: 'grid',
              gridTemplateColumns: '64px 1fr',
              gap: '10px',
              alignItems: 'baseline',
            },
          },
          h(
            'span',
            {
              'data-role': 'focus-card-fact-label',
              style: { fontSize: '11px', lineHeight: '17px', color: 'var(--dsw-alias-label-caption)' },
            },
            label,
          ),
          h(
            'span',
            {
              'data-role': `focus-card-${key}`,
              ...extra,
              style: { fontSize: '13.5px', lineHeight: '20px', color: 'var(--dsw-alias-label-primary)' },
            },
            value,
          ),
        );

      /** 容量提示：装不装得下由 Host 说了算（`capacityHint.fits`），这里只把它画出来。 */
      const capacityBlock =
        hint === null
          ? null
          : (() => {
              const fits = hint.fits === true ? true : hint.fits === false ? false : null;
              const remaining = minutesOf(hint.remainingMinutes);
              const state =
                fits === true
                  ? t('focusCapacityFits')
                  : fits === false
                    ? t('focusCapacityNoFit')
                    : t('focusCapacityUnknown');
              const note =
                estimate === null
                  ? fillTemplate(t('focusCapacityNoteUnknown'), { minutes: remaining })
                  : fillTemplate(
                      fits === false ? t('focusCapacityNoteNoFits') : t('focusCapacityNoteFits'),
                      { minutes: remaining, estimate },
                    );
              const ratio =
                estimate === null || remaining <= 0
                  ? null
                  : Math.max(4, Math.min(100, Math.round((estimate / remaining) * 100)));
              return h(
                'div',
                {
                  className: 'gtd-focus-card__capacity',
                  'data-role': 'focus-card-capacity',
                  'data-state': fits === true ? 'fits' : fits === false ? 'no' : 'unknown',
                  style: {
                    marginTop: '14px',
                    padding: '10px 12px',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    borderRadius: 'var(--dsw-radius-md)',
                    background: 'var(--dsw-alias-bg-module-platform)',
                  },
                },
                h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '8px',
                      fontSize: '13px',
                      lineHeight: '19px',
                      color: 'var(--dsw-alias-label-primary)',
                    },
                  },
                  h(
                    'span',
                    {
                      'data-role': 'focus-card-capacity-state',
                      style: { fontWeight: 650 },
                    },
                    state,
                  ),
                  h(
                    'span',
                    {
                      'data-role': 'focus-card-capacity-note',
                      style: { fontSize: '11px', color: 'var(--dsw-alias-label-caption)' },
                    },
                    note,
                  ),
                ),
                ratio === null
                  ? null
                  : h(
                      'div',
                      {
                        'data-role': 'focus-card-capacity-meter',
                        style: {
                          position: 'relative',
                          height: '6px',
                          marginTop: '8px',
                          borderRadius: '999px',
                          background: 'var(--dsw-alias-border-l2)',
                          overflow: 'hidden',
                        },
                      },
                      h('span', {
                        'data-role': 'focus-card-capacity-fill',
                        style: {
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: `${ratio}%`,
                          borderRadius: '999px',
                          background: 'var(--dsw-alias-label-tertiary)',
                        },
                      }),
                    ),
              );
            })();

      /* v2:write 写口（issue #9/#10）：完成 = 滴答勾选，改期 = 写新的完成时限。
         写口的状态（等待／失败／写成了但刷新失败）住在外壳里，这里只把它画出来。 */
      const write = props.write !== null && typeof props.write === 'object' ? props.write : null;
      const mine = write !== null && write.taskId === card.id ? write : null;
      const pending = mine !== null && mine.status === 'pending';
      /* 两个写口各自显示自己的等待态；但同一次写只允许一个在飞——连点不许写两次。 */
      const isRescheduleWrite = mine !== null && mine.action === 'reschedule';
      const pendingComplete = pending && !isRescheduleWrite;
      const pendingReschedule = pending && isRescheduleWrite;

      /* v2:write 改期：日期编辑器开合是**视图内状态**（点开、取消都不写任何东西）。 */
      const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
      const [needDate, setNeedDate] = React.useState(false);
      const dateInputRef = React.useRef(null);
      /* 初值：这条动作当前的完成时限（粒度到天）。没有期限就是空的——不替用户猜一个日子。 */
      const initialDueDate =
        typeof card.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(card.dueDate) ? card.dueDate : '';
      /* 日期输入是**不受 React 管**的：值在提交那一刻从 DOM 上读，
         所以它永远是 `YYYY-MM-DD`（`<input type="date">` 的值形状），不会带上时刻。 */
      /* 写有结果了就收摊：改期写成了（哪怕刷新没成）就把编辑器收起来，
         别让用户以为还没改；写失败则留着编辑器与那个日子，好让他改一改再试。
         只认「改期」那一次写：完成写口的结果不该动改期编辑器。 */
      const lastWriteRef = React.useRef(null);
      React.useEffect(() => {
        const previous = lastWriteRef.current;
        lastWriteRef.current = mine;
        if (previous === null || previous.action !== 'reschedule' || previous.status !== 'pending') return;
        if (mine === null || mine.status === 'refresh-failed') {
          setRescheduleOpen(false);
          setNeedDate(false);
        }
      }, [mine]);

      /**
       * 从卡上取这条动作的 id（焦点视图用 `data-note-ref` 指回那条动作）。
       * @param {object} event - 事件。
       * @returns {string | null} 动作 id；取不到时为 null。
       */
      const taskIdOf = (event) => {
        const host =
          event.currentTarget !== null && typeof event.currentTarget.closest === 'function'
            ? event.currentTarget.closest('[data-role="focus-card"]')
            : null;
        const taskId = host === null ? null : host.getAttribute('data-note-ref');
        return typeof taskId === 'string' && taskId.length > 0 ? taskId : null;
      };

      /**
       * 提交改期：读日期输入上的值，写成「新的完成时限」。
       *
       * 值在**提交那一刻**从 DOM 上读：`<input type="date">` 的值形状就是 `YYYY-MM-DD`，
       * 带时刻的字符串它根本收不下——所以这一条路上发不出 Host 会当场拒掉的参数。
       * @param {object} event - 事件。
       * @returns {void} 无。
       */
      const submitReschedule = (event) => {
        const input = dateInputRef.current;
        const dueDate = input === null ? '' : String(input.value ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
          /* 没有日子（或日子不成立）就不写：先让人挑一个完成时限。 */
          setNeedDate(true);
          return;
        }
        setNeedDate(false);
        const taskId = taskIdOf(event);
        if (taskId === null) return;
        if (typeof props.onReschedule === 'function') props.onReschedule(taskId, dueDate);
      };

      return h(
        'article',
        {
          className: 'gtd-focus-card',
          'data-role': 'focus-card',
          'data-note-ref': card.id,
          'data-band': band === null ? '' : band,
          /* 这张主卡是不是两分钟卡：一眼能看出来，测试也能断言。 */
          'data-state': twoMinute ? 'two-minute' : 'normal',
          style: {
            position: 'relative',
            padding: '20px 18px 16px',
            border: '1px solid var(--dsw-alias-border-l3)',
            borderRadius: 'var(--dsw-radius-xl)',
            background: 'var(--dsw-alias-bg-base)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.10)',
            overflow: 'hidden',
          },
        },
        /* v2:focus 主卡「弱化纸感」：没有折角、也没有纸纹，只留纸色调与一层浅影。
           下钻层里的 v1 纸箱与便贴照旧保留原来的纸感（`gtd-box__fold` 与 `.gtd-box::after`）。 */
        band === null
          ? null
          : h(
              'span',
              {
                className: 'gtd-focus-card__band',
                'data-role': 'focus-card-band',
                'data-band': band,
                /* 时间档色是 artwork：底是固定色相，字就得是固定的浅色——
                   跟着主题翻色反而在深蓝／深绿底上读不清（与便贴上的时间档标签同一套做法）。 */
                style: {
                  display: 'inline-block',
                  padding: '1px 7px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  lineHeight: '17px',
                  fontWeight: 600,
                  color: '#ffffff',
                  background: BAND_COLORS[band] ?? 'var(--dsw-alias-label-tertiary)',
                },
              },
              band,
            ),
        /* v2:two-minute 两分钟卡的引导：占时间档角标那一格，**不加一行**。
           视觉上与正常动作有区别（描边的浅色片，不是实心色块），但不喧宾夺主。 */
        twoMinute
          ? h(
              'span',
              {
                className: 'gtd-focus-card__two-minute',
                'data-role': 'focus-card-two-minute',
                'data-state': 'two-minute',
                style: {
                  display: 'inline-block',
                  marginLeft: band === null ? '0' : '8px',
                  padding: '2px 10px',
                  border: '1px solid var(--dsw-alias-border-l2)',
                  borderRadius: '999px',
                  background: 'transparent',
                  fontSize: '12px',
                  lineHeight: '18px',
                  fontWeight: 600,
                  color: 'var(--dsw-alias-label-secondary)',
                },
              },
              t('focusCardTwoMinute'),
            )
          : null,
        h(
          'h2',
          {
            className: 'gtd-focus-card__title',
            'data-role': 'focus-card-title',
            'data-fact': 'work',
            style: {
              margin: '10px 0 0',
              fontSize: '23px',
              lineHeight: '1.35',
              fontWeight: 700,
              letterSpacing: '0.01em',
            },
          },
          h(
            'button',
            {
              type: 'button',
              'data-role': 'focus-card-open',
              /* 这一段大字就是「工作内容」（四要素之一）：说给读屏的人听。 */
              'aria-label': `${t('focusCardWorkLabel')} ${card.title}`,
              onClick: () => {
                if (typeof props.onOpenNote === 'function') props.onOpenNote(card);
              },
              style: {
                display: 'block',
                width: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: 'var(--dsw-alias-label-primary)',
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              },
            },
            card.title,
          ),
        ),
        h(
          'dl',
          {
            'data-role': 'focus-card-facts',
            style: { margin: '14px 0 0', display: 'grid', gap: '10px' },
          },
          fact(
            'due',
            t('focusCardDueLabel'),
            h(
              React.Fragment,
              null,
              dueText,
              card.overdue === true
                ? h(
                    'span',
                    {
                      'data-role': 'focus-card-overdue',
                      style: { marginLeft: '6px', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' },
                    },
                    t('focusCardOverdue'),
                  )
                : null,
            ),
          ),
          /* 完成要求缺失 → 这一行不画；整卡不受影响。 */
          requirementText === null
            ? null
            : fact(
                'requirement',
                t('focusCardRequirementLabel'),
                h(
                  React.Fragment,
                  null,
                  requirementText,
                  requirementSource === null
                    ? null
                    : h(
                        'span',
                        {
                          'data-role': 'focus-card-requirement-source',
                          style: { marginLeft: '6px', fontSize: '11px', color: 'var(--dsw-alias-label-caption)' },
                        },
                        /* 来源标记说成「来自记录页」——光秃秃一个「记录页」看不出是从哪来的。 */
                        fillTemplate(t('focusRequirementFrom'), { source: requirementSource }),
                      ),
                ),
              ),
          fact(
            'estimate',
            t('focusCardEstimateLabel'),
            estimate === null
              ? h('span', { 'data-role': 'focus-card-estimate-unset' }, t('focusEstimateUnset'))
              : `${estimate} ${t('focusMinutesUnit')}`,
            /* 估时取自滴答的哪一个字段：机器可读，不往界面上摆术语。 */
            { 'data-source': typeof card.estimateSource === 'string' ? card.estimateSource : '' },
          ),
        ),
        capacityBlock,
        /* v2:write 写口那一行：事实行之下、卡脚之上。按钮克制——不加新的说明文字块。
           三个控件**位置分开**：完成（实心）与改期（描边）是两个写口，
           跳过是零写入的弱化项，排在分隔线之后——不与写口合并成一个「推迟」。 */
        h(
          'div',
          {
            className: 'gtd-focus-card__writes',
            'data-role': 'focus-card-actions',
            style: {
              marginTop: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            },
          },
          /* 完成：实心主按钮。等待期间按钮不许再点：Host 一次完成要跑十几次 CLI 调用。 */
          h(
            'button',
            {
              type: 'button',
              'data-role': 'focus-card-complete',
              'data-state': pendingComplete ? 'pending' : 'idle',
              disabled: pending,
              'aria-busy': pendingComplete ? 'true' : 'false',
              onClick: (event) => {
                /* 目标 id 从卡上的 `data-note-ref` 取（焦点视图不占用 `data-note-id`）。 */
                const taskId = taskIdOf(event);
                if (taskId === null) return;
                if (typeof props.onComplete === 'function') props.onComplete(taskId);
              },
              style: {
                padding: '5px 14px',
                border: '1px solid transparent',
                borderRadius: 'var(--dsw-radius-md)',
                background: 'var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary))',
                color: 'var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base))',
                font: 'inherit',
                fontSize: '13px',
                lineHeight: '20px',
                fontWeight: 600,
                cursor: pending ? 'progress' : 'pointer',
                opacity: pending ? 0.7 : 1,
              },
            },
            pendingComplete ? t('focusCompletePending') : t('focusCompleteLabel'),
          ),
          /* 改期：描边次按钮，与完成分开摆——改期写的是新的完成时限，不是完成。 */
          h(
            'button',
            {
              type: 'button',
              'data-role': 'focus-card-reschedule',
              'data-state': pendingReschedule ? 'pending' : 'idle',
              'aria-expanded': rescheduleOpen ? 'true' : 'false',
              disabled: pending,
              'aria-busy': pendingReschedule ? 'true' : 'false',
              onClick: (event) => {
                const taskId = taskIdOf(event);
                if (taskId === null) return;
                setNeedDate(false);
                setRescheduleOpen((open) => !open);
              },
              style: {
                padding: '5px 14px',
                border: '1px solid var(--dsw-alias-border-l3)',
                borderRadius: 'var(--dsw-radius-md)',
                background: 'var(--dsw-alias-bg-module-platform)',
                color: 'var(--dsw-alias-label-secondary)',
                font: 'inherit',
                fontSize: '13px',
                lineHeight: '20px',
                cursor: pending ? 'progress' : 'pointer',
                opacity: pending ? 0.7 : 1,
              },
            },
            pendingReschedule ? t('focusReschedulePending') : t('focusRescheduleLabel'),
          ),
          /* 分隔线：把零写入的那一项隔到写口的另一边去。 */
          h('span', {
            'data-role': 'focus-card-actions-sep',
            'aria-hidden': 'true',
            style: {
              flex: '1 1 auto',
              minWidth: '16px',
              borderTop: '1px dashed var(--dsw-alias-border-l2)',
            },
          }),
          /* 跳过：零写入。点了不发请求、不写任何东西——只是本次会话里不再看见它。 */
          h(
            'button',
            {
              type: 'button',
              'data-role': 'focus-card-skip',
              'data-state': 'idle',
              onClick: (event) => {
                const taskId = taskIdOf(event);
                if (taskId === null) return;
                if (typeof props.onSkip === 'function') props.onSkip(taskId);
              },
              style: {
                padding: '5px 2px',
                border: 'none',
                background: 'transparent',
                color: 'var(--dsw-alias-label-tertiary)',
                font: 'inherit',
                fontSize: '12.5px',
                lineHeight: '19px',
                cursor: 'pointer',
              },
            },
            t('focusSkipLabel'),
          ),
          h(
            'span',
            {
              'data-role': 'focus-card-skip-note',
              style: { fontSize: '10.5px', lineHeight: '16px', color: 'var(--dsw-alias-label-caption)' },
            },
            t('focusSkipNote'),
          ),
        ),
        /* v2:write 写口的话：失败原因／写成了但刷新失败——说清楚，不让人猜。 */
        mine !== null && mine.status !== 'pending'
          ? h(
              'div',
              {
                'data-role': 'focus-card-write-status',
                style: {
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                },
              },
              mine.status === 'failed'
                ? h(
                    'p',
                    {
                      'data-role': isRescheduleWrite ? 'focus-reschedule-error' : 'focus-complete-error',
                      'data-code': typeof mine.code === 'string' ? mine.code : '',
                      style: {
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: '18px',
                        color: 'var(--dsw-alias-label-primary)',
                      },
                    },
                    typeof mine.message === 'string' ? mine.message : '',
                    typeof mine.code === 'string' && mine.code.length > 0
                      ? h(
                          'span',
                          {
                            'data-role': isRescheduleWrite ? 'focus-reschedule-error-code' : 'focus-complete-error-code',
                            style: { marginLeft: '6px', fontSize: '11px', color: 'var(--dsw-alias-label-caption)' },
                          },
                          `（${mine.code}）`,
                        )
                      : null,
                  )
                : null,
              mine.status === 'refresh-failed'
                ? h(
                    'p',
                    {
                      'data-role': isRescheduleWrite ? 'focus-reschedule-refresh-failed' : 'focus-complete-refresh-failed',
                      style: {
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: '18px',
                        color: 'var(--dsw-alias-label-primary)',
                      },
                    },
                    /* 写成功了，只是刷新没成——不能说成写失败（用户会以为没改上而重复点）。 */
                    isRescheduleWrite ? t('focusRescheduleRefreshFailed') : t('focusCompleteRefreshFailed'),
                    typeof mine.message === 'string' && mine.message.length > 0
                      ? h(
                          'span',
                          {
                            'data-role': isRescheduleWrite ? 'focus-reschedule-refresh-detail' : 'focus-complete-refresh-detail',
                            style: { marginLeft: '6px', fontSize: '11px', color: 'var(--dsw-alias-label-caption)' },
                          },
                          `：${mine.message}`,
                        )
                      : null,
                  )
                : null,
              mine.status === 'refresh-failed'
                ? h(
                    'button',
                    {
                      type: 'button',
                      'data-role': isRescheduleWrite ? 'focus-reschedule-refresh' : 'focus-complete-refresh',
                      onClick: () => {
                        if (typeof props.onRefresh === 'function') props.onRefresh();
                      },
                      style: {
                        padding: '2px 10px',
                        border: '1px solid var(--dsw-alias-border-l3)',
                        borderRadius: 'var(--dsw-radius-md)',
                        background: 'var(--dsw-alias-bg-module-platform)',
                        color: 'var(--dsw-alias-label-secondary)',
                        font: 'inherit',
                        fontSize: '12px',
                        lineHeight: '19px',
                        cursor: 'pointer',
                      },
                    },
                    t('refresh'),
                  )
                : null,
            )
          : null,
        /* v2:write 改期编辑器：点开才在。开合是**视图内状态**——取消不写任何东西。 */
        rescheduleOpen
          ? h(
              'div',
              {
                'data-role': 'focus-card-reschedule-editor',
                style: {
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                },
              },
              h(
                'span',
                {
                  'data-role': 'focus-card-reschedule-date-label',
                  style: { fontSize: '12px', lineHeight: '19px', color: 'var(--dsw-alias-label-secondary)' },
                },
                t('focusRescheduleDateLabel'),
              ),
              h('input', {
                type: 'date',
                'data-role': 'focus-card-reschedule-date',
                'aria-label': t('focusRescheduleDateLabel'),
                ref: dateInputRef,
                /* 默认值是这条动作当前的完成时限；没有期限就是空的——不替用户猜一个日子。 */
                defaultValue: initialDueDate,
                disabled: pendingReschedule,
                style: {
                  font: 'inherit',
                  fontSize: '13px',
                  lineHeight: '19px',
                  padding: '3px 6px',
                  borderRadius: 'var(--dsw-radius-sm)',
                  border: '1px solid var(--dsw-alias-border-l3)',
                  background: 'var(--dsw-alias-bg-base)',
                  color: 'var(--dsw-alias-label-primary)',
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  'data-role': 'focus-card-reschedule-submit',
                  disabled: pendingReschedule,
                  onClick: submitReschedule,
                  style: {
                    padding: '4px 12px',
                    border: '1px solid var(--dsw-alias-border-l3)',
                    borderRadius: 'var(--dsw-radius-md)',
                    background: 'var(--dsw-alias-bg-module-platform)',
                    color: 'var(--dsw-alias-label-primary)',
                    font: 'inherit',
                    fontSize: '12.5px',
                    lineHeight: '19px',
                    fontWeight: 600,
                    cursor: pendingReschedule ? 'progress' : 'pointer',
                    opacity: pendingReschedule ? 0.7 : 1,
                  },
                },
                pendingReschedule ? t('focusReschedulePending') : t('focusRescheduleSubmit'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  'data-role': 'focus-card-reschedule-cancel',
                  onClick: () => {
                    setRescheduleOpen(false);
                    setNeedDate(false);
                  },
                  style: {
                    padding: '4px 8px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--dsw-alias-label-tertiary)',
                    font: 'inherit',
                    fontSize: '12.5px',
                    lineHeight: '19px',
                    cursor: 'pointer',
                  },
                },
                t('focusRescheduleCancel'),
              ),
              needDate
                ? h(
                    'p',
                    {
                      'data-role': 'focus-reschedule-need-date',
                      style: {
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: '18px',
                        color: 'var(--dsw-alias-label-primary)',
                      },
                    },
                    t('focusRescheduleNeedDate'),
                  )
                : null,
            )
          : null,
        /* v2:project 卡脚（规格故事 22–24）：这一件在哪条项目线上。
           **推不出项目就不画这一行**——缺就是缺，不编（Host 侧算好 `card.project`）。 */
        project === null
          ? null
          : h(
              'div',
              {
                className: 'gtd-focus-card__foot',
                'data-role': 'focus-card-foot',
                style: {
                  marginTop: '14px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--dsw-alias-border-l2)',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '8px',
                  flexWrap: 'wrap',
                },
              },
              h(
                'span',
                {
                  'data-role': 'focus-card-foot-label',
                  style: { fontSize: '11px', lineHeight: '16px', color: 'var(--dsw-alias-label-caption)' },
                },
                t('focusCardFootProjectLabel'),
              ),
              h(
                'span',
                {
                  'data-role': 'focus-card-foot-project',
                  'data-record': project.record,
                  style: { fontSize: '12.5px', lineHeight: '19px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
                },
                project.name,
              ),
              /* 「项目清单 →」：点它打开下钻层并把项目箱摆在那儿（故事 23）。 */
              h(
                'button',
                {
                  type: 'button',
                  'data-role': 'focus-card-foot-project-link',
                  onClick: () => {
                    if (typeof props.onOpenProject === 'function') props.onOpenProject(project);
                  },
                  style: {
                    marginLeft: 'auto',
                    padding: '0',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--dsw-alias-label-secondary)',
                    font: 'inherit',
                    fontSize: '12px',
                    lineHeight: '19px',
                    cursor: 'pointer',
                  },
                },
                t('focusCardFootProjectLink'),
              ),
            ),
      );
    }

    /**
     * 「接下来」窄条队列：只写标题与时限。
     *
     * 窄、密、安静。点一条就把它换成主卡——这是**纯视图状态**，不写任何数据。
     * @param {object} props - props：`items`、`t`、`onPick`。
     * @returns {object} React 元素。
     */
    function FocusNextQueue(props) {
      const t = props.t;
      const items = Array.isArray(props.items) ? props.items : [];
      return h(
        'section',
        {
          className: 'gtd-focus-next',
          'data-role': 'focus-next',
          'data-count': String(items.length),
          style: { display: 'flex', flexDirection: 'column', gap: '6px' },
        },
        h(
          'div',
          {
            'data-role': 'focus-next-head',
            style: {
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              fontSize: '11px',
              lineHeight: '16px',
              color: 'var(--dsw-alias-label-caption)',
            },
          },
          h('span', { 'data-role': 'focus-next-heading' }, t('focusNextHeading')),
          h(
            'span',
            { 'data-role': 'focus-next-count' },
            `${items.length} ${t('countUnit')} · ${t('focusNextHint')}`,
          ),
        ),
        items.length === 0
          ? h(
              'p',
              {
                'data-role': 'focus-next-empty',
                style: { margin: 0, fontSize: '12px', color: 'var(--dsw-alias-label-caption)' },
              },
              t('focusNextEmpty'),
            )
          : items.map((item, index) => {
              const band = typeof item.timeBand === 'string' && item.timeBand.length > 0 ? item.timeBand : null;
              const due = typeof item.dueLocal === 'string' && item.dueLocal.length > 0 ? item.dueLocal : '—';
              return h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  className: 'gtd-focus-next__item',
                  'data-role': 'focus-next-item',
                  'data-note-ref': item.id,
                  'data-band': band === null ? '' : band,
                  'data-order': String(index + 1),
                  title: `${item.title}｜${t('focusNextHint')}`,
                  onClick: () => props.onPick(item),
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '7px 10px',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    borderLeft: `4px solid ${band === null ? 'var(--dsw-alias-border-l3)' : BAND_COLORS[band]}`,
                    borderRadius: 'var(--dsw-radius-md)',
                    background: 'var(--dsw-alias-bg-module-platform)',
                    color: 'var(--dsw-alias-label-secondary)',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  },
                },
                h(
                  'span',
                  {
                    'data-role': 'focus-next-title',
                    style: {
                      flex: '1 1 auto',
                      minWidth: 0,
                      fontSize: '13px',
                      lineHeight: '19px',
                      color: 'var(--dsw-alias-label-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                  },
                  item.title,
                ),
                h(
                  'span',
                  {
                    'data-role': 'focus-next-due',
                    style: {
                      flex: '0 0 auto',
                      fontSize: '11px',
                      lineHeight: '16px',
                      color: 'var(--dsw-alias-label-caption)',
                      fontVariantNumeric: 'tabular-nums',
                    },
                  },
                  due,
                ),
              );
            }),
      );
    }

    /**
     * 下钻层：六箱全景，覆盖焦点区主位。
     *
     * 画布是 v1 的原样（纸箱、便贴、箱签、已沉底、规则角标全在），
     * 只是退到幕后——全景还在，只是不占主位。
     * @param {object} props - props：`open`、`snapshot`、`t`、`motions`、`onOpenNote`、`onClose`。
     * @returns {object} React 元素。
     */
    function FocusDrill(props) {
      const t = props.t;
      const open = props.open === true;
      return h(
        'section',
        {
          className: 'gtd-focus-drill',
          'data-role': 'focus-drill',
          'data-state': open ? 'open' : 'closed',
          hidden: !open,
          'aria-label': t('focusDrillTitle'),
          style: {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 5,
            display: open ? 'flex' : 'none',
            flexDirection: 'column',
            background: 'var(--dsw-alias-bg-base)',
            overflowY: 'auto',
          },
        },
        h(
          'header',
          {
            'data-role': 'focus-drill-head',
            style: {
              position: 'sticky',
              top: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--dsw-alias-border-l2)',
              background: 'var(--dsw-alias-bg-module-platform)',
            },
          },
          h(
            'button',
            {
              type: 'button',
              'data-role': 'focus-back',
              'data-context': 'drill',
              onClick: props.onClose,
              style: {
                padding: '4px 10px',
                border: '1px solid var(--dsw-alias-border-l3)',
                borderRadius: 'var(--dsw-radius-md)',
                background: 'var(--dsw-alias-bg-base)',
                color: 'var(--dsw-alias-label-secondary)',
                font: 'inherit',
                fontSize: '12px',
                lineHeight: '19px',
                cursor: 'pointer',
              },
            },
            `← ${t('focusBackLabel')}`,
          ),
          h(
            'h2',
            {
              'data-role': 'focus-drill-title',
              style: {
                margin: 0,
                fontSize: '14px',
                lineHeight: '20px',
                fontWeight: 600,
                color: 'var(--dsw-alias-label-primary)',
              },
            },
            t('focusDrillTitle'),
          ),
        ),
        h(
          'div',
          { 'data-role': 'focus-drill-body' },
          h(CanvasView, {
            snapshot: props.snapshot,
            t,
            motions: props.motions,
            onOpenNote: props.onOpenNote,
            /* v2:project 下钻层里要盯住的纸箱（点卡脚的项目指针 → 项目箱）。 */
            focusContainer: props.focusContainer,
          }),
        ),
      );
    }

    /**
     * 焦点视图（v2 的默认视图）：四层结构。
     *
     * ① 顶部常驻 → ② 行动卡（主位）→ ③「接下来」窄条 → ④ 下钻入口（进去是六箱画布）。
     * 换主卡与下钻都是**视图内状态**，不写任何数据（工作台是只读视图，ADR-0006）。
     * @param {object} props - props：`snapshot`、`t`、`motions`、`onOpenNote`、`onReload`。
     * @returns {object} React 元素。
     */
    function FocusView(props) {
      const t = props.t;
      /* 兜底对象是模块级的常量：每次渲染新建一个会让下面的复位 effect 反复触发。 */
      const snapshot =
        props.snapshot !== null && typeof props.snapshot === 'object' ? props.snapshot : EMPTY_SNAPSHOT;
      const focus =
        snapshot.focus !== null && typeof snapshot.focus === 'object' && !Array.isArray(snapshot.focus)
          ? snapshot.focus
          : null;
      const today = snapshot.today !== null && typeof snapshot.today === 'object' ? snapshot.today : {};
      const capacity =
        snapshot.capacity !== null && typeof snapshot.capacity === 'object' ? snapshot.capacity : {};

      /* 视图内状态：换过的主卡与队列、下钻开关。刷新换快照时一并复位。 */
      const [override, setOverride] = React.useState(null);
      const [drilled, setDrilled] = React.useState(false);
      /* v2:project 下钻层里要盯住哪个纸箱（点卡脚的项目指针 → 项目箱）。 */
      const [drillFocus, setDrillFocus] = React.useState(null);
      React.useEffect(() => {
        setOverride(null);
        setDrilled(false);
        setDrillFocus(null);
      }, [snapshot]);

      const baseCard = focus !== null && focus.card !== null && typeof focus.card === 'object' ? focus.card : null;
      const baseNext = focus !== null && Array.isArray(focus.next) ? focus.next : [];

      /* v2:write 跳过（issue #10）：本次会话里被跳过的那几条。
         它是**纯视图状态**——不写任何数据、不落任何本地存储，刷新页面就回来。 */
      const skipped = Array.isArray(props.skipped) ? props.skipped : [];
      /**
       * 这条是不是本次会话里被跳过了。
       * @param {string} id - 动作 id。
       * @returns {boolean} 被跳过时为 true。
       */
      const isSkipped = (id) => typeof id === 'string' && skipped.includes(id);

      /* 主卡与队列：跳过的那些从焦点里去掉；主卡被跳过就顺延到队列第一条。 */
      const overrideCard = override !== null ? override.card : null;
      const sourceQueue = override !== null ? override.queue : baseNext;
      const pool = sourceQueue.filter((entry) => !isSkipped(entry.id));
      const fallbackCard = override !== null ? null : baseCard;
      const wanted =
        overrideCard !== null && !isSkipped(overrideCard.id)
          ? overrideCard
          : fallbackCard !== null && !isSkipped(fallbackCard.id)
            ? fallbackCard
            : null;
      /* 原来就没有主卡时不该凭空造一张：只有「主卡被跳过」才顺延。 */
      const hadCard = overrideCard !== null || fallbackCard !== null;
      /* v2:project 窄条与主卡是**同一份形状**（Host 算好随快照过界）：
         换主卡时直接把窄条拿过来用，Client 不重造一遍（重造就会漂）。 */
      const card = wanted !== null ? wanted : hadCard && pool.length > 0 ? pool[0] : null;
      const queue = card !== null && pool[0] !== undefined && pool[0].id === card.id ? pool.slice(1) : pool;

      /**
       * 点一条窄条：把它换成主卡，原来的主卡回到队列最前面。
       * @param {object} item - 被点的那条窄条。
       */
      const pickFromQueue = (item) => {
        const rest = queue.filter((entry) => entry.id !== item.id);
        setOverride({
          card: item,
          queue: card === null ? rest : [card, ...rest],
        });
      };

      /* v2:project 点卡脚的项目指针 → 打开下钻层，并把项目箱摆在那儿（故事 23）。
         只是视图内状态：不写任何数据。 */
      const openProject = () => {
        setDrillFocus('project');
        setDrilled(true);
      };

      const asOfText =
        typeof capacity.asOf === 'string' && capacity.asOf.length > 0
          ? `${t('focusCapacityAsOf')} ${capacity.asOf}`
          : t('focusCapacityAsOfUnset');
      const asOfSet = typeof capacity.asOf === 'string' && capacity.asOf.length > 0;
      /* 落在可用窗口之外的日清成本：它不占可排时间，但仍然要还——这件事得让人看见。 */
      const outsideMinutes = minutesOf(capacity.dailyMinutesOutsideWindow);
      const outsideText =
        outsideMinutes > 0
          ? fillTemplate(t('focusCapacityOutsideWindow'), { minutes: outsideMinutes })
          : null;

      return h(
        'div',
        {
          className: 'gtd-focus-view',
          'data-role': 'focus-view',
          'data-state': focus === null ? 'pending' : 'ready',
          style: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
            background: 'var(--dsw-alias-bg-base)',
          },
        },
        /* ① 顶部常驻（与焦点契约无关，快照老到没有 focus 也照样显示） */
        h(FocusTopBar, { today, capacity, t }),
        h(
          'div',
          {
            'data-role': 'focus-capacity-bar',
            style: {
              padding: '10px 16px 8px',
              fontSize: '11px',
              lineHeight: '16px',
              color: 'var(--dsw-alias-label-caption)',
              background: 'var(--dsw-alias-bg-module-platform)',
              borderBottom: '1px solid var(--dsw-alias-border-l2)',
            },
          },
          h(
            'div',
            {
              'data-role': 'focus-capacity-asof',
              /* 没初始化这件事要一眼看得出来（`unset` 与 `set` 是两种状态，不是一句话的差别）。 */
              'data-state': asOfSet ? 'set' : 'unset',
            },
            asOfText,
          ),
          outsideText === null
            ? null
            : h(
                'div',
                {
                  'data-role': 'focus-capacity-outside',
                  'data-minutes': String(outsideMinutes),
                  style: { marginTop: '2px' },
                },
                outsideText,
              ),
        ),
        h(FocusReminders, {
          reminders: focus !== null && Array.isArray(focus.reminders) ? focus.reminders : [],
          t,
        }),
        h(
          'div',
          {
            className: 'gtd-focus-stage',
            'data-role': 'focus-stage',
            style: {
              position: 'relative',
              flex: '1 1 auto',
              minHeight: '320px',
              overflow: 'auto',
            },
          },
          /* ② 行动卡 + ③「接下来」+ ④ 下钻入口 */
          h(
            'div',
            {
              className: 'gtd-focus-body',
              'data-role': 'focus-body',
              hidden: drilled,
              style: {
                display: drilled ? 'none' : 'flex',
                flexDirection: 'column',
                gap: '18px',
                padding: '16px 16px 20px',
              },
            },
            focus === null
              ? h(
                  'div',
                  {
                    'data-role': 'focus-view-pending',
                    style: {
                      padding: '12px 16px',
                      border: '1px dashed var(--dsw-alias-border-l3)',
                      borderRadius: 'var(--dsw-radius-md)',
                      color: 'var(--dsw-alias-label-secondary)',
                      fontSize: '13px',
                      lineHeight: '20px',
                    },
                  },
                  t('focusViewPending'),
                )
              : h(
                  React.Fragment,
                  null,
                  h(FocusActionCard, {
                    /* 卡换了人就重挂：改期编辑器是**这条动作**的视图内状态，
                       不该带着上一条的日子跟到下一条身上去。 */
                    key: card === null ? 'focus-card-empty' : card.id,
                    card,
                    t,
                    onOpenNote: props.onOpenNote,
                    /* v2:write 写口：状态与回调由外壳给（快照也住在外壳里）。 */
                    write: props.write,
                    onComplete: props.onComplete,
                    onReschedule: props.onReschedule,
                    onSkip: props.onSkip,
                    onRefresh: props.onReload,
                    /* v2:project 卡脚：点「项目清单 →」打开下钻层并把项目箱摆在那儿。 */
                    onOpenProject: openProject,
                  }),
                  /* v2:write 跳过之后说清楚它去哪了：零写入，只在本次会话里。 */
                  skipped.length > 0
                    ? h(
                        'p',
                        {
                          'data-role': 'focus-skip-notice',
                          style: {
                            margin: 0,
                            fontSize: '11.5px',
                            lineHeight: '17px',
                            color: 'var(--dsw-alias-label-caption)',
                          },
                        },
                        t('focusSkipNotice'),
                      )
                    : null,
                  h(FocusNextQueue, { items: queue, t, onPick: pickFromQueue }),
                ),
            h(
              'button',
              {
                type: 'button',
                className: 'gtd-focus-drill-entry',
                'data-role': 'focus-drill-entry',
                onClick: () => setDrilled(true),
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px dashed var(--dsw-alias-border-l3)',
                  borderRadius: 'var(--dsw-radius-md)',
                  background: 'transparent',
                  color: 'var(--dsw-alias-label-secondary)',
                  font: 'inherit',
                  fontSize: '12.5px',
                  lineHeight: '19px',
                  textAlign: 'left',
                  cursor: 'pointer',
                },
              },
              h('span', { 'data-role': 'focus-drill-entry-label' }, t('focusDrillEntry')),
              h(
                'span',
                {
                  'data-role': 'focus-drill-entry-chev',
                  'aria-hidden': 'true',
                  style: { marginLeft: 'auto', color: 'var(--dsw-alias-label-caption)' },
                },
                '▾',
              ),
            ),
          ),
          /* ④ 下钻层：六箱全景原样（点开才画——下钻层默认不可见） */
          drilled
            ? h(FocusDrill, {
                open: drilled,
                snapshot,
                t,
                motions: props.motions,
                onOpenNote: props.onOpenNote,
                /* v2:project 点卡脚的项目指针进来时，项目箱是那个要看清的纸箱。 */
                focusContainer: drillFocus,
                onClose: () => setDrilled(false),
              })
            : null,
        ),
      );
    }
    /* v2:focus end */

    /**
     * 主区面板（**外壳**）：打开就拉一次数，另配一个手动刷新按钮。
     *
     * 外壳只管横切的事——取数、加载态、错误态、刷新、当前画哪一个视图。
     * 它自己不画画布：画什么由两个视图组件决定（旧画布 `CanvasView`、焦点视图 `FocusView`），
     * 视图只收 `snapshot` 与几个回调，所以**加新视图不用动取数、错误处理与刷新**。
     * @param {object} props - occupant props。
     * @returns {object} React 元素。
     */
    function WorkbenchPanel(props) {
      const t = translatorOf(props);
      const preset = props.initialSnapshot;
      const [state, setState] = React.useState(() =>
        preset === undefined
          ? { status: 'loading', snapshot: null, error: null }
          : { status: 'ready', snapshot: preset, error: null },
      );
      /* gtd:09 状态迁移：与上次快照比对，只演真实发生过的差异 */
      const [motions, setMotions] = React.useState({});
      const baselineRef = React.useRef(preset === undefined ? null : summarizeForMotion(preset));
      React.useEffect(() => {
        // 打开画布就把这一份记成基准：入场动画不是「变化」，下一次拉数才比。
        if (preset === undefined) return;
        writeBaseline(summarizeForMotion(preset));
      }, [preset]);
      /* gtd:09 end */
      const load = React.useCallback(async () => {
        setState((previous) => ({ ...previous, status: 'loading', error: null }));
        try {
          const response = await fetch(TASKS_URL, { headers: { accept: 'application/json' } });
          const body = await response.json();
          if (!response.ok || (body && body.error)) {
            const failure = (body && body.error) || { code: 'http-error', message: `HTTP ${response.status}` };
            setState({ status: 'error', snapshot: null, error: withFailureCode(failure, response.status) });
            return;
          }
          /* gtd:09 拉数后先算差异，再换画面：没有变化的便贴不重播动画 */
          const next = summarizeForMotion(body);
          setMotions(motionsFor(baselineRef.current ?? readBaseline(), next));
          baselineRef.current = next;
          writeBaseline(next);
          /* gtd:09 end */
          setState({ status: 'ready', snapshot: body, error: null });
          /* v2:write 重新取到数了，写口的那句话（失败原因／刷新失败）也就过期了。 */
          setWrite(null);
        } catch (error) {
          setState({
            status: 'error',
            snapshot: null,
            error: { code: 'network-error', message: error instanceof Error ? error.message : String(error) },
          });
        }
      }, []);
      React.useEffect(() => {
        if (preset === undefined) load();
      }, [load, preset]);
      /* gtd:05 抽屉状态住在面板里：哪张便贴被点开 */
      const [openedNote, setOpenedNote] = React.useState(null);
      const closeDrawer = React.useCallback(() => setOpenedNote(null), []);
      /* gtd:05 end */
      /* v2:write 写口的状态：等待／失败／写成了但刷新失败。
         住在外壳里——快照也住在外壳里，写口与快照是同一件事的两头。 */
      const [write, setWrite] = React.useState(null);
      /** 正在飞的那一次写：连点不许再发一次（Host 一次完成要跑十几次 CLI 调用）。 */
      const writingRef = React.useRef(false);
      /* v2:write 跳过（issue #10）：本次会话里被跳过的那几条。
         **只活在内存里**——不落 localStorage、不写任何文件，刷新页面它就回来。 */
      const [skipped, setSkipped] = React.useState([]);

      /**
       * 走工作台自己的 HTTP 契约的写方向：`POST /gtd-workbench/actions`。
       *
       * 请求体是「动作类型 + 目标 id + 参数」：键是英文，`params` 里只有这个动作要的东西
       * （「改期」带新的截止日，「完成」不用）。
       * 写成功了、响应里带着新快照，就**整体替换**面板当前的快照——
       * 主卡与「接下来」因此按 Host 排好的样子重排，不必再发一次读请求。
       * @param {string} taskId - 目标动作 id。
       * @param {'complete' | 'reschedule'} action - 写动作类型。
       * @param {object} params - 这个动作的参数。
       * @returns {Promise<void>} 写完。
       */
      const runWrite = React.useCallback(async (taskId, action, params) => {
        if (typeof taskId !== 'string' || taskId.length === 0) return;
        if (writingRef.current) return;
        writingRef.current = true;
        setWrite({ taskId, action, status: 'pending', message: null, code: null });
        try {
          const response = await fetch(ACTIONS_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ action, taskId, params }),
          });
          const body = await response.json().catch(() => null);
          if (!response.ok || body === null || typeof body !== 'object' || body.error) {
            const failure =
              body !== null && typeof body === 'object' && body.error
                ? body.error
                : { code: 'http-error', message: `HTTP ${response.status}` };
            const described = withFailureCode(failure, response.status);
            if (described.code === 'not-authenticated') {
              /* 没登录：走既有的未登录那条路（`login-prompt`／`login-command`），不另起一套。 */
              setWrite(null);
              setState({ status: 'error', snapshot: null, error: described });
              return;
            }
            /* 写失败不是写成了：说清原因，不在本地改期限、不加「已完成」标记。 */
            setWrite({ taskId, action, status: 'failed', message: described.message, code: described.code });
            return;
          }
          if (body.snapshot !== null && typeof body.snapshot === 'object') {
            /* 写成功了，响应里带着新快照：整体换掉，主卡自动变成下一件。 */
            setWrite(null);
            setState({ status: 'ready', snapshot: body.snapshot, error: null });
            return;
          }
          /* 写成功了，只是刷新没成：说「写成了，但刷新失败」，并给一次手动刷新。 */
          const refresh =
            body.refreshError !== null && typeof body.refreshError === 'object' ? body.refreshError : null;
          setWrite({
            taskId,
            action,
            status: 'refresh-failed',
            message: refresh === null ? null : refresh.message,
            code: refresh === null ? null : refresh.code,
          });
        } catch (error) {
          setWrite({
            taskId,
            action,
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
            code: 'network-error',
          });
        } finally {
          writingRef.current = false;
        }
      }, []);

      /**
       * 完成一条动作（滴答勾选，单口径）。
       * @param {string} taskId - 目标动作 id。
       * @returns {Promise<void>} 完成。
       */
      const completeTask = React.useCallback(
        (taskId) => runWrite(taskId, 'complete', {}),
        [runWrite],
      );

      /**
       * 改期一条动作（写新的完成时限，粒度到天）。
       * @param {string} taskId - 目标动作 id。
       * @param {string} dueDate - 新的完成时限（`YYYY-MM-DD`）。
       * @returns {Promise<void>} 改完。
       */
      const rescheduleTask = React.useCallback(
        (taskId, dueDate) => runWrite(taskId, 'reschedule', { dueDate }),
        [runWrite],
      );

      /**
       * 跳过一条动作：**零写入**。
       *
       * Host 那侧没有「跳过」这个写口——发了过去只会被拒掉。
       * 这里只记一笔「本次会话里不再看见它」，不请求、不落盘。
       * @param {string} taskId - 目标动作 id。
       * @returns {void} 无。
       */
      const skipTask = React.useCallback((taskId) => {
        if (typeof taskId !== 'string' || taskId.length === 0) return;
        setSkipped((previous) => (previous.includes(taskId) ? previous : [...previous, taskId]));
      }, []);
      /* v2:write end */
      /* gtd:04 点主攻带上的条目，开的就是那条便贴的抽屉 */
      const openNoteById = React.useCallback(
        (item) => {
          const containers = state.snapshot !== null && typeof state.snapshot === 'object' ? state.snapshot.containers : null;
          const notes = Array.isArray(containers) ? containers.flatMap((container) => (Array.isArray(container.notes) ? container.notes : [])) : [];
          const found = notes.find((note) => note.id === item.id);
          if (found !== undefined) setOpenedNote(found);
        },
        [state.snapshot],
      );
      /* gtd:04 end */
      /* v2:shell 当前画哪一个视图：状态住在外壳里，视图自己不决定。
         `initialView` 可以把初始视图定成画布（默认是焦点引导器）——
         焦点视图里那个下钻入口通向的是同一张画布。 */
      const [viewMode, setViewMode] = React.useState(
        props.initialView === VIEW_MODE.CANVAS ? VIEW_MODE.CANVAS : DEFAULT_VIEW_MODE,
      );
      const ViewComponent = viewMode === VIEW_MODE.FOCUS ? FocusView : CanvasView;
      /* v2:shell end */
      if (state.status === 'loading') {
        return h(
          'div',
          { className: 'gtd-workbench', 'data-role': 'panel', 'data-state': 'loading', style: { padding: '16px', color: 'var(--dsw-alias-label-tertiary)' } },
          t('loading'),
        );
      }
      if (state.status === 'error') {
        return h(WorkbenchFailure, { t, error: state.error, onRetry: load });
      }
      return h(
        'div',
        {
          className: 'gtd-workbench',
          'data-role': 'panel',
          'data-state': 'ready',
          /* v2:shell 当前画的是哪一个视图：摆在面板上，人与测试都看得见 */
          'data-view': viewMode,
          style: { position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
        },
        h(
          'header',
          {
            className: 'gtd-workbench__bar',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 16px',
              borderBottom: '1px solid var(--dsw-alias-border-l2)',
            },
          },
          h('h1', { 'data-role': 'panel-title', style: { margin: 0, fontSize: '15px', lineHeight: '22px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, t('title')),
          /* v2:shell 切换视图：状态在外壳里，这里只是两个控件 */
          h(ViewSwitcher, { t, mode: viewMode, onChange: setViewMode }),
          /* v2:shell end */
          h(
            'button',
            {
              type: 'button',
              'data-role': 'refresh',
              onClick: load,
              style: {
                marginLeft: 'auto',
                border: '1px solid var(--dsw-alias-border-l3)',
                borderRadius: 'var(--dsw-radius-md)',
                background: 'var(--dsw-alias-bg-module-platform)',
                color: 'var(--dsw-alias-label-primary)',
                font: 'inherit',
                fontSize: '13px',
                padding: '4px 12px',
                cursor: 'pointer',
              },
            },
            t('refresh'),
          ),
        ),
        /* v2:shell 视图层：Provider 不产生 DOM 元素，画布那一段的层级与拆分前完全一样 */
        h(
          NoteOpenContext.Provider,
          { value: setOpenedNote },
          h(ViewComponent, {
            snapshot: state.snapshot,
            t,
            motions,
            onOpenNote: openNoteById,
            /* 外壳把刷新也递下去：视图要用（写口写完要重画）时自己叫，不用去碰取数 */
            onReload: load,
            /* v2:write 写口：状态与回调都在外壳（快照也在这儿）。
               「跳过」只是本次会话里的视图状态——也住在外壳，切视图不丢，刷新页面才回来。 */
            write,
            onComplete: completeTask,
            onReschedule: rescheduleTask,
            onSkip: skipTask,
            skipped,
          }),
        ),
        /* v2:shell end */        /* gtd:05 抽屉挂在画布**外面**、面板里面：它是覆盖层，不动画布版面 */
        openedNote === null
          ? null
          : h(NoteDrawer, {
              note: openedNote,
              records: state.snapshot !== null && typeof state.snapshot === 'object' ? state.snapshot.records : [],
              t,
              onClose: closeDrawer,
            }),
        /* gtd:05 end */
      );
    }

    /* gtd:10 质感与主题：纸箱的折角／阴影／纸纹，字体与配色跟随宿主 */
    /** 注入的样式表在 head 里的选择器标记（也用来避免重复注入）。 */
    const STYLE_ATTR = 'data-plugin-gtd-workbench';

    /**
     * 质感与主题的样式表。
     *
     * 三件事各有出处：
     * 1. **质感只来自折角、阴影、纸纹**（ADR-0007）：不换字体、不换配色。字体跟 `--dsw-font-family`，
     *    配色全部是 `--dsw-alias-*` 令牌，所以明暗两套主题下自动可读，不需要另写一套暗色。
     * 2. **纸纹用 `color-mix` 从当前文字色派生**，而不是写死一个深色：暗色主题下深色纸纹看不见，
     *    派生出来的纸纹在任何主题下都只是「比底稍微不匀一点」。前面留一条 rgba 兜底，
     *    不支持 `color-mix` 的环境退化成极淡的固定纹。
     * 3. **尊重减少动效偏好**：`prefers-reduced-motion: reduce` 时把所有动画与过渡压到近乎为零，
     *    倾斜也一并取消。动效是锦上添花，不是信息本身。
     */
    const STYLE_TEXT = `
.gtd-workbench, .gtd-workbench * { font-family: var(--dsw-font-family); }
.gtd-box { position: relative; }
.gtd-box::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background-image:
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.018) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.012) 0 1px, transparent 1px 4px);
  background-image:
    repeating-linear-gradient(0deg, color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent) 0 1px, transparent 1px 4px);
}
.gtd-box__fold { filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.12)); }
.gtd-note { transition: box-shadow 140ms ease, transform 140ms ease; }
.gtd-note:nth-child(3n + 1) { transform: rotate(-0.22deg); }
.gtd-note:nth-child(3n + 2) { transform: rotate(0.18deg); }
.gtd-note:hover { box-shadow: 0 3px 10px rgba(0, 0, 0, 0.16); }
.gtd-tag:nth-child(even) { transform: rotate(0.35deg); }
@keyframes gtd-paste { from { opacity: 0; } to { opacity: 1; } }
@keyframes gtd-sink { from { opacity: 1; } to { opacity: 0.55; } }
@keyframes gtd-flash { 0% { opacity: 1; } 40% { opacity: 0.4; } 100% { opacity: 1; } }
@keyframes gtd-fly { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }
.gtd-note { animation: gtd-paste 260ms ease-out both; }
.gtd-note[data-motion="completed"] { animation: gtd-sink 700ms ease-out both; }
.gtd-sunk__note[data-motion="completed"] { animation: gtd-flash 900ms ease-out both; }
.gtd-note[data-motion="rescheduled"] { animation: gtd-flash 760ms ease-in-out both; }
.gtd-note[data-motion="moved"] { animation: gtd-fly 620ms ease-out both; }
.gtd-note[data-dragging="true"] { transition: none; cursor: grabbing; }
/* v2:focus 焦点视图：窄条与下钻入口的悬停反馈（动效仍走减少动效偏好那一段） */
.gtd-focus-next__item:hover { border-color: var(--dsw-alias-border-l3); }
.gtd-focus-card__title button:hover { text-decoration: underline; }
.gtd-focus-drill-entry:hover { border-color: var(--dsw-alias-label-tertiary); color: var(--dsw-alias-label-primary); }
/* v2:two-minute 两分钟卡：卡面与正常动作有区别，但克制——描边略强一档，
   不加实心色块、不抢主卡的视觉重心。 */
.gtd-focus-card[data-state="two-minute"] { border-color: var(--dsw-alias-label-tertiary); }
@media (prefers-reduced-motion: reduce) {
  .gtd-workbench *,
  .gtd-workbench *::before,
  .gtd-workbench *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
  .gtd-note,
  .gtd-tag { transform: none !important; }
}
`;

    /**
     * 把样式装进文档，返回拆掉它的清理函数。
     *
     * 幂等：同一个文档里只留一个 `<style>`，重复安装直接复用。
     * @param {object} doc - 目标 document。
     * @returns {() => void} 清理函数。
     */
    function installStyles(doc) {
      if (doc === null || typeof doc !== 'object' || typeof doc.createElement !== 'function') {
        return () => {};
      }
      const existing = typeof doc.querySelector === 'function' ? doc.querySelector(`style[${STYLE_ATTR}]`) : null;
      if (existing !== null) return () => {};
      const tag = doc.createElement('style');
      tag.setAttribute(STYLE_ATTR, '');
      tag.setAttribute('data-plugin', '@local/gtd-workbench');
      tag.textContent = STYLE_TEXT;
      if (doc.head !== null && doc.head !== undefined) doc.head.appendChild(tag);
      return () => {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
      };
    }
    /* gtd:10 end */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const disposeLocale = ctx.locale.register(LOCALE_NAMESPACE, { zh, en });
          const t = ctx.locale.bind(LOCALE_NAMESPACE);
          /* gtd:10 样式跟插件同生共死 */
          const disposeStyles = installStyles(typeof document === 'undefined' ? null : document);
          /* gtd:10 end */
          const disposeMain = ctx.slots.inject('main', () =>
            ctx.slots.register({ name: 'main', key: PANEL_ID, locale: LOCALE_NAMESPACE }, WorkbenchPanel),
          );
          const disposeSidebar = ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              { name: 'sidebar.panellist', id: PANEL_ID, order: 20, locale: LOCALE_NAMESPACE, label: () => t('panel') },
              WorkbenchIcon,
            ),
          );
          return () => {
            disposeSidebar();
            disposeMain();
            disposeStyles();
            disposeLocale();
          };
        }, 'gtd-workbench: locale + slots + styles');
      },
      /**
       * 暴露给测试的面板与画布部件。
       *
       * `installStyles`、`styles`、`summarizeForMotion`、`motionsFor` 只是为了测试能核对它们
       * （样式表原文、浏览器侧差异逻辑与 `app/lib/diff.js` 是否一致），不改变运行时行为。
       *
       * `FocusView`／`CanvasView`／`ViewSwitcher` 是**视图层**：它们与外壳（`WorkbenchPanel`）
       * 由**同一个**入口导出——客户端只有一个入口，没有第二个 client 文件。
       */
      components: {
        WorkbenchIcon,
        WorkbenchPanel,
        WorkbenchBoard,
        WorkbenchBox,
        WorkbenchNote,
        CanvasView,
        FocusView,
        ViewSwitcher,
        installStyles,
        summarizeForMotion,
        motionsFor,
      },
      /** 样式表原文，测试直接核对它写了什么。 */
      styles: STYLE_TEXT,
    };
  },
});
