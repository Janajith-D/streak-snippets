import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import * as fs from "node:fs";
import * as path from "node:path";
import { CompletionContext } from "./types";

export interface JsxContext {
  tagName: string;
  attributeName?: string;
  inAttributeValue: boolean;
  attributeValue?: string;
}

// ── Module-level constants ──────────────────────────────────────────────────

/** Matches the first word (tag name) at the start of a text slice. */
const TAG_RE = /^(\w+)/;

/** The JSX tags this extension provides completions for. */
const SUPPORTED_TAGS = new Set([
  "WidgetPlaceholder",
  "Preload",
  "Dynamic",
  "Script",
]);

/** Matches object key lines inside return { ... } blocks, e.g. `  myKey:`. */
const KEY_RE = /^\s*(\w[\w-]*)\s*:/;

/** Framework-reserved keys excluded from widget ID suggestions. */
const EXCLUDED_KEYS = new Set(["status", "PageHead", "data"]);

// ── Private helpers ─────────────────────────────────────────────────────────

/**
 * Returns the JSX tag name found in `text[from..to]` if it is one of the
 * supported tags, or `undefined` otherwise.
 * Extracted to reduce cognitive complexity of getJsxContext.
 */
function parseTagName(
  text: string,
  from: number,
  to: number,
): string | undefined {
  const m = TAG_RE.exec(text.slice(from, to));
  return m && SUPPORTED_TAGS.has(m[1]) ? m[1] : undefined;
}

/**
 * Detects whether the cursor is inside an open attribute value and extracts
 * the attribute name and partial value.
 *
 * Uses `lastIndexOf` + a reverse character scan — pure string operations,
 * O(n), no regex backtracking risk.
 *
 * Returns `{ name, value }` if inside an open attribute value, or `undefined`.
 */
function parseAttrSection(
  attrSection: string,
): { name: string; value: string } | undefined {
  // Find the last unmatched quote (the one opening the current value)
  const lastDq = attrSection.lastIndexOf('"');
  const lastSq = attrSection.lastIndexOf("'");
  const quoteIdx = Math.max(lastDq, lastSq);
  if (quoteIdx === -1) {
    return undefined;
  }

  // Text before the quote, trimmed — must end with '=' to be a valid attr value
  const beforeQuote = attrSection.slice(0, quoteIdx).trimEnd();
  if (!beforeQuote.endsWith("=")) {
    return undefined;
  }

  // Extract the attribute name by scanning backwards from the '='
  const beforeEq = beforeQuote.slice(0, -1).trimEnd();
  let nameStart = beforeEq.length;
  while (nameStart > 0 && /[\w-]/.test(beforeEq[nameStart - 1])) {
    nameStart--;
  }
  const name = beforeEq.slice(nameStart);
  if (!name) {
    return undefined;
  }

  return { name, value: attrSection.slice(quoteIdx + 1) };
}

/**
 * Scans `content` for `return { ... }` blocks and adds non-framework object
 * keys to `ids`. Extracted to reduce cognitive complexity of the traverse
 * closure inside getWidgetIdsFromDataHandlers.
 */
function extractWidgetKeys(content: string, ids: Set<string>): void {
  // Local regex with /g to avoid shared lastIndex state
  const returnBlockRe = /return\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = returnBlockRe.exec(content)) !== null) {
    for (const line of m[1].split(",")) {
      const keyMatch = KEY_RE.exec(line);
      if (keyMatch && !EXCLUDED_KEYS.has(keyMatch[1])) {
        ids.add(keyMatch[1]);
      }
    }
  }
}

/**
 * Builds the markdown documentation string for a widget entry from the registry.
 * Extracted to reduce cognitive complexity of getWidgetPlaceholderTypeCompletions.
 */
