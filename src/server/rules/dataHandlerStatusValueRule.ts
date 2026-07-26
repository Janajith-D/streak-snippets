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

export const dataHandlerStatusValueRule: Rule = {
  id: "streak:invalid-handler-status",
  name: "Invalid Handler Status",
  description: "Ensures data handler status property is a valid HTTP status code (e.g. 200, 404, 500).",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    const objectLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
    for (const obj of objectLiterals) {
      for (const prop of obj.getProperties()) {
        if (prop.getKind() === SyntaxKind.PropertyAssignment) {
          const propAssignment = prop as any;
          const propName = propAssignment.getName();

          if (propName === "status") {
            const initializer = propAssignment.getInitializer();
            let isValidStatus = true;

            if (initializer?.getKind() === SyntaxKind.NumericLiteral) {
              const val = Number(initializer.getText());
              if (val < 100 || val > 599) {
                isValidStatus = false;
              }
            } else {
              // Non-numeric literal or invalid expression
              isValidStatus = false;
            }

            if (!isValidStatus) {
              const range = getRangeFromNode(sourceFile, propAssignment);
              diagnostics.push({
                code: "streak:S203",
                message: "Data handler 'status' should be a valid numeric HTTP status code (100–599, e.g. 200, 404, 500).",
                range,
                severity,
                source: "Streak Engine",
              });
            }
          }
        }
      }
    }

    return diagnostics;
  },
};
