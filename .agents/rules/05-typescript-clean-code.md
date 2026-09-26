---
description: TypeScript clean code, ESLint standards, and SonarQube quality guidelines in Streak Snippets
globs: src/**/*.ts, src/**/*.tsx
---

# TypeScript Clean Code & SonarQube Standards

## 1. SonarQube Clean Code & Cognitive Complexity

- **Cognitive Complexity Limit ($\le 15$)**:
  - Keep function cognitive complexity low by splitting nested conditionals and loops into single-purpose helper functions.
  - Example: When resolving component names or rule configurations, decompose complex branching into dedicated private helpers (e.g. `getDefaultExportComponentName`, `getVariableDeclComponentName`, `buildRuleConfiguration`).
- **Regular Expression Complexity**:
  - Never use complex regular expressions with massive alternations (e.g. 20+ path prefixes).
  - Prefer $O(1)$ lookups via a `Set` or `.some(prefix => path.startsWith(prefix))` over monolithic regular expressions.
  - Avoid regex patterns vulnerable to catastrophic backtracking (ReDoS).

## 2. ESLint Standards & Rules Compliance

Always ensure code conforms strictly to `eslint.config.mjs`:
- **Asynchronous Safety**:
  - Never leave unhandled promises (`@typescript-eslint/no-floating-promises`). Use `void client.start()` or `await` every asynchronous operation.
  - Never await a non-thenable value (`@typescript-eslint/await-thenable`).
  - Do not pass async callbacks to APIs expecting synchronous execution (`@typescript-eslint/no-misused-promises`).
- **Modern Syntax**:
  - Use template literals (`` `prefix-${val}` ``) rather than string concatenation (`"prefix-" + val`) to satisfy `prefer-template`.
  - Use nullish coalescing (`??`) and optional chaining (`?.`) instead of chained logical OR (`||`) or nested truthiness checks.
- **Unused Imports & Variables**:
  - Keep 0 unused imports and variables. Prefix intentionally unused callback parameters with `_` (e.g. `_event`).

## 3. Strict Type Safety

- **No Untyped `any`**:
  - Prohibit `any` assignments (`@typescript-eslint/no-unsafe-assignment`) and member access (`@typescript-eslint/no-unsafe-member-access`).
  - When parsing external data (such as `package.json` or `sitemap.json`), declare an explicit TypeScript interface (e.g. `PackageManifest`, `SitemapConfig`).
- **No Non-Null Assertions (`!`)**:
  - Avoid using the non-null assertion operator (`!`).
  - Instead, use explicit null/undefined guards (`if (!value) return;`) or standard assertions (`assert.ok(value)` in test files).
- **Exact Optional Property Types**:
  - Match declared interfaces precisely when properties can be `undefined`.

## 4. Codebase Integrity

- Always preserve existing comments, JSDoc annotations, and docstrings that are unrelated to current code changes.
