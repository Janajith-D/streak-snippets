import { SyntaxKind, type SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { AnalysisResult } from "../../shared/types";
import {
  getRangeFromNode,
  type Rule,
  type RuleDiagnostic,
  type RuleOptions,
} from "./types";

const DISALLOWED_HOOKS = new Set([
  "useState",
  "useEffect",
  "useRef",
  "useMemo",
  "useCallback",
  "useContext",
  "useReducer",
  "useLayoutEffect",
  "useImperativeHandle",
  "useId",
]);

export const reactHooksNotAllowedRule: Rule = {
  id: "streak:react-hooks-not-allowed",
  name: "React Hooks Not Allowed",
  description:
    "Ensures Streak static widgets do not use React runtime hooks (useState, useEffect, etc.).",
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

    const callExprs = sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression,
    );
    for (const call of callExprs) {
      const expression = call.getExpression();
      const calleeText = expression.getText();

      // Check if call is useXxx(...) or React.useXxx(...)
      const hookName = calleeText.startsWith("React.")
        ? calleeText.slice(6)
        : calleeText;

      if (DISALLOWED_HOOKS.has(hookName)) {
        const range = getRangeFromNode(sourceFile, call);
        diagnostics.push({
          code: "streak:S302",
          message: `React runtime hook '${hookName}' is not allowed in static Streak widgets.`,
          range,
          severity,
          source: "Streak Engine",
        });
      }
    }

    return diagnostics;
  },
};
