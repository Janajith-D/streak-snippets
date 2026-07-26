import { CompletionItem, CompletionItemKind, InsertTextFormat, TextEdit } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SourceFile } from "ts-morph";
import { CompletionContext } from "./types";

interface ComponentConfig {
  name: string;
  snippet: string;
  detail: string;
  documentation: string;
}

const BUILT_IN_COMPONENTS: ComponentConfig[] = [
  {
    name: "WidgetPlaceholder",
    snippet: '<WidgetPlaceholder id="${1:widget-id}" type="${2:widget-type}" />',
    detail: "Streak WidgetPlaceholder Component",
    documentation: "Specifies a placeholder where a widget will be injected dynamically.",
  },
  {
    name: "Script",
    snippet: [
      '<Script id="${1:script-id}">',
      "  {(${2:gDom}) => {",
      "    $3",
      "  }}",
      "</Script>",
    ].join("\n"),
    detail: "Streak Browser-side Script Component",
    documentation: "Executes client-side script code with direct access to the DOM node via gDom.",
  },
  {
    name: "Preload",
    snippet: '<Preload href="${1:/style.css}" as="${2:style}" />',
    detail: "Streak Asset Preload Component",
    documentation: "Preloads static resources (e.g., styles, scripts, fonts, images) during build-time.",
  },
  {
    name: "Dynamic",
    snippet: [
      '<Dynamic id="${1:dynamic-id}">',
      "  $2",
      "</Dynamic>",
    ].join("\n"),
    detail: "Streak Dynamic Injected Component",
    documentation: "Wraps components that will be dynamically injected/loaded on the client side.",
  },
];

/**
 * Checks if the trigger was a JSX tag start (e.g., typing '<' or '<W')
 */
function isJsxTagStart(text: string, offset: number): boolean {
  // Look backwards from the offset to find '<' or '<' followed by characters without a closing '>'
  let i = offset - 1;
  while (i >= 0) {
    const char = text[i];
    if (char === ">") {
      return false; // Tag is closed or we're outside a tag
    }
    if (char === "<") {
      // Check if it's not a closing tag start (i.e., not '</')
      if (i + 1 < text.length && text[i + 1] === "/") {
        return false;
      }
      return true;
    }
    // If we hit new lines or characters that make it clear we're not typing a tag name, return false
    if (/[\s{};=]/.test(char)) {
      // Spaces are allowed if we are typing attributes, but at this point we are looking for tag name.
      // If we see space, it means we are already past the tag name.
      return false;
    }
    i--;
  }
  return false;
}

/**
 * Computes additional text edits to automatically import a component.
 */
export function getAutoImportEdit(
  document: TextDocument,
  sourceFile: SourceFile,
  componentName: string
): TextEdit[] {
  const importDecl = sourceFile.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === "streak-forge/components"
  );

  if (importDecl) {
    const namedImports = importDecl.getNamedImports().map((ni) => ni.getName());
    if (namedImports.includes(componentName)) {
      return []; // Already imported
    }

    // Replace the existing import list
    const newNames = [...namedImports, componentName].sort();
    const newImportText = `import { ${newNames.join(", ")} } from "streak-forge/components";`;
    const start = importDecl.getStart();
    const end = importDecl.getEnd();

    return [
      {
        range: {
          start: document.positionAt(start),
          end: document.positionAt(end),
        },
        newText: newImportText,
      },
    ];
  } else {
    // Insert new import statement at the beginning of the file (or after other imports)
    const imports = sourceFile.getImportDeclarations();
    let insertOffset = 0;
    let prefix = "";
    let suffix = "\n";

    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      insertOffset = lastImport.getEnd();
      prefix = "\n";
      suffix = "";
    }

    const newImportText = `${prefix}import { ${componentName} } from "streak-forge/components";${suffix}`;
    const pos = document.positionAt(insertOffset);

    return [
      {
        range: { start: pos, end: pos },
        newText: newImportText,
      },
    ];
  }
}

export function getFrameworkCompletions(
  context: CompletionContext,
  document: TextDocument,
  sourceFile: SourceFile
): CompletionItem[] {
  if (!isJsxTagStart(context.text, context.offset)) {
    return [];
  }

  return BUILT_IN_COMPONENTS.map((comp) => {
    const autoImports = getAutoImportEdit(document, sourceFile, comp.name);
    return {
      label: comp.name,
      kind: CompletionItemKind.Snippet,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: comp.snippet,
      detail: comp.detail,
      documentation: comp.documentation,
      additionalTextEdits: autoImports,
    };
  });
}
