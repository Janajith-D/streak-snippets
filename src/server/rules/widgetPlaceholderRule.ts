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
 * Validates the attributes of a <WidgetPlaceholder> element.
 * Returns `{ hasId, hasType }` indicating which required attrs are present and non-empty.
 *
 * An attribute value is considered valid when:
 * - It is not the empty string
 * - It is not the literal sentinel `""` or `''`
 *
 * Extracted to reduce cognitive complexity of the `run` callback.
 */
function validateWidgetPlaceholderAttrs(attributes: Node[]): {
  hasId: boolean;
  hasType: boolean;
} {
  let hasId = false;
  let hasType = false;

  for (const attr of attributes) {
    if (!Node.isJsxAttribute(attr)) {
      continue;
    }
    const attrName = attr.getNameNode()?.getText();
    const value = getJsxAttrValue(attr);
    const isNonEmpty = value && value.trim() !== '""' && value.trim() !== "''";

    if (attrName === "id" && isNonEmpty) {
      hasId = true;
    } else if (attrName === "type" && isNonEmpty) {
      hasType = true;
    }
  }

  return { hasId, hasType };
}

export const widgetPlaceholderRule: Rule = {
  id: "streak:widget-placeholder-props",
  name: "WidgetPlaceholder Props Rule",
  description:
    "Ensures <WidgetPlaceholder> elements have required non-empty 'id' and 'type' props.",
  defaultSeverity: DiagnosticSeverity.Error,

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

      if (Node.isJsxSelfClosingElement(node)) {
        tagName = node.getTagNameNode().getText();
        attributes = node.getAttributes();
      } else if (Node.isJsxElement(node)) {
        const opening = node.getOpeningElement();
        tagName = opening.getTagNameNode().getText();
        attributes = opening.getAttributes();
      }

      if (tagName !== "WidgetPlaceholder") {
        return;
      }

      const { hasId, hasType } = validateWidgetPlaceholderAttrs(attributes);
      const range = getRangeFromNode(sourceFile, node);

      if (!hasId) {
        diagnostics.push({
          code: "streak:S101",
          message: "<WidgetPlaceholder> requires a non-empty 'id' attribute.",
          range,
          severity,
          source: "Streak Engine",
        });
      }

      if (!hasType) {
        diagnostics.push({
          code: "streak:S102",
          message: "<WidgetPlaceholder> requires a non-empty 'type' attribute.",
          range,
          severity,
          source: "Streak Engine",
        });
      }
    });

    return diagnostics;
  },
};
