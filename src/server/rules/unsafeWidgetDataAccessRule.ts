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

export const unsafeWidgetDataAccessRule: Rule = {
  id: "streak:unsafe-widget-data-access",
  name: "Unsafe Widget Data Access",
  description: "Ensures widget data is accessed safely because props.data may be undefined.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    for (const pa of propAccesses) {
      const exprText = pa.getExpression().getText();

      if (exprText === "props.data" || exprText === "data") {
        // Check if property access uses optional chaining ?.
        const hasQuestionDot = (pa as any).hasQuestionDotToken ? (pa as any).hasQuestionDotToken() : false;
        const isOptionalChain = pa.getKind() === SyntaxKind.PropertyAccessExpression && hasQuestionDot;

        if (!isOptionalChain) {
          const range = getRangeFromNode(sourceFile, pa);
          diagnostics.push({
            code: "streak:S303",
            message: `Unsafe access '${pa.getText()}'. Widget data must be accessed safely because 'props.data' may be undefined (use optional chaining e.g. 'props.data?.${pa.getName()}').`,
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
