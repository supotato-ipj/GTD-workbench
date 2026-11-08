# 任务梳理台（GTD 工作台）· DSH 插件

一个包，Host 半边 + Client 半边。**不写任何本地文件**（ADR-0006）；滴答那边只开**两个**写口：
**完成**（写 `status=2`，单口径，不建核销台账）与**改期**（写 `dueDate`，粒度到天）。
「跳过」不是写口——它是纯视图状态、零写入。
唯一写到浏览器本地的是「动画差异基准」（localStorage），ADR-0007 明写允许，不落仓库。

## 装

```
plugin_manager → install_bundle → target = 本目录的绝对路径
```

装进 profile 后左栏出现「任务梳理台」图标，点开主区出现画布。本插件**没有热更新**：
改了代码要重新安装（或换包）再刷新页面。

## 跑测试

```
cd app
npm install          # 只装测试用的 react / react-dom / jsdom
npm test
```

等价于：

```
node --test --test-isolation=none --test-concurrency=1 "test/**/*.test.js"
```

`--test-isolation=none` 与 `--test-concurrency=1` 都**不能省**：默认隔离会 spawn 子进程（受限环境下 EPERM），
而并发跑文件会让几个测试互相借走全局 `document`／`window`，表现成随机失败。

测试运行器是 Node 自带的 `node:test`，零测试框架依赖。`react`/`react-dom`/`jsdom` 只是
**开发期**依赖：浏览器里的 React 来自宿主模块表，插件运行时不需要它们。

- **接缝 A**（数据边界，Host → 客户端）：真的起一个本机 HTTP 服务器，请求那条路由，断言响应体。
- **接缝 B**（渲染边界，快照 → 画布）：给渲染层一份固定快照，断言画布 DOM；
  需要交互的断言（点开抽屉、点刷新、拖便贴）在 jsdom + `react-dom/client` + `act` 上跑。
- 两条接缝都用**固定夹具**，不依赖本机实时滴答数据。

真实调滴答那一层是**接缝 C**，走手动验收（本机登录态）：

```
node "$APPDATA/npm/node_modules/@suibiji/dida-cli/dist/index.js" \
  task filter --projects 7c4e00000000000000000002 --status 0 --json
```

写口手动验收（**会真的勾掉那条**，先拿一条不要紧的动作试）：

```
node "$APPDATA/npm/node_modules/@suibiji/dida-cli/dist/index.js" \
  task complete 7c4e00000000000000000002 <动作 id>
```

改期手动验收（**会真的改掉那条的期限**，同样先拿不要紧的动作试）：

```
node "$APPDATA/npm/node_modules/@suibiji/dida-cli/dist/index.js" \
  task update <动作 id> --id <动作 id> --project 7c4e00000000000000000002 \
  --due-date 2026-11-09T15:59:59+0000 --time-zone Asia/Shanghai
```

（`--due-date` 要的是**带时刻的时间戳**，不是 `2026-11-09`；`2026-11-09` 在 `Asia/Shanghai`
下是当天 `23:59:59`，即 `2026-11-09T15:59:59+0000`。）

**`--status 0` 不能省**：不带状态过滤时，收集箱与日历单次就会撞满 CLI 的 200 条上限（实测）。

## 记录页目录怎么配

抽屉里那三段（「为什么／验收标准／卡点」）来自**记录页**（markdown 页）。
记录页在哪儿，由三处决定，优先级从高到低：

| 优先级 | 来源 | 写法 |
|---|---|---|
| 1 | 环境变量 `GTD_RECORDS_DIR` | 绝对路径，例如 `D:/path/to/issues` |
| 2 | 仓库根的 `local-config.json` 的 `记录目录` 字段 | 相对路径按仓库根解，也可写绝对路径 |
| 3 | 默认 | 仓库根的 `records/`——仓库自带的**虚构样本**，开箱即用 |

`local-config.json` 已被 `.gitignore` 挡掉，**永远不进版本库**：

```json
{
  "记录目录": "D:/local/my-notes/issues"
}
```

**真实的个人记录页留在本地**：仓库里只有虚构样本，真实那册用上面任一方式指过来。
目录指错了也不要紧——读不到就返回空数组，画布照常画，抽屉里显示「无对应记录」。

记录页的写法（`parseRecord` 认的段落）：

- 文件名 `NN-<任意 slug>.md`，`NN` 决定编号（`01` → ① … `09` → ⑨）。
- 一级标题是页名。
- `## 为什么…` / `## 现状` / `## 关键判断` / `## 背景` / `## 策略` / `## 目标` → 取**第一段**作「为什么」。
- `## 验收…` → 取第一段作「验收标准」；没有这一节但正文里提到「验收标准」，就捞那句原文。
- `## 卡在…` / `## 卡点…` / `## 阻塞…` → 取第一段作「卡点」。
- 缺哪一段就是 `null`——**不编**。

## 滴答清单 id 怎么配

仓库里 `lib/containers.js` 的六个纸箱带的清单 id 是**虚构占位**（真实 id 属于个人信息，不进公开仓库）。
真机上由本机配置覆盖：`local-config.json` 的 **「清单」** 字段，
形状是 `{ "<纸箱 key>": "<清单 id>" }`，key 取 `lib/containers.js` 里的 `key`
（`inbox`／`project`／`execution`／`waiting`／`calendar`／`maybe`）：

```json
{
  "记录目录": "D:/local/my-notes/issues",
  "清单": {
    "inbox": "inbox…",
    "project": "<24 位 id>",
    "execution": "<24 位 id>",
    "waiting": "<24 位 id>",
    "calendar": "<24 位 id>",
    "maybe": "<24 位 id>"
  },
  "容量": { }
}
```

读取是 `readContainers({ root })`（`lib/config.js`），**每次调用都重新读盘，不缓存**：
改完配置 → 刷新页面 → 立刻生效。

降级口径与容量配置同一套（**不抛**）：

