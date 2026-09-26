export interface RuntimeMethod {
  name: string;
  signature: string;
  documentation: string;
  returnType: string;
}

export const GDOM_METHODS: RuntimeMethod[] = [
  {
    name: "addResourceToBody",
    signature: "addResourceToBody(path: string, callback?: () => void)",
    documentation:
      "Appends an external script or stylesheet resource to the document body and executes an optional callback upon loading.",
    returnType: "void",
  },
  {
    name: "loadPackage",
    signature: "loadPackage(packageName: string, callback?: () => void)",
    documentation:
      "Dynamically loads an external package or library into the page runtime and fires an optional callback when ready.",
    returnType: "void",
  },
  {
    name: "loadDynamicComponent",
    signature: "loadDynamicComponent(id: string, callback?: () => void)",
    documentation:
      "Loads a dynamic component by its placeholder id and executes an optional callback after rendering.",
    returnType: "void",
  },
  {
    name: "addWidgetToBody",
    signature: "addWidgetToBody(widgetName: string, props?: Record<string, any>)",
    documentation:
      "Dynamically appends a registered widget component to the document body with optional props.",
    returnType: "void",
  },
];
