# Change Log

All notable changes to the "streak-snippets" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-05

### Added
- Documented S601-S702 rules details inside `RULES.md` catalog.
- Added walkthrough guidelines for Phase 13 engineering updates.

### Changed
- Refactored `getJsxAttributeCompletions` to resolve SonarQube Cognitive Complexity.
- Upgraded core library imports to use Node `node:` namespace prefix.

### Fixed
- Fixed packaging warning by introducing `repository` field to `package.json`.

## [1.0.0] - 2026-08-05

### Added
- **Production Release & Maintenance (Phase 12)**: Release packaging:
  - Created developer workflow and contribution guidelines inside `CONTRIBUTING.md`.
  - Added issue templates for structuring project bug reports and feature requests.
  - Verified tests compilation, eslint formatting, and VSIX packaging validations.

## [0.9.0] - 2026-08-05

### Added
- **Developer Experience Features (Phase 11)**: Polished workflow integrations inside the VS Code editor UI:
  - Live **VS Code Status Bar** item showing the count of widgets indexed in the registry database.
  - Interactive **streak.createWidget** command that prompts, validates, scaffolds, and opens new widgets.

## [0.8.0] - 2026-08-05

### Added
- **Configuration & Extensibility (Phase 10)**: Implemented advanced customization capabilities via workspace settings:
  - Custom scanner target folder paths for widgets (`streak.snippets.widgetDirectory`), pages (`streak.snippets.pageDirectory`), and assets (`streak.snippets.publicDirectory`).
  - `streak:S701` (Import Whitelist Rule): Warns if imports pull unapproved third-party modules.
  - `streak:S702` (Forbidden Patterns Rule): Checks codebase content for forbidden string matches or regex.

## [0.7.0] - 2026-08-04

### Added
- **Advanced Static Analysis (Phase 9)**: Developed 3 new validation rules enforcing framework boundaries:
  - `streak:S601` (Duplicated Widget Names): Flags component name collisions inside `src/widgets/` to avoid naming conflicts.
  - `streak:S602` (Component Nesting): Enforces nesting limits (no nested `<Script>` tags, no `<WidgetPlaceholder>` inside `<Script>` tag callback).
  - `streak:S603` (Script Structure): Validates `<Script>` tags contain exactly a single JSX expression child wrapping a callback function.
- **Configurable Severities**: Added settings schema configurations allowing workspace rule severity overrides for the new checks.

## [0.6.0] - 2026-08-03

### Added
- **Workspace Widget Registry & Suggestions (Phase 8)**: Implemented an AST-based workspace scanner and registry for custom components under `src/widgets/` and `src/components/`:
  - Dynamically extracts component descriptions, JSDoc headers, and full props type specifications.
  - Integrates registry metadata inside `<WidgetPlaceholder type="..." />` autocomplete details, showing property names, types, optionality indicators, and property JSDoc comments.
  - Integrates registry metadata inside on-hover tooltips when hovering over resolved type string literals.

## [0.5.0] - 2026-08-03

### Added
- **Quick Fixes & Code Actions (Phase 7)**: Implemented code action provider `resolveCodeActions` suggesting quick fixes (`Ctrl+.`) for common diagnostics:
  - Add missing `id` attribute on `<Script />`, `<WidgetPlaceholder />`, and `<Dynamic />` tags.
  - Add missing `type` attribute on `<WidgetPlaceholder />`.
  - Make synchronous data handlers `async` automatically.
  - Append missing default exports statement based on filename at the end of files.

## [0.4.0] - 2026-07-30

### Added
- **Go to Definition & Navigation (Phase 6)**: Implemented complete definition provider (`connection.onDefinition`) enabling quick jump-to-definition (F12) for:
  - Widget type attribute values to their matching source widget files.
  - Preload href paths to local static files inside `/public`.
  - Dynamic ID string parameters in script calls directly to matching `<Dynamic id="...">` components.

## [0.3.0] - 2026-07-30

### Added
- **Hover Help & Documentation (Phase 5)**: Developed complete LSP hover help mapping for all built-in Streak components (`<WidgetPlaceholder />`, `<Preload />`, `<Dynamic />`, `<Script />`) and all their JSX attributes (`id`, `type`, `href`, `as`, `options`).
- **LSP Architecture Refactoring**: Extracted resolveHover logical handler to a dedicated, unit-testable module.

## [0.2.0] - 2026-07-28

### Added
- **Streak `<Script />` component support**:
  - Full autocomplete with automatic import and multi-line clean import merging.
  - Diagnostic warning `streak:S405` for missing/empty `<Script>` `id` with a VS Code Quick Fix to insert it automatically.
  - Autocomplete Intellisense suggestions for callback `gDom` methods (`loadDynamicComponent`, `getElement`, `updateOptions`).
  - Markdown hover documentation for the `<Script>` component and all `gDom` callbacks.
- **Dynamic Widget Scaffolding Snippets**: Scopes `sfWid` and `sfWidE` autocomplete suggestions to `widgets/` folders, dynamically resolving the component name based on the file name.

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