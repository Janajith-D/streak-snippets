import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import * as fs from "fs";
import * as path from "path";
import { CompletionContext } from "./types";

export interface JsxContext {
  tagName: string;
  attributeName?: string;
  inAttributeValue: boolean;
  attributeValue?: string;
}

/**
 * Parses backwards from cursor offset to see if we are inside a relevant JSX opening tag.
 */
export function getJsxContext(text: string, offset: number): JsxContext | undefined {
  let tagStart = -1;
  let tagName = "";

  for (let i = offset - 1; i >= 0; i--) {
    const char = text[i];
    if (char === ">") {
      return undefined; // We crossed a closing angle bracket, so we are outside the opening tag
    }
    if (char === "<") {
      // Check if it's not a closing tag start (i.e. not '</')
      if (i + 1 < text.length && text[i + 1] === "/") {
        return undefined;
      }
      const match = text.slice(i + 1, offset).match(/^([A-Za-z0-9_]+)/);
      if (match) {
        const name = match[1];
        if (["WidgetPlaceholder", "Preload", "Dynamic", "Script"].includes(name)) {
          tagStart = i;
          tagName = name;
          break;
        }
      }
      return undefined; // Some other HTML/JSX tag
    }
  }

  if (tagStart === -1) {
    return undefined;
  }

  const attrSection = text.slice(tagStart + tagName.length + 1, offset);
  // Check if we are inside an unclosed attribute value, e.g. type="something
  const attrMatch = attrSection.match(/([a-zA-Z0-9_-]+)\s*=\s*["']([^"']*)$/);

  if (attrMatch) {
    return {
      tagName,
      attributeName: attrMatch[1],
      inAttributeValue: true,
      attributeValue: attrMatch[2],
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
export function getWidgetTypes(workspaceRoot: string | undefined): string[] {
  if (!workspaceRoot) {
    return [];
  }
  // Try to read settings or default to src/widgets
  const widgetDir = path.join(workspaceRoot, "src/widgets");
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
export function getPublicAssets(workspaceRoot: string | undefined): string[] {
  if (!workspaceRoot) {
    return [];
  }
  const publicDir = path.join(workspaceRoot, "public");
  if (!fs.existsSync(publicDir)) {
    return [];
  }
  const results: string[] = [];

  function traverse(dir: string, base: string) {
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const relativePath = path.join(base, file).replace(/\\/g, "/");
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
export function getWidgetIdsFromDataHandlers(workspaceRoot: string | undefined): string[] {
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
          const content = fs.readFileSync(fullPath, "utf-8");
          // Extract object keys from return { ... } inside data handler function
          const returnMatches = content.matchAll(/return\s*\{([^}]+)\}/g);
          for (const m of returnMatches) {
            const body = m[1];
            // Split by comma and find keys
            const lines = body.split(",");
            for (const line of lines) {
              const keyMatch = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:/);
              if (keyMatch) {
                const key = keyMatch[1].trim();
                // Exclude framework keys
                if (key !== "status" && key !== "PageHead" && key !== "data") {
                  ids.add(key);
                }
              }
            }
          }
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
  currentFileText: string
): string[] {
  const ids = new Set<string>();

  // 1. Scan current file
  const currentMatches = currentFileText.matchAll(/<Dynamic\s+[^>]*id=["']([^"']+)["']/g);
  for (const m of currentMatches) {
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
                const matches = content.matchAll(/<Dynamic\s+[^>]*id=["']([^"']+)["']/g);
                for (const m of matches) {
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
  workspaceRoot: string | undefined
): CompletionItem[] {
  const jsxCtx = getJsxContext(context.text, context.offset);
  if (!jsxCtx) {
    return [];
  }

  const { tagName, attributeName, inAttributeValue } = jsxCtx;

  // 1. Autocomplete attribute names
  if (!inAttributeValue) {
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

  // 2. Autocomplete attribute values
  if (tagName === "WidgetPlaceholder" && attributeName === "type") {
    const widgetTypes = getWidgetTypes(workspaceRoot);
    return widgetTypes.map((type) => ({
      label: type,
      kind: CompletionItemKind.Value,
      insertText: type,
    }));
  }

  if (tagName === "WidgetPlaceholder" && attributeName === "id") {
    const widgetIds = getWidgetIdsFromDataHandlers(workspaceRoot);
    return widgetIds.map((id) => ({
      label: id,
      kind: CompletionItemKind.Value,
      insertText: id,
    }));
  }

  if (tagName === "Preload" && attributeName === "as") {
    const asValues = ["image", "font", "style", "script", "video"];
    return asValues.map((val) => ({
      label: val,
      kind: CompletionItemKind.Value,
      insertText: val,
    }));
  }

  if (tagName === "Preload" && attributeName === "href") {
    const assets = getPublicAssets(workspaceRoot);
    return assets.map((asset) => ({
      label: asset,
      kind: CompletionItemKind.File,
      insertText: asset,
    }));
  }

  if (tagName === "Dynamic" && attributeName === "id") {
    const dynamicIds = getDynamicComponentIds(workspaceRoot, context.text);
    return dynamicIds.map((id) => ({
      label: id,
      kind: CompletionItemKind.Value,
      insertText: id,
    }));
  }

  return [];
}
