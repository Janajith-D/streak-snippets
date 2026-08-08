import { Node, Project, ScriptTarget, SyntaxKind } from "ts-morph";
import * as path from "node:path";
import * as fs from "node:fs";
import { type WidgetProp, widgetRegistry } from "./widgets";
import { sitemapRegistry } from "./sitemaps";

// Single shared compiler project instance to avoid redundant instantiation overhead
const scanProject = new Project({
  compilerOptions: {
    target: ScriptTarget.ES2022,
    allowJs: true,
  },
});

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Extracts the component name from a default export symbol, if one exists.
 * Extracted to reduce cognitive complexity of resolveComponentName.
 */
function getDefaultExportComponentName(
  sourceFile: ReturnType<typeof scanProject.createSourceFile>,
): string | undefined {
  const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
  if (!defaultExportSymbol) {
    return undefined;
  }
  const decl = defaultExportSymbol.getDeclarations()[0];
  if (!decl) {
    return undefined;
  }
  if (Node.isExportAssignment(decl)) {
    const expr = decl.getExpression();
    if (expr && Node.isIdentifier(expr)) {
      return expr.getText();
    }
  } else if (
    Node.isFunctionDeclaration(decl) ||
    Node.isClassDeclaration(decl)
  ) {
    return decl.getName() ?? "";
  }
  return undefined;
}

/**
 * Extracts the component name from a PascalCase variable declaration, if one exists.
 * Extracted to reduce cognitive complexity of resolveComponentName.
 */
function getVariableDeclComponentName(
  sourceFile: ReturnType<typeof scanProject.createSourceFile>,
): string | undefined {
  for (const vd of sourceFile.getVariableDeclarations()) {
    const name = vd.getName();
    if (name && /^[A-Z]/.test(name)) {
      const init = vd.getInitializer();
      if (
        init &&
        (Node.isArrowFunction(init) || Node.isFunctionExpression(init))
      ) {
        return name;
      }
    }
  }
  return undefined;
}

/**
 * Resolves the component name from a source file.
 * Priority: default export symbol → first PascalCase function → PascalCase variable → file basename.
 * Extracted to reduce cognitive complexity of scanFile.
 */
function resolveComponentName(
  sourceFile: ReturnType<typeof scanProject.createSourceFile>,
  filePath: string,
): string {
  const defaultName = getDefaultExportComponentName(sourceFile);
  if (defaultName) {
    return defaultName;
  }

  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name && /^[A-Z]/.test(name)) {
      return name;
    }
  }

  const varName = getVariableDeclComponentName(sourceFile);
  if (varName) {
    return varName;
  }

  const basename = path.basename(filePath, path.extname(filePath));
  return /^[A-Z]/.test(basename) ? basename : "";
}

/**
 * Resolves the AST node for the named component.
 * Falls back to searching by name if not already discovered during name resolution.
 * Extracted to reduce cognitive complexity of scanFile.
 */
function resolveComponentNode(
  sourceFile: ReturnType<typeof scanProject.createSourceFile>,
  componentName: string,
): Node | undefined {
  const fn = sourceFile.getFunction(componentName);
  if (fn) {
    return fn;
  }
  const vd = sourceFile.getVariableDeclaration(componentName);
  if (vd) {
    const init = vd.getInitializer();
    if (
      init &&
      (Node.isArrowFunction(init) || Node.isFunctionExpression(init))
    ) {
      return init;
    }
  }
  return undefined;
}

/**
 * Extracts the JSDoc description from a component node.
 * Extracted to reduce cognitive complexity of scanFile.
 */
function extractDocComment(componentNode: Node): string {
  let docNode: Node = componentNode;
  if (
    Node.isArrowFunction(componentNode) ||
    Node.isFunctionExpression(componentNode)
  ) {
    const varStatement = componentNode.getFirstAncestorByKind(
      SyntaxKind.VariableStatement,
    );
    if (varStatement) {
      docNode = varStatement;
    }
  }
  if (Node.isJSDocable(docNode)) {
    return docNode
      .getJsDocs()
      .map((jd) => jd.getDescription().trim())
      .join("\n")
      .trim();
  }
  return "";
}

