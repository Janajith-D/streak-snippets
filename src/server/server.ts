import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  type InitializeParams,
  type InitializeResult,
  TextDocumentSyncKind,
  type Hover,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "node:url";
import {
  analyzeAndParseDocument,
  cleanupDocumentSourceFile,
} from "./parser/analyzer";
import { runRules } from "./rules/runner";
import { getCompletions } from "./completion/provider";
import { resolveHover } from "./hover/provider";
import { resolveDefinition } from "./definition/provider";
import { resolveCodeActions } from "./codeaction/provider";
import { scanWorkspace, scanFile } from "./registry/scanner";
import { widgetRegistry } from "./registry/widgets";

// Define strict typing for configuration to satisfy ESLint
interface StreakSettings {
  snippets?: {
    widgetDirectory?: string;
    publicDirectory?: string;
  };
  rules?: Record<string, { severity?: string; allowedImports?: string[]; forbiddenPatterns?: string[] }>;
}

// Create a connection for the server, using Node's IPC / stdio communication
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let workspaceRoot: string | undefined;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  connection.console.log("Streak Language Server initializing...");
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    const uri = params.workspaceFolders[0].uri;
    if (uri.startsWith("file://")) {
      try {
        workspaceRoot = fileURLToPath(uri);
      } catch {
        /* ignore */
      }
    }
  }
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ["<", " ", '"', "'", "/"],
      },
      codeActionProvider: true,
      hoverProvider: true,
      definitionProvider: true,
    },
  };
});

connection.onInitialized(async () => {
  connection.console.log("Streak Language Server initialized successfully.");
  if (workspaceRoot) {
    let customWidgetDir: string | undefined;
    try {
      const streakSettings =
        (await connection.workspace.getConfiguration("streak")) as StreakSettings;
      customWidgetDir = streakSettings?.snippets?.widgetDirectory;
    } catch {
      /* ignore */
    }
    await scanWorkspace(workspaceRoot, customWidgetDir);
    
    await connection.sendNotification("streak/didIndexWidgets", {
      count: widgetRegistry.getAll().length,
    });
  }
});

connection.onCompletion(async (params) => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document) {
    return [];
  }
  const offset = document.offsetAt(params.position);
  const { sourceFile } = analyzeAndParseDocument(uri, document.getText());

  let customWidgetDir: string | undefined;
  let customPublicDir: string | undefined;
  try {
    const streakSettings =
      (await connection.workspace.getConfiguration("streak")) as StreakSettings;
    customWidgetDir = streakSettings?.snippets?.widgetDirectory;
    customPublicDir = streakSettings?.snippets?.publicDirectory;
  } catch {
    /* ignore */
  }

  return getCompletions(
    {
      text: document.getText(),
      uri,
      offset,
      line: params.position.line,
      character: params.position.character,
    },
    document,
    sourceFile,
    workspaceRoot,
    customWidgetDir,
    customPublicDir,
  );
});

connection.onCodeAction((params) => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document) {
    return [];
  }
  const { sourceFile } = analyzeAndParseDocument(uri, document.getText());
  return resolveCodeActions(params.context.diagnostics, document, sourceFile);
});

connection.onHover((params): Hover | null => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document) {
    return null;
  }
  const offset = document.offsetAt(params.position);
  const { sourceFile } = analyzeAndParseDocument(uri, document.getText());

  const node = sourceFile.getDescendantAtPos(offset);
  if (!node) {
    return null;
  }

  return resolveHover(node);
});

connection.onDefinition(async (params) => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document) {
    return null;
  }
  const offset = document.offsetAt(params.position);
  const { sourceFile } = analyzeAndParseDocument(uri, document.getText());

  const node = sourceFile.getDescendantAtPos(offset);
  if (!node) {
    return null;
  }

  let customWidgetDir: string | undefined;
  let customPublicDir: string | undefined;
  try {
    const streakSettings =
      (await connection.workspace.getConfiguration("streak")) as StreakSettings;
    customWidgetDir = streakSettings?.snippets?.widgetDirectory;
    customPublicDir = streakSettings?.snippets?.publicDirectory;
  } catch {
    /* ignore */
  }

  return await resolveDefinition(
    node,
    workspaceRoot,
    customWidgetDir,
    customPublicDir,
  );
});

/**
 * Extracts rule severities and options from the workspace StreakSettings object.
 * Extracted to reduce cognitive complexity of validateDocument.
 */
