# Agent Guidelines & Repository Router

Executive orientation and routing guide for **Streak Snippets** AI agents.

---

## 1. Documentation & Customization Map

Consult pointers on demand to maintain minimal context overhead:

- **System Architecture**: @docs/ARCHITECTURE.md — Client/Server decoupling, `ts-morph` AST management, in-memory registries, and monorepos.
- **Agent Coding Rules**: @.agents/rules/ — Modular rules for architecture, diagnostics, performance, testing, clean code, and LSP features.
- **Agent Workflows & Skills**: @.agents/skills/ — Executable skills (`run-and-verify`, `add-diagnostic-rule`, `add-code-action`, `audit-code-quality`, `ast-query-guide`).
- **Framework User Rules Catalog**: @docs/RULES.md — User-facing catalog of framework diagnostics (S101–S907) for Streak developers (*not agent coding rules*).
- **Changelog**: @CHANGELOG.md — Version history and release notes.

---

## 2. Core Non-Negotiables

1. **Client/Server Decoupling**: @src/client/ is a thin VS Code host wrapper. Never import `ts-morph` or heavy compiler tools into client files.
2. **Monorepo Isolation**: All LSP request handlers (`validateDocument`, completions, hovers, definitions, code actions) MUST verify `findStreakProjectRoot(uri, workspaceRoot)` and return early if outside a Streak project.
3. **AST Lifecycle & Memory**: Transient `SourceFile` instances created with `createSourceFile()` MUST be explicitly deleted via `.delete()` inside a `try ... finally` block.
4. **Diagnostic Integrity**: All diagnostics MUST originate from @src/server/rules/, implement `StreakRule`, and set `source: "Streak Engine"`. Scoped rules (e.g. `streak:S204`) must validate only default-exported handlers.
5. **Clean Code & SonarQube Standards**: Keep cognitive complexity $\le 15$ per function, avoid regex alternations (prefer `Set` lookups), and prohibit untyped `any` and non-null assertions (`!`).

---

## 3. Quality Verification Gate

Execute the canonical verification workflow before completing any task:
- Workflow: @.agents/skills/run-and-verify/SKILL.md (`npm run compile-tests && npm run compile && npm run lint && npm test`).
- Ensure all tests pass with 0 errors.
