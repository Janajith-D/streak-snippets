import { Node, Project, ScriptTarget, type Symbol as MorphSymbol, SyntaxKind } from "ts-morph";
import * as path from "node:path";
import * as fs from "node:fs";
import { type WidgetProp, widgetRegistry } from "./widgets";
import { sitemapRegistry } from "./sitemaps";
import { gdomRegistry, scanGDomTypes } from "./gdomTypeScanner";
export { findStreakProjectRoot, isStreakProjectDirectory, isStreakFile } from "./projectDetector";
import { findStreakProjectRoot, isStreakProjectDirectory } from "./projectDetector";

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
  const decls = defaultExportSymbol.getDeclarations();
  if (decls.length === 0) {
    return undefined;
  }
  const decl = decls[0];
  if (Node.isExportAssignment(decl)) {
    const expr = decl.getExpression();
    if (Node.isIdentifier(expr)) {
      return expr.getText();
    }
  } else if (Node.isFunctionDeclaration(decl) || Node.isClassDeclaration(decl)) {
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
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
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
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
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
  if (Node.isArrowFunction(componentNode) || Node.isFunctionExpression(componentNode)) {
    const varStatement = componentNode.getFirstAncestorByKind(SyntaxKind.VariableStatement);
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

function extractPropTypeText(prop: MorphSymbol): string {
  const valDecl = prop.getValueDeclaration();
  if (valDecl) {
    const typedNode = valDecl as unknown as { getTypeNode?(): Node };
    const typeNode = typedNode.getTypeNode?.();
    if (typeNode) {
      return typeNode.getText();
    }
    return valDecl.getType().getText();
  }
  return prop.getDeclaredType().getText();
}

function extractPropDocComment(prop: MorphSymbol): string | undefined {
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
  return propDoc.length > 0 ? propDoc : undefined;
}

/**
 * Extracts the typed prop list from a function/arrow/expression component.
 * Extracted helpers reduce cognitive complexity below 15.
 */
function extractProps(componentNode: Node): WidgetProp[] {
  if (
    !Node.isFunctionDeclaration(componentNode) &&
    !Node.isArrowFunction(componentNode) &&
    !Node.isFunctionExpression(componentNode)
  ) {
    return [];
  }

  const params = componentNode.getParameters();
  if (params.length === 0) {
    return [];
  }

  const propsList: WidgetProp[] = [];
  const type = params[0].getType();

  for (const prop of type.getProperties()) {
    propsList.push({
      name: prop.getName(),
      type: extractPropTypeText(prop),
      isOptional: prop.isOptional(),
      docComment: extractPropDocComment(prop),
    });
  }

  return propsList;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function resolveProjectRoot(uri: string, workspaceRoot?: string): string {
  try {
    const detected = findStreakProjectRoot(uri, workspaceRoot);
    if (detected) {
      return detected;
    }
  } catch {
    /* ignore */
  }
  return workspaceRoot ?? process.cwd();
}

export async function scanFile(filePath: string): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const sourceFile = scanProject.createSourceFile(`${filePath}.temp.tsx`, content, {
      overwrite: true,
    });

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
      docComment: docComment.length > 0 ? docComment : undefined,
      props: propsList,
    });

    sourceFile.delete();
  } catch {
    // Ignore errors
  }
}

async function findWidgetDirectories(
  root: string,
  customWidgetDir = "src/widgets",
): Promise<string[]> {
  const dirs: string[] = [];

  const directPath = path.join(root, customWidgetDir);
  if (fs.existsSync(directPath)) {
    dirs.push(directPath);
  }
  const directFallback = path.join(root, "src", "components");
  if (
    fs.existsSync(directFallback) &&
    !dirs.includes(directFallback) &&
    isStreakProjectDirectory(root)
  ) {
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
            const projectRoot = findStreakProjectRoot(full, root);
            if (projectRoot && !dirs.includes(full)) {
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
          if (item === "streak.sitemap.json" || findStreakProjectRoot(full, root) !== null) {
            sitemaps.push(full);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  await search(root, 0);
  return sitemaps;
}

async function findDeclarationFiles(root: string): Promise<string[]> {
  const dtsFiles: string[] = [];
  const maxDepth = 4;

  async function search(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }
    try {
      const items = await fs.promises.readdir(dir);
      for (const item of items) {
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
        } else if (item.endsWith(".d.ts")) {
          if (findStreakProjectRoot(full, root) !== null) {
            dtsFiles.push(full);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  await search(root, 0);
  return dtsFiles;
}

export async function scanWorkspace(
  workspaceRoot: string,
  customWidgetDir?: string,
): Promise<void> {
  widgetRegistry.clear();
  sitemapRegistry.clear();
  gdomRegistry.clear();

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

  const dtsFiles = await findDeclarationFiles(workspaceRoot);
  for (const dtsPath of dtsFiles) {
    try {
      const content = await fs.promises.readFile(dtsPath, "utf-8");
      const methods = scanGDomTypes(content, dtsPath);
      gdomRegistry.registerMethods(methods);
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
      if (stat.isDirectory()) {
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
