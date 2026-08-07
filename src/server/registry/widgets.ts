export interface WidgetProp {
  name: string;
  type: string;
  isOptional: boolean;
  docComment?: string;
}

export interface WidgetMetadata {
  name: string;
  filePath: string;
  docComment?: string;
  props: WidgetProp[];
}

export class WidgetRegistry {
  private static instance: WidgetRegistry;
  private readonly registry = new Map<string, WidgetMetadata>();

  private constructor() {}

  public static getInstance(): WidgetRegistry {
    if (!WidgetRegistry.instance) {
      WidgetRegistry.instance = new WidgetRegistry();
    }
    return WidgetRegistry.instance;
  }

  public get(name: string): WidgetMetadata | undefined {
    return this.registry.get(name);
  }

  public getAll(): WidgetMetadata[] {
    return Array.from(this.registry.values());
  }

  public set(name: string, meta: WidgetMetadata): void {
    this.registry.set(name, meta);
  }

  public deleteByPath(filePath: string): void {
    for (const [key, value] of this.registry.entries()) {
      if (value.filePath === filePath) {
        this.registry.delete(key);
      }
    }
  }

  public clear(): void {
    this.registry.clear();
  }
}

export const widgetRegistry = WidgetRegistry.getInstance();
