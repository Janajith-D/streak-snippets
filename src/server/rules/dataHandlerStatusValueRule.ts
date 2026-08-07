import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

function validateStatusProperty(prop: Node): boolean {
  if (!Node.isPropertyAssignment(prop) || prop.getName() !== "status") {
    return true;
  }
  const initializer = prop.getInitializer();
  if (initializer && Node.isNumericLiteral(initializer)) {
    const val = Number(initializer.getText());
    return val >= 100 && val <= 599;
  }
  return false;
}

export const dataHandlerStatusValueRule: Rule = {
  id: "streak:invalid-handler-status",
  name: "Invalid Handler Status",
  description:
    "Ensures data handler status property is a valid HTTP status code (e.g. 200, 404, 500).",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    const objectLiterals = sourceFile.getDescendantsOfKind(
      SyntaxKind.ObjectLiteralExpression,
    );
    for (const obj of objectLiterals) {
      for (const prop of obj.getProperties()) {
        if (!validateStatusProperty(prop)) {
          const range = getRangeFromNode(sourceFile, prop);
          diagnostics.push({
            code: "streak:S203",
            message:
              "Data handler 'status' should be a valid numeric HTTP status code (100–599, e.g. 200, 404, 500).",
            range,
            severity,
            source: "Streak Engine",
          });
        }
      }
    }

    return diagnostics;
  },
};
