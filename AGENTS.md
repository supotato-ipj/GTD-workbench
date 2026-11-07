# GTD-workbench

## 工作方式约束（硬性）

- 严格遵循 Matt 系列技能（grilling、tdd、diagnosing-bugs、code-review、domain-modeling、research、prototype、wizard、writing-for-agents 等）的既定流程与门禁，不得跳过步骤、不得简化流程。
- 不做任何默认操作：不替用户拍板，不按偏好、习惯或缺省值自行推进；凡是需要用户选择、取舍或确认的地方，一律先问。
- 特别是 grilling（/grill）技能：问答结束后必须在当前对话中总结一份共识清单，并明确询问用户是否确认；在得到用户的明确答复之前，禁止直接执行任何后续动作。
- **GitHub 隐私原则（红线）**：本仓库是公开库。凡涉及用户个人**真实待办**和**真实工作事项**的内容，一律禁止上传到 GitHub——包括 commit 内容、issue、PR、评论、附件、代码示例与测试数据；其中「真实工作事项」也涵盖案件、公司、同事、日程等可识别信息。需要举例时，一律改用脱敏的虚构样例。

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
