import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import { widgetRegistry } from "../registry/widgets";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

const IGNORED_RETURN_KEYS = new Set([
  "status",
  "metadata",
  "renderConfig",
  "headers",
  "cookies",
  "redirect",
  "cache",
  "version",
  "props",
]);

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

function getReturnedObjectLiterals(fn: Node): Node[] {
  const returnedObjects: Node[] = [];

  // 1. Explicit return statements: return { ... }
  const returnStatements = fn.getDescendantsOfKind(SyntaxKind.ReturnStatement);
  for (const ret of returnStatements) {
    const expr = ret.getExpression();
    if (expr && Node.isObjectLiteralExpression(expr)) {
      returnedObjects.push(expr);
    } else if (expr && Node.isParenthesizedExpression(expr)) {
      const inner = expr.getExpression();
      if (Node.isObjectLiteralExpression(inner)) {
        returnedObjects.push(inner);
      }
    }
  }

  // 2. Concise arrow function return: () => ({ ... })
  if (Node.isArrowFunction(fn)) {
    const body = fn.getBody();
    if (Node.isObjectLiteralExpression(body)) {
      returnedObjects.push(body);
    } else if (Node.isParenthesizedExpression(body)) {
      const inner = body.getExpression();
      if (Node.isObjectLiteralExpression(inner)) {
        returnedObjects.push(inner);
      }
    }
  }

  return returnedObjects;
}

export const dataHandlerWidgetKeyRule: Rule = {
  id: "streak:data-handler-widget-key",
  name: "Data Handler Widget Key Check",
  description:
    "Ensures top-level return object keys in data handlers match valid registered widgets in src/widgets.",
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
    const registeredWidgets = new Set(widgetRegistry.getAll().map((w) => w.name));

    for (const fn of candidateFuncs) {
      const returnedObjects = getReturnedObjectLiterals(fn);

      for (const obj of returnedObjects) {
        if (!Node.isObjectLiteralExpression(obj)) {
          continue;
        }

        for (const prop of obj.getProperties()) {
          let propNameNode: Node | undefined;
          let propName = "";

          if (Node.isPropertyAssignment(prop)) {
            propNameNode = prop.getNameNode();
            propName = prop.getName();
          } else if (Node.isShorthandPropertyAssignment(prop)) {
            propNameNode = prop.getNameNode();
            propName = prop.getName();
          } else if (Node.isMethodDeclaration(prop)) {
            propNameNode = prop.getNameNode();
            propName = prop.getName();
          }

          if (!propName || IGNORED_RETURN_KEYS.has(propName)) {
            continue;
          }

          // If widget registry is populated and widget does not exist
          if (registeredWidgets.size > 0 && !registeredWidgets.has(propName)) {
            const range = getRangeFromNode(sourceFile, propNameNode ?? prop);
            diagnostics.push({
              code: "streak:S204",
              message: `Return property "${propName}" does not match any registered widget in src/widgets (${propName}.tsx).`,
              range,
              severity,
              source: "Streak Engine",
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