| 情况 | 退回到 |
|---|---|
| 文件读不到 / 不是合法 JSON / 没有「清单」字段 / 「清单」不是对象 | 六个纸箱**全部**保持仓库里的虚构占位 |
| 某一个值不是非空字符串（数字、空串、空白串、对象） | **那一个纸箱**保持占位，其余纸箱照常用配置里的值 |

清单 id 是**逐个纸箱独立**的，所以不做「整份配置要么全对要么全错」——
一个纸箱写坏了，不该让另外五个纸箱也用不上真 id。

**怎么接进路由**：`createTasksHandler` / `createActionsHandler` 的 `containers` 依赖
既可以是数组，也可以是**返回数组的函数**（`app/index.js` 传 `() => readContainers()`）。
函数在**每次请求**里现取——改完配置刷新就生效；**一次请求内只解析一次**：
取数、已沉底区与快照用的是**同一份**纸箱（写方向的「找目标」与「写完重新取数」也是同一份）。

## 形状

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半边：`ctx.effect` 里用 `ctx.webServer.register` 开一条本机路由，挂上三个依赖 |
| `client.js` | Client 半边：左栏图标 + 主区面板（**外壳**与**视图**两层，`React.createElement`，不引构建步骤） |
| `lib/containers.js` | 六个纸箱与滴答清单 id（用完整 24 位 id） |
| `lib/config.js` | 本地私有配置 `local-config.json` 的只读读取（记录目录 / 容量参数 / 滴答清单 id） |
| `lib/dida.js` | 用真实入口 + 真 node 调滴答；允许集合＝两条读命令 + 两个写命令（`task complete`、**只用于改期的** `task update`）；每条命令带超时 |
| `lib/route.js` | 读路由处理函数：访问守卫 + 取数编排 + 快照／失败原因（写路由复用它的取数与失败映射）；纸箱与容量参数**按请求解析一次** |
| `lib/actions.js` | 写动作的校验与定位（纯函数）：动作类型、目标 id、参数；目标动作属于哪个清单 |
| `lib/dates.js` | 截止日文本（粒度到天）与时刻的换算（纯函数）：`YYYY-MM-DD` → 那天的 `23:59:59` → 滴答的时间戳 |
| `lib/write-route.js` | 写路由处理函数：执行写动作 → 重新取数 → 回一份新快照 |
| `lib/snapshot.js` | 滴答原始任务 → 工作台快照（两个进程之间唯一的契约） |
| `lib/board.js` | 六箱归位规则：画便贴还是箱签、默不默认折叠、日历箱的「外部约定时刻」口径 |
| `lib/timeline.js` | 天刻度四段（今天／明天／本周／以后）与默认视野 |
| `lib/focus.js` | **本周主攻**推导（只认滴答的 `深度` 标签，不读手写名单）；快照字段是 `mainPush` |
| `lib/focus-guide.js` | **焦点**推导：资格（八条）→ 排序（五组）→ 主卡／「接下来」／提醒位（纯函数） |
| `lib/project.js` | **卡脚的项目指针**：靠 markdown 记录编号与项目箱箱签的编号对上（纯函数，推不出就是 `null`） |
| `lib/capacity.js` | 容量计算：可排时间、剩余时间、深度名额、预计耗时（纯函数，只存输入不存推导值） |
| `capacity.schema.json` | 容量参数的 **schema**（JSON Schema）：字段形状 + 虚构示例；真实数值不进本仓库 |
| `lib/rules.js` | 规则角标的四项检查 |
| `lib/sunk.js` | 已沉底区：最近七天按完成日堆叠 + 每箱完成数 |
| `lib/markdown.js` | 记录页解析（为什么／验收标准／卡点）与 ①–⑨ 匹配 |
| `lib/requirement.js` | **完成要求**的解析（单一口径）：记录页优先、正文 `完成要求：` 前缀回退（纯函数） |
| `lib/records.js` | Host 侧读记录页（目录可配，默认 `<repo>/records/`；只读） |
| `lib/diff.js` | 状态迁移差异检测（只演真实发生过的变化） |

取数路由：`GET /gtd-workbench/tasks`（顶层路径，带命名空间前缀）。
写动作路由：`POST /gtd-workbench/actions`（见下）。

## 画布上有什么

- 六个纸箱：收集箱、项目、执行、等待、日历、可能（顺序固定，ADR-0007）。
- 每箱一条天刻度时间轴：今天／明天／本周／以后；默认只铺今天与本周，其余折叠成一条计数。
- 本周主攻：一条独立带子，摆在纸箱上方，由滴答的 `深度` 标签推导。
- 已沉底：画布下方，最近七天已勾选的条目按完成日堆叠；每箱角标另标完成数。
- 规则角标：违反容器规则的便贴亮一个 ⚑，点开看缺了什么。
- 点便贴开抽屉：滴答原始字段 + markdown 里的「为什么／验收标准／卡点」。

## 面板外壳与视图

主区面板分两层（GitHub issue #5「04 · 面板外壳拆分（前置重构）」）：

| 层 | 组件 | 负责 |
|---|---|---|
| **外壳** | `WorkbenchPanel` | 取数、加载态、错误态、刷新、当前画哪一个视图。**它自己不画画布。** |
| **视图** | `CanvasView` | v1 的六箱画布（纸箱、便贴、箱签、已沉底、规则角标、本周主攻带）——原样下沉，不重写 |
| **视图** | `FocusView` | 焦点引导器（issue #6「05 · 焦点只读上线」）：四层结构，默认视图 |

- 视图只收 `snapshot` 与几个回调，**加新视图不用动取数、错误处理与刷新**。
- 视图切换的状态住在外壳里（`viewMode`），摆在面板根上：`data-role="panel"` 的 `data-view="canvas|focus"`。
  切换控件是 `data-role="view-switch"` 里的两个按钮（`view-switch-canvas`／`view-switch-focus`）。
- **默认视图是焦点引导器**（`data-view="focus"`）。想直接看画布可以切到 `view-switch-canvas`，
  也可以在焦点视图里点下钻入口（那条路走的是同一张画布）。
  外壳接受一个可选的 `initialView`（`'canvas'`）把初始视图定成画布——测试与深链用。
