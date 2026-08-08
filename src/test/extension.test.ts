import { type Hover, type MarkupContent, type Diagnostic } from "vscode-languageserver/node";
import * as assert from "assert";
import * as path from "node:path";
import * as fs from "node:fs";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { analyzeAndParseDocument } from "../server/parser/analyzer";
import { runRules } from "../server/rules/runner";
import { widgetPlaceholderRule } from "../server/rules/widgetPlaceholderRule";
import { dataHandlerAsyncRule } from "../server/rules/dataHandlerAsyncRule";
import { dataHandlerStatusValueRule } from "../server/rules/dataHandlerStatusValueRule";
import { reactHooksNotAllowedRule } from "../server/rules/reactHooksNotAllowedRule";
import { unsafeWidgetDataAccessRule } from "../server/rules/unsafeWidgetDataAccessRule";
import { invalidWidgetPropsContractRule } from "../server/rules/invalidWidgetPropsContractRule";
import {
  scriptClosureCaptureRule,
  asyncScriptCallbackRule,
  scriptRequiredIdRule,
} from "../server/rules/scriptRules";
import { dynamicComponentIdRule } from "../server/rules/dynamicComponentIdRule";
import { duplicatedWidgetRule } from "../server/rules/duplicatedWidgetRule";
import { componentNestingRule } from "../server/rules/componentNestingRule";
import { scriptStructureRule } from "../server/rules/scriptStructureRule";
import { allowedImportsRule } from "../server/rules/allowedImportsRule";
import { forbiddenPatternsRule } from "../server/rules/forbiddenPatternsRule";
import { widgetFilenameMatchesComponentRule } from "../server/rules/widgetFilenameMatchesComponentRule";
import { missingDefaultExportRule } from "../server/rules/missingDefaultExportRule";
import { deadWidgetRule } from "../server/rules/deadWidgetRule";
import { sitemapRegistry } from "../server/registry/sitemaps";
import { validateSitemap } from "../server/rules/sitemapRules";
import { resolveHover, resolveSitemapHover } from "../server/hover/provider";
import { resolveDefinition, resolveSitemapDefinition } from "../server/definition/provider";
import { resolveCodeActions } from "../server/codeaction/provider";
import { widgetRegistry } from "../server/registry/widgets";
import { scanWorkspace } from "../server/registry/scanner";
import { getCompletions } from "../server/completion/provider";
import { getJsxContext } from "../server/completion/jsxAttributeCompletions";
import { getAutoImportEdit } from "../server/completion/frameworkCompletions";
import { isInsideLoadDynamicComponent } from "../server/completion/scriptCompletions";
import { TextDocument } from "vscode-languageserver-textdocument";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Sample test", () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });

  // ── AST Analyzer Tests ─────────────────────────────────────────────

  test("AST Analyzer parses imports and exports from TypeScript file", () => {
    const code = `
      import { WidgetPlaceholder } from "streak-forge/components";
      
      const getData = async () => {
        return { status: 200 };
      };
      
      export default getData;
    `;
    const { analysis } = analyzeAndParseDocument(
      "file:///test/handler.ts",
      code,
    );
    assert.strictEqual(analysis.errors.length, 0);
    assert.strictEqual(analysis.imports.length, 1);
    assert.strictEqual(
      analysis.imports[0].moduleSpecifier,
      "streak-forge/components",
    );
    assert.ok(analysis.imports[0].namedImports.includes("WidgetPlaceholder"));
    assert.ok(analysis.exports.some((e) => e.isDefault));
  });

  // ── Validation Rules Tests ─────────────────────────────────────────

  test("WidgetPlaceholder rule flags missing id and type attributes with streak:S101 and streak:S102", () => {
    const code = `
      import { WidgetPlaceholder } from "streak-forge/components";
      
      export default function Component() {
        return <WidgetPlaceholder />;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/Comp.tsx",
      code,
    );
    const diags = widgetPlaceholderRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 2);
    assert.ok(diags.some((d) => d.code === "streak:S101"));
    assert.ok(diags.some((d) => d.code === "streak:S102"));
  });

  test("streak:S202 flags non-async data handler functions", () => {
    const code = `
      const getData = () => {
        return { status: 200 };
      };
      export default getData;
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/HomeDataHandler.ts",
      code,
    );
    const diags = dataHandlerAsyncRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S202");
  });

  test("streak:S203 flags invalid numeric HTTP status codes", () => {
    const code = `
      const getData = async () => {
        return { status: 999 };
      };
      export default getData;
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/HomeDataHandler.ts",
      code,
    );
    const diags = dataHandlerStatusValueRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S203");
  });

  test("streak:S302 flags React runtime hooks in static widgets", () => {
    const code = `
      import { useState } from "react";
      export default function Component() {
        const [count, setCount] = useState(0);
        return <div>{count}</div>;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/Comp.tsx",
      code,
    );
    const diags = reactHooksNotAllowedRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S302");
  });

  test("streak:S303 flags unsafe props.data property access", () => {
    const code = `
      export default function Widget(props: { data?: { title: string } }) {
        return <h1>{props.data.title}</h1>;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/Widget.tsx",
      code,
    );
    const diags = unsafeWidgetDataAccessRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S303");
  });

  test("streak:S304 flags required data prop in widget props interface", () => {
    const code = `
      interface WidgetProps {
        data: { title: string };
      }
      export default function Widget(props: WidgetProps) {
        return <h1>{props.data?.title}</h1>;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/Widget.tsx",
      code,
    );
    const diags = invalidWidgetPropsContractRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S304");
  });

  test("streak:S401 flags Script closure variable capture", () => {
    const code = `
      import { Script } from "streak-forge/components";
      export default function Widget({ theme }: { theme: string }) {
        return (
          <Script>
            {(gDom) => {
              gDom.style.color = theme;
            }}
          </Script>
        );
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/ScriptComp.tsx",
      code,
    );
    const diags = scriptClosureCaptureRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S401");
  });

  test("streak:S404 flags async Script callbacks", () => {
    const code = `
      import { Script } from "streak-forge/components";
      export default function Widget() {
        return (
          <Script>
            {async (gDom) => {
              console.log(gDom);
            }}
          </Script>
        );
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/ScriptAsync.tsx",
      code,
    );
    const diags = asyncScriptCallbackRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S404");
  });

  test("streak:S501 flags Dynamic component with missing or empty id attribute", () => {
    const code = `
      import { Dynamic } from "streak-forge/components";
      export default function Comp() {
        return <Dynamic id="" />;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/DynamicComp.tsx",
      code,
    );
    const diags = dynamicComponentIdRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S501");
  });

  test("Rule runner executes all rules and generates LSP diagnostics", () => {
    const code = `
      import { WidgetPlaceholder } from "streak-forge/components";
      
      export function Incomplete() {
        return <WidgetPlaceholder id="" type="" />;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/Incomplete.tsx",
      code,
    );
    const lspDiagnostics = runRules(sourceFile, analysis);
    assert.ok(lspDiagnostics.length >= 3);
  });

  // ── Snippet file validation ────────────────────────────────────────

  const snippetDir = path.resolve(__dirname, "../../snippets");

  const snippetFiles = ["streak.snippets.ts.json", "streak.snippets.tsx.json"];

  for (const file of snippetFiles) {
    test(`Snippet file ${file} exists`, () => {
      const filePath = path.join(snippetDir, file);
      assert.ok(fs.existsSync(filePath), `Missing snippet file: ${filePath}`);
    });

    test(`Snippet file ${file} is valid JSON`, () => {
      const filePath = path.join(snippetDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      let parsed: unknown;
      assert.doesNotThrow(() => {
        parsed = JSON.parse(content);
      }, `${file} is not valid JSON`);
      assert.ok(
        typeof parsed === "object" && parsed !== null,
        `${file} must be a JSON object`,
      );
    });

    test(`Snippet file ${file} entries have required fields`, () => {
      const filePath = path.join(snippetDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content) as Record<
        string,
        { prefix?: unknown; body?: unknown; description?: unknown }
      >;

      for (const [name, entry] of Object.entries(parsed)) {
        assert.ok(
          typeof entry.prefix === "string" && entry.prefix.length > 0,
          `Snippet "${name}" in ${file} must have a non-empty string "prefix"`,
        );
        assert.ok(
          Array.isArray(entry.body) && entry.body.length > 0,
          `Snippet "${name}" in ${file} must have a non-empty array "body"`,
        );
        assert.ok(
          typeof entry.description === "string" && entry.description.length > 0,
          `Snippet "${name}" in ${file} must have a non-empty string "description"`,
        );
      }
    });

    test(`Snippet file ${file} has no duplicate prefixes`, () => {
      const filePath = path.join(snippetDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content) as Record<string, { prefix: string }>;

      const prefixes = Object.values(parsed).map((e) => e.prefix);
      const duplicates = prefixes.filter((p, i) => prefixes.indexOf(p) !== i);
      assert.strictEqual(
        duplicates.length,
        0,
        `Duplicate prefixes in ${file}: ${duplicates.join(", ")}`,
      );
    });
  }

  // ── Package.json contribution validation ───────────────────────────

  test("package.json has snippet contributions", () => {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      contributes?: { snippets: unknown[] };
    };
    assert.ok(
      Array.isArray(pkg.contributes?.snippets),
      "package.json must have contributes.snippets array",
    );
    assert.ok(
      pkg.contributes.snippets.length >= 2,
      "package.json must register at least 2 snippet files",
    );
  });

  test("package.json has configuration schema", () => {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      contributes?: { configuration?: { properties: Record<string, unknown> } };
    };
    assert.ok(
      pkg.contributes?.configuration?.properties,
      "package.json must have contributes.configuration.properties",
    );
    assert.ok(
      "streak.snippets.enable" in pkg.contributes.configuration.properties,
      "configuration must include streak.snippets.enable",
    );
    assert.ok(
      "streak.diagnostics.enable" in pkg.contributes.configuration.properties,
      "configuration must include streak.diagnostics.enable",
    );
  });

  // ── Code Completion Tests ──────────────────────────────────────────

  test("JSX Context detection parses tag and unclosed attribute values correctly", () => {
    const text = '<WidgetPlaceholder id="hero" type="';
    const ctx = getJsxContext(text, text.length);
    assert.ok(ctx);
    assert.strictEqual(ctx.tagName, "WidgetPlaceholder");
    assert.strictEqual(ctx.attributeName, "type");
    assert.strictEqual(ctx.inAttributeValue, true);
    assert.strictEqual(ctx.attributeValue, "");

    const text2 = '<Preload href="/styles/tailwind.css" as="sty';
    const ctx2 = getJsxContext(text2, text2.length);
    assert.ok(ctx2);
    assert.strictEqual(ctx2.tagName, "Preload");
    assert.strictEqual(ctx2.attributeName, "as");
    assert.strictEqual(ctx2.inAttributeValue, true);
    assert.strictEqual(ctx2.attributeValue, "sty");

    const text3 = "<WidgetPlaceholder ";
    const ctx3 = getJsxContext(text3, text3.length);
    assert.ok(ctx3);
    assert.strictEqual(ctx3.tagName, "WidgetPlaceholder");
    assert.strictEqual(ctx3.inAttributeValue, false);
  });

  test("isInsideLoadDynamicComponent detects loadDynamicComponent parameters", () => {
    assert.ok(isInsideLoadDynamicComponent('gDom.loadDynamicComponent("', 27));
    assert.ok(isInsideLoadDynamicComponent("loadDynamicComponent('", 22));
    assert.ok(!isInsideLoadDynamicComponent('gDom.otherMethod("', 18));
  });

  test("getAutoImportEdit generates correct edits for missing import and existing import", () => {
    const code1 = `
      export default function Test() {
        return <div>Hello</div>;
      }
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/comp1.tsx",
      code1,
    );
    const doc1 = TextDocument.create(
      "file:///test/comp1.tsx",
      "typescriptreact",
      1,
      code1,
    );
    const edits1 = getAutoImportEdit(doc1, sourceFile, "WidgetPlaceholder");
    assert.strictEqual(edits1.length, 1);
    assert.ok(
      edits1[0].newText.includes(
        'import { WidgetPlaceholder } from "streak-forge/components";',
      ),
    );

    const code2 = `
      import { Preload } from "streak-forge/components";
      export default function Test() {
        return <Preload href="/a" as="style" />;
      }
    `;
    const { sourceFile: sf2 } = analyzeAndParseDocument(
      "file:///test/comp2.tsx",
      code2,
    );
    const doc2 = TextDocument.create(
      "file:///test/comp2.tsx",
      "typescriptreact",
      1,
      code2,
    );
    const edits2 = getAutoImportEdit(doc2, sf2, "WidgetPlaceholder");
    assert.strictEqual(edits2.length, 1);
    assert.ok(edits2[0].newText.includes("Preload"));
    assert.ok(edits2[0].newText.includes("WidgetPlaceholder"));
    assert.ok(edits2[0].newText.includes("\n"));
  });

  test("getCompletions returns built-in components and script loadDynamicComponent IDs", () => {
    // 1. Tag start completions
    const code1 = `
      import React from "react";
      const a = <
    `;
    const offset1 = code1.indexOf("<") + 1;
    const { sourceFile: sf1 } = analyzeAndParseDocument(
      "file:///test/comp1.tsx",
      code1,
    );
    const doc1 = TextDocument.create(
      "file:///test/comp1.tsx",
      "typescriptreact",
      1,
      code1,
    );

    const items1 = getCompletions(
      {
        text: code1,
        uri: "file:///test/comp1.tsx",
        offset: offset1,
        line: 2,
        character: offset1 - code1.lastIndexOf("\n") - 1,
      },
      doc1,
      sf1,
      undefined,
    );
    assert.ok(items1.length >= 4);
    assert.ok(items1.some((i) => i.label === "WidgetPlaceholder"));
    assert.ok(items1.some((i) => i.label === "Script"));

    // 2. Dynamic ID suggestion inside script loadDynamicComponent
    const code2 = `
      import { Dynamic, Script } from "streak-forge/components";
      export default function Test() {
        return (
          <>
            <Dynamic id="sidebar-panel">
              <div>Sidebar</div>
            </Dynamic>
            <Script id="loader">
              {(gDom) => {
                gDom.loadDynamicComponent("
              }}
            </Script>
          </>
        );
      }
    `;
    const offset2 =
      code2.indexOf('loadDynamicComponent("') + 'loadDynamicComponent("'.length;
    const { sourceFile: sf2 } = analyzeAndParseDocument(
      "file:///test/comp2.tsx",
      code2,
    );
    const doc2 = TextDocument.create(
      "file:///test/comp2.tsx",
      "typescriptreact",
      1,
      code2,
    );

    const items2 = getCompletions(
      {
        text: code2,
        uri: "file:///test/comp2.tsx",
        offset: offset2,
        line: 10,
        character: offset2 - code2.lastIndexOf("\n") - 1,
      },
      doc2,
      sf2,
      undefined,
    );
    assert.strictEqual(items2.length, 1);
    assert.strictEqual(items2[0].label, "sidebar-panel");
  });

  test("streak:S405 flags missing or empty id attribute on <Script>", () => {
    const code = `
      import React from "react";
      export default function Test() {
        return (
          <>
            <Script />
            <Script id="" />
            <Script id="valid-script" />
          </>
        );
      }
    `;
    const { sourceFile, analysis } = analyzeAndParseDocument(
      "file:///test/scriptId.tsx",
      code,
    );
    const diagnostics = scriptRequiredIdRule.run(sourceFile, analysis);
    assert.strictEqual(diagnostics.length, 2);
    assert.strictEqual(diagnostics[0].code, "streak:S405");
    assert.strictEqual(diagnostics[1].code, "streak:S405");
    assert.ok(diagnostics[0].message.includes('requires a non-empty "id"'));
  });

  test("getAutoImportEdit formats multi-line merging", () => {
    const code =
      'import { WidgetPlaceholder } from "streak-forge/components";\n';
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/importMerge.tsx",
      code,
    );
    const doc = TextDocument.create(
      "file:///test/importMerge.tsx",
      "typescriptreact",
      1,
      code,
    );
    const edits = getAutoImportEdit(doc, sourceFile, "Script");
    assert.strictEqual(edits.length, 1);
    assert.ok(edits[0].newText.includes("WidgetPlaceholder"));
    assert.ok(edits[0].newText.includes("Script"));
    assert.ok(edits[0].newText.includes("\n")); // Multi-line!
  });

  test("Callback completions suggest gDom methods inside Script callback", () => {
    const code = `
      import { Script } from "streak-forge/components";
      export default function Test() {
        return (
          <Script id="test-script">
            {(gDom: any) => {
              gDom.
            }}
          </Script>
        );
      }
    `;
    const offset = code.indexOf("gDom.") + "gDom.".length;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/gdomComp.tsx",
      code,
    );
    const doc = TextDocument.create(
      "file:///test/gdomComp.tsx",
      "typescriptreact",
      1,
      code,
    );
    const items = getCompletions(
      {
        text: code,
        uri: "file:///test/gdomComp.tsx",
        offset,
        line: 6,
        character: offset - code.lastIndexOf("\n") - 1,
      },
      doc,
      sourceFile,
      undefined,
    );
    const labels = items.map((item) => item.label);
    assert.ok(labels.includes("loadDynamicComponent"));
    assert.ok(labels.includes("getElement"));
    assert.ok(labels.includes("updateOptions"));
  });

  test("Autocomplete suggests sfS snippet in JSX body", () => {
    const code = `
      import React from "react";
      export default function Test() {
        return (
          <div>
            sf
          </div>
        );
      }
    `;
    const offset = code.indexOf("sf") + "sf".length;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/sfComp.tsx",
      code,
    );
    const doc = TextDocument.create(
      "file:///test/sfComp.tsx",
      "typescriptreact",
      1,
      code,
    );
    const items = getCompletions(
      {
        text: code,
        uri: "file:///test/sfComp.tsx",
        offset,
        line: 5,
        character: offset - code.lastIndexOf("\n") - 1,
      },
      doc,
      sourceFile,
      undefined,
    );
    const labels = items.map((item) => item.label);
    assert.ok(labels.includes("sfS"));
  });

  test("sfWid and sfWidE snippet completions suggest scaffolding in widgets/ directory", () => {
    const code = "sf";
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/widgets/HelloPager.tsx",
      code,
    );
    const doc = TextDocument.create(
      "file:///test/widgets/HelloPager.tsx",
      "typescriptreact",
      1,
      code,
    );
    const items = getCompletions(
      {
        text: code,
        uri: "file:///test/widgets/HelloPager.tsx",
        offset: 2,
        line: 0,
        character: 2,
      },
      doc,
      sourceFile,
      undefined,
    );

    const sfWidItem = items.find((item) => item.label === "sfWid");
    const sfWidEItem = items.find((item) => item.label === "sfWidE");

    assert.ok(sfWidItem, "sfWid snippet should be suggested");
    assert.ok(sfWidEItem, "sfWidE snippet should be suggested");

    assert.ok(
      sfWidItem.insertText?.includes("const HelloPager = () => {};"),
      "sfWid should expand to HelloPager definition",
    );
    assert.ok(
      sfWidEItem.insertText?.includes("type HelloPagerProps = {"),
      "sfWidE should define HelloPagerProps",
    );
    assert.ok(
      sfWidEItem.insertText?.includes(
        "const HelloPager = (props: HelloPagerProps) => {",
      ),
      "sfWidE should define HelloPager with props",
    );
  });

  test("resolveHover displays markdown documentation for built-in components", () => {
    const code = `
      import { WidgetPlaceholder, Preload, Dynamic, Script } from "streak-forge/components";
      export default function Test() {
        return (
          <>
            <WidgetPlaceholder id="widget" type="Hello" />
            <Preload href="/a.css" as="style" />
            <Dynamic id="panel" />
            <Script id="scr">
              {(gDom) => {
                gDom.loadDynamicComponent("my-panel");
              }}
            </Script>
          </>
        );
      }
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/hoverComp.tsx",
      code,
    );

    // 1. Test WidgetPlaceholder
    const wpNode = sourceFile.getDescendantAtPos(
      code.indexOf("<WidgetPlaceholder") + 1,
    );
    assert.ok(wpNode);
    const wpResult = resolveHover(wpNode) as Hover;
    assert.ok(wpResult);
    assert.ok(
      (wpResult.contents as MarkupContent).value.includes(
        "Streak `<WidgetPlaceholder>` Component",
      ),
    );

    // 2. Test Preload
    const preNode = sourceFile.getDescendantAtPos(
      code.indexOf("<Preload") + 1,
    );
    assert.ok(preNode);
    const preResult = resolveHover(preNode) as Hover;
    assert.ok(preResult);
    assert.ok(
      (preResult.contents as MarkupContent).value.includes("Streak `<Preload>` Component"),
    );

    // 3. Test Dynamic
    const dyNode = sourceFile.getDescendantAtPos(code.indexOf("<Dynamic") + 1);
    assert.ok(dyNode);
    const dyResult = resolveHover(dyNode) as Hover;
    assert.ok(dyResult);
    assert.ok((dyResult.contents as MarkupContent).value.includes("Streak `<Dynamic>` Component"));

    // 4. Test Script
    const scNode = sourceFile.getDescendantAtPos(code.indexOf("<Script") + 1);
    assert.ok(scNode);
    const scResult = resolveHover(scNode) as Hover;
    assert.ok(scResult);
    assert.ok((scResult.contents as MarkupContent).value.includes("Streak `<Script>` Component"));
  });

  test("resolveHover displays documentation for tag attributes and gDom methods", () => {
    const code = `
      import { WidgetPlaceholder, Preload } from "streak-forge/components";
      export default function Test() {
        return (
          <>
            <WidgetPlaceholder id="widget-id" type="Banner" />
            <Preload href="/style.css" as="style" />
            <Script id="s1" options={{ color: "red" }}>
              {(gDom) => {
                gDom.loadDynamicComponent("my-panel");
              }}
            </Script>
          </>
        );
      }
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/hoverAttr.tsx",
      code,
    );

    // 1. Test WidgetPlaceholder type attribute
    const typeOffset = code.indexOf('type="Banner"') + 1;
    const typeNode = sourceFile.getDescendantAtPos(typeOffset);
    assert.ok(typeNode);
    const typeResult = resolveHover(typeNode) as Hover;
    assert.ok(typeResult);
    assert.ok(
      (typeResult.contents as MarkupContent).value.includes("The widget name matching a file"),
    );

    // 2. Test Preload href attribute
    const hrefOffset = code.indexOf('href="/style.css"') + 1;
    const hrefNode = sourceFile.getDescendantAtPos(hrefOffset);
    assert.ok(hrefNode);
    const hrefResult = resolveHover(hrefNode) as Hover;
    assert.ok(hrefResult);
    assert.ok(
      (hrefResult.contents as MarkupContent).value.includes("The path to the static asset"),
    );

    // 3. Test Preload as attribute
    const asOffset = code.indexOf('as="style"') + 1;
    const asNode = sourceFile.getDescendantAtPos(asOffset);
    assert.ok(asNode);
    const asResult = resolveHover(asNode) as Hover;
    assert.ok(asResult);
    assert.ok((asResult.contents as MarkupContent).value.includes("The resource classification"));

    // 4. Test gDom.loadDynamicComponent method
    const gdomOffset = code.indexOf("loadDynamicComponent");
    const gdomNode = sourceFile.getDescendantAtPos(gdomOffset);
    assert.ok(gdomNode);
    const gdomResult = resolveHover(gdomNode) as Hover;
    assert.ok(gdomResult);
    assert.ok((gdomResult.contents as MarkupContent).value.includes("loadDynamicComponent"));
  });

  test("resolveDefinition resolves WidgetPlaceholder, Preload, and Dynamic definitions", async () => {
    const tempRoot = path.join(__dirname, "test-workspace-temp");
    if (!fs.existsSync(tempRoot)) {
      fs.mkdirSync(tempRoot, { recursive: true });
    }

    const widgetsDir = path.join(tempRoot, "src", "widgets");
    fs.mkdirSync(widgetsDir, { recursive: true });
    const widgetFilePath = path.join(widgetsDir, "HomeBanner.tsx");
    fs.writeFileSync(
      widgetFilePath,
      `
      import { Dynamic } from "streak-forge/components";
      export default function HomeBanner() {
        return <Dynamic id="HomeLander" />;
      }
    `,
      "utf-8",
    );

    const publicDir = path.join(tempRoot, "public", "styles");
    fs.mkdirSync(publicDir, { recursive: true });
    const preloadFilePath = path.join(publicDir, "main.css");
    fs.writeFileSync(preloadFilePath, "body { color: red; }", "utf-8");

    const code = `
      import { WidgetPlaceholder, Preload, Script } from "streak-forge/components";
      export default function Test() {
        return (
          <>
            <WidgetPlaceholder id="w1" type="HomeBanner" />
            <Preload href="/styles/main.css" as="style" />
            <Script id="scr">
              {(gDom) => {
                gDom.loadDynamicComponent("HomeLander");
              }}
            </Script>
          </>
        );
      }
    `;

    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/defTest.tsx",
      code,
    );

    // 1. Test WidgetPlaceholder type
    const typeOffset = code.indexOf("HomeBanner");
    const typeNode = sourceFile.getDescendantAtPos(typeOffset);
    assert.ok(typeNode);
    const typeLoc = await resolveDefinition(typeNode, tempRoot);
    assert.ok(typeLoc);
    assert.ok(typeLoc.uri.includes("HomeBanner.tsx"));

    // 2. Test Preload href
    const hrefOffset = code.indexOf("/styles/main.css");
    const hrefNode = sourceFile.getDescendantAtPos(hrefOffset);
    assert.ok(hrefNode);
    const hrefLoc = await resolveDefinition(hrefNode, tempRoot);
    assert.ok(hrefLoc);
    assert.ok(hrefLoc.uri.includes("main.css"));

    // 3. Test loadDynamicComponent parameter
    const idOffset = code.indexOf("HomeLander");
    const idNode = sourceFile.getDescendantAtPos(idOffset);
    assert.ok(idNode);
    const idLoc = await resolveDefinition(idNode, tempRoot);
    assert.ok(idLoc);
    assert.ok(idLoc.uri.includes("HomeBanner.tsx"));
    assert.strictEqual(idLoc.range.start.line, 3); // <Dynamic id="HomeLander" /> is on line 3 (0-indexed)

    // Clean up
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test("resolveCodeActions suggestions for missing JSX attributes (S405, S101, S102, S501)", () => {
    const code = `
      import { Script, WidgetPlaceholder, Dynamic } from "streak-forge/components";
      export default function Test() {
        return (
          <>
            <Script>
              {() => {}}
            </Script>
            <WidgetPlaceholder />
            <Dynamic />
          </>
        );
      }
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/codeActionJsx.tsx",
      code,
    );
    const doc = TextDocument.create(
      "file:///test/codeActionJsx.tsx",
      "typescriptreact",
      1,
      code,
    );

    // 1. Script missing id (S405)
    const scriptIndex = code.indexOf("<Script>");
    const scriptPos = doc.positionAt(scriptIndex);
    const diagS405 = {
      code: "streak:S405",
      message: "Missing ID",
      range: { start: scriptPos, end: scriptPos },
    } as unknown as Diagnostic;

    const actionsS405 = resolveCodeActions([diagS405], doc, sourceFile);
    assert.strictEqual(actionsS405.length, 1);
    assert.strictEqual(actionsS405[0].title, "Add id attribute to <Script>");
    assert.strictEqual(
      actionsS405[0].edit?.changes?.["file:///test/codeActionJsx.tsx"]?.[0]
        ?.newText,
      ' id="my-script"',
    );

    // 2. WidgetPlaceholder missing id (S101)
    const wpIndex = code.indexOf("<WidgetPlaceholder />");
    const wpPos = doc.positionAt(wpIndex);
    const diagS101 = {
      code: "streak:S101",
      message: "Missing ID",
      range: { start: wpPos, end: wpPos },
    } as unknown as Diagnostic;

    const actionsS101 = resolveCodeActions([diagS101], doc, sourceFile);
    assert.strictEqual(actionsS101.length, 1);
    assert.strictEqual(
      actionsS101[0].title,
      "Add id attribute to <WidgetPlaceholder>",
    );

    // 3. WidgetPlaceholder missing type (S102)
    const diagS102 = {
      code: "streak:S102",
      message: "Missing Type",
      range: { start: wpPos, end: wpPos },
    } as unknown as Diagnostic;

    const actionsS102 = resolveCodeActions([diagS102], doc, sourceFile);
    assert.strictEqual(actionsS102.length, 1);
    assert.strictEqual(
      actionsS102[0].title,
      "Add type attribute to <WidgetPlaceholder>",
    );

    // 4. Dynamic missing id (S501)
    const dyIndex = code.indexOf("<Dynamic />");
    const dyPos = doc.positionAt(dyIndex);
    const diagS501 = {
      code: "streak:S501",
      message: "Missing ID",
      range: { start: dyPos, end: dyPos },
    } as unknown as Diagnostic;

    const actionsS501 = resolveCodeActions([diagS501], doc, sourceFile);
    assert.strictEqual(actionsS501.length, 1);
    assert.strictEqual(actionsS501[0].title, "Add id attribute to <Dynamic>");
  });

  test("resolveCodeActions suggestions for non-async data handler (S202)", () => {
    const code = `
      export function myHandler() {}
      export const myArrow = () => {};
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/codeActionAsync.ts",
      code,
    );
    const doc = TextDocument.create(
      "file:///test/codeActionAsync.ts",
      "typescript",
      1,
      code,
    );

    // 1. Function declaration
    const fnPos = doc.positionAt(code.indexOf("function myHandler"));
    const diagS202_1 = {
      code: "streak:S202",
      message: "Must be async",
      range: { start: fnPos, end: fnPos },
    } as unknown as Diagnostic;

    const actionsS202_1 = resolveCodeActions([diagS202_1], doc, sourceFile);
    assert.strictEqual(actionsS202_1.length, 1);
    assert.strictEqual(actionsS202_1[0].title, "Make handler async");
    assert.strictEqual(
      actionsS202_1[0].edit?.changes?.["file:///test/codeActionAsync.ts"]?.[0]
        ?.newText,
      "async ",
    );

    // 2. Arrow function
    const arrowPos = doc.positionAt(code.indexOf("() => {}"));
    const diagS202_2 = {
      code: "streak:S202",
      message: "Must be async",
      range: { start: arrowPos, end: arrowPos },
    } as unknown as Diagnostic;

    const actionsS202_2 = resolveCodeActions([diagS202_2], doc, sourceFile);
    assert.strictEqual(actionsS202_2.length, 1);
    assert.strictEqual(actionsS202_2[0].title, "Make handler async");
  });

  test("resolveCodeActions suggestions for missing default export (S301)", () => {
    const code = `
      export const myComponent = () => {};
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/AboutData.tsx",
      code,
    );
    const doc = TextDocument.create(
      "file:///test/AboutData.tsx",
      "typescriptreact",
      1,
      code,
    );

    const startPos = doc.positionAt(0);
    const diagS301 = {
      code: "streak:S301",
      message: "Missing default export",
      range: { start: startPos, end: startPos },
    } as unknown as Diagnostic;

    const actionsS301 = resolveCodeActions([diagS301], doc, sourceFile);
    assert.strictEqual(actionsS301.length, 1);
    assert.strictEqual(
      actionsS301[0].title,
      "Add default export for AboutData",
    );
    assert.ok(
      actionsS301[0].edit?.changes?.[
        "file:///test/AboutData.tsx"
      ]?.[0]?.newText.includes("export default AboutData;"),
    );
  });

  test("WidgetRegistry and Scanner dynamically extracts widget description and props, providing rich completions and hovers", async () => {
    const tempRoot = path.join(__dirname, "..", "..", "test-registry-temp");
    if (!fs.existsSync(tempRoot)) {
      fs.mkdirSync(tempRoot, { recursive: true });
    }

    const widgetsDir = path.join(tempRoot, "src", "widgets");
    fs.mkdirSync(widgetsDir, { recursive: true });

    // Write a mock widget ProductCard with JSDoc comments and typed props
    const widgetFilePath = path.join(widgetsDir, "ProductCard.tsx");
    fs.writeFileSync(
      widgetFilePath,
      `
      export type ProductCardProps = {
        /**
         * The display label name of the product item.
         */
        title: string;
        /**
         * Optional price label tag format.
         */
        price?: number;
      };

      /**
       * Renders a customizable product item card display.
       */
      export default function ProductCard(props: ProductCardProps) {
        return <div>{props.title}</div>;
      }
    `,
      "utf-8",
    );

    // Index the temporary workspace
    await scanWorkspace(tempRoot);

    // 1. Assert registry has extracted metadata correctly
    const meta = widgetRegistry.get("ProductCard");
    assert.ok(meta);
    assert.strictEqual(meta.name, "ProductCard");
    assert.strictEqual(
      meta.docComment,
      "Renders a customizable product item card display.",
    );
    assert.strictEqual(meta.props.length, 2);

    const titleProp = meta.props.find((p) => p.name === "title");
    assert.ok(titleProp);
    assert.strictEqual(titleProp.type, "string");
    assert.strictEqual(titleProp.isOptional, false);
    assert.strictEqual(
      titleProp.docComment,
      "The display label name of the product item.",
    );

    const priceProp = meta.props.find((p) => p.name === "price");
    assert.ok(priceProp);
    assert.strictEqual(priceProp.type, "number");
    assert.strictEqual(priceProp.isOptional, true);
    assert.strictEqual(
      priceProp.docComment,
      "Optional price label tag format.",
    );

    // 2. Assert autocomplete includes rich documentation for ProductCard
    const autocompleteCode = `
      import { WidgetPlaceholder } from "streak-forge/components";
      const val = <WidgetPlaceholder id="wp1" type="ProductCard" />
    `;
    // Simulate completions inside type="ProductCard" value
    const offset = autocompleteCode.indexOf('type="') + 6;
    const comps = getCompletions(
      {
        text: autocompleteCode,
        uri: "file:///test/main.tsx",
        offset,
        line: 2,
        character: offset,
      },
      TextDocument.create(
        "file:///test/main.tsx",
        "typescriptreact",
        1,
        autocompleteCode,
      ),
      analyzeAndParseDocument("file:///test/main.tsx", autocompleteCode)
        .sourceFile,
      tempRoot,
    );

    const compItem = comps.find((c) => c.label === "ProductCard");
    assert.ok(compItem);
    assert.strictEqual(compItem.detail, "Custom Project Widget");
    assert.ok(compItem.documentation);
    const docValue = (compItem.documentation as MarkupContent).value;
    assert.ok(
      docValue.includes("Renders a customizable product item card display."),
    );
    assert.ok(docValue.includes("title: string"));
    assert.ok(docValue.includes("price?: number"));

    // 3. Assert Hover over type value resolves custom properties documentation
    const hoverOffset = autocompleteCode.indexOf("ProductCard");
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/main.tsx",
      autocompleteCode,
    );
    const hoverNode = sourceFile.getDescendantAtPos(hoverOffset);
    assert.ok(hoverNode);
    const hoverResult = resolveHover(hoverNode);
    assert.ok(hoverResult);
    const hoverVal = (hoverResult.contents as MarkupContent).value;
    assert.ok(
      hoverVal.includes("Renders a customizable product item card display."),
    );
    assert.ok(hoverVal.includes("title: string"));
    assert.ok(hoverVal.includes("price?: number"));

    // Clean up
    fs.rmSync(tempRoot, { recursive: true, force: true });
    widgetRegistry.clear();
  });

  test("streak:S601 flags duplicated widget component names in registry", () => {
    widgetRegistry.clear();
    widgetRegistry.set("HeaderWidget", {
      name: "HeaderWidget",
      filePath: "c:/project/src/widgets/other/HeaderWidget.tsx",
      props: [],
    });

    const code = `
      export default function HeaderWidget() { return <div />; }
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "c:/project/src/widgets/HeaderWidget.tsx",
      code,
    );
    const diags = duplicatedWidgetRule.run(sourceFile, {
      uri: "c:/project/src/widgets/HeaderWidget.tsx",
      exports: [],
      components: [],
      imports: [],
      jsxElements: [],
      errors: [],
    });
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S601");
    assert.ok(
      diags[0].message.includes(
        "Duplicated widget component name 'HeaderWidget'",
      ),
    );

    widgetRegistry.clear();
  });

  test("streak:S602 flags invalid nested components", () => {
    const code = `
      import { Script, WidgetPlaceholder } from "streak-forge/components";
      export default function Test() {
        return (
          <Script id="s1">
            {(gDom) => {
              return (
                <>
                  <Script id="s2">
                    {() => {}}
                  </Script>
                  <WidgetPlaceholder id="wp1" type="Hello" />
                </>
              );
            }}
          </Script>
        );
      }
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/nested.tsx",
      code,
    );
    const diags = componentNestingRule.run(sourceFile, {
      uri: "file:///test/nested.tsx",
      exports: [],
      components: [],
      imports: [],
      jsxElements: [],
      errors: [],
    });
    assert.strictEqual(diags.length, 2);
    assert.strictEqual(diags[0].code, "streak:S602");
    assert.ok(diags[0].message.includes("Nesting `<Script>` tags"));
    assert.strictEqual(diags[1].code, "streak:S602");
    assert.ok(diags[1].message.includes("Nesting `<WidgetPlaceholder>`"));
  });

  test("streak:S603 flags invalid Script child structure", () => {
    const code = `
      import { Script } from "streak-forge/components";
      export default function Test() {
        return (
          <>
            {/* 1. Empty Script */}
            <Script id="s1"></Script>
            
            {/* 2. Text child */}
            <Script id="s2">some raw text</Script>

            {/* 3. Non-function child */}
            <Script id="s3">
              {123}
            </Script>

            {/* 4. Valid Script */}
            <Script id="s4">
              {() => {}}
            </Script>
          </>
        );
      }
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/struct.tsx",
      code,
    );
    const diags = scriptStructureRule.run(sourceFile, {
      uri: "file:///test/struct.tsx",
      exports: [],
      components: [],
      imports: [],
      jsxElements: [],
      errors: [],
    });
    assert.strictEqual(diags.length, 3);
    assert.strictEqual(diags[0].code, "streak:S603");
    assert.ok(
      diags[0].message.includes("requires an inline execution callback"),
    );
    assert.strictEqual(diags[1].code, "streak:S603");
    assert.ok(diags[1].message.includes("must be wrapped in a JSX expression"));
    assert.strictEqual(diags[2].code, "streak:S603");
    assert.ok(
      diags[2].message.includes("must be a client-side function expression"),
    );
  });

  test("streak:S701 flags imports not present in allowedImports whitelist", () => {
    const code = `
      import { Script } from "streak-forge/components";
      import { useState } from "react";
      import { someFunc } from "lodash";
      import { localHelper } from "./helper";
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/imports.tsx",
      code,
    );

    // Test with default whitelist (allows "streak-forge/components", "react")
    const diagsDefault = allowedImportsRule.run(
      sourceFile,
      {
        uri: "file:///test/imports.tsx",
        exports: [],
        components: [],
        imports: [],
        jsxElements: [],
        errors: [],
      },
      {
        enabled: true,
        ruleOptions: { allowedImports: ["streak-forge/components", "react"] },
      },
    );
    assert.strictEqual(diagsDefault.length, 1);
    assert.strictEqual(diagsDefault[0].code, "streak:S701");
    assert.ok(diagsDefault[0].message.includes("lodash"));

    // Test with lodash allowed
    const diagsCustom = allowedImportsRule.run(
      sourceFile,
      {
        uri: "file:///test/imports.tsx",
        exports: [],
        components: [],
        imports: [],
        jsxElements: [],
        errors: [],
      },
      {
        enabled: true,
        ruleOptions: {
          allowedImports: ["streak-forge/components", "react", "lodash"],
        },
      },
    );
    assert.strictEqual(diagsCustom.length, 0);
  });

  test("streak:S702 flags banned patterns matched by regular expressions", () => {
    const code = `
      const x = eval("1 + 1");
      const y = setTimeout(() => {}, 100);
      console.log("hello");
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/patterns.ts",
      code,
    );

    // Test with eval and setTimeout banned
    const diags = forbiddenPatternsRule.run(
      sourceFile,
      {
        uri: "file:///test/patterns.ts",
        exports: [],
        components: [],
        imports: [],
        jsxElements: [],
        errors: [],
      },
      {
        enabled: true,
        ruleOptions: { forbiddenPatterns: ["eval\\(", "setTimeout\\("] },
      },
    );
    assert.strictEqual(diags.length, 2);
    assert.strictEqual(diags[0].code, "streak:S702");
    assert.ok(diags[0].message.includes("eval\\("));
    assert.strictEqual(diags[1].code, "streak:S702");
    assert.ok(diags[1].message.includes("setTimeout\\("));
  });

  test("streak.createWidget command is registered and scaffolds a widget file", async () => {
    process.env.STREAK_TEST_ENVIRONMENT = "1";
    const originalShowInputBox = vscode.window.showInputBox;
    // eslint-disable-next-line @typescript-eslint/require-await
    (vscode.window as unknown as { showInputBox: () => Promise<string> }).showInputBox = async () => "MyScaffoldedWidget";

    const tempDir = path.join(__dirname, "..", "..", "test-scaffold-temp");
    fs.mkdirSync(tempDir, { recursive: true });

    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      get: () => [
        {
          uri: vscode.Uri.file(tempDir),
          name: "test-workspace",
          index: 0,
        },
      ],
      configurable: true,
    });

    const targetDir = path.join(tempDir, "src", "widgets");
    const testFile = path.join(targetDir, "MyScaffoldedWidget.tsx");
    if (fs.existsSync(testFile)) {
      fs.rmSync(testFile);
    }

    try {
      await vscode.commands.executeCommand("streak.createWidget");

      assert.ok(fs.existsSync(testFile));
      const content = fs.readFileSync(testFile, "utf-8");
      assert.ok(
        content.includes(
          "const MyScaffoldedWidget = (props: MyScaffoldedWidgetProps) => {",
        ),
      );
    } finally {
      delete process.env.STREAK_TEST_ENVIRONMENT;
      if (fs.existsSync(testFile)) {
        fs.rmSync(testFile);
      }
      vscode.window.showInputBox = originalShowInputBox;
      Object.defineProperty(vscode.workspace, "workspaceFolders", {
        get: () => originalWorkspaceFolders,
        configurable: true,
      });
    }
  });

  // ── Phase 13 Widget Intelligence Tests ───────────────────────────────────

  test("Widget detection identifies files under src/widgets/*.tsx", () => {
    const code = `export default function MyWidget() { return <div />; }`;

    const widgetRes = analyzeAndParseDocument("file:///workspace/src/widgets/MyWidget.tsx", code);
    assert.strictEqual(widgetRes.analysis.isWidget, true);

    const nonWidgetRes = analyzeAndParseDocument("file:///workspace/src/components/MyWidget.tsx", code);
    assert.strictEqual(nonWidgetRes.analysis.isWidget, false);

    const nonWidgetTsRes = analyzeAndParseDocument("file:///workspace/src/widgets/MyWidget.ts", code);
    assert.strictEqual(nonWidgetTsRes.analysis.isWidget, false);
  });

  test("streak:S801 rule validates widget filename matches component name", () => {
    // Valid: filename matches component name
    const codeValid = `
      const MyBanner = () => { return <div />; };
      export default MyBanner;
    `;
    const resValid = analyzeAndParseDocument("file:///workspace/src/widgets/MyBanner.tsx", codeValid);
    const diagsValid = widgetFilenameMatchesComponentRule.run(resValid.sourceFile, resValid.analysis);
    assert.strictEqual(diagsValid.length, 0);

    // Invalid: filename does not match component name
    const codeInvalid = `
      const HeroBanner = () => { return <div />; };
      export default HeroBanner;
    `;
    const resInvalid = analyzeAndParseDocument("file:///workspace/src/widgets/MyBanner.tsx", codeInvalid);
    const diagsInvalid = widgetFilenameMatchesComponentRule.run(resInvalid.sourceFile, resInvalid.analysis);
    assert.strictEqual(diagsInvalid.length, 1);
    assert.strictEqual(diagsInvalid[0].code, "streak:S801");
    assert.strictEqual(diagsInvalid[0].message, "Widget filename and component name must match.");
  });

  test("streak:S301 rule uses custom error for widgets lacking default export", () => {
    const code = `export const hello = "world";`;
    const res = analyzeAndParseDocument("file:///workspace/src/widgets/MyBanner.tsx", code);
    const diags = missingDefaultExportRule.run(res.sourceFile, res.analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S301");
    assert.strictEqual(diags[0].severity, 1); // DiagnosticSeverity.Error
    assert.strictEqual(diags[0].message, "Widgets must use a default export.");
  });

  test("streak:S302 rule uses custom error for stateful widgets using hooks", () => {
    const code = `
      import { useState } from "react";
      const MyBanner = () => {
        const [state, setState] = useState(0);
        return <div>{state}</div>;
      };
      export default MyBanner;
    `;
    const res = analyzeAndParseDocument("file:///workspace/src/widgets/MyBanner.tsx", code);
    const diags = reactHooksNotAllowedRule.run(res.sourceFile, res.analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S302");
    assert.strictEqual(diags[0].severity, 1); // DiagnosticSeverity.Error
    assert.strictEqual(diags[0].message, "Widgets must remain stateless. Use Script components for client-side behavior.");
  });

  test("streak:S303 rule uses custom warning for direct props.data access in widgets", () => {
    const code = `
      const MyBanner = (props: any) => {
        return <div>{props.data.title}</div>;
      };
      export default MyBanner;
    `;
    const res = analyzeAndParseDocument("file:///workspace/src/widgets/MyBanner.tsx", code);
    const diags = unsafeWidgetDataAccessRule.run(res.sourceFile, res.analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S303");
    assert.strictEqual(diags[0].severity, 2); // DiagnosticSeverity.Warning
    assert.strictEqual(diags[0].message, "Use optional chaining when accessing widget data.");
  });

  test("resolveHover displays custom markdown documentation for props.data", () => {
    const code = `
      const MyBanner = (props: any) => {
        const x = props.data;
        return <div>{x}</div>;
      };
      export default MyBanner;
    `;
    const { sourceFile } = analyzeAndParseDocument("file:///workspace/src/widgets/MyBanner.tsx", code);

    // Hover over "data" in "props.data"
    const dataOffset = code.indexOf("props.data") + "props.".length;
    const dataNode = sourceFile.getDescendantAtPos(dataOffset);
    assert.ok(dataNode);
    const dataHover = resolveHover(dataNode) as Hover;
    assert.ok(dataHover);
    assert.ok((dataHover.contents as MarkupContent).value.includes("Widget handler data."));
    assert.ok((dataHover.contents as MarkupContent).value.includes("data: undefined"));

    // Hover over "props" in "props.data"
    const propsOffset = code.indexOf("props.data") + 1;
    const propsNode = sourceFile.getDescendantAtPos(propsOffset);
    assert.ok(propsNode);
    const propsHover = resolveHover(propsNode) as Hover;
    assert.ok(propsHover);
    assert.ok((propsHover.contents as MarkupContent).value.includes("Widget handler data."));
  });

  // ── Phase 14 Sitemap Awareness Tests ────────────────────────────────────

  test("Sitemap parser correctly parses JSON structure and preserves offsets", () => {
    const json = `{
      "pages": [
        {
          "url": "/about",
          "handler": "about-handler",
          "widgets": [
            {
              "type": "HelloBanner"
            }
          ]
        }
      ]
    }`;

    sitemapRegistry.parseAndRegister("file:///test/streak.sitemap.json", json);
    const pages = sitemapRegistry.getPages();
    assert.strictEqual(pages.length, 1);
    assert.strictEqual(pages[0].url, "/about");
    assert.strictEqual(pages[0].handler, "about-handler");
    assert.strictEqual(pages[0].widgets.length, 1);
    assert.strictEqual(pages[0].widgets[0].type, "HelloBanner");
    assert.ok(pages[0].widgets[0].start > 0);
  });

  test("validateSitemap flags duplicate routes, missing widgets and missing handlers", () => {
    const json = `{
      "pages": [
        {
          "url": "/about",
          "handler": "about-handler",
          "widgets": [
            {
              "type": "MissingWidget"
            }
          ]
        },
        {
          "url": "/about",
          "handler": "other-handler",
          "widgets": []
        }
      ]
    }`;

    // Register a valid widget
    widgetRegistry.set("HelloBanner", {
      name: "HelloBanner",
      filePath: "file:///test/HelloBanner.tsx",
      props: [],
    });

    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);
    const diags = validateSitemap(doc, "/workspace");

    // S901 (duplicate route "/about"), S902 (missing widget "MissingWidget"), S903 (missing handler "about-handler" and "other-handler")
    assert.ok(diags.length >= 4);
    assert.ok(diags.some((d) => d.code === "streak:S901"));
    assert.ok(diags.some((d) => d.code === "streak:S902"));
    assert.ok(diags.some((d) => d.code === "streak:S903"));
  });

  test("resolveSitemapDefinition navigates to widget and handler files", () => {
    const json = `{
      "pages": [
        {
          "url": "/about",
          "handler": "about-handler",
          "widgets": [
            {
              "type": "HelloBanner"
            }
          ]
        }
      ]
    }`;
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);

    const tempRoot = path.join(__dirname, `temp_sitemap_test_${Date.now()}`).replaceAll("\\", "/");
    const widgetsDir = path.join(tempRoot, "src", "widgets");
    const handlersDir = path.join(tempRoot, "src", "handlers");

    fs.mkdirSync(widgetsDir, { recursive: true });
    fs.mkdirSync(handlersDir, { recursive: true });

    fs.writeFileSync(path.join(widgetsDir, "HelloBanner.tsx"), "export default function HelloBanner() {}");
    fs.writeFileSync(path.join(handlersDir, "about-handler.ts"), "export default function aboutHandler() {}");

    try {
      const sitemapPath = path.join(tempRoot, "streak.sitemap.json");
      sitemapRegistry.parseAndRegister(sitemapPath, json);

      // Find offset of "HelloBanner"
      const typeOffset = json.indexOf("HelloBanner") + 2;
      const defLoc = resolveSitemapDefinition(doc, typeOffset, tempRoot);
      assert.ok(defLoc);
      assert.ok(defLoc.uri.includes("HelloBanner.tsx"));

      // Find offset of "about-handler"
      const handlerOffset = json.indexOf("about-handler") + 2;
      const handlerLoc = resolveSitemapDefinition(doc, handlerOffset, tempRoot);
      assert.ok(handlerLoc);
      assert.ok(handlerLoc.uri.includes("about-handler.ts"));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("resolveSitemapHover displays sitemap summary and widget details", () => {
    const json = `{
      "pages": [
        {
          "url": "/about",
          "handler": "about-handler",
          "widgets": [
            {
              "type": "HelloBanner"
            }
          ]
        }
      ]
    }`;
    sitemapRegistry.parseAndRegister("file:///test/streak.sitemap.json", json);
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);

    // Hover on page object boundaries
    const hoverSummary = resolveSitemapHover(doc, json.indexOf("url") - 1, "/workspace") as Hover;
    assert.ok(hoverSummary);
    assert.ok((hoverSummary.contents as MarkupContent).value.includes("Route:"));
    assert.ok((hoverSummary.contents as MarkupContent).value.includes("/about"));

    // Hover on widget type
    const hoverWidget = resolveSitemapHover(doc, json.indexOf("HelloBanner") + 2, "/workspace") as Hover;
    assert.ok(hoverWidget);
    assert.ok((hoverWidget.contents as MarkupContent).value.includes("Widget: HelloBanner"));
  });

  test("Sitemap autocomplete suggests widget names and streak-page snippet", () => {
    const json = `"type": "`;
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);
    const { sourceFile } = analyzeAndParseDocument("file:///test/dummy_completions.ts", "export default {}");

    const items = getCompletions(
      {
        text: json,
        uri: "file:///test/streak.sitemap.json",
        offset: json.length,
        line: 0,
        character: json.length,
      },
      doc,
      sourceFile,
      "/workspace",
    );
    assert.ok(items.length >= 1);
    assert.ok(items.some((i) => i.label === "HelloBanner"));

    // Check streak-page snippet
    const jsonSnippet = "streak";
    const docSnippet = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, jsonSnippet);
    const itemsSnippet = getCompletions(
      {
        text: jsonSnippet,
        uri: "file:///test/streak.sitemap.json",
        offset: jsonSnippet.length,
        line: 0,
        character: jsonSnippet.length,
      },
      docSnippet,
      sourceFile,
      "/workspace",
    );
    assert.ok(itemsSnippet.some((i) => i.label === "streak-page"));
  });

  test("streak:S904 flags dead widgets not referenced by sitemap", () => {
    const code = `
      const UnusedWidget = () => { return <div />; };
      export default UnusedWidget;
    `;
    const { sourceFile, analysis } = analyzeAndParseDocument("file:///workspace/src/widgets/UnusedWidget.tsx", code);
    
    // Set sitemap pages to HelloBanner only, so UnusedWidget is dead
    sitemapRegistry.setPages("file:///test/streak.sitemap.json", [
      {
        url: "/home",
        widgets: [{ type: "HelloBanner", start: 0, end: 10 }],
        start: 0,
        end: 100,
      }
    ]);

    const diags = deadWidgetRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S904");
    assert.strictEqual(diags[0].message, "Widget is not referenced by any sitemap page.");
  });
});


