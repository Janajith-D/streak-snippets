import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  type InitializeParams,
  type InitializeResult,
  TextDocumentSyncKind,
  type Hover,
  Location,
  type WorkspaceEdit,
  Range,
  type Diagnostic,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeAndParseDocument, cleanupDocumentSourceFile } from "./parser/analyzer";
import { runRules } from "./rules/runner";
import { getCompletions } from "./completion/provider";
import { resolveHover, resolveSitemapHover } from "./hover/provider";
import { resolveDefinition, resolveSitemapDefinition } from "./definition/provider";
import { resolveCodeActions } from "./codeaction/provider";
import {
  scanWorkspace,
  scanFile,
  resolveProjectRoot,
  findStreakProjectRoot,
} from "./registry/scanner";
import { widgetRegistry } from "./registry/widgets";
import { sitemapRegistry } from "./registry/sitemaps";
import { validateSitemap } from "./rules/sitemapRules";
import { Node } from "ts-morph";
import * as fs from "node:fs";

import {
  type StreakSettings,
  type ParsedRuleConfiguration,
  buildRuleConfiguration,
  loadProjectSettings,
  mergeRuleConfigurations,
} from "./rules/config";

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
      referencesProvider: true,
      renameProvider: true,
    },
  };
});

connection.onInitialized(async () => {
  connection.console.log("Streak Language Server initialized successfully.");
  if (workspaceRoot) {
    let customWidgetDir: string | undefined;
    try {
      const streakSettings = (await connection.workspace.getConfiguration(
        "streak",
      )) as StreakSettings;
      customWidgetDir = streakSettings.snippets?.widgetDirectory;
    } catch {
      /* ignore */
    }
    await scanWorkspace(workspaceRoot, customWidgetDir);

    await connection.sendNotification("streak/didIndexWidgets", {
      count: widgetRegistry.getAll().length,
    });
  }
});

function isIgnoredDocumentUri(uri: string): boolean {
  const norm = uri.replaceAll("\\", "/").toLowerCase();
  return (
    norm.includes("/node_modules/") ||
    norm.endsWith(".d.ts") ||
    norm.endsWith(".d.cts") ||
    norm.endsWith(".d.mts")
  );
}

connection.onCompletion(async (params) => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (
    !document ||
    isIgnoredDocumentUri(uri) ||
    !findStreakProjectRoot(uri, workspaceRoot) ||
    (uri.endsWith(".json") && !uri.endsWith("sitemap.json"))
  ) {
    return [];
  }
  const offset = document.offsetAt(params.position);
  const { sourceFile } = analyzeAndParseDocument(uri, document.getText());

  let customWidgetDir: string | undefined;
  let customPublicDir: string | undefined;
  try {
    const streakSettings = (await connection.workspace.getConfiguration(
      "streak",
    )) as StreakSettings;
    customWidgetDir = streakSettings.snippets?.widgetDirectory;
    customPublicDir = streakSettings.snippets?.publicDirectory;
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
  if (
    !document ||
    isIgnoredDocumentUri(uri) ||
    !findStreakProjectRoot(uri, workspaceRoot) ||
    (uri.endsWith(".json") && !uri.endsWith("sitemap.json"))
  ) {
    return [];
  }
  const { sourceFile } = analyzeAndParseDocument(uri, document.getText());
  return resolveCodeActions(params.context.diagnostics, document, sourceFile);
});

connection.onHover((params): Hover | null => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document || isIgnoredDocumentUri(uri) || !findStreakProjectRoot(uri, workspaceRoot)) {
    return null;
  }
  const offset = document.offsetAt(params.position);

  if (uri.endsWith(".json")) {
    if (uri.endsWith("sitemap.json")) {
      const projectRoot = resolveProjectRoot(uri, workspaceRoot);
      sitemapRegistry.parseAndRegister(document.uri, document.getText());
      return resolveSitemapHover(document, offset, projectRoot);
    }
    return null;
  }

  const { sourceFile } = analyzeAndParseDocument(uri, document.getText());

  const node = sourceFile.getDescendantAtPos(offset);
  if (!node) {
    return null;
  }

  return resolveHover(node);
});

