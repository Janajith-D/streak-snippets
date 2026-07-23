import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { analyzeDocument } from "./parser/analyzer";

// Create a connection for the server, using Node's IPC / stdio communication
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams): InitializeResult => {
  connection.console.log("Streak Language Server initializing...");
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("Streak Language Server initialized successfully.");
});

// Analyze document content when opened or updated
documents.onDidChangeContent((change) => {
  const uri = change.document.uri;
  const content = change.document.getText();

  connection.console.log(`[Analysis] Document changed: ${uri}`);
  const result = analyzeDocument(uri, content);

  connection.console.log(
    `[Analysis] Completed for ${uri}: ` +
      `${result.imports.length} imports, ` +
      `${result.exports.length} exports, ` +
      `${result.components.length} components, ` +
      `${result.jsxElements.length} JSX tags found.`,
  );
});

documents.onDidOpen((event) => {
  connection.console.log(`[Analysis] Document opened: ${event.document.uri}`);
});

documents.onDidSave((event) => {
  connection.console.log(`[Analysis] Document saved: ${event.document.uri}`);
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
