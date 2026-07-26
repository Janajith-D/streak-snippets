import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { analyzeAndParseDocument } from "../server/parser/analyzer";
import { runRules } from "../server/rules/runner";
import { widgetPlaceholderRule } from "../server/rules/widgetPlaceholderRule";
import { dataHandlerStatusRule } from "../server/rules/dataHandlerStatusRule";
import { missingDefaultExportRule } from "../server/rules/missingDefaultExportRule";
import { dataHandlerAsyncRule } from "../server/rules/dataHandlerAsyncRule";
import { dataHandlerStatusValueRule } from "../server/rules/dataHandlerStatusValueRule";
import { reactHooksNotAllowedRule } from "../server/rules/reactHooksNotAllowedRule";
import { unsafeWidgetDataAccessRule } from "../server/rules/unsafeWidgetDataAccessRule";
import { invalidWidgetPropsContractRule } from "../server/rules/invalidWidgetPropsContractRule";
import {
  scriptClosureCaptureRule,
  invalidScriptSignatureRule,
  importInsideScriptRule,
  asyncScriptCallbackRule,
} from "../server/rules/scriptRules";
import { dynamicComponentIdRule } from "../server/rules/dynamicComponentIdRule";

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

  test("WidgetPlaceholder rule flags missing id and type attributes with streak:S101 and streak:S102", () => {
    const code = `
      import { WidgetPlaceholder } from "streak-forge/components";
      
      export default function Component() {
        return <WidgetPlaceholder />;
      }
    `;
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/Comp.tsx", code);
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/HomeDataHandler.ts", code);
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
    const { analysis, sourceFile } = analyzeAndParseDocument("file:///test/HomeDataHandler.ts", code);
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
    assert.ok(lspDiagnostics.length >= 3);
  });

  // ── Snippet file validation ────────────────────────────────────────

  const snippetDir = path.resolve(__dirname, "../../snippets");

  const snippetFiles = [
    "streak.snippets.ts.json",
    "streak.snippets.tsx.json",
  ];

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
      const parsed: Record<
        string,
        { prefix?: unknown; body?: unknown; description?: unknown }
      > = JSON.parse(content);

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
          typeof entry.description === "string" &&
            entry.description.length > 0,
          `Snippet "${name}" in ${file} must have a non-empty string "description"`,
        );
      }
    });

    test(`Snippet file ${file} has no duplicate prefixes`, () => {
      const filePath = path.join(snippetDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed: Record<string, { prefix: string }> = JSON.parse(content);

      const prefixes = Object.values(parsed).map((e) => e.prefix);
      const duplicates = prefixes.filter(
        (p, i) => prefixes.indexOf(p) !== i,
      );
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
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
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
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
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

  test("package.json has command contributions", () => {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const commands: { command: string }[] = pkg.contributes?.commands ?? [];
    const ids = commands.map((c) => c.command);
    assert.ok(
      ids.includes("streak-snippets.showSnippets"),
      "Must register streak-snippets.showSnippets command",
    );
    assert.ok(
      ids.includes("streak-snippets.createComponent"),
      "Must register streak-snippets.createComponent command",
    );
  });
});
