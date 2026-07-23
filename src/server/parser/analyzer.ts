import { Project, ScriptTarget, SourceFile, SyntaxKind } from "ts-morph";
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
export function analyzeAndParseDocument(uri: string, content: string): ParseOutput {
  const filePath = uri.endsWith(".tsx") ? "file.tsx" : "file.ts";

  // Create or update virtual source file in memory
  let sourceFile = project.getSourceFile(filePath);
  if (sourceFile) {
    sourceFile.replaceWithText(content);
  } else {
    sourceFile = project.createSourceFile(filePath, content);
  }

  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const components: string[] = [];
  const jsxElementsSet = new Set<string>();
  const errors: string[] = [];

  try {
    // 1. Collect Imports
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

    // 2. Collect Exports
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

      // Track components (PascalCase functions)
      if (name && /^[A-Z]/.test(name)) {
        components.push(name);
      }
    }

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

      // Track component names stored in variable declarations
      if (name && /^[A-Z]/.test(name)) {
        components.push(name);
      }
    }

    // Collect export assignments (e.g. `export default getData;` or `export default { ... };`)
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

    // Check if a default export symbol exists that wasn't captured above
    const defaultSymbol = sourceFile.getDefaultExportSymbol();
    if (defaultSymbol && !exports.some((e) => e.isDefault)) {
      exports.push({
        name: defaultSymbol.getName(),
        isDefault: true,
        kind: "unknown",
      });
    }

    // 3. Collect JSX Elements (for TSX files)
    sourceFile.forEachDescendant((node) => {
      if (
        node.getKind() === SyntaxKind.JsxElement ||
        node.getKind() === SyntaxKind.JsxSelfClosingElement
      ) {
        let tagName = "";
        if (node.getKind() === SyntaxKind.JsxElement) {
          const opening = (node as any).getOpeningElement();
          tagName = opening?.getTagNameNode()?.getText() ?? "";
        } else {
          tagName = (node as any).getTagNameNode()?.getText() ?? "";
        }

        if (tagName) {
          jsxElementsSet.add(tagName);
        }
      }
    });
  } catch (err: any) {
    errors.push(err.message ?? String(err));
  }

  const analysis: AnalysisResult = {
    uri,
    imports,
    exports,
    components,
    jsxElements: Array.from(jsxElementsSet),
    errors,
  };

  return { analysis, sourceFile };
}

export function analyzeDocument(uri: string, content: string): AnalysisResult {
  return analyzeAndParseDocument(uri, content).analysis;
}
