import { type CompletionItem, CompletionItemKind, InsertTextFormat } from "vscode-languageserver/node";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { type SourceFile } from "ts-morph";
import { type CompletionContext } from "./types";
import { getFrameworkCompletions } from "./frameworkCompletions";
import { getJsxAttributeCompletions } from "./jsxAttributeCompletions";
import { getScriptCompletions } from "./scriptCompletions";
import { widgetRegistry } from "../registry/widgets";

function getSitemapCompletions(
  context: CompletionContext,
): CompletionItem[] {
  const completions: CompletionItem[] = [];
  const textBefore = context.text.substring(0, context.offset);

  // 1. Feature 1 — Widget Type Completion
  if (/"type"\s*:\s*"[^"]*$/.test(textBefore)) {
    const widgets = widgetRegistry.getAll();
    for (const w of widgets) {
      completions.push({
        label: w.name,
        kind: CompletionItemKind.Class,
        detail: `Widget Component: ${w.name}`,
        documentation: w.docComment || `Custom widget defined in src/widgets/${w.name}.tsx`,
      });
    }
    return completions;
  }

  // 2. Feature: Widget entry snippet (sf-widget)
  const word = textBefore.split(/[\s,{}[\]"]/).at(-1) ?? "";
  if ("sf-widget".startsWith(word) || word === "sf-widget") {
    completions.push({
      label: "sf-widget",
      kind: CompletionItemKind.Snippet,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: [
        "{",
        '  "id": "${1:WidgetId}",',
        '  "type": "${2:WidgetType}"',
        "}"
      ].join("\n"),
      detail: "Streak Widget entry",
      documentation: "Insert a sitemap widget configuration entry.",
    });
  }

  // 3. Feature: Sitemap template snippet (sf-sitemap)
  if ("sf-sitemap".startsWith(word) || word === "sf-sitemap") {
    completions.push({
      label: "sf-sitemap",
      kind: CompletionItemKind.Snippet,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: [
        "[",
        "  {",
        '    "url": "/${1:}",',
        '    "renderConfig": {',
        '      "renderId": "${2:homeRenderId}",',
        '      "metadata": {},',
        '      "dataHandler": "${3:HomeDataHandler}",',
        '      "rootLayout": "${4:MainLayout}",',
        '      "widgets": [',
        '        { "id": "PageHead",     "type": "PageHead" },',
        '        { "id": "HelloBanner",  "type": "HelloBanner" },',
        '        { "id": "HelloMessage", "type": "HelloMessage", "loadingStrategy": "lazy" }',
        "      ],",
        '      "version": "1.0.0"',
        "    }",
        "  }",
        "]"
      ].join("\n"),
      detail: "Streak Sitemap",
      documentation: "Insert a full sitemap sample configuration.",
    });
  }

  return completions;
}

/**
 * Orchestrator for all LSP auto-completion requests.
 * Evaluates context and delegates to specialized completion providers.
 */
export function getCompletions(
  context: CompletionContext,
  document: TextDocument,
  sourceFile: SourceFile,
  workspaceRoot: string | undefined,
  customWidgetDir?: string,
  customPublicDir?: string,
): CompletionItem[] {
  if (context.uri.endsWith("sitemap.json")) {
    return getSitemapCompletions(context);
  }

  return [
    // 1. Streak built-in components (e.g. <WidgetPlaceholder, sfS snippet)
    ...getFrameworkCompletions(context, document, sourceFile),
    // 2. JSX attributes (e.g. id, type, href, as) and attribute values
    ...getJsxAttributeCompletions(
      context,
      workspaceRoot,
      customWidgetDir,
      customPublicDir,
    ),
    // 3. Script callback — gDom methods and loadDynamicComponent IDs
    ...getScriptCompletions(context, workspaceRoot),
  ];
}
export * from "./types";
