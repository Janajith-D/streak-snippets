import { Node, Project, ScriptTarget, SyntaxKind } from "ts-morph";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
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

export function resolveProjectRoot(uri: string, workspaceRoot?: string): string {
  try {
    let filePath = uri;
    if (uri.startsWith("file://")) {
      filePath = fileURLToPath(uri);
    }
    let currentDir = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
      ? filePath
      : path.dirname(filePath);

    while (currentDir && currentDir !== path.dirname(currentDir)) {
      if (
        fs.existsSync(path.join(currentDir, "streak.sitemap.json")) ||
        fs.existsSync(path.join(currentDir, "sitemap.json")) ||
        fs.existsSync(path.join(currentDir, "src", "widgets")) ||
        fs.existsSync(path.join(currentDir, "src", "layouts")) ||
        fs.existsSync(path.join(currentDir, "src", "layout"))
      ) {
        return currentDir;
      }
      if (workspaceRoot && path.resolve(currentDir) === path.resolve(workspaceRoot)) {
        break;
      }
      currentDir = path.dirname(currentDir);
    }
  } catch {
    /* ignore */
  }
  return workspaceRoot || process.cwd();
}

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

async function findWidgetDirectories(root: string, customWidgetDir?: string): Promise<string[]> {
  const dirs: string[] = [];
  const targetDirName = customWidgetDir || "src/widgets";

  const directPath = path.join(root, targetDirName);
  if (fs.existsSync(directPath)) {
    dirs.push(directPath);
  }
  const directFallback = path.join(root, "src", "components");
  if (fs.existsSync(directFallback) && !dirs.includes(directFallback)) {
    dirs.push(directFallback);
  }

  async function search(dir: string, depth: number) {
    if (depth > 4) {
      return;
    }
    try {
      const list = await fs.promises.readdir(dir);
      for (const item of list) {
        if (
          item === "node_modules" ||
          item === ".git" ||
          item === "dist" ||
          item === "out" ||
          item === ".vscode"
        ) {
          continue;
        }
        const full = path.join(dir, item);
        const stat = await fs.promises.stat(full);
        if (stat.isDirectory()) {
          if (
            (item === "widgets" || item === "components") &&
            path.basename(path.dirname(full)) === "src"
          ) {
            if (!dirs.includes(full)) {
              dirs.push(full);
            }
          } else {
            await search(full, depth + 1);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  await search(root, 0);
  return dirs;
}

async function findSitemapFiles(root: string): Promise<string[]> {
  const sitemaps: string[] = [];
  async function search(dir: string, depth: number) {
    if (depth > 4) {
      return;
    }
    try {
      const list = await fs.promises.readdir(dir);
      for (const item of list) {
        if (
          item === "node_modules" ||
          item === ".git" ||
          item === "dist" ||
          item === "out" ||
          item === ".vscode"
        ) {
          continue;
        }
        const full = path.join(dir, item);
        const stat = await fs.promises.stat(full);
        if (stat.isDirectory()) {
          await search(full, depth + 1);
        } else if (item === "streak.sitemap.json" || item === "sitemap.json") {
          sitemaps.push(full);
        }
      }
    } catch {
      /* ignore */
    }
  }

  await search(root, 0);
  return sitemaps;
}

export async function scanWorkspace(
  workspaceRoot: string,
  customWidgetDir?: string,
): Promise<void> {
  widgetRegistry.clear();
  sitemapRegistry.clear();

  const widgetDirs = await findWidgetDirectories(workspaceRoot, customWidgetDir);
  for (const dir of widgetDirs) {
    const files = await findFilesRecursive(dir);
    for (const file of files) {
      await scanFile(file);
    }
  }

  const sitemapFiles = await findSitemapFiles(workspaceRoot);
  for (const sitemapPath of sitemapFiles) {
    try {
      const text = await fs.promises.readFile(sitemapPath, "utf-8");
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