- 画布那一段的 DOM 层级与拆分前完全一样——视图层用 Fragment 返回，不套任何新元素，
  既有选择器（`[data-role="board"]` 等）一条都不用改。

## 焦点视图（四层）

`FocusView` 照 `prototype/index.html`（工单 04 的一次性原型，用户已过观感门禁）的四层：

| 层 | DOM 角色 | 内容 |
|---|---|---|
| ① 顶部常驻 | `focus-top` / `focus-stat`（`data-stat="daily｜remaining｜deep-quota"`） | 今日日清几笔未还、今日剩余可排时间、深度名额；下面一行 `focus-capacity-bar` 里是 `focus-capacity-asof`（「容量参数定于 <日期>」，没初始化时 `data-state="unset"`）与 `focus-capacity-outside`（窗口外的那笔日清不占可排时间） |
| ② 行动卡（主位） | `focus-card`（`data-note-ref`） | 工作内容 `focus-card-title`、完成时限 `focus-card-due`、完成要求 `focus-card-requirement`（来源标记 `focus-card-requirement-source`，写成「来自记录页」）、预计耗时 `focus-card-estimate`、容量提示 `focus-card-capacity`；事实行之下是三个控件 `focus-card-actions`：`focus-card-complete`（实心）／`focus-card-reschedule`（描边）／`focus-card-actions-sep` + `focus-card-skip`（弱化，零写入）；**卡脚** `focus-card-foot`（项目名 `focus-card-foot-project` + 入口 `focus-card-foot-project-link`）——推不出项目就不画这一行 |
| ③「接下来」窄条 | `focus-next` / `focus-next-item`（`data-note-ref`） | 只写标题与时限；**点一条即换主卡**（视图内状态，不写任何数据） |
| ④ 下钻层 | `focus-drill-entry` / `focus-drill` / `focus-back` | 点开后是 v1 的六箱画布原样，带一个「回到焦点」 |

几条口径：

- **Client 只画不算**：资格、排序、容量、可排时间、主卡与队列的内容全部来自快照
  （`focus.card`／`focus.next`／`today.*`／`capacity.*`），这一层不重算任何一个。
- **缺字段就少一行，不整卡消失**：完成要求缺失 → 那一行不画；预计耗时为 `null` → 写「未估算」
  （不是「0 分钟」）；容量提示的 `fits` 为 `null` → 不装作知道装不装得下。
- **主卡弱化纸感**（用户裁定）：主卡**没有折角、没有纸纹**，只留纸色调与一层浅影；
  下钻层里的 v1 纸箱与便贴**纸感原样**（`.gtd-box__fold` 与 `.gtd-box::after` 的纸纹都没动）。
- **配色与字体全部走宿主令牌**（`--dsw-alias-*`），明暗两套主题自动可读；
  `prefers-reduced-motion: reduce` 时动效照旧压到近乎为零。
- **焦点视图里不另造 `data-note-id`**：它指向的是「一条便贴」，
  焦点视图的元素（卡、窄条、提醒位）用 `data-note-ref` 指回那条动作，
  免得 `[data-note-id="…"]` 这种选择器命中错东西。
- **抽屉里说清「为什么没进焦点」**：便贴 `eligible` 为 false 时，抽屉里出现
  `data-role="drawer-ineligible"`（带 `data-reason`），原因值原样取 Host 给的 `ineligibleReason`。
- **抽屉里也说清这条动作自己的完成要求**：`data-role="drawer-requirement"`（原文）与
  `data-role="drawer-requirement-source"`（来源标记，写成「来自记录页」）。
  它与记录页那一段的「验收标准」**层级不同、可以并存**，但**同一段文字只画一遍**
  （画了两遍就是噪音）；这条动作没有完成要求时写「未写完成要求」。

## 卡脚的项目指针（规格故事 22–24）

卡脚那一行回答的是「**我做这一件的时候，它在哪条线上**」。

**数据现实**：滴答里项目与动作之间**没有关联字段**（项目不带子任务，动作也不指向项目），
所以指针靠既有口径推——**markdown 记录编号**（①–⑨）与**项目箱箱签标题的编号**对上：

```
动作的记录编号（focus.card.record，①–⑨） == 项目箱里那张箱签标题的编号 → 那张箱签就是它的项目
```

推导在 Host 侧（`lib/project.js` 的 `projectPointerOf`，纯函数），结果随快照过界：

| 字段 | 含义 |
|---|---|
| `focus.card.project.id` | 项目箱里那张箱签的 id |
| `focus.card.project.name` | 项目名（箱签标题去掉开头的编号字符） |
| `focus.card.project.record` | 对上的那个编号（①–⑨） |

- **推不出就是 `null`**：动作没有记录编号、或编号对不上任何一张箱签时，
  `focus.card.project` 是 `null`，卡脚**整行不画**——缺就是缺，不编。

三个入口（都在 Client 侧，只画不算）：

| 入口 | DOM | 结果 |
|---|---|---|
| 卡脚上的项目指针 | `focus-card-foot` / `focus-card-foot-project` | 写着「项目 &lt;项目名&gt;」 |
| 点卡脚上的「项目清单 →」 | `focus-card-foot-project-link` | 打开**下钻层**并把**项目箱**摆开、标出来（`[data-role="box"][data-container="project"][data-focus-target="true"][data-collapsed="false"]`）——那是项目清单的全貌（纸箱 + 箱签 + 下一步指针） |
| 点项目箱签 | `[data-role="box-tag"]` | 打开**抽屉**，里面是那个项目的 markdown 记录页（`drawer-record`）：为什么／验收标准／卡点 |

- 下钻层与抽屉沿用 v1 既有组件与交互，不做改动；
  项目箱签**从「贴着的标签」变成「可点的入口」**（可聚焦，回车／空格也能点），
  这是它唯一新增的交互。
- 这一整套都是**只读**的：不写任何数据、不写任何本地文件。

