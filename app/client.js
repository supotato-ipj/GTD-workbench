/**
 * Client 半边：左栏「任务梳理台」图标 + 主区面板。
 *
 * 形状是 `window.__ModuleLoader__.load({ id, factory(require) })`，id 必须等于包名。
 * 不引构建步骤：用 `React.createElement`（对齐官方模板），样式只用宿主主题令牌 `--dsw-alias-*`，
 * 不依赖 `dsh-client-ui-primitives`。
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
      focusHeading: '本周主攻',
      focusEmpty: '本周没有带深度标签的动作',
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
      focusHeading: 'This week focus',
      focusEmpty: 'No deep-work action this week',
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
     * @param {object} props - props。
     * @returns {object} React 元素。
     */
    function BoxTag(props) {
      const note = props.note;
      const t = props.t;
      const nextStep = typeof note.nextStep === 'string' && note.nextStep.length > 0 ? note.nextStep : null;
      return h(
        'div',
        {
          className: 'gtd-tag',
          'data-role': 'box-tag',
          'data-note-id': note.id,
          title: nextStep === null ? note.title : `${note.title}｜${t('nextStepLabel')}：${nextStep}`,
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
      const [collapsed, setCollapsed] = React.useState(container.collapsedByDefault === true);
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
          'data-collapsed': collapsed ? 'true' : 'false',
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
                  'aria-expanded': collapsed ? 'false' : 'true',
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
                collapsed ? t('expandBox') : t('collapseBox'),
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
        collapsed
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
    function FocusStrip(props) {
      const t = props.t;
      const focus = Array.isArray(props.focus) ? props.focus : [];
      if (focus.length === 0) {
        return h(
          'div',
          {
            className: 'gtd-focus',
            'data-role': 'focus',
            'data-count': '0',
            style: {
              padding: '8px 16px',
              borderBottom: '1px solid var(--dsw-alias-border-l2)',
              fontSize: '12px',
              color: 'var(--dsw-alias-label-caption)',
            },
          },
          `${t('focusHeading')}：${t('focusEmpty')}`,
        );
      }
      return h(
        'div',
        {
          className: 'gtd-focus',
          'data-role': 'focus',
          'data-count': String(focus.length),
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
            'data-role': 'focus-heading',
            style: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-primary)' },
          },
          `${t('focusHeading')} ${focus.length}`,
        ),
        ...focus.map((item, index) =>
          h(
            'button',
            {
              key: item.id,
              type: 'button',
              className: 'gtd-focus__item',
              'data-role': 'focus-item',
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
            h('span', { 'data-role': 'focus-title' }, item.title),
            item.dueLocal === null
              ? null
              : h(
                  'span',
                  { 'data-role': 'focus-due', style: { fontSize: '11px', color: 'var(--dsw-alias-label-caption)' } },
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
          /* gtd:06 markdown 侧与滴答侧分区呈现，不混作一段 */
          h(DrawerRecord, { record: recordOf(props.records, note.record), t }),
          /* gtd:06 end */
        ),
      );
    }
    /* gtd:05 end */

    /**
     * 主区面板：打开就拉一次数，另配一个手动刷新按钮（spec「拉数时机」）。
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
      /* gtd:04 点主攻带上的条目，开的就是那条便贴的抽屉 */
      const openFromFocus = React.useCallback(
        (item) => {
          const containers = state.snapshot !== null && typeof state.snapshot === 'object' ? state.snapshot.containers : null;
          const notes = Array.isArray(containers) ? containers.flatMap((container) => (Array.isArray(container.notes) ? container.notes : [])) : [];
          const found = notes.find((note) => note.id === item.id);
          if (found !== undefined) setOpenedNote(found);
        },
        [state.snapshot],
      );
      /* gtd:04 end */
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
        { className: 'gtd-workbench', 'data-role': 'panel', 'data-state': 'ready', style: { position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } },
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
        h(FocusStrip, {
          focus: state.snapshot !== null && typeof state.snapshot === 'object' ? state.snapshot.focus : [],
          t,
          onOpen: openFromFocus,
        }),
        h(NoteOpenContext.Provider, { value: setOpenedNote }, h(WorkbenchBoard, { snapshot: state.snapshot, t, motions })),
        /* gtd:07 已沉底区挂在画布下面：展示区，不是回收箱 */
        h(SunkArea, {
          sunk: state.snapshot !== null && typeof state.snapshot === 'object' ? state.snapshot.sunk : null,
          t,
          motions,
        }),
        /* gtd:07 end */        /* gtd:05 抽屉挂在画布**外面**、面板里面：它是覆盖层，不动画布版面 */
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
       */
      components: {
        WorkbenchIcon,
        WorkbenchPanel,
        WorkbenchBoard,
        WorkbenchBox,
        WorkbenchNote,
        installStyles,
        summarizeForMotion,
        motionsFor,
      },
      /** 样式表原文，测试直接核对它写了什么。 */
      styles: STYLE_TEXT,
    };
  },
});
