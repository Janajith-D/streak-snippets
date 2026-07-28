import * as vscode from "vscode";
import * as path from "path";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

/** Output channel for extension logging. */
let outputChannel: vscode.OutputChannel;
let client: LanguageClient | undefined;

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

  context.subscriptions.push(outputChannel);

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
