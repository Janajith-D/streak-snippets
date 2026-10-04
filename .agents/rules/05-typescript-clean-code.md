---
trigger: glob
description: TypeScript clean code, ESLint standards, and SonarQube quality guidelines in Streak Snippets
globs: "src/**/*.ts, src/**/*.tsx"
---

# TypeScript Clean Code & SonarQube Standards

For automated auditing, invoke the skill at @.agents/skills/audit-code-quality/SKILL.md.

## 1. SonarQube Clean Code & Cognitive Complexity

- **Cognitive Complexity Limit ($\le 15$)**:
  - Keep function cognitive complexity low by splitting nested conditionals and loops into single-purpose helper functions.
  - Example: When resolving component names or rule configurations, decompose complex branching into dedicated private helpers (e.g. `getDefaultExportComponentName`, `getVariableDeclComponentName`, `buildRuleConfiguration`).
- **Control Flow & Conditionals**:
  - **No Unnecessary Conditionals**: Do not check truthiness of AST nodes or expressions whose TypeScript type is non-nullish (e.g. `node.getExpression()`, `attr.getNameNode()`, `fs.promises.stat()`).
  - **Array Bounds Check**: In TypeScript without `noUncheckedIndexedAccess`, `array[0]` is typed as `T`, not `T | undefined`. Check `if (array.length === 0)` before indexing to avoid Sonar warning "Unnecessary conditional, value is always falsy" on `if (!array[0])`.
  - **No Nested Ternaries**: Avoid nested ternary expressions (`a ? b ? c : d : e`). Never embed ternary interpolations inside template strings within an outer ternary (e.g. `val > 0 ? \`...\${n === 1 ? "" : "s"}\` : ""`). Extract nested logic into standalone `if` blocks or helper functions.
  - **Default Parameters over Reassignment**: Always prefer ES6 default parameter syntax `(param = defaultValue)` over internal fallback assignment (`const target = param ?? defaultValue`).
  - **Single Array Push**: Do not call `arr.push()` repeatedly in consecutive statements; pass multiple arguments (`arr.push(a, b)`) or spread elements (`arr.push(...items)`).
  - **Nullish Assignment**: Prefer logical nullish assignment (`??=`) for singleton instances or caching instead of `if (!instance) { instance = ... }`.
  - **AST Loop & Member Decomposition**: When inspecting or extracting multiple structures from an AST node (e.g. method signatures vs property signatures, or type nodes vs JSDoc comments), extract dedicated helper functions (`extractMethodSignatures`, `extractPropertyFunctionSignatures`, `extractPropTypeText`) to keep cognitive complexity $\le 10$.
- **Regular Expression Complexity**:
  - Never use complex regular expressions with massive alternations (e.g. 20+ path prefixes).
  - Prefer $O(1)$ lookups via a `Set` or `.some(prefix => path.startsWith(prefix))` over monolithic regular expressions.
  - Avoid regex patterns vulnerable to catastrophic backtracking (ReDoS).

## 2. ESLint Standards & Rules Compliance

Always ensure code conforms strictly to @eslint.config.mjs:
- **Asynchronous Safety**:
  - Never leave unhandled promises (`@typescript-eslint/no-floating-promises`). Use `void client.start()` or `await` every asynchronous operation.
  - Never await a non-thenable value (`@typescript-eslint/await-thenable`).
  - Do not pass async callbacks to APIs expecting synchronous execution (`@typescript-eslint/no-misused-promises`).
- **Modern Syntax**:
  - Use template literals (`` `prefix-${val}` ``) rather than string concatenation (`"prefix-" + val`) to satisfy `prefer-template`.
  - Use nullish coalescing (`??`) and optional chaining (`?.`) instead of chained logical OR (`||`) or nested truthiness checks.
  - Re-export modules using `export { ... } from "./module"` rather than separate import and export statements.
- **Unused Imports & Variables**:
  - Keep 0 unused imports and variables. Prefix intentionally unused callback parameters with `_` (e.g. `_event`).

## 3. Prettier Formatting Standards

- Codebase formatting is enforced via Prettier (@.prettierrc.json):
  - Semi-colons: required (`semi: true`)
  - Double quotes: required (`singleQuote: false`)
  - Tab width: 2 spaces
  - Trailing comma: ES5 / all (`trailingComma: "all"`)
  - Print width: 100
- Always format the code before finalizing changes:
  ```bash
  cmd.exe /c "npm run format"
  cmd.exe /c "npm run format:check"
  ```

## 4. Strict Type Safety

- **No Untyped `any`**:
  - Prohibit `any` assignments (`@typescript-eslint/no-unsafe-assignment`) and member access (`@typescript-eslint/no-unsafe-member-access`).
  - When parsing external data (such as @package.json or `sitemap.json`), declare an explicit TypeScript interface (e.g. `PackageManifest`, `SitemapConfig`).
- **No Non-Null Assertions (`!`)**:
  - Avoid using the non-null assertion operator (`!`).
  - Instead, use explicit null/undefined guards (`if (!value) return;`) or standard assertions (`assert.ok(value)` in test files).
- **Exact Optional Property Types**:
  - Match declared interfaces precisely when properties can be `undefined`.

## 5. Codebase Integrity

- Always preserve existing comments, JSDoc annotations, and docstrings that are unrelated to current code changes.
