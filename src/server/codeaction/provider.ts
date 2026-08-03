import { Node, SyntaxKind, SourceFile } from "ts-morph";
import { CodeAction, CodeActionKind, Diagnostic, TextEdit } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "url";
import * as path from "path";

export function resolveCodeActions(
  diagnostics: Diagnostic[],
  document: TextDocument,
  sourceFile: SourceFile
): CodeAction[] {
  const codeActions: CodeAction[] = [];
  const uri = document.uri;

  for (const diag of diagnostics) {
    const startOffset = document.offsetAt(diag.range.start);
    const node = sourceFile.getDescendantAtPos(startOffset);

    // 1. streak:S405 - Missing <Script> id
    if (diag.code === "streak:S405") {
      codeActions.push({
        title: "Add id attribute to <Script>",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: { line: diag.range.start.line, character: diag.range.start.character + 7 },
                  end: { line: diag.range.start.line, character: diag.range.start.character + 7 },
                },
                newText: ' id="my-script"',
              },
            ],
          },
        },
      });
    }

    // 2. streak:S101 - Missing <WidgetPlaceholder> id
    if (diag.code === "streak:S101") {
      codeActions.push({
        title: "Add id attribute to <WidgetPlaceholder>",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: { line: diag.range.start.line, character: diag.range.start.character + 18 },
                  end: { line: diag.range.start.line, character: diag.range.start.character + 18 },
                },
                newText: ' id="placeholder-id"',
              },
            ],
          },
        },
      });
    }

    // 3. streak:S102 - Missing <WidgetPlaceholder> type
    if (diag.code === "streak:S102") {
      codeActions.push({
        title: "Add type attribute to <WidgetPlaceholder>",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: { line: diag.range.start.line, character: diag.range.start.character + 18 },
                  end: { line: diag.range.start.line, character: diag.range.start.character + 18 },
                },
                newText: ' type="WidgetName"',
              },
            ],
          },
        },
      });
    }

    // 4. streak:S501 - Missing <Dynamic> id
    if (diag.code === "streak:S501") {
      codeActions.push({
        title: "Add id attribute to <Dynamic>",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [uri]: [
              {
                range: {
                  start: { line: diag.range.start.line, character: diag.range.start.character + 8 },
                  end: { line: diag.range.start.line, character: diag.range.start.character + 8 },
                },
                newText: ' id="dynamic-id"',
              },
            ],
          },
        },
      });
    }

    // 5. streak:S202 - Data handler must be async
    if (diag.code === "streak:S202" && node) {
      // Find the function declaration, arrow function, or function expression node
      let fnNode: Node | undefined = node;
      while (
        fnNode &&
        !Node.isFunctionDeclaration(fnNode) &&
        !Node.isArrowFunction(fnNode) &&
        !Node.isFunctionExpression(fnNode)
      ) {
        fnNode = fnNode.getParent();
      }

      if (fnNode) {
        let insertOffset = fnNode.getStart();
        if (Node.isFunctionDeclaration(fnNode)) {
          const functionKeyword = fnNode.getFirstChildByKind(SyntaxKind.FunctionKeyword);
          if (functionKeyword) {
            insertOffset = functionKeyword.getStart();
          }
        }
        const insertPosition = document.positionAt(insertOffset);

        codeActions.push({
          title: "Make handler async",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diag],
          edit: {
            changes: {
              [uri]: [
                {
                  range: {
                    start: insertPosition,
                    end: insertPosition,
                  },
                  newText: "async ",
                },
              ],
            },
          },
        });
      }
    }

    // 6. streak:S301 - Missing Default Export
    if (diag.code === "streak:S301") {
      try {
        const filePath = fileURLToPath(uri);
        const baseName = path.basename(filePath, path.extname(filePath));
        const documentEnd = document.positionAt(document.getText().length);

        codeActions.push({
          title: `Add default export for ${baseName}`,
          kind: CodeActionKind.QuickFix,
          diagnostics: [diag],
          edit: {
            changes: {
              [uri]: [
                {
                  range: {
                    start: documentEnd,
                    end: documentEnd,
                  },
                  newText: `\n\nexport default ${baseName};\n`,
                },
              ],
            },
          },
        });
      } catch {
        // Ignore errors
      }
    }
  }

  return codeActions;
}
