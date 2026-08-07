import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

function returnsStatus(fn: Node): boolean {
  const objectLiterals = fn.getDescendantsOfKind(
    SyntaxKind.ObjectLiteralExpression,
  );
  for (const obj of objectLiterals) {
    const properties = obj.getProperties();
    for (const prop of properties) {
      const propName =
        Node.isPropertyAssignment(prop) ||
        Node.isShorthandPropertyAssignment(prop)
          ? prop.getName()
          : prop.getText();
      if (propName === "status") {
        return true;
      }
    }
  }
  return false;
}

function getCandidateHandlers(sourceFile: SourceFile): Node[] {
  const functions = sourceFile.getFunctions();
  const arrowFuncs = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
  const candidateFuncs: Node[] = [];

  for (const fn of functions) {
    if (
      fn.isDefaultExport() ||
      fn.isExported() ||
      /Data|Handler/.test(fn.getName() ?? "")
    ) {
      candidateFuncs.push(fn);
    }
  }

  for (const arrowFn of arrowFuncs) {
    const parent = arrowFn.getParent();
    let parentName = "";
    if (parent && Node.isVariableDeclaration(parent)) {
      parentName = parent.getName();
    }
    const isExported =
      parent?.getParent()?.getParent()?.getKind() ===
        SyntaxKind.ExportAssignment ||
      parent?.getParent()?.getParent()?.getKind() ===
        SyntaxKind.VariableStatement;

    if (isExported || /Data|Handler/.test(parentName)) {
      candidateFuncs.push(arrowFn);
    }
  }

  return candidateFuncs;
}

export const dataHandlerStatusRule: Rule = {
  id: "streak:data-handler-status",
  name: "Data Handler Status Check",
  description:
    "Ensures Streak data handler functions return an object with a 'status' property (e.g. status: 200).",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    // Only apply to .ts files (data handlers), not .tsx components
    if (analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    const candidateFuncs = getCandidateHandlers(sourceFile);

    for (const fn of candidateFuncs) {
      if (!returnsStatus(fn)) {
        const range = getRangeFromNode(sourceFile, fn);
        diagnostics.push({
          code: "streak:S201",
          message:
            "Streak data handler should return an object containing a 'status' property (e.g. status: 200).",
          range,
          severity,
          source: "Streak Engine",
        });
      }
    }

    return diagnostics;
  },
};
