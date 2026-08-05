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
  const completions: CompletionItem[] = [];

  // 1. Check for Streak built-in components (e.g. <WidgetPlaceholder)
  completions.push(...getFrameworkCompletions(context, document, sourceFile));

  // 2. Check for JSX attributes (e.g. id, type, href, as) and attribute values
  completions.push(...getJsxAttributeCompletions(context, workspaceRoot, customWidgetDir, customPublicDir));

  // 3. Check for Script callback loadDynamicComponent completions
  completions.push(...getScriptCompletions(context, workspaceRoot));

  return completions;
}
export * from "./types";