## 完成写口（Client 侧）

行动卡上有一个克制的「完成」按钮（`data-role="focus-card-complete"`），在事实行之下、卡脚之上：

| 情形 | DOM | 表现 |
|---|---|---|
| 等待 | `focus-card-complete[data-state="pending"]` | 按钮禁用、文案「完成中…」；连点**不重复写**（Host 一次完成要跑十几次 CLI 调用） |
| 写成功 | — | 响应里的 `snapshot` **整体替换**面板当前的快照 → 主卡自动换成下一件，**不再发一次读请求** |
| 写成功但刷新失败 | `focus-complete-refresh-failed` + `focus-complete-refresh` | 说「已完成，但刷新失败」并给一次手动刷新。**不能说成写失败**（用户会以为没勾上而重复点） |
| 写失败 | `focus-complete-error`（带 `data-code`） | 摆出 `error.message`（必要时加 `error.code`）；**不**在本地加「已完成」标记 |
| 没登录 | `login-prompt` / `login-command` | 走**既有的**未登录那条路，不另起一套 |

- 目标 id 取自卡上的 `data-note-ref`（焦点视图不占用 `data-note-id`）。
- 请求体：`{ "action": "complete", "taskId": "<动作 id>", "params": {} }`（键是英文）。
- 完成口径不变：完成 = 滴答勾选，单口径（没有「已核」「撤销完成」「批量勾选」）。

## 改期与跳过（Client 侧，issue #10）

写口那一行上的三个控件**位置分开**、不合并成一个「推迟」：完成（实心主按钮）与改期（描边次按钮）
是两个写口，跳过是**零写入**的弱化项，排在虚线分隔 `focus-card-actions-sep` 之后，
自己还带着一句「零写入」（`focus-card-skip-note`）。

### 改期（写口）

点 `focus-card-reschedule` 打开日期编辑器 `focus-card-reschedule-editor`：

| 元素 | DOM | 说明 |
|---|---|---|
| 日期输入 | `focus-card-reschedule-date` | `<input type="date">`：值形状天生是 `YYYY-MM-DD`，**收不下带时刻的字符串**（Host 会当场拒） |
| 提交 | `focus-card-reschedule-submit` | 值在**提交那一刻**从 DOM 上读；不成立就不发请求，改说 `focus-reschedule-need-date` |
| 取消 | `focus-card-reschedule-cancel` | 收摊，**不写任何东西**（开合是视图内状态） |

- 默认值是这条动作当前的完成时限（`focus.card.dueDate`）；**没有期限就是空的**——不替用户猜一个日子。
- 请求体：`{ "action": "reschedule", "taskId": "<动作 id>", "params": { "dueDate": "YYYY-MM-DD" } }`
  （`params` 里只有 `dueDate`，别的键 Host 一律拒）。
- 写成功：响应里的 `snapshot` **整体替换**面板当前的快照 → 主卡与「接下来」按**新的期限**重排
  （**Host 排好**，Client 不自己重排），不再发一次读请求。
- 写成功但刷新失败（`snapshot === null` 且有 `refreshError`）：说「已改期，但刷新失败」
  （`focus-reschedule-refresh-failed`）并给一次手动刷新（`focus-reschedule-refresh`）。
  **不能说成写失败**（用户会以为没改上而重复点）。
- 写失败：`focus-reschedule-error`（带 `data-code`）摆出 `error.message` 与 `error.code`；
  **不在本地改期限**，也不把它画成已改期。
- 没登录：走**既有的**未登录那条路（`login-prompt` / `login-command` / `retry`）。
- 等待与防重复点击与「完成」一致：`focus-card-reschedule[data-state="pending"]` 按钮禁用、
  文案「改期中…」；连点**不重复写**。

### 跳过（零写入）

- 点 `focus-card-skip` = **本次会话里**这条不再出现在焦点里：主卡自动换下一件，
  这条从「接下来」队列里去掉。
- **不发任何请求**：Host 那侧没有 `skip` 这个动作，发过去只会被拒（`invalid-argument`）。
- **不写任何东西**：连 localStorage 都不碰（工作台不写任何本地文件，ADR-0006）。
- **只活在内存里**：刷新页面它就回来（状态住在面板的 React state 里，不落盘）。
- 跳过后 `focus-skip-notice` 说清楚它去哪了。

## 写口：完成与改期（`POST /gtd-workbench/actions`）

写入走**同一条 HTTP 契约的写方向**：读是 `GET /gtd-workbench/tasks`，写是 `POST /gtd-workbench/actions`。

**只有两个写口**：「完成」（`complete`）与「改期」（`reschedule`）。「跳过」不是写口——
它是纯视图状态、零写入、刷新后回来，**不要**往这条路由上发明第三种动作。

**键名是英文**：请求体与响应体的键与读方向的快照契约同一套写法——
一条契约两种写法（中文键 / 英文键）是 bug 的温床。

**请求体**：

```json
{ "action": "complete", "taskId": "<动作 id>", "params": {} }
```

```json
{ "action": "reschedule", "taskId": "<动作 id>", "params": { "dueDate": "2026-11-09" } }
```

- `action`：动作类型。`complete`（完成）或 `reschedule`（改期）。
- `taskId`：目标动作的 id（非空字符串）。
- `params`：动作参数，可省。「完成」用不上；「改期」要带新的截止日。

**「改期」的参数**：

| 键 | 形状 | 校验 |
|---|---|---|
| `params.dueDate` | `YYYY-MM-DD`（**粒度到天**） | 必须是这个形状（带时刻的字符串不行）、必须是**真实存在**的日期（`2026-02-30` 不行）、年份要在 `1970`–`2999` 之间 |

多带别的参数（`title` 之类）一律 `invalid-argument`——改期就是改期限，别的都不从这个写口透出去。

**响应体**：

