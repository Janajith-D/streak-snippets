import { SourceFile, SyntaxKind } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { RangeLocation, Rule, RuleDiagnostic, RuleOptions } from "./types";

function getRangeFromNode(sourceFile: SourceFile, node: any): RangeLocation {
  const startPos = sourceFile.getLineAndColumnAtPos(node.getStart());
  const endPos = sourceFile.getLineAndColumnAtPos(node.getEnd());
  return {
    start: { line: Math.max(0, startPos.line - 1), character: Math.max(0, startPos.column - 1) },
    end: { line: Math.max(0, endPos.line - 1), character: Math.max(0, endPos.column - 1) },
  };
}

export const widgetPlaceholderRule: Rule = {
  id: "streak:widget-placeholder-props",
  name: "WidgetPlaceholder Props Rule",
  description: "Ensures <WidgetPlaceholder> elements have required non-empty 'id' and 'type' props.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    sourceFile.forEachDescendant((node) => {
      let tagName = "";
      let attributes: any[] = [];

      if (node.getKind() === SyntaxKind.JsxSelfClosingElement) {
        const selfClosing = node as any;
        tagName = selfClosing.getTagNameNode().getText();
        attributes = selfClosing.getAttributes();
      } else if (node.getKind() === SyntaxKind.JsxElement) {
        const opening = (node as any).getOpeningElement();
        tagName = opening.getTagNameNode().getText();
        attributes = opening.getAttributes();
      }

      if (tagName === "WidgetPlaceholder") {
        let hasId = false;
        let hasType = false;

        for (const attr of attributes) {
          if (attr.getKind() === SyntaxKind.JsxAttribute) {
            const attrName = attr.getNameNode()?.getText();
            const initializer = attr.getInitializer();

            let value = "";
            if (initializer) {
              if (initializer.getKind() === SyntaxKind.StringLiteral) {
                value = initializer.getLiteralValue();
              } else {
                value = initializer.getText();
              }
            }

            if (attrName === "id") {
              if (value && value.trim() !== '""' && value.trim() !== "''") {
                hasId = true;
              }
            } else if (attrName === "type") {
              if (value && value.trim() !== '""' && value.trim() !== "''") {
                hasType = true;
              }
            }
          }
        }

        const range = getRangeFromNode(sourceFile, node);

        if (!hasId) {
          diagnostics.push({
            code: "streak:S101",
            message: "<WidgetPlaceholder> requires a non-empty 'id' attribute.",
            range,
            severity,
            source: "Streak Engine",
          });
        }

        if (!hasType) {
          diagnostics.push({
            code: "streak:S102",
            message: "<WidgetPlaceholder> requires a non-empty 'type' attribute.",
            range,
            severity,
            source: "Streak Engine",
          });
        }
      }
    });

    return diagnostics;
  },
};
