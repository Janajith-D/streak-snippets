import {
  type Hover,
  type MarkupContent,
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver/node";
import * as assert from "assert";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { analyzeAndParseDocument } from "../server/parser/analyzer";
import { runRules } from "../server/rules/runner";
import { widgetPlaceholderRule } from "../server/rules/widgetPlaceholderRule";
import { dataHandlerAsyncRule } from "../server/rules/dataHandlerAsyncRule";
import { dataHandlerStatusRule } from "../server/rules/dataHandlerStatusRule";
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
import { forbiddenPatternsRule } from "../server/rules/forbiddenPatternsRule";
import { widgetFilenameMatchesComponentRule } from "../server/rules/widgetFilenameMatchesComponentRule";
import { missingDefaultExportRule } from "../server/rules/missingDefaultExportRule";
import { deadWidgetRule } from "../server/rules/deadWidgetRule";
import { passiveEventListenerRule } from "../server/rules/passiveEventListenerRule";
import { dataHandlerWidgetKeyRule } from "../server/rules/dataHandlerWidgetKeyRule";
import { sitemapRegistry } from "../server/registry/sitemaps";
import { validateSitemap } from "../server/rules/sitemapRules";
import { resolveHover, resolveSitemapHover } from "../server/hover/provider";
import { resolveDefinition, resolveSitemapDefinition } from "../server/definition/provider";
import { resolveCodeActions } from "../server/codeaction/provider";
import { widgetRegistry } from "../server/registry/widgets";
import {
  scanWorkspace,
  resolveProjectRoot,
  findStreakProjectRoot,
  isStreakProjectDirectory,
  isStreakFile,
} from "../server/registry/scanner";
import { getCompletions } from "../server/completion/provider";
import { getJsxContext } from "../server/completion/jsxAttributeCompletions";
import { getAutoImportEdit } from "../server/completion/frameworkCompletions";
import {
  isInsideLoadDynamicComponent,
  getGDomCompletions,
} from "../server/completion/scriptCompletions";
import { gdomRegistry, scanGDomTypes } from "../server/registry/gdomTypeScanner";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  buildRuleConfiguration,
  loadProjectSettings,
  mergeRuleConfigurations,
} from "../server/rules/config";
import { runtimePackageRegistry } from "../server/registry/packages";
import {
  packageInvalidExtensionRule,
  packageAbsolutePathRule,
  packagePublicPathRule,
  packageNotFoundRule,
} from "../server/rules/packageRules";
import {
  findPackageReferences,
  resolvePackageNameFromContext,
} from "../server/references/packageReferences";

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
    const { analysis } = analyzeAndParseDocument("file:///test/handler.ts", code);
    assert.strictEqual(analysis.errors.length, 0);
    assert.strictEqual(analysis.imports.length, 1);
    assert.strictEqual(analysis.imports[0].moduleSpecifier, "streak-forge/components");
    assert.ok(analysis.imports[0].namedImports.includes("WidgetPlaceholder"));
    assert.ok(analysis.exports.some((e) => e.isDefault));
  });

  // ── Validation Rules Tests ─────────────────────────────────────────

  test("WidgetPlaceholder rule flags missing id and type attributes with streak:S101", () => {
    const code = `
      import { WidgetPlaceholder } from "streak-forge/components";
      
      export default function Component() {
        return <WidgetPlaceholder />;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///workspace/src/layout/MainLayout.tsx",
      code,
    );
    const diags = widgetPlaceholderRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S101");
  });

  test("WidgetPlaceholder rule flags non-layout usage (S102) and allows mismatched id/type (S103 descoped)", () => {
    const code = `
      import { WidgetPlaceholder } from "streak-forge/components";
      
      export default function Component() {
        return <WidgetPlaceholder id="Header" type="DifferentHeader" />;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///workspace/src/widgets/MyWidget.tsx",
      code,
    );
    const diags = widgetPlaceholderRule.run(sourceFile, analysis);
    assert.ok(diags.some((d) => d.code === "streak:S102"));
    assert.ok(!diags.some((d) => d.code === "streak:S103"));
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/Comp.tsx", code);
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/Widget.tsx", code);
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/Widget.tsx", code);
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/ScriptComp.tsx", code);
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/ScriptAsync.tsx", code);
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/DynamicComp.tsx", code);
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/Incomplete.tsx", code);
    const lspDiagnostics = runRules(sourceFile, analysis);
    assert.ok(lspDiagnostics.length >= 2);
    assert.ok(lspDiagnostics.some((d) => d.code === "streak:S101"));
    assert.ok(lspDiagnostics.some((d) => d.code === "streak:S102"));
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
      assert.ok(typeof parsed === "object" && parsed !== null, `${file} must be a JSON object`);
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
    const { sourceFile } = analyzeAndParseDocument("file:///test/comp1.tsx", code1);
    const doc1 = TextDocument.create("file:///test/comp1.tsx", "typescriptreact", 1, code1);
    const edits1 = getAutoImportEdit(doc1, sourceFile, "WidgetPlaceholder");
    assert.strictEqual(edits1.length, 1);
    assert.ok(
      edits1[0].newText.includes('import { WidgetPlaceholder } from "streak-forge/components";'),
    );

    const code2 = `
      import { Preload } from "streak-forge/components";
      export default function Test() {
        return <Preload href="/a" as="style" />;
      }
    `;
    const { sourceFile: sf2 } = analyzeAndParseDocument("file:///test/comp2.tsx", code2);
    const doc2 = TextDocument.create("file:///test/comp2.tsx", "typescriptreact", 1, code2);
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
    const { sourceFile: sf1 } = analyzeAndParseDocument("file:///test/comp1.tsx", code1);
    const doc1 = TextDocument.create("file:///test/comp1.tsx", "typescriptreact", 1, code1);

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
    const offset2 = code2.indexOf('loadDynamicComponent("') + 'loadDynamicComponent("'.length;
    const { sourceFile: sf2 } = analyzeAndParseDocument("file:///test/comp2.tsx", code2);
    const doc2 = TextDocument.create("file:///test/comp2.tsx", "typescriptreact", 1, code2);

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
    const { sourceFile, analysis } = analyzeAndParseDocument("file:///test/scriptId.tsx", code);
    const diagnostics = scriptRequiredIdRule.run(sourceFile, analysis);
    assert.strictEqual(diagnostics.length, 2);
    assert.strictEqual(diagnostics[0].code, "streak:S405");
    assert.strictEqual(diagnostics[1].code, "streak:S405");
    assert.ok(diagnostics[0].message.includes('requires a non-empty "id"'));
  });

  test("getAutoImportEdit formats multi-line merging", () => {
    const code = 'import { WidgetPlaceholder } from "streak-forge/components";\n';
    const { sourceFile } = analyzeAndParseDocument("file:///test/importMerge.tsx", code);
    const doc = TextDocument.create("file:///test/importMerge.tsx", "typescriptreact", 1, code);
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
    const { sourceFile } = analyzeAndParseDocument("file:///test/gdomComp.tsx", code);
    const doc = TextDocument.create("file:///test/gdomComp.tsx", "typescriptreact", 1, code);
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
    assert.ok(labels.includes("addResourceToBody"));
    assert.ok(labels.includes("loadPackage"));
    assert.ok(labels.includes("addWidgetToBody"));
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
    const { sourceFile } = analyzeAndParseDocument("file:///test/sfComp.tsx", code);
    const doc = TextDocument.create("file:///test/sfComp.tsx", "typescriptreact", 1, code);
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
    const { sourceFile } = analyzeAndParseDocument("file:///test/widgets/HelloPager.tsx", code);
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
      sfWidEItem.insertText?.includes("const HelloPager = (props: HelloPagerProps) => {"),
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
    const { sourceFile } = analyzeAndParseDocument("file:///test/hoverComp.tsx", code);

    // 1. Test WidgetPlaceholder
    const wpNode = sourceFile.getDescendantAtPos(code.indexOf("<WidgetPlaceholder") + 1);
    assert.ok(wpNode);
    const wpResult = resolveHover(wpNode) as Hover;
    assert.ok(wpResult);
    assert.ok(
      (wpResult.contents as MarkupContent).value.includes("Streak `<WidgetPlaceholder>` Component"),
    );

    // 2. Test Preload
    const preNode = sourceFile.getDescendantAtPos(code.indexOf("<Preload") + 1);
    assert.ok(preNode);
    const preResult = resolveHover(preNode) as Hover;
    assert.ok(preResult);
    assert.ok((preResult.contents as MarkupContent).value.includes("Streak `<Preload>` Component"));

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
    const { sourceFile } = analyzeAndParseDocument("file:///test/hoverAttr.tsx", code);

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

    const { sourceFile } = analyzeAndParseDocument("file:///test/defTest.tsx", code);

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
    const { sourceFile } = analyzeAndParseDocument("file:///test/codeActionJsx.tsx", code);
    const doc = TextDocument.create("file:///test/codeActionJsx.tsx", "typescriptreact", 1, code);

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
      actionsS405[0].edit?.changes?.["file:///test/codeActionJsx.tsx"]?.[0]?.newText,
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
    assert.strictEqual(actionsS101[0].title, "Add id attribute to <WidgetPlaceholder>");

    // 3. WidgetPlaceholder missing type (S101 with 'type')
    const diagS101Type = {
      code: "streak:S101",
      message: "requires a non-empty 'type' attribute",
      range: { start: wpPos, end: wpPos },
    } as unknown as Diagnostic;

    const actionsS101Type = resolveCodeActions([diagS101Type], doc, sourceFile);
    assert.strictEqual(actionsS101Type.length, 1);
    assert.strictEqual(actionsS101Type[0].title, "Add type attribute to <WidgetPlaceholder>");

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
    const { sourceFile } = analyzeAndParseDocument("file:///test/codeActionAsync.ts", code);
    const doc = TextDocument.create("file:///test/codeActionAsync.ts", "typescript", 1, code);

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
      actionsS202_1[0].edit?.changes?.["file:///test/codeActionAsync.ts"]?.[0]?.newText,
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
    const { sourceFile } = analyzeAndParseDocument("file:///test/AboutData.tsx", code);
    const doc = TextDocument.create("file:///test/AboutData.tsx", "typescriptreact", 1, code);

    const startPos = doc.positionAt(0);
    const diagS301 = {
      code: "streak:S301",
      message: "Missing default export",
      range: { start: startPos, end: startPos },
    } as unknown as Diagnostic;

    const actionsS301 = resolveCodeActions([diagS301], doc, sourceFile);
    assert.strictEqual(actionsS301.length, 1);
    assert.strictEqual(actionsS301[0].title, "Add default export for AboutData");
    assert.ok(
      actionsS301[0].edit?.changes?.["file:///test/AboutData.tsx"]?.[0]?.newText.includes(
        "export default AboutData;",
      ),
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
    assert.strictEqual(meta.docComment, "Renders a customizable product item card display.");
    assert.strictEqual(meta.props.length, 2);

    const titleProp = meta.props.find((p) => p.name === "title");
    assert.ok(titleProp);
    assert.strictEqual(titleProp.type, "string");
    assert.strictEqual(titleProp.isOptional, false);
    assert.strictEqual(titleProp.docComment, "The display label name of the product item.");

    const priceProp = meta.props.find((p) => p.name === "price");
    assert.ok(priceProp);
    assert.strictEqual(priceProp.type, "number");
    assert.strictEqual(priceProp.isOptional, true);
    assert.strictEqual(priceProp.docComment, "Optional price label tag format.");

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
      TextDocument.create("file:///test/main.tsx", "typescriptreact", 1, autocompleteCode),
      analyzeAndParseDocument("file:///test/main.tsx", autocompleteCode).sourceFile,
      tempRoot,
    );

    const compItem = comps.find((c) => c.label === "ProductCard");
    assert.ok(compItem);
    assert.strictEqual(compItem.detail, "Custom Project Widget");
    assert.ok(compItem.documentation);
    const docValue = (compItem.documentation as MarkupContent).value;
    assert.ok(docValue.includes("Renders a customizable product item card display."));
    assert.ok(docValue.includes("title: string"));
    assert.ok(docValue.includes("price?: number"));

    // 3. Assert Hover over type value resolves custom properties documentation
    const hoverOffset = autocompleteCode.indexOf("ProductCard");
    const { sourceFile } = analyzeAndParseDocument("file:///test/main.tsx", autocompleteCode);
    const hoverNode = sourceFile.getDescendantAtPos(hoverOffset);
    assert.ok(hoverNode);
    const hoverResult = resolveHover(hoverNode);
    assert.ok(hoverResult);
    const hoverVal = (hoverResult.contents as MarkupContent).value;
    assert.ok(hoverVal.includes("Renders a customizable product item card display."));
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
    const { sourceFile } = analyzeAndParseDocument("c:/project/src/widgets/HeaderWidget.tsx", code);
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
    assert.ok(diags[0].message.includes("Duplicated widget component name 'HeaderWidget'"));

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
    const { sourceFile } = analyzeAndParseDocument("file:///test/nested.tsx", code);
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

  test("streak:S602 flags nested WidgetPlaceholder inside WidgetPlaceholder", () => {
    const code = `
      import { WidgetPlaceholder } from "streak-forge/components";
      export default function AboutUsLayout() {
        return (
          <WidgetPlaceholder id="GlobalInteractions" type="GlobalInteractions">
            <WidgetPlaceholder id="AnalyticsHelpers" type="AnalyticsHelpers" />
          </WidgetPlaceholder>
        );
      }
    `;
    const { sourceFile } = analyzeAndParseDocument(
      "file:///workspace/src/layouts/AboutUsLayout.tsx",
      code,
    );
    const diags = componentNestingRule.run(sourceFile, {
      uri: "file:///workspace/src/layouts/AboutUsLayout.tsx",
      exports: [],
      components: [],
      imports: [],
      jsxElements: [],
      errors: [],
    });
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S602");
    assert.ok(
      diags[0].message.includes(
        "Nesting `<WidgetPlaceholder>` inside another `<WidgetPlaceholder>`",
      ),
    );
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
    const { sourceFile } = analyzeAndParseDocument("file:///test/struct.tsx", code);
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
    assert.ok(diags[0].message.includes("requires an inline execution callback"));
    assert.strictEqual(diags[1].code, "streak:S603");
    assert.ok(diags[1].message.includes("must be wrapped in a JSX expression"));
    assert.strictEqual(diags[2].code, "streak:S603");
    assert.ok(diags[2].message.includes("must be a client-side function expression"));
  });

  test("streak:S702 flags banned patterns matched by regular expressions", () => {
    const code = `
      const x = eval("1 + 1");
      const y = setTimeout(() => {}, 100);
      console.log("hello");
    `;
    const { sourceFile } = analyzeAndParseDocument("file:///test/patterns.ts", code);

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

  test("buildRuleConfiguration parses array and object forbiddenPatterns configurations", () => {
    // 1. Direct array of regex patterns
    const arrayConfig = buildRuleConfiguration({
      rules: {
        forbiddenPatterns: ["eval\\(", "dangerouslySetInnerHTML"],
      },
    });
    assert.deepStrictEqual(arrayConfig.ruleOptions.forbiddenPatterns, [
      "eval\\(",
      "dangerouslySetInnerHTML",
    ]);

    // 2. Object with patterns array and custom severity
    const objectConfig = buildRuleConfiguration({
      rules: {
        forbiddenPatterns: {
          severity: "warning",
          patterns: ["eval\\("],
        },
      },
    });
    assert.deepStrictEqual(objectConfig.ruleOptions.forbiddenPatterns, ["eval\\("]);
    assert.strictEqual(objectConfig.ruleSeverities["streak:forbidden-patterns"], "warning");

    // 3. Object with severity only (default state from schema)
    const severityOnlyConfig = buildRuleConfiguration({
      rules: {
        forbiddenPatterns: {
          severity: "error",
        },
      },
    });
    assert.strictEqual(severityOnlyConfig.ruleSeverities["streak:forbidden-patterns"], "error");
    assert.strictEqual(severityOnlyConfig.ruleOptions.forbiddenPatterns, undefined);

    // 4. Flat dotted keys as written in .vscode/settings.json
    const flatDottedConfig = buildRuleConfiguration({
      "streak.rules.forbiddenPatterns.severity": "warning",
      "streak.rules.forbiddenPatterns.patterns": ["sessionStorage\\.setItem\\s*\\("],
    });
    assert.deepStrictEqual(flatDottedConfig.ruleOptions.forbiddenPatterns, [
      "sessionStorage\\.setItem\\s*\\(",
    ]);
    assert.strictEqual(flatDottedConfig.ruleSeverities["streak:forbidden-patterns"], "warning");
  });

  test("loadProjectSettings reads and parses project-level .vscode/settings.json with comments and trailing commas", () => {
    const tempProjectDir = path.join(__dirname, "..", "..", "test-monorepo-subproject");
    const vscodeDir = path.join(tempProjectDir, ".vscode");
    fs.mkdirSync(vscodeDir, { recursive: true });

    const settingsContent = `{
      // Subproject-specific streak rules in a monorepo
      "streak.rules.forbiddenPatterns.severity": "error",
      "streak.rules.forbiddenPatterns.patterns": [
        "sessionStorage\\\\.setItem\\\\s*\\\\(", // inline comment
      ],
    }`;

    fs.writeFileSync(path.join(vscodeDir, "settings.json"), settingsContent, "utf-8");

    try {
      const loaded = loadProjectSettings(tempProjectDir);
      assert.ok(loaded, "Project settings should be loaded from disk");

      const config = buildRuleConfiguration(loaded);
      assert.deepStrictEqual(config.ruleOptions.forbiddenPatterns, [
        "sessionStorage\\.setItem\\s*\\(",
      ]);
      assert.strictEqual(config.ruleSeverities["streak:forbidden-patterns"], "error");
    } finally {
      fs.rmSync(tempProjectDir, { recursive: true, force: true });
    }
  });

  test("mergeRuleConfigurations overrides workspace settings with project-level settings", () => {
    const workspaceConfig = {
      ruleSeverities: {
        "streak:forbidden-patterns": "warning",
        "streak:widget-placeholder-props": "warning",
      },
      ruleOptions: {
        forbiddenPatterns: ["eval\\("],
      },
    };

    const projectConfig = {
      ruleSeverities: {
        "streak:forbidden-patterns": "error",
      },
      ruleOptions: {
        forbiddenPatterns: ["sessionStorage\\.setItem\\s*\\("],
      },
    };

    const merged = mergeRuleConfigurations(workspaceConfig, projectConfig);
    // Project severity overrides workspace severity
    assert.strictEqual(merged.ruleSeverities["streak:forbidden-patterns"], "error");
    // Workspace-only severity is preserved
    assert.strictEqual(merged.ruleSeverities["streak:widget-placeholder-props"], "warning");
    // Project patterns override workspace patterns
    assert.deepStrictEqual(merged.ruleOptions.forbiddenPatterns, [
      "sessionStorage\\.setItem\\s*\\(",
    ]);
  });

  test("streak.createWidget command is registered and scaffolds a widget file", async () => {
    process.env.STREAK_TEST_ENVIRONMENT = "1";
    const originalShowInputBox = vscode.window.showInputBox;
    (vscode.window as unknown as { showInputBox: () => Promise<string> }).showInputBox = () =>
      Promise.resolve("MyScaffoldedWidget");

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
        content.includes("const MyScaffoldedWidget = (props: MyScaffoldedWidgetProps) => {"),
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

    const nonWidgetRes = analyzeAndParseDocument(
      "file:///workspace/src/components/MyWidget.tsx",
      code,
    );
    assert.strictEqual(nonWidgetRes.analysis.isWidget, false);

    const nonWidgetTsRes = analyzeAndParseDocument(
      "file:///workspace/src/widgets/MyWidget.ts",
      code,
    );
    assert.strictEqual(nonWidgetTsRes.analysis.isWidget, false);
  });

  test("streak:S801 rule validates widget filename matches component name", () => {
    // Valid: filename matches component name
    const codeValid = `
      const MyBanner = () => { return <div />; };
      export default MyBanner;
    `;
    const resValid = analyzeAndParseDocument(
      "file:///workspace/src/widgets/MyBanner.tsx",
      codeValid,
    );
    const diagsValid = widgetFilenameMatchesComponentRule.run(
      resValid.sourceFile,
      resValid.analysis,
    );
    assert.strictEqual(diagsValid.length, 0);

    // Invalid: filename does not match component name
    const codeInvalid = `
      const HeroBanner = () => { return <div />; };
      export default HeroBanner;
    `;
    const resInvalid = analyzeAndParseDocument(
      "file:///workspace/src/widgets/MyBanner.tsx",
      codeInvalid,
    );
    const diagsInvalid = widgetFilenameMatchesComponentRule.run(
      resInvalid.sourceFile,
      resInvalid.analysis,
    );
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
    assert.strictEqual(
      diags[0].message,
      "Widgets must remain stateless. Use Script components for client-side behavior.",
    );
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
    const { sourceFile } = analyzeAndParseDocument(
      "file:///workspace/src/widgets/MyBanner.tsx",
      code,
    );

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

  test("Sitemap parser parses JSON sitemaps with layouts and nested renderConfig formats", () => {
    const json = `{
      "pages": [
        {
          "url": "/about",
          "renderConfig": {
            "renderId": "homeRenderId",
            "dataHandler": "about-handler",
            "rootLayout": "MainLayout",
            "widgets": [
              {
                "type": "HelloBanner"
              }
            ]
          }
        }
      ]
    }`;

    sitemapRegistry.parseAndRegister("file:///test/streak.sitemap.json", json);
    const pages = sitemapRegistry.getPages();
    assert.strictEqual(pages.length, 1);
    assert.strictEqual(pages[0].url, "/about");
    assert.strictEqual(pages[0].handler, "about-handler");
    assert.strictEqual(pages[0].layout, "MainLayout");
    assert.strictEqual(pages[0].widgets.length, 1);
    assert.strictEqual(pages[0].widgets[0].type, "HelloBanner");
    assert.ok(pages[0].widgets[0].start > 0);
  });

  test("validateSitemap flags duplicate routes, missing widgets, missing handlers, duplicate renderConfigIDs, missing layouts, and invalid loadingStrategy", () => {
    const json = `[
      {
        "url": "/",
        "renderConfig": {
          "renderId": "homeRenderId",
          "dataHandler": "HomeDataHandler",
          "rootLayout": "MainLayout",
          "widgets": [
            { "id": "PageHead", "type": "MissingWidget", "loadingStrategy": "invalidStrategy" }
          ]
        }
      },
      {
        "url": "/",
        "renderConfig": {
          "renderId": "homeRenderId",
          "dataHandler": "MissingDataHandler",
          "rootLayout": "MissingLayout",
          "widgets": []
        }
      }
    ]`;

    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);
    const diags = validateSitemap(doc, "/workspace");

    // S901 (duplicate route "/"), S905 (duplicate renderId "homeRenderId"), S902 (missing widget warning), S903 (missing handler warning), S906 (missing layout warning), S907 (invalid loadingStrategy warning)
    assert.ok(diags.length >= 7);
    assert.ok(
      diags.some((d) => d.code === "streak:S901" && d.severity === DiagnosticSeverity.Error),
    );
    assert.ok(
      diags.some((d) => d.code === "streak:S905" && d.severity === DiagnosticSeverity.Error),
    );
    assert.ok(
      diags.some((d) => d.code === "streak:S902" && d.severity === DiagnosticSeverity.Warning),
    );
    assert.ok(
      diags.some((d) => d.code === "streak:S903" && d.severity === DiagnosticSeverity.Warning),
    );
    assert.ok(
      diags.some((d) => d.code === "streak:S906" && d.severity === DiagnosticSeverity.Warning),
    );
    assert.ok(
      diags.some((d) => d.code === "streak:S907" && d.severity === DiagnosticSeverity.Warning),
    );
  });

  test("resolveSitemapDefinition navigates to widget, handler (.ts in src/handler), and layout (.tsx in src/layout) files", () => {
    const json = `[
      {
        "url": "/",
        "renderConfig": {
          "renderId": "homeRenderId",
          "dataHandler": "HomeDataHandler",
          "rootLayout": "MainLayout",
          "widgets": [
            { "id": "banner1", "type": "HelloBanner" }
          ]
        }
      }
    ]`;
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);

    const tempRoot = path.join(__dirname, `temp_sitemap_test_${Date.now()}`).replaceAll("\\", "/");
    const widgetsDir = path.join(tempRoot, "src", "widgets");
    const handlerDir = path.join(tempRoot, "src", "handler");
    const layoutDir = path.join(tempRoot, "src", "layout");

    fs.mkdirSync(widgetsDir, { recursive: true });
    fs.mkdirSync(handlerDir, { recursive: true });
    fs.mkdirSync(layoutDir, { recursive: true });

    fs.writeFileSync(
      path.join(widgetsDir, "HelloBanner.tsx"),
      "export default function HelloBanner() {}",
    );
    fs.writeFileSync(
      path.join(handlerDir, "HomeDataHandler.ts"),
      "export default async function HomeDataHandler() { return { status: 200 }; }",
    );
    fs.writeFileSync(
      path.join(layoutDir, "MainLayout.tsx"),
      "export default function MainLayout() { return <div />; }",
    );

    try {
      const sitemapPath = path.join(tempRoot, "streak.sitemap.json");
      sitemapRegistry.parseAndRegister(sitemapPath, json);

      // Find offset of "HelloBanner"
      const typeOffset = json.indexOf("HelloBanner") + 2;
      const defLoc = resolveSitemapDefinition(doc, typeOffset, tempRoot);
      assert.ok(defLoc);
      assert.ok(defLoc.uri.includes("HelloBanner.tsx"));

      // Find offset of "HomeDataHandler"
      const handlerOffset = json.indexOf("HomeDataHandler") + 2;
      const handlerLoc = resolveSitemapDefinition(doc, handlerOffset, tempRoot);
      assert.ok(handlerLoc);
      assert.ok(handlerLoc.uri.includes("HomeDataHandler.ts"));

      // Find offset of "MainLayout"
      const layoutOffset = json.indexOf("MainLayout") + 2;
      const layoutLoc = resolveSitemapDefinition(doc, layoutOffset, tempRoot);
      assert.ok(layoutLoc);
      assert.ok(layoutLoc.uri.includes("MainLayout.tsx"));
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
    const hoverWidget = resolveSitemapHover(
      doc,
      json.indexOf("HelloBanner") + 2,
      "/workspace",
    ) as Hover;
    assert.ok(hoverWidget);
    assert.ok((hoverWidget.contents as MarkupContent).value.includes("Widget: HelloBanner"));
  });

  test("Sitemap autocomplete suggests widget names and sf-widget / sf-sitemap snippets", () => {
    widgetRegistry.set("HelloBanner", {
      name: "HelloBanner",
      filePath: "file:///test/HelloBanner.tsx",
      props: [],
    });

    const json = `"type": "`;
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);
    const { sourceFile } = analyzeAndParseDocument(
      "file:///test/dummy_completions.ts",
      "export default {}",
    );

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

    // Check sf-widget snippet
    const jsonWidgetSnippet = "sf-w";
    const docWidgetSnippet = TextDocument.create(
      "file:///test/streak.sitemap.json",
      "json",
      1,
      jsonWidgetSnippet,
    );
    const itemsWidget = getCompletions(
      {
        text: jsonWidgetSnippet,
        uri: "file:///test/streak.sitemap.json",
        offset: jsonWidgetSnippet.length,
        line: 0,
        character: jsonWidgetSnippet.length,
      },
      docWidgetSnippet,
      sourceFile,
      "/workspace",
    );
    assert.ok(
      itemsWidget.some((i) => i.label === "sf-widget" && i.detail === "Streak Widget entry"),
    );

    // Check sf-sitemap snippet
    const jsonSitemapSnippet = "sf-s";
    const docSitemapSnippet = TextDocument.create(
      "file:///test/streak.sitemap.json",
      "json",
      1,
      jsonSitemapSnippet,
    );
    const itemsSitemap = getCompletions(
      {
        text: jsonSitemapSnippet,
        uri: "file:///test/streak.sitemap.json",
        offset: jsonSitemapSnippet.length,
        line: 0,
        character: jsonSitemapSnippet.length,
      },
      docSitemapSnippet,
      sourceFile,
      "/workspace",
    );
    assert.ok(itemsSitemap.some((i) => i.label === "sf-sitemap" && i.detail === "Streak Sitemap"));
  });

  test("streak:S904 flags dead widgets not referenced by sitemap", () => {
    const code = `
      const UnusedWidget = () => { return <div />; };
      export default UnusedWidget;
    `;
    const { sourceFile, analysis } = analyzeAndParseDocument(
      "file:///workspace/src/widgets/UnusedWidget.tsx",
      code,
    );

    // Set sitemap pages to HelloBanner only, so UnusedWidget is dead
    sitemapRegistry.setPages("file:///test/streak.sitemap.json", [
      {
        url: "/home",
        widgets: [{ type: "HelloBanner", start: 0, end: 10 }],
        start: 0,
        end: 100,
      },
    ]);

    const diags = deadWidgetRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S904");
    assert.strictEqual(diags[0].message, "Widget is not referenced by any sitemap page.");
  });

  test("streak:S406 flags scroll/mousemove listeners without passive: true", () => {
    const code = `
      window.addEventListener("scroll", () => {});
      window.addEventListener("mousemove", () => {}, false);
      window.addEventListener("touchmove", () => {}, { passive: true });
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/events.tsx", code);
    const diags = passiveEventListenerRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 2);
    assert.strictEqual(diags[0].code, "streak:S406");
    assert.ok(diags[0].message.includes("scroll"));
    assert.strictEqual(diags[1].code, "streak:S406");
    assert.ok(diags[1].message.includes("mousemove"));
  });

  test("validateSitemap enforces strict case sensitivity on handlers and layouts", () => {
    const json = `[
      {
        "url": "/case-test",
        "renderConfig": {
          "renderId": "caseRenderId",
          "dataHandler": "homedatahandler",
          "rootLayout": "mainlayout",
          "widgets": []
        }
      }
    ]`;
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);

    const tempRoot = path.join(__dirname, `temp_case_test_${Date.now()}`).replaceAll("\\", "/");
    const handlerDir = path.join(tempRoot, "src", "handler");
    const layoutDir = path.join(tempRoot, "src", "layout");
    fs.mkdirSync(handlerDir, { recursive: true });
    fs.mkdirSync(layoutDir, { recursive: true });

    // Exact casing on disk is HomeDataHandler.ts and MainLayout.tsx
    fs.writeFileSync(
      path.join(handlerDir, "HomeDataHandler.ts"),
      "export default async function HomeDataHandler() { return { status: 200 }; }",
    );
    fs.writeFileSync(
      path.join(layoutDir, "MainLayout.tsx"),
      "export default function MainLayout() { return <div />; }",
    );

    try {
      const diags = validateSitemap(doc, tempRoot);
      // Because sitemap specifies "homedatahandler" and "mainlayout", strict case sensitivity flags warnings
      assert.ok(diags.some((d) => d.code === "streak:S903"));
      assert.ok(diags.some((d) => d.code === "streak:S906"));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("validateSitemap allows mismatched id and type in widgets[] (S103 descoped)", () => {
    const json = `[
      {
        "url": "/mismatch",
        "renderConfig": {
          "renderId": "mismatchRenderId",
          "widgets": [
            { "id": "BannerId", "type": "HeroBanner" },
            { "id": "Header", "type": "Header" }
          ]
        }
      }
    ]`;
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, json);
    const diags = validateSitemap(doc, "/workspace");
    const s103Diags = diags.filter((d) => d.code === "streak:S103");
    assert.strictEqual(s103Diags.length, 0);
  });

  test("streak:S204 flags data handler return keys that do not match registered widgets", () => {
    // Populate widget registry with ArticleList
    widgetRegistry.set("ArticleList", {
      name: "ArticleList",
      filePath: "/workspace/src/widgets/ArticleList.tsx",
      props: [],
    });

    const code = `
      const getHomeData = async () => {
        return {
          status: 200,
          ArticleList: { items: [] },
          UnknownWidget: { data: 123 },
        };
      };
      export default getHomeData;
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///workspace/src/handler/HomeDataHandler.ts",
      code,
    );
    const diags = dataHandlerWidgetKeyRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].code, "streak:S204");
    assert.ok(diags[0].message.includes("UnknownWidget"));
  });

  test("missingDefaultExportRule ignores non-framework files (scripts, tests, utils) and validates framework folders", () => {
    const helperCode = `export const sum = (a: number, b: number) => a + b;`;
    const { analysis: utilAnalysis, sourceFile: utilFile } = analyzeAndParseDocument(
      "file:///workspace/src/utils/math.ts",
      helperCode,
    );
    const utilDiags = missingDefaultExportRule.run(utilFile, utilAnalysis);
    assert.strictEqual(utilDiags.length, 0);

    const layoutCode = `export const MainLayout = () => <div>Layout</div>;`;
    const { analysis: layoutAnalysis, sourceFile: layoutFile } = analyzeAndParseDocument(
      "file:///workspace/src/layouts/MainLayout.tsx",
      layoutCode,
    );
    const layoutDiags = missingDefaultExportRule.run(layoutFile, layoutAnalysis);
    assert.strictEqual(layoutDiags.length, 1);
    assert.strictEqual(layoutDiags[0].code, "streak:S301");
  });

  test("widgetPlaceholderRule emits streak:S902 on layouts when widget does not exist in src/widgets", () => {
    widgetRegistry.set("HelloBanner", {
      name: "HelloBanner",
      filePath: "/workspace/src/widgets/HelloBanner.tsx",
      props: [],
    });

    const code = `
      import { WidgetPlaceholder } from "streak-forge/components";
      export default function Layout() {
        return (
          <div>
            <WidgetPlaceholder id="HelloBanner" type="HelloBanner" />
            <WidgetPlaceholder id="MissingWid" type="MissingWid" />
          </div>
        );
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///workspace/src/layouts/MainLayout.tsx",
      code,
    );
    const diags = widgetPlaceholderRule.run(sourceFile, analysis);
    const s902Diags = diags.filter((d) => d.code === "streak:S902");
    assert.strictEqual(s902Diags.length, 1);
    assert.ok(s902Diags[0].message.includes('Widget "MissingWid" does not exist in src/widgets'));
  });

  test("scriptClosureCaptureRule ignores TypeScript type annotations like ': MouseEvent'", () => {
    const code = `
      import { Script } from "streak-forge/components";
      export default function MyWidget() {
        return (
          <Script id="my-script" options={{ color: "#fff" }}>
            {(gDom: any, options: any) => {
              document.addEventListener("mousedown", (e: MouseEvent) => {
                const nx = e.clientX / window.innerWidth;
              });
            }}
          </Script>
        );
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///workspace/src/widgets/MyWidget.tsx",
      code,
    );
    const diags = scriptClosureCaptureRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 0);
  });

  test("resolveDefinition resolves widget file when cursor is on handler return property name", async () => {
    const tmpDir = path.join(__dirname, "../../tmp_def_test");
    const widgetsDir = path.join(tmpDir, "src", "widgets");
    fs.mkdirSync(widgetsDir, { recursive: true });
    const widgetFilePath = path.join(widgetsDir, "HelloBanner.tsx");
    fs.writeFileSync(
      widgetFilePath,
      "export default function HelloBanner() { return <div>Banner</div>; }",
    );

    try {
      const code = `
        const getHomeData = async () => {
          return {
            status: 200,
            HelloBanner: { items: [] }
          };
        };
        export default getHomeData;
      `;
      const { sourceFile } = analyzeAndParseDocument("file:///test/HomeHandler.ts", code);
      const targetNode = sourceFile.getFirstDescendant((n) => n.getText() === "HelloBanner");
      assert.ok(targetNode);

      const loc = await resolveDefinition(targetNode, tmpDir);
      assert.ok(loc);
      assert.ok(loc.uri.endsWith("HelloBanner.tsx"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("dataHandler rules (S201, S202, S203, S204) ignore test files in src/tests/ and src/test/ and only validate handlers", () => {
    const testCode = `
      export const helper = () => {
        return { message: "ok" };
      };
      export default function testRunner() {}
    `;
    const { analysis: testAnalysis, sourceFile: testFile } = analyzeAndParseDocument(
      "file:///workspace/src/tests/auth.test.ts",
      testCode,
    );
    assert.strictEqual(dataHandlerStatusRule.run(testFile, testAnalysis).length, 0);
    assert.strictEqual(dataHandlerAsyncRule.run(testFile, testAnalysis).length, 0);
    assert.strictEqual(dataHandlerStatusValueRule.run(testFile, testAnalysis).length, 0);
    assert.strictEqual(dataHandlerWidgetKeyRule.run(testFile, testAnalysis).length, 0);

    const handlerCode = `
      export const getAuthData = () => {
        return { message: "ok" };
      };
      export default getAuthData;
    `;
    const { analysis: handlerAnalysis, sourceFile: handlerFile } = analyzeAndParseDocument(
      "file:///workspace/src/handlers/authDataHandler.ts",
      handlerCode,
    );
    assert.strictEqual(dataHandlerAsyncRule.run(handlerFile, handlerAnalysis).length, 1);
    assert.strictEqual(dataHandlerStatusRule.run(handlerFile, handlerAnalysis).length, 1);
  });

  test("scanWorkspace and validateSitemap support nested subprojects (monorepo structure)", async () => {
    const parentDir = path.join(__dirname, "../../tmp_subproject_test");
    const subprojectDir = path.join(parentDir, "streak-website");
    const widgetsDir = path.join(subprojectDir, "src", "widgets");
    const handlerDir = path.join(subprojectDir, "src", "handler");
    const layoutDir = path.join(subprojectDir, "src", "layout");

    fs.mkdirSync(widgetsDir, { recursive: true });
    fs.mkdirSync(handlerDir, { recursive: true });
    fs.mkdirSync(layoutDir, { recursive: true });

    fs.writeFileSync(
      path.join(widgetsDir, "HelloBanner.tsx"),
      "export default function HelloBanner() { return <div>Banner</div>; }",
    );
    fs.writeFileSync(
      path.join(handlerDir, "HomeDataHandler.ts"),
      "export default async function HomeDataHandler() { return { status: 200, HelloBanner: {} }; }",
    );
    fs.writeFileSync(
      path.join(layoutDir, "MainLayout.tsx"),
      'import { WidgetPlaceholder } from "streak-forge/components"; export default function MainLayout() { return <div><WidgetPlaceholder id="HelloBanner" type="HelloBanner" /></div>; }',
    );

    const sitemapContent = JSON.stringify([
      {
        url: "/",
        renderConfig: {
          renderId: "homeRenderId",
          dataHandler: "HomeDataHandler",
          rootLayout: "MainLayout",
          widgets: [{ id: "HelloBanner", type: "HelloBanner" }],
        },
      },
    ]);
    const sitemapFilePath = path.join(subprojectDir, "streak.sitemap.json");
    fs.writeFileSync(sitemapFilePath, sitemapContent);

    try {
      // 1. Recursive workspace scan from parent folder discovers nested widget
      await scanWorkspace(parentDir);
      assert.ok(widgetRegistry.get("HelloBanner"));

      // 2. resolveProjectRoot finds subproject folder for sitemap
      const projectRoot = resolveProjectRoot(pathToFileURL(sitemapFilePath).toString(), parentDir);
      assert.strictEqual(path.resolve(projectRoot), path.resolve(subprojectDir));

      // 3. validateSitemap with projectRoot produces 0 errors
      const doc = TextDocument.create(
        pathToFileURL(sitemapFilePath).toString(),
        "json",
        1,
        sitemapContent,
      );
      const diags = validateSitemap(doc, projectRoot);
      assert.strictEqual(diags.length, 0);
    } finally {
      fs.rmSync(parentDir, { recursive: true, force: true });
    }
  });

  // ── Phase 15 Production Readiness Tests ─────────────────────────────

  test("Performance: validateSitemap handles 10,000 pages within performance threshold (< 1000ms)", () => {
    // Generate 10,000 pages
    const pages = [];
    for (let i = 0; i < 10000; i++) {
      pages.push({
        url: `/page-${i}`,
        renderConfig: {
          renderId: `render-${i}`,
          widgets: [{ id: `Widget${i % 10}`, type: `Widget${i % 10}` }],
        },
      });
    }
    const sitemapJson = JSON.stringify(pages);
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, sitemapJson);

    const startTime = Date.now();
    const diags = validateSitemap(doc, "/mock/root");
    const duration = Date.now() - startTime;

    assert.ok(duration < 1000, `Expected validation to take < 1000ms, took ${duration}ms`);
    assert.ok(diags.length > 0); // Missing widget warnings
  });

  test("Security: resolveDefinition blocks path traversal attempts escaping public directory", async () => {
    const code = `
      import { Preload } from "streak-forge/components";
      export default function TestComp() {
        return <Preload href="../../secret.env" as="style" />;
      }
    `;
    const { sourceFile } = analyzeAndParseDocument("file:///test/comp.tsx", code);
    const node = sourceFile.getDescendants().find((n) => n.getText() === '"../../secret.env"');
    assert.ok(node);

    const loc = await resolveDefinition(node, "/workspace/root", "src/widgets", "public");
    assert.strictEqual(loc, null);
  });

  test("Reliability: JSONLocationParser and validateSitemap safely tolerate malformed JSON", () => {
    const malformedJson = `[ { "url": "/test", "renderConfig": { "widgets": [ { "id": "W1", "type": } ] } `;
    const doc = TextDocument.create("file:///test/streak.sitemap.json", "json", 1, malformedJson);

    // Should not throw
    assert.doesNotThrow(() => {
      const diags = validateSitemap(doc, "/mock/root");
      assert.ok(Array.isArray(diags));
    });
  });

  test("streak:S204 ignores 'common' and 'global' returned object properties in data handlers", () => {
    const code = `
      export default async function getHomeData() {
        return {
          status: 200,
          common: {
            language: "en"
          },
          global: {
            theme: "dark"
          }
        };
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/src/handlers/HomeDataHandler.ts",
      code,
    );
    const diags = dataHandlerWidgetKeyRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 0);
  });

  test("streak:S304 flags required data prop on interface but passes optional data? prop", () => {
    const invalidCode = `
      interface AnnouncementBannerProps {
        common?: { language?: string };
        data: { isEnabled: boolean };
      }
      export default function AnnouncementBanner(props: AnnouncementBannerProps) {
        return <div>{props.data.isEnabled}</div>;
      }
    `;
    const { analysis: invalidAnalysis, sourceFile: invalidSource } = analyzeAndParseDocument(
      "file:///test/src/widgets/AnnouncementBanner.tsx",
      invalidCode,
    );
    const invalidDiags = invalidWidgetPropsContractRule.run(invalidSource, invalidAnalysis);
    assert.strictEqual(invalidDiags.length, 1);
    assert.strictEqual(invalidDiags[0].code, "streak:S304");

    const validCode = `
      interface AnnouncementBannerProps {
        common?: { language?: string };
        data?: { isEnabled: boolean };
      }
      export default function AnnouncementBanner(props: AnnouncementBannerProps) {
        return <div>{props.data?.isEnabled}</div>;
      }
    `;
    const { analysis: validAnalysis, sourceFile: validSource } = analyzeAndParseDocument(
      "file:///test/src/widgets/AnnouncementBanner.tsx",
      validCode,
    );
    const validDiags = invalidWidgetPropsContractRule.run(validSource, validAnalysis);
    assert.strictEqual(validDiags.length, 0);
  });

  // ── v0.9.2 Post-Release Improvements Tests ─────────────────────────

  test("streak:S401 allows standard globals (Set, Map, Promise, parseInt, encodeURIComponent, structuredClone)", () => {
    const code = `
      import { Script } from "streak-forge/components";
      export default function TestWidget() {
        return (
          <Script id="test-script">
            {(gDom, options) => {
              const mySet = new Set([1, 2, 3]);
              const myMap = new Map();
              const p = Promise.resolve(true);
              const num = parseInt("42", 10);
              const encoded = encodeURIComponent("hello world");
              const clone = structuredClone({ a: 1 });
              queueMicrotask(() => {});
            }}
          </Script>
        );
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/src/widgets/TestWidget.tsx",
      code,
    );
    const diags = scriptClosureCaptureRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 0);
  });

  test("streak:S201 and S202 only validate default-exported handler function and ignore utility helpers", () => {
    const code = `
      // Synchronous utility helpers that do not return status
      export function formatHandlerData(raw: string) {
        return raw.toUpperCase();
      }

      export const parseDataHelper = (x: number) => {
        return x * 2;
      };

      // Default exported data handler is valid (async and returns status)
      const HomeDataHandler = async () => {
        const transformed = formatHandlerData("test");
        return { status: 200, count: parseDataHelper(5) };
      };

      export default HomeDataHandler;
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/src/handlers/HomeDataHandler.ts",
      code,
    );
    const statusDiags = dataHandlerStatusRule.run(sourceFile, analysis);
    const asyncDiags = dataHandlerAsyncRule.run(sourceFile, analysis);

    assert.strictEqual(
      statusDiags.length,
      0,
      "S201 should not flag utility helpers when default handler returns status",
    );
    assert.strictEqual(
      asyncDiags.length,
      0,
      "S202 should not flag synchronous utility helpers when default handler is async",
    );
  });

  test("streak:S201 and S202 flag invalid default export handler function declaration", () => {
    const code = `
      export function helper() {
        return "ok";
      }

      // Default export is not async and does not return status
      export default function HomeDataHandler() {
        return { message: "no status" };
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///test/src/handlers/HomeDataHandler.ts",
      code,
    );
    const statusDiags = dataHandlerStatusRule.run(sourceFile, analysis);
    const asyncDiags = dataHandlerAsyncRule.run(sourceFile, analysis);

    assert.strictEqual(statusDiags.length, 1);
    assert.strictEqual(statusDiags[0].code, "streak:S201");
    assert.strictEqual(asyncDiags.length, 1);
    assert.strictEqual(asyncDiags[0].code, "streak:S202");
  });

  test("gDom completions return 4 official methods and custom methods from global.d.ts", () => {
    gdomRegistry.clear();

    const dtsContent = `
      declare global {
        interface SGDom extends GDom {
          trackCustomAnalytics(eventName: string): void;
          fetchUserData(): Promise<any>;
        }
        interface Window {
          gDom: SGDom;
        }
      }
    `;
    const customMethods = scanGDomTypes(dtsContent, "test_global.d.ts");
    assert.strictEqual(customMethods.length, 2);
    assert.ok(customMethods.some((m) => m.name === "trackCustomAnalytics"));
    assert.ok(customMethods.some((m) => m.name === "fetchUserData"));

    gdomRegistry.registerMethods(customMethods);

    const completions = getGDomCompletions();
    const names = completions.map((c) => c.label);

    // Official 4 methods
    assert.ok(names.includes("addResourceToBody"));
    assert.ok(names.includes("loadPackage"));
    assert.ok(names.includes("loadDynamicComponent"));
    assert.ok(names.includes("addWidgetToBody"));

    // Custom methods
    assert.ok(names.includes("trackCustomAnalytics"));
    assert.ok(names.includes("fetchUserData"));

    gdomRegistry.clear();
  });

  test("streak:S204 does not flag helper/util functions returning non-widget keys", () => {
    widgetRegistry.clear();
    widgetRegistry.set("ArticleList", {
      name: "ArticleList",
      filePath: "/workspace/src/widgets/ArticleList.tsx",
      props: [],
    });

    const code = `
      export function formatHeading(title: string) {
        return { heading: title, count: 42 };
      }

      const fetchExtra = () => {
        return { extraData: true };
      };

      const getHomeData = async () => {
        const header = formatHeading("Welcome");
        const extra = fetchExtra();
        return {
          status: 200,
          ArticleList: { items: [], header, extra },
        };
      };
      export default getHomeData;
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument(
      "file:///workspace/src/handler/HomeDataHandler.ts",
      code,
    );
    const diags = dataHandlerWidgetKeyRule.run(sourceFile, analysis);
    assert.strictEqual(diags.length, 0, "Expected 0 S204 diagnostics for helper functions");
  });

  test("isStreakProjectDirectory identifies Streak projects via package.json dependencies and sitemap", () => {
    const tempDir = path.join(__dirname, `temp-test-project-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // Unrelated project: package.json with express
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "backend", dependencies: { express: "^4.18.0" } }),
      );
      assert.strictEqual(isStreakProjectDirectory(tempDir), false);

      // Streak project: package.json with streak-forge
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "streak-app", dependencies: { "streak-forge": "^1.0.0" } }),
      );
      assert.strictEqual(isStreakProjectDirectory(tempDir), true);

      // Subproject with streak.sitemap.json
      const subDir = path.join(tempDir, "subproject");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "streak.sitemap.json"), "[]");
      assert.strictEqual(isStreakProjectDirectory(subDir), true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("findStreakProjectRoot resolves subproject root and returns null for non-streak monorepo projects", () => {
    const monorepoRoot = path.join(__dirname, `temp-monorepo-${Date.now()}`);
    const streakPkgDir = path.join(monorepoRoot, "packages", "web-app");
    const expressPkgDir = path.join(monorepoRoot, "packages", "api-server");

    fs.mkdirSync(path.join(streakPkgDir, "src", "widgets"), { recursive: true });
    fs.mkdirSync(path.join(expressPkgDir, "src", "routes"), { recursive: true });

    try {
      // Streak package has streak-forge
      fs.writeFileSync(
        path.join(streakPkgDir, "package.json"),
        JSON.stringify({ name: "web-app", dependencies: { "streak-forge": "0.9.0" } }),
      );

      // Express package has express only
      fs.writeFileSync(
        path.join(expressPkgDir, "package.json"),
        JSON.stringify({ name: "api-server", dependencies: { express: "4.18.0" } }),
      );

      const streakFile = path.join(streakPkgDir, "src", "widgets", "Header.tsx");
      const expressFile = path.join(expressPkgDir, "src", "routes", "index.ts");

      const resolvedRoot = findStreakProjectRoot(streakFile, monorepoRoot);
      assert.ok(resolvedRoot);
      assert.strictEqual(path.resolve(resolvedRoot), path.resolve(streakPkgDir));
      assert.strictEqual(findStreakProjectRoot(expressFile, monorepoRoot), null);
      assert.strictEqual(isStreakFile(streakFile, monorepoRoot), true);
      assert.strictEqual(isStreakFile(expressFile, monorepoRoot), false);
    } finally {
      fs.rmSync(monorepoRoot, { recursive: true, force: true });
    }
  });

  test("RuntimePackageRegistry indexes and queries packages correctly", () => {
    runtimePackageRegistry.clear();
    runtimePackageRegistry.set({
      relativePath: "js/motion.js",
      absolutePath: "/app/public/assets/js/motion.js",
      fileName: "motion.js",
      urlPath: "/assets/js/motion.js",
    });

    const pkg = runtimePackageRegistry.get("js/motion.js");
    assert.ok(pkg);
    assert.strictEqual(pkg.fileName, "motion.js");
    assert.strictEqual(pkg.urlPath, "/assets/js/motion.js");
    assert.strictEqual(runtimePackageRegistry.getAll().length, 1);

    runtimePackageRegistry.deleteByPath("/app/public/assets/js/motion.js");
    assert.strictEqual(runtimePackageRegistry.get("js/motion.js"), undefined);
    assert.strictEqual(runtimePackageRegistry.getAll().length, 0);
  });

  test("scanWorkspace automatically discovers JavaScript packages under public/assets/", async () => {
    const tempDir = path.join(__dirname, "temp_scan_package_test");
    const assetsJsDir = path.join(tempDir, "public", "assets", "js");
    const assetsVendorDir = path.join(tempDir, "public", "assets", "vendor");
    fs.mkdirSync(assetsJsDir, { recursive: true });
    fs.mkdirSync(assetsVendorDir, { recursive: true });

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "pkg-test", dependencies: { "streak-forge": "1.0.0" } }),
      );
      fs.writeFileSync(path.join(assetsJsDir, "motion.js"), "console.log('motion');");
      fs.writeFileSync(path.join(assetsVendorDir, "chart.js"), "console.log('chart');");

      await scanWorkspace(tempDir);

      const motionPkg = runtimePackageRegistry.get("js/motion.js");
      assert.ok(motionPkg);
      assert.strictEqual(motionPkg.fileName, "motion.js");
      assert.strictEqual(motionPkg.urlPath, "/assets/js/motion.js");

      const chartPkg = runtimePackageRegistry.get("vendor/chart.js");
      assert.ok(chartPkg);
      assert.strictEqual(chartPkg.fileName, "chart.js");
      assert.strictEqual(chartPkg.urlPath, "/assets/vendor/chart.js");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("getCompletions provides runtime package completions inside gDom.loadPackage() with performance < 50ms", () => {
    runtimePackageRegistry.clear();
    runtimePackageRegistry.set({
      relativePath: "js/motion.js",
      absolutePath: "/app/public/assets/js/motion.js",
      fileName: "motion.js",
      urlPath: "/assets/js/motion.js",
    });
    runtimePackageRegistry.set({
      relativePath: "js/analytics.js",
      absolutePath: "/app/public/assets/js/analytics.js",
      fileName: "analytics.js",
      urlPath: "/assets/js/analytics.js",
    });

    const code = `const fn = () => { gDom.loadPackage("`;
    const offset = code.length;
    const { sourceFile } = analyzeAndParseDocument("file:///test.tsx", code);
    const doc = TextDocument.create("file:///test.tsx", "typescriptreact", 1, code);

    try {
      const completionContext = {
        text: code,
        uri: "file:///test.tsx",
        offset,
        line: 0,
        character: offset,
      };
      const items = getCompletions(completionContext, doc, sourceFile, undefined);
      const motionItem = items.find((i) => i.label === "js/motion.js");
      const analyticsItem = items.find((i) => i.label === "js/analytics.js");

      assert.ok(motionItem, "Expected js/motion.js in completions");
      assert.ok(analyticsItem, "Expected js/analytics.js in completions");
      assert.strictEqual(motionItem.insertText, "js/motion.js");

      // Performance test: ensure fast completion resolution
      const start = Date.now();
      for (let i = 0; i < 50; i++) {
        getCompletions(completionContext, doc, sourceFile, undefined);
      }
      const duration = Date.now() - start;
      const avgDuration = duration / 50;
      assert.ok(avgDuration < 50, `Average completion time ${avgDuration}ms exceeded 50ms threshold`);
    } finally {
      sourceFile.delete();
    }
  });

  test("resolveDefinition navigates to public/assets/js/motion.js", async () => {
    const tempDir = path.join(__dirname, "temp_def_pkg_test");
    const motionFile = path.join(tempDir, "public", "assets", "js", "motion.js");
    fs.mkdirSync(path.dirname(motionFile), { recursive: true });
    fs.writeFileSync(motionFile, "// motion code");

    try {
      const code = `gDom.loadPackage("js/motion.js");`;
      const { sourceFile } = analyzeAndParseDocument("file:///test.tsx", code);
      try {
        const node = sourceFile.getDescendantAtPos(code.indexOf("motion.js") + 2);
        assert.ok(node);
        const def = await resolveDefinition(node, tempDir);
        assert.ok(def);
        const targetUri = "uri" in def ? def.uri : (def as { targetUri: string }).targetUri;
        assert.strictEqual(path.resolve(targetUri), path.resolve(pathToFileURL(motionFile).toString()));
      } finally {
        sourceFile.delete();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("resolveHover displays rich markdown documentation for runtime packages", () => {
    runtimePackageRegistry.clear();
    runtimePackageRegistry.set({
      relativePath: "js/motion.js",
      absolutePath: "C:/project/public/assets/js/motion.js",
      fileName: "motion.js",
      urlPath: "/assets/js/motion.js",
    });

    const code = `gDom.loadPackage("js/motion.js");`;
    const { sourceFile } = analyzeAndParseDocument("file:///test.tsx", code);
    try {
      const node = sourceFile.getDescendantAtPos(code.indexOf("motion.js") + 2);
      assert.ok(node);
      const hover = resolveHover(node, "C:/project");
      assert.ok(hover);
      const contents = (hover.contents as { value: string }).value;
      assert.ok(contents.includes("**motion.js**"));
      assert.ok(contents.includes("*Runtime Package*"));
      assert.ok(contents.includes("/assets/js/motion.js"));
      assert.ok(contents.includes("public/assets/js/motion.js"));
    } finally {
      sourceFile.delete();
    }
  });

  test("Diagnostic rules validate runtime packages correctly", () => {
    runtimePackageRegistry.clear();
    runtimePackageRegistry.set({
      relativePath: "js/motion.js",
      absolutePath: "/app/public/assets/js/motion.js",
      fileName: "motion.js",
      urlPath: "/assets/js/motion.js",
    });

    // 1. Invalid extension (streak/packages/invalid-extension)
    const codeInvalid = `gDom.loadPackage("styles/main.css");`;
    const parseInvalid = analyzeAndParseDocument("file:///test.tsx", codeInvalid);
    try {
      const diags = packageInvalidExtensionRule.run(parseInvalid.sourceFile, parseInvalid.analysis);
      assert.strictEqual(diags.length, 1);
      assert.strictEqual(diags[0].code, "streak/packages/invalid-extension");
      assert.strictEqual(diags[0].severity, DiagnosticSeverity.Error);
    } finally {
      parseInvalid.sourceFile.delete();
    }

    // 2. Absolute path (streak/packages/absolute-path)
    const codeAbs = `gDom.loadPackage("/assets/js/motion.js");`;
    const parseAbs = analyzeAndParseDocument("file:///test.tsx", codeAbs);
    try {
      const diags = packageAbsolutePathRule.run(parseAbs.sourceFile, parseAbs.analysis);
      assert.strictEqual(diags.length, 1);
      assert.strictEqual(diags[0].code, "streak/packages/absolute-path");
      assert.strictEqual((diags[0].data as { fixedPath: string }).fixedPath, "js/motion.js");
    } finally {
      parseAbs.sourceFile.delete();
    }

    // 3. Public path (streak/packages/public-path)
    const codePub = `gDom.loadPackage("public/assets/js/motion.js");`;
    const parsePub = analyzeAndParseDocument("file:///test.tsx", codePub);
    try {
      const diags = packagePublicPathRule.run(parsePub.sourceFile, parsePub.analysis);
      assert.strictEqual(diags.length, 1);
      assert.strictEqual(diags[0].code, "streak/packages/public-path");
      assert.strictEqual((diags[0].data as { fixedPath: string }).fixedPath, "js/motion.js");
    } finally {
      parsePub.sourceFile.delete();
    }

    // 4. Not found (streak/packages/not-found)
    const codeNotFound = `gDom.loadPackage("js/missing.js");`;
    const parseNotFound = analyzeAndParseDocument("file:///test.tsx", codeNotFound);
    try {
      const diags = packageNotFoundRule.run(parseNotFound.sourceFile, parseNotFound.analysis);
      assert.strictEqual(diags.length, 1);
      assert.strictEqual(diags[0].code, "streak/packages/not-found");
      assert.strictEqual(diags[0].severity, DiagnosticSeverity.Warning);
    } finally {
      parseNotFound.sourceFile.delete();
    }

    // 5. Valid package -> 0 diagnostics
    const codeValid = `gDom.loadPackage("js/motion.js");`;
    const parseValid = analyzeAndParseDocument("file:///test.tsx", codeValid);
    try {
      const notFoundDiags = packageNotFoundRule.run(parseValid.sourceFile, parseValid.analysis);
      const absDiags = packageAbsolutePathRule.run(parseValid.sourceFile, parseValid.analysis);
      const pubDiags = packagePublicPathRule.run(parseValid.sourceFile, parseValid.analysis);
      const extDiags = packageInvalidExtensionRule.run(parseValid.sourceFile, parseValid.analysis);
      assert.strictEqual(notFoundDiags.length, 0);
      assert.strictEqual(absDiags.length, 0);
      assert.strictEqual(pubDiags.length, 0);
      assert.strictEqual(extDiags.length, 0);
    } finally {
      parseValid.sourceFile.delete();
    }
  });

  test("resolveCodeActions provides Quick Fixes for package path mistakes", () => {
    const uri = "file:///test.tsx";
    const code = `gDom.loadPackage("/assets/js/motion.js");`;
    const doc = TextDocument.create(uri, "typescriptreact", 1, code);
    const { sourceFile, analysis } = analyzeAndParseDocument(uri, code);

    try {
      const diags = packageAbsolutePathRule.run(sourceFile, analysis);
      const lspDiag: Diagnostic = {
        code: diags[0].code,
        message: diags[0].message,
        range: diags[0].range,
        severity: diags[0].severity,
        source: diags[0].source,
        data: diags[0].data,
      };

      const actions = resolveCodeActions([lspDiag], doc, sourceFile);
      assert.strictEqual(actions.length, 1);
      assert.ok(actions[0].title.includes("js/motion.js"));
      const edit = actions[0].edit?.changes?.[uri];
      assert.ok(edit && edit.length > 0);
      assert.strictEqual(edit[0].newText, '"js/motion.js"');
    } finally {
      sourceFile.delete();
    }
  });

  test("findPackageReferences discovers all loadPackage call sites across the project", () => {
    const tempDir = path.join(__dirname, "temp_pkg_refs_test");
    const srcDir = path.join(tempDir, "src", "widgets");
    const assetsDir = path.join(tempDir, "public", "assets", "js");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });

    try {
      fs.writeFileSync(path.join(assetsDir, "motion.js"), "// motion asset");
      fs.writeFileSync(
        path.join(srcDir, "WidgetA.tsx"),
        `export default function WidgetA() {\n  gDom.loadPackage("js/motion.js");\n}\n`,
      );
      fs.writeFileSync(
        path.join(srcDir, "WidgetB.tsx"),
        `export default function WidgetB() {\n  loadPackage("js/motion.js");\n}\n`,
      );

      const refs = findPackageReferences("js/motion.js", tempDir, true);
      // 2 call sites + 1 declaration
      assert.strictEqual(refs.length, 3);
      const uriA = refs.find((r) => r.uri.includes("WidgetA.tsx"));
      const uriB = refs.find((r) => r.uri.includes("WidgetB.tsx"));
      const uriDecl = refs.find((r) => r.uri.includes("motion.js"));

      assert.ok(uriA, "WidgetA should be found");
      assert.ok(uriB, "WidgetB should be found");
      assert.ok(uriDecl, "Declaration should be found");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("resolvePackageNameFromContext identifies package from AST node or public asset URI", () => {
    const code = `gDom.loadPackage("js/motion.js");`;
    const { sourceFile } = analyzeAndParseDocument("file:///test.tsx", code);
    try {
      const node = sourceFile.getDescendantAtPos(code.indexOf("motion.js") + 2);
      assert.ok(node);
      const pkgName = resolvePackageNameFromContext(node, "file:///test.tsx");
      assert.strictEqual(pkgName, "js/motion.js");

      // Direct public asset URI test
      const assetUri = "file:///app/public/assets/js/chart.js";
      const fromUri = resolvePackageNameFromContext(undefined, assetUri);
      assert.strictEqual(fromUri, "js/chart.js");
    } finally {
      sourceFile.delete();
    }
  });
});

