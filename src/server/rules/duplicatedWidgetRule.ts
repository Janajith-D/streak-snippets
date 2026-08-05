import { Node, SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { Rule, RuleDiagnostic, RuleOptions } from "./types";
import { widgetRegistry } from "../registry/widgets";
import * as path from "path";

export const duplicatedWidgetRule: Rule = {
  id: "streak:duplicated-widget",
  name: "Duplicated Widget Rule",
  description: "Checks if multiple widget source files in the project declare the same component name.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    const uri = analysis.uri;
    const normalizedUri = uri.replace(/\\/g, "/");
    if (!normalizedUri.includes("src/widgets")) {
      return diagnostics;
    }

    let componentName = "";
    const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
    if (defaultExportSymbol) {
      const decl = defaultExportSymbol.getDeclarations()[0];
      if (decl) {
        if (Node.isExportAssignment(decl)) {
          const expr = decl.getExpression();
          if (expr && Node.isIdentifier(expr)) {
            componentName = expr.getText();
          }
        } else if (Node.isFunctionDeclaration(decl) || Node.isClassDeclaration(decl)) {
          componentName = decl.getName() ?? "";
        }
      }
    }

    if (!componentName) {
      for (const fn of sourceFile.getFunctions()) {
        const name = fn.getName();
        if (name && /^[A-Z]/.test(name)) {
          componentName = name;
          break;
        }
      }
    }

    if (!componentName) {
      const pathname = uri.substring(uri.lastIndexOf("/") + 1);
      const base = pathname.substring(0, pathname.lastIndexOf(".")) || pathname;
      if (/^[A-Z]/.test(base)) {
        componentName = base;
      }
    }

    if (!componentName) {
      return diagnostics;
    }

    const allWidgets = widgetRegistry.getAll();
    const duplicates = allWidgets.filter(
      (w) =>
        w.name === componentName &&
        w.filePath.replace(/\\/g, "/").toLowerCase() !== normalizedUri.toLowerCase()
    );

    if (duplicates.length > 0) {
      const duplicatePaths = duplicates.map((d) => path.basename(d.filePath)).join(", ");
      diagnostics.push({
        code: "streak:S601",
        message: `Duplicated widget component name '${componentName}' detected. Also declared in: ${duplicatePaths}. Component names must be unique across all widget source files.`,
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
