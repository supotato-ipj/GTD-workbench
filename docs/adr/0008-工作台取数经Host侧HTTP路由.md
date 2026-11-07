# 工作台取数：Host 半边跑 dida，经 HTTP 路由递给 Client

> **Status**: accepted（2026-11-05）· 修订（2026-11-07）：读写的 HTTP 契约见 [ADR-0006](0006-工作台是只读视图.md) 的「修订」节与 [ADR-0009](0009-工作台是焦点引导器.md)，取数通路本身不变

## 背景

工作台要读滴答（TickTick）里的任务。滴答在本机通过 `dida` CLI 访问，插件的 Client 半边在浏览器里，跑不了本地进程。Host 半边在 DSH 进程内，可以。

## 决定

### 通路：HTTP 路由，不是自定义 remote

- **Host 半边**用 `ctx.webServer.register({ kind: 'exact', path: '/gtd/tasks', handler })` 开一条路由，路由里跑 `dida`，把 JSON 吐回去。
- **Client 半边**用 `fetch('/gtd/tasks')` 取数。
- 路由必须带访问守卫：同机任何连接都不该读到你的 CLI 输出。用 `ctx.connection.requestRejection(req)` 拒掉不该来的连接。

**为什么不用 `ctx.remote.<新命名空间>`**：客户端那一侧的 remote 命名空间是**静态生成**进 `dsh-api-remotes` 的，加一个新命名空间要跑 typert 代码生成、产出 `typert.host.js` / `typert.remote-client.js` 并在客户端挂载。`ctx.remote.$mount()` 运行时挂载虽然存在，但贡献对象的形状是生成器形状的，手写一个能不能过 `validateContribution` 没有验证过。HTTP 路由是已验证的路（`dsh-host-open-in-app` 就是这么做的），且没有代码生成步骤。

### 调用 `dida` 的三条约束（都是实测出来的）

1. **不能用 `dida` 这个名字直接 spawn。** 它是 npm 的 `.cmd` / `.ps1` shim，Node 的 `spawn` 不带 `shell:true` 解析不了。必须用 `process.execPath` + 真实入口路径（Windows 上在 `%APPDATA%\npm\node_modules\@suibiji\dida-cli\dist\index.js`）。（或用 `ctx.subprocess.resolveExecutable('dida')`，但它同样返回 `.cmd`。）
2. **一次拉全部容器会撞 200 条上限。** `dida task filter --json` 一次返回六个容器，实测正好 200 条（被截断）。必须**分容器调用**。已沉底区改用 `dida task completed --projects <id> --start-date ... --end-date ...` 按日期取。
3. **`dida` 未登录时不能画空板。** CLI 冷启动或 token 失效会返回鉴权错误，工作台必须显式提示去登录，不能渲染成"今天没任务"。

### 还有一个 CLI 坑

`dida task search --projects <id>` 恒返回空数组；`dida task filter --projects <id>` 才正常。另外 `dida project list --json` 给出的 id 是截断的（22 位），任务里的 `projectId` 是完整 24 位——**按完整 id 查**。

### 谁跑 CLI

**Host 半边跑**（打开面板时拉一次，刷新按钮重跑），不预生成、不落盘。

理由：工作台不该依赖会话。预生成的话刷新按钮就是摆设，而且任何时候打开看到的都是上次生成时的数据。

### 拉数时机

打开面板时拉一次 + 一个手动刷新按钮。不轮询（滴答数据一天才动几次，轮询只白打 API），不做文件监听。

## 后果

- 插件的 Host 半边必须自己处理 `dida` 的退出码、stderr 和 JSON 解析，失败要显示在画布上而不是静默成空板。
- 画布上"今天"的时间基准取**浏览器本地时间**，与滴答任务携带的时区字段保持一致；本机时区与之不同时要显式换算。
- 这条通路同时决定了插件的形态：Host + Client 双半边一个包，`dsh.client.platform: "web"`，`inject` 指向声明 `main` 槽的 `@deepseek-ai/dsh-client-ui-layout`。
- v2 的写口（完成、改期）走**同一条** HTTP 契约：读是 `GET /gtd/tasks`，写是 `POST`（动作类型 + 目标 id + 参数），响应体带成功与否及失败原因。不为写口另造一套接缝。

## 迁移说明（2026-11-07）

本文件随工作台 v2 从个人本地仓库迁入公开仓库。原文中的本机绝对路径、条目计数与时区属个人环境细节，已按仓库 `AGENTS.md` 的 GitHub 隐私线改写为通用写法；决策条款未变。