function buildWidgetDocumentation(
  widget:
    | {
        docComment?: string;
        props?: Array<{
          name: string;
          isOptional?: boolean;
          type: string;
          docComment?: string;
        }>;
      }
    | undefined,
): string {
  if (!widget) {
    return "";
  }
  let doc = widget.docComment ? `${widget.docComment}\n\n` : "";
  if (widget.props && widget.props.length > 0) {
    doc += "**Available Props:**\n";
    for (const prop of widget.props) {
      const opt = prop.isOptional ? "?" : "";
      const comment = prop.docComment ? ` — ${prop.docComment}` : "";
      doc += `- \`${prop.name}${opt}: ${prop.type}\`${comment}\n`;
    }
  }
  return doc;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parses backwards from cursor offset to see if we are inside a relevant JSX opening tag.
 */
export function getJsxContext(
  text: string,
  offset: number,
): JsxContext | undefined {
  let tagStart = -1;
  let tagName = "";

  for (let i = offset - 1; i >= 0; i--) {
    const char = text[i];
    if (char === ">") {
      return undefined; // We crossed a closing angle bracket — we are outside the opening tag
    }
    if (char === "<") {
      // Reject closing tags (i.e. '</')
      if (i + 1 < text.length && text[i + 1] === "/") {
        return undefined;
      }
      const name = parseTagName(text, i + 1, offset);
      if (name) {
        tagStart = i;
        tagName = name;
        break;
      }
      return undefined; // Some other HTML/JSX tag — not one we handle
    }
  }

  if (tagStart === -1) {
    return undefined;
  }

  const attrSection = text.slice(tagStart + tagName.length + 1, offset);
  // Check if we are inside an unclosed attribute value, e.g. type="something
  const attrResult = parseAttrSection(attrSection);

  if (attrResult) {
    return {
      tagName,
      attributeName: attrResult.name,
      inAttributeValue: true,
      attributeValue: attrResult.value,
    };
  }

  return {
    tagName,
    inAttributeValue: false,
  };
}

/**
 * Scans src/widgets directory and returns file names (minus extensions).
 */
export function getWidgetTypes(
  workspaceRoot: string | undefined,
  customWidgetDir = "src/widgets",
): string[] {
  if (!workspaceRoot) {
    return [];
  }
  const widgetDir = path.join(workspaceRoot, customWidgetDir);
  if (!fs.existsSync(widgetDir)) {
    return [];
  }
  try {
    const files = fs.readdirSync(widgetDir);
    return files
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
      .map((f) => f.replace(/\.[^/.]+$/, ""));
  } catch {
    return [];
  }
}

/**
 * Scans the workspace /public directory recursively and returns all asset paths.
 */
export function getPublicAssets(
  workspaceRoot: string | undefined,
  customPublicDir = "public",
): string[] {
  if (!workspaceRoot) {
    return [];
  }
  const publicDir = path.join(workspaceRoot, customPublicDir);
  if (!fs.existsSync(publicDir)) {
    return [];
  }
  const results: string[] = [];

  function traverse(dir: string, base: string) {
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const relativePath = path.join(base, file).replaceAll("\\", "/");
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          traverse(fullPath, relativePath);
        } else {
          results.push("/" + relativePath);
        }
      }
    } catch {
      // Ignore
    }
  }

  traverse(publicDir, "");
  return results;
}

/**
 * Scans pages or handlers in src/pages directory and collects return keys as Widget IDs.
 */
export function getWidgetIdsFromDataHandlers(
  workspaceRoot: string | undefined,
): string[] {
  if (!workspaceRoot) {
    return [];
  }
  const ids = new Set<string>();
  const pagesDir = path.join(workspaceRoot, "src/pages");

  if (!fs.existsSync(pagesDir)) {
    return [];
  }

  function traverse(dir: string) {
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          // Delegate key extraction to a dedicated helper to keep CC low
          const content = fs.readFileSync(fullPath, "utf-8");
          extractWidgetKeys(content, ids);
        }
      }
    } catch {
      // Ignore
    }
  }

  traverse(pagesDir);
  return Array.from(ids);
}

/**
 * Collects Dynamic IDs inside the workspace files and current file.
 */
export function getDynamicComponentIds(
  workspaceRoot: string | undefined,
  currentFileText: string,
): string[] {
  const ids = new Set<string>();
  // Non-backtracking pattern: [^>]*? (lazy) + \b avoids super-linear runtime
  const dynamicIdRe = /<Dynamic\b[^>]*?\bid=["']([^"']+)["']/g;

  // 1. Scan current file
  for (const m of currentFileText.matchAll(dynamicIdRe)) {
    ids.add(m[1]);
  }

  // 2. Scan src/ for TSX files
  if (workspaceRoot) {
    const srcDir = path.join(workspaceRoot, "src");
    if (fs.existsSync(srcDir)) {
      function traverse(dir: string) {
        try {
          const list = fs.readdirSync(dir);
          for (const file of list) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              traverse(fullPath);
            } else if (file.endsWith(".tsx")) {
              const content = fs.readFileSync(fullPath, "utf-8");
              if (content.includes("<Dynamic")) {
                for (const m of content.matchAll(
                  /<Dynamic\b[^>]*?\bid=["']([^"']+)["']/g,
                )) {
                  ids.add(m[1]);
                }
              }
            }
          }
        } catch {
          // Ignore
        }
      }
      traverse(srcDir);
    }
  }

  return Array.from(ids);
}

