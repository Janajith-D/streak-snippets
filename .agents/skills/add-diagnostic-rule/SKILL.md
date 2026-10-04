---
name: add-diagnostic-rule
description: Workflow for adding a new Streak Engine diagnostic rule (Sxxx) to the extension
---

# Adding a New Streak Engine Diagnostic Rule

Follow this step-by-step workflow whenever implementing a new framework validation rule in the Streak Snippets Language Server.

## 1. Plan the Rule
- Determine the rule code (e.g. `streak:S407`), name, and default severity (`"error" | "warning"`).
- Determine target files (e.g. widgets in `src/widgets/`, layouts in `src/layout/`, handlers in `src/handler/`, or `streak.sitemap.json`).

## 2. Implement the Rule Logic
- Create `src/server/rules/<ruleName>Rule.ts`.
- Implement `StreakRule` from @src/server/rules/types.ts.
- Return diagnostics with `source = "Streak Engine"` and code `streak:Sxxx`.

## 3. Register the Rule
- In @src/server/rules/index.ts: Import, export, and add to `allRules`.
- In @src/server/server.ts: Add rule key to `settingsMap` in `buildRuleConfiguration`.
- In @package.json: Add severity setting under `contributes.configuration.properties`.

## 4. Add Unit Tests
- In @src/test/extension.test.ts:
  - Add test case with non-compliant code (expecting diagnostic).
  - Add test case with compliant code (expecting 0 diagnostics).
  - Test edge cases (helpers, comments, TypeScript syntax).

## 5. Document in Rule Catalog
- In @docs/RULES.md:
  - Add entry to the Catalog Overview table.
  - Add detailed section with Category, Severity, Description, ❌ Non-compliant code, and ✅ Compliant code.

## 6. Verify
- Execute the verification sequence from @.agents/skills/run-and-verify/SKILL.md:
  ```bash
  cmd.exe /c "npm run compile-tests && npm run compile && npm run lint && npm test"
  ```
