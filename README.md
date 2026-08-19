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

The extension includes a Language Server Protocol (LSP) analysis engine that parses framework files (`.ts`, `.tsx`, and `streak.sitemap.json`) in real time, reporting diagnostics directly in the **Problems** panel:

- **Widget Components (`streak:S101`–`S102`, `S302`–`S304`, `S801`)**: Enforces required attributes, stateless widgets, safe `props.data` access, and component naming alignment.
- **Data Handlers (`streak:S201`–`S203`)**: Enforces `async` exports, `status` properties, and valid HTTP response codes.
- **Script & Dynamic Components (`streak:S401`–`S405`, `S501`, `S602`–`S603`)**: Validates closure scope isolation, client signatures, and dynamic IDs.
- **Imports & Security (`streak:S701`–`S702`)**: Whitelist enforcement and forbidden code patterns.
- **Sitemap & Navigation (`streak:S901`–`S906`)**: Validates unique routes/renderIds, widget references, `.ts` data handlers, and `.tsx` root layouts.

> 📖 For full descriptions, rationale, and ❌/✅ code examples for all 20 rules, see the comprehensive [**Rule Catalog (`docs/RULES.md`)**](docs/RULES.md).

---

### Autocomplete & Auto-Imports (LSP Engine)

The extension includes a context-aware Language Server Protocol (LSP) autocomplete engine that accelerates framework code creation:

#### 1. Smart Component Tags Completion
When typing `<` or inside a JSX expression, you will get completions for all built-in Streak Forge components:
- `WidgetPlaceholder`
- `Script`
- `Preload`
- `Dynamic`

#### 2. Automatic Imports Management
When you select and autocomplete any of the component tags, the language server automatically analyzes your file imports:
- If `"streak-forge/components"` is not imported, it appends `import { ComponentName } from "streak-forge/components";` to the header.
- If it is already imported, it merges the component into the existing named imports list (e.g. `import { WidgetPlaceholder, Script } from "streak-forge/components";`).

#### 3. Dynamic JSX Attribute Suggestions
The autocomplete engine reads your project files and assets to suggest values:
- **`<WidgetPlaceholder type="...">`**: Auto-suggests type values based on files in `src/widgets/` (case-sensitive, minus extension).
- **`<WidgetPlaceholder id="...">`**: Auto-suggests sitemap widget IDs and handler return keys.
- **`<Preload href="...">`**: Auto-suggests file paths recursively scanned from the `/public` folder (e.g. `/images/hero.jpg`, `/styles/tailwind.css`).
- **`<Preload as="...">`**: Auto-suggests valid resource types (`"image"`, `"font"`, `"style"`, `"script"`, `"video"`).
- **`<Dynamic id="...">`**: Auto-suggests registered dynamic component IDs found in calls to `gDom.loadDynamicComponent("...")` inside `<Script>` blocks.

#### 4. Inline Script Suggestions
- **`gDom.loadDynamicComponent("...")`**: Auto-suggests valid dynamic component IDs registered inside your workspace.


### Hover Help & Documentation (LSP Engine)

The extension includes a context-aware Language Server Protocol (LSP) hover documentation provider that exposes markdown descriptions and code examples without requiring developer context switches:

#### 1. Component Hover Tooltips
Hovering over the opening/closing tag name of any built-in Streak component reveals its details:
- **`<WidgetPlaceholder />`**: Specifies widget rendering placeholders, detailing required attributes (`id`, `type`) and compliant code examples.
- **`<Preload />`**: Specifies static assets build-time preloading instructions, outlining required attributes (`href`, `as`) and responsive query structures.
- **`<Dynamic />`**: Details dynamically injected client-side component blocks.
- **`<Script />`**: Explains client-side scripting hooks, inline execution limits, options schemas, and signatures.

#### 2. Attribute Descriptions
Hovering over any supported JSX attribute on built-in elements reveals its purpose and required format:
- **`type` on `<WidgetPlaceholder />`**: Maps case-sensitively to a file under `src/widgets/`.
- **`href` on `<Preload />`**: Scopes to a static file inside the project `public/` folder.
- **`as` on `<Preload />`**: Allocates preload priority based on standard media types.
- **`options` on `<Script />`**: Forwards data to the browser execution thread callback.

