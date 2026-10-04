export interface RuntimePackageInfo {
  relativePath: string;
  absolutePath: string;
  fileName: string;
  urlPath: string;
}

export class RuntimePackageRegistry {
  private static instance: RuntimePackageRegistry | undefined;
  private readonly registry = new Map<string, RuntimePackageInfo>();

  private constructor() {
    /* singleton */
  }

  public static getInstance(): RuntimePackageRegistry {
    RuntimePackageRegistry.instance ??= new RuntimePackageRegistry();
    return RuntimePackageRegistry.instance;
  }

  public get(relativePath: string): RuntimePackageInfo | undefined {
    const normalized = relativePath.replaceAll("\\", "/").replace(/^\.?\//, "");
    return this.registry.get(normalized);
  }

  public getAll(): RuntimePackageInfo[] {
    return Array.from(this.registry.values());
  }

  public set(info: RuntimePackageInfo): void {
    const normalized = info.relativePath.replaceAll("\\", "/").replace(/^\.?\//, "");
    this.registry.set(normalized, { ...info, relativePath: normalized });
  }

  public deleteByPath(absolutePath: string): void {
    const normalized = absolutePath.replaceAll("\\", "/");
    for (const [key, value] of this.registry.entries()) {
      if (value.absolutePath.replaceAll("\\", "/") === normalized) {
        this.registry.delete(key);
      }
    }
  }

  public clear(): void {
    this.registry.clear();
  }
}

export const runtimePackageRegistry = RuntimePackageRegistry.getInstance();
