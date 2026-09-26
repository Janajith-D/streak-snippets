import { Node, type SourceFile } from "ts-morph";

/**
 * Determines whether a file path or URI represents a Streak data handler file.
 * Data handlers are located in src/handler(s)/ or handler(s)/ and are not TSX or test files.
 */
export function isDataHandlerFile(uriOrPath: string): boolean {
  const norm = decodeURIComponent(uriOrPath).replaceAll("\\", "/").toLowerCase();
  if (norm.endsWith(".tsx")) {
    return false;
  }
  if (
    norm.includes("/test/") ||
    norm.includes("/tests/") ||
    norm.endsWith(".test.ts") ||
    norm.endsWith(".spec.ts")
  ) {
    return norm.includes("datahandler");
  }
  return /(?:^|\/)src\/handlers?\//.test(norm) || /(?:^|\/)handlers?\//.test(norm);
}

function unwrapParentheses(node: Node): Node {
  let curr = node;
  while (Node.isParenthesizedExpression(curr)) {
    curr = curr.getExpression();
  }
  return curr;
}

function resolveTargetNodeByName(sourceFile: SourceFile, name: string): Node | undefined {
  const fn = sourceFile.getFunction(name);
  if (fn) {
    return fn;
  }
  const varDecl = sourceFile.getVariableDeclaration(name);
  if (varDecl) {
    const init = varDecl.getInitializer();
    if (init) {
      const unwrappedInit = unwrapParentheses(init);
      if (Node.isArrowFunction(unwrappedInit) || Node.isFunctionExpression(unwrappedInit)) {
        return unwrappedInit;
      }
    }
    return varDecl;
  }
  return undefined;
}

function getHandlerFromExportAssignment(sourceFile: SourceFile): Node | undefined {
  const exportAssignments = sourceFile.getExportAssignments();
  for (const ea of exportAssignments) {
    const expr = unwrapParentheses(ea.getExpression());

    if (Node.isArrowFunction(expr) || Node.isFunctionExpression(expr)) {
      return expr;
    }

    if (Node.isIdentifier(expr)) {
      const resolved = resolveTargetNodeByName(sourceFile, expr.getText());
      if (resolved) {
        return resolved;
      }
    }
  }
  return undefined;
}

function getHandlerFromNamedDefaultExport(sourceFile: SourceFile): Node | undefined {
  for (const expDecl of sourceFile.getExportDeclarations()) {
    for (const named of expDecl.getNamedExports()) {
      if (named.getAliasNode()?.getText() === "default") {
        const resolved = resolveTargetNodeByName(sourceFile, named.getName());
        if (resolved) {
          return resolved;
        }
      }
    }
  }
  return undefined;
}

/**
 * Retrieves the default-exported handler function or node in a Streak data handler file.
 * Returns undefined if no default export function is found.
 */
export function getDefaultExportedHandler(sourceFile: SourceFile): Node | undefined {
  // 1. Direct export default function declaration:
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isDefaultExport()) {
      return fn;
    }
  }

  // 2. Export assignment:
  const fromAssignment = getHandlerFromExportAssignment(sourceFile);
  if (fromAssignment) {
    return fromAssignment;
  }

  // 3. Named export with alias to default:
  return getHandlerFromNamedDefaultExport(sourceFile);
}
