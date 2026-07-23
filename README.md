# Streak Snippets

A VS Code extension providing Streak Forge-specific snippets, commands, and developer productivity tools.

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

### Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---|---|
| `Streak: Show Snippet List` | Browse all available snippets in a quick-pick menu |
| `Streak: Create Component` | Scaffold a new component `.tsx` file |

## Extension Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `streak.snippets.enable` | `boolean` | `true` | Enable or disable Streak snippets |
| `streak.snippets.pageDirectory` | `string` | `src/pages` | Default directory for new pages |
| `streak.snippets.componentDirectory` | `string` | `src/components` | Default directory for new components |
| `streak.snippets.widgetDirectory` | `string` | `src/widgets` | Default directory for new widgets |

## Installation

1. Clone this repository
2. Run `npm install`
3. Press `F5` in VS Code to launch the Extension Development Host
4. Open a `.ts` or `.tsx` file and type a snippet prefix

## Development

```bash
npm run compile        # Build with webpack
npm run watch          # Watch mode
npm run lint           # Run ESLint
npm run compile-tests  # Compile tests
npm run test           # Run tests
```

## Requirements

- VS Code `^1.107.0`
- Node.js 18+

## Release Notes

### 0.0.1

- Streak Forge import snippets for `.tsx` (`imWP`, `imS`, `imPre`, `imDy`)
- JSX scaffold snippets for `.tsx` (`sfWp`, `sfPre`)
- Data handler scaffold for `.ts` (`sfDH`)
- `Streak: Show Snippet List` and `Streak: Create Component` commands
- Configuration schema for project directory paths
