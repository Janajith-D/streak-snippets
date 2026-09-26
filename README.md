# Streak Snippets

[![Version](https://img.shields.io/badge/version-0.9.3-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.107.0-purple.svg)](https://code.visualstudio.com)
[![Status](https://img.shields.io/badge/tests-78%20passing-brightgreen.svg)](src/test/extension.test.ts)

A full-featured Language Support and Productivity Extension for the [Streak.js](https://streakjs.com) framework. Combines high-velocity code snippets with an embedded **Language Server Protocol (LSP)** engine for real-time validation, intelligent completions, contextual hovers, and cross-file navigation.

---

## 1. Quick Snippets Reference

Trigger snippets by typing the prefix in supported files and pressing `Tab` or `Enter`.

### Component Imports (`.tsx`)

| Prefix | Expands To |
|---|---|
| `imWP` | `import { WidgetPlaceholder } from "streak-forge/components";` |
| `imS` | `import { Script } from "streak-forge/components";` |
| `imPre` | `import { Preload } from "streak-forge/components";` |
| `imDy` | `import { Dynamic } from "streak-forge/components";` |

### JSX & Component Scaffolding (`.tsx`)

| Prefix | Trigger Context | Description / Output |
|---|---|---|
| `sfWp` | Layout JSX | `<WidgetPlaceholder id="..." type="..." />` |
| `sfPre` | Layout JSX | `<Preload href="/styles/main.css" as="style" />` |
| `sfS` | Layout JSX | Client-side `<Script>` component with isolated `(gDom, options)` callback |
| `sfWid` | `src/widgets/` | Basic widget function component scaffolding with props interface |
| `sfWidE` | `src/widgets/` | Typed widget component scaffolding with structured example |

### Data Handlers (`.ts`)

| Prefix | Trigger Context | Description / Output |
|---|---|---|
| `sfDH` | `src/handler/` | Async data handler returning status and widget data objects with default export |

### Sitemap (`streak.sitemap.json`)

| Prefix | Trigger Context | Description / Output |
|---|---|---|
| `sf-widget` | `widgets[]` array | Sitemap widget entry (`{ "id": "...", "type": "..." }`) |
| `sf-sitemap` | Root array | Complete sitemap page route definition with renderConfig, handler, and layout |

---

## 2. Language Server Features

Streak Snippets embeds an AST-powered Language Server that actively analyzes your workspace:

### Real-Time Validation & Diagnostics
Catches framework convention mistakes as you type, reporting them directly in VS Code's **Problems** panel:
- **Widget Components (`streak:S101`–`S102`, `S302`–`S304`, `S801`)**: Enforces required attributes, stateless widgets, safe `props.data` access, and naming conventions.
- **Data Handlers (`streak:S201`–`S204`)**: Validates `async` exports, HTTP `status` codes, and ensures returned data keys match registered widgets.
- **Script & Dynamic Blocks (`streak:S401`–`S405`, `S501`, `S602`–`S603`)**: Enforces closure scope isolation, client signatures, and dynamic component IDs.
- **Sitemaps & Routing (`streak:S901`–`S907`)**: Detects duplicate routes, unreferenced widgets, missing layouts, and invalid handlers.

> 📖 For full descriptions, rationale, and ❌/✅ code examples, see the [**Streak Engine Rule Catalog (`docs/RULES.md`)**](docs/RULES.md).

### Smart Autocomplete & Auto-Imports
- **Tag Completion**: Type `<` to discover all built-in Streak components (`WidgetPlaceholder`, `Script`, `Preload`, `Dynamic`).
- **Automatic Import Merging**: Autocompleting a component automatically inserts or merges named imports from `"streak-forge/components"`.
- **Dynamic Attribute Suggestions**:
  - `type` on `<WidgetPlaceholder />`: Auto-suggests registered widgets from `src/widgets/`.
  - `href` on `<Preload />`: Scans and auto-suggests static files from your `/public` folder.
  - `id` on `<Dynamic />`: Auto-suggests dynamic IDs registered in `<Script>` calls.
  - `gDom.*`: Auto-suggests runtime methods (`addResourceToBody`, `loadPackage`, `loadDynamicComponent`, `addWidgetToBody`) and custom methods from `global.d.ts`.

### Hover Documentation & JSDoc Tooltips
- Hover over any built-in component tag to view documentation, required props, and usage examples.
- Hover over custom `<WidgetPlaceholder type="ProductCard" />` to inspect the widget's JSDoc description and typed props contract extracted directly from its source code.
- Hover over `gDom` methods to view signatures, parameters, and client execution notes.

### Go to Definition (`F12`)
- **Widgets**: Press `F12` on `type="..."` in a layout or a returned key in a data handler to jump directly to `src/widgets/<Widget>.tsx`.
- **Static Assets**: Press `F12` on `<Preload href="..." />` to open the file inside the project `public/` directory.
- **Dynamic Blocks**: Press `F12` on a dynamic ID inside `gDom.loadDynamicComponent("...")` to navigate to its `<Dynamic id="...">` declaration.

### Automated Quick Fixes (`Ctrl+.` / `Cmd+.`)
- **Missing Attributes**: 1-click insertion of required `id` and `type` attributes.
- **Async Handlers**: 1-click addition of the `async` modifier to synchronous data handlers.
- **Missing Default Exports**: 1-click generation of missing default export statements.

### Status Bar Health & Monorepo Support
- **Issues Tracker**: Displays real-time Streak Engine issue counts (`$(error) Streak: {E} errors` / `$(pass) Streak: All Clean`). Clicking opens the Problems panel.
- **Monorepo Aware**: Automatically discovers Streak.js projects via `streak-forge` dependencies and suppresses diagnostics on unrelated projects.
- **Scaffolding Command**: Run `Streak: Create New Widget Component` via the Command Palette (`Ctrl+Shift+P`) to scaffold a new widget.

---

## 3. Extension Configuration

Configure rule severities and LSP behavior in your VS Code settings:

| Setting | Type | Default | Description |
|---|---|---|---|
| `streak.snippets.enable` | `boolean` | `true` | Enable or disable Streak code snippets |
| `streak.diagnostics.enable` | `boolean` | `true` | Enable or disable real-time LSP diagnostics |
| `streak.rules.widgetPlaceholderProps.severity` | `string` | `"error"` | Severity for `streak:S101` and `streak:S102` |
| `streak.rules.dataHandlerStatus.severity` | `string` | `"warning"` | Severity for `streak:S201` |
| `streak.rules.dataHandlerAsync.severity` | `string` | `"error"` | Severity for `streak:S202` |
| `streak.rules.invalidHandlerStatus.severity` | `string` | `"warning"` | Severity for `streak:S203` |
| `streak.rules.dataHandlerWidgetKey.severity` | `string` | `"warning"` | Severity for `streak:S204` |
| `streak.rules.missingDefaultExport.severity` | `string` | `"warning"` | Severity for `streak:S301` |
| `streak.rules.reactHooksNotAllowed.severity` | `string` | `"error"` | Severity for `streak:S302` |
| `streak.rules.unsafeWidgetDataAccess.severity` | `string` | `"error"` | Severity for `streak:S303` |
| `streak.rules.invalidWidgetPropsContract.severity` | `string` | `"warning"` | Severity for `streak:S304` |
| `streak.rules.scriptClosureCapture.severity` | `string` | `"error"` | Severity for `streak:S401` |
| `streak.rules.invalidScriptSignature.severity` | `string` | `"error"` | Severity for `streak:S402` |
| `streak.rules.importInsideScript.severity` | `string` | `"error"` | Severity for `streak:S403` |
| `streak.rules.asyncScriptCallback.severity` | `string` | `"error"` | Severity for `streak:S404` |
| `streak.rules.scriptRequiredId.severity` | `string` | `"warning"` | Severity for `streak:S405` |
| `streak.rules.passiveEventListener.severity` | `string` | `"warning"` | Severity for `streak:S406` |
| `streak.rules.invalidDynamicComponentId.severity` | `string` | `"error"` | Severity for `streak:S501` |
| `streak.rules.duplicatedWidget.severity` | `string` | `"error"` | Severity for `streak:S601` |
| `streak.rules.componentNesting.severity` | `string` | `"error"` | Severity for `streak:S602` |
| `streak.rules.scriptStructure.severity` | `string` | `"error"` | Severity for `streak:S603` |
| `streak.rules.forbiddenPatterns.severity` | `string` | `"error"` | Severity for `streak:S702` |

---

## 4. Documentation & Resources

- [**Rule Catalog (`docs/RULES.md`)**](docs/RULES.md) — Comprehensive SonarQube-style descriptions and code examples.
- [**Architecture & Design (`docs/ARCHITECTURE.md`)**](docs/ARCHITECTURE.md) — Deep dive into compiler lifecycles and LSP engine internals.
- [**Contributing Guide (`CONTRIBUTING.md`)**](CONTRIBUTING.md) — Development setup, local testing, and pull request guidelines.
- [**Changelog (`CHANGELOG.md`)**](CHANGELOG.md) — Release notes and version history.
- [**License (`LICENSE`)**](LICENSE) — Licensed under the Apache License, Version 2.0.
