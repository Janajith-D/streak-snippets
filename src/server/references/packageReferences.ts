import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Node, type CallExpression } from "ts-morph";
import { Location, Range, Position } from "vscode-languageserver/node";
import { isLoadPackageCall } from "../rules/packageRules";

/**
 * Resolves the package name if the current node or document represents a runtime package.
 */
export function resolvePackageNameFromContext(
  node: Node | undefined,
  uri: string,
  _projectRoot?: string,
): string | null {
  // Case 1: Active document is itself inside public/assets/
  const normalizedUri = uri.replaceAll("\\", "/");
  const marker = "/public/assets/";
  const markerIndex = normalizedUri.indexOf(marker);
  if (markerIndex !== -1 && normalizedUri.endsWith(".js")) {
    return decodeURIComponent(normalizedUri.slice(markerIndex + marker.length));
  }

  if (!node) {
    return null;
  }

  // Case 2: Node is a StringLiteral argument to loadPackage
  if (Node.isStringLiteral(node)) {
    const parent = node.getParent();
    if (Node.isCallExpression(parent) && isLoadPackageCall(parent)) {
      return node.getLiteralValue();
    }
  }

  // Case 3: Node is identifier 'loadPackage'
  if (Node.isIdentifier(node) && node.getText() === "loadPackage") {
    const parent = node.getParent();
    let callExpr: CallExpression | undefined;
    if (Node.isCallExpression(parent)) {
      callExpr = parent;
    } else if (Node.isPropertyAccessExpression(parent)) {
      const grandParent = parent.getParent();
      if (Node.isCallExpression(grandParent)) {
        callExpr = grandParent;
      }
    }
    if (callExpr) {
      const args = callExpr.getArguments();
      if (args.length > 0 && Node.isStringLiteral(args[0])) {
        return args[0].getLiteralValue();
      }
    }
  }

  return null;
}

function findSourceFilesRecursive(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return fileList;
  }
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === "out"
      ) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findSourceFilesRecursive(fullPath, fileList);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        fileList.push(fullPath);
      }
    }
  } catch {
    // Ignore read errors
  }
  return fileList;
}

function findPackageOccurrencesInText(
  text: string,
  targetPackage: string,
  fileUri: string,
): Location[] {
  const locations: Location[] = [];
  if (!text.includes("loadPackage")) {
    return locations;
  }

  const regex = /(?:gDom\.)?loadPackage\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchedPath = match[2];
    if (matchedPath === targetPackage) {
      const fullMatch = match[0];
      const matchIndex = match.index;
      const pathIndexInMatch = fullMatch.indexOf(matchedPath);
      const startOffset = matchIndex + pathIndexInMatch;

      const prefix = text.substring(0, startOffset);
      const lines = prefix.split("\n");
      const startLine = lines.length - 1;
      const startCol = lines.at(-1)?.length ?? 0;

      const matchedLines = matchedPath.split("\n");
      const endLine = startLine + matchedLines.length - 1;
      const endCol =
        matchedLines.length > 1
          ? (matchedLines.at(-1)?.length ?? 0)
          : startCol + matchedPath.length;

      locations.push(
        Location.create(
          fileUri,
          Range.create(
            Position.create(startLine, startCol),
            Position.create(endLine, endCol),
          ),
        ),
      );
    }
  }
  return locations;
}

/**
 * Searches for all call sites referencing the target runtime package across the project.
 */
export function findPackageReferences(
  targetPackage: string,
  projectRoot: string,
  includeDeclaration = false,
): Location[] {
  const locations: Location[] = [];
  const normalizedTarget = targetPackage.replaceAll("\\", "/").replace(/^\.?\//, "");

  if (includeDeclaration) {
    const pkgPath = path.join(projectRoot, "public", "assets", normalizedTarget);
    if (fs.existsSync(pkgPath)) {
      const pkgUri = pathToFileURL(pkgPath).toString();
      locations.push(
        Location.create(
          pkgUri,
          Range.create(Position.create(0, 0), Position.create(0, 0)),
        ),
      );
    }
  }

  const srcDir = path.join(projectRoot, "src");
  const searchDirs = fs.existsSync(srcDir) ? [srcDir] : [projectRoot];

  for (const dir of searchDirs) {
    const files = findSourceFilesRecursive(dir);
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const fileUri = pathToFileURL(file).toString();
        const found = findPackageOccurrencesInText(content, normalizedTarget, fileUri);
        locations.push(...found);
      } catch {
        // Skip unreadable files
      }
    }
  }

  return locations;
}
