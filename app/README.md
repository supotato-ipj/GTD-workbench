# 任务梳理台（GTD 工作台）· DSH 插件

一个包，Host 半边 + Client 半边。**不写任何本地文件**（ADR-0006）；滴答那边只开**一个**写口：
**完成**（写 `status=2`，单口径，不建核销台账）。「改期」是下一票（issue #10）。
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

## 形状

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半边：`ctx.effect` 里用 `ctx.webServer.register` 开一条本机路由，挂上三个依赖 |
| `client.js` | Client 半边：左栏图标 + 主区面板（**外壳**与**视图**两层，`React.createElement`，不引构建步骤） |
| `lib/containers.js` | 六个纸箱与滴答清单 id（用完整 24 位 id） |
| `lib/config.js` | 本地私有配置 `local-config.json` 的只读读取 |
| `lib/dida.js` | 用真实入口 + 真 node 调滴答；允许集合＝两条读命令 + 一个写命令（`task complete`）；每条命令带超时 |
| `lib/route.js` | 读路由处理函数：访问守卫 + 取数编排 + 快照／失败原因（写路由复用它的取数与失败映射） |
| `lib/actions.js` | 写动作的校验与定位（纯函数）：动作类型、目标 id、参数；目标动作属于哪个清单 |
| `lib/write-route.js` | 写路由处理函数：执行写动作 → 重新取数 → 回一份新快照 |
| `lib/snapshot.js` | 滴答原始任务 → 工作台快照（两个进程之间唯一的契约） |
| `lib/board.js` | 六箱归位规则：画便贴还是箱签、默不默认折叠、日历箱的「外部约定时刻」口径 |
| `lib/timeline.js` | 天刻度四段（今天／明天／本周／以后）与默认视野 |
| `lib/focus.js` | **本周主攻**推导（只认滴答的 `深度` 标签，不读手写名单）；快照字段是 `mainPush` |
| `lib/focus-guide.js` | **焦点**推导：资格（八条）→ 排序（五组）→ 主卡／「接下来」／提醒位（纯函数） |
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
| ① 顶部常驻 | `focus-top` / `focus-stat`（`data-stat="daily｜remaining｜deep-quota"`） | 今日日清几笔未还、今日剩余可排时间、深度名额；下面一行 `focus-capacity-asof` 写「容量参数定于 <日期>」 |
| ② 行动卡（主位） | `focus-card`（`data-note-ref`） | 工作内容 `focus-card-title`、完成时限 `focus-card-due`、完成要求 `focus-card-requirement`、预计耗时 `focus-card-estimate`、容量提示 `focus-card-capacity` |
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

## 写口：完成（`POST /gtd-workbench/actions`）

写入走**同一条 HTTP 契约的写方向**：读是 `GET /gtd-workbench/tasks`，写是 `POST /gtd-workbench/actions`。

**请求体**：

```json
{ "动作": "complete", "目标id": "<动作 id>", "参数": {} }
```

- `动作`：动作类型。**现在只认 `complete`**（完成）。「改期」是 issue #10，届时**同一个路由**加一个动作类型即可。
- `目标id`：目标动作的 id（非空字符串）。
- `参数`：动作参数，可省。「完成」用不上；「改期」要带新的截止日。

**响应体**：

| 情形 | 状态码 | 响应体 |
|---|---|---|
| 写成功 | 200 | `{ "ok": true, "动作": "complete", "目标id": "…", "快照": { … } }` |
| 写成功但刷新没成 | 200 | `{ "ok": true, "动作": "…", "目标id": "…", "快照": null, "刷新错误": { "code": "…", "message": "…" } }` |
| 失败 | 见下 | `{ "error": { "code": "…", "message": "人能读的失败原因" } }` |

「快照」是**写成功之后重新取的一份**，形状与 `GET` 的响应体完全一致——客户端换主卡不必再发一次读请求。

**失败类别**（读方向与写方向同一套）：

| code | 状态码 | 含义 |
|---|---|---|
| `not-authenticated` | 401 | 滴答未登录／登录态失效 |
| `cli-unavailable` | 503 | 找不到滴答 CLI 入口或跑它的 node |
| `cli-failed` | 502 | CLI 跑挂了、输出不对、**或者超时** |
| `not-found` | 404 | 目标动作不存在（写方向专有） |
| `invalid-argument` | 400 | 参数非法或动作类型不支持（写方向专有） |
| `internal-error` | 500 | 认不出的错误 |

