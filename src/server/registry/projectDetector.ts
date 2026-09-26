import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Checks whether a given directory is the root of a Streak.js project.
 * Primarily checks if package.json includes "streak-forge" in dependencies,
 * or if streak.sitemap.json exists.
 */
interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  streak?: unknown;
}

export function isStreakProjectDirectory(dirPath: string): boolean {
  try {
    // 1. Direct package.json dependency check (Primary indicator)
    const pkgPath = path.join(dirPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as PackageManifest;
      const allDeps: Record<string, string | undefined> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
        ...pkg.optionalDependencies,
      };

      if (
        "streak-forge" in allDeps ||
        "streakjs" in allDeps ||
        Object.keys(allDeps).some((d) => d.startsWith("@streakjs/")) ||
        pkg.streak !== undefined
      ) {
        return true;
      }
    }

    // 2. Sitemap declaration check
    if (
      fs.existsSync(path.join(dirPath, "streak.sitemap.json")) ||
      fs.existsSync(path.join(dirPath, "sitemap.json"))
    ) {
      return true;
    }

    // 3. Structural layout fallback (src/widgets + src/layouts or src/handlers)
    const hasWidgets = fs.existsSync(path.join(dirPath, "src", "widgets"));
    const hasLayouts =
      fs.existsSync(path.join(dirPath, "src", "layouts")) ||
      fs.existsSync(path.join(dirPath, "src", "layout"));
    const hasHandlers =
      fs.existsSync(path.join(dirPath, "src", "handlers")) ||
      fs.existsSync(path.join(dirPath, "src", "handler"));

    if (hasWidgets || hasLayouts || hasHandlers) {
      return true;
    }

    // 4. Configuration file check
    if (
      fs.existsSync(path.join(dirPath, "streak.config.js")) ||
      fs.existsSync(path.join(dirPath, "streak.config.ts")) ||
      fs.existsSync(path.join(dirPath, "streak.config.json"))
    ) {
      return true;
    }
  } catch {
    /* ignore file read/parse errors */
  }

  return false;
}

/**
 * Resolves the root directory of the Streak.js subproject containing the given document URI or path.
 * Traverses parent directories upwards. Returns null if the file does not belong to any Streak project.
 */
export function findStreakProjectRoot(uriOrPath: string, workspaceRoot?: string): string | null {
  try {
    let filePath = uriOrPath;
    if (uriOrPath.startsWith("file://")) {
      filePath = fileURLToPath(uriOrPath);
    }

    let currentDir =
      fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
        ? filePath
        : path.dirname(filePath);

    while (currentDir && currentDir !== path.dirname(currentDir)) {
      if (isStreakProjectDirectory(currentDir)) {
        return currentDir;
      }

      if (workspaceRoot && path.resolve(currentDir) === path.resolve(workspaceRoot)) {
        if (isStreakProjectDirectory(currentDir)) {
          return currentDir;
        }
        break;
      }

      currentDir = path.dirname(currentDir);
    }
  } catch {
    /* ignore resolution errors */
  }

  return null;
}

/**
 * Returns whether a given document URI or path belongs to an identified Streak.js project.
 */
export function isStreakFile(uriOrPath: string, workspaceRoot?: string): boolean {
  return findStreakProjectRoot(uriOrPath, workspaceRoot) !== null;
}
