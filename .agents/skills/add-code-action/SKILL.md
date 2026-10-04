---
name: add-code-action
description: Step-by-step workflow for implementing a new Quick Fix (Code Action) for a Streak Engine diagnostic rule
---

# Adding a Quick Fix (Code Action) Provider

Follow this workflow to implement an automated Quick Fix / Code Action for a Streak Engine diagnostic rule (`streak:Sxxx`). Providers reside in @src/server/codeaction/provider.ts and must adhere to @.agents/rules/06-lsp-features.md.

## 1. Identify Target Diagnostic & Fix Strategy

- Review the diagnostic rule definition in @src/server/rules/ and catalog entry in @docs/RULES.md.
- Determine whether the fix is:
  - **Inline Attribute Insertion**: E.g. adding missing `id` or `type` (use `buildInlineAttrInsertAction`).
  - **Text Replacement / Node Wrap**: Replacing invalid syntax or wrapping a node with a valid construct.
  - **Import Injection**: Adding missing framework imports.

## 2. Implement the Action Builder Function

In @src/server/codeaction/provider.ts:

```typescript
function buildMyRuleAction(diag: Diagnostic, uri: string): CodeAction {
  return {
    title: "Fix description for lightbulb menu",
    kind: CodeActionKind.QuickFix,
    diagnostics: [diag],
    isPreferred: true,
    edit: {
      changes: {
        [uri]: [
          {
            range: diag.range,
            newText: "replacement text",
          },
        ],
      },
    },
  };
}
```

For simple attribute insertions, reuse the shared `buildInlineAttrInsertAction`:
```typescript
function buildMyAttrAction(diag: Diagnostic, uri: string): CodeAction {
  return buildInlineAttrInsertAction(
    diag,
    uri,
    "Add attribute",
    offsetFromStart,
    ' attr="value"',
  );
}
```

## 3. Register Handler in `provideCodeActions`

In @src/server/codeaction/provider.ts, map the diagnostic code inside `provideCodeActions`:

```typescript
for (const diag of context.diagnostics) {
  if (diag.source !== "Streak Engine") {
    continue;
  }
  const code = String(diag.code);
  switch (code) {
    case "streak:Sxxx":
      actions.push(buildMyRuleAction(diag, uri));
      break;
    // ...
  }
}
```

## 4. Add Integration Tests

In @src/test/extension.test.ts:
1. Open a document that triggers the diagnostic.
2. Request code actions at the diagnostic range using `vscode.commands.executeCommand("vscode.executeCodeActionProvider", uri, range)`.
3. Assert that the returned action title and kind match expectations (`CodeActionKind.QuickFix`).
4. Optionally execute the workspace edit and verify that document diagnostics resolve.

## 5. Verify

Run the verification sequence from @.agents/skills/run-and-verify/SKILL.md:
```bash
cmd.exe /c "npm run compile-tests && npm run compile && npm run lint && npm test"
```
