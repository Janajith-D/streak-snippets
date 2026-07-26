import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "url";
import { analyzeAndParseDocument } from "./parser/analyzer";
import { runRules } from "./rules/runner";
import { getCompletions } from "./completion/provider";

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

function validateDocument(document: TextDocument): void {
  const uri = document.uri;
  const content = document.getText();

  connection.console.log(`[Validation] Running diagnostics for: ${uri}`);

  const { analysis, sourceFile } = analyzeAndParseDocument(uri, content);
  const diagnostics = runRules(sourceFile, analysis);

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
