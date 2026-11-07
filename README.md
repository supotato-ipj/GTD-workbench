# GTD-workbench

在 DeepSeek Harness（DSH）中搭建的 **GTD 待办规划工作台插件**。

## 主旨

把 GTD 的「收集 → 理清 → 组织 → 回顾 → 执行」落进 DSH 的会话与技能里：待办的捕获、澄清、排期和回顾都在工作台内完成，而不是散落在多个应用之间。目标是把「今天该干什么、这件事挤掉了什么」变成可查的判断，而不是靠记忆。

## 当前状态

搭建初期。仓库现在承载的是 agent 的工作契约与技能配置（`AGENTS.md` + `docs/agents/`），
以及**任务梳理台插件**的源码（`app/`）。插件能力随后续 issue 逐步长出。

## 目录

| 路径 | 作用 |
|---|---|
| `AGENTS.md` | agent 在本仓库的工作方式约束（含 GitHub 隐私原则） |
| `app/` | 任务梳理台插件源码（Host 半边 + Client 半边 + 测试） |
| `records/` | **虚构**的记录页样本：抽屉里那三段「为什么／验收标准／卡点」的来源 |
| `docs/agents/issue-tracker.md` | issue 追踪约定：GitHub Issues + `gh` CLI |
| `docs/agents/domain.md` | 领域文档消费规则（单上下文） |

## 插件（`app/`）

任务梳理台是 DSH 的一个插件：把滴答清单里的待办画成「六个纸箱 + 时间轴」的只读画布，
点开一张便贴能看到滴答原始字段，外加 markdown 侧的「为什么这么定／验收标准／卡点」。

插件的详细说明（装法、画布上有什么、记录页怎么写）在 [`app/README.md`](app/README.md)。

### 跑测试

```
cd app
npm install          # 只装测试用的 react / react-dom / jsdom
npm test
```

等价于：

```
node --test --test-isolation=none --test-concurrency=1 "test/**/*.test.js"
```

**那两个参数不能省**：默认隔离会 spawn 子进程（受限环境下 EPERM），
并发跑文件会让几个测试互相借走全局 `document`／`window`，表现成随机失败。

测试分两条接缝：**接缝 A**（数据边界，Host → 客户端）真的起一个本机 HTTP 服务器请求那条路由；
**接缝 B**（渲染边界，快照 → 画布）给渲染层一份固定快照并断言画布 DOM。
两条接缝都用**固定夹具**，不依赖本机实时滴答数据。

## 隐私

本仓库承载项目自身的工程内容——代码、文档、设计讨论与 issue，可以公开讨论。个人隐私与个人工作待办不进来：具体待办条目、日程、案件当事人、公司内部事务一律留在本地，示例均使用脱敏的虚构数据。详见 `AGENTS.md` 的 **GitHub 隐私线**。

仓库里的一切示例数据都是**虚构**的：`app/test/fixtures/` 下的夹具、`records/` 下的样本页、
以及代码与注释里的清单 id，都是编出来的，不对应任何真实的人、案件、机关或单位。

## 许可

[MIT](LICENSE)