| 情形 | 状态码 | 响应体 |
|---|---|---|
| 写成功 | 200 | `{ "ok": true, "action": "complete", "taskId": "…", "snapshot": { … } }` |
| 写成功但刷新没成 | 200 | `{ "ok": true, "action": "…", "taskId": "…", "snapshot": null, "refreshError": { "code": "…", "message": "…" } }` |
| 失败 | 见下 | `{ "error": { "code": "…", "message": "人能读的失败原因" } }` |

`snapshot` 是**写成功之后重新取的一份**，形状与 `GET` 的响应体完全一致——客户端换主卡不必再发一次读请求。
改期也一样：写成功后重新取数，主卡与「接下来」按**新的期限**重排。
`refreshError` 只在「写成功了、但重新取数没成」时出现（这时 `snapshot` 是 `null`）。

**失败类别**（读方向与写方向同一套）：

| code | 状态码 | 含义 |
|---|---|---|
| `not-authenticated` | 401 | 滴答未登录／登录态失效 |
| `cli-unavailable` | 503 | 找不到滴答 CLI 入口或跑它的 node |
| `cli-failed` | 502 | CLI 跑挂了、输出不对、**或者超时** |
| `not-found` | 404 | 目标动作不存在（写方向专有） |
| `invalid-argument` | 400 | 参数非法或动作类型不支持（写方向专有） |
| `internal-error` | 500 | 认不出的错误 |

写失败**不会**表现为已完成：失败响应体里没有 `ok`、也没有 `snapshot`。

**滴答 CLI**：允许集合是显式的——两条读命令（`task filter` / `task completed`）加上**两个**写命令
`task complete` 与 `task update`（**只用于改期**）。其余写命令（新建、删除、移动……）拼不进 argv。
argv 全仓库只在 `lib/dida.js` 的 `buildDidaArgs` 一处拼：

```
task filter    --projects <清单 id> --status 0 --json
task completed --projects <清单 id> --start-date … --end-date … --json
task complete  <清单 id> <动作 id>
task update    <动作 id> --id <动作 id> --project <清单 id> --due-date <时间戳> --time-zone <时区>
```

**「改期」的安全边界**：`task update` 还能改标题、内容、状态、标签……放行了这条命令**不等于**放行了
它的其它参数。`buildDidaArgs('task update', …)` 只认 `projectId` / `taskId` / `dueDate` / `timeZone`，
多带一个键就当场抛 `invalid-argument`。

**「改期」的时区与时刻**：

- 截止日按**动作自己的时区**解释（滴答那侧是 `Asia/Shanghai`，ADR-0008）；动作上没带时区才退回宿主时区。
  改期**不改**动作的时区。
- 粒度到天 → 取那天的 `23:59:59`（一天结束的那一刻）。这样一条改到今天的动作，当天不会显得已经过期。
- 时间戳写成 `yyyy-MM-ddTHH:mm:ss+0000`（滴答要的形状，偏移显式写出来）。
  `2026-11-09` 在 `Asia/Shanghai` 下是 `2026-11-09T15:59:59+0000`。

清单 id 从**目标动作所在的纸箱**来（快照里每个容器都带 `projectId`）；收集箱的 id 不是 24 位
（是 `inbox…`），照样能用。

**超时**：每条 CLI 调用都有超时（默认 30 秒，环境变量 `GTD_DIDA_TIMEOUT_MS` 可改）。
超时就杀掉子进程、按 `cli-failed` 收场——不让路由一直挂着。

## 本周主攻带改名（v2 语义改名）

v1 的「本周主攻」与 v2 的「焦点」是两回事，v2 起名字不再重叠：

| | 旧 | 新 |
|---|---|---|
| 快照字段 | `snapshot.focus`（数组） | `snapshot.mainPush`（数组） |
| DOM 角色 | `focus` | `main-push` |
| DOM 角色 | `focus-item` | `main-push-item` |
| DOM 角色 | `focus-title` | `main-push-title` |
| DOM 角色 | `focus-due` | `main-push-due` |
| DOM 角色 | `focus-heading` | `main-push-heading` |
| 组件 | `FocusStrip` | `MainPushStrip` |
| 词表键 | `focusHeading`／`focusEmpty` | `mainPushHeading`／`mainPushEmpty` |

v2 的焦点是 `focus` 对象：`focus.card`（行动卡）、`focus.next`（「接下来」）、`focus.reminders`（提醒位）。

## 客户端单文件约束

Client 半边**就是 `client.js` 一个文件**。三条约束，各有一条测试守着
（`test/client-single-file.test.js`）：

| 约束 | 含义 |
|---|---|
| **只有一个 client 入口** | `window.__ModuleLoader__.load(...)` 全文只出现一次；`components.WorkbenchPanel`、`components.FocusView`、`components.CanvasView` 都由**这一个**入口导出 |
| **无构建步骤** | 不引打包器（esbuild／webpack／rollup／vite）、不引 TypeScript、不写 JSX；元素一律 `React.createElement` 手写，`package.json` 里也没有构建脚本 |
| **`require` 只用于取依赖包** | `require` 只用来取宿主模块表里的依赖（当前只有 `react`）；**不**用来引本地的 `lib/*.js` |

为什么不能用 ES 模块的 `import` 引 `lib/*.js`：`client.js` 是**经典脚本**（浏览器端由
`window.__ModuleLoader__` 收下），不是 ES 模块，模块语法在浏览器里不可用。
所以 Host 侧算出来的东西（分段、违规、主攻、焦点资格……）只能靠**快照**这一个契约传过来：
Client 只画不算。想在客户端复用 Host 侧的纯函数，只能在客户端镜像一份，并用测试盯住两边不漂
（`lib/diff.js` 与 `client.js` 的差异逻辑已有这样一条断言）。


## 快照契约（v2 焦点引导器）

快照是 Host 与 Client 之间**唯一**的契约。以下是 v2 新增的部分（ADR-0009、ADR-0010、ADR-0011）：

