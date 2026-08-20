import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

const TARGET_EVENTS = new Set([
  "scroll",
  "mousemove",
  "touchstart",
  "touchmove",
  "wheel",
  "mousewheel",
  "pointermove",
]);

/**
 * Checks if the third argument to addEventListener specifies { passive: true }.
 */
function hasPassiveOption(optionsNode: Node | undefined): boolean {
  if (!optionsNode) {
    return false;
  }

  // e.g. { passive: true }
  if (Node.isObjectLiteralExpression(optionsNode)) {
    for (const prop of optionsNode.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        const init = prop.getInitializer();
        if (name === "passive" && init?.getText() === "true") {
          return true;
        }
      }
    }
  }

  return false;
}

export const passiveEventListenerRule: Rule = {
  id: "streak:passive-event-listener",
  name: "Passive Event Listener Rule",
  description:
    "Ensures scroll, mousemove, and touch event listeners specify { passive: true } for scrolling performance.",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(
    sourceFile: SourceFile,
    _analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) {
        return;
      }

      const methodName = expr.getName();
      if (methodName !== "addEventListener") {
        return;
      }

      const args = node.getArguments();
      if (args.length < 2) {
        return;
      }

      const firstArg = args[0];
      let eventName = "";
      if (Node.isStringLiteral(firstArg) || Node.isNoSubstitutionTemplateLiteral(firstArg)) {
        eventName = firstArg.getLiteralValue();
      }

      if (!TARGET_EVENTS.has(eventName)) {
        return;
      }

      const thirdArg = args[2];
      if (!hasPassiveOption(thirdArg)) {
        diagnostics.push({
          code: "streak:S406",
          message: `Event listener for "${eventName}" should specify '{ passive: true }' to prevent scroll-blocking and improve performance.`,
          range: getRangeFromNode(sourceFile, node),
          severity,
          source: "Streak Engine",
        });
      }
    });

    return diagnostics;
  },
};
