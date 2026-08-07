import { DiagnosticSeverity } from "vscode-languageserver/node";
import { Node, SourceFile } from "ts-morph";
import { AnalysisResult } from "../../shared/types";

export interface RangeLocation {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface RuleDiagnostic {
  message: string;
  range: RangeLocation;
  severity: DiagnosticSeverity;
  code: string;
  source: string;
}

export interface RuleOptions {
  enabled: boolean;
  severity?: DiagnosticSeverity;
  ruleOptions?: any;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  defaultSeverity: DiagnosticSeverity;
  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions
  ): RuleDiagnostic[];
}

export function getRangeFromNode(sourceFile: SourceFile, node: Node): RangeLocation {
  const startPos = sourceFile.getLineAndColumnAtPos(node.getStart());
  const endPos = sourceFile.getLineAndColumnAtPos(node.getEnd());
  return {
    start: { line: Math.max(0, startPos.line - 1), character: Math.max(0, startPos.column - 1) },
    end: { line: Math.max(0, endPos.line - 1), character: Math.max(0, endPos.column - 1) },
  };
}

/**
 * Returns the string value of a JSX attribute initializer.
 * - StringLiteral  → `getLiteralValue()` (strips surrounding quotes)
 * - Anything else  → raw `.getText()` (e.g. expressions)
 * - No initializer → `""`
 *
 * Shared by scriptRequiredIdRule and widgetPlaceholderRule.
 */
export function getJsxAttrValue(attr: Node): string {
  const init = (attr as any).getInitializer?.() as Node | undefined;
  if (!init) {
    return "";
  }
  return Node.isStringLiteral(init) ? (init as any).getLiteralValue() : init.getText();
}
