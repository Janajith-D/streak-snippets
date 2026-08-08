import { type Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { sitemapRegistry } from "../registry/sitemaps";
import { widgetRegistry } from "../registry/widgets";
import * as path from "node:path";
import * as fs from "node:fs";

// Levenshtein distance for close match suggestions
export function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

export function getClosestWidgetMatches(name: string): string[] {
  const allNames = widgetRegistry.getAll().map((w) => w.name);
  return allNames
    .map((n) => ({ name: n, dist: getLevenshteinDistance(name, n) }))
    .filter((x) => x.dist <= 4)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((x) => x.name);
}

export function validateSitemap(
  document: TextDocument,
  workspaceRoot: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = document.getText();

  // Re-parse and update registry dynamically
  sitemapRegistry.parseAndRegister(document.uri, text);
  const pages = sitemapRegistry.getPages();

  const seenUrls = new Map<string, { start: number; end: number }[]>();

  for (const page of pages) {
    // 1. Collect URLs for duplication check
    if (page.url && page.urlStart !== undefined && page.urlEnd !== undefined) {
      if (!seenUrls.has(page.url)) {
        seenUrls.set(page.url, []);
      }
      const occs = seenUrls.get(page.url);
      if (occs) {
        occs.push({ start: page.urlStart, end: page.urlEnd });
      }
    }

    // 2. Validate widget types
    for (const w of page.widgets) {
      if (!widgetRegistry.get(w.type)) {
        const range = {
          start: document.positionAt(w.start),
          end: document.positionAt(w.end),
        };
        const suggestions = getClosestWidgetMatches(w.type);
        const suggestionText =
          suggestions.length > 0 ? ` Did you mean: ${suggestions.join(", ")}?` : "";

        diagnostics.push({
          code: "streak:S902",
          message: `Widget "${w.type}" does not exist.${suggestionText}`,
          range,
          severity: DiagnosticSeverity.Error,
          source: "Streak Engine",
          data: {
            invalidWidget: w.type,
            suggestions,
          },
        });
      }
    }

    // 3. Validate handlers
    if (page.handler && page.handlerStart !== undefined && page.handlerEnd !== undefined) {
      const handlerName = page.handler;
      const handlerDir = path.join(workspaceRoot, "src", "handlers");
      let found = false;
      for (const ext of [".ts", ".js", ".tsx", ".jsx"]) {
        if (fs.existsSync(path.join(handlerDir, `${handlerName}${ext}`))) {
          found = true;
          break;
        }
      }

      if (!found) {
        const range = {
          start: document.positionAt(page.handlerStart),
          end: document.positionAt(page.handlerEnd),
        };
        diagnostics.push({
          code: "streak:S903",
          message: `Handler "${handlerName}" does not exist.`,
          range,
          severity: DiagnosticSeverity.Error,
          source: "Streak Engine",
        });
      }
    }
  }

  // 4. Report duplicate route diagnostics
  for (const [url, occurrences] of seenUrls.entries()) {
    if (occurrences.length > 1) {
      for (const occ of occurrences) {
        const range = {
          start: document.positionAt(occ.start),
          end: document.positionAt(occ.end),
        };
        diagnostics.push({
          code: "streak:S901",
          message: `Duplicate route detected: "${url}".`,
          range,
          severity: DiagnosticSeverity.Error,
          source: "Streak Engine",
        });
      }
    }
  }

  return diagnostics;
}
