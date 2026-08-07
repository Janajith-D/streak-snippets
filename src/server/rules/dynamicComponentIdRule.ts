import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

function hasValidStaticId(attributes: Node[]): boolean {
  for (const attr of attributes) {
    if (Node.isJsxAttribute(attr) && attr.getNameNode()?.getText() === "id") {
      const initializer = attr.getInitializer();
      if (initializer && Node.isStringLiteral(initializer)) {
        const val = initializer.getLiteralValue();
        return !!(val && val.trim().length > 0);
      }
    }
  }
  return false;
}

function checkDynamicElement(
  node: Node,
  sourceFile: SourceFile,
  severity: DiagnosticSeverity,
): RuleDiagnostic | undefined {
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

  if (tagName === "Dynamic" && !hasValidStaticId(attributes)) {
    const range = getRangeFromNode(sourceFile, node);
    return {
      code: "streak:S501",
      message:
        "<Dynamic> component must have a static, non-empty 'id' attribute.",
      range,
      severity,
      source: "Streak Engine",
    };
  }
  return undefined;
}

export const dynamicComponentIdRule: Rule = {
  id: "streak:invalid-dynamic-component-id",
  name: "Invalid Dynamic Component ID",
  description:
    "Ensures <Dynamic> components have a static, non-empty 'id' attribute.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    sourceFile.forEachDescendant((node) => {
      const diag = checkDynamicElement(node, sourceFile, severity);
      if (diag) {
        diagnostics.push(diag);
      }
    });

    return diagnostics;
  },
};
