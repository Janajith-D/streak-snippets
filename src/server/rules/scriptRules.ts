import { SourceFile, SyntaxKind } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { RangeLocation, Rule, RuleDiagnostic, RuleOptions } from "./types";

function getRangeFromNode(sourceFile: SourceFile, node: any): RangeLocation {
  const startPos = sourceFile.getLineAndColumnAtPos(node.getStart());
  const endPos = sourceFile.getLineAndColumnAtPos(node.getEnd());
  return {
    start: { line: Math.max(0, startPos.line - 1), character: Math.max(0, startPos.column - 1) },
    end: { line: Math.max(0, endPos.line - 1), character: Math.max(0, endPos.column - 1) },
  };
}

// Global browser identifiers allowed inside Script callbacks
const ALLOWED_GLOBALS = new Set([
  "window",
  "document",
  "console",
  "Math",
  "JSON",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "Date",
  "RegExp",
  "Error",
  "fetch",
  "alert",
  "gDom",
  "options",
  "dom",
  "undefined",
  "null",
  "true",
  "false",
]);

/**
 * Rules for <Script> components in Streak Forge
 */
export const scriptClosureCaptureRule: Rule = {
  id: "streak:script-closure-capture",
  name: "Script Closure Capture",
  description: "Ensures <Script> callback functions do not capture outer component variables.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      let isScriptTag = false;
      let callbackNode: any = null;

      if (node.getKind() === SyntaxKind.JsxElement) {
        const opening = (node as any).getOpeningElement();
        if (opening.getTagNameNode().getText() === "Script") {
          isScriptTag = true;
          // Check children JSX expression or props
          const children = (node as any).getChildrenOfKind(SyntaxKind.JsxExpression);
          for (const expr of children) {
            const innerExpr = expr.getExpression();
            if (
              innerExpr?.getKind() === SyntaxKind.ArrowFunction ||
              innerExpr?.getKind() === SyntaxKind.FunctionExpression
            ) {
              callbackNode = innerExpr;
            }
          }
        }
      }

      if (isScriptTag && callbackNode) {
        const paramNames = new Set(
          callbackNode.getParameters().map((p: any) => p.getName())
        );

        callbackNode.forEachDescendant((innerNode: any) => {
          if (innerNode.getKind() === SyntaxKind.Identifier) {
            const name = innerNode.getText();
            // Check if identifier is a variable reference (not property name)
            const parent = innerNode.getParent();
            const isPropAccessName =
              parent?.getKind() === SyntaxKind.PropertyAccessExpression &&
              parent.getNameNode() === innerNode;

            if (
              !isPropAccessName &&
              !ALLOWED_GLOBALS.has(name) &&
              !paramNames.has(name)
            ) {
              // Verify identifier is declared in outer component scope
              const symbol = innerNode.getSymbol();
              if (symbol) {
                const declarations = symbol.getDeclarations();
                const isDeclaredInsideScript = declarations.some((d: any) =>
                  callbackNode.contains(d)
                );

                if (!isDeclaredInsideScript) {
                  const range = getRangeFromNode(sourceFile, innerNode);
                  diagnostics.push({
                    code: "streak:S401",
                    message: `<Script> closure captures outer variable '${name}'. Values must be passed via the 'options' prop.`,
                    range,
                    severity,
                    source: "Streak Engine",
                  });
                }
              }
            }
          }
        });
      }
    });

    return diagnostics;
  },
};

export const invalidScriptSignatureRule: Rule = {
  id: "streak:invalid-script-signature",
  name: "Invalid Script Signature",
  description: "Ensures <Script> callback follows (gDom, options) => void signature.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.JsxElement) {
        const opening = (node as any).getOpeningElement();
        if (opening.getTagNameNode().getText() === "Script") {
          const children = (node as any).getChildrenOfKind(SyntaxKind.JsxExpression);
          for (const expr of children) {
            const innerExpr = expr.getExpression();
            if (
              innerExpr?.getKind() === SyntaxKind.ArrowFunction ||
              innerExpr?.getKind() === SyntaxKind.FunctionExpression
            ) {
              const params = innerExpr.getParameters();
              if (params.length > 2) {
                const range = getRangeFromNode(sourceFile, innerExpr);
                diagnostics.push({
                  code: "streak:S402",
                  message: `<Script> callback signature must follow (gDom, options) => void (expected at most 2 parameters, found ${params.length}).`,
                  range,
                  severity,
                  source: "Streak Engine",
                });
              }
            }
          }
        }
      }
    });

    return diagnostics;
  },
};

export const importInsideScriptRule: Rule = {
  id: "streak:import-inside-script",
  name: "Import Inside Script",
  description: "Ensures browser-side Script code does not contain module imports or require calls.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.JsxElement) {
        const opening = (node as any).getOpeningElement();
        if (opening.getTagNameNode().getText() === "Script") {
          const children = (node as any).getChildrenOfKind(SyntaxKind.JsxExpression);
          for (const expr of children) {
            const callbackNode = expr.getExpression();
            if (callbackNode) {
              // Check for import() expressions or require() calls
              callbackNode.forEachDescendant((inner: any) => {
                if (
                  inner.getKind() === SyntaxKind.CallExpression &&
                  (inner.getExpression().getText() === "require" ||
                    inner.getExpression().getText() === "import")
                ) {
                  const range = getRangeFromNode(sourceFile, inner);
                  diagnostics.push({
                    code: "streak:S403",
                    message: "Browser-side <Script> code must not contain or depend on module imports or require() calls.",
                    range,
                    severity,
                    source: "Streak Engine",
                  });
                }
              });
            }
          }
        }
      }
    });

    return diagnostics;
  },
};

export const asyncScriptCallbackRule: Rule = {
  id: "streak:async-script-callback",
  name: "Async Script Callback",
  description: "Ensures <Script> callbacks are not declared async.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.JsxElement) {
        const opening = (node as any).getOpeningElement();
        if (opening.getTagNameNode().getText() === "Script") {
          const children = (node as any).getChildrenOfKind(SyntaxKind.JsxExpression);
          for (const expr of children) {
            const callbackNode = expr.getExpression();
            if (
              (callbackNode?.getKind() === SyntaxKind.ArrowFunction ||
                callbackNode?.getKind() === SyntaxKind.FunctionExpression) &&
              callbackNode.isAsync()
            ) {
              const range = getRangeFromNode(sourceFile, callbackNode);
              diagnostics.push({
                code: "streak:S404",
                message: "<Script> callbacks must not be declared 'async'.",
                range,
                severity,
                source: "Streak Engine",
              });
            }
          }
        }
      }
    });

    return diagnostics;
  },
};
