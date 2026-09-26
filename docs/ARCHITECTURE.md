# Streak Snippets — Architecture & Design

This document details the internal technical architecture, lifecycle models, and subsystem designs of the **Streak Snippets** VS Code extension and its embedded **Streak Engine** Language Server.

---

## 1. System Overview

Streak Snippets is structured as a decoupled, two-tier system:
1. **VS Code Extension Client (`src/client/`)**: A lightweight host process interfacing with the VS Code window, registering commands, and displaying status indicators.
2. **Language Server Protocol (LSP) Engine (`src/server/`)**: An independent Node.js backend executing AST parsing, workspace crawlers, in-memory registries, and diagnostics.

```
┌────────────────────────────────────────────────────────┐
│               VS Code Extension Host                   │
│                                                        │
│  src/client/extension.ts                               │
│   ├── LanguageClient (IPC Transport)                   │
│   ├── Commands: streak.createWidget                    │
│   └── Status Bar: Streak Issues / Widgets Count        │
└───────────────────────────▲────────────────────────────┘
                            │ LSP JSON-RPC / IPC
┌───────────────────────────▼────────────────────────────┐
│              Streak Language Server                    │
│                                                        │
│  src/server/server.ts                                  │
│   ├── Project Detector (Monorepo Guard)                │
│   ├── Parser & AST Layer (ts-morph Analyzer)           │
│   ├── Registries (Widgets, Sitemaps, gDom Types)       │
│   ├── Rule Engine (streak:S101 - streak:S907)          │
│   ├── Providers (Completions, Hovers, Definitions)     │
│   └── Code Actions (Quick Fixes)                       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Client Architecture (`src/client/`)

The client code runs inside the VS Code Extension Host and maintains zero direct dependencies on AST compilers (`ts-morph`) to guarantee instant startup and minimal memory footprint.

### Key Responsibilities
- **Lifecycle Management**: Starts and stops the LSP server module located at `dist/server.js` via `vscode-languageclient/node`.
- **Command Scaffolder (`streak.createWidget`)**: Prompts the developer for a PascalCase widget name, validates input, and writes a boilerplate widget template to `src/widgets/<Name>.tsx`.
- **Status Bar Integration**:
  - Monitors `vscode.languages.onDidChangeDiagnostics` and `vscode.window.onDidChangeActiveTextEditor`.
  - Filters diagnostics strictly where `diagnostic.source === "Streak Engine"`.
  - Displays `$(error) Streak: {E} error(s)` (red background), `$(warning) Streak: {W} warning(s)` (yellow background), or `$(pass) Streak: All Clean ({N} widgets)`.
  - Automatically hides when the active document does not belong to a Streak.js project.

---

## 3. Server Architecture (`src/server/`)

The server runs as a separate Node.js process communicated through JSON-RPC.

### 3.1. Monorepo Project Detection (`src/server/registry/projectDetector.ts`)
To prevent false-positive diagnostics in monorepo workspaces containing unrelated packages (e.g. Express backends, Next.js apps, NestJS microservices):
- `findStreakProjectRoot(uri, workspaceRoot)` traverses parent directories.
- `isStreakProjectDirectory(dir)` inspects `package.json` for `streak-forge` dependencies, `streak.sitemap.json`, or directory conventions (`src/widgets`).
- Handlers (`validateDocument`, `onCompletion`, `onHover`, `onDefinition`, `onReferences`, `onCodeAction`) abort early and clear diagnostics for files not belonging to a Streak project.

### 3.2. AST Analysis & Memory Lifecycles (`src/server/parser/`)
- A single shared `ts-morph` `Project` instance is maintained.
- Documents are parsed into AST `SourceFile` instances on demand.
- **Memory Safety**: Any transient `SourceFile` created for one-off inspection is guaranteed to call `.delete()` to prevent heap retention across edits.

### 3.3. In-Memory Registries (`src/server/registry/`)
The language server maintains three fast, in-memory caches:
1. **`widgetRegistry`**: Maps widget names to file paths, extracted JSDoc descriptions, and typed prop lists (`WidgetProp`).
2. **`sitemapRegistry`**: Indexes pages, renderConfigs, declared widgets, layouts, and data handlers from `streak.sitemap.json`.
3. **`gdomRegistry`**: Stores runtime DOM manipulation methods, including the 4 official methods (`addResourceToBody`, `loadPackage`, `loadDynamicComponent`, `addWidgetToBody`) and custom methods discovered by scanning `global.d.ts` declaration files.

### 3.4. Diagnostic Rule Engine (`src/server/rules/`)
- Every rule implements the `StreakRule` interface:
  ```typescript
  export interface StreakRule {
    id: string;
    description: string;
    run(sourceFile: SourceFile, analysis: DocumentAnalysis, options?: RuleOptions): Diagnostic[];
  }
  ```
- All diagnostics set `source: "Streak Engine"`.
- User severity overrides are dynamically fetched from VS Code workspace configuration (`streak.rules.*.severity`).
- Rules targeting handlers (such as `streak:S204`) strictly validate the default export (`getDefaultExportedHandler`), safely ignoring internal helper/utility functions.

---

## 4. Key Performance Targets

| Metric | Target | Verification |
|---|---|---|
| Large Sitemap Processing | < 1000ms for 10,000 pages | Verified via mocha benchmark test suite |
| Autocomplete Latency | < 30ms for JSX & script callbacks | In-memory registry lookup |
| Memory Stability | Zero heap accumulation over continuous edits | Strict `sourceFile.delete()` lifecycle |
| Test Coverage | 100% passing across 78 test suites | Automated test host runner (`npm test`) |
