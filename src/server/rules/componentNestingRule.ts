import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import { getRangeFromNode, type Rule, type RuleDiagnostic, type RuleOptions } from "./types";

const INVALID_NESTING_MESSAGES: Readonly<Record<string, string>> = {
  "Script->Script": "Nesting `<Script>` tags inside other `<Script>` tags is not allowed.",
  "Script->WidgetPlaceholder":
    "Nesting `<WidgetPlaceholder>` inside a `<Script>` tag callback is not allowed as widget injection is a server-side framework function.",
  "WidgetPlaceholder->WidgetPlaceholder":
    "Nesting `<WidgetPlaceholder>` inside another `<WidgetPlaceholder>` is not allowed.",
  "WidgetPlaceholder->Dynamic":
    "Nesting `<Dynamic>` components inside a `<WidgetPlaceholder>` is not allowed.",
  "Dynamic->WidgetPlaceholder":
    "Nesting `<WidgetPlaceholder>` inside a `<Dynamic>` component is not allowed.",
  "Dynamic->Dynamic":
    "Nesting `<Dynamic>` components inside other `<Dynamic>` components is not allowed.",
  "Preload->WidgetPlaceholder": "Nesting `<WidgetPlaceholder>` inside `<Preload>` is not allowed.",
  "Preload->Dynamic": "Nesting `<Dynamic>` inside `<Preload>` is not allowed.",
};

function getInvalidNestingMessage(parentTagName: string, tagName: string): string | undefined {
  return INVALID_NESTING_MESSAGES[`${parentTagName}->${tagName}`];
}

export const componentNestingRule: Rule = {
  id: "streak:component-nesting",
  name: "Component Nesting Rule",
  description:
    "Ensures component nesting constraints are respected (e.g., no nested <Script> or <WidgetPlaceholder> tags, no <WidgetPlaceholder> inside <Script> tags).",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
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

        const message = getInvalidNestingMessage(parentTagName, tagName);
        if (message) {
          diagnostics.push({
            code: "streak:S602",
            message,
            range: getRangeFromNode(sourceFile, node),
            severity,
            source: "Streak Engine",
          });
          break;
        }

        parent = parent.getParent();
      }
    });

    return diagnostics;
  },
};