写失败**不会**表现为已完成：失败响应体里没有 `ok`、也没有 `快照`。

**滴答 CLI**：允许集合是显式的——两条读命令（`task filter` / `task completed`）加上**一个**写命令
`task complete`。其余写命令（新建、删除、改期……）拼不进 argv。argv 全仓库只在
`lib/dida.js` 的 `buildDidaArgs` 一处拼：

```
task filter    --projects <清单 id> --status 0 --json
task completed --projects <清单 id> --start-date … --end-date … --json
task complete  <清单 id> <动作 id>
```

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
| `focus.next` | 数组（0–4 条） | 「接下来」窄条队列 |
| `focus.reminders` | 数组 | 等待清单里「到期没回」的提醒位（**不占主卡**） |
| `today.daily` | 数组 | 今日日清项与状态（`未还清` / `已还清`） |
| `today.remainingMinutes` | number | 今日剩余可排时间（分钟） |
| `today.deepQuotaUsed` | boolean | 今天的深度名额是否已用掉 |
| `capacity.asOf` | 字符串 \| `null` | 容量参数定于哪一天；`null` = 未定（用的是通用默认值） |
| `capacity.windowMinutes` / `dailyMinutes` / `interruptionMinutes` / `schedulableMinutes` / `remainingMinutes` | number | 可排时间 = 窗口 − **窗口内**日清 − 插入损耗（**算得出来**，不是黑箱） |
| `capacity.dailyMinutesInWindow` / `capacity.dailyMinutesOutsideWindow` | number | 日清成本里落在可用窗口内的 / 落在窗口外的（票 07 新增，`snapshot.js` 的 `capacity` 块待接线） |
| `capacity.deepQuota` / `pomodoroMinutes` | number | 深度名额与番茄分钟（都是参数，不写死） |
| `capacity.currentWindow` | 对象 \| `null` | 当前所处的时间窗口；落在窗口外时为 `null`（不是错） |
| 每条便贴 `eligible` | boolean | 有没有资格进焦点 |
| 每条便贴 `ineligibleReason` | 字符串 \| `null` | 没进焦点的原因（取值见下） |
| `focus.card.requirement` | 对象 | 主卡上的完成要求：`text`（原文）+ `source`（来源标记） |
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

来源是滴答任务 JSON 里的 `focusSummaries.estimatedPomo` 与 `focusSummaries.estimatedDuration`
（**不在顶层**）：

- 估时分钟 = `estimatedPomo` × 番茄分钟（**番茄分钟来自本机容量配置**，配置里没有就用通用默认值 25）；
- `estimatedPomo` 为 0 或缺失 = **未估算**（快照里是 `null`，**不是 0 分钟**）；
- `estimatedDuration` 作备选，**单位按分钟处理——这是一个假设**（滴答侧没有声明单位），
  实测前请以真实数据核对一次；
- 不新增滴答标签、不新增滴答字段。

主卡上的 `estimateMinutes` 为 `null` 时，界面要说「未估算」，不能画成「0 分钟」。

## 焦点资格与排序的口径

资格是**过滤**（八条，来自 GTD 明晰流程图），排序是**四标准映射**（GTD 选择行动）：

1. 已明晰、落在执行清单的动作；
2. 日历项仅在它那一个时刻（已到或就在当前窗口里）；
3. 等待清单永不占主卡，只在「到期没回」时进提醒位；
4. 项目清单不出卡；
5. 可能清单到触碰日才进焦点；
6. 日清不参与排序，顶部常驻；
7. 收集箱里未判定的捕获不进焦点——**两分钟规则是后续一票**（issue #11），
   本票只留接口（上下文里的 `twoMinute: { enabled, maxMinutes, allowed }`），不启用；
8. 缺时间档视为未判定。

排序五组：① 逾期或今天到期 → ② 本周主攻（深度档）→ ③ 本周内到期 → ④ 事务档填充 → ⑤ 其余有期限。
**优先级字段只做同组内 tiebreaker**，不跨组；同组内按到期时间升序、再按 id 稳定排序。

主卡按当前所处的时间窗口挑选（连续窗口优先派深度、可打断窗口派事务）；
窗口是**默认建议不是锁**：落在窗口外时按实际位置重算，不报错、不空转。
逾期的动作例外——破掉的外部时间点不可逆，不受时段偏好影响。
