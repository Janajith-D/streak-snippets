import { CompletionItem, CompletionItemKind, InsertTextFormat, TextEdit } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SourceFile } from "ts-morph";
import { CompletionContext } from "./types";
import { isInsideScriptCallback } from "./scriptCompletions";

interface ComponentConfig {
  name: string;
  snippet: string;
  detail: string;
  documentation: string;
}

const BU_COMPONENTS: ComponentConfig[] = [
  {
    name: "WidgetPlaceholder",
    snippet: '<WidgetPlaceholder id="${1:widget-id}" type="${2:widget-type}" />',
    detail: "Streak WidgetPlaceholder Component",
    documentation: "Specifies a placeholder where a widget will be injected dynamically.",
  },
  {
    name: "Script",
    snippet: [
      '<Script id="${1:my-script}">',
      "  {(gDom: any) => {",
      "    $0",
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
  let i = offset - 1;
  while (i >= 0) {
    const char = text[i];
    if (char === ">") {
      return false;
    }
    if (char === "<") {
      if (i + 1 < text.length && text[i + 1] === "/") {
        return false;
      }
      return true;
    }
    if (/[\s{};=]/.test(char)) {
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
      return [];
    }

    const newNames = [...namedImports, componentName].sort();
    const originalText = importDecl.getText();
    const originalQuotes = originalText.includes("'") ? "'" : '"';
    const isMultiLine = originalText.includes("\n");

    let newImportText = "";
    if (isMultiLine || newNames.length > 1) {
      let indent = "    "; // default 4 spaces
      const lines = originalText.split("\n");
      for (const line of lines) {
        const match = line.match(/^(\s+)[a-zA-Z]/);
        if (match) {
          indent = match[1];
          break;
        }
      }
      newImportText = [
        "import {",
        ...newNames.map((name, index) => `${indent}${name}${index === newNames.length - 1 ? "" : ","}`),
        `} from ${originalQuotes}streak-forge/components${originalQuotes};`
      ].join("\n");
    } else {
      newImportText = `import { ${newNames.join(", ")} } from ${originalQuotes}streak-forge/components${originalQuotes};`;
    }

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
  if (isJsxTagStart(context.text, context.offset)) {
    return BU_COMPONENTS.map((comp) => {
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

  // Suggest sfS template snippet with auto-import
  if (context.uri.endsWith(".tsx")) {
    if (isInsideScriptCallback(context.text, context.offset)) {
      return [];
    }
    const textBefore = context.text.slice(0, context.offset);
    const lastWordMatch = textBefore.match(/[a-zA-Z0-9_]*$/);
    const word = lastWordMatch ? lastWordMatch[0] : "";
    if ("sfS".startsWith(word) || word === "") {
      const autoImports = getAutoImportEdit(document, sourceFile, "Script");
      return [
        {
          label: "sfS",
          kind: CompletionItemKind.Snippet,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText: [
            "<Script",
            '    id="${1:my-script}"',
            "    options={{",
            '        ${2:color}: "${3:#818cf8}",',
            "        ${4:delay}: ${5:800}",
            "    }}",
            ">",
            "    {(gDom: any, options: any) => {",
            "        $0",
            "    }}",
            "</Script>"
          ].join("\n"),
          detail: "Script Element (sfS)",
          documentation: "Insert a Script element template with options and callback.",
          additionalTextEdits: autoImports,
        }
      ];
    }
  }

  return [];
}
