import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
  type RangeLocation,
} from "./types";

/**
 * Validates the non-whitespace children of a <Script> element.
 * Returns the appropriate diagnostic(s) for the given child structure,
 * or an empty array when the structure is valid.
 *
 * Extracted to reduce cognitive complexity of the `run` callback.
 */
function validateScriptChildren(
  nonWhitespaceChildren: Node[],
  sourceFile: SourceFile,
  elementRange: RangeLocation,
  severity: DiagnosticSeverity,
): RuleDiagnostic[] {
  const make = (
    code: string,
    message: string,
    range: RangeLocation,
  ): RuleDiagnostic => ({
    code,
    message,
    range,
    severity,
    source: "Streak Engine",
  });

  if (nonWhitespaceChildren.length === 0) {
    return [
      make(
        "streak:S603",
        "<Script> tag requires an inline execution callback function.",
        elementRange,
      ),
    ];
  }

  if (nonWhitespaceChildren.length > 1) {
    return [
      make(
        "streak:S603",
        "<Script> tag must contain exactly one child wrapping the client-side execution callback.",
        elementRange,
      ),
    ];
  }

  const child = nonWhitespaceChildren[0];
  if (!Node.isJsxExpression(child)) {
    return [
      make(
        "streak:S603",
        "<Script> child must be wrapped in a JSX expression (e.g. {() => {}}).",
        elementRange,
      ),
    ];
  }

  const expr = child.getExpression();
  if (
    !expr ||
    (!Node.isArrowFunction(expr) && !Node.isFunctionExpression(expr))
  ) {
    return [
      make(
        "streak:S603",
        "<Script> expression must be a client-side function expression or arrow function.",
        getRangeFromNode(sourceFile, child),
      ),
    ];
  }

  return [];
}

export const scriptStructureRule: Rule = {
  id: "streak:script-structure",
  name: "Script Structure Rule",
  description:
    "Ensures <Script> tags only contain a single JSX expression child wrapping a valid execution callback.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(
    sourceFile: SourceFile,
    _analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    sourceFile.forEachDescendant((node) => {
      if (!Node.isJsxElement(node)) {
        return;
      }
      const opening = node.getOpeningElement();
      if (opening.getTagNameNode().getText() !== "Script") {
        return;
      }

      const nonWhitespaceChildren = node.getJsxChildren().filter((c) => {
        if (Node.isJsxText(c)) {
          return c.getText().trim().length > 0;
        }
        return true;
      });

      const range = getRangeFromNode(sourceFile, node);
      diagnostics.push(
        ...validateScriptChildren(
          nonWhitespaceChildren,
          sourceFile,
          range,
          severity,
        ),
      );
    });

    return diagnostics;
  },
};
