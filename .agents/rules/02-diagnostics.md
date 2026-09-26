---
description: Diagnostic rules architecture and authoring guidelines in Streak Snippets
globs: src/server/rules/**/*.ts, src/server/server.ts
---

# Diagnostics & Rule Authoring

## 1. Diagnostic Architecture

All diagnostics MUST originate from dedicated rule classes in `src/server/rules/`:
- **Interface**: Every rule must implement `StreakRule` from `src/server/rules/types.ts`.
- **Diagnostic Source**: All emitted diagnostics MUST strictly set `source: "Streak Engine"`.
- **Diagnostic Code**: All codes MUST follow `streak:Sxxx` (e.g. `streak:S101`, `streak:S204`).
- **No Ad-hoc Diagnostics**: Never create or emit diagnostics directly inside completion, hover, or definition providers.

## 2. Rule Scoping & False-Positive Prevention

- **Default Export Scoping**: For rules targeting exported framework contracts (such as data handlers in `streak:S201`, `streak:S202`, `streak:S204`), validate ONLY the default-exported handler function via `getDefaultExportedHandler(sourceFile)`. Never flag helper or utility functions defined in the same file.
- **File Exclusions**: Static rules must exclude test folders (`src/test/`, `src/tests/`, `__tests__/`) and unrelated utility files unless explicitly intended.
- **Configurability**: Every rule must support user-configured severity (`"error" | "warning" | "information" | "hint" | "off"`), mapped through `package.json` and `StreakSettings`.

## 3. Registering New Rules Checklist

When adding a new diagnostic rule:
1. Implement rule logic in `src/server/rules/<ruleName>Rule.ts`.
2. Register the rule in `src/server/rules/index.ts` within the `allRules` array.
3. Map rule severity configuration in `src/server/server.ts` (`buildRuleConfiguration`).
4. Expose configuration in `package.json` under `contributes.configuration.properties`.
5. Add unit tests in `src/test/extension.test.ts`.
6. Document in `docs/RULES.md` with SonarQube-style description and ❌/✅ code examples.
