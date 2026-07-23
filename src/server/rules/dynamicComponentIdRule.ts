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

export const dynamicComponentIdRule: Rule = {
  id: "streak:invalid-dynamic-component-id",
  name: "Invalid Dynamic Component ID",
  description: "Ensures <Dynamic> components have a static, non-empty 'id' attribute.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

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

      if (tagName === "Dynamic") {
        let hasValidId = false;

        for (const attr of attributes) {
          if (attr.getKind() === SyntaxKind.JsxAttribute) {
            const attrName = attr.getNameNode()?.getText();
            const initializer = attr.getInitializer();

            if (attrName === "id" && initializer) {
              if (initializer.getKind() === SyntaxKind.StringLiteral) {
                const val = initializer.getLiteralValue();
                if (val && val.trim().length > 0) {
                  hasValidId = true;
                }
              }
            }
          }
        }

        if (!hasValidId) {
          const range = getRangeFromNode(sourceFile, node);
          diagnostics.push({
            code: "streak:S501",
            message: "<Dynamic> component must have a static, non-empty 'id' attribute.",
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
