---
trigger: glob
description: Code quality, linting standards, and test verification in Streak Snippets
globs: "src/**/*.ts, src/test/**/*.ts"
---

# Code Quality & Testing Standards

For the execution runbook, invoke the skill at @.agents/skills/run-and-verify/SKILL.md.

## 1. Quality Gate Commands

Any change to the codebase MUST pass all 4 verification steps before completion:
1. `npm run compile-tests` — Type check and compile test files with `tsc` (`out/`).
2. `npm run compile` — Webpack bundle client (`dist/extension.js`) and server (`dist/server.js`).
3. `npm run lint` — ESLint verification with 0 errors.
4. `npm test` — Run the VS Code extension integration test suite.

*Note for Windows*: When running via PowerShell tools, invoke through `cmd.exe /c "npm run ..."` or `cmd.exe /c "npm test"`.

## 2. TypeScript & Linter Best Practices

- **Strict Null Checks**: Never use non-null assertions (`!`) where an explicit assertion (`assert.ok(val)`) or nullish check is appropriate.
- **Template Literals**: Use template literals (`` `string-${val}` ``) rather than string concatenation (`"string-" + val`) to comply with ESLint `prefer-template`.
- **Typing JSON & Manifests**: When parsing external files (@package.json, `sitemap.json`), declare typed interfaces rather than casting to `any`.
- **Unused Imports**: Ensure `unused-imports` plugin produces 0 warnings/errors.
