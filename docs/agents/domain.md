# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root, or
- **`GLOSSARY-MAP.md`** at the repo root if it exists: it points at one `GLOSSARY.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presence of `GLOSSARY-MAP.md` at the root):

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

## ADR conventions

`docs/adr/` holds one decision per file, named `NNNN-<中文 slug>.md` (`0006-工作台是只读视图.md`). Numbers are sequential and never reused.

- **Status marker** goes on the first line: `> **Status**: accepted（YYYY-MM-DD）`. A superseded ADR reads `superseded by [ADR-XXXX](....)（YYYY-MM-DD）`; a partial revision reads `· 修订 [ADR-XXXX](....) 中「...」一条`.
- **Never delete or rewrite an existing ADR.** To change a decision, **append** a `## 修订（YYYY-MM-DD）` section saying what is kept, what is overturned, and why. The overturned clause stays in the body; the revision section declares its fate.
- **Superseding** is marked with `superseded by` plus a link to the new ADR. The old file's body is kept as-is.
- Every ADR states 背景 / 决定 / 理由 / 后果 (后果 = 代价). Read the existing files in this directory to match the house style before writing a new one.
