import { Node, Project, ScriptTarget, SyntaxKind, type SourceFile } from "ts-morph";
import { type Hover } from "vscode-languageserver/node";
import { GDOM_METHODS } from "../completion/runtimeApi";
import { type WidgetMetadata, widgetRegistry } from "../registry/widgets";
import { sitemapRegistry, type SitemapPage } from "../registry/sitemaps";
import { type TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Private helpers ───────────────────────────────────────────────────────────

/** Walks from a JSX attribute node up to the enclosing tag name, or undefined. */
function getTagNameFromAttrNode(
  attrParent: Node | undefined,
): string | undefined {
  let tagNode: Node | undefined = attrParent;
  if (tagNode?.getKindName() === "JsxAttributes") {
    tagNode = tagNode.getParent();
  }
  if (
    tagNode &&
    (Node.isJsxOpeningElement(tagNode) || Node.isJsxSelfClosingElement(tagNode))
  ) {
    return tagNode.getTagNameNode().getText();
  }
  return undefined;
}

/** Produces a markdown Hover object. */
function mkHover(value: string): Hover {
  return { contents: { kind: "markdown", value } };
}

/**
 * Builds the hover text for a widget type attribute.
 * Extracted to reduce cognitive complexity of resolveWidgetTypeHover.
 */
function buildWidgetHoverText(widget: WidgetMetadata): string {
  let hoverText = `**Widget: ${widget.name}**\n\n`;
  if (widget.docComment) {
    hoverText += `${widget.docComment}\n\n`;
  }
  if (widget.props && widget.props.length > 0) {
    hoverText += `**Props:**\n`;
    for (const prop of widget.props) {
      const optional = prop.isOptional ? "?" : "";
      const propDoc = prop.docComment ? ` — ${prop.docComment}` : "";
      hoverText += `- \`${prop.name}${optional}: ${prop.type}\`${propDoc}\n`;
    }
  }
  return hoverText.trim();
}

/**
 * Case 0 — Hovering over a string literal value on the `type` attribute of
 * `<WidgetPlaceholder>`. Shows widget registry info if available.
 */
function resolveWidgetTypeHover(node: Node): Hover | null {
  if (!Node.isStringLiteral(node)) {
    return null;
  }
  const parent = node.getParent();
  if (!Node.isJsxAttribute(parent)) {
    return null;
  }
  if (parent.getNameNode().getText() !== "type") {
    return null;
  }
  const tagName = getTagNameFromAttrNode(parent.getParent());
  if (tagName !== "WidgetPlaceholder") {
    return null;
  }

  const widgetType = node.getLiteralValue();
  const widget = widgetRegistry.get(widgetType);
  if (!widget) {
    return null;
  }

  return mkHover(buildWidgetHoverText(widget));
}

/**
 * Case 1 — Hovering over a component tag name (Identifier node that is the
 * tag name of a JSX element or self-closing element).
 */
function resolveTagNameHover(node: Node): Hover | null {
  if (!Node.isIdentifier(node)) {
    return null;
  }
  const tagName = node.getText();
  const parent = node.getParent();
  if (
    !parent ||
    (!Node.isJsxOpeningElement(parent) &&
      !Node.isJsxClosingElement(parent) &&
      !Node.isJsxSelfClosingElement(parent))
  ) {
    return null;
  }

  switch (tagName) {
    case "WidgetPlaceholder":
      return mkHover(
        [
          "**Streak `<WidgetPlaceholder>` Component**",
          "---",
          "Specifies a placeholder where a widget will be injected dynamically at runtime.",
          "",
          "*Required Attributes:*",
          "- `id`: Unique identifier for the placeholder.",
          "- `type`: Target widget file name under `src/widgets/` (case-sensitive).",
          "",
          "*Example:*",
          "```tsx",
          '<WidgetPlaceholder id="main-panel" type="HelloBanner" />',
          "```",
        ].join("\n"),
      );

    case "Preload":
      return mkHover(
        [
          "**Streak `<Preload>` Component**",
          "---",
          "Preloads static resources (e.g., styles, scripts, fonts, images) during build-time to improve page performance.",
          "",
          "*Required Attributes:*",
          "- `href`: Path to the asset inside the `public/` directory.",
          '- `as`: Resource type (e.g. `"image"`, `"font"`, `"style"`, `"script"`, `"video"`).',
          "",
          "*Example:*",
          "```tsx",
          '<Preload href="/styles/tailwind.css" as="style" />',
          "```",
        ].join("\n"),
      );

    case "Dynamic":
      return mkHover(
        [
          "**Streak `<Dynamic>` Component**",
          "---",
          "Wraps components that will be dynamically injected or loaded on the client side.",
          "",
          "*Required Attributes:*",
          "- `id`: Registry ID matched by scripting load triggers.",
          "",
          "*Example:*",
          "```tsx",
          '<Dynamic id="interactive-panel">',
          "  <ExpensiveComponent />",
          "</Dynamic>",
          "```",
        ].join("\n"),
      );

    case "Script":
      return mkHover(
        [
          "**Streak `<Script>` Component**",
          "---",
          "Executes client-side script code with direct access to the DOM node via `gDom`.",
          "",
          "*Required Attributes:*",
          "- `id`: Unique identifier matching dynamic triggering scripts.",
          "",
          "*Example:*",
          "```tsx",
          '<Script id="my-script" options={{ delay: 800 }}>',
          "  {(gDom, options) => {",
          '    console.info("script executed");',
          "  }}",
          "</Script>",
          "```",
        ].join("\n"),
      );

    default:
      return null;
  }
}

/**
 * Returns hover text for attributes of <Preload>.
 */
function getPreloadAttrHover(attributeName: string): Hover | null {
  switch (attributeName) {
    case "href":
      return mkHover(
        "The path to the static asset relative to the `public/` directory (e.g. `/styles/main.css`).",
      );
    case "as":
      return mkHover(
        "The resource classification (e.g., `'image'`, `'font'`, `'style'`, `'script'`, `'video'`) used by the browser to allocate preload priority.",
      );
    case "media":
      return mkHover(
        "Optional media query string for responsive preloading (e.g., `(max-width: 600px)`).",
      );
    case "crossOrigin":
      return mkHover(
        "Optional CORS configuration option for cross-origin preloading requests (e.g., `anonymous`).",
      );
    default:
      return null;
  }
}

/**
 * Case 2 — Hovering over a JSX attribute name on a built-in component.
 */
function resolveAttributeHover(node: Node): Hover | null {
  if (!Node.isIdentifier(node)) {
    return null;
  }
  const parent = node.getParent();
  if (!parent || !Node.isJsxAttribute(parent)) {
    return null;
  }
  const attributeName = node.getText();
  const tagName = getTagNameFromAttrNode(parent.getParent());
  if (!tagName) {
    return null;
  }

  switch (tagName) {
    case "WidgetPlaceholder":
      if (attributeName === "id") {
        return mkHover(
          "The unique ID of the widget placeholder, matching sitemap routes or handler targets.",
        );
      }
      if (attributeName === "type") {
        return mkHover(
          "The widget name matching a file in `src/widgets/` (case-sensitive, without file extension).",
        );
      }
      return null;

    case "Preload":
      return getPreloadAttrHover(attributeName);

    case "Dynamic":
      if (attributeName === "id") {
        return mkHover(
          "The dynamic bundle ID. Triggering scripts use this ID with `gDom.loadDynamicComponent` to inject this component into the DOM.",
        );
      }
      return null;

    case "Script":
      if (attributeName === "id") {
        return mkHover(
          "The unique identifier of the script. Required to coordinate execution hooks and client side hydration.",
        );
      }
      if (attributeName === "options") {
        return mkHover(
          "Key-value options object serialized and forwarded as the second parameter of the script callback.",
        );
      }
      return null;

    default:
      return null;
  }
}

/**
 * Case 3 — Hovering over a gDom method name.
 */
function resolveGDomMethodHover(node: Node): Hover | null {
  if (!Node.isIdentifier(node)) {
    return null;
  }
  const parent = node.getParent();
  if (!parent || !Node.isPropertyAccessExpression(parent)) {
    return null;
  }
  if (parent.getExpression().getText() !== "gDom") {
    return null;
  }

  const methodName = node.getText();
  const method = GDOM_METHODS.find((m) => m.name === methodName);
  if (!method) {
    return null;
  }

  return mkHover(
    [
      `\`\`\`typescript\n${method.signature}: ${method.returnType}\n\`\`\``,
      "---",
      method.documentation,
    ].join("\n"),
  );
}

/**
 * Case 4 — Hovering over props.data.
 */
function resolvePropsDataHover(node: Node): Hover | null {
  if (!Node.isIdentifier(node)) {
    return null;
  }
  const text = node.getText();
  if (text !== "props" && text !== "data") {
    return null;
  }

  const parent = node.getParent();
  if (!parent) {
    return null;
  }

  let isPropsData = false;

  // Case 1: Hovering over 'data' in 'props.data' or 'props.data.foo'
  if (text === "data" && Node.isPropertyAccessExpression(parent)) {
    const exprText = parent.getExpression().getText().replace(/\?$/, "");
    if (exprText === "props") {
      isPropsData = true;
    }
  }

  // Case 2: Hovering over 'props' in 'props.data'
  if (text === "props" && Node.isPropertyAccessExpression(parent)) {
    const nameText = parent.getName();
    if (nameText === "data") {
      isPropsData = true;
    }
  }

  if (isPropsData) {
    return mkHover(
      [
        "Widget handler data.",
        "",
        "Streak passes:",
        "",
        "```",
        "{",
        "  data: undefined",
        "}",
        "```",
        "",
        "when no data is returned.",
        "",
        "Use optional chaining and fallback values.",
      ].join("\n"),
    );
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function resolveHover(node: Node): Hover | null {
  return (
    resolveWidgetTypeHover(node) ??
    resolveTagNameHover(node) ??
    resolveAttributeHover(node) ??
    resolveGDomMethodHover(node) ??
    resolvePropsDataHover(node)
  );
}

const handlerProj = new Project({
  compilerOptions: {
    target: ScriptTarget.ES2022,
    allowJs: true,
  },
});

function getScriptsCount(widgetPath: string): number {
  try {
    if (fs.existsSync(widgetPath)) {
      const content = fs.readFileSync(widgetPath, "utf-8");
      const matches = content.match(/<Script\b/g);
      return matches ? matches.length : 0;
    }
  } catch {
    // ignore
  }
  return 0;
}

function getFallbackWidgetDataFields(widgetName: string): string[] {
  const widget = widgetRegistry.get(widgetName);
  if (!widget) {
    return [];
  }
  const dataProp = widget.props.find((p) => p.name === "data");
  if (!dataProp) {
    return [];
  }
  const fields = dataProp.type.match(/\b\w+\b/g) || [];
  const stopWords = new Set([
    "string",
    "number",
    "boolean",
    "undefined",
    "null",
    "any",
    "unknown",
    "object",
  ]);
  return Array.from(new Set(fields.filter((f) => !stopWords.has(f))));
}

function findHandlerPath(handlerName: string, workspaceRoot: string): string {
  const handlerDir = path.join(workspaceRoot, "src", "handlers");
  for (const ext of [".ts", ".js", ".tsx", ".jsx"]) {
    const full = path.join(handlerDir, `${handlerName}${ext}`);
    if (fs.existsSync(full)) {
      return full;
    }
  }
  return "";
}

function findFuncNodeFromDefaultExport(
  decl: Node,
  sourceFile: SourceFile,
): Node | undefined {
  if (!Node.isExportAssignment(decl)) {
    return decl;
  }
  const expr = decl.getExpression();
  if (expr && Node.isIdentifier(expr)) {
    const varDecl = sourceFile.getVariableDeclaration(expr.getText());
    const init = varDecl?.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      return init;
    }
  }
  return undefined;
}

function extractPropertiesFromReturnStatements(funcNode: Node, widgetName: string): string[] {
  const fields: string[] = [];
  if (
    !Node.isFunctionDeclaration(funcNode) &&
    !Node.isArrowFunction(funcNode) &&
    !Node.isFunctionExpression(funcNode)
  ) {
    return fields;
  }

  const returnStatements = funcNode.getDescendantsOfKind(SyntaxKind.ReturnStatement);
  for (const ret of returnStatements) {
    const expr = ret.getExpression();
    if (expr && Node.isObjectLiteralExpression(expr)) {
      const prop = expr.getProperty(widgetName);
      if (prop && Node.isPropertyAssignment(prop)) {
        const val = prop.getInitializer();
        if (val && Node.isObjectLiteralExpression(val)) {
          for (const p of val.getProperties()) {
            if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) {
              fields.push(p.getName());
            }
          }
        }
      }
    }
  }
  return fields;
}

function extractFieldsFromHandlerFile(handlerPath: string, widgetName: string): string[] {
  try {
    const content = fs.readFileSync(handlerPath, "utf-8");
    const tempName = `temp_handler_${Date.now()}.ts`;
    const sourceFile = handlerProj.createSourceFile(tempName, content);

    let fields: string[] = [];
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      const decl = defaultExport.getDeclarations()[0];
      if (decl) {
        const funcNode = findFuncNodeFromDefaultExport(decl, sourceFile);
        if (funcNode) {
          fields = extractPropertiesFromReturnStatements(funcNode, widgetName);
        }
      }
    }

    sourceFile.delete();
    return fields;
  } catch {
    return [];
  }
}

