import { Node } from "ts-morph";
import { type Hover } from "vscode-languageserver/node";
import { GDOM_METHODS } from "../completion/runtimeApi";
import { type WidgetMetadata, widgetRegistry } from "../registry/widgets";

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
