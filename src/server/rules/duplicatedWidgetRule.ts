import { Node, SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { Rule, RuleDiagnostic, RuleOptions } from "./types";
import { widgetRegistry } from "../registry/widgets";
import * as path from "node:path";

/**
 * Extracts the component name from a default export symbol, if one exists.
 * Extracted to reduce cognitive complexity of resolveWidgetComponentName.
 */
function getDefaultExportComponentName(sourceFile: SourceFile): string | undefined {
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
    return decl.getName() ?? "";
  }
  return undefined;
}

/**
 * Resolves the component name from a source file using three fallback strategies:
 * 1. Default export symbol
 * 2. First PascalCase function
 * 3. Basename from the URI
 *
 * Extracted to reduce cognitive complexity of the `run` method.
 */
function resolveWidgetComponentName(sourceFile: SourceFile, uri: string): string {
  const defaultName = getDefaultExportComponentName(sourceFile);
  if (defaultName) {
    return defaultName;
  }

  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name && /^[A-Z]/.test(name)) {
      return name;
    }
  }

  const pathname = uri.substring(uri.lastIndexOf("/") + 1);
  const base = pathname.substring(0, pathname.lastIndexOf(".")) || pathname;
  return /^[A-Z]/.test(base) ? base : "";
}

export const duplicatedWidgetRule: Rule = {
  id: "streak:duplicated-widget",
  name: "Duplicated Widget Rule",
  description: "Checks if multiple widget source files in the project declare the same component name.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    const uri = analysis.uri;
    const normalizedUri = uri.replaceAll("\\", "/");
    const customWidgetDir = options?.ruleOptions?.widgetDirectory || "src/widgets";
    const normalizedWidgetDir = customWidgetDir.replaceAll("\\", "/");
    if (!normalizedUri.includes(normalizedWidgetDir)) {
      return diagnostics;
    }

    const componentName = resolveWidgetComponentName(sourceFile, uri);
    if (!componentName) {
      return diagnostics;
    }

    const allWidgets = widgetRegistry.getAll();
    const duplicates = allWidgets.filter(
      (w) =>
        w.name === componentName &&
        w.filePath.replaceAll("\\", "/").toLowerCase() !== normalizedUri.toLowerCase()
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
