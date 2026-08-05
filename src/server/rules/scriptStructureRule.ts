import { Node, SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { getRangeFromNode, Rule, RuleDiagnostic, RuleOptions } from "./types";

export const scriptStructureRule: Rule = {
  id: "streak:script-structure",
  name: "Script Structure Rule",
  description: "Ensures <Script> tags only contain a single JSX expression child wrapping a valid execution callback.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    sourceFile.forEachDescendant((node) => {
      if (Node.isJsxElement(node)) {
        const opening = node.getOpeningElement();
        const tagName = opening.getTagNameNode().getText();

        if (tagName === "Script") {
          const children = node.getJsxChildren();
          const nonWhitespaceChildren = children.filter((c) => {
            if (Node.isJsxText(c)) {
              return c.getText().trim().length > 0;
            }
            return true;
          });

          const range = getRangeFromNode(sourceFile, node);

          if (nonWhitespaceChildren.length === 0) {
            diagnostics.push({
              code: "streak:S603",
              message: "<Script> tag requires an inline execution callback function.",
              range,
              severity,
              source: "Streak Engine",
            });
          } else if (nonWhitespaceChildren.length > 1) {
            diagnostics.push({
              code: "streak:S603",
              message: "<Script> tag must contain exactly one child wrapping the client-side execution callback.",
              range,
              severity,
              source: "Streak Engine",
            });
          } else {
            const child = nonWhitespaceChildren[0];
            if (!Node.isJsxExpression(child)) {
              diagnostics.push({
                code: "streak:S603",
                message: "<Script> child must be wrapped in a JSX expression (e.g. {() => {}}).",
                range,
                severity,
                source: "Streak Engine",
              });
            } else {
              const expr = child.getExpression();
              if (!expr || (!Node.isArrowFunction(expr) && !Node.isFunctionExpression(expr))) {
                diagnostics.push({
                  code: "streak:S603",
                  message: "<Script> expression must be a client-side function expression or arrow function.",
                  range: getRangeFromNode(sourceFile, child),
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
