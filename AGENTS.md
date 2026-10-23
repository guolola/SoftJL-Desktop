# Codex Project Guidance

This independent repository builds the personal Windows Electron edition. Use src/main for native and local backend code, src/preload for privileged bridges, src/renderer for React UI, and src/shared for contracts. Preserve renderer app, features, entities, services, and shared boundaries.

## Working Standards

- Read the relevant module, tests, and contracts before changing behavior.
- Keep edits scoped to the requested task; do not perform opportunistic rewrites or unrelated cleanup.
- Never revert user changes unless the user explicitly asks for that exact rollback.
- Prefer existing project patterns, components, helpers, and test utilities over new abstractions.
- Support current contracts; reject obsolete persisted formats rather than silently migrating them or fabricating provenance. Keep current protocol integrations, retries, and failure recovery.
- Treat generated assets, vendor runtimes, large binaries, and caches as special-case artifacts; do not add them to source control unless the task explicitly requires it.

## Comments and Generated Files

- New files must start with a short responsibility note when their purpose is not obvious from the filename.
- Add concise comments for core workflows, state transitions, cross-module contracts, and non-obvious edge-case handling.
- Do not add noisy line-by-line comments or comments that merely restate the code.
- Generated code should include useful intent comments around important logic so future Codex runs and human maintainers can quickly understand the design.

## Documentation Standards

- Project-authored Markdown files and documentation directories use lowercase English `kebab-case`; only protocol files named `README.md`, `AGENTS.md`, and `SKILL.md` keep their conventional uppercase names.
- Do not create active documentation whose filename contains a date or process-state terms such as `plan`, `audit`, `final`, `followup`, or `fixes`. Merge durable conclusions into the relevant topic document instead.
- Every Markdown file has exactly one H1 and non-skipping heading levels. Start non-protocol Markdown files with a short HTML responsibility comment.
- Technical documents under `docs/` use the sections `概述`, `当前设计或配置`, `操作与维护`, `验证`, and `相关文档`, plus maintenance status, target audience, and factual source metadata.
- In-app user guides use `适用场景`, `入口位置`, `前置条件`, `操作步骤`, `结果与产物`, `映射关系`, and `常见问题`. Service and component READMEs use `职责`, `边界`, `使用或常用命令`, `配置`, `验证`, and `相关文档`.
- Use relative `/`-separated internal links. Never include local absolute paths, test accounts, real secrets, or unnecessary production server addresses in documentation.
- Do not commit historical planning notes, audit logs, temporary screenshots, local documents, workspace secrets, or generated Sandpack files. The runtime Skill Markdown under `src/main/modeling/code-skills/ui-ux-pro-max/` is exempt from ordinary documentation rewriting.
- Run `npm run audit:docs` before committing documentation changes.

## API Layering

- Keep `src/main/modeling/index.ts` focused on entrypoint compatibility and server assembly; do not add new business responsibilities there.
- API routes belong under `src/main/modeling/routes/<domain>/` and should only register endpoints, parse request/response schemas, and call the appropriate pipeline or adapter.
- Run lifecycle state belongs under `src/main/modeling/runs/records/`; pipelines under `src/main/modeling/runs/pipelines/` own business stage flow, event emission, and transitions between queued, running, completed, and failed.
- Normalizers belong under `src/main/modeling/normalizers/<domain>/` and should only repair or normalize LLM output, JSON, PlantUML, and model structures.
- Adapters belong under `src/main/modeling/adapters/<integration>/` and should only call external systems such as LLM providers, PlantUML, render services, or file conversion tools.
- Document code belongs under `src/main/modeling/documents/<domain>/` and should only build document context, sections, and DOCX buffers.
- New API files must live in the appropriate second-level domain folder, such as `routes/runs/` or `adapters/render/`; do not flatten extracted files directly into `src/routes`, `src/runs`, or other broad folders.
- Add concise comments around run lifecycle state changes, SSE terminal event closing, LLM/PlantUML repair loops, DOCX assembly boundaries, and the route -> pipeline -> record store contract.

## Frontend Expectations

- Keep page components focused on composition; move reusable state, derived rules, and workflow decisions into hooks or helpers when they start to grow.
- Preserve user-facing constraints in both UI state and action guards, then cover them with tests.
- Use existing shared UI primitives and maintain accessible labels for controls.
- When a model, diagram, or generation step has prerequisites, show the reason inline instead of only disabling controls.

## Verification

- Keep module tests beside their source. Put application integration tests and fixtures under root `tests/`; use shared contract testing exports and shared demo fixtures through relative imports.
- Add or update tests for user-visible behavior changes.
- Prefer targeted tests first, then broader workspace scripts such as `npm run test:renderer` and `npm run typecheck:renderer`.
- If verification cannot be run, state the reason clearly in the final response.
