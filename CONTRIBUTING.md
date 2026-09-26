# Contributing to Streak Snippets

Thank you for contributing to Streak Snippets! This guide explains how to set up the development environment, run the extension locally, and contribute code.

---

## 1. Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher)
- [npm](https://www.npmjs.com/) package manager
- [Visual Studio Code](https://code.visualstudio.com) (v1.107 or higher)

### Repository Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Streak/streak-snippets.git
   cd streak-snippets
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

---

## 2. Development Workflow

### Running the Extension Locally
1. Open the project folder in VS Code.
2. Press `F5` (or select **Run > Start Debugging**) to launch an **Extension Development Host** window.
3. In the new window, open any workspace containing `.ts`, `.tsx`, or `streak.sitemap.json` files to test diagnostics, autocomplete, hovers, and commands in real time.

### Build Scripts

| Command | Description |
|---|---|
| `npm run compile` | Builds client (`dist/extension.js`) and server (`dist/server.js`) via Webpack. |
| `npm run watch` | Runs Webpack in watch mode for auto-recompilation on code edits. |
| `npm run compile-tests` | Compiles TypeScript test files with `tsc` to `out/`. |
| `npm run lint` | Runs ESLint across all TypeScript sources. |
| `npm test` | Runs the full integration test suite via the VS Code extension test runner. |

---

## 3. Project Structure

```
streak-snippets/
├── src/
│   ├── client/           # VS Code Extension Host (thin client, commands, status bar)
│   ├── server/           # Language Server Protocol engine
│   │   ├── completion/   # JSX attribute and callback completion providers
│   │   ├── definition/   # Go-to-definition resolution
│   │   ├── hover/        # Hover documentation providers
│   │   ├── parser/       # ts-morph AST analyzer
│   │   ├── registry/     # Workspace widget, sitemap, and gDom registries
│   │   └── rules/        # Streak Engine diagnostic rules (streak:Sxxx)
│   ├── shared/           # Pure TypeScript models and constants
│   └── test/             # Mocha unit and integration test suite
├── snippets/             # Static snippet definitions (.ts and .tsx)
└── docs/                 # Documentation (Architecture, Rule Catalog, Roadmap)
```

> 📖 For an in-depth explanation of system components and memory lifecycles, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 4. Code & Quality Standards

1. **Strict Client/Server Separation**: Keep `src/client/` free of heavy compiler tools (`ts-morph`). All AST logic lives in `src/server/`.
2. **Diagnostic Rules**: Every framework validation check must be a dedicated class in `src/server/rules/` tagged with `source: "Streak Engine"`.
3. **Quality Gate**: Pull requests must pass:
   ```bash
   npm run compile-tests && npm run compile && npm run lint && npm test
   ```
4. **License**: By contributing, you agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).
