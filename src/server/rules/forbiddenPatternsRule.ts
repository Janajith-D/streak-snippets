import { SourceFile } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import { AnalysisResult } from "../../shared/types";
import { Rule, RuleDiagnostic, RuleOptions } from "./types";

export const forbiddenPatternsRule: Rule = {
  id: "streak:forbidden-patterns",
  name: "Forbidden Patterns Rule",
  description: "Flags occurrences of configured banned regex patterns in project source code.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;
    const forbidden: string[] = (options as any)?.ruleOptions?.forbiddenPatterns ?? [];

    if (forbidden.length === 0) {
      return diagnostics;
    }

    const text = sourceFile.getFullText();

    for (const pattern of forbidden) {
      try {
        const regex = new RegExp(pattern, "g");
        let match;
        // Reset lastIndex to prevent infinite loops
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
          const matchIndex = match.index;
          const matchText = match[0];

          if (matchText.length === 0) {
            // Prevent infinite loop on empty match
            regex.lastIndex++;
            continue;
          }

          const prefix = text.substring(0, matchIndex);
          const lines = prefix.split("\n");
          const startLine = lines.length - 1;
          const startChar = lines[lines.length - 1].length;

          const matchLines = matchText.split("\n");
          const endLine = startLine + matchLines.length - 1;
          const endChar =
            matchLines.length > 1
              ? matchLines[matchLines.length - 1].length
              : startChar + matchText.length;

          diagnostics.push({
            code: "streak:S702",
            message: `Banned code pattern matched forbidden expression /${pattern}/.`,
            range: {
              start: { line: startLine, character: startChar },
              end: { line: endLine, character: endChar },
            },
            severity,
            source: "Streak Engine",
          });
        }
      } catch {
        // Ignore invalid regexes
      }
    }

    return diagnostics;
  },
};
