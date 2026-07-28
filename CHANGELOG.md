# Change Log

All notable changes to the "streak-snippets" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-07-28

### Removed
- **Scaffolding & Snippet List Commands**: Removed `Streak: Show Snippet List` and `Streak: Create Component` command utilities to focus extension capabilities on core language features.
- **Unused Workspace Configurations**: Removed directory paths configurations (`streak.snippets.pageDirectory`, `streak.snippets.componentDirectory`, `streak.snippets.widgetDirectory`).

## [0.1.0] - 2026-07-28

### Added
- **Intelligent Autocomplete & Code Completion (LSP)**: Context-aware suggestions for all built-in Streak Forge components (`WidgetPlaceholder`, `Script`, `Preload`, `Dynamic`).
- **Auto-Import Insertion**: Automates imports management (appends or merges component imports from `"streak-forge/components"`).
- **JSX Attribute Recommendations**: Auto-suggests type values based on `src/widgets/` content, and recursively scans `/public` to suggest resource paths for `<Preload href="...">`.
- **Dynamic ID Registry Integration**: Auto-suggests registered dynamic component IDs matching `gDom.loadDynamicComponent("...")` references inside `<Script>` blocks.
- **Code Quality Refactoring**: Centralized the `getRangeFromNode` helper and removed explicit `any` casting to fully type-safe `ts-morph` classes across all 13 rules.

## [0.0.1] - 2026-07-23

### Added
- **Streak Forge Snippets**: `.tsx` import shortcuts (`imWP`, `imS`, `imPre`, `imDy`), JSX scaffolds (`sfWp`, `sfPre`), and `.ts` data handler template (`sfDH`).
- **Commands**: `Streak: Show Snippet List` quick-pick menu and `Streak: Create Component` interactive scaffolding command.
- **Language Server Architecture (LSP)**: Client/Server architecture split using Node IPC and real-time `ts-morph` AST analysis pipeline.
- **Validation Engine & SonarQube-Style Diagnostics**: Real-time diagnostic rules publishing directly to VS Code's **Problems** panel:
  - `streak:S101`: Missing `id` attribute on `<WidgetPlaceholder>` (Error)
  - `streak:S102`: Missing `type` attribute on `<WidgetPlaceholder>` (Error)
  - `streak:S201`: Missing `status` return property in Data Handlers (Warning)
  - `streak:S202`: Data Handlers must be `async` (Error)
  - `streak:S203`: Invalid HTTP status code in Data Handlers (Warning)
  - `streak:S301`: Missing default export in framework files (Warning)
  - `streak:S302`: React runtime hooks not allowed in static widgets (Error)
  - `streak:S303`: Unsafe widget data property access (Error)
  - `streak:S304`: Invalid widget props interface contract (Warning)
  - `streak:S401`: Closure variable capture in `<Script>` callbacks (Error)
  - `streak:S402`: Invalid `<Script>` callback signature (Error)
  - `streak:S403`: Module imports inside `<Script>` callbacks (Error)
  - `streak:S404`: Async `<Script>` callbacks (Error)
  - `streak:S501`: Missing or empty `id` attribute on `<Dynamic>` components (Error)
- **Rule Catalog Documentation**: Comprehensive SonarQube-style rule documentation catalog in [`RULES.md`](file:///c:/Streak/lang-extension/streak-snippets/RULES.md) with compliant and non-compliant code examples.
- **Workspace Configuration Settings**: Configurable rule severities (`streak.rules.*.severity`) and diagnostic toggles (`streak.diagnostics.enable`).