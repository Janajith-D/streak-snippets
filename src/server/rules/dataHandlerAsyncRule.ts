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

export const dataHandlerAsyncRule: Rule = {
  id: "streak:data-handler-async",
  name: "Data Handler Must Be Async",
  description: "Ensures Streak data handler functions are declared async.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    const functions = sourceFile.getFunctions();
    const arrowFuncs = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
    const funcExprs = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression);

    const candidateFuncs: any[] = [];
    for (const fn of functions) {
      if (fn.isDefaultExport() || fn.isExported() || /Data|Handler/.test(fn.getName() ?? "")) {
        candidateFuncs.push(fn);
      }
    }

    for (const expr of [...arrowFuncs, ...funcExprs]) {
      const parent = expr.getParent();
      const parentName = parent?.getKind() === SyntaxKind.VariableDeclaration ? (parent as any).getName() : "";
      const isExported = parent?.getParent()?.getParent()?.getKind() === SyntaxKind.ExportAssignment ||
                         parent?.getParent()?.getParent()?.getKind() === SyntaxKind.VariableStatement;

      if (isExported || /Data|Handler/.test(parentName)) {
        candidateFuncs.push(expr);
      }
    }

    for (const fn of candidateFuncs) {
      if (!fn.isAsync()) {
        const range = getRangeFromNode(sourceFile, fn);
        diagnostics.push({
          code: "streak:S202",
          message: "Data handlers must default-export an 'async' function.",
          range,
          severity,
          source: "Streak Engine",
        });
      }
    }

    return diagnostics;
  },
};
