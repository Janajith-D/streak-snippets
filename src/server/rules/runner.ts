import { Diagnostic } from "vscode-languageserver/node";
import { SourceFile } from "ts-morph";
import { AnalysisResult } from "../../shared/types";
import { allRules } from "./index";
import { RuleDiagnostic, RuleOptions } from "./types";

export interface RuleEngineConfig {
  enabled: boolean;
  ruleSeverities?: Record<string, string>;
  ruleOptions?: any;
}

/**
 * Executes all registered rules against a parsed document and returns LSP Diagnostics.
 */
export function runRules(
  sourceFile: SourceFile,
  analysis: AnalysisResult,
  config?: RuleEngineConfig
): Diagnostic[] {
  if (config && !config.enabled) {
    return [];
  }

  const allDiagnostics: RuleDiagnostic[] = [];

  for (const rule of allRules) {
    const userSeverity = config?.ruleSeverities?.[rule.id];
    if (userSeverity === "off") {
      continue;
    }

    const options: RuleOptions = {
      enabled: true,
      ruleOptions: config?.ruleOptions,
    };

    const diagnostics = rule.run(sourceFile, analysis, options);
    allDiagnostics.push(...diagnostics);
  }

  // Convert RuleDiagnostic to LSP Diagnostic
  return allDiagnostics.map((d) => ({
    range: d.range,
    severity: d.severity,
    code: d.code,
    source: d.source,
    message: d.message,
  }));
}