#### 3. Client API Documentation
Hovering over `gDom` methods (like `loadDynamicComponent`, `getElement`, `updateOptions`) shows signatures, return types, and descriptions of client-side DOM scripting interfaces.


### Go to Definition & Navigation (LSP Engine)

The extension includes a context-aware definition provider that allows developers to jump directly to referenced code files, static assets, or components using VS Code's native **Go to Definition** (`F12`) action:

#### 1. Widget Navigation
Pressing `F12` on the `type` attribute value (e.g. `"HelloBanner"`) of a `<WidgetPlaceholder type="HelloBanner" />` automatically opens the corresponding widget source file inside your workspace:
- Scans `src/widgets/HelloBanner.tsx` (or `.ts`, `.jsx`, `.js`).

#### 2. Static Asset Navigation
Pressing `F12` on the `href` attribute value of a `<Preload href="/styles/main.css" />` automatically resolves the asset relative to the project static directory and opens the file:
- Scans `<workspaceRoot>/public/styles/main.css`.

#### 3. Dynamic Component Declared Jump
Pressing `F12` on a dynamic ID string argument inside a client-side call (e.g. `gDom.loadDynamicComponent("HomeLander")`) scans your workspace source files and jumps to the exact declaration point of the dynamic block:
- Resolves the exact line and position of the matching `<Dynamic id="HomeLander">` JSX tag.



### Quick Fixes & Code Actions (LSP Engine)

The extension provides context-aware quick fixes for common validation diagnostics, allowing you to resolve framework convention errors automatically directly from the VS Code editor (via the lightbulb menu or `Ctrl+.` / `Cmd+.`):

#### 1. Missing Required Attributes
- **`<Script>` Missing ID**: Automatically inserts `id="my-script"`.
- **`<WidgetPlaceholder>` Missing ID**: Automatically inserts `id="placeholder-id"`.
- **`<WidgetPlaceholder>` Missing Type**: Automatically inserts `type="WidgetName"`.
- **`<Dynamic>` Missing ID**: Automatically inserts `id="dynamic-id"`.

#### 2. Synchronous Data Handlers
- **Make Handler Async**: Adds the `async` keyword at the beginning of synchronous functions and arrow functions declared inside data-handler modules.

#### 3. Missing Default Exports
- **Add Default Export**: Appends `export default Filename;` at the end of modules lacking a default export.



### Workspace Widget Registry & Suggestions (LSP Engine)

The extension contains an AST-based Workspace Widget Registry that automatically crawls, indexes, and monitors custom components under `src/widgets/` and `src/components/` in your project.

#### 1. Rich Autocompletions
When autocompleting the `type` attribute on `<WidgetPlaceholder type="..." />`, the extension queries the registry database to suggest your custom widgets and presents:
- **JSDoc descriptions**: Extracted from the widget's class/function JSDoc headers.
- **Properties signature list**: Detailed overview of all typed props, identifying optional properties (`?`), types, and custom property-level JSDoc summaries.

#### 2. On-Hover Prop Tooltips
Hovering over the `type` string literal value (e.g., `<WidgetPlaceholder type="ProductCard" />`) resolves the component and displays a rich markdown tooltip listing all custom properties and documentation directly inside your editor.



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
| `streak.rules.scriptRequiredId.severity` | `string` | `"warning"` | Severity for `streak:S405` |
| `streak.rules.invalidDynamicComponentId.severity` | `string` | `"error"` | Severity for `streak:S501` |
| `streak.rules.duplicatedWidget.severity` | `string` | `"error"` | Severity for `streak:S601` |
| `streak.rules.componentNesting.severity` | `string` | `"error"` | Severity for `streak:S602` |
| `streak.rules.scriptStructure.severity` | `string` | `"error"` | Severity for `streak:S603` |
| `streak.rules.allowedImports.severity` | `string` | `"warning"` | Severity for `streak:S701` |
| `streak.rules.forbiddenPatterns.severity` | `string` | `"error"` | Severity for `streak:S702` |

---

## Release Notes

For a full list of changes across releases, see our [Changelog](CHANGELOG.md).

---

## Contributing

For guidelines on setup, locally running, compiling, and testing, see [CONTRIBUTING.md](CONTRIBUTING.md).


