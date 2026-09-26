---
name: audit-code-quality
description: Comprehensive quality audit workflow checking TypeScript typing, ESLint rules, SonarQube standards, and tests
---

# Code Quality Audit Workflow

Use this skill to audit, diagnose, and resolve code quality issues, cognitive complexity bottlenecks, and linting errors before finalizing any changes.

## Audit Checklist

### 1. Compile & Type Verification
```bash
cmd.exe /c "npm run compile-tests"
```
- Checks for TypeScript compiler errors (`TSxxxx`).
- Verifies that exact optional property types and strict null checks pass without regression.

### 2. ESLint & Static Analysis Audit
```bash
cmd.exe /c "npm run lint"
```
- Inspect output for:
  - `@typescript-eslint/no-floating-promises`
  - `@typescript-eslint/no-unsafe-assignment` or `no-unsafe-member-access`
  - `@typescript-eslint/no-non-null-assertion`
  - `prefer-template` or `prefer-nullish-coalescing`
  - Unused imports or variables.

### 3. SonarQube & Complexity Check
Review modified functions for clean code principles:
- **Cognitive Complexity**: If a function has nested `for`, `if`, or `switch` blocks, split it into smaller single-purpose private helper functions ($\le 15$, target $\le 10$).
- **Clean Conditionals & Arrays**: Avoid checking truthiness on non-nullish types; check `.length === 0` instead of `!arr[0]`.
- **No Nested Ternaries**: Ensure no nested ternaries exist, including within template literal interpolations (`${cond ? "" : "s"}`).
- **Default Parameters**: Prefer ES6 default parameter syntax over internal `param ?? fallback` reassignment.
- **Formatting**: Run Prettier formatting check:
  ```bash
  cmd.exe /c "npm run format:check"
  ```
- **Regular Expressions**: Verify regexes do not have redundant alternations or potential ReDoS vulnerabilities.
- **AST Cleanup**: Ensure any transient `SourceFile` is cleaned up with `.delete()`.

### 4. Webpack Packaging
```bash
cmd.exe /c "npm run compile"
```
- Ensures both `dist/extension.js` and `dist/server.js` bundle cleanly with 0 packaging errors.

### 5. Integration Test Execution
```bash
cmd.exe /c "npm test"
```
- Confirms all 78+ unit and integration test suites pass with 0 failures.