| 字段 | 形状 | 含义 |
|---|---|---|
| `focus.card` | 对象 \| `null` | 主位**行动卡**，至多一条 |
| `focus.next` | 数组（0–4 条） | 「接下来」窄条队列。**与主卡同一份形状**（窄条上只画标题与时限，但底下带的是主卡那些字段），所以点一条换主卡时 Client 直接把它拿过来用，不重造 |
| `focus.reminders` | 数组 | 等待清单里「到期没回」的提醒位（**不占主卡**） |
| `today.daily` | 数组 | 今日日清项与状态（`未还清` / `已还清`） |
| `today.remainingMinutes` | number | 今日剩余可排时间（分钟） |
| `today.deepQuotaUsed` | boolean | 今天的深度名额是否已用掉 |
| `capacity.asOf` | 字符串 \| `null` | 容量参数定于哪一天；`null` = 未定（用的是通用默认值） |
| `capacity.windowMinutes` / `dailyMinutes` / `interruptionMinutes` / `schedulableMinutes` / `remainingMinutes` | number | 可排时间 = 窗口 − **窗口内**日清 − 插入损耗（**算得出来**，不是黑箱） |
| `capacity.dailyMinutesInWindow` / `capacity.dailyMinutesOutsideWindow` | number | 日清成本里落在可用窗口内的 / 落在窗口外的（「窗口外那笔不占可排时间」要能过界） |
| `capacity.deepQuota` / `pomodoroMinutes` | number | 深度名额与番茄分钟（都是参数，不写死） |
| `capacity.currentWindow` | 对象 \| `null` | 当前所处的时间窗口；落在窗口外时为 `null`（不是错） |
| 每条便贴 `eligible` | boolean | 有没有资格进焦点 |
| 每条便贴 `ineligibleReason` | 字符串 \| `null` | 没进焦点的原因（取值见下） |
| `focus.card.requirement` | 对象 | 主卡上的完成要求：`text`（原文）+ `source`（来源标记） |
| `focus.card.project` | 对象 \| `null` | **卡脚的项目指针**：`id`（项目箱里那张箱签）+ `name`（项目名）+ `record`（①–⑨ 编号）。推不出就是 `null`——**缺就是缺，不编** |
| `focus.card.twoMinute` | boolean | 这张卡是不是**两分钟卡**（收集箱里「估时不超过两分钟就能做完」的捕获）。`false` = 正常动作。**Client 侧据此显示「直接做掉、别判定」的引导**，文案归 Client |
| 每条便贴 `requirement` | 对象 | 这一条动作的完成要求：`text`（原文）+ `source`（来源标记）；**键不省**，没有时两个字段都是 `null` |

**不合格原因的取值全集**（`INELIGIBLE_REASONS`，`lib/focus-guide.js` 导出）：
`未判定`、`等待`、`收集箱未明晰`、`未来日历项`、`项目不出卡`、`未到触碰日`、`日清常驻顶部`、
`深度配额已用`、`已完成`。

## 完成要求的口径

完成要求有**两条来源**，主次分明（规格 issue #1「数据来源与边界」）：

| 优先 | 来源 | 取什么 |
|---|---|---|
| 1 | **与动作编号匹配的 markdown 记录页** | 那一页的「验收标准」 |
| 2 | **动作正文里的结构化前缀 `完成要求：…`** | 前缀后面那段 |

- **单一口径**：解析只有一个入口——`lib/requirement.js` 的 `requirementOf(note, records)`。
  便贴上的 `requirement` 与行动卡上的 `focus.card.requirement` 出自同一个函数，
  不会出现「从两处读到两个不同的完成定义」。
- **记录页优先**：编号匹配到了、但那一页**没有**验收标准（`acceptance === null`）时，
  回退正文前缀；编号根本没匹配上，也回退正文前缀。
- **不是双写**：记录页承载的是**项目级**的验收标准，正文前缀承载的是**这一条动作**的完成要求，
  层级不同。所以**只取其一**，不把两边拼在一起。
- **前缀写法**与既有的 `下一步：`／`等谁：`／`什么时候回：`／`到期没回做什么：` 同一套约定，
  全角冒号与半角冒号都认。
- **两条都没有就是空**（`text: null`、`source: null`）：空说明判定没做完——**不编**，也不拿标题充数。
- `source` 的取值全集：`记录页`、`正文前缀`、`null`（没有完成要求）。

⚠️ **两个「焦点」不要混**：v1 的**本周主攻**数组在快照里叫 `mainPush`；
v2 的**焦点**是 `focus` 对象（`focus.card` / `focus.next`）。两者语义不同、名字不重叠。

## 容量参数

容量配置是**本机文件**（不进公开仓库），由会话里的 agent 建立、周回顾时提议修订、用户点头才改。
公开仓库里关于容量参数只有三样东西：**schema**（`app/capacity.schema.json`）、
**通用默认值**（`lib/capacity.js` 的 `DEFAULT_CAPACITY_CONFIG`）、**虚构的示例**。
**真实容量数值属于个人工作容量，不进公开仓库**（ADR-0011、`AGENTS.md` 的隐私线）。

### 本机配置怎么写

本机配置写在**仓库根的 `local-config.json`**（被 `.gitignore` 挡掉，永远不进版本库）的
**「容量」** 字段里——**整份容量参数**：

```json
{
  "记录目录": "D:/local/my-notes/issues",
  "容量": {
    "定于": "2026-01-01",
    "窗口": [{ "起": "09:00", "止": "12:00", "类": "连续" }],
    "不可占": [{ "起": "12:00", "止": "13:30", "说明": "示例午休" }],
    "日清": [{ "名": "示例固定成本", "时段": "09:00", "成本分": 15 }],
    "插入损耗分钟": 45,
    "深度": { "单日上限分钟": 180, "单日配额": 1, "估时系数": 2 },
    "番茄分钟": 25
  }
}
```

字段名是中文，因为这份文件就是给会话里的 agent 写的。完整形状见 `app/capacity.schema.json`
（JSON Schema，draft 2020-12；里面的示例值全是虚构的）。上面的片段也只是**虚构示例**。

同一份文件里还有一个 **「两分钟」** 字段，放两分钟规则的参数（启用、阈值、日回顾窗口）——
形状见下面的「两分钟卡」一节。

