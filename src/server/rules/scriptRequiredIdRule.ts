import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getJsxAttrValue,
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

/**
 * Returns true when the attribute value is non-empty and not one of the
 * placeholder sentinels (`""`, `''`, `{}`).
 * Extracted to reduce cognitive complexity of the `run` callback.
 */
function isValidNonEmptyId(value: string): boolean {
  return (
    value.trim() !== "" &&
    value.trim() !== '""' &&
    value.trim() !== "''" &&
    value.trim() !== "{}"
  );
}

export const scriptRequiredIdRule: Rule = {
  id: "streak:script-required-id",
  name: "Script Required Id Rule",
  description: "Ensures <Script> components have a non-empty 'id' attribute.",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(
    sourceFile: SourceFile,
    _analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    sourceFile.forEachDescendant((node) => {
      let tagName = "";
      let attributes: Node[] = [];
      let elementNode: Node = node;

      if (Node.isJsxSelfClosingElement(node)) {
        tagName = node.getTagNameNode().getText();
        attributes = node.getAttributes();
        elementNode = node;
      } else if (Node.isJsxElement(node)) {
        const opening = node.getOpeningElement();
        tagName = opening.getTagNameNode().getText();
        attributes = opening.getAttributes();
        elementNode = opening;
      }

      if (tagName !== "Script") {
        return;
      }

      let hasId = false;
      for (const attr of attributes) {
        if (
          Node.isJsxAttribute(attr) &&
          attr.getNameNode()?.getText() === "id"
        ) {
          hasId = isValidNonEmptyId(getJsxAttrValue(attr));
        }
      }

      if (!hasId) {
        const range = getRangeFromNode(sourceFile, elementNode);
        diagnostics.push({
          code: "streak:S405",
          message: 'Script component requires a non-empty "id" attribute.',
          range,
          severity,
          source: "Streak Engine",
        });
      }
    });

    return diagnostics;
  },
};
