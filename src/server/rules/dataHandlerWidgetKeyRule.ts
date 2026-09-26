import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import { widgetRegistry } from "../registry/widgets";
import { getDefaultExportedHandler, isDataHandlerFile } from "./dataHandlerUtils";
import { getRangeFromNode, type Rule, type RuleDiagnostic, type RuleOptions } from "./types";

const IGNORED_RETURN_KEYS = new Set([
  "status",
  "common",
  "global",
  "metadata",
  "renderConfig",
  "headers",
  "cookies",
  "redirect",
  "cache",
  "version",
  "props",
]);

function unwrapObjectLiteral(expr: Node | undefined): Node | null {
  if (!expr) {
    return null;
  }
  const target = Node.isParenthesizedExpression(expr) ? expr.getExpression() : expr;
  return Node.isObjectLiteralExpression(target) ? target : null;
}

function getReturnedObjectLiterals(fn: Node): Node[] {
  const returnedObjects: Node[] = [];

  const returnStatements = fn.getDescendantsOfKind(SyntaxKind.ReturnStatement);
  for (const ret of returnStatements) {
    const obj = unwrapObjectLiteral(ret.getExpression());
    if (obj) {
      returnedObjects.push(obj);
    }
  }

  if (Node.isArrowFunction(fn)) {
    const obj = unwrapObjectLiteral(fn.getBody());
    if (obj) {
      returnedObjects.push(obj);
    }
  }

  return returnedObjects;
}

function getPropertyNameAndNode(prop: Node): { name: string; nameNode: Node | undefined } | null {
  if (
    Node.isPropertyAssignment(prop) ||
    Node.isShorthandPropertyAssignment(prop) ||
    Node.isMethodDeclaration(prop)
  ) {
    return { name: prop.getName(), nameNode: prop.getNameNode() };
  }
  return null;
}

function validateReturnObjectProperties(
  obj: Node,
  sourceFile: SourceFile,
  registeredWidgets: Set<string>,
  severity: DiagnosticSeverity,
): RuleDiagnostic[] {
  const diagnostics: RuleDiagnostic[] = [];
  if (!Node.isObjectLiteralExpression(obj)) {
    return diagnostics;
  }

  for (const prop of obj.getProperties()) {
    const propInfo = getPropertyNameAndNode(prop);
    if (!propInfo?.name || IGNORED_RETURN_KEYS.has(propInfo.name)) {
      continue;
    }

    if (registeredWidgets.size > 0 && !registeredWidgets.has(propInfo.name)) {
      const range = getRangeFromNode(sourceFile, propInfo.nameNode ?? prop);
      diagnostics.push({
        code: "streak:S204",
        message: `Return property "${propInfo.name}" does not match any registered widget in src/widgets (${propInfo.name}.tsx).`,
        range,
        severity,
        source: "Streak Engine",
      });
    }
  }

  return diagnostics;
}

export const dataHandlerWidgetKeyRule: Rule = {
  id: "streak:data-handler-widget-key",
  name: "Data Handler Widget Key Check",
  description:
    "Ensures top-level return object keys in default-exported data handler match valid registered widgets in src/widgets.",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    const rawPath = analysis.uri || sourceFile.getFilePath();
    if (!isDataHandlerFile(rawPath)) {
      return diagnostics;
    }

    const handler = getDefaultExportedHandler(sourceFile);
    if (!handler) {
      return diagnostics;
    }

    const registeredWidgets = new Set(widgetRegistry.getAll().map((w) => w.name));

    const returnedObjects = getReturnedObjectLiterals(handler);
    for (const obj of returnedObjects) {
      diagnostics.push(
        ...validateReturnObjectProperties(obj, sourceFile, registeredWidgets, severity),
      );
    }

    return diagnostics;
  },
};
