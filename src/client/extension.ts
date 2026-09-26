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

function isStreakProjectActive(activeEditor: vscode.TextEditor | undefined): boolean {
  if (activeEditor) {
    return findStreakProjectRoot(activeEditor.document.uri.fsPath) !== null;
  }
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders?.some((f) => findStreakProjectRoot(f.uri.fsPath) !== null) ?? false;
}

function countStreakDiagnostics(): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;

  for (const [, diags] of vscode.languages.getDiagnostics()) {
    for (const diag of diags) {
      if (diag.source === "Streak Engine") {
        if (diag.severity === vscode.DiagnosticSeverity.Error) {
          errors++;
        } else if (diag.severity === vscode.DiagnosticSeverity.Warning) {
          warnings++;
        }
      }
    }
  }

  return { errors, warnings };
}

function renderStatusBar(
  item: vscode.StatusBarItem,
  errors: number,
  warnings: number,
  widgetCount: number,
): void {
  if (errors > 0) {
    const warningText = warnings > 0 ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : "";
    item.text = `$(error) Streak: ${errors} error${errors === 1 ? "" : "s"}${warningText}`;
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    item.tooltip = `Streak Engine Issues: ${errors} error(s), ${warnings} warning(s). Click to view Problems.`;
  } else if (warnings > 0) {
    item.text = `$(warning) Streak: ${warnings} warning${warnings === 1 ? "" : "s"}`;
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    item.tooltip = `Streak Engine Issues: ${warnings} warning(s). Click to view Problems.`;
  } else {
    item.text = `$(pass) Streak: All Clean (${widgetCount} widget${widgetCount === 1 ? "" : "s"})`;
    item.backgroundColor = undefined;
    item.tooltip = `Streak: All checks passed. ${widgetCount} widget(s) indexed. Click to view Problems.`;
  }

  item.command = "workbench.actions.view.problems";
  item.show();
}

function updateStreakStatusBar(): void {
  if (!statusBarItem) {
    return;
  }

  if (!isStreakProjectActive(vscode.window.activeTextEditor)) {
    statusBarItem.hide();
    return;
  }

  const { errors, warnings } = countStreakDiagnostics();
  renderStatusBar(statusBarItem, errors, warnings, indexedWidgetCount);
}

/**
 * Called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Streak Snippets");
  outputChannel.appendLine("Streak Snippets extension activated");

  // Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "workbench.actions.view.problems";

  const diagWatcher = vscode.languages.onDidChangeDiagnostics(() => {
    updateStreakStatusBar();
  });
  const editorWatcher = vscode.window.onDidChangeActiveTextEditor(() => {
    updateStreakStatusBar();
  });

  updateStreakStatusBar();

  // Register Scaffolder Command
  const scaffoldCmd = vscode.commands.registerCommand("streak.createWidget", async () => {
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
    const widgetSubdir = config.get<string>("snippets.widgetDirectory") ?? "src/widgets";

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("Please open a workspace to create widgets.");
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
      vscode.window.showInformationMessage(`Widget ${name} created successfully!`);
    }
  });

  context.subscriptions.push(outputChannel, statusBarItem, diagWatcher, editorWatcher, scaffoldCmd);

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
