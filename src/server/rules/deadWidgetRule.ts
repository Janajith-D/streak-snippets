import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import { type Rule, type RuleDiagnostic, type RuleOptions } from "./types";
import { sitemapRegistry } from "../registry/sitemaps";

function getComponentDefaultName(sourceFile: SourceFile): string | undefined {
  const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
  if (!defaultExportSymbol) {
    return undefined;
  }
  const decl = defaultExportSymbol.getDeclarations()[0];
  if (!decl) {
    return undefined;
  }
  if (Node.isExportAssignment(decl)) {
    const expr = decl.getExpression();
    if (expr && Node.isIdentifier(expr)) {
      return expr.getText();
    }
  } else if (Node.isFunctionDeclaration(decl) || Node.isClassDeclaration(decl)) {
    return decl.getName();
  }
  return undefined;
}

export const deadWidgetRule: Rule = {
  id: "streak:dead-widget",
  name: "Dead Widget Rule",
  description:
    "Ensures custom widgets are referenced by at least one page in the sitemap.",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.isWidget) {
      return diagnostics;
    }

    const componentName = getComponentDefaultName(sourceFile);
    if (!componentName) {
      return diagnostics;
    }

    const pages = sitemapRegistry.getPages();
    if (pages.length === 0) {
      return diagnostics;
    }

    const isReferenced = pages.some((p) =>
      p.widgets.some((w) => w.type === componentName),
    );

    if (!isReferenced) {
      diagnostics.push({
        code: "streak:S904",
        message: "Widget is not referenced by any sitemap page.",
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
