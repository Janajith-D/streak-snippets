import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionExpression,
  type SourceFile,
} from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

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
  "Event",
  "MouseEvent",
  "TouchEvent",
  "KeyboardEvent",
  "PointerEvent",
  "FocusEvent",
  "InputEvent",
  "WheelEvent",
  "AnimationEvent",
  "TransitionEvent",
  "CustomEvent",
  "Element",
  "HTMLElement",
  "HTMLDivElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLFormElement",
  "HTMLAnchorElement",
  "HTMLImageElement",
  "HTMLCanvasElement",
  "SVGElement",
  "Node",
  "Document",
  "Window",
  "EventTarget",
  "FormData",
  "Headers",
  "Request",
  "Response",
  "URL",
  "URLSearchParams",
  "Blob",
  "File",
  "FileReader",
  "MutationObserver",
  "IntersectionObserver",
  "ResizeObserver",
  "performance",
  "localStorage",
  "sessionStorage",
  "navigator",
  "location",
  "history",
  "btoa",
  "atob",
]);

function isTypePosition(node: Node): boolean {
  let curr: Node | undefined = node.getParent();
  while (curr) {
    if (
      Node.isTypeNode(curr) ||
      Node.isTypeReference(curr) ||
      Node.isTypeAliasDeclaration(curr) ||
      Node.isInterfaceDeclaration(curr) ||
      curr.getKindName().includes("Type")
    ) {
      return true;
    }
    if (Node.isArrowFunction(curr) || Node.isFunctionExpression(curr) || Node.isBlock(curr)) {
      break;
    }
    curr = curr.getParent();
  }
  return false;
}

/**
 * Rules for <Script> components in Streak Forge
 */
export const scriptClosureCaptureRule: Rule = {
  id: "streak:script-closure-capture",
  name: "Script Closure Capture",
  description:
    "Ensures <Script> callback functions do not capture outer component variables.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      let isScriptTag = false;
      let callbackNode: ArrowFunction | FunctionExpression | null = null;

      if (Node.isJsxElement(node)) {
        const opening = node.getOpeningElement();
        if (opening.getTagNameNode().getText() === "Script") {
          isScriptTag = true;
          // Check children JSX expression or props
          const children = node.getChildrenOfKind(SyntaxKind.JsxExpression);
          for (const expr of children) {
            const innerExpr = expr.getExpression();
            if (
              innerExpr &&
              (Node.isArrowFunction(innerExpr) ||
                Node.isFunctionExpression(innerExpr))
            ) {
              callbackNode = innerExpr;
            }
          }
        }
      }

      if (isScriptTag && callbackNode) {
        const paramNames = new Set(
          callbackNode.getParameters().map((p) => p.getName()),
        );

        callbackNode.forEachDescendant((innerNode) => {
          if (Node.isIdentifier(innerNode)) {
            const name = innerNode.getText();
            // Ignore type positions (e.g. : MouseEvent)
            if (isTypePosition(innerNode)) {
              return;
            }

            // Check if identifier is a variable reference (not property name)
            const parent = innerNode.getParent();
            const isPropAccessName =
              parent &&
              Node.isPropertyAccessExpression(parent) &&
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
                const isDeclaredInsideScript = declarations.some((d) => {
                  try {
                    return (
                      d.getStart() >= callbackNode.getStart() &&
                      d.getEnd() <= callbackNode.getEnd()
                    );
                  } catch {
                    return false;
                  }
                });

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

function checkScriptParams(
  innerExpr: Node,
  sourceFile: SourceFile,
  severity: DiagnosticSeverity,
): RuleDiagnostic | undefined {
  if (Node.isArrowFunction(innerExpr) || Node.isFunctionExpression(innerExpr)) {
    const params = innerExpr.getParameters();
    if (params.length > 2) {
      const range = getRangeFromNode(sourceFile, innerExpr);
      return {
        code: "streak:S402",
        message: `<Script> callback signature must follow (gDom, options) => void (expected at most 2 parameters, found ${params.length}).`,
        range,
        severity,
        source: "Streak Engine",
      };
    }
  }
  return undefined;
}

export const invalidScriptSignatureRule: Rule = {
  id: "streak:invalid-script-signature",
  name: "Invalid Script Signature",
  description:
    "Ensures <Script> callback follows (gDom, options) => void signature.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      if (Node.isJsxElement(node)) {
        const opening = node.getOpeningElement();
        if (opening.getTagNameNode().getText() === "Script") {
          const children = node.getChildrenOfKind(SyntaxKind.JsxExpression);
          for (const expr of children) {
            const innerExpr = expr.getExpression();
            if (innerExpr) {
              const diag = checkScriptParams(innerExpr, sourceFile, severity);
              if (diag) {
                diagnostics.push(diag);
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
  description:
    "Ensures browser-side Script code does not contain module imports or require calls.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      if (Node.isJsxElement(node)) {
        const opening = node.getOpeningElement();
        if (opening.getTagNameNode().getText() === "Script") {
          const children = node.getChildrenOfKind(SyntaxKind.JsxExpression);
          for (const expr of children) {
            const callbackNode = expr.getExpression();
            if (callbackNode) {
              // Check for import() expressions or require() calls
              callbackNode.forEachDescendant((inner) => {
                if (Node.isCallExpression(inner)) {
                  const exprText = inner.getExpression().getText();
                  if (exprText === "require" || exprText === "import") {
                    const range = getRangeFromNode(sourceFile, inner);
                    diagnostics.push({
                      code: "streak:S403",
                      message:
                        "Browser-side <Script> code must not contain or depend on module imports or require() calls.",
                      range,
                      severity,
                      source: "Streak Engine",
                    });
                  }
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

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      if (Node.isJsxElement(node)) {
        const opening = node.getOpeningElement();
        if (opening.getTagNameNode().getText() === "Script") {
          const children = node.getChildrenOfKind(SyntaxKind.JsxExpression);
          for (const expr of children) {
            const callbackNode = expr.getExpression();
            if (
              callbackNode &&
              (Node.isArrowFunction(callbackNode) ||
                Node.isFunctionExpression(callbackNode)) &&
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

export { scriptRequiredIdRule } from "./scriptRequiredIdRule";