### 读取与降级

`readCapacityConfig({ root })`（`lib/config.js`）**每次调用都重新读盘，不缓存**：
**改完配置 → 刷新页面 → 立刻生效**。

读取是容错的：任何一步不顺利都**降级为通用默认值**——不抛、不让工作台起不来。
会触发降级的情况：文件读不到、不是合法 JSON、没有「容量」字段、「容量」不是对象、
字段缺失、类型不对、时刻格式不对（`9点`）、窗口起止颠倒（止早于起）、多一个不认识的字段。

口径是**要么整体有效，要么整体退回**：不做「半坏的配置」——
半坏的配置会算出一个看起来准、其实错的剩余时间（ADR-0011：猜出来的数比没有数更危险）。
退回之后 `capacity.asOf` 是 `null` = **未初始化**，界面据此显示「参数未定」，
所以「配置写坏了」是看得见的，不会变成一个看着准的错数。

### 怎么接进路由

`createTasksHandler` / `createActionsHandler` 的 `capacityConfig` 依赖
既可以是**对象**，也可以是**返回对象的函数**（`app/index.js` 传 `() => readCapacityConfig()`）。
函数在**每次请求**里现取——改完配置刷新就生效；**一次请求内只解析一次**：
写方向「找目标」与「写完重新取数」用的是同一份容量口径。

没有给（或者给坏了）就退回通用默认值：快照里 `capacity.asOf` 是 `null`（= 参数未定），
剩余可排时间按通用默认值算。

### 口径

- **只存输入，不存推导值**：可排时间实时算，配置里没有「今天还剩多少」这种字段。
- **窗口时长** = 窗口扣掉与「不可占」重叠的那部分之后的**可支配**时长。
- **日清成本分两拨**（ADR-0011 修订）：
  - 落在**可用窗口内**的 → 从可排时间里扣（它要占掉窗口里的时间）；
  - 落在**窗口外**的（例如傍晚到件的固定成本）→ **不占可排时间**（那个时刻本来就不装活），
    但仍然算进顶部「今日日清未还几笔」的统计，也仍然占「今天必须还清」。
- **插入损耗**按**全天全额**预留（保守口径）。
- **可排时间与剩余可排时间都不为负**：不够就是 0，不报负数。
- `窗口` 条目上的 `类`（`连续` / `可打断`，不写按 `可打断`）是对 ADR-0011 内联形状的**唯一扩展**：
  `连续` 的窗口优先派深度活，`可打断` 的窗口派事务活（ADR-0010「时段驱动」）。
- `深度.单日配额` 是**单日深度动作名额**（默认 1）：名额用完后，后续深度动作自动推到下一天。
- `深度.估时系数` 是**惰性字段，现在不参与估时**——估时改用滴答自己的专注估算字段（见下）。
  它留在形状里只是为了不破坏既有配置，别以为它还在起作用。

## 预计耗时

来源是滴答任务 JSON 里的 `focusSummaries.estimatedDuration` 与 `focusSummaries.estimatedPomo`
（**不在顶层**）：

- **`estimatedDuration` 的单位是秒**——滴答 CLI 的 `task update --help` 写明
  `--estimated-duration <seconds> 预计专注时长（秒）`；估时分钟 = 它 ÷ 60（保留两位小数）；
- 没有这一项时 = `estimatedPomo` × 番茄分钟（**番茄分钟来自本机容量配置**，配置里没有就用通用默认值 25）；
- **取值优先级：`estimatedDuration` 在前**（它比「几个番茄」更接近真实时长），番茄数作备选；
- 两个都没有（或都为 0）= **未估算**（快照里是 `null`，**不是 0 分钟**）；
- 不新增滴答标签、不新增滴答字段。

估时的口径只有**一个入口**：`lib/capacity.js` 的 `estimateOf(note, { pomodoroMinutes })`。
便贴、行动卡与「接下来」队列的估时都从它出，别处不再各算一份
（口径的来由见 [ADR-0011](../docs/adr/0011-容量参数的初始化与调校.md) 的「修订（2026-11-08）」一节）。

主卡上的 `estimateMinutes` 为 `null` 时，界面要说「未估算」，不能画成「0 分钟」。

## 焦点资格与排序的口径

资格是**过滤**（八条，来自 GTD 明晰流程图），排序是**四标准映射**（GTD 选择行动）：

1. 已明晰、落在执行清单的动作；
2. 日历项仅在它那一个时刻（已到或就在当前窗口里）；
3. 等待清单永不占主卡，只在「到期没回」时进提醒位；
4. 项目清单不出卡；
5. 可能清单到触碰日才进焦点；
6. 日清不参与排序，顶部常驻；
7. 收集箱里未判定的捕获不进焦点——**唯一例外是两分钟规则**：
   估时不超过两分钟的捕获在**整理收集箱**时直接顶到主卡位，
   **深度块进行中**不许抢位（见下节）；
8. 缺时间档视为未判定。

排序五组：① 逾期或今天到期 → ② 本周主攻（深度档）→ ③ 本周内到期 → ④ 事务档填充 → ⑤ 其余有期限。
**优先级字段只做同组内 tiebreaker**，不跨组；同组内按到期时间升序、再按 id 稳定排序。

主卡按当前所处的时间窗口挑选（连续窗口优先派深度、可打断窗口派事务）；
窗口是**默认建议不是锁**：落在窗口外时按实际位置重算，不报错、不空转。
逾期的动作例外——破掉的外部时间点不可逆，不受时段偏好影响。

## 两分钟卡

GTD 的两分钟规则：**两分钟能做完就当场做掉，别放进系统里等**。
工作台上的落法是——收集箱里估时不超过两分钟的捕获，在**整理收集箱**时直接占住主卡位，
并给 Client 一个可断言的标记，由 Client 显示「直接做掉、别判定」的引导。
**Host 只给标记与事实，文案归 Client。**

### 两个口径（这一票定的）

