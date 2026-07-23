export interface ImportInfo {
  moduleSpecifier: string;
  namedImports: string[];
  defaultImport?: string;
}

export interface ExportInfo {
  name: string;
  isDefault: boolean;
  kind: "function" | "variable" | "class" | "type" | "unknown";
}

export interface AnalysisResult {
  uri: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  components: string[];
  jsxElements: string[];
  errors: string[];
}