connection.onDefinition(async (params) => {
  try {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);
    if (!document || isIgnoredDocumentUri(uri) || !findStreakProjectRoot(uri, workspaceRoot)) {
      return null;
    }
    const offset = document.offsetAt(params.position);
    const projectRoot = resolveProjectRoot(uri, workspaceRoot);

    let customWidgetDir: string | undefined;
    let customPublicDir: string | undefined;
    try {
      const streakSettings = (await connection.workspace.getConfiguration(
        "streak",
      )) as StreakSettings;
      customWidgetDir = streakSettings.snippets?.widgetDirectory;
      customPublicDir = streakSettings.snippets?.publicDirectory;
    } catch {
      /* ignore */
    }

    if (uri.endsWith(".json")) {
      if (uri.endsWith("sitemap.json")) {
        sitemapRegistry.parseAndRegister(document.uri, document.getText());
        return resolveSitemapDefinition(document, offset, projectRoot, customWidgetDir);
      }
      return null;
    }

    const { sourceFile } = analyzeAndParseDocument(uri, document.getText());

    const node = sourceFile.getDescendantAtPos(offset);
    if (!node) {
      return null;
    }

    return await resolveDefinition(node, projectRoot, customWidgetDir, customPublicDir);
  } catch (err) {
    connection.console.error(
      `[Definition] Error resolving definition: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
});

function resolveWidgetNameAtOffset(uri: string, document: TextDocument, offset: number): string {
  if (uri.endsWith("sitemap.json")) {
    const pages = sitemapRegistry.getPages();
    for (const page of pages) {
      for (const w of page.widgets) {
        if (offset >= w.start && offset <= w.end) {
          return w.type;
        }
      }
    }
  } else {
    const { sourceFile } = analyzeAndParseDocument(uri, document.getText());
    const node = sourceFile.getDescendantAtPos(offset);
    if (node && Node.isIdentifier(node)) {
      return node.getText();
    }
  }
  return "";
}

function findWidgetReferencesInSitemap(wName: string): Location[] {
  const locations: Location[] = [];
  const sitemapPath = sitemapRegistry.getSitemapPath();
  if (!sitemapPath) {
    return locations;
  }
  let sitemapText = "";
  try {
    sitemapText = fs.readFileSync(sitemapPath, "utf-8");
  } catch {
    // ignore
  }
  const sitemapDoc = TextDocument.create(
    pathToFileURL(sitemapPath).toString(),
    "json",
    1,
    sitemapText,
  );
  const sitemapUri = pathToFileURL(sitemapPath).toString();

  const pages = sitemapRegistry.getPages();
  for (const page of pages) {
    for (const w of page.widgets) {
      if (w.type === wName) {
        locations.push(
          Location.create(
            sitemapUri,
            Range.create(sitemapDoc.positionAt(w.start), sitemapDoc.positionAt(w.end)),
          ),
        );
      }
    }
  }
  return locations;
}

function findWidgetRenameChangesInSitemap(
  wName: string,
  newName: string,
): Record<string, { range: Range; newText: string }[]> {
  const changes: Record<string, { range: Range; newText: string }[]> = {};
  const sitemapPath = sitemapRegistry.getSitemapPath();
  if (!sitemapPath) {
    return changes;
  }
  let sitemapText = "";
  try {
    sitemapText = fs.readFileSync(sitemapPath, "utf-8");
  } catch {
    // ignore
  }
  const sitemapDoc = TextDocument.create(
    pathToFileURL(sitemapPath).toString(),
    "json",
    1,
    sitemapText,
  );
  const sitemapUri = pathToFileURL(sitemapPath).toString();
  changes[sitemapUri] = [];

  const pages = sitemapRegistry.getPages();
  for (const page of pages) {
    for (const w of page.widgets) {
      if (w.type === wName) {
        changes[sitemapUri].push({
          range: Range.create(sitemapDoc.positionAt(w.start), sitemapDoc.positionAt(w.end)),
          newText: newName,
        });
      }
    }
  }
  return changes;
}

connection.onReferences((params): Location[] => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document || !findStreakProjectRoot(uri, workspaceRoot)) {
    return [];
  }
  const offset = document.offsetAt(params.position);
  const wName = resolveWidgetNameAtOffset(uri, document, offset);
  if (!wName) {
    return [];
  }
  return findWidgetReferencesInSitemap(wName);
});

connection.onRenameRequest((params): WorkspaceEdit | null => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document || !findStreakProjectRoot(uri, workspaceRoot)) {
    return null;
  }
  const offset = document.offsetAt(params.position);
  const newName = params.newName;

  const wName = resolveWidgetNameAtOffset(uri, document, offset);
  if (!wName) {
    return null;
  }
  const changes = findWidgetRenameChangesInSitemap(wName, newName);
  return { changes };
});

async function indexWidgetFile(uri: string): Promise<void> {
  try {
    const filePath = fileURLToPath(uri);
    let customWidgetDir = "src/widgets";
    try {
      const streakSettings = (await connection.workspace.getConfiguration(
        "streak",
      )) as StreakSettings;
      if (streakSettings.snippets?.widgetDirectory) {
        customWidgetDir = streakSettings.snippets.widgetDirectory;
      }
    } catch {
      /* ignore */
    }

    const normalizedPath = filePath.replaceAll("\\", "/");
    const normalizedWidgetDir = customWidgetDir.replaceAll("\\", "/");

    if (normalizedPath.includes(normalizedWidgetDir) || normalizedPath.includes("src/components")) {
      await scanFile(filePath);
      await connection.sendNotification("streak/didIndexWidgets", {
        count: widgetRegistry.getAll().length,
      });
    }
  } catch {
    /* ignore */
  }
}

async function fetchRuleConfiguration(uri?: string): Promise<ParsedRuleConfiguration> {
  try {
    let workspaceSettings: StreakSettings | undefined;
    try {
      workspaceSettings = (await connection.workspace.getConfiguration("streak")) as StreakSettings;
    } catch {
      /* ignore workspace failure */
    }

    const baseConfig = buildRuleConfiguration(workspaceSettings);

    const projectRoot = uri ? findStreakProjectRoot(uri, workspaceRoot) : null;
    const projectSettings = projectRoot ? loadProjectSettings(projectRoot) : undefined;
    const projectConfig = projectSettings ? buildRuleConfiguration(projectSettings) : undefined;

    return mergeRuleConfigurations(baseConfig, projectConfig);
  } catch (err) {
    connection.console.error(
      `Failed to fetch configurations: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ruleSeverities: {}, ruleOptions: {} };
  }
}

