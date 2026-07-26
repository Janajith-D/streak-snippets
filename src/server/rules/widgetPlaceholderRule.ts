import { Node, SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { getRangeFromNode, Rule, RuleDiagnostic, RuleOptions } from "./types";

export const widgetPlaceholderRule: Rule = {
  id: "streak:widget-placeholder-props",
  name: "WidgetPlaceholder Props Rule",
  description: "Ensures <WidgetPlaceholder> elements have required non-empty 'id' and 'type' props.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
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

      if (tagName === "WidgetPlaceholder") {
        let hasId = false;
        let hasType = false;

        for (const attr of attributes) {
          if (Node.isJsxAttribute(attr)) {
            const attrName = attr.getNameNode()?.getText();
            const initializer = attr.getInitializer();

            let value = "";
            if (initializer) {
              if (Node.isStringLiteral(initializer)) {
                value = initializer.getLiteralValue();
              } else {
                value = initializer.getText();
              }
            }

            if (attrName === "id") {
              if (value && value.trim() !== '""' && value.trim() !== "''") {
                hasId = true;
              }
            } else if (attrName === "type") {
              if (value && value.trim() !== '""' && value.trim() !== "''") {
                hasType = true;
              }
            }
          }
        }

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
      }
    });

    return diagnostics;
  },
};

