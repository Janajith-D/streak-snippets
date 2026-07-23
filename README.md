# Streak Snippets

A VS Code extension providing snippets, commands, and developer productivity tools for the **Streak.js** React-based static site generator framework.

## Features

### Snippets

Type a snippet prefix in any `.ts` or `.tsx` file and press `Tab` to expand.

#### TypeScript (`.ts`) Snippets

| Prefix | Description |
|---|---|
| `streak-page` | Page with metadata and default export |
| `streak-layout` | Layout component with `children` prop |
| `streak-hook` | Custom React hook |
| `streak-api-route` | Server-side API route handler |
| `streak-middleware` | Middleware handler |
| `streak-config` | Streak configuration file |
| `streak-server-fn` | Server function (`'use server'`) |
| `streak-import-react` | Import React |
| `streak-import-hooks` | Import React hooks |
| `streak-import-streak` | Import from Streak framework |

#### TypeScript React (`.tsx`) Snippets

All `.ts` snippets above, plus:

| Prefix | Description |
|---|---|
| `streak-component` | Functional component with props interface |
| `streak-widget` | Streak widget component |
| `streak-page` | Page with metadata and JSX |
| `streak-layout` | Layout with JSX children rendering |
| `streak-error-boundary` | Error boundary component |
| `streak-loading` | Loading state component |

### Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for:

| Command | Description |
|---|---|
| `Streak: Show Snippet List` | Browse all available Streak snippets in a quick-pick menu |
| `Streak: Create Component` | Scaffold a new component file with a PascalCase name prompt |

## Extension Settings

This extension contributes the following settings:

| Setting | Type | Default | Description |
|---|---|---|---|
| `streak.snippets.enable` | `boolean` | `true` | Enable or disable Streak snippets |
| `streak.snippets.pageDirectory` | `string` | `src/pages` | Default directory for new Streak pages |
| `streak.snippets.componentDirectory` | `string` | `src/components` | Default directory for new Streak components |
| `streak.snippets.widgetDirectory` | `string` | `src/widgets` | Default directory for new Streak widgets |

## Installation

1. Clone this repository
2. Run `npm install`
3. Press `F5` in VS Code to open a new Extension Development Host window
4. Open a `.ts` or `.tsx` file and start typing a snippet prefix

## Development

```bash
# Compile the extension
npm run compile

# Watch for changes
npm run watch

# Run linting
npm run lint

# Run tests
npm run test
```

## Requirements

- VS Code `^1.125.0`
- Node.js 18+

## Release Notes

### 0.0.1

- Initial release
- Snippet support for `.ts` and `.tsx` files
- `Streak: Show Snippet List` command
- `Streak: Create Component` command
- Configuration schema for project directory paths
