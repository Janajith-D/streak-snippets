---
name: ast-query-guide
description: Quick reference and best practices for querying and traversing ts-morph AST nodes in Streak rules
---

# ts-morph AST Query Reference for Streak Rules

Use this reference when writing or updating static analysis rules in `src/server/rules/`.

## 1. Document Parsing & Analysis

Rules receive a `SourceFile` and a `DocumentAnalysis` from `analyzeAndParseDocument`:

```typescript
import { Node, type SourceFile, SyntaxKind } from "ts-morph";
import type { StreakRule, DocumentAnalysis } from "./types";
import { Range, Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
```

## 2. Common Query Patterns

### Finding JSX Elements & Attributes
```typescript
// Query all opening JSX elements
const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
const jsxSelfClosing = sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);

for (const element of [...jsxElements, ...jsxSelfClosing]) {
  const tagName = element.getTagNameNode().getText();
  if (tagName === "WidgetPlaceholder") {
    // Get attribute by name
    const idAttr = element.getAttribute("id");
    const typeAttr = element.getAttribute("type");
    
    if (idAttr && Node.isJsxAttribute(idAttr)) {
      const initializer = idAttr.getInitializer();
      if (initializer && Node.isStringLiteral(initializer)) {
        const value = initializer.getLiteralValue();
      }
    }
  }
}
```

### Inspecting Default Exports (Data Handlers)
```typescript
import { getDefaultExportedHandler } from "./dataHandlerUtils";

const handler = getDefaultExportedHandler(sourceFile);
if (handler) {
  // Check if async
  const isAsync = handler.isAsync();
  
  // Inspect return statements
  const returnStatements = handler.getDescendantsOfKind(SyntaxKind.ReturnStatement);
  for (const ret of returnStatements) {
    const expr = ret.getExpression();
    if (expr && Node.isObjectLiteralExpression(expr)) {
      const properties = expr.getProperties();
      // Inspect keys
    }
  }
}
```

### Converting AST Node to LSP Range
```typescript
function getNodeRange(sourceFile: SourceFile, node: Node): Range {
  const start = sourceFile.getLineAndColumnAtPos(node.getStart());
  const end = sourceFile.getLineAndColumnAtPos(node.getEnd());
  return Range.create(
    start.line - 1,
    start.column - 1,
    end.line - 1,
    end.column - 1,
  );
}
```

## 3. Critical Safety Rules
- **Never modify AST nodes in diagnostic rules**: Rules must be strictly read-only static analyzers.
- **Never cache AST nodes across edits**: Nodes become invalid when text changes.
- **Use Node type guards**: Always use `Node.isStringLiteral(node)`, `Node.isIdentifier(node)`, etc., before calling node-specific methods.
