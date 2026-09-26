---
description: Architecture principles and Client/Server decoupling in Streak Snippets
globs: src/**/*.ts, src/**/*.tsx
---

# Architecture Principles & Decoupling

## 1. Client vs. Server Separation

The extension is strictly partitioned into two independent runtime layers:

```
src/
├── client/     <-- VS Code Extension Host (Thin Client)
├── server/     <-- Node.js Language Server Protocol Engine (Backend)
└── shared/     <-- Pure types, enums, and constants (No runtime dependencies)
```

### Client Guidelines (`src/client/`):
- **Zero Heavy Dependencies**: Never import `ts-morph` or AST analysis tools into the client.
- **Role**: Launches the language server (`vscode-languageclient/node`), registers user-facing commands (e.g. `streak.createWidget`), and manages UI elements (Status Bar item).
- **Status Bar**: Tracks Streak Engine issues by filtering diagnostics where `diagnostic.source === "Streak Engine"`. Auto-hides on non-Streak files in monorepos.

### Server Guidelines (`src/server/`):
- **AST & Compiler Engine**: Hosts all `ts-morph` parsing, workspace registries, definition resolution, hover tooltips, completions, and code action providers.
- **Monorepo Isolation**: All LSP request handlers (`onCompletion`, `onHover`, `onDefinition`, `onCodeAction`, `validateDocument`) MUST check `findStreakProjectRoot(uri, workspaceRoot)`. If the file is not in a Streak project, return empty/null immediately and send empty diagnostics.

### Shared Layer (`src/shared/`):
- Only pure TypeScript interfaces, constants, and utility types. Never import `vscode` or `vscode-languageserver` in shared files.
