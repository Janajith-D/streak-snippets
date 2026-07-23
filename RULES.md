# Streak Engine Rule Catalog

This document provides detailed SonarQube-style descriptions, rationale, and compliant/non-compliant code examples for all diagnostic rules enforced by the **Streak Engine** Language Server.

---

## Catalog Overview

| Rule Key | Name / Category | Default Severity | Description |
|---|---|---|---|
| [`streak:S101`](#streaks101---widgetplaceholder-missing-id-attribute) | Widget Component | Error | `<WidgetPlaceholder>` elements must have a non-empty `id` attribute. |
| [`streak:S102`](#streaks102---widgetplaceholder-missing-type-attribute) | Widget Component | Error | `<WidgetPlaceholder>` elements must have a non-empty `type` attribute. |
| [`streak:S201`](#streaks201---data-handler-missing-status-property) | Data Handler | Warning | Data handler functions must return an object containing a `status` property. |
| [`streak:S301`](#streaks301---missing-default-export) | Framework Syntax | Warning | Framework pages, components, and handlers must provide a default export. |

---

## Rule Details

### `streak:S101` — `<WidgetPlaceholder>` Missing `id` Attribute

- **Category**: Widget Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description

The `WidgetPlaceholder` component is used by the Streak static site generator to identify where dynamic widgets should be injected into the layout. Each placeholder must define a unique `id` attribute matching the widget ID in the workspace sitemap.

#### Non-compliant Code Example ❌

```tsx
import { WidgetPlaceholder } from "streak-forge/components";

export default function Page() {
  return (
    <div>
      <WidgetPlaceholder type="banner" /> {/* ❌ Missing 'id' attribute */}
    </div>
  );
}
```

#### Compliant Code Example ✅

```tsx
import { WidgetPlaceholder } from "streak-forge/components";

export default function Page() {
  return (
    <div>
      <WidgetPlaceholder id="hero-banner" type="banner" /> {/* ✅ Valid 'id' attribute */}
    </div>
  );
}
```

---

### `streak:S102` — `<WidgetPlaceholder>` Missing `type` Attribute

- **Category**: Widget Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description

The `WidgetPlaceholder` component requires a `type` attribute to determine which widget renderer or layout definition to load during rendering. Omitting the `type` attribute prevents the framework from resolving the correct component.

#### Non-compliant Code Example ❌

```tsx
import { WidgetPlaceholder } from "streak-forge/components";

export default function Page() {
  return (
    <div>
      <WidgetPlaceholder id="sidebar-widget" /> {/* ❌ Missing 'type' attribute */}
    </div>
  );
}
```

#### Compliant Code Example ✅

```tsx
import { WidgetPlaceholder } from "streak-forge/components";

export default function Page() {
  return (
    <div>
      <WidgetPlaceholder id="sidebar-widget" type="sidebar" /> {/* ✅ Valid 'type' attribute */}
    </div>
  );
}
```

---

### `streak:S201` — Data Handler Missing `status` Property

- **Category**: Data Handler
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description

Data handler functions (located in `.ts` files or named `*DataHandler.ts`) fetch and format render data for pages and widgets. The Streak framework requires handlers to return an object with a numeric `status` property (e.g., `status: 200`) to signal render readiness and error states to the build pipeline.

#### Non-compliant Code Example ❌

```ts
// src/handlers/HomeDataHandler.ts
const getHomeData = async () => {
  return {
    PageHead: {
      title: "Home",
    },
  }; // ❌ Missing 'status' property
};

export default getHomeData;
```

#### Compliant Code Example ✅

```ts
// src/handlers/HomeDataHandler.ts
const getHomeData = async () => {
  return {
    status: 200, // ✅ Signals render success to Streak renderer
    PageHead: {
      title: "Home",
    },
  };
};

export default getHomeData;
```

---

### `streak:S301` — Missing Default Export

- **Category**: Framework Syntax
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description

Streak routes, pages, layouts, and data handlers rely on default exports (`export default`) for automatic component discovery and routing. Files without a default export cannot be instantiated by the Streak router.

#### Non-compliant Code Example ❌

```tsx
// src/pages/About.tsx
export function AboutPage() {
  return <h1>About Us</h1>;
} // ❌ Missing 'export default'
```

#### Compliant Code Example ✅

```tsx
// src/pages/About.tsx
export function AboutPage() {
  return <h1>About Us</h1>;
}

export default AboutPage; // ✅ Includes 'export default'
```

---

## Severity Configuration

Rules can be configured or disabled in your VS Code workspace settings (`.vscode/settings.json`):

```json
{
  "streak.diagnostics.enable": true,
  "streak.rules.widgetPlaceholderProps.severity": "error",
  "streak.rules.dataHandlerStatus.severity": "warning",
  "streak.rules.missingDefaultExport.severity": "warning"
}
```
