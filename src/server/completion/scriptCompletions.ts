import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import { CompletionContext } from "./types";
import { getDynamicComponentIds } from "./jsxAttributeCompletions";

/**
 * Checks if the cursor is currently inside the first argument of a loadDynamicComponent call.
 * e.g., gDom.loadDynamicComponent("
 */
export function isInsideLoadDynamicComponent(text: string, offset: number): boolean {
  // Grab text from start up to cursor
  const textBeforeCursor = text.slice(0, offset);
  
  // Regex to check if the string ends with a loadDynamicComponent call start
  // e.g. gDom.loadDynamicComponent(" or loadDynamicComponent('
  const regex = /(?:[a-zA-Z0-9_]+\.)?loadDynamicComponent\s*\(\s*["']([^"']*)$/;
  return regex.test(textBeforeCursor);
}

export function getScriptCompletions(
  context: CompletionContext,
  workspaceRoot: string | undefined
): CompletionItem[] {
  if (!isInsideLoadDynamicComponent(context.text, context.offset)) {
    return [];
  }

  // Get dynamic component IDs to suggest
  const dynamicIds = getDynamicComponentIds(workspaceRoot, context.text);
  
  return dynamicIds.map((id) => ({
    label: id,
    kind: CompletionItemKind.Value,
    insertText: id,
    detail: "Dynamic component ID",
  }));
}
