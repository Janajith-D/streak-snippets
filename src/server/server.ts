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
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  analyzeAndParseDocument,
  cleanupDocumentSourceFile,
} from "./parser/analyzer";
import { runRules } from "./rules/runner";
import { getCompletions } from "./completion/provider";
import { resolveHover, resolveSitemapHover } from "./hover/provider";
import { resolveDefinition, resolveSitemapDefinition } from "./definition/provider";
import { resolveCodeActions } from "./codeaction/provider";
import { scanWorkspace, scanFile } from "./registry/scanner";
import { widgetRegistry } from "./registry/widgets";
import { sitemapRegistry } from "./registry/sitemaps";
import { validateSitemap } from "./rules/sitemapRules";
import { Node } from "ts-morph";
import * as fs from "node:fs";

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
  if (!document || (uri.endsWith(".json") && !uri.endsWith("sitemap.json"))) {
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
  if (!document || (uri.endsWith(".json") && !uri.endsWith("sitemap.json"))) {
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

  if (uri.endsWith(".json")) {
    if (uri.endsWith("sitemap.json")) {
      if (!workspaceRoot) {
        return null;
      }
      sitemapRegistry.parseAndRegister(document.uri, document.getText());
      return resolveSitemapHover(document, offset, workspaceRoot);
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
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document) {
    return null;
  }
  const offset = document.offsetAt(params.position);

  if (uri.endsWith(".json")) {
    if (uri.endsWith("sitemap.json")) {
      if (!workspaceRoot) {
        return null;
      }
      sitemapRegistry.parseAndRegister(document.uri, document.getText());
      let customWidgetDir: string | undefined;
      try {
        const streakSettings =
          (await connection.workspace.getConfiguration("streak")) as StreakSettings;
        customWidgetDir = streakSettings?.snippets?.widgetDirectory;
      } catch {
        /* ignore */
      }
      return resolveSitemapDefinition(document, offset, workspaceRoot, customWidgetDir);
    }
    return null;
  }

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
            Range.create(
              sitemapDoc.positionAt(w.start),
              sitemapDoc.positionAt(w.end),
            ),
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
          range: Range.create(
            sitemapDoc.positionAt(w.start),
            sitemapDoc.positionAt(w.end),
          ),
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
  if (!document) {
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
  if (!document) {
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
      duplicateRoute: "streak:duplicate-route",
      missingWidget: "streak:missing-widget",
      missingHandler: "streak:missing-handler",
      deadWidget: "streak:dead-widget",
      duplicateRenderId: "streak:duplicate-render-id",
      missingLayout: "streak:missing-layout",
      invalidLoadingStrategy: "streak:invalid-loading-strategy",
      passiveEventListener: "streak:passive-event-listener",
      dataHandlerWidgetKey: "streak:data-handler-widget-key",
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

async function indexWidgetFile(uri: string): Promise<void> {
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
}

async function validateDocument(document: TextDocument): Promise<void> {
  const uri = document.uri;
  const content = document.getText();

  connection.console.log(`[Validation] Running diagnostics for: ${uri}`);

  let config = { ruleSeverities: {} as Record<string, string>, ruleOptions: {} as Record<string, unknown> };
  try {
    const streakSettings =
      (await connection.workspace.getConfiguration("streak")) as StreakSettings;
    config = buildRuleConfiguration(streakSettings);
  } catch (err) {
    connection.console.log(`Failed to fetch configurations: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (uri.endsWith(".json")) {
    if (uri.endsWith("sitemap.json")) {
      if (workspaceRoot) {
        const diagnostics = validateSitemap(document, workspaceRoot, config.ruleSeverities);
        await connection.sendDiagnostics({ uri, diagnostics });

        // Re-validate other open documents to update S904 dead widget warnings
        for (const doc of documents.all()) {
          if (doc.uri !== uri && doc.uri.endsWith(".tsx")) {
            // Avoid infinite recursion by not calling validateDocument synchronously in a loop
            setTimeout(() => {
              validateDocument(doc).catch((_err) => {
                // ignore validation failure
              });
            }, 50);
          }
        }
      }
    } else {
      // Clear any diagnostics for non-sitemap JSON files (e.g. package.json, tsconfig.json)
      await connection.sendDiagnostics({ uri, diagnostics: [] });
    }
    return;
  }

  const { analysis, sourceFile } = analyzeAndParseDocument(uri, content);

  await indexWidgetFile(uri);

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
