---
name: run-and-verify
description: Comprehensive build, lint, and test verification workflow for Streak Snippets
---

# Run and Verify Workflow

Use this skill to execute the full quality verification suite before completing any task or releasing changes.

## Verification Sequence

Execute each command sequentially. If any step fails, diagnose and fix the root cause before moving to the next.

### Step 1: Compile Tests (`tsc`)
```bash
cmd.exe /c "npm run compile-tests"
```
- Validates all TypeScript types across @src/ and @src/test/.
- Outputs compiled JS to `out/`.

### Step 2: Compile Client & Server (`webpack`)
```bash
cmd.exe /c "npm run compile"
```
- Packages @src/client/extension.ts -> `dist/extension.js`.
- Packages @src/server/server.ts -> `dist/server.js`.
- Checks for bundling or loader errors.

### Step 3: Lint (`eslint`)
```bash
cmd.exe /c "npm run lint"
```
- Ensures 0 ESLint errors across all files according to @eslint.config.mjs.

### Step 4: Run Tests (`vscode-test`)
```bash
cmd.exe /c "npm test"
```
- Launches the headless VS Code test host.
- Executes all mocha test suites in `out/test/`.
- Verifies that all 78+ tests pass with 0 failures.
