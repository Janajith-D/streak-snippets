import { Node, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import { getDefaultExportedHandler, isDataHandlerFile } from "./dataHandlerUtils";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

export const dataHandlerAsyncRule: Rule = {
  id: "streak:data-handler-async",
  name: "Data Handler Must Be Async",
  description: "Ensures Streak data handler default export is declared async.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(
    sourceFile: SourceFile,
    analysis: AnalysisResult,
    options?: RuleOptions,
  ): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;

    const rawPath = analysis.uri || sourceFile.getFilePath();
    if (!isDataHandlerFile(rawPath)) {
      return diagnostics;
    }

    const handler = getDefaultExportedHandler(sourceFile);
    if (!handler) {
      return diagnostics;
    }

    let isAsync = false;
    if (
      Node.isFunctionDeclaration(handler) ||
      Node.isArrowFunction(handler) ||
      Node.isFunctionExpression(handler)
    ) {
      isAsync = handler.isAsync();
    } else if (Node.isVariableDeclaration(handler)) {
      const init = handler.getInitializer();
      if (
        init &&
        (Node.isArrowFunction(init) || Node.isFunctionExpression(init))
      ) {
        isAsync = init.isAsync();
      }
    }

    if (!isAsync) {
      const range = getRangeFromNode(sourceFile, handler);
      diagnostics.push({
        code: "streak:S202",
        message: "Data handlers must default-export an 'async' function.",
        range,
        severity,
        source: "Streak Engine",
      });
    }

    return diagnostics;
  },
};
