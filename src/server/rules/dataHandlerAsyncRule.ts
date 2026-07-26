import { Node, SourceFile, SyntaxKind } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { getRangeFromNode, Rule, RuleDiagnostic, RuleOptions } from "./types";

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

    const candidateFuncs: Node[] = [];
    for (const fn of functions) {
      if (fn.isDefaultExport() || fn.isExported() || /Data|Handler/.test(fn.getName() ?? "")) {
        candidateFuncs.push(fn);
      }
    }

    for (const expr of [...arrowFuncs, ...funcExprs]) {
      const parent = expr.getParent();
      let parentName = "";
      if (parent && Node.isVariableDeclaration(parent)) {
        parentName = parent.getName();
      }
      const isExported = parent?.getParent()?.getParent()?.getKind() === SyntaxKind.ExportAssignment ||
                         parent?.getParent()?.getParent()?.getKind() === SyntaxKind.VariableStatement;

      if (isExported || /Data|Handler/.test(parentName)) {
        candidateFuncs.push(expr);
      }
    }

    for (const fn of candidateFuncs) {
      if (
        (Node.isFunctionDeclaration(fn) || Node.isArrowFunction(fn) || Node.isFunctionExpression(fn)) &&
        !fn.isAsync()
      ) {
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

