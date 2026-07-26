# Streak Snippets

A full-featured VS Code Language Support Extension providing **Streak Forge** snippets, LSP-backed real-time diagnostics, commands, and developer productivity tools for the Streak.js framework.

---

## Features

### `.tsx` — Import Snippets

Quick import shortcuts — type the prefix and press `Tab`:

| Prefix | Expands To |
|---|---|
| `imWP` | `import { WidgetPlaceholder } from "streak-forge/components";` |
| `imS` | `import { Script } from "streak-forge/components";` |
| `imPre` | `import { Preload } from "streak-forge/components";` |
| `imDy` | `import { Dynamic } from "streak-forge/components";` |

### `.tsx` — JSX Scaffold Snippets

| Prefix | Expands To |
|---|---|
| `sfWp` | `<WidgetPlaceholder id=".." type=".." />` |
| `sfPre` | `<Preload href="/styles/tailwind.css" as="style" media="" />` |

### `.ts` — Scaffold Snippets

| Prefix | Description |
|---|---|
| `sfDH` | Data handler function with status, widget data objects, and default export |

---

### Real-Time Validation & Diagnostics (LSP Engine)

The extension includes a Language Server Protocol (LSP) analysis engine that parses `.ts` and `.tsx` files in real time and reports SonarQube-style diagnostics in the **Problems** panel:

| Rule Key | Category | Severity | Description |
|---|---|---|---|
| `streak:S101` | Widget Component | Error | `<WidgetPlaceholder>` missing `id` attribute |
| `streak:S102` | Widget Component | Error | `<WidgetPlaceholder>` missing `type` attribute |
| `streak:S201` | Data Handler | Warning | Data handler missing `status` return property |
| `streak:S202` | Data Handler | Error | Data handler function must be `async` |
| `streak:S203` | Data Handler | Warning | Data handler `status` must be a valid HTTP status code |
| `streak:S301` | Framework Syntax | Warning | Missing `export default` declaration |
| `streak:S302` | Widget Component | Error | React runtime hooks (`useState`, `useEffect`) not allowed in static widgets |
| `streak:S303` | Widget Component | Error | Unsafe `props.data` property access |
| `streak:S304` | Widget Component | Warning | Widget props interface should define `data` as optional (`data?: T`) |
| `streak:S401` | Script Component | Error | Closure variable capture in `<Script>` callbacks |
| `streak:S402` | Script Component | Error | Invalid `<Script>` callback signature |
| `streak:S403` | Script Component | Error | Module imports/`require` inside `<Script>` callbacks |
| `streak:S404` | Script Component | Error | Async `<Script>` callback functions |
| `streak:S501` | Dynamic Component | Error | Missing or empty `id` attribute on `<Dynamic>` |

> For detailed descriptions, rationale, and ❌/✅ code examples for every rule, refer to the [Rule Catalog (`RULES.md`)](file:///c:/Streak/lang-extension/streak-snippets/RULES.md).

---

### Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---|---|
| `Streak: Show Snippet List` | Browse all available snippets in a quick-pick menu |
| `Streak: Create Component` | Scaffold a new component `.tsx` file |

---

## Extension Settings

Configure rule severities and diagnostics in VS Code settings:

| Setting | Type | Default | Description |
|---|---|---|---|
| `streak.snippets.enable` | `boolean` | `true` | Enable or disable Streak snippets |
| `streak.diagnostics.enable` | `boolean` | `true` | Enable or disable real-time LSP diagnostics |
| `streak.rules.widgetPlaceholderProps.severity` | `string` | `"error"` | Severity for `streak:S101` and `streak:S102` |
| `streak.rules.dataHandlerStatus.severity` | `string` | `"warning"` | Severity for `streak:S201` |
| `streak.rules.dataHandlerAsync.severity` | `string` | `"error"` | Severity for `streak:S202` |
| `streak.rules.invalidHandlerStatus.severity` | `string` | `"warning"` | Severity for `streak:S203` |
| `streak.rules.missingDefaultExport.severity` | `string` | `"warning"` | Severity for `streak:S301` |
| `streak.rules.reactHooksNotAllowed.severity` | `string` | `"error"` | Severity for `streak:S302` |
| `streak.rules.unsafeWidgetDataAccess.severity` | `string` | `"error"` | Severity for `streak:S303` |
| `streak.rules.invalidWidgetPropsContract.severity` | `string` | `"warning"` | Severity for `streak:S304` |
| `streak.rules.scriptClosureCapture.severity` | `string` | `"error"` | Severity for `streak:S401` |
| `streak.rules.invalidScriptSignature.severity` | `string` | `"error"` | Severity for `streak:S402` |
| `streak.rules.importInsideScript.severity` | `string` | `"error"` | Severity for `streak:S403` |
| `streak.rules.asyncScriptCallback.severity` | `string` | `"error"` | Severity for `streak:S404` |
| `streak.rules.invalidDynamicComponentId.severity` | `string` | `"error"` | Severity for `streak:S501` |

---

## Installation

1. Clone this repository
2. Run `npm install`
3. Press `F5` in VS Code to launch the Extension Development Host
4. Open a `.ts` or `.tsx` file and start typing a snippet prefix or view live diagnostics in the **Problems** panel

---

## Development

```bash
npm run compile        # Build client & server with webpack
npm run watch          # Watch mode
npm run lint           # Run ESLint
npm run compile-tests  # Compile tests
npm run test           # Run tests
```

---

## Requirements

- VS Code `^1.107.0`
- Node.js 18+

---

## Release Notes

### 0.0.1

- **Snippets**: Streak Forge import shortcuts (`imWP`, `imS`, `imPre`, `imDy`), JSX scaffolds (`sfWp`, `sfPre`), and Data Handler template (`sfDH`).
- **Commands**: `Streak: Show Snippet List` quick-pick menu and `Streak: Create Component` interactive scaffolding command.
- **Language Server Protocol (LSP)**: Client/Server architecture split with real-time `ts-morph` AST analysis engine.
- **Diagnostics Engine**: SonarQube-style framework validation emitting 13 diagnostic rules (`streak:S101` to `streak:S501`) directly to VS Code's Problems panel.
- **Rule Documentation Catalog**: Complete SonarQube-style documentation in [`RULES.md`](file:///c:/Streak/lang-extension/streak-snippets/RULES.md).
- **Workspace Settings**: Granular configuration options for rule severities (`streak.rules.*.severity`) and master diagnostic toggle (`streak.diagnostics.enable`).
