# Development Plan / Roadmap for a Custom VS Code Language Support Extension

## 1. Objective

Build a **full-featured VS Code Language Support Extension** for a new React-based static site generator framework. The goal is to improve the developer experience through:

- Smart code snippets
- Framework-aware validation rules
- Code completion and recommendations
- Hover documentation
- Go to definition / navigation support
- Quick fixes and code actions
- Dynamic widget suggestions
- Workspace-aware intelligence
- Optional visual tools and diagnostics panels

This project should evolve from a lightweight productivity extension into a complete **Language Server Protocol (LSP)-backed developer tooling ecosystem**.

---

## 2. Product Vision

The extension should feel like a native IDE experience for the framework, similar to mature language tooling for React ecosystems and modern frontend frameworks.

### Core experience goals

- Help developers write framework code faster
- Catch mistakes early with clear diagnostics
- Suggest framework-specific patterns and APIs
- Reduce time spent reading documentation for common tasks
- Make widgets, pages, layouts, routes, and framework conventions discoverable inside VS Code

---

## 3. Scope

### In scope

- VS Code extension scaffold
- Snippets for `.ts` and `.tsx`
- Language Server for analysis and intelligence
- Static validation rules
- Auto-completion for framework constructs
- Hover help and inline docs
- Definition lookup and symbol navigation
- Code actions / quick fixes
- Dynamic widget indexing from the workspace
- Configurable project rules and preferences
- Developer-facing documentation

### Out of scope for initial release

- Full framework compiler integration
- Real-time visual preview engine
- Browser-based runtime debugging
- Complex refactoring tooling
- Multi-editor support beyond VS Code

---

## 4. Recommended Architecture

The extension should be split into two layers:

### 4.1 VS Code Client Extension

Handles editor-facing features:

- Activation and lifecycle
- Commands
- Snippets
- Settings UI
- Webviews / custom panels
- Language Client communication
- Status bar items
- Workspace events

### 4.2 Language Server

Handles analysis and intelligence:

- Diagnostics
- Completion items
- Hover text
- Code actions
- Definitions
- Document symbols
- Workspace indexing
- Rule evaluation
- Semantic parsing

### 4.3 High-level architecture

```text
VS Code Extension Host
├── Snippets
├── Commands
├── Settings
├── Webviews / Widgets
└── Language Client
        ↓
Language Server
├── Parser / AST analysis
├── Validation rules
├── Completions
├── Hover docs
├── Definitions
├── Quick fixes
├── Symbol indexing
└── Workspace intelligence
```

---

## 5. Technology Stack

### Recommended stack

- **TypeScript** for both client and server
- **VS Code Extension API** for editor integration
- **Language Server Protocol (LSP)** for smart language features
- **TypeScript Compiler API** or **ts-morph** for source analysis
- **@babel/parser** only if the framework requires specialized JSX parsing needs beyond TypeScript
- **JSON/YAML** for rule configuration and project metadata

### Suggested libraries

- `vscode`
- `vscode-languageclient`
- `vscode-languageserver`
- `typescript`
- `ts-morph`
- `@types/node`

### Recommendation

Use **ts-morph** for early development because it simplifies:

- parsing `.ts` / `.tsx`
- inspecting imports and exports
- traversing JSX
- extracting component names and props
- building workspace indexes

---

## 6. Target File Support

The extension should work on:

- `.ts`
- `.tsx`

Optional later support:

- `.js`
- `.jsx`
- framework-specific file extensions if the framework introduces them

The first release should prioritize **TypeScript and TSX**, since the framework is React-based.

---

## 7. Feature Roadmap

## Phase 1 — Foundation

### Goals

Build the minimal extension skeleton and get the first productivity features working.

### Deliverables

- VS Code extension scaffold
- Snippet support for `.ts` and `.tsx`
- Basic extension activation
- Command registration
- Configuration schema
- README and usage docs

### Features

- Component/page/layout boilerplate snippets
- Hook snippets
- Framework-specific file templates
- Common import templates

### Exit criteria

- Extension installs and activates successfully
- Snippets expand correctly in TS/TSX files
- Basic docs explain how to use the extension

---

## Phase 2 — Language Server Setup

### Goals

Introduce the core LSP architecture.

### Deliverables

- Client/server split
- Language Server communication
- Document synchronization
- Workspace file scanning
- Initial AST parsing pipeline

### Features

- Open file analysis
- Parse `.ts` and `.tsx`
- Track file updates
- Build a reusable source analysis layer

### Exit criteria

- Extension and server communicate correctly
- Source files are analyzed on open/change/save
- The foundation is ready for diagnostics and completions

---

## Phase 3 — Validation and Diagnostics

### Goals

Add SonarQube-style framework-specific checks.

### Deliverables

- Rule engine
- Diagnostic generation
- Rule severity levels
- Configurable rule settings

### Example validation rules

- Missing required exports
- Missing metadata in pages
- Disallowed imports
- Incorrect widget usage
- Naming convention violations
- Invalid framework-specific props
- Static vs dynamic misuse

