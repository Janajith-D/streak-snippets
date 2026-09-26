import { type InterfaceDeclaration, Node, Project, ScriptTarget, SyntaxKind } from "ts-morph";
import type { RuntimeMethod } from "../completion/runtimeApi";

// Dedicated in-memory ts-morph project for parsing declaration files
const gdomProject = new Project({
  useInMemoryFileSystem: true,
  compilerOptions: {
    target: ScriptTarget.ES2022,
    allowJs: true,
  },
});

export class GDomRegistry {
  private readonly customMethods: Map<string, RuntimeMethod> = new Map();

  public registerMethod(method: RuntimeMethod): void {
    this.customMethods.set(method.name, method);
  }

  public registerMethods(methods: RuntimeMethod[]): void {
    for (const method of methods) {
      this.registerMethod(method);
    }
  }

  public getMethods(): RuntimeMethod[] {
    return Array.from(this.customMethods.values());
  }

  public clear(): void {
    this.customMethods.clear();
  }
}

export const gdomRegistry = new GDomRegistry();

/**
 * Extracts method signatures and property function signatures from an interface declaration.
 */
function extractMethodsFromInterface(interfaceDecl: Node): RuntimeMethod[] {
  if (!Node.isInterfaceDeclaration(interfaceDecl)) {
    return [];
  }

  const results: RuntimeMethod[] = [];

  // 1. Regular interface methods: foo(x: number): void;
  for (const method of interfaceDecl.getMethods()) {
    const name = method.getName();
    const returnType = method.getReturnTypeNode()?.getText() ?? "void";
    const jsDocs = method.getJsDocs();
    const docText = jsDocs.length > 0 ? jsDocs[0].getDescription().trim() : "";
    const documentation =
      docText.length > 0 ? docText : `Custom gDom method '${name}' defined in global declarations.`;

    const rawSig = method.getText().trim().replace(/;$/, "");
    results.push({
      name,
      signature: rawSig,
      documentation,
      returnType,
    });
  }

  // 2. Property signatures with function types: foo: (x: number) => void;
  for (const prop of interfaceDecl.getProperties()) {
    const name = prop.getName();
    const typeNode = prop.getTypeNode();
    if (typeNode && Node.isFunctionTypeNode(typeNode)) {
      const returnType = typeNode.getReturnTypeNode()?.getText() ?? "void";
      const jsDocs = prop.getJsDocs();
      const docText = jsDocs.length > 0 ? jsDocs[0].getDescription().trim() : "";
      const documentation =
        docText.length > 0
          ? docText
          : `Custom gDom property method '${name}' defined in global declarations.`;

      const rawSig = `${name}${typeNode.getText()}`;
      results.push({
        name,
        signature: rawSig,
        documentation,
        returnType,
      });
    }
  }

  return results;
}

function extractWindowGDomTargetNames(
  interfaces: InterfaceDeclaration[],
  targetNames: Set<string>,
): void {
  for (const iface of interfaces) {
    if (iface.getName() !== "Window") {
      continue;
    }
    for (const prop of iface.getProperties()) {
      const propName = prop.getName();
      if (propName === "gDom" || propName === "dom") {
        const typeNode = prop.getTypeNode();
        if (typeNode) {
          targetNames.add(typeNode.getText().trim());
        }
      }
    }
  }
}

function findMatchingInterfaces(
  interfaces: InterfaceDeclaration[],
  targetInterfaceNames: Set<string>,
): Node[] {
  const matchingInterfaces: Node[] = [];

  for (const iface of interfaces) {
    const name = iface.getName();
    const extendsClauses = iface.getExtends();
    const extendsGDomOrWindow = extendsClauses.some((ext) => {
      const text = ext.getText().trim();
      return (
        text === "GDom" ||
        text === "Window" ||
        text.includes("GDom") ||
        targetInterfaceNames.has(text)
      );
    });

    if (targetInterfaceNames.has(name) || extendsGDomOrWindow) {
      matchingInterfaces.push(iface);
    }
  }

  return matchingInterfaces;
}

function collectMethods(matchingInterfaces: Node[]): RuntimeMethod[] {
  const extracted: RuntimeMethod[] = [];
  const seenNames = new Set<string>();

  for (const iface of matchingInterfaces) {
    const methods = extractMethodsFromInterface(iface);
    for (const m of methods) {
      if (!seenNames.has(m.name)) {
        seenNames.add(m.name);
        extracted.push(m);
      }
    }
  }

  return extracted;
}

/**
 * Scans TypeScript declaration content (e.g. global.d.ts) for custom GDom interface extensions.
 * Looks for:
 * - Interfaces named GDom, SGDom, StreakDOM, etc.
 * - Interfaces extending GDom or Window
 * - Custom interface assigned to Window.gDom
 */
export function scanGDomTypes(content: string, filePath = "global.d.ts"): RuntimeMethod[] {
  let sourceFile;
  try {
    sourceFile = gdomProject.createSourceFile(filePath, content, {
      overwrite: true,
    });
  } catch {
    return [];
  }

  const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
  const targetInterfaceNames = new Set<string>(["GDom", "SGDom", "StreakDOM"]);

  // Pass 1: Check if Window interface specifies a custom gDom type
  extractWindowGDomTargetNames(interfaces, targetInterfaceNames);

  // Pass 2: Find all interfaces that match known names or extend GDom / Window
  const matchingInterfaces = findMatchingInterfaces(interfaces, targetInterfaceNames);

  // Pass 3: Extract methods from all matching interfaces
  const extracted = collectMethods(matchingInterfaces);

  // Clean up source file from in-memory project
  try {
    gdomProject.removeSourceFile(sourceFile);
  } catch {
    // Ignore cleanup error
  }

  return extracted;
}
