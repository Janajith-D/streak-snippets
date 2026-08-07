import type { SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import type { Rule, RuleDiagnostic, RuleOptions } from "./types";

export const missingDefaultExportRule: Rule = {
  id: "streak:missing-default-export",
  name: "Missing Default Export Rule",
  description: "Ensures Streak framework files have a default export.",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    const hasDefaultExport = analysis.exports.some((e) => e.isDefault);

    if (!hasDefaultExport && sourceFile.getStatements().length > 0) {
      // Create diagnostic for the first line of the file
      diagnostics.push({
        code: "streak:S301",
        message: "File is missing a default export (export default ...).",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 20 },
        },
        severity,
        source: "Streak Engine",
      });
    }

    return diagnostics;
  },
};
