import { Node, Project, ScriptTarget } from "ts-morph";
import { Location, Range } from "vscode-languageserver/node";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { sitemapRegistry, type SitemapPage } from "../registry/sitemaps";
import { type TextDocument } from "vscode-languageserver-textdocument";

// Single shared project to avoid redundant ts-morph Project creation overhead
const defProject = new Project({
  compilerOptions: {
    target: ScriptTarget.ES2022,
    allowJs: true,
  },
});

// ── Private helpers ───────────────────────────────────────────────────────────

/** Counter used to create unique temp file names without Math.random(). */
let _tempFileCounter = 0;

async function findFiles(dir: string, ext: string): Promise<string[]> {
  let results: string[] = [];
  try {
    const list = await fs.promises.readdir(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = await fs.promises.stat(filePath);
      if (stat?.isDirectory()) {
        if (
          file !== "node_modules" &&
          file !== ".git" &&
          file !== "dist" &&
          file !== "out" &&
          file !== ".vscode"
        ) {
          results = results.concat(await findFiles(filePath, ext));
        }
      } else if (filePath.endsWith(ext)) {
        results.push(filePath);
      }
    }
  } catch {
    // Ignore read errors
  }
  return results;
}

/**
 * Returns true if `parent` is a call expression of `gDom.loadDynamicComponent(...)`.
 * Extracted to reduce cognitive complexity of resolveDefinition.
 */
function isLoadDynamicComponentCall(parent: Node | undefined): boolean {
  if (!parent || !Node.isCallExpression(parent)) {
    return false;
  }
  const callExpr = parent.getExpression();
  if (!Node.isPropertyAccessExpression(callExpr)) {
    return false;
  }
  return (
    callExpr.getExpression().getText() === "gDom" &&
    callExpr.getName() === "loadDynamicComponent"
  );
}

/**
 * Scans one file for a `<Dynamic id="value">` tag and returns its LSP Location.
 * Extracted to reduce cognitive complexity of resolveLoadDynamicDefinition.
 */
async function findDynamicTagLocation(
  filePath: string,
  value: string,
): Promise<Location | null> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    if (!content.includes("Dynamic") || !content.includes(value)) {
      return null;
    }

    // Use a stable, non-random temp file name
    const tempName = `def_${Date.now()}_${++_tempFileCounter}.temp.tsx`;
    const tempFile = defProject.createSourceFile(tempName, content);
    let foundLocation: Location | null = null;

    tempFile.forEachDescendant((child) => {
      if (
        !Node.isJsxOpeningElement(child) &&
        !Node.isJsxSelfClosingElement(child)
      ) {
        return;
      }
      if (child.getTagNameNode().getText() !== "Dynamic") {
        return;
      }
      const idAttr = child.getAttribute("id");
      if (!idAttr || !Node.isJsxAttribute(idAttr)) {
        return;
      }
      const init = idAttr.getInitializer();
      if (!init) {
        return;
      }

      let idVal = "";
      if (Node.isStringLiteral(init)) {
        idVal = init.getLiteralValue();
      } else if (Node.isJsxExpression(init)) {
        const expr = init.getExpression();
        if (expr && Node.isStringLiteral(expr)) {
          idVal = expr.getLiteralValue();
        }
      }

      if (idVal !== value) {
        return;
      }

      const start = child.getStart();
      const end = child.getEnd();
      const startLines = content.substring(0, start).split(/\r?\n/);
      const startLine = Math.max(0, startLines.length - 1);
      const startChar = Math.max(0, startLines.at(-1)?.length ?? 0);
      const endLines = content.substring(0, end).split(/\r?\n/);
      const endLine = Math.max(0, endLines.length - 1);
      const endChar = Math.max(0, endLines.at(-1)?.length ?? 0);

      foundLocation = Location.create(
        pathToFileURL(filePath).toString(),
        Range.create(startLine, startChar, endLine, endChar),
      );
    });

    tempFile.delete();
    return foundLocation;
  } catch {
    return null;
  }
}

/**
 * Scans the workspace for a `<Dynamic id="value">` element and returns its location.
 * Extracted to reduce cognitive complexity of resolveDefinition.
 */
async function resolveLoadDynamicDefinition(
  value: string,
  workspaceRoot: string,
): Promise<Location | null> {
  const files = await findFiles(workspaceRoot, ".tsx");
  for (const filePath of files) {
    const loc = await findDynamicTagLocation(filePath, value);
    if (loc) {
      return loc;
    }
  }
  return null;
}

/**
 * Jump to Widget source file for a WidgetPlaceholder type attribute.
 * Extracted to reduce cognitive complexity of resolveJsxAttrDefinition.
 */
function resolveWidgetTypeDefinition(
  value: string,
  workspaceRoot: string,
  customWidgetDir = "src/widgets",
): Location | null {
  const baseWidgetPath = path.join(workspaceRoot, customWidgetDir, value);
  for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
    const fullPath = baseWidgetPath + ext;
    if (fs.existsSync(fullPath)) {
      return Location.create(
        pathToFileURL(fullPath).toString(),
        Range.create(0, 0, 0, 0),
      );
    }
  }
  return null;
}

/**
 * Jump to public asset file for a Preload href attribute.
 * Extracted to reduce cognitive complexity of resolveJsxAttrDefinition.
 */
