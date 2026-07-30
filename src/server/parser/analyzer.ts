import { Node, Project, ScriptTarget, SourceFile } from "ts-morph";
import { AnalysisResult, ExportInfo, ImportInfo } from "../../shared/types";

// Create a single ts-morph Project instance for in-memory AST parsing
const project = new Project({
  compilerOptions: {
    target: ScriptTarget.ES2022,
    allowJs: true,
  },
  useInMemoryFileSystem: true,
});

export interface ParseOutput {
  analysis: AnalysisResult;
  sourceFile: SourceFile;
}

/**
 * Parses a TypeScript or TSX file content into an AST using ts-morph
 * and extracts information about imports, exports, components, and JSX elements.
 */
function collectImports(sourceFile: SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];
  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    const namedImports = importDecl
      .getNamedImports()
      .map((ni) => ni.getName());
    const defaultImport = importDecl.getDefaultImport()?.getText();

    imports.push({
      moduleSpecifier,
      namedImports,
      defaultImport,
    });
  }
  return imports;
}

function collectFunctionExports(sourceFile: SourceFile, components: string[]): ExportInfo[] {
  const exports: ExportInfo[] = [];
  for (const func of sourceFile.getFunctions()) {
    const isDefault = func.isDefaultExport();
    const name = func.getName() ?? (isDefault ? "default" : "anonymous");
    if (func.isExported() || isDefault) {
      exports.push({
        name,
        isDefault,
        kind: "function",
      });
    }

    if (name && /^[A-Z]/.test(name)) {
      components.push(name);
    }
  }
  return exports;
}

function collectVariableExports(sourceFile: SourceFile, components: string[]): ExportInfo[] {
  const exports: ExportInfo[] = [];
  for (const varDecl of sourceFile.getVariableDeclarations()) {
    const name = varDecl.getName();
    const statement = varDecl.getVariableStatement();
    if (statement?.isExported()) {
      exports.push({
        name,
        isDefault: false,
        kind: "variable",
      });
    }

    if (name && /^[A-Z]/.test(name)) {
      components.push(name);
    }
  }
  return exports;
}

function collectExports(sourceFile: SourceFile, components: string[]): ExportInfo[] {
  const exports: ExportInfo[] = [
    ...collectFunctionExports(sourceFile, components),
    ...collectVariableExports(sourceFile, components),
  ];

  for (const exportAssign of sourceFile.getExportAssignments()) {
    if (!exportAssign.isExportEquals()) {
      const exprText = exportAssign.getExpression()?.getText() ?? "default";
      exports.push({
        name: exprText,
        isDefault: true,
        kind: "unknown",
      });
    }
  }

  const defaultSymbol = sourceFile.getDefaultExportSymbol();
  if (defaultSymbol && !exports.some((e) => e.isDefault)) {
    exports.push({
      name: defaultSymbol.getName(),
      isDefault: true,
      kind: "unknown",
    });
  }

  return exports;
}

function collectJsxElements(sourceFile: SourceFile): string[] {
  const jsxElementsSet = new Set<string>();
  sourceFile.forEachDescendant((node) => {
    if (Node.isJsxElement(node)) {
      const opening = node.getOpeningElement();
      const tagName = opening.getTagNameNode().getText();
      if (tagName) {
        jsxElementsSet.add(tagName);
      }
    } else if (Node.isJsxSelfClosingElement(node)) {
      const tagName = node.getTagNameNode().getText();
      if (tagName) {
        jsxElementsSet.add(tagName);
      }
    }
  });
  return Array.from(jsxElementsSet);
}

export function analyzeAndParseDocument(uri: string, content: string): ParseOutput {
  const filePath = uri.endsWith(".tsx") ? "file.tsx" : "file.ts";

  // Create or update virtual source file in memory
  let sourceFile = project.getSourceFile(filePath);
  if (sourceFile) {
    sourceFile.replaceWithText(content);
  } else {
    sourceFile = project.createSourceFile(filePath, content);
  }

  let imports: ImportInfo[] = [];
  let exports: ExportInfo[] = [];
  const components: string[] = [];
  let jsxElements: string[] = [];
  const errors: string[] = [];

  try {
    imports = collectImports(sourceFile);
    exports = collectExports(sourceFile, components);
    jsxElements = collectJsxElements(sourceFile);
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const analysis: AnalysisResult = {
    uri,
    imports,
    exports,
    components,
    jsxElements,
    errors,
  };

  return { analysis, sourceFile };
}

export function analyzeDocument(uri: string, content: string): AnalysisResult {
  return analyzeAndParseDocument(uri, content).analysis;
}

