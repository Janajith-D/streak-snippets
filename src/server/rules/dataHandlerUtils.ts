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

/**
 * Retrieves the default-exported handler function or node in a Streak data handler file.
 * Returns undefined if no default export function is found.
 */
export function getDefaultExportedHandler(sourceFile: SourceFile): Node | undefined {
  // 1. Direct export default function declaration:
  //    export default async function(...) {} or export default function handler(...) {}
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isDefaultExport()) {
      return fn;
    }
  }

  // 2. Export assignment:
  //    export default handler; or export default async () => {};
  const exportAssignments = sourceFile.getExportAssignments();
  for (const ea of exportAssignments) {
    const rawExpr = ea.getExpression();
    if (!rawExpr) {
      continue;
    }
    const expr = unwrapParentheses(rawExpr);

    if (Node.isArrowFunction(expr) || Node.isFunctionExpression(expr)) {
      return expr;
    }

    if (Node.isIdentifier(expr)) {
      const name = expr.getText();
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
    }
  }

  // 3. Named export with alias to default:
  //    export { myHandler as default };
  for (const expDecl of sourceFile.getExportDeclarations()) {
    for (const named of expDecl.getNamedExports()) {
      const alias = named.getAliasNode()?.getText();
      if (alias === "default") {
        const targetName = named.getName();
        const fn = sourceFile.getFunction(targetName);
        if (fn) {
          return fn;
        }
        const varDecl = sourceFile.getVariableDeclaration(targetName);
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
      }
    }
  }

  return undefined;
}
