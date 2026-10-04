---
trigger: glob
description: Performance, memory management, and AST lifecycles in Streak Snippets
globs: "src/server/**/*.ts"
---

# Performance & Memory Management

For node traversal patterns, consult the guide at @.agents/skills/ast-query-guide/SKILL.md.

## 1. AST Lifecycle & Memory Leak Prevention

- **Single Shared ts-morph Project**: Reuse the shared `Project` instance (`scanProject` or `globalProject`) rather than creating a new `new Project()` on every request or scan.
- **Explicit SourceFile Deletion**: Any transient `SourceFile` created dynamically via `project.createSourceFile()` MUST be explicitly cleaned up with `sourceFile.delete()` inside a `try ... finally` block.
- **Never Retain AST Nodes Across Documents**: AST nodes are invalidated when their parent document changes. Do not store AST nodes in long-lived caches; store extracted metadata (e.g. `WidgetProp`, `SitemapPage`) in registries located at @src/server/registry/.

## 2. Incremental Parsing & Workspace Scaling

- **Keystroke Optimization**: Never run `scanWorkspace()` during text change events (`onDidChangeContent`). Only re-validate the current document and call `scanFile(filePath)` on the specific widget/handler file modified.
- **Scalability Targets**:
  - Sitemap processing: Must validate 10,000+ page definitions in `< 1000ms`.
  - Widget registry: Support 200+ widgets with instant in-memory lookup (`O(1)` map access).
  - High-frequency event checking: Keep regex and AST traversal minimal.
