# GTD-workbench

在 DeepSeek Harness（DSH）中搭建的 **GTD 待办规划工作台插件**。

## 主旨

把 GTD 的「收集 → 理清 → 组织 → 回顾 → 执行」落进 DSH 的会话与技能里：待办的捕获、澄清、排期和回顾都在工作台内完成，而不是散落在多个应用之间。目标是把「今天该干什么、这件事挤掉了什么」变成可查的判断，而不是靠记忆。

## 当前状态

工作台 v2「从六箱全景改为焦点引导器」的实施中。规格在 GitHub issue #1，子票 #2–#11。
词表与决策记录已经归位，插件源码已迁入本仓库（`app/`），基线测试全绿。

## 目录

| 路径 | 作用 |
|---|---|
| `AGENTS.md` | agent 在本仓库的工作方式约束（含 GitHub 隐私原则） |
| `app/` | 任务梳理台插件源码（Host 半边 + Client 半边 + 测试） |
| `records/` | **虚构**的记录页样本：抽屉里那三段「为什么／验收标准／卡点」的来源 |
| `GLOSSARY.md` | 词表：工作台用语与 GTD 方法论词（本项目只用这一套说法） |
| `docs/adr/` | 决策记录（ADR）：状态标记与写法见 `docs/agents/domain.md` |
| `docs/agents/issue-tracker.md` | issue 追踪约定：GitHub Issues + `gh` CLI |
| `docs/agents/domain.md` | 领域文档消费规则（单上下文）+ ADR 约定 |

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

### 记录页目录怎么配

抽屉里那三段文字来自**记录页**（markdown 页，`NN-<slug>.md`，`NN` 决定编号 ①–⑨）。
目录由三处决定，优先级从高到低：

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

## 隐私

本仓库承载项目自身的工程内容——代码、文档、设计讨论与 issue，可以公开讨论。个人隐私与个人工作待办不进来：具体待办条目、日程、案件当事人、公司内部事务一律留在本地，示例均使用脱敏的虚构数据。详见 `AGENTS.md` 的 **GitHub 隐私线**。

仓库里的一切示例数据都是**虚构**的：`app/test/fixtures/` 下的夹具、`records/` 下的样本页、
以及代码与注释里的清单 id，都是编出来的，不对应任何真实的人、案件、机关或单位。
`.scratch/` 与 `local-config.json` 指向的是本机的真实数据，已被 `.gitignore` 挡掉。

## 许可

[MIT](LICENSE)
