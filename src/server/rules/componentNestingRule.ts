import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

export const componentNestingRule: Rule = {
  id: "streak:component-nesting",
  name: "Component Nesting Rule",
  description:
    "Ensures component nesting constraints are respected (e.g., no nested <Script> tags, no <WidgetPlaceholder> inside <Script> tags).",
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
      if (Node.isJsxSelfClosingElement(node)) {
        tagName = node.getTagNameNode().getText();
      } else if (Node.isJsxElement(node)) {
        tagName = node.getOpeningElement().getTagNameNode().getText();
      }

      if (!tagName) {
        return;
      }

      let parent = node.getParent();
      while (parent) {
        let parentTagName = "";
        if (Node.isJsxElement(parent)) {
          parentTagName = parent.getOpeningElement().getTagNameNode().getText();
        }

        if (parentTagName === "Script") {
          if (tagName === "Script") {
            diagnostics.push({
              code: "streak:S602",
              message:
                "Nesting `<Script>` tags inside other `<Script>` tags is not allowed.",
              range: getRangeFromNode(sourceFile, node),
              severity,
              source: "Streak Engine",
            });
            break;
          }
          if (tagName === "WidgetPlaceholder") {
            diagnostics.push({
              code: "streak:S602",
              message:
                "Nesting `<WidgetPlaceholder>` inside a `<Script>` tag callback is not allowed as widget injection is a server-side framework function.",
              range: getRangeFromNode(sourceFile, node),
              severity,
              source: "Streak Engine",
            });
            break;
          }
        }
        parent = parent.getParent();
      }
    });

    return diagnostics;
  },
};
