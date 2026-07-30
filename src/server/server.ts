import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CodeAction,
  CodeActionKind,
  Hover,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "url";
import { analyzeAndParseDocument } from "./parser/analyzer";
import { runRules } from "./rules/runner";
import { getCompletions } from "./completion/provider";
import { resolveHover } from "./hover/provider";
import { resolveDefinition } from "./definition/provider";

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
        // Fallback
      }
    }
  }
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ["<", " ", "\"", "'", "/"],
      },
      codeActionProvider: true,
      hoverProvider: true,
      definitionProvider: true,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("Streak Language Server initialized successfully.");
});

connection.onCompletion((params) => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document) {
    return [];
  }
  const offset = document.offsetAt(params.position);
  const { sourceFile } = analyzeAndParseDocument(uri, document.getText());

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
    workspaceRoot
  );
});

connection.onCodeAction((params) => {
  const codeActions: CodeAction[] = [];
  const diagnostics = params.context.diagnostics;

  for (const diag of diagnostics) {
    if (diag.code === "streak:S405") {
      codeActions.push({
        title: "Add id attribute",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: {
                  start: { line: diag.range.start.line, character: diag.range.start.character + 7 },
                  end: { line: diag.range.start.line, character: diag.range.start.character + 7 },
                },
                newText: ' id="my-script"',
              },
            ],
          },
        },
      });
    }
  }

  return codeActions;
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

connection.onDefinition((params) => {
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

  return resolveDefinition(node, workspaceRoot);
});

async function validateDocument(document: TextDocument): Promise<void> {
  const uri = document.uri;
  const content = document.getText();

  connection.console.log(`[Validation] Running diagnostics for: ${uri}`);

  const { analysis, sourceFile } = analyzeAndParseDocument(uri, content);

  let ruleSeverities: Record<string, string> = {};
  try {
    const streakSettings = await connection.workspace.getConfiguration("streak");
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
      };

      for (const [settingsKey, ruleId] of Object.entries(settingsMap)) {
        if (streakSettings.rules[settingsKey]?.severity) {
          ruleSeverities[ruleId] = streakSettings.rules[settingsKey].severity;
        }
      }
    }
  } catch (err) {
    connection.console.log(`Failed to fetch configurations: ${err}`);
  }

  const diagnostics = runRules(sourceFile, analysis, { enabled: true, ruleSeverities });

  connection.console.log(
    `[Validation] Found ${diagnostics.length} diagnostic(s) for ${uri}`,
  );

  // Send the computed diagnostics to VS Code
  connection.sendDiagnostics({ uri, diagnostics });
}

// Analyze and validate document content when opened or updated
documents.onDidChangeContent((change) => {
  validateDocument(change.document);
});

documents.onDidOpen((event) => {
  connection.console.log(`[Lifecycle] Document opened: ${event.document.uri}`);
  validateDocument(event.document);
});

documents.onDidSave((event) => {
  connection.console.log(`[Lifecycle] Document saved: ${event.document.uri}`);
  validateDocument(event.document);
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
