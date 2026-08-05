import { Node, Project, ScriptTarget, SyntaxKind } from "ts-morph";
import * as path from "path";
import * as fs from "fs";
import { widgetRegistry, WidgetProp } from "./widgets";

// Single shared compiler project instance to avoid redundant instantiation overhead
const scanProject = new Project({
  compilerOptions: {
    target: ScriptTarget.ES2022,
    allowJs: true,
  },
});

export async function scanFile(filePath: string): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const sourceFile = scanProject.createSourceFile(filePath + ".temp.tsx", content, { overwrite: true });

    let componentName = "";
    let componentNode: Node | undefined;

    // 1. Look for default export symbol
    const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
    if (defaultExportSymbol) {
      const decl = defaultExportSymbol.getDeclarations()[0];
      if (decl) {
        if (Node.isExportAssignment(decl)) {
          const expr = decl.getExpression();
          if (expr && Node.isIdentifier(expr)) {
            componentName = expr.getText();
          }
        } else if (Node.isFunctionDeclaration(decl) || Node.isClassDeclaration(decl)) {
          componentName = decl.getName() ?? "";
          componentNode = decl;
        }
      }
    }

    // 2. Fallback to first PascalCase function or variable
    if (!componentName) {
      for (const fn of sourceFile.getFunctions()) {
        const name = fn.getName();
        if (name && /^[A-Z]/.test(name)) {
          componentName = name;
          componentNode = fn;
          break;
        }
      }
    }

    if (!componentName) {
      for (const vd of sourceFile.getVariableDeclarations()) {
        const name = vd.getName();
        if (name && /^[A-Z]/.test(name)) {
          const init = vd.getInitializer();
          if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
            componentName = name;
            componentNode = init;
            break;
          }
        }
      }
    }

    if (!componentName) {
      const basename = path.basename(filePath, path.extname(filePath));
      if (/^[A-Z]/.test(basename)) {
        componentName = basename;
      }
    }

    if (!componentName) {
      sourceFile.delete();
      return;
    }

    if (!componentNode) {
      const fn = sourceFile.getFunction(componentName);
      if (fn) {
        componentNode = fn;
      } else {
        const vd = sourceFile.getVariableDeclaration(componentName);
        if (vd) {
          const init = vd.getInitializer();
          if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
            componentNode = init;
          }
        }
      }
    }

    // Extract component description
    let docComment = "";
    if (componentNode) {
      let docNode: Node = componentNode;
      if (Node.isArrowFunction(componentNode) || Node.isFunctionExpression(componentNode)) {
        const varStatement = componentNode.getFirstAncestorByKind(SyntaxKind.VariableStatement);
        if (varStatement) {
          docNode = varStatement;
        }
      }
      if (Node.isJSDocable(docNode)) {
        docComment = docNode.getJsDocs().map(jd => jd.getDescription().trim()).join("\n").trim();
      }
    }

    // Extract props
    const propsList: WidgetProp[] = [];
    if (
      componentNode &&
      (Node.isFunctionDeclaration(componentNode) ||
        Node.isArrowFunction(componentNode) ||
        Node.isFunctionExpression(componentNode))
    ) {
      const firstParam = componentNode.getParameters()[0];
      if (firstParam) {
        const type = firstParam.getType();
        for (const prop of type.getProperties()) {
          const name = prop.getName();
          const isOptional = prop.isOptional();

          let typeText = "any";
          const valDecl = prop.getValueDeclaration();
          if (valDecl) {
            const typeNode = (valDecl as any).getTypeNode?.();
            if (typeNode) {
              typeText = typeNode.getText();
            } else {
              typeText = valDecl.getType().getText();
            }
          } else {
            typeText = prop.getDeclaredType().getText();
          }

          let propDoc = "";
          for (const decl of prop.getDeclarations()) {
            const jsDocs = (decl as any).getJsDocs?.();
            if (jsDocs) {
              propDoc = jsDocs.map((jd: any) => jd.getDescription().trim()).join("\n").trim();
            }
          }

          propsList.push({
            name,
            type: typeText,
            isOptional,
            docComment: propDoc || undefined,
          });
        }
      }
    }

    widgetRegistry.deleteByPath(filePath);
    widgetRegistry.set(componentName, {
      name: componentName,
      filePath,
      docComment: docComment || undefined,
      props: propsList,
    });

    sourceFile.delete();
  } catch {
    // Ignore errors
  }
}

export async function scanWorkspace(workspaceRoot: string, customWidgetDir?: string): Promise<void> {
  const resolvedWidgetDir = customWidgetDir 
    ? path.join(workspaceRoot, customWidgetDir)
    : path.join(workspaceRoot, "src", "widgets");
  const fallbackWidgetDir = path.join(workspaceRoot, "src", "components");

  const dirs = [resolvedWidgetDir, fallbackWidgetDir];

  widgetRegistry.clear();

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      const files = await findFilesRecursive(dir);
      for (const file of files) {
        await scanFile(file);
      }
    }
  }
}

async function findFilesRecursive(dir: string): Promise<string[]> {
  let results: string[] = [];
  try {
    const list = await fs.promises.readdir(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = await fs.promises.stat(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(await findFilesRecursive(filePath));
      } else if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
        results.push(filePath);
      }
    }
  } catch {}
  return results;
}
