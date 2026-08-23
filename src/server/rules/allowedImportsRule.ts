import type { SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
  getRangeFromNode,
} from "./types";

function isInternalPathImport(specifier: string): boolean {
  if (specifier.startsWith(".")) {
    return true;
  }
  if (
    specifier.startsWith("@/") ||
    specifier.startsWith("~/") ||
    specifier.startsWith("#")
  ) {
    return true;
  }
  // Recognize common directory path aliases with @
  return /^@(components|widgets|layouts|layout|handlers|handler|pages|page|utils|lib|app|src|hooks|services|styles|assets|common|core|features|shared|modules|config|constants|helpers)\b/i.test(
    specifier,
  );
}

export const allowedImportsRule: Rule = {
  id: "streak:allowed-imports",
  name: "Allowed Imports Rule",
  description:
    "Ensures files only import approved modules from the allowed imports whitelist.",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(
    sourceFile: SourceFile,
    _analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;
    const allowed: string[] = (options?.ruleOptions?.allowedImports as
      string[] | undefined) ?? [
      "streak-forge/components",
      "bun:test",
    ];

    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
      const moduleSpecifier = imp.getModuleSpecifierValue();

      if (isInternalPathImport(moduleSpecifier)) {
        continue;
      }

      if (!allowed.includes(moduleSpecifier)) {
        diagnostics.push({
          code: "streak:S701",
          message: `Importing unapproved module '${moduleSpecifier}' is not allowed by configuration. Approved modules: ${allowed.join(", ")}.`,
          range: getRangeFromNode(sourceFile, imp.getModuleSpecifier()),
          severity,
          source: "Streak Engine",
          data: { moduleSpecifier },
        });
      }
    }

    return diagnostics;
  },
};

