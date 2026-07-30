import { InterfaceDeclaration, Node, SourceFile, TypeAliasDeclaration } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { getRangeFromNode, Rule, RuleDiagnostic, RuleOptions } from "./types";

function checkInterface(iface: InterfaceDeclaration, sourceFile: SourceFile, severity: DiagnosticSeverity): RuleDiagnostic[] {
  const diagnostics: RuleDiagnostic[] = [];
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
  return diagnostics;
}

function checkTypeAlias(alias: TypeAliasDeclaration, sourceFile: SourceFile, severity: DiagnosticSeverity): RuleDiagnostic[] {
  const diagnostics: RuleDiagnostic[] = [];
  const typeNode = alias.getTypeNode();
  if (typeNode && Node.isTypeLiteral(typeNode)) {
    for (const member of typeNode.getMembers()) {
      if (Node.isPropertySignature(member)) {
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
  return diagnostics;
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

    for (const iface of sourceFile.getInterfaces()) {
      diagnostics.push(...checkInterface(iface, sourceFile, severity));
    }

    for (const alias of sourceFile.getTypeAliases()) {
      diagnostics.push(...checkTypeAlias(alias, sourceFile, severity));
    }

    return diagnostics;
  },
};

