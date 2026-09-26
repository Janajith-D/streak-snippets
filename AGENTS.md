# Agent Guidelines & Repository Router

Welcome to the **Streak Snippets** extension repository. This document serves as the executive orientation guide for AI agents and developers.

---

## 1. Documentation & Customization Map

Always consult the appropriate references rather than guessing or searching blindly:

| Purpose                  | Location                                       | Description                                                                                                     |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **System Architecture**  | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Client/Server lifecycle, `ts-morph` AST management, in-memory registries, and monorepos.                        |
| **Agent Coding Rules**   | [`.agents/rules/`](.agents/rules/)             | Modular standards for architecture, diagnostics, performance, testing, and clean code.                          |
| **Agent Workflows**      | [`.agents/skills/`](.agents/skills/)           | Executable workflows (`add-diagnostic-rule`, `run-and-verify`, `audit-code-quality`, `ast-query-guide`).        |
| **Framework User Rules** | [`docs/RULES.md`](docs/RULES.md)               | **Target: Streak app developers**. User catalog of framework diagnostics (S101–S907). _Not agent coding rules_. |
| **Changelog**            | [`CHANGELOG.md`](CHANGELOG.md)                 | Version history, recent deprecations, and release notes.                                                        |

---

## 2. Core Non-Negotiables

1. **Client/Server Decoupling**: `src/client/` is a thin VS Code host wrapper. Never import `ts-morph` or heavy compiler tools into client files.
2. **Monorepo Isolation**: All LSP request handlers (`validateDocument`, `onCompletion`, `onHover`, `onDefinition`, `onCodeAction`) MUST check `findStreakProjectRoot(uri, workspaceRoot)` and return early if the file is not in a Streak project.
3. **AST Lifecycle & Memory**: Transient `SourceFile` instances created with `createSourceFile()` MUST be explicitly deleted via `.delete()` inside a `try ... finally` block.
4. **Diagnostic Integrity**: All diagnostics must originate from `src/server/rules/`, implement `StreakRule`, and set `source: "Streak Engine"`. Scoped rules (e.g. `streak:S204`) must validate only default-exported handlers.
5. **Clean Code & SonarQube Standards**: Keep cognitive complexity $\le 15$ per function, avoid regex alternations (prefer `Set` lookups), and never use untyped `any` or forbidden non-null assertions (`!`).

---

## 3. Quality Verification Gate

Before completing any task, execute:

```bash
cmd.exe /c "npm run compile-tests && npm run compile && npm run lint && npm test"
```

Ensure all 78+ unit and integration tests pass with 0 errors.
