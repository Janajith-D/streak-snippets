import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";
import { findStreakProjectRoot } from "../server/registry/projectDetector";

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
      { scheme: "file", language: "json", pattern: "**/streak.sitemap.json" },
      { scheme: "file", language: "json", pattern: "**/*.sitemap.json" },
      { scheme: "file", language: "json" },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.{ts,tsx,json}"),
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
    indexedWidgetCount = data.count;
    updateStreakStatusBar();
  });
}

// ── Lifecycle ───────────────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem | undefined;
let indexedWidgetCount = 0;

function updateStreakStatusBar() {
  if (!statusBarItem) {
    return;
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const hasStreakWorkspace = workspaceFolders?.some((f) =>
      findStreakProjectRoot(f.uri.fsPath),
    );
    if (!hasStreakWorkspace) {
      statusBarItem.hide();
      return;
    }
  } else {
    const filePath = activeEditor.document.uri.fsPath;
    if (!findStreakProjectRoot(filePath)) {
      statusBarItem.hide();
      return;
    }
  }

  let streakErrors = 0;
  let streakWarnings = 0;

  const allDiagnostics = vscode.languages.getDiagnostics();
  for (const [, diags] of allDiagnostics) {
    for (const diag of diags) {
      if (diag.source === "Streak Engine") {
        if (diag.severity === vscode.DiagnosticSeverity.Error) {
          streakErrors++;
        } else if (diag.severity === vscode.DiagnosticSeverity.Warning) {
          streakWarnings++;
        }
      }
    }
  }

  if (streakErrors > 0) {
    statusBarItem.text = `$(error) Streak: ${streakErrors} error${streakErrors === 1 ? "" : "s"}${
      streakWarnings > 0 ? `, ${streakWarnings} warning${streakWarnings === 1 ? "" : "s"}` : ""
    }`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
    statusBarItem.tooltip = `Streak Engine Issues: ${streakErrors} error(s), ${streakWarnings} warning(s). Click to view Problems.`;
  } else if (streakWarnings > 0) {
    statusBarItem.text = `$(warning) Streak: ${streakWarnings} warning${streakWarnings === 1 ? "" : "s"}`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
    statusBarItem.tooltip = `Streak Engine Issues: ${streakWarnings} warning(s). Click to view Problems.`;
  } else {
    statusBarItem.text = `$(pass) Streak: All Clean (${indexedWidgetCount} widget${indexedWidgetCount === 1 ? "" : "s"})`;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = `Streak: All checks passed. ${indexedWidgetCount} widget(s) indexed. Click to view Problems.`;
  }

  statusBarItem.command = "workbench.actions.view.problems";
  statusBarItem.show();
}

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
  statusBarItem.command = "workbench.actions.view.problems";
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      updateStreakStatusBar();
    }),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStreakStatusBar();
    }),
  );

  updateStreakStatusBar();

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