### Rule engine design

Each rule should follow a structure like:

```ts
interface Rule {
  id: string;
  name: string;
  description: string;
  severity: "error" | "warning" | "info";
  run(sourceFile: SourceFile): Diagnostic[];
}
```

### Exit criteria

- Diagnostics appear in VS Code Problems panel
- Rules are understandable and actionable
- Rule configuration can be toggled or customized

---

## Phase 4 — Autocomplete and Code Completion

### Goals

Make the framework easier to use with intelligent completion suggestions.

### Deliverables

- Completion provider
- Context-aware suggestions
- Framework symbol index
- Import-aware completion logic

### Suggested completion types

- Components
- Widgets
- Pages
- Layouts
- Helpers
- Hooks
- Framework APIs
- File-level templates

### Smart completion examples

- Suggest `<Widget />` when a widget name is partially typed
- Suggest framework exports when typing imports
- Suggest valid props for known components
- Suggest helper methods in framework-specific contexts

### Exit criteria

- Completion suggestions are relevant and fast
- Suggestions appear in TS/TSX files when expected
- Results are filtered by context

---

## Phase 5 — Hover Help and Documentation

### Goals

Provide instant documentation without requiring developers to leave the editor.

### Deliverables

- Hover provider
- Symbol metadata extraction
- Framework doc rendering

### Hover content examples

- Component description
- Props list
- Required / optional flags
- Usage examples
- Source file location
- Framework conventions

### Exit criteria

- Hovering over framework constructs shows useful information
- Documentation is concise but informative

---

## Phase 6 — Go to Definition and Symbol Navigation

### Goals

Make framework codebase navigation effortless.

### Deliverables

- Definition provider
- Symbol indexing
- Workspace file mapping
- Cross-file navigation support

### Use cases

- Jump from component usage to its file
- Jump from widget reference to widget definition
- Jump from import statement to source file
- Navigate page/layout declarations

### Exit criteria

- Definitions resolve reliably
- Navigation reduces manual searching across the repo

---

## Phase 7 — Quick Fixes and Code Actions

### Goals

Turn diagnostics into actionable developer assistance.

### Deliverables

- Code action provider
- Fix suggestions for common errors
- Automated import insertion
- Framework-specific corrections

### Example quick fixes

- Add missing import
- Add missing export
- Insert required prop
- Convert to valid framework syntax
- Replace disallowed API usage with a framework-approved alternative

### Exit criteria

- At least some common diagnostics can be fixed automatically
- Quick fixes are safe and predictable

---

## Phase 8 — Dynamic Widget Suggestions

### Goals

Make project widgets discoverable and context-aware.

### Deliverables

- Workspace widget registry
- File scanning rules
- Widget metadata extraction
- Widget-aware completion and hover support

### Indexing strategy

Scan the workspace for widget sources such as:

```text
src/widgets/**/*.tsx
src/components/**/*.tsx
```

Build an internal registry containing:

- Widget name
- File path
- Export type
- Props type
- Description or doc comment

### Widget suggestion examples

- Suggest widgets based on page context
- Recommend widgets commonly used in similar files
- Suggest widgets from the same feature area

### Exit criteria

- Widgets can be discovered without manual registration
- Widget suggestions are relevant to the current file and workspace

---

## Phase 9 — Advanced Static Analysis

### Goals

Expand the extension into a true framework intelligence layer.

### Deliverables

- Project-wide analysis engine
- Cross-file dependency tracking
- Rule dependency graph
- Optional semantic tokens

### Potential analysis checks

- Invalid component nesting
- Missing required metadata
- Unused framework exports
- Conflicting route declarations
- Duplicated widget names
- Invalid page structure
- Unsupported JSX patterns

### Exit criteria

- The extension can understand more than one file at a time
- Analysis becomes richer than single-file linting

---

## Phase 10 — Configuration and Extensibility

### Goals

Allow teams to customize the extension based on framework conventions and project architecture.

### Deliverables

- Settings schema
- Rule toggles
- File pattern configuration
- Severity overrides
- Workspace-level configuration support

### Examples of configurable options

- Widget directories
- Page directories
- Valid file naming rules
- Allowed imports
- Forbidden patterns
- Custom framework keywords
- Completion behavior toggles

### Exit criteria

- Teams can tailor the extension to their codebase
- Configuration is easy to understand and maintain

---

## Phase 11 — Developer Experience Features

### Goals

Polish the extension into a high-quality tool.

### Deliverables

- Status bar indicators
- Framework health commands
- Workspace indexing progress feedback
- Welcome screen / onboarding guide
- Custom icons or branding

### Optional features

- Commands for generating framework files
- Templates for pages, layouts, and widgets
- File explorer decorations
- Custom webview panels showing framework insights

### Exit criteria

- The extension feels polished, not just functional

---

## Phase 12 — Testing, Stability, and Release

### Goals

Prepare for real project use and long-term maintenance.

### Deliverables

