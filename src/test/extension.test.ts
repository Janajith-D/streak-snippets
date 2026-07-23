import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Sample test", () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
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
