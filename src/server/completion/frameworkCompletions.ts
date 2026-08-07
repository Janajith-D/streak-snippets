import {
  type CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  type TextEdit,
} from "vscode-languageserver/node";
import { type TextDocument } from "vscode-languageserver-textdocument";
import { type SourceFile } from "ts-morph";
import { type CompletionContext } from "./types";
import { isInsideScriptCallback } from "./scriptCompletions";
import * as path from "node:path";

interface ComponentConfig {
  name: string;
  snippet: string;
  detail: string;
  documentation: string;
}

const BU_COMPONENTS: ComponentConfig[] = [
  {
    name: "WidgetPlaceholder",
    snippet:
      '<WidgetPlaceholder id="${1:widget-id}" type="${2:widget-type}" />',
    detail: "Streak WidgetPlaceholder Component",
    documentation:
      "Specifies a placeholder where a widget will be injected dynamically.",
  },
  {
    name: "Script",
    snippet: [
      "<Script",
      '  id="${1:my-script}"',
      "  options={{",
      '    ${2:color}: "${3:#818cf8}",',
      "        ${4:delay}: ${5:800}",
      "  }}",
      ">",
      "  {(gDom: any, options: any) => {",
      "    $0",
      "  }}",
      "</Script>",
    ].join("\n"),
    detail: "Streak Browser-side Script Component",
    documentation:
      "Executes client-side script code with direct access to the DOM node via gDom.",
  },
  {
    name: "Preload",
    snippet: '<Preload href="${1:/style.css}" as="${2:style}" />',
    detail: "Streak Asset Preload Component",
    documentation:
      "Preloads static resources (e.g., styles, scripts, fonts, images) during build-time.",
  },
  {
    name: "Dynamic",
    snippet: ['<Dynamic id="${1:dynamic-id}">', "  $2", "</Dynamic>"].join(
      "\n",
    ),
    detail: "Streak Dynamic Injected Component",
    documentation:
      "Wraps components that will be dynamically injected/loaded on the client side.",
  },
];

/** Detects indentation from an existing import declaration text. */
const INDENT_RE = /^(\s+)\w/;

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
 * Extracts the partial identifier being typed immediately before the cursor.
 * Uses string split on non-word chars — O(n), no regex backtracking.
 */
function getTrailingWord(context: CompletionContext): string {
  const textBefore = context.text.slice(0, context.offset);
  return textBefore.split(/\W/).at(-1) ?? "";
}

/**
 * Builds the updated import declaration text when merging a new name into an
 * existing `streak-forge/components` import.
 * Extracted to reduce cognitive complexity of getAutoImportEdit.
 */
function buildUpdatedImportText(
  originalText: string,
  originalQuotes: string,
  newNames: string[],
): string {
  // Single-name + single-line stays as a one-liner; otherwise go multi-line
  if (newNames.length <= 1 && !originalText.includes("\n")) {
    return `import { ${newNames.join(", ")} } from ${originalQuotes}streak-forge/components${originalQuotes};`;
  }

  // Detect the indentation style from the existing import text
  let indent = "    ";
  for (const line of originalText.split("\n")) {
    const m = INDENT_RE.exec(line);
    if (m) {
      indent = m[1];
      break;
    }
  }

  return [
    "import {",
    ...newNames.map(
      (name, i) => `${indent}${name}${i === newNames.length - 1 ? "" : ","}`,
    ),
    `} from ${originalQuotes}streak-forge/components${originalQuotes};`,
  ].join("\n");
}

/**
 * Returns sfWid / sfWidE scaffold completions when editing inside a widgets/ folder.
 * Extracted to reduce cognitive complexity of getFrameworkCompletions.
 */
