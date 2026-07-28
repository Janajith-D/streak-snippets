import { Node, SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { getRangeFromNode, Rule, RuleDiagnostic, RuleOptions } from "./types";

export const scriptRequiredIdRule: Rule = {
  id: "streak:script-required-id",
  name: "Script Required Id Rule",
  description: "Ensures <Script> components have a non-empty 'id' attribute.",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
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

      if (tagName === "Script") {
        let hasId = false;

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
              if (value && value.trim() !== "" && value.trim() !== '""' && value.trim() !== "''" && value.trim() !== "{}") {
                hasId = true;
              }
            }
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
      }
    });

    return diagnostics;
  },
};
