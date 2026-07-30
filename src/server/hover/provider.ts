import { Node } from "ts-morph";
import { Hover } from "vscode-languageserver/node";
import { GDOM_METHODS } from "../completion/runtimeApi";

export function resolveHover(node: Node): Hover | null {
  // Case 1: Hovering over component tag name
  if (Node.isIdentifier(node)) {
    const tagName = node.getText();
    const parent = node.getParent();
    if (
      parent &&
      (Node.isJsxOpeningElement(parent) ||
        Node.isJsxClosingElement(parent) ||
        Node.isJsxSelfClosingElement(parent))
    ) {
      if (tagName === "WidgetPlaceholder") {
        return {
          contents: {
            kind: "markdown",
            value: [
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
          },
        };
      }

      if (tagName === "Preload") {
        return {
          contents: {
            kind: "markdown",
            value: [
              "**Streak `<Preload>` Component**",
              "---",
              "Preloads static resources (e.g., styles, scripts, fonts, images) during build-time to improve page performance.",
              "",
              "*Required Attributes:*",
              "- `href`: Path to the asset inside the `public/` directory.",
              "- `as`: Resource type (e.g. `\"image\"`, `\"font\"`, `\"style\"`, `\"script\"`, `\"video\"`).",
              "",
              "*Example:*",
              "```tsx",
              '<Preload href="/styles/tailwind.css" as="style" />',
              "```",
            ].join("\n"),
          },
        };
      }

      if (tagName === "Dynamic") {
        return {
          contents: {
            kind: "markdown",
            value: [
              "**Streak `<Dynamic>` Component**",
              "---",
              "Wraps components that will be dynamically injected or loaded on the client side.",
              "",
              "*Required Attributes:*",
              "- `id`: Registry ID matched by scripting load triggers.",
              "",
              "*Example:*",
              "```tsx",
              "<Dynamic id=\"interactive-panel\">",
              "  <ExpensiveComponent />",
              "</Dynamic>",
              "```",
            ].join("\n"),
          },
        };
      }

      if (tagName === "Script") {
        return {
          contents: {
            kind: "markdown",
            value: [
              "**Streak `<Script>` Component**",
              "---",
              "Executes client-side script code with direct access to the DOM node via `gDom`.",
              "",
              "*Required Attributes:*",
              "- `id`: Unique identifier matching dynamic triggering scripts.",
              "",
              "*Example:*",
              "```tsx",
              "<Script id=\"my-script\" options={{ delay: 800 }}>",
              "  {(gDom, options) => {",
              "    console.info(\"script executed\");",
              "  }}",
              "</Script>",
              "```",
            ].join("\n"),
          },
        };
      }
    }
  }

  // Case 2: Hovering over JSX attributes on built-in components
  if (Node.isIdentifier(node)) {
    const parent = node.getParent();
    if (parent && Node.isJsxAttribute(parent)) {
      const attributeName = node.getText();
      let tagNode: Node | undefined = parent.getParent();
      if (tagNode && tagNode.getKindName() === "JsxAttributes") {
        tagNode = tagNode.getParent();
      }
      if (tagNode && (Node.isJsxOpeningElement(tagNode) || Node.isJsxSelfClosingElement(tagNode))) {
        const tagName = tagNode.getTagNameNode().getText();
        
        if (tagName === "WidgetPlaceholder") {
          if (attributeName === "id") {
            return {
              contents: {
                kind: "markdown",
                value: "The unique ID of the widget placeholder, matching sitemap routes or handler targets.",
              },
            };
          }
          if (attributeName === "type") {
            return {
              contents: {
                kind: "markdown",
                value: "The widget name matching a file in `src/widgets/` (case-sensitive, without file extension).",
              },
            };
          }
        }

        if (tagName === "Preload") {
          if (attributeName === "href") {
            return {
              contents: {
                kind: "markdown",
                value: "The path to the static asset relative to the `public/` directory (e.g. `/styles/main.css`).",
              },
            };
          }
          if (attributeName === "as") {
            return {
              contents: {
                kind: "markdown",
                value: "The resource classification (e.g., `'image'`, `'font'`, `'style'`, `'script'`, `'video'`) used by the browser to allocate preload priority.",
              },
            };
          }
          if (attributeName === "media") {
            return {
              contents: {
                kind: "markdown",
                value: "Optional media query string for responsive preloading (e.g., `(max-width: 600px)`).",
              },
            };
          }
          if (attributeName === "crossOrigin") {
            return {
              contents: {
                kind: "markdown",
                value: "Optional CORS configuration option for cross-origin preloading requests (e.g., `anonymous`).",
              },
            };
          }
        }

        if (tagName === "Dynamic") {
          if (attributeName === "id") {
            return {
              contents: {
                kind: "markdown",
                value: "The dynamic bundle ID. Triggering scripts use this ID with `gDom.loadDynamicComponent` to inject this component into the DOM.",
              },
            };
          }
        }

        if (tagName === "Script") {
          if (attributeName === "id") {
            return {
              contents: {
                kind: "markdown",
                value: "The unique identifier of the script. Required to coordinate execution hooks and client side hydration.",
              },
            };
          }
          if (attributeName === "options") {
            return {
              contents: {
                kind: "markdown",
                value: "Key-value options object serialized and forwarded as the second parameter of the script callback.",
              },
            };
          }
        }
      }
    }
  }

  // Case 3: Hovering over gDom methods
  if (Node.isIdentifier(node)) {
    const parent = node.getParent();
    if (parent && Node.isPropertyAccessExpression(parent)) {
      const expression = parent.getExpression();
      if (expression.getText() === "gDom") {
        const methodName = node.getText();
        const method = GDOM_METHODS.find((m) => m.name === methodName);
        if (method) {
          return {
            contents: {
              kind: "markdown",
              value: [
                `\`\`\`typescript\n${method.signature}: ${method.returnType}\n\`\`\n`,
                "---",
                method.documentation,
              ].join("\n"),
            },
          };
        }
      }
    }
  }

  return null;
}
