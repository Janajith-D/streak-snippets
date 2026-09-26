import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import { getDefaultExportedHandler, isDataHandlerFile } from "./dataHandlerUtils";
import { getRangeFromNode, type Rule, type RuleDiagnostic, type RuleOptions } from "./types";

function returnsStatus(fn: Node): boolean {
  const objectLiterals = fn.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
  for (const obj of objectLiterals) {
    const properties = obj.getProperties();
    for (const prop of properties) {
      const propName =
        Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)
          ? prop.getName()
          : prop.getText();
      if (propName === "status") {
        return true;
      }
    }
  }
  return false;
}

export const dataHandlerStatusRule: Rule = {
  id: "streak:data-handler-status",
  name: "Data Handler Status Check",
  description:
    "Ensures Streak default-exported data handler function returns an object with a 'status' property (e.g. status: 200).",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    const rawPath = analysis.uri || sourceFile.getFilePath();
    if (!isDataHandlerFile(rawPath)) {
      return diagnostics;
    }

    const handler = getDefaultExportedHandler(sourceFile);
    if (!handler) {
      return diagnostics;
    }

    if (!returnsStatus(handler)) {
      const range = getRangeFromNode(sourceFile, handler);
      diagnostics.push({
        code: "streak:S201",
        message:
          "Streak data handler should return an object containing a 'status' property (e.g. status: 200).",
        range,
        severity,
        source: "Streak Engine",
      });
    }

    return diagnostics;
  },
};
