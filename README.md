# GTD-workbench

在 DeepSeek Harness（DSH）中搭建的 **GTD 待办规划工作台插件**。

## 主旨

把 GTD 的「收集 → 理清 → 组织 → 回顾 → 执行」落进 DSH 的会话与技能里：待办的捕获、澄清、排期和回顾都在工作台内完成，而不是散落在多个应用之间。目标是把「今天该干什么、这件事挤掉了什么」变成可查的判断，而不是靠记忆。

## 当前状态

搭建初期。仓库现在承载的是 agent 的工作契约与技能配置（`AGENTS.md` + `docs/agents/`），插件能力随后续 issue 逐步长出。

## 目录

| 路径 | 作用 |
|---|---|
| `AGENTS.md` | agent 在本仓库的工作方式约束（含 GitHub 隐私原则） |
| `docs/agents/issue-tracker.md` | issue 追踪约定：GitHub Issues + `gh` CLI |
| `docs/agents/domain.md` | 领域文档消费规则（单上下文） |

## 隐私

本仓库承载项目自身的工程内容——代码、文档、设计讨论与 issue，可以公开讨论。个人隐私与个人工作待办不进来：具体待办条目、日程、案件当事人、公司内部事务一律留在本地，示例均使用脱敏的虚构数据。详见 `AGENTS.md` 的 **GitHub 隐私线**。

## 许可

[MIT](LICENSE)
