import { CompletionItem, CompletionItemKind, InsertTextFormat } from "vscode-languageserver/node";
import { CompletionContext } from "./types";
import { getDynamicComponentIds } from "./jsxAttributeCompletions";
import { GDOM_METHODS } from "./runtimeApi";

/**
 * Checks if the cursor is currently inside the first argument of a loadDynamicComponent call.
 * e.g., gDom.loadDynamicComponent("
 */
export function isInsideLoadDynamicComponent(text: string, offset: number): boolean {
  const textBeforeCursor = text.slice(0, offset);
  const regex = /(?:[a-zA-Z0-9_]+\.)?loadDynamicComponent\s*\(\s*["']([^"']*)$/;
  return regex.test(textBeforeCursor);
}

/**
 * Determines if the cursor is structurally/textually inside the callback of a <Script> element.
 */
export function isInsideScriptCallback(text: string, offset: number): boolean {
  const textBefore = text.slice(0, offset);
  const lastOpen = textBefore.lastIndexOf("<Script");
  const lastClose = textBefore.lastIndexOf("</Script");

  if (lastOpen === -1 || lastOpen < lastClose) {
    return false;
  }

  const scriptContent = textBefore.slice(lastOpen);
  const callbackStart = scriptContent.match(/\{\s*\(\s*gDom\s*(?::\s*[a-zA-Z0-9_]+)?\s*(?:,\s*[a-zA-Z0-9_]+\s*(?::\s*[a-zA-Z0-9_]+)?)?\s*\)\s*=>\s*\{/);
  if (!callbackStart) {
    return false;
  }

  const callbackStartOffset = lastOpen + callbackStart.index! + callbackStart[0].length;
  if (offset < callbackStartOffset) {
    return false;
  }

  let braceDepth = 1;
  for (let j = callbackStartOffset; j < offset; j++) {
    const char = text[j];
    if (char === "{") {
      braceDepth++;
    } else if (char === "}") {
      braceDepth--;
    }
  }

  return braceDepth > 0;
}

/**
 * Generates completions for gDom methods based on the central runtime API definition.
 */
export function getGDomCompletions(textBeforeCursor: string): CompletionItem[] {
  return GDOM_METHODS.map((method) => ({
    label: method.name,
    kind: CompletionItemKind.Method,
    insertText: `${method.name}(${method.name === "loadDynamicComponent" ? '"$1"' : "$1"})`,
    insertTextFormat: InsertTextFormat.Snippet,
    detail: `${method.signature}: ${method.returnType}`,
    documentation: method.documentation,
  }));
}

export function getScriptCompletions(
  context: CompletionContext,
  workspaceRoot: string | undefined
): CompletionItem[] {
  if (!isInsideScriptCallback(context.text, context.offset)) {
    return [];
  }

  const textBeforeCursor = context.text.slice(0, context.offset);

  // Check if user is typing a property of gDom
  if (/gDom\.([a-zA-Z0-9_]*)$/.test(textBeforeCursor)) {
    return getGDomCompletions(textBeforeCursor);
  }

  // Fallback to loadDynamicComponent ID suggestions if inside its quotes
  if (isInsideLoadDynamicComponent(context.text, context.offset)) {
    const dynamicIds = getDynamicComponentIds(workspaceRoot, context.text);
    return dynamicIds.map((id) => ({
      label: id,
      kind: CompletionItemKind.Value,
      insertText: id,
      detail: "Dynamic component ID",
    }));
  }

  return [];
}
