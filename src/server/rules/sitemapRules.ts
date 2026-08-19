import { type Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { sitemapRegistry, type SitemapPage } from "../registry/sitemaps";
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
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
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

function collectUrl(page: SitemapPage, seenUrls: Map<string, { start: number; end: number }[]>) {
  if (page.url && page.urlStart !== undefined && page.urlEnd !== undefined) {
    if (!seenUrls.has(page.url)) {
      seenUrls.set(page.url, []);
    }
    seenUrls.get(page.url)?.push({ start: page.urlStart, end: page.urlEnd });
  }
}

function collectRenderId(page: SitemapPage, seenRenderIds: Map<string, { start: number; end: number }[]>) {
  if (page.renderId && page.renderIdStart !== undefined && page.renderIdEnd !== undefined) {
    if (!seenRenderIds.has(page.renderId)) {
      seenRenderIds.set(page.renderId, []);
    }
    seenRenderIds.get(page.renderId)?.push({ start: page.renderIdStart, end: page.renderIdEnd });
  }
}

function getSeverity(
  ruleId: string,
  ruleSeverities: Record<string, string> | undefined,
  defaultSeverity: DiagnosticSeverity,
): DiagnosticSeverity | null {
  const sevStr = ruleSeverities?.[ruleId]?.toLowerCase();
  if (sevStr === "off") {
    return null;
  }
  if (sevStr === "error") {
    return DiagnosticSeverity.Error;
  }
  if (sevStr === "warning") {
    return DiagnosticSeverity.Warning;
  }
  if (sevStr === "info" || sevStr === "information") {
    return DiagnosticSeverity.Information;
  }
  return defaultSeverity;
}

function reportDuplicateUrls(
  seenUrls: Map<string, { start: number; end: number }[]>,
  document: TextDocument,
  diagnostics: Diagnostic[],
  ruleSeverities?: Record<string, string>,
) {
  const severity = getSeverity("streak:duplicate-route", ruleSeverities, DiagnosticSeverity.Error);
  if (severity === null) {
    return;
  }
  for (const [url, occurrences] of seenUrls.entries()) {
    if (occurrences.length > 1) {
      for (const occ of occurrences) {
        diagnostics.push({
          code: "streak:S901",
          message: `Duplicate route detected: "${url}".`,
          range: {
            start: document.positionAt(occ.start),
            end: document.positionAt(occ.end),
          },
          severity,
          source: "Streak Engine",
        });
      }
    }
  }
}

function reportDuplicateRenderIds(
  seenRenderIds: Map<string, { start: number; end: number }[]>,
  document: TextDocument,
  diagnostics: Diagnostic[],
  ruleSeverities?: Record<string, string>,
) {
  const severity = getSeverity("streak:duplicate-render-id", ruleSeverities, DiagnosticSeverity.Error);
  if (severity === null) {
    return;
  }
  for (const [renderId, occurrences] of seenRenderIds.entries()) {
    if (occurrences.length > 1) {
      for (const occ of occurrences) {
        diagnostics.push({
          code: "streak:S905",
          message: `Duplicate renderId detected: "${renderId}".`,
          range: {
            start: document.positionAt(occ.start),
            end: document.positionAt(occ.end),
          },
          severity,
          source: "Streak Engine",
        });
      }
    }
  }
}

function validatePageWidgets(
  page: SitemapPage,
  document: TextDocument,
  diagnostics: Diagnostic[],
  ruleSeverities?: Record<string, string>,
) {
  const severity = getSeverity("streak:missing-widget", ruleSeverities, DiagnosticSeverity.Error);
  if (severity === null) {
    return;
  }
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
        severity,
        source: "Streak Engine",
        data: {
          invalidWidget: w.type,
          suggestions,
        },
      });
    }
  }
}

