# 任务梳理台（GTD 工作台）· DSH 插件

一个包，Host 半边 + Client 半边。**只读**：不写滴答、不写仓库文件（ADR-0006）。
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

**`--status 0` 不能省**：不带状态过滤时，收集箱与日历单次就会撞满 CLI 的 200 条上限（实测）。

## 记录页

抽屉里那三段（「为什么／验收标准／卡点」）来自**记录页**（markdown 页），
在仓库根的 `records/` 下——那是**虚构样本**，开箱即用。

记录页的写法（`parseRecord` 认的段落）：

- 文件名 `NN-<任意 slug>.md`，`NN` 决定编号（`01` → ① … `09` → ⑨）。
- 一级标题是页名。
- `## 为什么…` / `## 现状` / `## 关键判断` / `## 背景` / `## 策略` / `## 目标` → 取**第一段**作「为什么」。
- `## 验收…` → 取第一段作「验收标准」；没有这一节但正文里提到「验收标准」，就捞那句原文。
- `## 卡在…` / `## 卡点…` / `## 阻塞…` → 取第一段作「卡点」。
- 缺哪一段就是 `null`——**不编**。

目录读不到就返回空数组：画布照常画，抽屉里显示「无对应记录」。

## 形状

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半边：`ctx.effect` 里用 `ctx.webServer.register` 开一条本机路由，挂上三个依赖 |
| `client.js` | Client 半边：左栏图标 + 主区面板（`React.createElement`，不引构建步骤） |
| `lib/containers.js` | 六个纸箱与滴答清单 id（用完整 24 位 id） |
| `lib/dida.js` | 用 `process.execPath` + 真实入口调滴答；只跑读命令（`task filter` / `task completed`） |
| `lib/route.js` | 路由处理函数：访问守卫 + 取数编排 + 快照／失败原因 |
| `lib/snapshot.js` | 滴答原始任务 → 工作台快照（两个进程之间唯一的契约） |
| `lib/board.js` | 六箱归位规则：画便贴还是箱签、默不默认折叠、日历箱的「外部约定时刻」口径 |
| `lib/timeline.js` | 天刻度四段（今天／明天／本周／以后）与默认视野 |
| `lib/focus.js` | 本周主攻推导（只认滴答的 `深度` 标签，不读手写名单） |
| `lib/rules.js` | 规则角标的四项检查 |
| `lib/sunk.js` | 已沉底区：最近七天按完成日堆叠 + 每箱完成数 |
| `lib/markdown.js` | 记录页解析（为什么／验收标准／卡点）与 ①–⑨ 匹配 |
| `lib/records.js` | Host 侧读 `<repo>/records/*.md`（只读） |
| `lib/diff.js` | 状态迁移差异检测（只演真实发生过的变化） |

取数路由：`GET /gtd-workbench/tasks`（顶层路径，带命名空间前缀）。

## 画布上有什么

- 六个纸箱：收集箱、项目、执行、等待、日历、可能（顺序固定，ADR-0007）。
- 每箱一条天刻度时间轴：今天／明天／本周／以后；默认只铺今天与本周，其余折叠成一条计数。
- 本周主攻：一条独立带子，摆在纸箱上方，由滴答的 `深度` 标签推导。
- 已沉底：画布下方，最近七天已勾选的条目按完成日堆叠；每箱角标另标完成数。
- 规则角标：违反容器规则的便贴亮一个 ⚑，点开看缺了什么。
- 点便贴开抽屉：滴答原始字段 + markdown 里的「为什么／验收标准／卡点」。