function getHandlerDataFields(
  handlerName: string,
  widgetName: string,
  workspaceRoot: string,
): string[] {
  const handlerPath = findHandlerPath(handlerName, workspaceRoot);
  if (!handlerPath) {
    return getFallbackWidgetDataFields(widgetName);
  }
  return extractFieldsFromHandlerFile(handlerPath, widgetName);
}

function resolveSitemapWidgetHover(
  page: SitemapPage,
  offset: number,
  workspaceRoot: string,
  pages: SitemapPage[],
): Hover | null {
  for (const w of page.widgets) {
    if (offset >= w.start && offset <= w.end) {
      const widget = widgetRegistry.get(w.type);
      const widgetRelPath = widget
        ? path.relative(workspaceRoot, widget.filePath).replaceAll("\\", "/")
        : `src/widgets/${w.type}.tsx`;

      const usageCount = pages.filter((p) =>
        p.widgets.some((pw: { type: string }) => pw.type === w.type),
      ).length;
      const scriptsCount = widget ? getScriptsCount(widget.filePath) : 0;
      const handlerName = page.handler || "";
      const handlerData = getHandlerDataFields(handlerName, w.type, workspaceRoot);

      const hoverLines = [
        `Widget: ${w.type}`,
        "",
        `File:`,
        `${widgetRelPath}`,
        "",
        `Default Export:`,
        `${w.type}`,
        "",
        `Used By:`,
        `${usageCount} pages`,
        "",
        `Scripts:`,
        `${scriptsCount}`,
        "",
        `Handler Data:`,
        handlerData.length > 0 ? handlerData.join("\n") : "None",
      ];

      return mkHover(hoverLines.join("\n"));
    }
  }
  return null;
}

function resolveSitemapPageHover(page: SitemapPage, offset: number): Hover | null {
  if (offset >= page.start && offset <= page.end) {
    const hoverLines = [
      `Route:`,
      `${page.url || "None"}`,
      "",
      `Widgets:`,
      page.widgets.length > 0
        ? page.widgets.map((w: { type: string }) => w.type).join("\n")
        : "None",
      "",
      `Handler:`,
      `${page.handler || "None"}`,
      "",
      `Total Widgets:`,
      `${page.widgets.length}`,
    ];
    return mkHover(hoverLines.join("\n"));
  }
  return null;
}

export function resolveSitemapHover(
  _document: TextDocument,
  offset: number,
  workspaceRoot: string,
): Hover | null {
  const pages = sitemapRegistry.getPages();
  for (const page of pages) {
    const widgetHover = resolveSitemapWidgetHover(page, offset, workspaceRoot, pages);
    if (widgetHover) {
      return widgetHover;
    }
    const pageHover = resolveSitemapPageHover(page, offset);
    if (pageHover) {
      return pageHover;
    }
  }
  return null;
}
