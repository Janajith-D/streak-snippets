import { Node, SyntaxKind, SourceFile } from "ts-morph";
import { CodeAction, CodeActionKind, Diagnostic } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

// ── Private helpers ───────────────────────────────────────────────────────────

/** Shared builder for simple inline-attribute-insert code actions. */
function buildInlineAttrInsertAction(
  diag: Diagnostic,
  uri: string,
  title: string,
  charOffset: number,
  newText: string
): CodeAction {
  return {
    title,
    kind: CodeActionKind.QuickFix,
    diagnostics: [diag],
    edit: {
      changes: {
        [uri]: [
          {
            range: {
              start: { line: diag.range.start.line, character: diag.range.start.character + charOffset },
              end: { line: diag.range.start.line, character: diag.range.start.character + charOffset },
            },
            newText,
          },
        ],
      },
    },
  };
}

/** streak:S405 — Missing <Script> id */
function buildScriptIdAction(diag: Diagnostic, uri: string): CodeAction {
  return buildInlineAttrInsertAction(diag, uri, 'Add id attribute to <Script>', 7, ' id="my-script"');
}

/** streak:S101 — Missing <WidgetPlaceholder> id */
function buildWidgetIdAction(diag: Diagnostic, uri: string): CodeAction {
  return buildInlineAttrInsertAction(diag, uri, 'Add id attribute to <WidgetPlaceholder>', 18, ' id="placeholder-id"');
}

/** streak:S102 — Missing <WidgetPlaceholder> type */
function buildWidgetTypeAction(diag: Diagnostic, uri: string): CodeAction {
  return buildInlineAttrInsertAction(diag, uri, 'Add type attribute to <WidgetPlaceholder>', 18, ' type="WidgetName"');
}

/** streak:S501 — Missing <Dynamic> id */
function buildDynamicIdAction(diag: Diagnostic, uri: string): CodeAction {
  return buildInlineAttrInsertAction(diag, uri, 'Add id attribute to <Dynamic>', 8, ' id="dynamic-id"');
}

/** streak:S202 — Data handler must be async */
function buildAsyncHandlerAction(
  diag: Diagnostic,
  document: TextDocument,
  sourceFile: SourceFile,
  uri: string
): CodeAction | null {
  const startOffset = document.offsetAt(diag.range.start);
  const node = sourceFile.getDescendantAtPos(startOffset);
  if (!node) {
    return null;
  }

  let fnNode: Node | undefined = node;
  while (
    fnNode &&
    !Node.isFunctionDeclaration(fnNode) &&
    !Node.isArrowFunction(fnNode) &&
    !Node.isFunctionExpression(fnNode)
  ) {
    fnNode = fnNode.getParent();
  }

  if (!fnNode) {
    return null;
  }

  let insertOffset = fnNode.getStart();
  if (Node.isFunctionDeclaration(fnNode)) {
    const functionKeyword = fnNode.getFirstChildByKind(SyntaxKind.FunctionKeyword);
    if (functionKeyword) {
      insertOffset = functionKeyword.getStart();
    }
  }
  const insertPosition = document.positionAt(insertOffset);

  return {
    title: "Make handler async",
    kind: CodeActionKind.QuickFix,
    diagnostics: [diag],
    edit: {
      changes: {
        [uri]: [{ range: { start: insertPosition, end: insertPosition }, newText: "async " }],
      },
    },
  };
}

/** streak:S301 — Missing Default Export */
function buildDefaultExportAction(
  diag: Diagnostic,
  document: TextDocument,
  uri: string
): CodeAction | null {
  let baseName = "";
  try {
    const filePath = fileURLToPath(uri);
    baseName = path.basename(filePath, path.extname(filePath));
  } catch {
    const pathname = uri.substring(uri.lastIndexOf("/") + 1);
    baseName = pathname.substring(0, pathname.lastIndexOf(".")) || pathname;
  }

  if (!baseName) {
    return null;
  }

  const documentEnd = document.positionAt(document.getText().length);
  return {
    title: `Add default export for ${baseName}`,
    kind: CodeActionKind.QuickFix,
    diagnostics: [diag],
    edit: {
      changes: {
        [uri]: [
          {
            range: { start: documentEnd, end: documentEnd },
            newText: `\n\nexport default ${baseName};\n`,
          },
        ],
      },
    },
  };
}

/** Dispatches a single diagnostic to the appropriate code action builder. */
function buildCodeAction(
  diag: Diagnostic,
  document: TextDocument,
  sourceFile: SourceFile,
  uri: string
): CodeAction | null {
  switch (diag.code) {
    case "streak:S405": return buildScriptIdAction(diag, uri);
    case "streak:S101": return buildWidgetIdAction(diag, uri);
    case "streak:S102": return buildWidgetTypeAction(diag, uri);
    case "streak:S501": return buildDynamicIdAction(diag, uri);
    case "streak:S202": return buildAsyncHandlerAction(diag, document, sourceFile, uri);
    case "streak:S301": return buildDefaultExportAction(diag, document, uri);
    default:            return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function resolveCodeActions(
  diagnostics: Diagnostic[],
  document: TextDocument,
  sourceFile: SourceFile
): CodeAction[] {
  const uri = document.uri;
  const codeActions: CodeAction[] = [];

  for (const diag of diagnostics) {
    const action = buildCodeAction(diag, document, sourceFile, uri);
    if (action) {
      codeActions.push(action);
    }
  }

  return codeActions;
}
