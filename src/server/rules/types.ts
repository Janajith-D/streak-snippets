import { DiagnosticSeverity } from "vscode-languageserver/node";
import { SourceFile } from "ts-morph";
import { AnalysisResult } from "../../shared/types";

export interface RangeLocation {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface RuleDiagnostic {
  message: string;
  range: RangeLocation;
  severity: DiagnosticSeverity;
  code: string;
  source: string;
}

export interface RuleOptions {
  enabled: boolean;
  severity?: DiagnosticSeverity;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  defaultSeverity: DiagnosticSeverity;
  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions
  ): RuleDiagnostic[];
}