function validatePageHandler(
  page: SitemapPage,
  document: TextDocument,
  workspaceRoot: string,
  diagnostics: Diagnostic[],
  ruleSeverities?: Record<string, string>,
) {
  const severity = getSeverity("streak:missing-handler", ruleSeverities, DiagnosticSeverity.Warning);
  if (severity === null) {
    return;
  }
  if (page.handler && page.handlerStart !== undefined && page.handlerEnd !== undefined) {
    const handlerName = page.handler;
    const candidateDirs = [
      path.join(workspaceRoot, "src", "handler"),
      path.join(workspaceRoot, "src", "handlers"),
    ];
    let found = false;
    for (const dir of candidateDirs) {
      if (fs.existsSync(path.join(dir, `${handlerName}.ts`))) {
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
        message: `Data handler "${handlerName}" does not exist in src/handler or src/handlers.`,
        range,
        severity,
        source: "Streak Engine",
      });
    }
  }
}

function validatePageLayout(
  page: SitemapPage,
  document: TextDocument,
  workspaceRoot: string,
  diagnostics: Diagnostic[],
  ruleSeverities?: Record<string, string>,
) {
  const severity = getSeverity("streak:missing-layout", ruleSeverities, DiagnosticSeverity.Warning);
  if (severity === null) {
    return;
  }
  if (page.layout && page.layoutStart !== undefined && page.layoutEnd !== undefined) {
    const layoutName = page.layout;
    const candidateDirs = [
      path.join(workspaceRoot, "src", "layout"),
      path.join(workspaceRoot, "src", "layouts"),
    ];
    let found = false;
    for (const dir of candidateDirs) {
      if (fs.existsSync(path.join(dir, `${layoutName}.tsx`))) {
        found = true;
        break;
      }
    }

    if (!found) {
      const range = {
        start: document.positionAt(page.layoutStart),
        end: document.positionAt(page.layoutEnd),
      };
      diagnostics.push({
        code: "streak:S906",
        message: `Layout "${layoutName}" does not exist in src/layout or src/layouts.`,
        range,
        severity,
        source: "Streak Engine",
      });
    }
  }
}

function validateWidgetLoadingStrategy(
  page: SitemapPage,
  document: TextDocument,
  diagnostics: Diagnostic[],
  ruleSeverities?: Record<string, string>,
) {
  const severity = getSeverity("streak:invalid-loading-strategy", ruleSeverities, DiagnosticSeverity.Warning);
  if (severity === null) {
    return;
  }
  for (const w of page.widgets) {
    if (w.loadingStrategy !== undefined && w.loadingStrategy !== "lazy") {
      const range = {
        start: document.positionAt(w.loadingStrategyStart ?? w.start),
        end: document.positionAt(w.loadingStrategyEnd ?? w.end),
      };
      diagnostics.push({
        code: "streak:S907",
        message: `Invalid loadingStrategy "${w.loadingStrategy}". Allowed value is "lazy".`,
        range,
        severity,
        source: "Streak Engine",
      });
    }
  }
}

export function validateSitemap(
  document: TextDocument,
  workspaceRoot: string,
  ruleSeverities?: Record<string, string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = document.getText();

  sitemapRegistry.parseAndRegister(document.uri, text);
  const pages = sitemapRegistry.getPages();

  const seenUrls = new Map<string, { start: number; end: number }[]>();
  const seenRenderIds = new Map<string, { start: number; end: number }[]>();

  for (const page of pages) {
    collectUrl(page, seenUrls);
    collectRenderId(page, seenRenderIds);
    validatePageWidgets(page, document, diagnostics, ruleSeverities);
    validateWidgetLoadingStrategy(page, document, diagnostics, ruleSeverities);
    validatePageHandler(page, document, workspaceRoot, diagnostics, ruleSeverities);
    validatePageLayout(page, document, workspaceRoot, diagnostics, ruleSeverities);
  }

  reportDuplicateUrls(seenUrls, document, diagnostics, ruleSeverities);
  reportDuplicateRenderIds(seenRenderIds, document, diagnostics, ruleSeverities);

  return diagnostics;
}