function getWidgetScaffoldCompletions(
  context: CompletionContext,
  word: string,
): CompletionItem[] {
  const componentName = path.basename(context.uri).replace(/\.[^/.]+$/, "");
  const completions: CompletionItem[] = [];

  if ("sfWid".startsWith(word) || word === "sfWid") {
    completions.push({
      label: "sfWid",
      kind: CompletionItemKind.Snippet,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: [
        `const ${componentName} = () => {};`,
        "",
        `export default ${componentName};`,
      ].join("\n"),
      detail: `Widget Scaffold (sfWid)`,
      documentation: `Scaffold a basic ${componentName} widget.`,
    });
  }

  if ("sfWidE".startsWith(word) || word === "sfWidE") {
    completions.push({
      label: "sfWidE",
      kind: CompletionItemKind.Snippet,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: [
        `type ${componentName}Props = {`,
        "  data?: {",
        "    name?: string;",
        "  };",
        "};",
        "",
        `const ${componentName} = (props: ${componentName}Props) => {`,
        `  return <div>${componentName} {props?.data?.name}</div>;`,
        "};",
        "",
        `export default ${componentName};`,
      ].join("\n"),
      detail: `Widget with Props Scaffold (sfWidE)`,
      documentation: `Scaffold a props-enabled ${componentName} widget.`,
    });
  }

  return completions;
}

/**
 * Returns the sfS Script snippet completion for .tsx files outside Script callbacks.
 * Extracted to reduce cognitive complexity of getFrameworkCompletions.
 */
function getScriptSnippetCompletion(
  document: TextDocument,
  sourceFile: SourceFile,
  word: string,
): CompletionItem[] {
  if (!("sfS".startsWith(word) || word === "")) {
    return [];
  }
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
        "</Script>",
      ].join("\n"),
      detail: "Script Element (sfS)",
      documentation:
        "Insert a Script element template with options and callback.",
      additionalTextEdits: autoImports,
    },
  ];
}

/**
 * Computes additional text edits to automatically import a component.
 */
export function getAutoImportEdit(
  document: TextDocument,
  sourceFile: SourceFile,
  componentName: string,
): TextEdit[] {
  const importDecl = sourceFile.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === "streak-forge/components",
  );

  if (importDecl) {
    const namedImports = importDecl.getNamedImports().map((ni) => ni.getName());
    if (namedImports.includes(componentName)) {
      return [];
    }

    const newNames = [...namedImports, componentName].sort((a, b) =>
      a.localeCompare(b),
    );
    const originalText = importDecl.getText();
    const originalQuotes = originalText.includes("'") ? "'" : '"';
    const newImportText = buildUpdatedImportText(
      originalText,
      originalQuotes,
      newNames,
    );

    return [
      {
        range: {
          start: document.positionAt(importDecl.getStart()),
          end: document.positionAt(importDecl.getEnd()),
        },
        newText: newImportText,
      },
    ];
  }

  // No existing streak-forge/components import — insert a fresh one
  const imports = sourceFile.getImportDeclarations();
  let insertOffset = 0;
  let prefix = "";
  let suffix = "\n";

  if (imports.length > 0) {
    insertOffset = imports[imports.length - 1].getEnd();
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

export function getFrameworkCompletions(
  context: CompletionContext,
  document: TextDocument,
  sourceFile: SourceFile,
): CompletionItem[] {
  // 1. JSX component tag completions (e.g. <WidgetPlaceholder, <Script)
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

  // 2. Widget scaffold snippets — only inside src/widgets/ files
  if (/[/\\]widgets[/\\]/.test(context.uri)) {
    const word = getTrailingWord(context);
    const items = getWidgetScaffoldCompletions(context, word);
    if (items.length > 0) {
      return items;
    }
  }

  // 3. sfS Script snippet — only in .tsx files, outside Script callbacks
  if (
    context.uri.endsWith(".tsx") &&
    !isInsideScriptCallback(context.text, context.offset)
  ) {
    return getScriptSnippetCompletion(
      document,
      sourceFile,
      getTrailingWord(context),
    );
  }

  return [];
}
