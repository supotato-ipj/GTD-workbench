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
      /** 桌左小屏上「可排 X 分钟」的短标签（剩余可排时间只在这行出现一次）。 */
      focusScreenAvailable: '可排',
      /** 小屏的空态（卡上已经写着「现在没有该做的事」，这里不重复同一句）。 */
      focusScreenEmpty: '桌上是空的',
      weekdaySun: '周日',
      weekdayMon: '周一',
      weekdayTue: '周二',
      weekdayWed: '周三',
      weekdayThu: '周四',
      weekdayFri: '周五',
      weekdaySat: '周六',
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
      focusNextHeading: '卡夹',
      focusNextHint: '点一张抽到主位',
      focusNextEmpty: '卡夹空着',
      focusCardEmpty: '现在没有该做的事',
      focusNotesHint: '点开看参数',
      focusReminderFlag: '等回 {count}',
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
      focusSkipNotice: '已跳过：它被插回卡夹末尾，零写入；刷新页面回到原位',
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
      focusScreenAvailable: 'Left',
      focusScreenEmpty: 'The desk is empty',
      weekdaySun: 'Sun',
      weekdayMon: 'Mon',
      weekdayTue: 'Tue',
      weekdayWed: 'Wed',
      weekdayThu: 'Thu',
      weekdayFri: 'Fri',
      weekdaySat: 'Sat',
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
      focusNextHeading: 'Card holder',
      focusNextHint: 'tap one to pull it to the desk',
      focusNextEmpty: 'The card holder is empty',
      focusCardEmpty: 'Nothing to do right now',
      focusNotesHint: 'Tap to see the settings',
      focusReminderFlag: 'Awaiting {count}',
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
      focusSkipNotice: 'Skipped: it goes to the back of the card holder with no writes; a reload puts it back',
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
     * 把一份失败描述拍成呈现层要的三样：类别、人能读的原因、是不是未登录。
     *
     * 失败面板与工位上的失败纸条共用这一处口径，别让两边各判一次。
     * @param {unknown} error - 失败描述。
     * @returns {{ code: string, message: string, needsLogin: boolean }} 呈现用的失败信息。
     */
    function failureInfoOf(error) {
      const base = error !== null && typeof error === 'object' ? error : {};
      const code = typeof base.code === 'string' && base.code.length > 0 ? base.code : 'unknown';
      const message = typeof base.message === 'string' ? base.message : '';
      return { code, message, needsLogin: code === 'not-authenticated' };
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
      const { code, message, needsLogin } = failureInfoOf(props.error);
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
     * 视图切换的两位：画布／焦点。角色名与顺序只在这里排一次，
     * 网页标题栏里的那对按钮和桌沿标牌共用它，免得两边各写一份。
     * @param {(key: string) => string} t - 翻译函数。
     * @returns {{ key: string, label: string }[]} 两项。
     */
    function viewSwitchEntries(t) {
      return [
        { key: VIEW_MODE.CANVAS, label: textOf(t, 'viewCanvasLabel', '六箱画布') },
        { key: VIEW_MODE.FOCUS, label: textOf(t, 'viewFocusLabel', '焦点视图') },
      ];
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
      const button = (entry) =>
        h(
          'button',
          {
            type: 'button',
            key: entry.key,
            'data-role': `view-switch-${entry.key}`,
            'data-active': mode === entry.key ? 'true' : 'false',
            onClick: () => props.onChange(entry.key),
            style: {
              padding: '2px 10px',
              border: '1px solid ' + (mode === entry.key ? 'var(--dsw-alias-border-l3)' : 'transparent'),
              borderRadius: 'var(--dsw-radius-md)',
              background: mode === entry.key ? 'var(--dsw-alias-bg-module-platform)' : 'transparent',
              color: mode === entry.key ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
              font: 'inherit',
              fontSize: '12px',
              lineHeight: '19px',
              cursor: 'pointer',
            },
          },
          entry.label,
        );
      return h(
        'div',
        { 'data-role': 'view-switch', 'data-view': mode, style: { display: 'flex', gap: '4px' } },
        viewSwitchEntries(t).map(button),
      );
    }
    /* v2:shell end */

    /* v3:desk 焦点视图是像素工位（issue #13，ADR-0012）
     *
     * 一层桌面、一盏台灯、一张立在桌上的竖版行动卡。卡是画面里唯一被照亮的主体；
     * 卡夹（「接下来」）、便签叠（今日日清）、桌左小屏（预计耗时／装不装得下／剩余可排）、
     * 灯座上的深度指示块、小旗（到期没回）、桌下抽屉（六箱）、桌沿标牌与桌角开关，
     * 都是桌面上的物件。
     *
     * 仍然是**只读、只画不算**：资格、排序、容量、主卡与队列的内容全部来自快照；
     * 换卡（点卡夹、左右划）是视图内状态，零写入；完成与改期仍是仅有的两个写口。
     * 工位自带一套夜色色板与点阵字体，**不用**宿主 `--dsw-alias-*` 令牌；
     * 六箱画布与下钻层照旧走宿主令牌（ADR-0007 的「质感」在焦点视图范围内被 ADR-0012 取代）。
     */

    /**
     * 快照缺失时的兜底对象（模块级常量，身份恒定）。
     */
    const EMPTY_SNAPSHOT = {};

    /** 美术网格：600×420 的像素工位（与 `prototype/pixel-desk` 同一张网格）。 */
    const DESK_ART = {
      width: 600,
      height: 420,
      /* 纵向内容带：从台灯/显示器顶部到桌沿标牌底部。缩放置数按它算——
         上方多出来的暗房间可以裁，桌面与桌沿不能裁。 */
      contentTop: 44,
      contentBottom: 414,
      card: { x: 210, y: 90, width: 200, height: 280, centerX: 310, maxWidth: 280 },
      screen: { x: 24, y: 250, width: 150, height: 84 },
      holder: { x: 415, y: 152, width: 175, height: 120 },
      notes: { x: 415, y: 282, width: 170, height: 70 },
      flag: { x: 484, y: 354, width: 76, height: 36 },
      plaques: { x: 18, y: 394, width: 180, height: 20 },
      drawer: { x: 250, y: 394, width: 100, height: 20 },
      power: { x: 532, y: 392, width: 50, height: 22 },
      quota: { x: 84, y: 142, width: 16, height: 10 },
      lamp: { x: 26, y: 56, width: 160, height: 100 },
    };

    /** 工位素材的路径（Host 的 prefix 路由；不是模块，客户端仍单文件）。 */
    const DESK_SCENE_URL = '/gtd-workbench/assets/pixel/desk-scene.png';
    const DESK_PAPER_URL = '/gtd-workbench/assets/pixel/paper-grain.png';

    /** 工位字体族：自带前缀，不在 `body`／`:root` 上覆盖宿主令牌。 */
    const DESK_FONT_FAMILY = "'GtdPixelFusion', 'Ark Pixel 12px', ui-monospace, monospace";

    /**
     * 工位色板：夜色 + 暖光 + 纸色。
     *
     * 全部定义在工位根上，**工位子树里不出现宿主 `--dsw-alias-*`**——要照出光斑，
     * 就必须自己掌握明暗（ADR-0012 决定 3）。
     */
    const DESK_PALETTE = {
      '--gtd-room': '#0d0e12',
      '--gtd-wall-upper': '#0f1118',
      '--gtd-wall': '#12151d',
      '--gtd-desk': '#2a2318',
      '--gtd-desk-edge': '#332a1c',
      '--gtd-front': '#1b1710',
      '--gtd-front-edge': '#3b3024',
      '--gtd-paper': '#e9e1cd',
      '--gtd-paper-2': '#f3ecd8',
      '--gtd-ink': '#221d16',
      '--gtd-ink-dim': '#6b6150',
      '--gtd-warm': '#ffd9a0',
      '--gtd-stamp': '#a63f2e',
      '--gtd-card-edge': '#14110c',
      '--gtd-lamp-base': '#20242d',
      '--gtd-lamp-edge': '#39404e',
      '--gtd-ink-mute': '#6a6154',
      '--gtd-holder-dim': '#8d8577',
      '--gtd-notes-shadow-1': '#cfc5ac',
      '--gtd-notes-shadow-2': '#b9af96',
      '--gtd-screen': '#101319',
      '--gtd-screen-edge': '#3b4250',
      '--gtd-screen-ink': '#e6c98c',
      '--gtd-screen-dim': '#9aa2b2',
      '--gtd-screen-bad': '#e08c74',
      '--gtd-screen-strong': '#f2e9d6',
      '--gtd-holder': '#17130e',
      '--gtd-holder-edge': '#3a3226',
      '--gtd-notes': '#e4dbc4',
      '--gtd-notes-edge': '#14110c',
      '--gtd-flag': '#b4462f',
      '--gtd-flag-edge': '#6d2a20',
      '--gtd-flag-ink': '#f6ecd9',
      '--gtd-flag-pole': '#6a6154',
      '--gtd-plaque': '#1f232c',
      '--gtd-plaque-edge': '#3a3f4c',
      '--gtd-plaque-ink': '#b9b0a0',
      '--gtd-plaque-active': '#333946',
      '--gtd-plaque-ink-active': '#f2e9d6',
      '--gtd-power': '#1b1f27',
      '--gtd-power-hover': '#262b35',
      '--gtd-drawer': '#241d15',
      '--gtd-drawer-edge': '#4a3f2e',
      '--gtd-drawer-ink': '#9a8f7c',
      '--gtd-drawer-hover': '#2e2519',
      '--gtd-drawer-hover-ink': '#cfc3ad',
      '--gtd-highlight': 'rgba(255, 255, 255, 0.4)',
      '--gtd-highlight-dim': 'rgba(255, 255, 255, 0.05)',
      '--gtd-shadow-hard': 'rgba(0, 0, 0, 0.45)',
      '--gtd-shadow-card': 'rgba(0, 0, 0, 0.5)',
      '--gtd-shadow-note': 'rgba(0, 0, 0, 0.35)',
      '--gtd-ink-line': 'rgba(34, 29, 22, 0.25)',
      '--gtd-light-strong': 'rgba(255, 206, 138, 0.16)',
      '--gtd-light-mid': 'rgba(255, 206, 138, 0.1)',
      '--gtd-light-soft': 'rgba(255, 206, 138, 0.05)',
    };

    /**
     * 取一个正数，否则用兜底值。
     * @param {unknown} value - 候选值。
     * @param {number} fallback - 兜底值。
     * @returns {number} 正数。
     */
    function positiveNumber(value, fallback) {
      return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
    }

    /**
     * 工位的缩放与版面：一个美术像素 = `scale` 个设备像素（`scale` 只取整数）。
     *
     * 先试 3、再 2、最后 1：字号只有 12 与 24 两个美术像素台阶，缩放取整之后
     * `字号 × devicePixelRatio` 一定落在 12 的整数倍上（点阵字不落半像素）。
     * 窗口比美术网格宽时，多出来的空间由暗房间延伸填满（不出黑边）；
     * 比网格还窄时，先把卡加宽——**不把字号压到 12 以下**。
     * @param {{ width?: number, height?: number, dpr?: number } | null | undefined} input - 视口。
     * @returns {object} 版面：`scale`、`unit`（CSS px / 美术 px）、画布与工位尺寸、卡宽。
     */
    function deskGeometryOf(input) {
      const width = positiveNumber(input === null || input === undefined ? undefined : input.width, 1024);
      const height = positiveNumber(input === null || input === undefined ? undefined : input.height, 768);
      const dpr = positiveNumber(input === null || input === undefined ? undefined : input.dpr, 1);
      const contentHeight = DESK_ART.contentBottom - DESK_ART.contentTop;
      let scale = 1;
      for (const candidate of [3, 2, 1]) {
        if (
          DESK_ART.width * candidate <= width * dpr &&
          contentHeight * candidate <= height * dpr
        ) {
          scale = candidate;
          break;
        }
      }
      const unit = scale / dpr;
      const viewWidth = Math.max(1, Math.floor(width / unit));
      const viewHeight = Math.max(1, Math.floor(height / unit));
      const boardWidth = Math.max(DESK_ART.width, viewWidth);
      /* 场景靠下：标牌底部贴着画面底边；上方多出来的空间归暗房间（可以裁掉一点顶）。 */
      const originY = viewHeight - DESK_ART.contentBottom;
      const narrow = viewWidth < DESK_ART.width;
      /* 整组物件以卡为中心：宽窗多出来的暗房间往两边铺，窄窗把看不见的两侧裁掉。 */
      const originX = Math.floor((narrow ? viewWidth : boardWidth) / 2 - DESK_ART.width / 2);
      /* 窄窗：先让出桌左小屏那一列，再把剩下的宽度全给卡（不把字号压到 12 以下）。 */
      const cardWidth = narrow
        ? Math.min(DESK_ART.card.maxWidth, Math.max(DESK_ART.card.width, viewWidth - 174))
        : DESK_ART.card.width;
      const cardLeft = narrow
        ? Math.max(166, Math.floor(viewWidth / 2 - cardWidth / 2))
        : DESK_ART.card.centerX + originX - Math.floor(cardWidth / 2);
      return {
        scale,
        unit,
        dpr,
        viewWidth,
        viewHeight,
        boardWidth,
        boardHeight: DESK_ART.height,
        originX,
        originY,
        narrow,
        cardWidth,
        cardLeft,
      };
    }

    /**
     * 量一下视口：优先量工位容器，量不到就用窗口（静态渲染时给一个保守的默认值）。
     * @param {object | null} element - 工位容器。
     * @returns {{ width: number, height: number, dpr: number }} 视口。
     */
    function deskViewportOf(element) {
      const win = typeof window === 'undefined' ? null : window;
      const fallbackWidth = win !== null && positiveNumber(win.innerWidth, 0) > 0 ? win.innerWidth : 1024;
      const fallbackHeight = win !== null && positiveNumber(win.innerHeight, 0) > 0 ? win.innerHeight : 768;
      const dpr = win !== null ? positiveNumber(win.devicePixelRatio, 1) : 1;
      const width =
        element !== null &&
        typeof element === 'object' &&
        typeof element.clientWidth === 'number' &&
        element.clientWidth > 0
          ? element.clientWidth
          : fallbackWidth;
      const height =
        element !== null &&
        typeof element === 'object' &&
        typeof element.clientHeight === 'number' &&
        element.clientHeight > 0
          ? element.clientHeight
          : fallbackHeight;
      return { width, height, dpr };
    }

    /**
     * 一个美术网格上的盒子：左／上／宽／高都乘同一个 `--gtd-u`。
     * @param {number} x - 左（美术 px）。
     * @param {number} y - 上（美术 px）。
     * @param {number} width - 宽（美术 px）。
     * @param {number} height - 高（美术 px）。
     * @returns {object} 内联样式。
     */
    function deskBox(x, y, width, height) {
      return {
        position: 'absolute',
        left: `calc(var(--gtd-u) * ${x})`,
        top: `calc(var(--gtd-u) * ${y})`,
        width: `calc(var(--gtd-u) * ${width})`,
        height: `calc(var(--gtd-u) * ${height})`,
      };
    }

    /**
     * 点阵字的一档：字号与行高都是美术像素，乘同一个 `--gtd-u`。
     * @param {number} size - 字号（美术 px）。
     * @param {number} line - 行高（美术 px）。
     * @returns {object} 内联样式。
     */
    function deskText(size, line) {
      return {
        fontSize: `calc(var(--gtd-u) * ${size})`,
        lineHeight: `calc(var(--gtd-u) * ${line})`,
      };
    }

    /** 只给读屏与测试看的文字（视觉上不占位）。 */
    const VISUALLY_HIDDEN = {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: 0,
    };

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
     * 取一个分钟数：只认数字，负数按 0 算（界面上不显示负的剩余时间）。
     * @param {unknown} value - 候选值。
     * @returns {number} 分钟数；不是数字时为 0。
     */
    function minutesOf(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
      return Math.max(0, Math.floor(value));
    }

    /**
     * 容量判定只剩三种：装得下 / 装不下 / 不知道。Host 说 `null` 就是不知道，别猜。
     * @param {unknown} hint - 卡的 `capacityHint`。
     * @returns {boolean | null} 三态。
     */
    function fitsOf(hint) {
      if (hint === null || typeof hint !== 'object') return null;
      return hint.fits === true ? true : hint.fits === false ? false : null;
    }

    /**
     * 容量判定的文案。
     * @param {boolean | null} fits - 三态。
     * @param {(key: string) => string} t - 翻译函数。
     * @returns {string} 文案。
     */
    function capacityWordOf(fits, t) {
      return fits === true ? t('focusCapacityFits') : fits === false ? t('focusCapacityNoFit') : t('focusCapacityUnknown');
    }

    /**
     * 桌左小屏的日期行：`11-05 周四`（日期来自快照的 `timeline.today`，星期只是呈现）。
     * @param {unknown} dateText - `YYYY-MM-DD`。
     * @param {(key: string) => string} t - 翻译函数。
     * @returns {string} 日期行。
     */
    function deskDateText(dateText, t) {
      const matched = typeof dateText === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText) : null;
      if (matched === null) return typeof dateText === 'string' ? dateText : '';
      const parsed = new Date(`${dateText}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return `${matched[2]}-${matched[3]}`;
      const weekdays = ['weekdaySun', 'weekdayMon', 'weekdayTue', 'weekdayWed', 'weekdayThu', 'weekdayFri', 'weekdaySat'];
      return `${matched[2]}-${matched[3]} ${t(weekdays[parsed.getDay()])}`;
    }

    /**
     * 桌左小屏：这张卡装不装得下、还剩多少可排时间。
     *
     * 卡上不再写耗时与容量（ADR-0012 修订 2）——它们在这里，和「今天还剩多少」并排：
     * 日期 / 预计耗时 / 装不装得下 / 可排多少分钟。「一个数只出现一次」仍然成立：
     * 剩余可排时间只在「可排」这一行，容量那一行只说装不装得下。
     * @param {object} props - props：`card`、`today`、`timelineToday`、`t`。
     * @returns {object} React 元素。
     */
    function DeskScreen(props) {
      const t = props.t;
      const card = props.card !== null && typeof props.card === 'object' ? props.card : null;
      const today = props.today !== null && typeof props.today === 'object' ? props.today : {};
      const remaining = minutesOf(today.remainingMinutes);
      const estimate =
        card !== null && typeof card.estimateMinutes === 'number' && Number.isFinite(card.estimateMinutes)
          ? card.estimateMinutes
          : null;
      const hint = card !== null && card.capacityHint !== null && typeof card.capacityHint === 'object' ? card.capacityHint : null;

      const lines = [];
      const dateText = deskDateText(props.timelineToday, t);
      if (dateText.length > 0) {
        lines.push(
          h(
            'div',
            {
              key: 'date',
              className: 'gtd-desk__screen-line gtd-desk__screen-dim',
              'data-role': 'gtd-desk-screen-date',
              style: deskText(12, 16),
            },
            dateText,
          ),
        );
      }
      if (card === null) {
        lines.push(
          h('div', {
            key: 'empty',
            className: 'gtd-desk__screen-line gtd-desk__screen-dim',
            style: deskText(12, 16),
          }, props.pending === true ? t('focusViewPending') : t('focusScreenEmpty')),
        );
      } else {
        /* 预计耗时：未估算是 null，不是 0 分钟（README「预计耗时」）。 */
        lines.push(
          h(
            'div',
            {
              key: 'estimate',
              className: 'gtd-desk__screen-line',
              'data-role': 'focus-card-estimate',
              'data-source': typeof card.estimateSource === 'string' ? card.estimateSource : '',
              style: deskText(12, 16),
            },
            h('span', { className: 'gtd-desk__screen-dim' }, `${t('focusCardEstimateLabel')} `),
            estimate === null
              ? h('span', { 'data-role': 'focus-card-estimate-unset' }, t('focusEstimateUnset'))
              : `${estimate} ${t('focusMinutesUnit')}`,
          ),
        );
        if (hint !== null) {
          const fits = fitsOf(hint);
          const state = capacityWordOf(fits, t);
          lines.push(
            h(
              'div',
              {
                key: 'capacity',
                className: 'gtd-desk__screen-line',
                'data-role': 'focus-card-capacity',
                'data-state': fits === true ? 'fits' : fits === false ? 'no' : 'unknown',
                style: deskText(12, 16),
              },
              h(
                'span',
                {
                  className: fits === false ? 'gtd-desk__screen-bad' : 'gtd-desk__screen-strong',
                  'data-role': 'focus-card-capacity-state',
                },
                state,
              ),
            ),
          );
        }
      }
      lines.push(
        h(
          'div',
          {
            key: 'remaining',
            className: 'gtd-desk__screen-line',
            'data-role': 'focus-stat',
            'data-stat': 'remaining',
            style: deskText(12, 16),
          },
          h('span', { className: 'gtd-desk__screen-dim', 'data-role': 'focus-stat-label' }, `${t('focusScreenAvailable')} `),
          h(
            'span',
            {
              'data-role': 'focus-stat-value',
              'data-stat': 'remaining',
              'data-minutes': String(remaining),
            },
            `${remaining} ${t('focusMinutesUnit')}`,
          ),
        ),
      );

      return h(
        'section',
        {
          className: 'gtd-desk__screen',
          'data-role': 'gtd-desk-screen',
          'aria-label': t('focusRemainingLabel'),
          style: deskBox(
            props.geometry.narrow ? 8 : DESK_ART.screen.x + props.geometry.originX,
            DESK_ART.screen.y + props.geometry.originY,
            DESK_ART.screen.width,
            DESK_ART.screen.height,
          ),
        },
        lines,
      );
    }

    /**
     * 便签叠：今日日清，几笔未还。
     *
     * 「容量参数定于某日」「窗口外那笔日清不占可排时间」两句收在里面，点开才看见
     * （ADR-0012 决定 6）。点开只是视图内状态，不写任何东西。
     * @param {object} props - props：`today`、`capacity`、`t`、`open`、`onToggle`、`geometry`（版面与 `--gtd-u` 的来源）。
     * @returns {object} React 元素。
     */
    function DeskNotes(props) {
      const t = props.t;
      const today = props.today !== null && typeof props.today === 'object' ? props.today : {};
      const capacity = props.capacity !== null && typeof props.capacity === 'object' ? props.capacity : {};
      const daily = Array.isArray(today.daily) ? today.daily : [];
      const openCount = daily.filter((row) => row !== null && typeof row === 'object' && row.state === '未还清').length;
      const asOfSet = typeof capacity.asOf === 'string' && capacity.asOf.length > 0;
      const asOfText = asOfSet ? `${t('focusCapacityAsOf')} ${capacity.asOf}` : t('focusCapacityAsOfUnset');
      const outsideMinutes = minutesOf(capacity.dailyMinutesOutsideWindow);
      const outsideText =
        outsideMinutes > 0 ? fillTemplate(t('focusCapacityOutsideWindow'), { minutes: outsideMinutes }) : null;
      return h(
        'section',
        {
          className: 'gtd-desk__notes',
          'data-role': 'gtd-desk-notes',
          'data-state': props.open === true ? 'open' : 'closed',
          role: 'button',
          tabIndex: 0,
          'aria-expanded': props.open === true ? 'true' : 'false',
          onClick: props.onToggle,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              props.onToggle();
            }
          },
          style: deskBox(
            DESK_ART.notes.x + props.geometry.originX,
            DESK_ART.notes.y + props.geometry.originY,
            DESK_ART.notes.width,
            DESK_ART.notes.height,
          ),
        },
        h(
          'div',
          {
            className: 'gtd-desk__notes-head',
            'data-role': 'focus-stat',
            'data-stat': 'daily',
            style: deskText(12, 16),
          },
          h('span', { 'data-role': 'focus-stat-label' }, t('focusDailyLabel')),
          ' ',
          h(
            'span',
            {
              'data-role': 'focus-stat-value',
              'data-stat': 'daily',
              'data-open': String(openCount),
              'data-total': String(daily.length),
            },
            `${openCount}/${daily.length} ${t('focusDailyUndone')}`,
          ),
        ),
        h('div', { className: 'gtd-desk__notes-hint', style: deskText(12, 14) }, t('focusNotesHint')),
        h(
          'div',
          {
            className: 'gtd-desk__notes-fine',
            'data-role': 'focus-capacity-bar',
          },
          h(
            'div',
            {
              className: 'gtd-desk__notes-slip',
              'data-role': 'focus-capacity-asof',
              'data-state': asOfSet ? 'set' : 'unset',
              style: deskText(12, 16),
            },
            asOfText,
          ),
          outsideText === null
            ? null
            : h(
                'div',
                {
                  className: 'gtd-desk__notes-slip',
                  'data-role': 'focus-capacity-outside',
                  'data-minutes': String(outsideMinutes),
                  style: deskText(12, 16),
                },
                outsideText,
              ),
        ),
      );
    }

    /**
     * 深度名额：灯座上一枚方形指示块（用掉就熄灭）。
     *
     * 数值仍然带可断言的 `data-used` / `data-total`，视觉上只是一块亮/暗。
     * @param {object} props - props：`today`、`capacity`、`t`、`geometry`。
     * @returns {object} React 元素。
     */
    function DeskQuota(props) {
      const t = props.t;
      const today = props.today !== null && typeof props.today === 'object' ? props.today : {};
      const capacity = props.capacity !== null && typeof props.capacity === 'object' ? props.capacity : {};
      const quotaTotal =
        typeof capacity.deepQuota === 'number' && Number.isFinite(capacity.deepQuota) ? capacity.deepQuota : 1;
      const quotaUsed = today.deepQuotaUsed === true ? 1 : 0;
      return h(
        'div',
        {
          className: 'gtd-desk__quota',
          'data-role': 'gtd-desk-quota',
          'data-on': quotaUsed > 0 ? '1' : '0',
          'aria-label': `${t('focusQuotaLabel')} ${quotaUsed}/${quotaTotal}`,
          style: deskBox(
            DESK_ART.quota.x + props.geometry.originX,
            DESK_ART.quota.y + props.geometry.originY,
            DESK_ART.quota.width,
            DESK_ART.quota.height,
          ),
        },
        h(
          'span',
          {
            className: 'gtd-desk__quota-stat',
            'data-role': 'focus-stat',
            'data-stat': 'deep-quota',
            style: VISUALLY_HIDDEN,
          },
          h('span', { 'data-role': 'focus-stat-label' }, t('focusQuotaLabel')),
          h(
            'span',
            {
              'data-role': 'focus-stat-value',
              'data-stat': 'deep-quota',
              'data-used': String(quotaUsed),
              'data-total': String(quotaTotal),
            },
            `${quotaUsed}/${quotaTotal}`,
          ),
        ),
      );
    }

    /**
     * 小旗：等待清单里「到期没回」的那几条。
     *
     * 桌上只插一面旗，旗面写「等回 N」；点开才列是哪几条（用户 2026-11-08 裁定）。
     * 它不占主位，也不写入任何东西。
     * @param {object} props - props：`reminders`、`t`、`open`、`onToggle`、`geometry`。
     * @returns {object} React 元素或 null。
     */
    function DeskFlag(props) {
      const t = props.t;
      const reminders = Array.isArray(props.reminders) ? props.reminders : [];
      if (reminders.length === 0) return null;
      const open = props.open === true;
      return h(
        'div',
        {
          className: 'gtd-desk__flag',
          'data-role': 'gtd-desk-flag',
          'data-state': open ? 'open' : 'closed',
          style: deskBox(DESK_ART.flag.x + props.geometry.originX, DESK_ART.flag.y + props.geometry.originY, DESK_ART.flag.width, DESK_ART.flag.height),
        },
        h(
          'button',
          {
            type: 'button',
            className: 'gtd-desk__flag-button',
            onClick: props.onToggle,
            'aria-expanded': open ? 'true' : 'false',
            style: deskText(12, 18),
          },
          h('span', { className: 'gtd-desk__flag-pole', 'aria-hidden': 'true' }),
          h(
            'span',
            {
              className: 'gtd-desk__flag-banner',
              'data-role': 'focus-reminders',
              'data-count': String(reminders.length),
            },
            fillTemplate(t('focusReminderFlag'), { count: reminders.length }),
          ),
        ),
        open
          ? h(
              'div',
              { className: 'gtd-desk__flag-list' },
              h('p', { className: 'gtd-desk__flag-heading', 'data-role': 'focus-reminders-heading' }, t('focusRemindersHeading')),
              h(
                'ul',
                { className: 'gtd-desk__flag-items' },
                reminders.map((item) =>
                  h(
                    'li',
                    {
                      key: item.id,
                      className: 'gtd-desk__flag-item',
                      'data-role': 'focus-reminder',
                      'data-note-ref': item.id,
                      style: deskText(12, 16),
                    },
                    h('span', { 'data-role': 'focus-reminder-title' }, item.title),
                    typeof item.replyDue === 'string' && item.replyDue.length > 0
                      ? h('span', { className: 'gtd-desk__flag-due', 'data-role': 'focus-reminder-due' }, item.replyDue)
                      : null,
                  ),
                ),
              ),
            )
          : null,
      );
    }

    /**
     * 桌沿两块标牌：六箱画布／焦点视图。
     *
     * 与外壳里的 `ViewSwitcher` 同一套角色（`view-switch-*`），只是换成了桌面上的牌子——
     * 切视图不会一半是像素工位、一半是网页标签（规格故事 22）。
     * @param {object} props - props：`t`、`mode`、`onChange`。
     * @returns {object} React 元素。
     */
    function DeskViewSwitch(props) {
      const t = props.t;
      const mode = props.mode === VIEW_MODE.CANVAS ? VIEW_MODE.CANVAS : VIEW_MODE.FOCUS;
      const plaque = (entry) =>
        h(
          'button',
          {
            type: 'button',
            key: entry.key,
            className: 'gtd-desk__plaque',
            'data-role': `view-switch-${entry.key}`,
            'data-active': mode === entry.key ? 'true' : 'false',
            onClick: () => props.onChange(entry.key),
            style: deskText(12, 18),
          },
          entry.label,
        );
      return h(
        'div',
        { className: 'gtd-desk__plaques', 'data-role': 'view-switch', 'data-view': mode },
        viewSwitchEntries(t).map(plaque),
      );
    }

    /**
     * 行动卡（主位）：一条动作立在桌面上。
     *
     * 卡上写的是那条动作自己的内容（GLOSSARY「行动卡」），**不新造一个卡对象**。
     * 标题最大、完成时限是卡上一枚标签、完成要求是正文；预计耗时与容量判定在桌左小屏上
     * （ADR-0012 修订 2）。缺哪一样就少一块，整卡永远在。
     * @param {object} props - props：`card`、`t`、`onOpenNote`、写口回调、`stamp`、`onStamp`、版面。
     * @returns {object} React 元素。
     */
    function DeskActionCard(props) {
      const t = props.t;
      const card = props.card;
      const requirement = card.requirement !== null && typeof card.requirement === 'object' ? card.requirement : {};
      const requirementText =
        typeof requirement.text === 'string' && requirement.text.length > 0 ? requirement.text : null;
      const requirementSource =
        typeof requirement.source === 'string' && requirement.source.length > 0 ? requirement.source : null;
      const project =
        card.project !== null && typeof card.project === 'object' && typeof card.project.name === 'string'
          ? card.project
          : null;
      const band = typeof card.timeBand === 'string' && card.timeBand.length > 0 ? card.timeBand : null;
      const dueText = typeof card.dueLocal === 'string' && card.dueLocal.length > 0 ? card.dueLocal : '—';
      /* v2:two-minute 两分钟卡（issue #11）：Host 说了算这张卡是不是两分钟卡。
         用户 2026-11-08 裁定：引导做成卡上一角的小纸条，不另造桌面道具。 */
      const twoMinute = card.twoMinute === true;

      /* v2:write 写口：状态住在外壳里，这里只把它画出来。 */
      const write = props.write !== null && typeof props.write === 'object' ? props.write : null;
      const mine = write !== null && write.taskId === card.id ? write : null;
      const pending = mine !== null && mine.status === 'pending';
      const isRescheduleWrite = mine !== null && mine.action === 'reschedule';
      const pendingComplete = pending && !isRescheduleWrite;
      const pendingReschedule = pending && isRescheduleWrite;

      /* v2:write 改期：日期编辑器开合是**视图内状态**（点开、取消都不写任何东西）。 */
      const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
      const [needDate, setNeedDate] = React.useState(false);
      const dateInputRef = React.useRef(null);
      const initialDueDate =
        typeof card.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(card.dueDate) ? card.dueDate : '';
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
       * 提交改期：值在**提交那一刻**从 DOM 上读（`<input type="date">` 的形状就是 `YYYY-MM-DD`）。
       * @param {object} event - 事件。
       * @returns {void} 无。
       */
      const submitReschedule = (event) => {
        const input = dateInputRef.current;
        const dueDate = input === null ? '' : String(input.value ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
          setNeedDate(true);
          return;
        }
        setNeedDate(false);
        const taskId = taskIdOf(event);
        if (taskId === null) return;
        if (typeof props.onStamp === 'function') props.onStamp(taskId, 'reschedule');
        if (typeof props.onReschedule === 'function') props.onReschedule(taskId, dueDate);
      };

      const stamp =
        props.stamp !== null &&
        typeof props.stamp === 'object' &&
        props.stamp.id === card.id &&
        (props.stamp.kind === 'complete' || props.stamp.kind === 'reschedule')
          ? props.stamp.kind
          : null;

      /* 竖版卡：200×280 美术像素，立在桌面上；按下去盖印章，写成功、新快照回来时整张卡被抽走。 */
      const cardStyle = Object.assign(
        deskBox(props.geometry.cardLeft, DESK_ART.card.y + props.geometry.originY, props.geometry.cardWidth, DESK_ART.card.height),
        { backgroundImage: `url(${DESK_PAPER_URL})` },
      );

      return h(
        'article',
        {
          className: 'gtd-desk__card',
          'data-role': 'focus-card',
          'data-note-ref': card.id,
          'data-band': band === null ? '' : band,
          'data-state': twoMinute ? 'two-minute' : 'normal',
          style: cardStyle,
          onPointerDown: (event) => {
            if (typeof props.onSwipeStart === 'function') props.onSwipeStart(event);
          },
          onPointerUp: (event) => {
            if (typeof props.onSwipeEnd === 'function') props.onSwipeEnd(event);
          },
        },
        /* 两分钟卡：卡上一角的小纸条（描边纸片，不是又一排按钮）。 */
        twoMinute
          ? h(
              'span',
              {
                className: 'gtd-desk__two-minute',
                'data-role': 'focus-card-two-minute',
                'data-state': 'two-minute',
                style: deskText(12, 16),
              },
              t('focusCardTwoMinute'),
            )
          : null,
        h(
          'h2',
          { className: 'gtd-desk__card-title', 'data-role': 'focus-card-title' },
          h(
            'button',
            {
              type: 'button',
              className: 'gtd-desk__card-open',
              'data-role': 'focus-card-open',
              'aria-label': `${t('focusCardWorkLabel')} ${card.title}`,
              title: card.title,
              onClick: () => {
                if (typeof props.onOpenNote === 'function') props.onOpenNote(card);
              },
              style: deskText(24, 26),
            },
            card.title,
          ),
        ),
        /* 「各行」保留原有的语义角色：facts 与每一行 fact。估算／容量已经移到小屏上。 */
        h(
          'div',
          { className: 'gtd-desk__card-facts', 'data-role': 'focus-card-facts' },
          h(
            'div',
            { className: 'gtd-desk__card-fact', 'data-role': 'focus-card-fact', 'data-fact': 'due' },
            h(
              'div',
              { className: 'gtd-desk__card-due-row' },
              h(
                'span',
                {
                  className: 'gtd-desk__card-tag',
                  'data-role': 'focus-card-due',
                  'data-overdue': card.overdue === true ? 'true' : 'false',
                  style: deskText(12, 16),
                },
                dueText,
                card.overdue === true
                  ? h(
                      'span',
                      { className: 'gtd-desk__card-overdue', 'data-role': 'focus-card-overdue' },
                      ` · ${t('focusCardOverdue')}`,
                    )
                  : null,
              ),
            ),
          ),
          requirementText === null
            ? null
            : h(
                'div',
                { className: 'gtd-desk__card-fact', 'data-role': 'focus-card-fact', 'data-fact': 'requirement' },
                h(
                  'div',
                  { className: 'gtd-desk__card-req' },
                  h(
                    'span',
                    { className: 'gtd-desk__card-req-key', style: deskText(12, 18) },
                    t('focusCardRequirementLabel'),
                  ),
                  h(
                    'p',
                    {
                      className: 'gtd-desk__card-req-text',
                      'data-role': 'focus-card-requirement',
                      style: deskText(12, 18),
                    },
                    requirementText,
                    requirementSource === null
                      ? null
                      : h(
                          'span',
                          {
                            className: 'gtd-desk__card-req-source',
                            'data-role': 'focus-card-requirement-source',
                            style: deskText(12, 18),
                          },
                          fillTemplate(t('focusRequirementFrom'), { source: requirementSource }),
                        ),
                  ),
                ),
              ),
        ),
        /* 写口那一行：完成（实心）与改期（描边）是两个写口，跳过是零写入的弱化项。 */
        h(
          'div',
          { className: 'gtd-desk__card-actions', 'data-role': 'focus-card-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'gtd-desk__btn gtd-desk__btn--solid',
              'data-role': 'focus-card-complete',
              'data-state': pendingComplete ? 'pending' : 'idle',
              disabled: pending,
              'aria-busy': pendingComplete ? 'true' : 'false',
              onClick: (event) => {
                const taskId = taskIdOf(event);
                if (taskId === null) return;
                if (typeof props.onStamp === 'function') props.onStamp(taskId, 'complete');
                if (typeof props.onComplete === 'function') props.onComplete(taskId);
              },
              style: deskText(12, 18),
            },
            pendingComplete ? t('focusCompletePending') : t('focusCompleteLabel'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'gtd-desk__btn',
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
              style: deskText(12, 18),
            },
            pendingReschedule ? t('focusReschedulePending') : t('focusRescheduleLabel'),
          ),
          h('span', { className: 'gtd-desk__card-sep', 'data-role': 'focus-card-actions-sep', 'aria-hidden': 'true' }),
          h(
            'button',
            {
              type: 'button',
              className: 'gtd-desk__skip',
              'data-role': 'focus-card-skip',
              'data-state': 'idle',
              onClick: (event) => {
                const taskId = taskIdOf(event);
                if (taskId === null) return;
                if (typeof props.onSkip === 'function') props.onSkip(card);
              },
              style: deskText(12, 16),
            },
            t('focusSkipLabel'),
          ),
          h(
            'span',
            { className: 'gtd-desk__skip-note', 'data-role': 'focus-card-skip-note', style: deskText(12, 16) },
            t('focusSkipNote'),
          ),
        ),
        /* 写口的话：失败原因／写成了但刷新失败——说清楚，不让人猜。 */
        mine !== null && mine.status !== 'pending'
          ? h(
              'div',
              {
                className: 'gtd-desk__card-status',
                'data-role': 'focus-card-write-status',
                style: deskText(12, 18),
              },
              mine.status === 'failed'
                ? h(
                    'p',
                    {
                      className: 'gtd-desk__card-status-text',
                      'data-role': isRescheduleWrite ? 'focus-reschedule-error' : 'focus-complete-error',
                      'data-code': typeof mine.code === 'string' ? mine.code : '',
                    },
                    typeof mine.message === 'string' ? mine.message : '',
                    typeof mine.code === 'string' && mine.code.length > 0
                      ? h(
                          'span',
                          {
                            className: 'gtd-desk__card-status-code',
                            'data-role': isRescheduleWrite ? 'focus-reschedule-error-code' : 'focus-complete-error-code',
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
                      className: 'gtd-desk__card-status-text',
                      'data-role': isRescheduleWrite ? 'focus-reschedule-refresh-failed' : 'focus-complete-refresh-failed',
                    },
                    isRescheduleWrite ? t('focusRescheduleRefreshFailed') : t('focusCompleteRefreshFailed'),
                    typeof mine.message === 'string' && mine.message.length > 0
                      ? h(
                          'span',
                          {
                            className: 'gtd-desk__card-status-code',
                            'data-role': isRescheduleWrite ? 'focus-reschedule-refresh-detail' : 'focus-complete-refresh-detail',
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
                      className: 'gtd-desk__card-status-retry',
                      'data-role': isRescheduleWrite ? 'focus-reschedule-refresh' : 'focus-complete-refresh',
                      onClick: () => {
                        if (typeof props.onRefresh === 'function') props.onRefresh();
                      },
                    },
                    t('refresh'),
                  )
                : null,
            )
          : null,
        /* 改期编辑器：点开才在；取消不写任何东西。 */
        rescheduleOpen
          ? h(
              'div',
              { className: 'gtd-desk__card-editor', 'data-role': 'focus-card-reschedule-editor', style: deskText(12, 16) },
              h('span', { 'data-role': 'focus-card-reschedule-date-label' }, t('focusRescheduleDateLabel')),
              h('input', {
                type: 'date',
                className: 'gtd-desk__date',
                'data-role': 'focus-card-reschedule-date',
                'aria-label': t('focusRescheduleDateLabel'),
                ref: dateInputRef,
                defaultValue: initialDueDate,
                disabled: pendingReschedule,
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gtd-desk__btn gtd-desk__btn--compact',
                  'data-role': 'focus-card-reschedule-submit',
                  disabled: pendingReschedule,
                  onClick: submitReschedule,
                },
                pendingReschedule ? t('focusReschedulePending') : t('focusRescheduleSubmit'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gtd-desk__skip',
                  'data-role': 'focus-card-reschedule-cancel',
                  onClick: () => {
                    setRescheduleOpen(false);
                    setNeedDate(false);
                  },
                },
                t('focusRescheduleCancel'),
              ),
              needDate
                ? h(
                    'p',
                    { className: 'gtd-desk__card-status-text', 'data-role': 'focus-reschedule-need-date' },
                    t('focusRescheduleNeedDate'),
                  )
                : null,
            )
          : null,
        /* 卡脚：这一件挂在哪个项目上。推不出就不画这一行——缺就是缺，不编。 */
        project === null
          ? null
          : h(
              'div',
              { className: 'gtd-desk__card-foot', 'data-role': 'focus-card-foot', style: deskText(12, 16) },
              h('span', { 'data-role': 'focus-card-foot-label' }, `${t('focusCardFootProjectLabel')} `),
              h(
                'span',
                { 'data-role': 'focus-card-foot-project', 'data-record': project.record },
                project.name,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gtd-desk__card-foot-link',
                  'data-role': 'focus-card-foot-project-link',
                  onClick: () => {
                    if (typeof props.onOpenProject === 'function') props.onOpenProject(project);
                  },
                },
                t('focusCardFootProjectLink'),
              ),
            ),
        /* 印章：完成／改期按下去之后盖在卡上；写成功、新快照回来时整张卡被抽走。 */
        stamp === null
          ? null
          : h(
              'span',
              {
                className: 'gtd-desk__stamp',
                'data-role': 'gtd-desk-stamp',
                'data-stamp': stamp,
                'aria-hidden': 'true',
                style: deskText(24, 28),
              },
              stamp === 'complete' ? t('focusCompleteLabel') : t('focusRescheduleLabel'),
            ),
      );
    }

    /**
     * 空白卡：灯下没有该做的事。
     * @param {object} props - props：`t`、`pending`、版面。
     * @returns {object} React 元素。
     */
    function DeskBlankCard(props) {
      const pending = props.pending === true;
      return h(
        'article',
        {
          className: 'gtd-desk__card gtd-desk__card--blank',
          'data-role': 'focus-card',
          'data-state': pending ? 'pending' : 'empty',
          style: deskBox(props.geometry.cardLeft, DESK_ART.card.y + props.geometry.originY, props.geometry.cardWidth, DESK_ART.card.height),
        },
        h(
          'p',
          {
            className: 'gtd-desk__card-empty',
            'data-role': pending ? 'focus-view-pending' : 'focus-card-empty',
            style: deskText(12, 18),
          },
          pending ? props.t('focusViewPending') : props.t('focusCardEmpty'),
        ),
      );
    }

    /**
     * 失败纸条：取数失败／未登录时压在卡上的那张纸。
     *
     * 与外壳的失败面同一套文案与角色（`error-heading`／`error-message`／`login-prompt`／
     * `login-command`／`retry`），只是外观换成了桌上的一张纸。
     * @param {object} props - props：`error`、`t`、`onRetry`、版面。
     * @returns {object} React 元素。
     */
    function DeskFailureCard(props) {
      const t = props.t;
      const { message, needsLogin } = failureInfoOf(props.error);
      return h(
        'article',
        {
          className: 'gtd-desk__card gtd-desk__card--failure',
          'data-role': 'focus-card',
          'data-state': 'error',
          style: deskBox(props.geometry.cardLeft, DESK_ART.card.y + props.geometry.originY, props.geometry.cardWidth, DESK_ART.card.height),
        },
        h(
          'div',
          { className: 'gtd-desk__note', 'data-role': 'gtd-desk-error-note', style: deskText(12, 18) },
          h(
            'p',
            { className: 'gtd-desk__note-heading', 'data-role': 'error-heading' },
            t(needsLogin ? 'loginHeading' : 'errorHeading'),
          ),
          needsLogin
            ? h(
                'p',
                { className: 'gtd-desk__note-text', 'data-role': 'login-prompt' },
                t('loginHint'),
                h('code', { className: 'gtd-desk__note-code', 'data-role': 'login-command' }, LOGIN_COMMAND),
              )
            : null,
          message.length > 0
            ? h('p', { className: 'gtd-desk__note-text', 'data-role': 'error-message' }, message)
            : null,
          h(
            'button',
            {
              type: 'button',
              className: 'gtd-desk__btn gtd-desk__btn--compact',
              'data-role': 'retry',
              onClick: props.onRetry,
            },
            t('retry'),
          ),
        ),
      );
    }

    /**
     * 卡夹：「接下来」的实体形态。
     *
     * 只写标题与时限；点一张就抽到主位——**纯视图状态，零写入**。
     * @param {object} props - props：`items`、`t`、`onPick`、`geometry`。
     * @returns {object} React 元素。
     */
    function DeskHolder(props) {
      const t = props.t;
      const items = Array.isArray(props.items) ? props.items : [];
      return h(
        'div',
        {
          className: 'gtd-desk__holder',
          'data-role': 'gtd-desk-holder',
          style: deskBox(
            DESK_ART.holder.x + props.geometry.originX,
            DESK_ART.holder.y + props.geometry.originY,
            DESK_ART.holder.width,
            DESK_ART.holder.height,
          ),
        },
        h(
          'section',
          { className: 'gtd-desk__holder-body', 'data-role': 'focus-next', 'data-count': String(items.length) },
          h(
            'div',
            { className: 'gtd-desk__holder-head', 'data-role': 'focus-next-head', style: deskText(12, 14) },
            h('span', { 'data-role': 'focus-next-heading' }, t('focusNextHeading')),
            h(
              'span',
              { className: 'gtd-desk__holder-count', 'data-role': 'focus-next-count' },
              `${items.length} ${t('countUnit')}`,
            ),
          ),
          items.length === 0
            ? h(
                'p',
                { className: 'gtd-desk__holder-empty', 'data-role': 'focus-next-empty', style: deskText(12, 16) },
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
                    className: 'gtd-desk__slot',
                    'data-role': 'focus-next-item',
                    'data-note-ref': item.id,
                    'data-band': band === null ? '' : band,
                    'data-order': String(index + 1),
                    title: `${item.title}｜${t('focusNextHint')}`,
                    onClick: () => props.onPick(item),
                    style: deskText(12, 14),
                  },
                  h('span', { className: 'gtd-desk__slot-title', 'data-role': 'focus-next-title' }, item.title),
                  h('span', { className: 'gtd-desk__slot-due', 'data-role': 'focus-next-due' }, due),
                );
              }),
        ),
      );
    }

    /**
     * 下钻层：六箱全景，覆盖焦点区主位。
     *
     * 画布是 v1 的原样（纸箱、便贴、箱签、已沉底、规则角标全在），只是退到幕后。
     * 它**不在工位子树里**，所以照旧走宿主令牌。
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
            focusContainer: props.focusContainer,
          }),
        ),
      );
    }

    /**
     * 焦点视图：像素工位（v3 默认视图）。
     *
     * 工位根 `gtd-desk` → 暗房间与桌面（`gtd-desk-room`／`gtd-desk-tabletop`）→
     * 桌面场景（`gtd-desk-scene`）→ 台灯与深度指示块 → 小屏 → 卡夹 → 便签叠 → 小旗 →
     * 行动卡 → 桌沿标牌 → 抽屉 → 开关。下钻层在工位**外面**，仍是 v1 画布。
     *
     * 换主卡（点卡夹、左右划）与下钻都是**视图内状态**，不写任何数据（ADR-0006）。
     * @param {object} props - props：`snapshot`、`t`、`motions`、`onOpenNote`、`onReload`、
     *   `write`、`onComplete`、`onReschedule`、`onSkip`、`skipped`、`viewMode`、`onViewChange`、
     *   `error`、`onRetry`。
     * @returns {object} React 元素。
     */
    function FocusView(props) {
      const t = props.t;
      const snapshot =
        props.snapshot !== null && typeof props.snapshot === 'object' ? props.snapshot : EMPTY_SNAPSHOT;
      const focus =
        snapshot.focus !== null && typeof snapshot.focus === 'object' && !Array.isArray(snapshot.focus)
          ? snapshot.focus
          : null;
      const today = snapshot.today !== null && typeof snapshot.today === 'object' ? snapshot.today : {};
      const capacity =
        snapshot.capacity !== null && typeof snapshot.capacity === 'object' ? snapshot.capacity : {};
      const error = props.error !== null && typeof props.error === 'object' ? props.error : null;

      /* 像素网格按容器量：窗口或面板变化时重新取整（字号与网格同倍数）。 */
      const rootRef = React.useRef(null);
      const [viewport, setViewport] = React.useState(() => deskViewportOf(null));
      React.useEffect(() => {
        const measure = () => {
          const next = deskViewportOf(rootRef.current);
          setViewport((previous) =>
            previous.width === next.width && previous.height === next.height && previous.dpr === next.dpr
              ? previous
              : next,
          );
        };
        measure();
        const hasWindowEvents =
          typeof window !== 'undefined' && window !== null && typeof window.addEventListener === 'function';
        if (hasWindowEvents) window.addEventListener('resize', measure);
        let observer = null;
        if (typeof ResizeObserver === 'function' && rootRef.current !== null) {
          observer = new ResizeObserver(measure);
          observer.observe(rootRef.current);
        }
        return () => {
          if (hasWindowEvents) window.removeEventListener('resize', measure);
          if (observer !== null) observer.disconnect();
        };
      }, []);
      const geometry = deskGeometryOf(viewport);

      /* 视图内状态：换过的主卡与队列、来路、下钻开关、便签叠／小旗开合、印章。刷新换快照时一并复位。 */
      const [override, setOverride] = React.useState(null);
      const [drilled, setDrilled] = React.useState(false);
      const [drillFocus, setDrillFocus] = React.useState(null);
      const [history, setHistory] = React.useState([]);
      const [notesOpen, setNotesOpen] = React.useState(false);
      const [flagOpen, setFlagOpen] = React.useState(false);
      const [stamp, setStamp] = React.useState(null);
      const swipeRef = React.useRef(null);
      React.useEffect(() => {
        setOverride(null);
        setDrilled(false);
        setDrillFocus(null);
        setHistory([]);
        setNotesOpen(false);
        setFlagOpen(false);
        setStamp(null);
      }, [snapshot]);

      /* 写失败时把印章撤掉：盖了章又没写成，会让人以为已经结算了。 */
      React.useEffect(() => {
        if (stamp === null) return;
        const write = props.write !== null && typeof props.write === 'object' ? props.write : null;
        if (write !== null && write.status === 'failed' && write.taskId === stamp.id) setStamp(null);
      }, [props.write, stamp]);

      const baseCard = focus !== null && focus.card !== null && typeof focus.card === 'object' ? focus.card : null;
      const baseNext = focus !== null && Array.isArray(focus.next) ? focus.next : [];

      /* 跳过（issue #10）：本次会话里被跳过的那几条——**插回卡夹末尾**，不是消失
         （issue #13 故事 14）。纯视图状态，不落任何本地存储；刷新页面回到原位。 */
      const skippedCards = Array.isArray(props.skipped)
        ? props.skipped.filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.id === 'string')
        : [];
      const skippedIds = new Set(skippedCards.map((entry) => entry.id));
      const isSkipped = (id) => typeof id === 'string' && skippedIds.has(id);

      /* 主卡与队列：被跳过的卡不占主位，但**插回卡夹末尾**；点它仍可抽回主位。 */
      const overrideCard = override !== null ? override.card : null;
      const sourceQueue = override !== null ? override.queue : baseNext;
      /* 先在原位置去掉被跳过的那些，再统一追加到末尾——避免同一张卡出现两遍。 */
      const basePool = sourceQueue.filter((entry) => !isSkipped(entry.id));
      const appended = skippedCards.filter((entry) => !basePool.some((other) => other.id === entry.id));
      const pool = [...basePool, ...appended];
      const fallbackCard =
        override !== null ? null : baseCard !== null && !isSkipped(baseCard.id) ? baseCard : null;
      const wanted = overrideCard !== null ? overrideCard : fallbackCard;
      const hadCard = overrideCard !== null || baseCard !== null;
      /* 主卡被跳过时顺延到卡夹里第一张**没被跳过**的；全都跳过就空着。 */
      const firstAvailable = pool.find((entry) => !isSkipped(entry.id)) ?? null;
      const card = wanted !== null ? wanted : hadCard ? firstAvailable : null;
      const queue = card !== null ? pool.filter((entry) => entry.id !== card.id) : pool;

      /**
       * 点一条卡夹里的卡：把它抽到主位，原来的主卡插回队列最前面。
       * @param {object} item - 被点的那条。
       */
      const pickFromQueue = (item) => {
        const rest = queue.filter((entry) => entry.id !== item.id);
        if (card !== null) setHistory((previous) => [card, ...previous].slice(0, 8));
        setOverride({ card: item, queue: card === null ? rest : [card, ...rest] });
      };

      /**
       * 跳过当前这张：记进本次会话的「已跳过」清单（外壳保管），主卡换到下一张；
       * 被跳过的那张会插回卡夹末尾。零请求、零写入。
       * @param {object} target - 被跳过的行动卡。
       */
      const skipCard = (target) => {
        if (target === null || typeof target !== 'object') return;
        if (typeof props.onSkip === 'function') props.onSkip(target);
        setOverride(null);
      };

      /** 左划／→：换到卡夹里的下一张（零写入）。 */
      const swipeNext = () => {
        if (queue.length === 0) return;
        pickFromQueue(queue[0]);
      };

      /** 右划／←：回到上一张（零写入）。 */
      const swipePrevious = () => {
        if (history.length === 0) return;
        const [previous, ...rest] = history;
        setHistory(rest);
        setOverride({ card: previous, queue: card === null ? queue : [card, ...queue] });
      };

      /**
       * 按下手指：记下起点。
       * @param {object} event - pointerdown。
       */
      const onSwipeStart = (event) => {
        swipeRef.current = { x: event.clientX, y: event.clientY };
      };

      /**
       * 松手：横向拖过 40 个 CSS 像素才换卡；纵向手势与轻点都不算。
       * @param {object} event - pointerup。
       */
      const onSwipeEnd = (event) => {
        const start = swipeRef.current;
        swipeRef.current = null;
        if (start === null) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) swipeNext();
        else swipePrevious();
      };

      /* v2:project 点卡脚的项目指针 → 打开下钻层，并把项目箱摆在那儿（故事 23）。 */
      const openProject = () => {
        setDrillFocus('project');
        setDrilled(true);
      };

      /**
       * 按下完成／改期：先盖章，再走既有的写口。卡被抽走发生在写成功、新快照回来的时候。
       * @param {string} taskId - 目标动作 id。
       * @param {'complete' | 'reschedule'} kind - 哪个写口。
       */
      const onStamp = (taskId, kind) => {
        setStamp({ id: taskId, kind });
      };

      const status = error !== null ? 'error' : focus === null ? 'pending' : 'ready';
      /* 窄窗：桌沿三件套（标牌／抽屉／开关）按可见宽度重新排，别被裁到屏幕外。 */
      const plaquesX = geometry.narrow ? 8 : DESK_ART.plaques.x + geometry.originX;
      const drawerX = geometry.narrow
        ? Math.max(196, Math.floor((geometry.viewWidth - DESK_ART.drawer.width) / 2))
        : DESK_ART.drawer.x + geometry.originX;
      const powerX = geometry.narrow
        ? Math.max(8, geometry.viewWidth - DESK_ART.power.width - 8)
        : DESK_ART.power.x + geometry.originX;

      /* 工位上的东西，按前后关系排：房间 → 场景 → 灯 → 小屏 → 卡夹 → 便签叠 → 小旗 → 卡 → 桌沿。 */
      const deskChildren = [
        h(
          'div',
          {
            key: 'room',
            className: 'gtd-desk__room',
            'data-role': 'gtd-desk-room',
            'aria-hidden': 'true',
            style: deskBox(0, geometry.originY, geometry.boardWidth, geometry.boardHeight),
          },
          h('span', {
            className: 'gtd-desk__wall-upper',
            style: deskBox(0, geometry.originY, geometry.boardWidth, 40),
          }),
          h('span', {
            className: 'gtd-desk__wall',
            style: deskBox(0, geometry.originY + 40, geometry.boardWidth, 100),
          }),
          h('span', {
            className: 'gtd-desk__tabletop',
            'data-role': 'gtd-desk-tabletop',
            style: deskBox(0, geometry.originY + 140, geometry.boardWidth, 250),
          }),
          h('span', {
            className: 'gtd-desk__tabletop-edge',
            style: deskBox(0, geometry.originY + 140, geometry.boardWidth, 5),
          }),
          h('span', {
            className: 'gtd-desk__front',
            style: deskBox(0, geometry.originY + 390, geometry.boardWidth, Math.max(0, geometry.boardHeight - 390)),
          }),
          h('span', {
            className: 'gtd-desk__front-edge',
            style: deskBox(0, geometry.originY + 390, geometry.boardWidth, 4),
          }),
        ),
        h('img', {
          key: 'scene',
          className: 'gtd-desk__scene',
          'data-role': 'gtd-desk-scene',
          alt: '',
          draggable: false,
          src: DESK_SCENE_URL,
          style: {
            position: 'absolute',
            left: `calc(var(--gtd-u) * ${geometry.originX})`,
            top: `calc(var(--gtd-u) * ${geometry.originY})`,
            width: `calc(var(--gtd-u) * ${DESK_ART.width})`,
            height: `calc(var(--gtd-u) * ${DESK_ART.height})`,
            imageRendering: 'pixelated',
            pointerEvents: 'none',
            userSelect: 'none',
          },
        }),
        h('div', {
          key: 'lamp',
          className: 'gtd-desk__lamp',
          'data-role': 'gtd-desk-lamp',
          'aria-hidden': 'true',
          style: deskBox(
            DESK_ART.lamp.x + geometry.originX,
            DESK_ART.lamp.y + geometry.originY,
            DESK_ART.lamp.width,
            DESK_ART.lamp.height,
          ),
        }),
      ];

      if (error === null) {
        const timelineToday =
          snapshot.timeline !== null && typeof snapshot.timeline === 'object' ? snapshot.timeline.today : null;
        deskChildren.push(
          h(DeskQuota, { key: 'quota', today, capacity, t, geometry }),
          h(DeskScreen, { key: 'screen', card, today, timelineToday, t, geometry, pending: focus === null }),
          /* 窄窗：卡和小屏优先，卡夹／便签叠／小旗收起来（换卡仍可左右划）。 */
          geometry.narrow
            ? null
            : h(DeskHolder, { key: 'holder', items: queue, t, onPick: pickFromQueue, geometry }),
          geometry.narrow
            ? null
            : h(DeskNotes, {
                key: 'notes',
                today,
                capacity,
                t,
                open: notesOpen,
                onToggle: () => setNotesOpen((open) => !open),
                geometry,
              }),
          geometry.narrow
            ? null
            : h(DeskFlag, {
                key: 'flag',
                reminders: focus !== null && Array.isArray(focus.reminders) ? focus.reminders : [],
                t,
                open: flagOpen,
                onToggle: () => setFlagOpen((open) => !open),
                geometry,
              }),
        );
      }

      if (error !== null) {
        deskChildren.push(
          h(DeskFailureCard, {
            key: 'failure-card',
            error,
            t,
            onRetry: props.onRetry,
            geometry,
          }),
        );
      } else if (card !== null) {
        deskChildren.push(
          h(DeskActionCard, {
            key: card.id,
            card,
            t,
            onOpenNote: props.onOpenNote,
            write: props.write,
            onComplete: props.onComplete,
            onReschedule: props.onReschedule,
            onSkip: skipCard,
            onRefresh: props.onReload,
            onOpenProject: openProject,
            stamp,
            onStamp,
            onSwipeStart,
            onSwipeEnd,
            geometry,
          }),
        );
      } else {
        deskChildren.push(
          h(DeskBlankCard, {
            key: 'blank-card',
            t,
            pending: focus === null,
            geometry,
          }),
        );
      }

      if (error === null && skippedCards.length > 0) {
        deskChildren.push(
          h(
            'p',
            {
              key: 'skip-notice',
              className: 'gtd-desk__skip-notice',
              'data-role': 'focus-skip-notice',
              style: Object.assign(
                geometry.narrow
                  ? deskBox(8, geometry.originY + 340, 150, 30)
                  : deskBox(18 + geometry.originX, geometry.originY + 352, 180, 32),
                deskText(12, 16),
              ),
            },
            t('focusSkipNotice'),
          ),
        );
      }

      deskChildren.push(
        /* 桌沿两块标牌：切视图不再是网页标签（故事 22）。 */
        h(
          'div',
          {
            key: 'plaques',
            className: 'gtd-desk__plaques-wrap',
            'data-role': 'gtd-desk-plaques',
            style: deskBox(
              plaquesX,
              DESK_ART.plaques.y + geometry.originY,
              DESK_ART.plaques.width,
              DESK_ART.plaques.height,
            ),
          },
          h(DeskViewSwitch, { t, mode: props.viewMode, onChange: props.onViewChange }),
        ),
        /* 桌下抽屉：六箱全景的入口。失败时不拉抽屉——那会是一张空画布，像「今天没活」。 */
        error !== null
          ? null
          : h(
          'div',
          {
            key: 'drawer',
            className: 'gtd-desk__drawer-wrap',
            'data-role': 'gtd-desk-drawer',
            style: deskBox(
              drawerX,
              DESK_ART.drawer.y + geometry.originY,
              DESK_ART.drawer.width,
              DESK_ART.drawer.height,
            ),
          },
          h(
            'button',
            {
              type: 'button',
              className: 'gtd-desk__drawer',
              'data-role': 'focus-drill-entry',
              title: t('focusDrillEntry'),
              'aria-label': t('focusDrillEntry'),
              onClick: () => setDrilled(true),
              style: deskText(12, 18),
            },
            h('span', { 'data-role': 'focus-drill-entry-label' }, t('focusDrillTitle')),
          ),
        ),
        /* 桌角开关：刷新。 */
        h(
          'div',
          {
            key: 'power',
            className: 'gtd-desk__switch-wrap',
            'data-role': 'gtd-desk-switch',
            style: deskBox(
              powerX,
              DESK_ART.power.y + geometry.originY,
              DESK_ART.power.width,
              DESK_ART.power.height,
            ),
          },
          h(
            'button',
            {
              type: 'button',
              className: 'gtd-desk__power',
              'data-role': 'refresh',
              onClick: () => {
                if (typeof props.onReload === 'function') props.onReload();
              },
              style: deskText(12, 18),
            },
            t('refresh'),
          ),
        ),
      );

      return h(
        'div',
        {
          className: 'gtd-focus-view',
          'data-role': 'focus-view',
          'data-state': status,
          ref: rootRef,
          style: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
            background: 'transparent',
          },
        },
        h(
          'div',
          {
            className: 'gtd-desk',
            'data-role': 'gtd-desk',
            'data-scale': String(geometry.scale),
            'data-layout': geometry.narrow ? 'narrow' : 'wide',
            'data-art-width': String(geometry.boardWidth),
            'data-art-height': String(geometry.boardHeight),
            'data-card-width': String(geometry.cardWidth),
            style: Object.assign({}, DESK_PALETTE, {
              '--gtd-u': `${geometry.unit}px`,
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              overflow: 'hidden',
              background: 'var(--gtd-room)',
            }),
          },
          deskChildren,
        ),
        /* 下钻层在工位外面：它是 v1 画布，照旧走宿主令牌。 */
        drilled
          ? h(FocusDrill, {
              open: drilled,
              snapshot,
              t,
              motions: props.motions,
              onOpenNote: props.onOpenNote,
              focusContainer: drillFocus,
              onClose: () => setDrilled(false),
            })
          : null,
      );
    }
    /* v3:desk end */


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
       * 这里只记一笔「本次会话里把它插回卡夹末尾」，不请求、不落盘。
       * 记的是**卡本身**而不是 id：卡夹末尾要能把它再画出来（issue #13 故事 14）。
       * @param {object} card - 被跳过的行动卡。
       * @returns {void} 无。
       */
      const skipTask = React.useCallback((card) => {
        if (card === null || typeof card !== 'object' || typeof card.id !== 'string' || card.id.length === 0) return;
        setSkipped((previous) => [...previous.filter((entry) => entry.id !== card.id), card]);
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
        /* 画布视图的失败面照旧是网页面板；焦点视图的失败面是**压在工位卡上的一张纸**（故事 24）。
           两个视图的失败面说的是同一套文案，只是呈现不同。 */
        if (viewMode === VIEW_MODE.CANVAS) {
          return h(WorkbenchFailure, { t, error: state.error, onRetry: load });
        }
        const { code: failureCode, needsLogin } = failureInfoOf(state.error);
        return h(
          'div',
          {
            className: 'gtd-workbench',
            'data-role': 'panel',
            'data-state': needsLogin ? 'not-authenticated' : 'error',
            'data-error-code': failureCode,
            'data-view': viewMode,
            style: {
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
            },
          },
          h(FocusView, {
            snapshot: null,
            t,
            motions,
            error: state.error,
            onRetry: load,
            onReload: load,
            viewMode,
            onViewChange: setViewMode,
            onOpenNote: openNoteById,
            write,
            onComplete: completeTask,
            onReschedule: rescheduleTask,
            onSkip: skipTask,
            skipped,
          }),
        );
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
        /* 焦点视图不要网页标签：切视图与刷新都是桌沿/桌角上的东西（故事 22）。
           画布视图照旧有这一条标题栏。 */
        viewMode === VIEW_MODE.CANVAS
          ? h(
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
        )
          : null,
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
            /* v3:desk 视图层把「怎么切视图」与「切到哪」也递下去：焦点视图里标签牌要能切回画布。 */
            viewMode,
            onViewChange: setViewMode,
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
@font-face {
  font-family: 'GtdPixelFusion';
  src: url('/gtd-workbench/assets/fonts/fusion-pixel-12px.woff2') format('woff2');
  font-style: normal;
  font-weight: 400;
  font-display: block;
}
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
/* v3:desk 焦点视图是像素工位：工位子树自带字体与色板，**不用**宿主令牌（ADR-0012）。
   下面这一段（从 .gtd-desk 开始）里不出现 --dsw-alias-*；六箱画布与下钻层照旧走宿主令牌。 */
.gtd-desk, .gtd-desk * { font-family: 'GtdPixelFusion', 'Ark Pixel 12px', ui-monospace, monospace; }
.gtd-desk { color: var(--gtd-paper); -webkit-font-smoothing: none; font-synthesis: none; }
.gtd-desk__scene { display: block; }
.gtd-desk__wall-upper { background: var(--gtd-wall-upper); }
.gtd-desk__wall { background: var(--gtd-wall); }
.gtd-desk__tabletop { background: var(--gtd-desk); }
.gtd-desk__tabletop-edge { background: var(--gtd-desk-edge); }
.gtd-desk__front { background: var(--gtd-front); }
.gtd-desk__front-edge { background: var(--gtd-front-edge); }
.gtd-desk__lamp { pointer-events: none; }
.gtd-desk__quota {
  background: var(--gtd-lamp-base);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-lamp-edge);
  box-shadow: inset calc(var(--gtd-u) * 1) calc(var(--gtd-u) * 1) 0 var(--gtd-highlight-dim);
}
.gtd-desk__quota[data-on="1"] { background: var(--gtd-warm); }
.gtd-desk__screen {
  background: var(--gtd-screen);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-screen-edge);
  box-shadow:
    inset 0 calc(var(--gtd-u) * 2) 0 var(--gtd-highlight-dim),
    calc(var(--gtd-u) * 4) calc(var(--gtd-u) * 4) 0 var(--gtd-shadow-hard);
  color: var(--gtd-screen-ink);
  padding: calc(var(--gtd-u) * 6);
  display: flex;
  flex-direction: column;
  gap: calc(var(--gtd-u) * 1);
  overflow: hidden;
}
.gtd-desk__screen-line { white-space: nowrap; overflow: hidden; text-overflow: clip; }
.gtd-desk__screen-dim { color: var(--gtd-screen-dim); }
.gtd-desk__screen-strong { color: var(--gtd-plaque-ink-active); }
.gtd-desk__screen-bad { color: var(--gtd-screen-bad); }
.gtd-desk__holder {
  background: var(--gtd-holder);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-holder-edge);
  box-shadow: inset 0 calc(var(--gtd-u) * 2) 0 var(--gtd-highlight-dim);
  padding: calc(var(--gtd-u) * 6);
}
.gtd-desk__holder-body { display: flex; flex-direction: column; gap: calc(var(--gtd-u) * 3); height: 100%; }
.gtd-desk__holder-head { display: flex; justify-content: space-between; color: var(--gtd-holder-dim); }
.gtd-desk__holder-count { color: var(--gtd-ink-mute); }
.gtd-desk__holder-empty { margin: 0; flex: 1; display: grid; place-items: center; color: var(--gtd-ink-mute); }
.gtd-desk__slot {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(var(--gtd-u) * 5);
  flex: 1;
  min-height: 0;
  background: var(--gtd-paper);
  color: var(--gtd-ink);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-card-edge);
  padding: 0 calc(var(--gtd-u) * 5);
  cursor: pointer;
  text-align: left;
  font: inherit;
  overflow: hidden;
}
.gtd-desk__slot:hover { background: var(--gtd-paper-2); }
.gtd-desk__slot-title { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gtd-desk__slot-due { flex: 0 0 auto; color: var(--gtd-ink-dim); }
.gtd-desk__notes {
  background: var(--gtd-notes);
  color: var(--gtd-ink);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-notes-edge);
  box-shadow:
    calc(var(--gtd-u) * 4) calc(var(--gtd-u) * 3) 0 var(--gtd-notes-shadow-1),
    calc(var(--gtd-u) * 8) calc(var(--gtd-u) * 6) 0 var(--gtd-notes-shadow-2);
  padding: calc(var(--gtd-u) * 7);
  cursor: pointer;
  overflow: visible;
  z-index: 2;
}
.gtd-desk__notes-head { display: flex; gap: calc(var(--gtd-u) * 4); }
.gtd-desk__notes-hint { color: var(--gtd-ink-dim); }
.gtd-desk__notes-fine { display: none; }
.gtd-desk__notes[data-state="open"] .gtd-desk__notes-fine { display: block; }
.gtd-desk__notes[data-state="open"] .gtd-desk__notes-hint { display: none; }
.gtd-desk__notes-slip {
  width: calc(var(--gtd-u) * 210);
  margin-bottom: calc(var(--gtd-u) * 4);
  background: var(--gtd-paper-2);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-card-edge);
  box-shadow: calc(var(--gtd-u) * 3) calc(var(--gtd-u) * 3) 0 var(--gtd-shadow-hard);
  padding: calc(var(--gtd-u) * 6);
  color: var(--gtd-ink-dim);
}
.gtd-desk__flag { z-index: 3; }
.gtd-desk__flag-button {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--gtd-u) * 4);
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: var(--gtd-flag);
}
.gtd-desk__flag-pole { display: block; width: calc(var(--gtd-u) * 2); height: calc(var(--gtd-u) * 30); background: var(--gtd-ink-mute); }
.gtd-desk__flag-banner {
  display: block;
  background: var(--gtd-flag);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-flag-edge);
  color: var(--gtd-flag-ink);
  padding: 0 calc(var(--gtd-u) * 4);
  line-height: calc(var(--gtd-u) * 20);
  box-shadow: calc(var(--gtd-u) * 3) calc(var(--gtd-u) * 3) 0 var(--gtd-shadow-hard);
  white-space: nowrap;
}
.gtd-desk__flag-list {
  position: absolute;
  bottom: calc(var(--gtd-u) * 40);
  right: 0;
  width: calc(var(--gtd-u) * 190);
  background: var(--gtd-paper-2);
  color: var(--gtd-ink);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-card-edge);
  box-shadow: calc(var(--gtd-u) * 4) calc(var(--gtd-u) * 4) 0 var(--gtd-shadow-hard);
  padding: calc(var(--gtd-u) * 6);
}
.gtd-desk__flag-heading { margin: 0 0 calc(var(--gtd-u) * 4); color: var(--gtd-ink-dim); }
.gtd-desk__flag-items { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: calc(var(--gtd-u) * 3); }
.gtd-desk__flag-item { display: flex; flex-direction: column; }
.gtd-desk__flag-due { color: var(--gtd-ink-dim); }
.gtd-desk__plaques { display: flex; gap: 0; height: 100%; }
.gtd-desk__plaque { background: var(--gtd-plaque); border: calc(var(--gtd-u) * 1) solid var(--gtd-plaque-edge); color: var(--gtd-plaque-ink); font: inherit; cursor: pointer; padding: 0; text-align: center; }
.gtd-desk__plaque:nth-child(1) { width: calc(var(--gtd-u) * 84); }
.gtd-desk__plaque:nth-child(2) { width: calc(var(--gtd-u) * 94); }
.gtd-desk__plaque[data-active="true"] { background: var(--gtd-plaque-active); color: var(--gtd-plaque-ink-active); }
.gtd-desk__drawer { width: 100%; height: 100%; background: var(--gtd-drawer); border: calc(var(--gtd-u) * 1) solid var(--gtd-drawer-edge); color: var(--gtd-drawer-ink); cursor: pointer; font: inherit; padding: 0; }
.gtd-desk__drawer:hover { background: var(--gtd-drawer-hover); color: var(--gtd-drawer-hover-ink); }
.gtd-desk__power { width: 100%; height: 100%; background: var(--gtd-power); border: calc(var(--gtd-u) * 1) solid var(--gtd-plaque-edge); color: var(--gtd-plaque-ink); cursor: pointer; font: inherit; padding: 0; }
.gtd-desk__power:hover { background: var(--gtd-power-hover); color: var(--gtd-plaque-ink-active); }
.gtd-desk__card {
  box-sizing: border-box;
  color: var(--gtd-ink);
  background-color: var(--gtd-paper);
  background-size: calc(var(--gtd-u) * 16);
  background-repeat: repeat;
  image-rendering: pixelated;
  border: calc(var(--gtd-u) * 1) solid var(--gtd-card-edge);
  padding: calc(var(--gtd-u) * 10);
  box-shadow:
    calc(var(--gtd-u) * 5) calc(var(--gtd-u) * 7) 0 var(--gtd-shadow-card),
    inset calc(var(--gtd-u) * 1) calc(var(--gtd-u) * 1) 0 var(--gtd-highlight);
  animation: gtd-desk-card-in 180ms steps(4) both;
}
@keyframes gtd-desk-card-in {
  from { opacity: 0; transform: translateX(calc(var(--gtd-u) * 8)); }
  to { opacity: 1; transform: none; }
}
.gtd-desk__card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: calc(var(--gtd-u) * 26);
  background: linear-gradient(
    to right,
    var(--gtd-light-strong) 0,
    var(--gtd-light-strong) calc(var(--gtd-u) * 8),
    var(--gtd-light-mid) calc(var(--gtd-u) * 8),
    var(--gtd-light-mid) calc(var(--gtd-u) * 16),
    var(--gtd-light-soft) calc(var(--gtd-u) * 16),
    var(--gtd-light-soft) calc(var(--gtd-u) * 26)
  );
  pointer-events: none;
}
.gtd-desk__card-title { margin: calc(var(--gtd-u) * 10) 0 0; font-weight: 400; }
.gtd-desk__card-open {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--gtd-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.gtd-desk__card-open:hover { text-decoration: underline; }
.gtd-desk__card-due-row { margin-top: calc(var(--gtd-u) * 8); }
.gtd-desk__card-tag { display: inline-block; padding: 0 calc(var(--gtd-u) * 4); border: calc(var(--gtd-u) * 1) solid var(--gtd-ink); }
.gtd-desk__card-tag[data-overdue="true"] { color: var(--gtd-stamp); border-color: var(--gtd-stamp); }
.gtd-desk__card-req { display: flex; gap: calc(var(--gtd-u) * 6); margin-top: calc(var(--gtd-u) * 10); }
.gtd-desk__card-req-key { flex: none; color: var(--gtd-ink-dim); }
.gtd-desk__card-req-text {
  margin: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
.gtd-desk__card-req-source { margin-left: calc(var(--gtd-u) * 6); color: var(--gtd-ink-dim); }
.gtd-desk__card-actions {
  position: absolute;
  left: calc(var(--gtd-u) * 10);
  right: calc(var(--gtd-u) * 10);
  bottom: calc(var(--gtd-u) * 28);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: calc(var(--gtd-u) * 4);
  align-items: center;
}
.gtd-desk__btn {
  grid-column: 1 / -1;
  font: inherit;
  height: calc(var(--gtd-u) * 20);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-ink);
  background: var(--gtd-paper);
  color: var(--gtd-ink);
  cursor: pointer;
  padding: 0 calc(var(--gtd-u) * 8);
}
.gtd-desk__btn--solid { background: var(--gtd-ink); color: var(--gtd-paper); }
.gtd-desk__btn--compact { grid-column: auto; }
.gtd-desk__btn:disabled { opacity: 0.7; cursor: progress; }
.gtd-desk__card-sep { grid-column: 1 / -1; border-top: calc(var(--gtd-u) * 1) dashed var(--gtd-ink-dim); height: 1px; }
.gtd-desk__skip { grid-column: auto; border: 0; background: none; color: var(--gtd-ink-dim); font: inherit; padding: 0; cursor: pointer; text-align: left; }
.gtd-desk__skip:hover { color: var(--gtd-ink); }
.gtd-desk__skip-note { color: var(--gtd-ink-dim); text-align: right; }
.gtd-desk__card-status {
  position: absolute;
  left: calc(var(--gtd-u) * 10);
  right: calc(var(--gtd-u) * 10);
  bottom: calc(var(--gtd-u) * 112);
  z-index: 3;
  background: var(--gtd-paper-2);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-ink);
  padding: calc(var(--gtd-u) * 5);
}
.gtd-desk__card-status-text { margin: 0; }
.gtd-desk__card-status-code { color: var(--gtd-ink-dim); }
.gtd-desk__card-status-retry { margin-top: calc(var(--gtd-u) * 4); border: calc(var(--gtd-u) * 1) solid var(--gtd-ink); background: none; color: var(--gtd-ink); font: inherit; padding: 0 calc(var(--gtd-u) * 6); cursor: pointer; }
.gtd-desk__card-editor {
  position: absolute;
  left: calc(var(--gtd-u) * 10);
  right: calc(var(--gtd-u) * 10);
  bottom: calc(var(--gtd-u) * 28);
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--gtd-u) * 6);
  align-items: center;
  background: var(--gtd-paper-2);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-ink);
  padding: calc(var(--gtd-u) * 6);
  box-shadow: calc(var(--gtd-u) * 4) calc(var(--gtd-u) * 4) 0 var(--gtd-shadow-hard);
}
.gtd-desk__date { font: inherit; color: var(--gtd-ink); background: var(--gtd-paper); border: calc(var(--gtd-u) * 1) solid var(--gtd-ink); padding: 0 calc(var(--gtd-u) * 2); }
.gtd-desk__card-foot {
  position: absolute;
  left: calc(var(--gtd-u) * 10);
  right: calc(var(--gtd-u) * 10);
  bottom: calc(var(--gtd-u) * 8);
  display: flex;
  align-items: baseline;
  gap: calc(var(--gtd-u) * 6);
  color: var(--gtd-ink-dim);
  border-top: calc(var(--gtd-u) * 1) solid var(--gtd-ink-line);
  padding-top: calc(var(--gtd-u) * 2);
}
.gtd-desk__card-foot-link { margin-left: auto; border: 0; background: none; color: var(--gtd-ink-dim); font: inherit; cursor: pointer; padding: 0; }
.gtd-desk__two-minute {
  position: absolute;
  top: calc(var(--gtd-u) * -6);
  right: calc(var(--gtd-u) * 8);
  z-index: 5;
  max-width: calc(var(--gtd-u) * 160);
  background: var(--gtd-paper-2);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-ink);
  padding: calc(var(--gtd-u) * 2) calc(var(--gtd-u) * 6);
  transform: rotate(-3deg);
  box-shadow: calc(var(--gtd-u) * 3) calc(var(--gtd-u) * 3) 0 var(--gtd-shadow-note);
}
.gtd-desk__stamp {
  position: absolute;
  right: calc(var(--gtd-u) * 22);
  top: calc(var(--gtd-u) * 102);
  z-index: 6;
  border: calc(var(--gtd-u) * 2) solid var(--gtd-stamp);
  color: var(--gtd-stamp);
  padding: 0 calc(var(--gtd-u) * 8);
  transform: rotate(-9deg);
  animation: gtd-desk-stamp 120ms steps(2) both;
  pointer-events: none;
}
@keyframes gtd-desk-stamp {
  from { opacity: 0; transform: rotate(-9deg) scale(1.3); }
  to { opacity: 0.95; transform: rotate(-9deg) scale(1); }
}
.gtd-desk__card--blank { display: grid; place-content: center; }
.gtd-desk__card-empty { margin: 0; text-align: center; color: var(--gtd-ink-dim); }
.gtd-desk__card--failure { background: var(--gtd-paper); }
.gtd-desk__note {
  position: absolute;
  left: calc(var(--gtd-u) * 8);
  right: calc(var(--gtd-u) * 8);
  top: calc(var(--gtd-u) * 18);
  background: var(--gtd-paper-2);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-card-edge);
  box-shadow: calc(var(--gtd-u) * 4) calc(var(--gtd-u) * 4) 0 var(--gtd-shadow-hard);
  padding: calc(var(--gtd-u) * 8);
  transform: rotate(-2deg);
}
.gtd-desk__note-heading { margin: 0 0 calc(var(--gtd-u) * 4); font-weight: 400; color: var(--gtd-ink); }
.gtd-desk__note-text { margin: 0 0 calc(var(--gtd-u) * 6); color: var(--gtd-ink-dim); }
.gtd-desk__note-code { display: block; margin-top: calc(var(--gtd-u) * 4); color: var(--gtd-ink); }
.gtd-desk__skip-notice {
  margin: 0;
  background: var(--gtd-paper-2);
  color: var(--gtd-ink);
  border: calc(var(--gtd-u) * 1) solid var(--gtd-card-edge);
  box-shadow: calc(var(--gtd-u) * 3) calc(var(--gtd-u) * 3) 0 var(--gtd-shadow-hard);
  padding: calc(var(--gtd-u) * 4);
  overflow: hidden;
  z-index: 2;
}
@media (prefers-reduced-motion: reduce) {
  .gtd-desk__card,
  .gtd-desk__stamp,
  .gtd-desk__two-minute { transform: none !important; animation: none !important; transition: none !important; }
}
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
