import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import { widgetRegistry } from "../registry/widgets";
import { getClosestWidgetMatches } from "./sitemapRules";
import {
  getJsxAttrValue,
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

/**
 * Extracts and cleans 'id' and 'type' attribute values of a <WidgetPlaceholder> element.
 */
function getWidgetPlaceholderAttrs(attributes: Node[]): {
  id?: string;
  type?: string;
} {
  let id: string | undefined;
  let type: string | undefined;

  for (const attr of attributes) {
    if (!Node.isJsxAttribute(attr)) {
      continue;
    }
    const attrName = attr.getNameNode()?.getText();
    const value = getJsxAttrValue(attr);
    const cleaned = value?.trim();
    const isNonEmpty =
      cleaned !== undefined &&
      cleaned !== "" &&
      cleaned !== '""' &&
      cleaned !== "''";

    if (attrName === "id" && isNonEmpty) {
      id = cleaned.replace(/^["']|["']$/g, "");
    } else if (attrName === "type" && isNonEmpty) {
      type = cleaned.replace(/^["']|["']$/g, "");
    }
  }

  return { id, type };
}

export const widgetPlaceholderRule: Rule = {
  id: "streak:widget-placeholder-props",
  name: "WidgetPlaceholder Props Rule",
  description:
    "Ensures <WidgetPlaceholder> elements have valid 'id' and 'type' props, are used inside layouts, and id/type match exactly.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(
    sourceFile: SourceFile,
    _analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;
    const rawPath = _analysis?.uri ?? sourceFile.getFilePath();
    const filePath = decodeURIComponent(rawPath).replaceAll("\\", "/");
    const isLayoutFile =
      /(?:^|\/)src\/layouts?\//i.test(filePath) ||
      /(?:^|\/)layout\//i.test(filePath) ||
      /(?:^|\/)layouts\//i.test(filePath);

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

      const range = getRangeFromNode(sourceFile, node);

      // 1. Rule streak:S102 — WidgetPlaceholder can only be used inside layout files
      if (!isLayoutFile && filePath !== "" && !filePath.startsWith("/test/inline")) {
        diagnostics.push({
          code: "streak:S102",
          message:
            "<WidgetPlaceholder> can only be used inside layout files (src/layout or src/layouts).",
          range,
          severity,
          source: "Streak Engine",
        });
      }

      const { id, type } = getWidgetPlaceholderAttrs(attributes);

      // 2. Rule streak:S101 — Missing required id and/or type attributes
      if (!id && !type) {
        diagnostics.push({
          code: "streak:S101",
          message: "<WidgetPlaceholder> requires non-empty 'id' and 'type' attributes.",
          range,
          severity,
          source: "Streak Engine",
        });
      } else if (!id) {
        diagnostics.push({
          code: "streak:S101",
          message: "<WidgetPlaceholder> requires a non-empty 'id' attribute.",
          range,
          severity,
          source: "Streak Engine",
        });
      } else if (!type) {
        diagnostics.push({
          code: "streak:S101",
          message: "<WidgetPlaceholder> requires a non-empty 'type' attribute.",
          range,
          severity,
          source: "Streak Engine",
        });
      } else if (id !== type) {
        // 3. Rule streak:S103 — id and type must match exactly
        diagnostics.push({
          code: "streak:S103",
          message: `<WidgetPlaceholder> 'id' ("${id}") and 'type' ("${type}") must match exactly.`,
          range,
          severity,
          source: "Streak Engine",
        });
      }

      // 4. Rule streak:S902 — Missing widget in src/widgets
      if (type && widgetRegistry.getAll().length > 0 && !widgetRegistry.get(type)) {
        const suggestions = getClosestWidgetMatches(type);
        const suggestionText =
          suggestions.length > 0 ? ` Did you mean: ${suggestions.join(", ")}?` : "";
        diagnostics.push({
          code: "streak:S902",
          message: `Widget "${type}" does not exist in src/widgets as a .tsx file.${suggestionText}`,
          range,
          severity: DiagnosticSeverity.Warning,
          source: "Streak Engine",
        });
      }
    });

    return diagnostics;
  },
};
