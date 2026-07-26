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

export const dataHandlerStatusRule: Rule = {
  id: "streak:data-handler-status",
  name: "Data Handler Status Check",
  description: "Ensures Streak data handler functions return an object with a 'status' property (e.g. status: 200).",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    // Only apply to .ts files (data handlers), not .tsx components
    if (analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    // Find handler functions (functions exported as default or named get*Data / *Handler)
    const functions = sourceFile.getFunctions();
    const arrowFuncs = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);

    // Collect all candidate handler functions
    const candidateFuncs: any[] = [];
    for (const fn of functions) {
      if (fn.isDefaultExport() || fn.isExported() || /Data|Handler/.test(fn.getName() ?? "")) {
        candidateFuncs.push(fn);
      }
    }

    for (const arrowFn of arrowFuncs) {
      const parent = arrowFn.getParent();
      const parentName = parent?.getKind() === SyntaxKind.VariableDeclaration ? (parent as any).getName() : "";
      const isExported = parent?.getParent()?.getParent()?.getKind() === SyntaxKind.ExportAssignment ||
                         parent?.getParent()?.getParent()?.getKind() === SyntaxKind.VariableStatement;

      if (isExported || /Data|Handler/.test(parentName)) {
        candidateFuncs.push(arrowFn);
      }
    }

    if (candidateFuncs.length === 0) {
      return diagnostics;
    }

    for (const fn of candidateFuncs) {
      let returnsStatus = false;

      // Check object literals inside return statements or arrow bodies
      const objectLiterals = fn.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
      for (const obj of objectLiterals) {
        const properties = obj.getProperties();
        for (const prop of properties) {
          const propName = prop.getName ? prop.getName() : prop.getText();
          if (propName === "status") {
            returnsStatus = true;
            break;
          }
        }
        if (returnsStatus) {
          break;
        }
      }

      if (!returnsStatus) {
        const range = getRangeFromNode(sourceFile, fn);
        diagnostics.push({
          code: "streak:S201",
          message: "Streak data handler should return an object containing a 'status' property (e.g. status: 200).",
          range,
          severity,
          source: "Streak Engine",
        });
      }
    }

    return diagnostics;
  },
};
