import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
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

  void client.start();
  outputChannel.appendLine("Streak Language Server client started");

  client.onNotification("streak/didIndexWidgets", (data: { count: number }) => {
    if (statusBarItem) {
      statusBarItem.text = `$(project) Streak: ${data.count} widget${data.count === 1 ? "" : "s"}`;
    }
  });
}

// ── Lifecycle ───────────────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Streak Snippets");
  outputChannel.appendLine("Streak Snippets extension activated");

  context.subscriptions.push(outputChannel);

  // Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.text = "$(project) Streak: 0 widgets";
  statusBarItem.tooltip = "Streak Workspace Widget Registry";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register Scaffolder Command
  const scaffoldCmd = vscode.commands.registerCommand(
    "streak.createWidget",
    async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter name of new widget (PascalCase)",
        placeHolder: "e.g. ProductCard",
        validateInput: (value) => {
          if (!value || !/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
            return "Widget name must start with a capital letter and be alphanumeric (PascalCase).";
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      const config = vscode.workspace.getConfiguration("streak");
      const widgetSubdir =
        config.get<string>("snippets.widgetDirectory") || "src/widgets";

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage(
          "Please open a workspace to create widgets.",
        );
        return;
      }

      const rootPath = workspaceFolders[0].uri.fsPath;
      const targetDir = path.join(rootPath, widgetSubdir);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, `${name}.tsx`);
      if (fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(
          `Widget ${name} already exists at ${widgetSubdir}/${name}.tsx`,
        );
        return;
      }

      const template = [
        `type ${name}Props = {`,
        "  data?: {",
        "    name?: string;",
        "  };",
        "};",
        "",
        `const ${name} = (props: ${name}Props) => {`,
        `  return <div>Hello ${name} {props?.data?.name}</div>;`,
        "};",
        "",
        `export default ${name};`,
        "",
      ].join("\n");

      fs.writeFileSync(filePath, template, "utf-8");

      if (!process.env.STREAK_TEST_ENVIRONMENT) {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(
          `Widget ${name} created successfully!`,
        );
      }
    },
  );

  context.subscriptions.push(scaffoldCmd);

  // Start the Language Server
  startLanguageServer(context);
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): Thenable<void> | undefined {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  if (!client) {
    return undefined;
  }
  return client.stop();
}
