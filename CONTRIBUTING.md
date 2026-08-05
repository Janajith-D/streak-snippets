# Contributing to Streak Snippets

Thank you for contributing to Streak Snippets! This document provides information on how to build, test, and contribute to the extension.

## Development Workflow

### Prerequisites
- [Node.js](https://nodejs.org) version 18 or higher.
- [npm](https://www.npmjs.com/) package manager.

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Streak/streak-snippets.git
   cd streak-snippets
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
1. Press `F5` in VS Code to launch the Extension Development Host window.
2. Open a `.ts` or `.tsx` file inside the new window to test diagnostics, autocomplete, hovers, or scaffolding commands.

---

## Build Commands

We use Webpack to bundle both the Client (Extension) and Server (Language Server) modules:
- **Compile Client and Server**:
  ```bash
  npm run compile
  ```
- **Compile and Watch (Auto rebuild on changes)**:
  ```bash
  npm run watch
  ```

---

## Testing and Quality Checks

### Linting
We enforce eslint coding standards:
```bash
npm run lint
```

### Running Tests
Unit tests use the VS Code extension test host environment:
1. Compile the test files first:
   ```bash
   npm run compile-tests
   ```
2. Run the test suite:
   ```bash
   npx vscode-test --code-version 1.130.0
   ```

---

## Code Structure

- **`src/client/`**: Main entry point for the VS Code client wrapper, command registrations, and Status Bar indicator logic.
- **`src/server/`**: Language Server Protocol engine:
  - `completion/`: JSX element completion and callback completion engines.
  - `registry/`: Workspace crawler registry indexing components and JSDocs.
  - `rules/`: Static analysis validation checkers (diagnostics).
- **`src/shared/`**: Helper files and typings shared across client and server.
- **`src/test/`**: Unit and integration test suites.