| 口径 | 判定 | 为什么 |
|---|---|---|
| **整理收集箱** | 当前时刻落在**日回顾窗口**内（`reviewWindow`，默认 14:45–15:00） | 不用「收集箱非空」：两分钟卡本身就在收集箱里，收集箱非空时它必然成立，等于没有闸门。闸门必须落在**时刻**上（ADR-0010「琐事不该把上午唯一的连续块切碎」）。日回顾是 GLOSSARY 里的既有概念：每天一次、约 10 分钟，清空收集箱。 |
| **深度块进行中** | 当前时刻落在**连续窗口**内，**且**今天的**深度名额还挂着一条未完成的深度档动作** | 连续窗口是深度块的地盘；名额没人挂（今天没有深度档动作）时，那段时间没被深度占着，两分钟卡可以抢位。这时它**不占主卡**、不报错、不空转——主卡照旧是正常动作。 |

三个条件同时成立才允许抢位：**规则开着** ∧ **在日回顾窗口内** ∧ **深度块没有在跑**。

### 估时口径

- 只用滴答**已有的** `focusSummaries.estimatedDuration` / `estimatedPomo`
  （见「预计耗时」一节）：**不新增滴答标签、不新增滴答字段**。
- 「不超过两分钟」= `estimateMinutes !== null && estimateMinutes <= maxMinutes`。
- **未估算（null）不算两分钟**——没估时就不能说它两分钟能做完。
- **番茄数那条路够不着两分钟**：一个番茄最少 25 分钟（番茄分钟是参数，缺省 25），
  永远大于两分钟——两分钟卡只能走**专注时长**那条路（120 秒 = 2 分钟）。
- `maxMinutes` 是**参数**（默认 2），**不写死在判断逻辑里**：判断只读上下文/配置里的这个数。

### 引导标记

- `focus.card.twoMinute`（boolean）：`true` = 这张卡是收集箱里两分钟能做完的捕获。
  普通卡上这个字段是 `false`（**键不省**）。
- 收集箱那条便贴上：`eligible: true` / `ineligibleReason: null`——
  收集箱里**唯一**能有资格的条目就是两分钟卡，其余捕获都是「收集箱未明晰」。
- 事实（`estimateMinutes` / `estimateSource`）照旧随卡片过界，Client 不用自己算估时。

### 队列与完成

- **两分钟卡不进「接下来」**：它要么占着主卡，要么还留在收集箱里等下一个日回顾窗口——
  队列是**已判定的动作**的队列，而两分钟卡正是「别判定、直接做掉」的那一类。
- **勾完就消失**：在滴答勾完成（`status=2`）之后，它既不在焦点、也不在六箱画布的收集箱里
  （取数只取未完成），**不进任何分类**，也不新增字段。
- 逾期的动作**不受**这条规则影响：两分钟规则不是时段偏好，是一条**资格例外**；
  被它挤下去的逾期动作按排序进「接下来」的第一位，不会消失。

### 本机怎么配

规则参数放在仓库根 `local-config.json` 的**「两分钟」**字段里（被 `.gitignore` 挡掉，不进仓库）：

```jsonc
{
  "两分钟": {
    "启用": true,
    "上限分钟": 2,
    "日回顾窗口": { "起": "14:45", "止": "15:00" }
  }
}
```

读取与降级口径与容量配置**同一套**（`readTwoMinutePolicy`，`lib/config.js`）：
**要么整体有效，要么整体退回通用默认值**——不做「半坏的配置」。
「启用: false」是合法配置（用户主动关掉这条规则），不是降级。
每次请求都重新读盘：改完配置 → 刷新页面 → 立刻生效。

### Client 侧怎么显示（ticket/11-client 已落地）

- 主卡是**两分钟卡**（`focus.card.twoMinute === true`）时，卡面显示一句引导：
  **「两分钟卡：直接做掉、别判定」**（英文 `Two-minute card: do it now, skip deciding`）。
  Client 侧**不重算资格**——能不能抢主卡位由 Host 定，Client 只按这个标记显示。
- **DOM 标记**（可断言）：
  - 主卡根：`[data-role="focus-card"][data-state="two-minute"]`（正常行动卡是 `data-state="normal"`）；
  - 引导片：`[data-role="focus-card-two-minute"][data-state="two-minute"]`，就一个元素、一句话。
- **视觉**：引导片占**时间档角标那一格**（两分钟卡本来就没有时间档），
  样式是**描边的浅色片**（不是实心色块）；卡面描边比正常行动卡略强一档。
  整体克制——主卡的视觉重心仍在工作内容那一行，行动卡的信息量不增不减。
- **词表**：新登记一个键 `focusCardTwoMinute`，四处登记
  （`client.js` 的 zh/en 文案表、`app/locale/zh.json`、`app/locale/en.json`）。
- **完成后**：走**既有的「完成」写口**——`POST /gtd-workbench/actions`，响应里带着新快照，
  面板整体替换快照。主卡因此自动换成下一件，两分钟卡既不在焦点、也不在六箱画布的收集箱里
  （它是被勾完成的捕获，不是被「判定」进某个清单的）。
  **Client 侧不为它做任何特殊处理**：既有完成按钮与既有快照整体替换机制就够了。
- 测试：`app/test/seam-b-two-minute.test.js`（引导与标记、完成后消失）。

### 代码位置

- 判定与状态：`app/lib/focus-guide.js`（`twoMinutePolicyOf` / `twoMinuteStateOf` /
  `eligibilityOf` 的收集箱分支 / `focusGuideOf`）。
- 快照接线：`app/lib/snapshot.js`（`buildSnapshot` 的 `twoMinutePolicy` 选项）。
- 本机配置：`app/lib/config.js`（`readTwoMinutePolicy`）。
- Client 侧呈现：`app/client.js`（`FocusActionCard` 的引导片与 `data-state`）。
- 测试：`app/test/two-minute.test.js`（纯函数）、`app/test/seam-a-two-minute.test.js`（响应体）、
  `app/test/seam-b-two-minute.test.js`（DOM）。
