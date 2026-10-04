---
trigger: glob
description: Language Server Protocol (LSP) provider guidelines for completions, hover, definition, and code actions
globs: "src/server/completion/**/*.ts, src/server/hover/**/*.ts, src/server/definition/**/*.ts, src/server/codeaction/**/*.ts"
---

# LSP Features & Provider Authoring Guidelines

Guidelines for language feature providers in @src/server/. For adding quick fixes, consult the runbook at @.agents/skills/add-code-action/SKILL.md.

## 1. Monorepo Isolation & Guarding

- **Streak Project Guard**: All LSP feature providers MUST verify the file belongs to a Streak project before performing work:
  ```typescript
  const projectRoot = findStreakProjectRoot(document.uri, workspaceRoot);
  if (!projectRoot) {
    return []; // or null for hover/definition
  }
  ```
- Do not process files or retain memory for files outside configured Streak projects.

## 2. AST Traversal & Position Mapping

- **Offset Translation**: Convert LSP `Position` (line, character) to file byte offsets using `document.offsetAt(position)`.
- **Safe Traversal**: Actively typed documents frequently contain syntax errors or incomplete expressions. Always guard node traversal:
  - Check for `node.getParent()` before ascending the AST.
  - Never assume a JSX attribute has an initializer (e.g. `<Widget prop />` vs `<Widget prop="value" />`).
  - Handle transient AST nodes safely without throwing unhandled exceptions.

## 3. Provider Decoupling & Integrity

- **Zero Ad-Hoc Diagnostics**: Never instantiate or emit diagnostics inside completion, hover, or definition providers. All diagnostics must originate exclusively from @src/server/rules/.
- **Strict Return Types**:
  - `onCompletion`: Return `CompletionItem[]` (or empty array `[]`).
  - `onHover`: Return `Hover | null` (never `undefined`).
  - `onDefinition`: Return `Definition | null`.
  - `onCodeAction`: Return `(Command | CodeAction)[]`.

## 4. Performance & Responsiveness

- **Keystroke Latency**: Completion and hover queries fire frequently during user typing. Target $< 50\text{ms}$ response time.
- **In-Memory Registry Lookups**: Always query existing registries (@src/server/registry/) using $O(1)$ lookups instead of initiating filesystem walks or full project rescans.
