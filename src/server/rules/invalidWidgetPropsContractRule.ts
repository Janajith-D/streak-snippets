import { SourceFile, SyntaxKind } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { RangeLocation, Rule, RuleDiagnostic, RuleOptions } from "./types";

function getRangeFromNode(sourceFile: SourceFile, node: any): RangeLocation {
  const startPos = sourceFile.getLineAndColumnAtPos(node.getStart());
  const endPos = sourceFile.getLineAndColumnAtPos(node.getEnd());
  return {
    start: { line: Math.max(0, startPos.line - 1), character: Math.max(0, startPos.column - 1) },
    end: { line: Math.max(0, endPos.line - 1), character: Math.max(0, endPos.column - 1) },
  };
}

export const invalidWidgetPropsContractRule: Rule = {
  id: "streak:invalid-widget-props-contract",
  name: "Invalid Widget Props Contract",
  description: "Ensures widget props define data as optional (data?: T).",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    if (!analysis.uri.endsWith(".tsx")) {
      return diagnostics;
    }

    const interfaces = sourceFile.getInterfaces();
    const typeAliases = sourceFile.getTypeAliases();

    for (const iface of interfaces) {
      for (const prop of iface.getProperties()) {
        if (prop.getName() === "data" && !prop.hasQuestionToken()) {
          const range = getRangeFromNode(sourceFile, prop);
          diagnostics.push({
            code: "streak:S304",
            message: "Widget props should define 'data' as optional ('data?: T').",
            range,
            severity,
            source: "Streak Engine",
          });
        }
      }
    }

    for (const alias of typeAliases) {
      const typeNode = alias.getTypeNode();
      if (typeNode && typeNode.getKind() === SyntaxKind.TypeLiteral) {
        for (const member of (typeNode as any).getMembers()) {
          if (member.getKind() === SyntaxKind.PropertySignature) {
            if (member.getName() === "data" && !member.hasQuestionToken()) {
              const range = getRangeFromNode(sourceFile, member);
              diagnostics.push({
                code: "streak:S304",
                message: "Widget props should define 'data' as optional ('data?: T').",
                range,
                severity,
                source: "Streak Engine",
              });
            }
          }
        }
      }
    }

    return diagnostics;
  },
};
