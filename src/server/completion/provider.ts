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

  // 2. Feature 10 — Sitemap Completion (streak-page snippet)
  const word = textBefore.split(/\W/).at(-1) ?? "";
  if ("streak-page".startsWith(word) || word === "streak-page") {
    completions.push({
      label: "streak-page",
      kind: CompletionItemKind.Snippet,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: [
        "{",
        '  "url": "/${1:path}",',
        '  "handler": "${2:handler}",',
        '  "widgets": [',
        "    {",
        '      "type": "${3:WidgetName}"',
        "    }",
        "  ]",
        "}"
      ].join("\n"),
      detail: "Streak Page Entry (streak-page)",
      documentation: "Insert a sitemap page route definition template.",
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
  if (context.uri.endsWith("streak.sitemap.json")) {
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
