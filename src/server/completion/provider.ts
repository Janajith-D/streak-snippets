import { CompletionItem } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SourceFile } from "ts-morph";
import { CompletionContext } from "./types";
import { getFrameworkCompletions } from "./frameworkCompletions";
import { getJsxAttributeCompletions } from "./jsxAttributeCompletions";
import { getScriptCompletions } from "./scriptCompletions";

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
  customPublicDir?: string
): CompletionItem[] {
  return [
    // 1. Streak built-in components (e.g. <WidgetPlaceholder, sfS snippet)
    ...getFrameworkCompletions(context, document, sourceFile),
    // 2. JSX attributes (e.g. id, type, href, as) and attribute values
    ...getJsxAttributeCompletions(context, workspaceRoot, customWidgetDir, customPublicDir),
    // 3. Script callback — gDom methods and loadDynamicComponent IDs
    ...getScriptCompletions(context, workspaceRoot),
  ];
}
export * from "./types";