function resolvePreloadHrefDefinition(
  value: string,
  workspaceRoot: string,
  customPublicDir = "public",
): Location | null {
  const cleanHref = value.startsWith("/") ? value.substring(1) : value;
  const fullPath = path.join(workspaceRoot, customPublicDir, cleanHref);
  if (fs.existsSync(fullPath)) {
    return Location.create(
      pathToFileURL(fullPath).toString(),
      Range.create(0, 0, 0, 0),
    );
  }
  return null;
}

/**
 * Handles F12/Go-to-definition for JSX attribute values:
 * - WidgetPlaceholder type → widget source file
 * - Preload href → public asset file
 *
 * Extracted to reduce cognitive complexity of resolveDefinition.
 */
function resolveJsxAttrDefinition(
  node: Node,
  value: string,
  workspaceRoot: string,
  customWidgetDir?: string,
  customPublicDir?: string,
): Location | null {
  const parent = node.getParent();

  let jsxAttr: Node | undefined = parent;
  if (jsxAttr?.getKindName() === "JsxExpression") {
    jsxAttr = jsxAttr.getParent();
  }
  if (!jsxAttr || !Node.isJsxAttribute(jsxAttr)) {
    return null;
  }

  const attributeName = jsxAttr.getNameNode().getText();
  let tagNode: Node | undefined = jsxAttr.getParent();
  if (tagNode?.getKindName() === "JsxAttributes") {
    tagNode = tagNode.getParent();
  }
  if (
    !tagNode ||
    (!Node.isJsxOpeningElement(tagNode) &&
      !Node.isJsxSelfClosingElement(tagNode))
  ) {
    return null;
  }

  const tagName = tagNode.getTagNameNode().getText();

  if (tagName === "WidgetPlaceholder" && attributeName === "type") {
    return resolveWidgetTypeDefinition(value, workspaceRoot, customWidgetDir);
  }

  if (tagName === "Preload" && attributeName === "href") {
    return resolvePreloadHrefDefinition(value, workspaceRoot, customPublicDir);
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function resolveDefinition(
  node: Node,
  workspaceRoot: string | undefined,
  customWidgetDir?: string,
  customPublicDir?: string,
): Promise<Location | null> {
  if (!workspaceRoot) {
    return null;
  }

  // Only string/template literals carry navigable values
  if (
    !Node.isStringLiteral(node) &&
    !Node.isNoSubstitutionTemplateLiteral(node)
  ) {
    return null;
  }

  const value = node.getLiteralValue();
  const parent = node.getParent();

  // Case 1: gDom.loadDynamicComponent("X") → navigate to <Dynamic id="X">
  if (isLoadDynamicComponentCall(parent)) {
    return resolveLoadDynamicDefinition(value, workspaceRoot);
  }

  // Case 2: JSX attribute value → widget file or public asset
  return resolveJsxAttrDefinition(
    node,
    value,
    workspaceRoot,
    customWidgetDir,
    customPublicDir,
  );
}

function findSitemapWidgetDefinition(
  page: SitemapPage,
  offset: number,
  workspaceRoot: string,
  customWidgetDir: string,
): Location | null {
  for (const w of page.widgets) {
    if (offset >= w.start && offset <= w.end) {
      return resolveWidgetTypeDefinition(w.type, workspaceRoot, customWidgetDir);
    }
  }
  return null;
}

function findSitemapHandlerDefinition(
  page: SitemapPage,
  offset: number,
  workspaceRoot: string,
): Location | null {
  if (
    page.handler &&
    page.handlerStart !== undefined &&
    page.handlerEnd !== undefined &&
    offset >= page.handlerStart &&
    offset <= page.handlerEnd
  ) {
    const candidateDirs = [
      path.join(workspaceRoot, "src", "handler"),
      path.join(workspaceRoot, "src", "handlers"),
    ];
    for (const dir of candidateDirs) {
      const fullPath = path.join(dir, `${page.handler}.ts`);
      if (fs.existsSync(fullPath)) {
        return Location.create(
          pathToFileURL(fullPath).toString(),
          Range.create(0, 0, 0, 0),
        );
      }
    }
  }
  return null;
}

function findSitemapLayoutDefinition(
  page: SitemapPage,
  offset: number,
  workspaceRoot: string,
): Location | null {
  if (
    page.layout &&
    page.layoutStart !== undefined &&
    page.layoutEnd !== undefined &&
    offset >= page.layoutStart &&
    offset <= page.layoutEnd
  ) {
    const candidateDirs = [
      path.join(workspaceRoot, "src", "layout"),
      path.join(workspaceRoot, "src", "layouts"),
    ];
    for (const dir of candidateDirs) {
      const fullPath = path.join(dir, `${page.layout}.tsx`);
      if (fs.existsSync(fullPath)) {
        return Location.create(
          pathToFileURL(fullPath).toString(),
          Range.create(0, 0, 0, 0),
        );
      }
    }
  }
  return null;
}

export function resolveSitemapDefinition(
  _document: TextDocument,
  offset: number,
  workspaceRoot: string,
  customWidgetDir = "src/widgets",
): Location | null {
  const pages = sitemapRegistry.getPages();
  for (const page of pages) {
    const widgetLoc = findSitemapWidgetDefinition(page, offset, workspaceRoot, customWidgetDir);
    if (widgetLoc) {
      return widgetLoc;
    }
    const handlerLoc = findSitemapHandlerDefinition(page, offset, workspaceRoot);
    if (handlerLoc) {
      return handlerLoc;
    }
    const layoutLoc = findSitemapLayoutDefinition(page, offset, workspaceRoot);
    if (layoutLoc) {
      return layoutLoc;
    }
  }
  return null;
}