async function validateJsonDocument(
  document: TextDocument,
  ruleSeverities: Record<string, string>,
): Promise<void> {
  const uri = document.uri;
  if (!uri.endsWith("sitemap.json")) {
    await connection.sendDiagnostics({ uri, diagnostics: [] });
    return;
  }

  const projectRoot = resolveProjectRoot(uri, workspaceRoot);

  const diagnostics = validateSitemap(document, projectRoot, ruleSeverities);
  await connection.sendDiagnostics({ uri, diagnostics });

  for (const doc of documents.all()) {
    if (doc.uri !== uri && doc.uri.endsWith(".tsx")) {
      setTimeout(() => {
        validateDocument(doc).catch(() => {
          // ignore validation failure
        });
      }, 50);
    }
  }
}

async function validateDocument(document: TextDocument): Promise<void> {
  const uri = document.uri;
  if (isIgnoredDocumentUri(uri) || !findStreakProjectRoot(uri, workspaceRoot)) {
    await connection.sendDiagnostics({ uri, diagnostics: [] });
    return;
  }

  const content = document.getText();
  const config = await fetchRuleConfiguration(uri);

  if (uri.endsWith(".json")) {
    await validateJsonDocument(document, config.ruleSeverities);
    return;
  }

  const { analysis, sourceFile } = analyzeAndParseDocument(uri, content);

  let diagnostics: Diagnostic[] = [];
  try {
    diagnostics = runRules(sourceFile, analysis, {
      enabled: true,
      ruleSeverities: config.ruleSeverities,
      ruleOptions: config.ruleOptions,
    });
  } catch (err) {
    connection.console.error(`[Validation] Rule evaluation error for ${uri}: ${String(err)}`);
  }

  await indexWidgetFile(uri);

  // Send the computed diagnostics to VS Code
  await connection.sendDiagnostics({ uri, diagnostics });
}

// Analyze and validate document content when opened or updated
documents.onDidChangeContent((change) => {
  validateDocument(change.document).catch((err) => connection.console.error(String(err)));
});

documents.onDidOpen((event) => {
  validateDocument(event.document).catch((err) => connection.console.error(String(err)));
});

documents.onDidSave((event) => {
  validateDocument(event.document).catch((err) => connection.console.error(String(err)));
  if (event.document.uri.endsWith("settings.json")) {
    for (const doc of documents.all()) {
      if (doc.uri !== event.document.uri) {
        validateDocument(doc).catch((err) => connection.console.error(String(err)));
      }
    }
  }
});

documents.onDidClose((event) => {
  cleanupDocumentSourceFile(event.document.uri);
});

// Re-validate open documents when workspace configuration changes
connection.onDidChangeConfiguration(async () => {
  connection.console.log("[Config] Workspace settings changed. Revalidating open documents...");
  for (const doc of documents.all()) {
    try {
      await validateDocument(doc);
    } catch (err) {
      connection.console.error(String(err));
    }
  }
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
