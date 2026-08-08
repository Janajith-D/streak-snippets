import { SyntaxKind, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

export const unsafeWidgetDataAccessRule: Rule = {
  id: "streak:unsafe-widget-data-access",
  name: "Unsafe Widget Data Access",
  description:
    "Ensures widget data is accessed safely because props.data may be undefined.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = analysis.isWidget ? DiagnosticSeverity.Warning : (options?.severity ?? this.defaultSeverity);

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    const propAccesses = sourceFile.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    );
    for (const pa of propAccesses) {
      const exprText = pa.getExpression().getText();

      if (exprText === "props.data" || exprText === "data") {
        // Check if property access uses optional chaining ?.
        const isOptionalChain = pa.hasQuestionDotToken();

        if (!isOptionalChain) {
          const range = getRangeFromNode(sourceFile, pa);
          const message = analysis.isWidget
            ? "Use optional chaining when accessing widget data."
            : `Unsafe access '${pa.getText()}'. Widget data must be accessed safely because 'props.data' may be undefined (use optional chaining e.g. 'props.data?.${pa.getName()}').`;

          diagnostics.push({
            code: "streak:S303",
            message,
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