/**
 * Extracts the typed prop list from a function/arrow/expression component.
 * Extracted to reduce cognitive complexity of scanFile.
 * Also fixes the SonarQube "useless assignment" by hoisting typeText declaration.
 */
function extractProps(componentNode: Node): WidgetProp[] {
  if (
    !Node.isFunctionDeclaration(componentNode) &&
    !Node.isArrowFunction(componentNode) &&
    !Node.isFunctionExpression(componentNode)
  ) {
    return [];
  }

  const firstParam = componentNode.getParameters()[0];
  if (!firstParam) {
    return [];
  }

  const propsList: WidgetProp[] = [];
  const type = firstParam.getType();

  for (const prop of type.getProperties()) {
    const name = prop.getName();
    const isOptional = prop.isOptional();

    // Fix: hoist typeText — no useless "any" initialisation before conditional overwrite
    const valDecl = prop.getValueDeclaration();
    let typeText: string;
    if (valDecl) {
      const typedNode = valDecl as unknown as { getTypeNode?(): Node };
      const typeNode = typedNode.getTypeNode?.();
      typeText = typeNode ? typeNode.getText() : valDecl.getType().getText();
    } else {
      typeText = prop.getDeclaredType().getText();
    }

    let propDoc = "";
    for (const decl of prop.getDeclarations()) {
      const jsDocable = decl as unknown as {
        getJsDocs?(): { getDescription(): string }[];
      };
      const jsDocs = jsDocable.getJsDocs?.();
      if (jsDocs) {
        propDoc = jsDocs
          .map((jd) => jd.getDescription().trim())
          .join("\n")
          .trim();
      }
    }

    propsList.push({
      name,
      type: typeText,
      isOptional,
      docComment: propDoc || undefined,
    });
  }

  return propsList;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scanFile(filePath: string): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const sourceFile = scanProject.createSourceFile(
      `${filePath}.temp.tsx`,
      content,
      { overwrite: true },
    );

    // 1. Resolve component name
    const componentName = resolveComponentName(sourceFile, filePath);
    if (!componentName) {
      sourceFile.delete();
      return;
    }

    // 2. Resolve component AST node
    const componentNode = resolveComponentNode(sourceFile, componentName);

    // 3. Extract JSDoc
    const docComment = componentNode ? extractDocComment(componentNode) : "";

    // 4. Extract props
    const propsList = componentNode ? extractProps(componentNode) : [];

    // 5. Update registry
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

export async function scanWorkspace(
  workspaceRoot: string,
  customWidgetDir?: string,
): Promise<void> {
  const resolvedWidgetDir = customWidgetDir
    ? path.join(workspaceRoot, customWidgetDir)
    : path.join(workspaceRoot, "src", "widgets");
  const fallbackWidgetDir = path.join(workspaceRoot, "src", "components");

  const dirs = [resolvedWidgetDir, fallbackWidgetDir];

  widgetRegistry.clear();
  sitemapRegistry.clear();

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      const files = await findFilesRecursive(dir);
      for (const file of files) {
        await scanFile(file);
      }
    }
  }

  let sitemapPath = path.join(workspaceRoot, "streak.sitemap.json");
  if (!fs.existsSync(sitemapPath)) {
    sitemapPath = path.join(workspaceRoot, "sitemap.json");
  }

  if (fs.existsSync(sitemapPath)) {
    try {
      const text = fs.readFileSync(sitemapPath, "utf-8");
      sitemapRegistry.parseAndRegister(sitemapPath, text);
    } catch {
      // ignore
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
      if (stat?.isDirectory()) {
        // optional chain fix
        results = results.concat(await findFilesRecursive(filePath));
      } else if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
        results.push(filePath);
      }
    }
  } catch {
    /* ignore */
  }
  return results;
}
