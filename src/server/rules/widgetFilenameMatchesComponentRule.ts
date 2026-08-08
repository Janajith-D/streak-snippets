import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";
import * as path from "node:path";

export const widgetFilenameMatchesComponentRule: Rule = {
  id: "streak:widget-filename-matches-component",
  name: "Widget Filename Matches Component",
  description:
    "Ensures the widget filename matches the declared component name.",
  defaultSeverity: DiagnosticSeverity.Error,

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

    const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
    if (!defaultExportSymbol) {
      return diagnostics; // Handled by S301 missing default export
    }

    const decl = defaultExportSymbol.getDeclarations()[0];
    if (!decl) {
      return diagnostics;
    }

    let componentName: string | undefined;
    let nodeToRange: Node = decl;

    if (Node.isExportAssignment(decl)) {
      const expr = decl.getExpression();
      if (expr && Node.isIdentifier(expr)) {
        componentName = expr.getText();
        nodeToRange = expr;
      }
    } else if (
      Node.isFunctionDeclaration(decl) ||
      Node.isClassDeclaration(decl)
    ) {
      componentName = decl.getName();
      nodeToRange = decl.getNameNode() ?? decl;
    }

    if (componentName) {
      const fileName = path.basename(analysis.uri, path.extname(analysis.uri));
      if (componentName !== fileName) {
        diagnostics.push({
          code: "streak:S801",
          message: "Widget filename and component name must match.",
          range: getRangeFromNode(sourceFile, nodeToRange),
          severity,
          source: "Streak Engine",
        });
      }
    }

    return diagnostics;
  },
};