- Unit tests
- Integration tests
- Sample workspace test fixtures
- Performance checks
- Packaging and publishing setup

### Test areas

- Snippet expansion
- Rule engine outputs
- Diagnostics accuracy
- Completion quality
- Hover responses
- Definition resolution
- Workspace indexing correctness

### Release deliverables

- Versioned package
- Installation guide
- Feature changelog
- Contribution guidelines
- Issue templates

---

## 8. Suggested Internal Module Structure

```text
my-framework-extension/
├── client/
│   ├── extension.ts
│   ├── commands/
│   ├── snippets/
│   ├── configuration/
│   └── ui/
├── server/
│   ├── server.ts
│   ├── parser/
│   ├── diagnostics/
│   ├── completion/
│   ├── hover/
│   ├── definition/
│   ├── codeActions/
│   ├── indexing/
│   └── rules/
├── shared/
│   ├── types/
│   ├── constants/
│   └── protocol/
├── snippets/
├── docs/
├── tests/
└── package.json
```

---

## 9. Rule Engine Design

A modular rule engine will make the extension maintainable.

### Rule categories

- Naming rules
- Export rules
- Import rules
- JSX structure rules
- Framework architecture rules
- Project convention rules
- Deprecated API rules

### Rule execution model

1. Open or save a file
2. Parse the file into an AST
3. Evaluate all enabled rules
4. Generate diagnostics
5. Publish them to VS Code

### Advantages

- Easy to add new rules later
- Easy to disable rules per project
- Easy to assign severities
- Easy to reuse rule logic in code actions

---

## 10. Completion Strategy

### Sources of completion suggestions

- Local file symbols
- Workspace widget registry
- Framework built-in APIs
- Contextual component props
- Snippet shortcuts
- Import suggestions

### Ranking logic

Suggestions should be ranked based on:

- Current cursor context
- File type
- Existing imports
- Naming similarity
- Usage frequency
- Project conventions

---

## 11. Suggested MVP Features

For the first practical release, the best combination would be:

- Snippets for common framework files
- Diagnostics for 3–5 important validation rules
- Component/widget completion
- Hover docs for known symbols
- Go to definition for framework files
- One or two quick fixes
- Workspace widget indexing

This gives a meaningful developer experience without making the first version too large.

---

## 12. Milestone Plan

### Milestone 1

- Scaffold extension
- Add snippets
- Confirm TS/TSX support

### Milestone 2

- Add LSP client/server
- Build parsing layer
- Show basic diagnostics

### Milestone 3

- Add completion and hover
- Support framework symbol lookup

### Milestone 4

- Add definition and quick fixes
- Add workspace widget registry

### Milestone 5

- Add advanced validations
- Add configuration support
- Add tests

### Milestone 6

- Polish UX
- Document usage
- Package and release

---

## 13. Risks and Considerations

### Technical risks

- AST parsing complexity for framework-specific syntax
- Performance impact on large workspaces
- False positives in validation rules
- Keeping completion suggestions relevant
- Maintaining compatibility with TypeScript / VS Code updates

### Product risks

- Over-scoping the first version
- Building too many rules before proving value
- Duplicating functionality already handled by ESLint or TypeScript

### Mitigation strategy

- Start with a small but valuable MVP
- Keep rule logic modular
- Reuse existing TypeScript tooling where possible
- Measure feedback from real framework usage

---

## 14. Recommended Development Approach

### Best approach

Build the extension in layers:

1. **Snippets first** for immediate value
2. **Validation rules** for framework correctness
3. **Completion and hover** for productivity
4. **Definitions and quick fixes** for navigation and repair
5. **Workspace intelligence** for richer suggestions
6. **Advanced analysis** once the framework patterns are stable

This reduces risk and helps you validate the idea early.

---

## 15. Final Recommendation

For a React-based static site generator, a VS Code extension like this can become one of the best developer experience investments for the framework.

A strong version of this tool should not try to do everything on day one. Instead, it should evolve through controlled phases, with each release adding a clear productivity gain.

If executed well, this extension can become:

- a framework adoption accelerator
- a quality gate for code consistency
- a documentation surface inside the editor
- a powerful portfolio project demonstrating architecture, TypeScript, AST analysis, and IDE tooling skills

---

## 16. Next Steps

- Define the framework conventions that need tooling support
- List the first 5–10 validation rules
- Define the snippet catalog
- Decide the workspace folder conventions
- Choose between TypeScript Compiler API and ts-morph
- Scaffold the first extension version

---

## 17. Appendix — Initial Feature Checklist

- [ ] Extension scaffold created
- [ ] TS/TSX snippets added
- [ ] Language server connected
- [ ] AST parser integrated
- [ ] Diagnostics published
- [ ] Completion provider added
- [ ] Hover provider added
- [ ] Definition provider added
- [ ] Quick fixes added
- [ ] Workspace widget registry added
- [ ] Config options added
- [ ] Tests written
- [ ] Documentation completed
- [ ] Packaging/release prepared
