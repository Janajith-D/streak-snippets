import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

/** Output channel for extension logging. */
let outputChannel: vscode.OutputChannel;
let client: LanguageClient | undefined;

/**
 * Snippet metadata used by the quick-pick menu.
 */
interface SnippetEntry {
  label: string;
  detail: string;
  prefix: string;
}

/**
 * Builds a flat list of snippet entries from a VS Code snippet JSON file.
 */
function loadSnippetEntries(filePath: string): SnippetEntry[] {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const json: Record<string, { prefix: string; description?: string }> =
      JSON.parse(raw);
    return Object.entries(json).map(([label, value]) => ({
      label,
      detail: value.description ?? "",
      prefix: value.prefix,
    }));
  } catch {
    return [];
  }
}

// ── Commands ────────────────────────────────────────────────────────────

/**
 * Opens a quick-pick menu listing every Streak snippet.
 * Selecting an entry inserts the snippet prefix so the user can expand it.
 */
async function showSnippetsCommand(extensionPath: string): Promise<void> {
  const snippetDir = path.join(extensionPath, "snippets");
  const tsSnippets = loadSnippetEntries(
    path.join(snippetDir, "streak.snippets.ts.json"),
  );
  const tsxSnippets = loadSnippetEntries(
    path.join(snippetDir, "streak.snippets.tsx.json"),
  );

  // Deduplicate by prefix (tsx file is a superset of ts)
  const seen = new Set<string>();
  const all: SnippetEntry[] = [];
  for (const entry of [...tsxSnippets, ...tsSnippets]) {
    if (!seen.has(entry.prefix)) {
      seen.add(entry.prefix);
      all.push(entry);
    }
  }

  const pick = await vscode.window.showQuickPick(
    all.map((s) => ({
      label: s.prefix,
      description: s.label,
      detail: s.detail,
    })),
    { placeHolder: "Select a Streak snippet to insert" },
  );

  if (pick) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await editor.insertSnippet(new vscode.SnippetString(pick.label));
    }
  }
}

/**
 * Prompts for a component name and scaffolds a new `.tsx` file in the
 * configured component directory.
 */
async function createComponentCommand(): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: "Component name (PascalCase)",
    placeHolder: "MyComponent",
    validateInput: (value) => {
      if (!value) {
        return "Component name is required";
      }
      if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) {
        return "Use PascalCase (e.g. MyComponent)";
      }
      return undefined;
    },
  });

  if (!name) {
    return;
  }

  const config = vscode.workspace.getConfiguration("streak");
  const componentDir = config.get<string>(
    "snippets.componentDirectory",
    "src/components",
  );

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      "No workspace folder open. Please open a project first.",
    );
    return;
  }

  const root = workspaceFolders[0].uri.fsPath;
  const targetDir = path.join(root, componentDir);
  const targetFile = path.join(targetDir, `${name}.tsx`);

  if (fs.existsSync(targetFile)) {
    vscode.window.showWarningMessage(
      `File already exists: ${path.relative(root, targetFile)}`,
    );
    return;
  }

  const content = [
    "import React from 'react';",
    "",
    `interface ${name}Props {`,
    "  children?: React.ReactNode;",
    "}",
    "",
    `export default function ${name}({ children }: ${name}Props) {`,
    "  return (",
    "    <div>",
    "      {children}",
    "    </div>",
    "  );",
    "}",
    "",
  ].join("\n");

  await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(targetFile),
    Buffer.from(content, "utf-8"),
  );

  const doc = await vscode.workspace.openTextDocument(targetFile);
  await vscode.window.showTextDocument(doc);

  outputChannel.appendLine(`Created component: ${targetFile}`);
  vscode.window.showInformationMessage(`Created component ${name}`);
}

// ── LSP Client Setup ─────────────────────────────────────────────────────

function startLanguageServer(context: vscode.ExtensionContext) {
  // Server module path in compiled output (dist/server.js)
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

  // If running in debug mode, use inspect options
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.{ts,tsx}"),
    },
  };

  client = new LanguageClient(
    "streakLanguageServer",
    "Streak Language Server",
    serverOptions,
    clientOptions,
  );

  client.start();
  outputChannel.appendLine("Streak Language Server client started");
}

// ── Lifecycle ───────────────────────────────────────────────────────────

/**
 * Called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Streak Snippets");
  outputChannel.appendLine("Streak Snippets extension activated");

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("streak-snippets.showSnippets", () =>
      showSnippetsCommand(context.extensionPath),
    ),
    vscode.commands.registerCommand(
      "streak-snippets.createComponent",
      createComponentCommand,
    ),
    outputChannel,
  );

  // Start the Language Server
  startLanguageServer(context);
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
