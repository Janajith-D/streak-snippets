export interface RuntimeMethod {
  name: string;
  signature: string;
  documentation: string;
  returnType: string;
}

export const GDOM_METHODS: RuntimeMethod[] = [
  {
    name: "loadDynamicComponent",
    signature: "loadDynamicComponent(id: string, callback?: () => void)",
    documentation:
      "Loads a dynamic component and executes a callback after rendering.",
    returnType: "void",
  },
  {
    name: "getElement",
    signature: "getElement()",
    documentation: "Gets the underlying DOM element for this Script block.",
    returnType: "HTMLElement",
  },
  {
    name: "updateOptions",
    signature: "updateOptions(newOptions: Record<string, any>)",
    documentation: "Updates the options passed to the callback dynamically.",
    returnType: "void",
  },
];
