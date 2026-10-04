import { Node, SyntaxKind, type CallExpression, type SourceFile, type StringLiteral } from "ts-morph";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AnalysisResult } from "../../shared/types";
import { runtimePackageRegistry } from "../registry/packages";
import { findStreakProjectRoot } from "../registry/scanner";
import { getRangeFromNode, type Rule, type RuleDiagnostic, type RuleOptions } from "./types";

export interface PackageCallInfo {
  callNode: CallExpression;
  argNode: StringLiteral;
  rawPath: string;
}

export function isLoadPackageCall(call: CallExpression): boolean {
  const expr = call.getExpression();
  if (Node.isIdentifier(expr) && expr.getText() === "loadPackage") {
    return true;
  }
  if (Node.isPropertyAccessExpression(expr)) {
    const name = expr.getName();
    const caller = expr.getExpression().getText();
    if (name === "loadPackage" && (caller === "gDom" || caller.endsWith(".gDom"))) {
      return true;
    }
  }
  return false;
}

export function extractLoadPackageCalls(sourceFile: SourceFile): PackageCallInfo[] {
  const calls: PackageCallInfo[] = [];
  const callNodes = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callNodes) {
    if (isLoadPackageCall(call)) {
      const args = call.getArguments();
      if (args.length > 0 && Node.isStringLiteral(args[0])) {
        calls.push({
          callNode: call,
          argNode: args[0],
          rawPath: args[0].getLiteralValue(),
        });
      }
    }
  }
  return calls;
}

function resolvePackageExistsOnDisk(uri: string, relativePath: string): boolean {
  if (!uri.startsWith("file:")) {
    return false;
  }
  try {
    const projectRoot = findStreakProjectRoot(uri);
    if (!projectRoot) {
      return false;
    }
    const candidate = path.join(projectRoot, "public", "assets", relativePath);
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

export const packageInvalidExtensionRule: Rule = {
  id: "streak:package-invalid-extension",
  name: "Package Invalid Extension Rule",
  description: "Flags runtime package references that do not end with .js.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;
    const calls = extractLoadPackageCalls(sourceFile);

    for (const { argNode, rawPath } of calls) {
      if (rawPath.length > 0 && !rawPath.endsWith(".js")) {
        diagnostics.push({
          code: "streak:S410",
          message: `Runtime package must be a JavaScript file ending with .js (found "${rawPath}").`,
          range: getRangeFromNode(sourceFile, argNode),
          severity,
          source: "Streak Engine",
        });
      }
    }
    return diagnostics;
  },
};

export const packageAbsolutePathRule: Rule = {
  id: "streak:package-absolute-path",
  name: "Package Absolute Path Rule",
  description: "Flags package paths starting with /assets/ or /.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;
    const calls = extractLoadPackageCalls(sourceFile);

    for (const { argNode, rawPath } of calls) {
      if (rawPath.startsWith("/assets/") || rawPath.startsWith("/")) {
        const fixedPath = rawPath.startsWith("/assets/")
          ? rawPath.slice("/assets/".length)
          : rawPath.replace(/^\/+/, "");
        diagnostics.push({
          code: "streak:S408",
          message: `Package path must be relative to public/assets/, do not include leading '/' or '/assets/'. Use '${fixedPath}'.`,
          range: getRangeFromNode(sourceFile, argNode),
          severity,
          source: "Streak Engine",
          data: { fixedPath },
        });
      }
    }
    return diagnostics;
  },
};

export const packagePublicPathRule: Rule = {
  id: "streak:package-public-path",
  name: "Package Public Path Rule",
  description: "Flags package paths prefixed with public/ or public/assets/.",
  defaultSeverity: DiagnosticSeverity.Error,

  run(sourceFile: SourceFile, _analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;
    const calls = extractLoadPackageCalls(sourceFile);

    for (const { argNode, rawPath } of calls) {
      if (rawPath.startsWith("public/assets/") || rawPath.startsWith("public/")) {
        const fixedPath = rawPath.startsWith("public/assets/")
          ? rawPath.slice("public/assets/".length)
          : rawPath.slice("public/".length);
        diagnostics.push({
          code: "streak:S409",
          message: `Package path must be relative to public/assets/, do not include 'public/' or 'public/assets/'. Use '${fixedPath}'.`,
          range: getRangeFromNode(sourceFile, argNode),
          severity,
          source: "Streak Engine",
          data: { fixedPath },
        });
      }
    }
    return diagnostics;
  },
};

export const packageNotFoundRule: Rule = {
  id: "streak:package-not-found",
  name: "Package Not Found Rule",
  description: "Flags runtime packages that do not exist under public/assets/.",
  defaultSeverity: DiagnosticSeverity.Warning,

  run(sourceFile: SourceFile, analysis: AnalysisResult, options?: RuleOptions): RuleDiagnostic[] {
    const diagnostics: RuleDiagnostic[] = [];
    const severity = options?.severity ?? this.defaultSeverity;
    const calls = extractLoadPackageCalls(sourceFile);

    for (const { argNode, rawPath } of calls) {
      // Skip if path is invalid format (other rules handle those)
      if (
        !rawPath.endsWith(".js") ||
        rawPath.startsWith("/") ||
        rawPath.startsWith("public/")
      ) {
        continue;
      }

      const normalized = rawPath.replaceAll("\\", "/").replace(/^\.?\//, "");
      if (runtimePackageRegistry.get(normalized)) {
        continue;
      }

      if (resolvePackageExistsOnDisk(analysis.uri, normalized)) {
        continue;
      }

      diagnostics.push({
        code: "streak:S407",
        message: `Runtime package '${rawPath}' not found in public/assets/.`,
        range: getRangeFromNode(sourceFile, argNode),
        severity,
        source: "Streak Engine",
      });
    }
    return diagnostics;
  },
};
