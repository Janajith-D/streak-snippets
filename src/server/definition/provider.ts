import { Node, Project, ScriptTarget } from "ts-morph";
import { Location, Range } from "vscode-languageserver/node";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";

function findFiles(dir: string, ext: string): string[] {
  let results: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        if (file !== "node_modules" && file !== ".git" && file !== "dist" && file !== "out" && file !== ".vscode") {
          results = results.concat(findFiles(filePath, ext));
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

export function resolveDefinition(
  node: Node,
  workspaceRoot: string | undefined
): Location | null {
  if (!workspaceRoot) {
    return null;
  }

  // Case 1: Hover/F12 on String Literal values (Widgets types, Preload hrefs)
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    const value = node.getLiteralValue();
    const parent = node.getParent();

    // Case 1.1: F12 on gDom.loadDynamicComponent("HomeLander") parameter
    let isLoadDynamicComponent = false;
    if (parent && Node.isCallExpression(parent)) {
      const callExpr = parent.getExpression();
      if (Node.isPropertyAccessExpression(callExpr)) {
        const obj = callExpr.getExpression().getText();
        const prop = callExpr.getName();
        if (obj === "gDom" && prop === "loadDynamicComponent") {
          isLoadDynamicComponent = true;
        }
      }
    }

    if (isLoadDynamicComponent) {
      // Scan workspace recursively for <Dynamic id="value"> or <Dynamic id={"value"}>
      const files = findFiles(workspaceRoot, ".tsx");
      for (const filePath of files) {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.includes("Dynamic") && content.includes(value)) {
          const tempProject = new Project({ compilerOptions: { target: ScriptTarget.ES2022 } });
          const tempFile = tempProject.createSourceFile("temp.tsx", content);
          let foundLocation: Location | null = null;

          tempFile.forEachDescendant((child) => {
            if (Node.isJsxOpeningElement(child) || Node.isJsxSelfClosingElement(child)) {
              const tagName = child.getTagNameNode().getText();
              if (tagName === "Dynamic") {
                const idAttr = child.getAttribute("id");
                if (idAttr && Node.isJsxAttribute(idAttr)) {
                  const init = idAttr.getInitializer();
                  if (init) {
                    let idVal = "";
                    if (Node.isStringLiteral(init)) {
                      idVal = init.getLiteralValue();
                    } else if (Node.isJsxExpression(init)) {
                      const expr = init.getExpression();
                      if (expr && Node.isStringLiteral(expr)) {
                        idVal = expr.getLiteralValue();
                      }
                    }
                    if (idVal === value) {
                      const start = child.getStart();
                      const end = child.getEnd();

                      const lines = content.substring(0, start).split(/\r?\n/);
                      const startLine = lines.length - 1;
                      const startChar = lines[startLine].length;

                      const endLines = content.substring(0, end).split(/\r?\n/);
                      const endLine = endLines.length - 1;
                      const endChar = endLines[endLine].length;

                      const fileUri = pathToFileURL(filePath).toString();
                      foundLocation = Location.create(
                        fileUri,
                        Range.create(startLine, startChar, endLine, endChar)
                      );
                    }
                  }
                }
              }
            }
          });

          if (foundLocation) {
            return foundLocation;
          }
        }
      }
      return null;
    }

    // Case 1.2: F12 on JSX attributes values
    let jsxAttr: Node | undefined = parent;
    if (jsxAttr && Node.isJsxExpression(jsxAttr)) {
      jsxAttr = jsxAttr.getParent();
    }

    if (jsxAttr && Node.isJsxAttribute(jsxAttr)) {
      const attributeName = jsxAttr.getNameNode().getText();
      let tagNode: Node | undefined = jsxAttr.getParent();
      if (tagNode && tagNode.getKindName() === "JsxAttributes") {
        tagNode = tagNode.getParent();
      }

      if (tagNode && (Node.isJsxOpeningElement(tagNode) || Node.isJsxSelfClosingElement(tagNode))) {
        const tagName = tagNode.getTagNameNode().getText();

        // WidgetPlaceholder type -> Jump to Widget file
        if (tagName === "WidgetPlaceholder" && attributeName === "type") {
          const baseWidgetPath = path.join(workspaceRoot, "src", "widgets", value);
          const extensions = [".tsx", ".ts", ".jsx", ".js"];
          for (const ext of extensions) {
            const fullPath = baseWidgetPath + ext;
            if (fs.existsSync(fullPath)) {
              const fileUri = pathToFileURL(fullPath).toString();
              return Location.create(fileUri, Range.create(0, 0, 0, 0));
            }
          }
        }

        // Preload href -> Jump to static asset file
        if (tagName === "Preload" && attributeName === "href") {
          const cleanHref = value.startsWith("/") ? value.substring(1) : value;
          const fullPath = path.join(workspaceRoot, "public", cleanHref);
          if (fs.existsSync(fullPath)) {
            const fileUri = pathToFileURL(fullPath).toString();
            return Location.create(fileUri, Range.create(0, 0, 0, 0));
          }
        }
      }
    }
  }

  return null;
}