function buildRuleConfiguration(streakSettings: StreakSettings | undefined): {
  ruleSeverities: Record<string, string>;
  ruleOptions: Record<string, unknown>;
} {
  const ruleSeverities: Record<string, string> = {};
  const ruleOptions: Record<string, unknown> = {};

  if (streakSettings?.rules) {
    const settingsMap: Record<string, string> = {
      widgetPlaceholderProps: "streak:widget-placeholder-props",
      dataHandlerStatus: "streak:data-handler-status",
      missingDefaultExport: "streak:missing-default-export",
      dataHandlerAsync: "streak:data-handler-async",
      invalidHandlerStatus: "streak:invalid-handler-status",
      reactHooksNotAllowed: "streak:react-hooks-not-allowed",
      unsafeWidgetDataAccess: "streak:unsafe-widget-data-access",
      invalidWidgetPropsContract: "streak:invalid-widget-props-contract",
      scriptClosureCapture: "streak:script-closure-capture",
      invalidScriptSignature: "streak:invalid-script-signature",
      importInsideScript: "streak:import-inside-script",
      asyncScriptCallback: "streak:async-script-callback",
      scriptRequiredId: "streak:script-required-id",
      invalidDynamicComponentId: "streak:invalid-dynamic-component-id",
      duplicatedWidget: "streak:duplicated-widget",
      componentNesting: "streak:component-nesting",
      scriptStructure: "streak:script-structure",
      allowedImports: "streak:allowed-imports",
      forbiddenPatterns: "streak:forbidden-patterns",
    };

    for (const [settingsKey, ruleId] of Object.entries(settingsMap)) {
      if (streakSettings.rules[settingsKey]?.severity) {
        ruleSeverities[ruleId] = streakSettings.rules[settingsKey].severity;
      }
    }

    if (streakSettings.rules.allowedImports) {
      ruleOptions.allowedImports = streakSettings.rules.allowedImports;
    }
    if (streakSettings.rules.forbiddenPatterns) {
      ruleOptions.forbiddenPatterns = streakSettings.rules.forbiddenPatterns;
    }
  }

  return { ruleSeverities, ruleOptions };
}

async function validateDocument(document: TextDocument): Promise<void> {
  const uri = document.uri;
  const content = document.getText();

  connection.console.log(`[Validation] Running diagnostics for: ${uri}`);

  const { analysis, sourceFile } = analyzeAndParseDocument(uri, content);

  try {
    const filePath = fileURLToPath(uri);
    let customWidgetDir = "src/widgets";
    try {
      const streakSettings =
        (await connection.workspace.getConfiguration("streak")) as StreakSettings;
      if (streakSettings?.snippets?.widgetDirectory) {
        customWidgetDir = streakSettings.snippets.widgetDirectory;
      }
    } catch {
      /* ignore */
    }

    const normalizedPath = filePath.replaceAll("\\", "/");
    const normalizedWidgetDir = customWidgetDir.replaceAll("\\", "/");

    if (
      normalizedPath.includes(normalizedWidgetDir) ||
      normalizedPath.includes("src/components")
    ) {
      await scanFile(filePath);
      await connection.sendNotification("streak/didIndexWidgets", {
        count: widgetRegistry.getAll().length,
      });
    }
  } catch {
    /* ignore */
  }

  let config = { ruleSeverities: {} as Record<string, string>, ruleOptions: {} as Record<string, unknown> };
  try {
    const streakSettings =
      (await connection.workspace.getConfiguration("streak")) as StreakSettings;
    config = buildRuleConfiguration(streakSettings);
  } catch (err) {
    connection.console.log(`Failed to fetch configurations: ${err instanceof Error ? err.message : String(err)}`);
  }

  const diagnostics = runRules(sourceFile, analysis, {
    enabled: true,
    ruleSeverities: config.ruleSeverities,
    ruleOptions: config.ruleOptions,
  });

  connection.console.log(
    `[Validation] Found ${diagnostics.length} diagnostic(s) for ${uri}`,
  );

  // Send the computed diagnostics to VS Code
  await connection.sendDiagnostics({ uri, diagnostics });
}

// Analyze and validate document content when opened or updated
documents.onDidChangeContent((change) => {
  validateDocument(change.document).catch((err) => connection.console.error(String(err)));
});

documents.onDidOpen((event) => {
  connection.console.log(`[Lifecycle] Document opened: ${event.document.uri}`);
  validateDocument(event.document).catch((err) => connection.console.error(String(err)));
});

documents.onDidSave((event) => {
  connection.console.log(`[Lifecycle] Document saved: ${event.document.uri}`);
  validateDocument(event.document).catch((err) => connection.console.error(String(err)));
});

documents.onDidClose((event) => {
  connection.console.log(`[Lifecycle] Document closed: ${event.document.uri}`);
  cleanupDocumentSourceFile(event.document.uri);
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