export function getJsxAttributeCompletions(
  context: CompletionContext,
  workspaceRoot: string | undefined,
  customWidgetDir?: string,
  customPublicDir?: string,
): CompletionItem[] {
  const jsxCtx = getJsxContext(context.text, context.offset);
  if (!jsxCtx) {
    return [];
  }

  const { tagName, attributeName, inAttributeValue } = jsxCtx;

  // 1. Autocomplete attribute names
  if (!inAttributeValue) {
    return getAttributeNameCompletions(tagName);
  }

  // 2. Autocomplete attribute values
  return getAttributeValueCompletions(
    tagName,
    attributeName,
    workspaceRoot,
    customWidgetDir,
    customPublicDir,
    context,
  );
}

function getAttributeNameCompletions(tagName: string): CompletionItem[] {
  let attributes: string[] = [];
  if (tagName === "WidgetPlaceholder") {
    attributes = ["id", "type"];
  } else if (tagName === "Preload") {
    attributes = ["href", "as", "media", "crossOrigin"];
  } else if (tagName === "Dynamic") {
    attributes = ["id", "component", "data"];
  } else if (tagName === "Script") {
    attributes = ["id", "options"];
  }

  return attributes.map((attr) => ({
    label: attr,
    kind: CompletionItemKind.Property,
    insertText: `${attr}=""`,
  }));
}

function getAttributeValueCompletions(
  tagName: string,
  attributeName: string | undefined,
  workspaceRoot: string | undefined,
  customWidgetDir: string | undefined,
  customPublicDir: string | undefined,
  context: CompletionContext,
): CompletionItem[] {
  if (tagName === "WidgetPlaceholder") {
    if (attributeName === "type") {
      return getWidgetPlaceholderTypeCompletions(
        workspaceRoot,
        customWidgetDir,
      );
    }
    if (attributeName === "id") {
      return getWidgetPlaceholderIdCompletions(workspaceRoot);
    }
  }

  if (tagName === "Preload") {
    if (attributeName === "as") {
      return getPreloadAsCompletions();
    }
    if (attributeName === "href") {
      return getPreloadHrefCompletions(workspaceRoot, customPublicDir);
    }
  }

  if (tagName === "Dynamic" && attributeName === "id") {
    return getDynamicIdCompletions(workspaceRoot, context.text);
  }

  return [];
}

function getWidgetPlaceholderTypeCompletions(
  workspaceRoot: string | undefined,
  customWidgetDir: string | undefined,
): CompletionItem[] {
  const widgetTypes = getWidgetTypes(workspaceRoot, customWidgetDir);
  const { widgetRegistry } = require("../registry/widgets");

  return widgetTypes.map((type) => {
    const widget = widgetRegistry.get(type);
    const detail = "Custom Project Widget";
    const documentation = buildWidgetDocumentation(widget);

    return {
      label: type,
      kind: CompletionItemKind.Value,
      insertText: type,
      detail,
      documentation: documentation
        ? { kind: "markdown", value: documentation }
        : undefined,
    };
  });
}

function getWidgetPlaceholderIdCompletions(
  workspaceRoot: string | undefined,
): CompletionItem[] {
  const widgetIds = getWidgetIdsFromDataHandlers(workspaceRoot);
  return widgetIds.map((id) => ({
    label: id,
    kind: CompletionItemKind.Value,
    insertText: id,
  }));
}

function getPreloadAsCompletions(): CompletionItem[] {
  const asValues = ["image", "font", "style", "script", "video"];
  return asValues.map((val) => ({
    label: val,
    kind: CompletionItemKind.Value,
    insertText: val,
  }));
}

function getPreloadHrefCompletions(
  workspaceRoot: string | undefined,
  customPublicDir: string | undefined,
): CompletionItem[] {
  const assets = getPublicAssets(workspaceRoot, customPublicDir);
  return assets.map((asset) => ({
    label: asset,
    kind: CompletionItemKind.File,
    insertText: asset,
  }));
}

function getDynamicIdCompletions(
  workspaceRoot: string | undefined,
  text: string,
): CompletionItem[] {
  const dynamicIds = getDynamicComponentIds(workspaceRoot, text);
  return dynamicIds.map((id) => ({
    label: id,
    kind: CompletionItemKind.Value,
    insertText: id,
  }));
}
