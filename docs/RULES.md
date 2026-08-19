# Streak Engine Rule Catalog

This document provides detailed SonarQube-style descriptions, rationale, and compliant/non-compliant code examples for all diagnostic rules enforced by the **Streak Engine** Language Server.

---

## Catalog Overview

| Rule Key | Name / Category | Default Severity | Description |
|---|---|---|---|
| [`streak:S101`](#streaks101---widgetplaceholder-missing-id-attribute) | Widget Component | Error | `<WidgetPlaceholder>` elements must have a non-empty `id` attribute. |
| [`streak:S102`](#streaks102---widgetplaceholder-missing-type-attribute) | Widget Component | Error | `<WidgetPlaceholder>` elements must have a non-empty `type` attribute. |
| [`streak:S201`](#streaks201---data-handler-missing-status-property) | Data Handler | Warning | Data handler functions must return an object containing a `status` property. |
| [`streak:S202`](#streaks202---data-handler-must-be-async) | Data Handler | Error | Data handlers must default-export an `async` function. |
| [`streak:S203`](#streaks203---invalid-handler-status) | Data Handler | Warning | Data handler `status` should be a valid numeric HTTP status code (100–599). |
| [`streak:S301`](#streaks301---missing-default-export) | Framework Syntax | Warning | Framework pages, components, and handlers must provide a default export. |
| [`streak:S302`](#streaks302---react-hooks-not-allowed) | Widget Component | Error | Streak static widgets must not use React runtime hooks (`useState`, `useEffect`, etc.). |
| [`streak:S303`](#streaks303---unsafe-widget-data-access) | Widget Component | Error | Widget data must be accessed safely because `props.data` may be undefined. |
| [`streak:S304`](#streaks304---invalid-widget-props-contract) | Widget Component | Warning | Widget props should define `data` as optional (`data?: T`). |
| [`streak:S401`](#streaks401---script-closure-capture) | Script Component | Error | `<Script>` callbacks must not capture outer-scope variables; use `options`. |
| [`streak:S402`](#streaks402---invalid-script-signature) | Script Component | Error | `<Script>` callback must follow `(gDom, options) => void`. |
| [`streak:S403`](#streaks403---import-inside-script) | Script Component | Error | Browser-side Script code must not contain or depend on module imports or `require()`. |
| [`streak:S404`](#streaks404---async-script-callback) | Script Component | Error | `<Script>` callbacks must not be declared `async`. |
| [`streak:S501`](#streaks501---invalid-dynamic-component-id) | Dynamic Component | Error | `<Dynamic>` must have a static, non-empty `id`. |
| [`streak:S601`](#streaks601---duplicated-widget) | Workspace Registry | Error | Custom widget names must be unique across all widget source files. |
| [`streak:S602`](#streaks602---component-nesting) | Jsx Nesting | Error | Nested `<Script>` tags or `<WidgetPlaceholder>` inside scripts are not allowed. |
| [`streak:S603`](#streaks603---script-structure) | Script Component | Error | `<Script>` tags must contain exactly one child wrapping the client callback. |
| [`streak:S701`](#streaks701---allowed-imports) | Imports Control | Warning | Imports must belong to the approved allowed imports whitelist. |
| [`streak:S702`](#streaks702---forbidden-patterns) | Security / Code Smell | Error | Banned code patterns matched by forbidden regular expressions. |
| [`streak:S801`](#streaks801---widget-filename-matches-component) | Widget Component | Error | Widget filename and declared default component name must match. |
| [`streak:S901`](#streaks901---duplicate-route-detected) | Sitemap / Routes | Error | Sitemap page routes (`url` values) must be unique. |
| [`streak:S902`](#streaks902---referenced-widget-does-not-exist) | Sitemap / Registry | Error | Referenced widget `type` in the sitemap must exist as a source file. |
| [`streak:S903`](#streaks903---referenced-handler-does-not-exist) | Sitemap / Registry | Warning | Referenced sitemap page `dataHandler` must exist as a `.ts` source file in `src/handler/` or `src/handlers/`. |
| [`streak:S904`](#streaks904---dead-widget-detected) | Workspace Registry | Warning | Custom widgets should be referenced by at least one sitemap page. |
| [`streak:S905`](#streaks905---duplicate-renderid-detected) | Sitemap / Registry | Error | Sitemap renderConfig `renderId` values must be unique. |
| [`streak:S906`](#streaks906---referenced-layout-does-not-exist) | Sitemap / Registry | Warning | Referenced sitemap page `rootLayout` must exist as a `.tsx` source file in `src/layout/` or `src/layouts/`. |

---

## Rule Details

### `streak:S101` — `<WidgetPlaceholder>` Missing `id` Attribute

- **Category**: Widget Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
The `WidgetPlaceholder` component requires a unique `id` attribute matching the widget ID in the sitemap.

#### Non-compliant Code ❌
```tsx
<WidgetPlaceholder type="banner" />
```

#### Compliant Code ✅
```tsx
<WidgetPlaceholder id="hero-banner" type="banner" />
```

---

### `streak:S102` — `<WidgetPlaceholder>` Missing `type` Attribute

- **Category**: Widget Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
The `WidgetPlaceholder` component requires a `type` attribute determining which widget renderer to load.

#### Non-compliant Code ❌
```tsx
<WidgetPlaceholder id="sidebar-widget" />
```

#### Compliant Code ✅
```tsx
<WidgetPlaceholder id="sidebar-widget" type="sidebar" />
```

---

### `streak:S201` — Data Handler Missing `status` Property

- **Category**: Data Handler
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
Data handlers must return an object containing a `status` property to signal render outcome to the framework.

#### Non-compliant Code ❌
```ts
const getData = async () => {
  return { PageHead: { title: "Hello" } };
};
export default getData;
```

#### Compliant Code ✅
```ts
const getData = async () => {
  return { status: 200, PageHead: { title: "Hello" } };
};
export default getData;
```

---

### `streak:S202` — Data Handler Must Be Async

- **Category**: Data Handler
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Data handlers fetch asynchronous build/render data and must default-export an `async` function.

#### Non-compliant Code ❌
```ts
const getData = () => {
  return { status: 200 };
};
export default getData;
```

#### Compliant Code ✅
```ts
const getData = async () => {
  return { status: 200 };
};
export default getData;
```

---

### `streak:S203` — Invalid Handler Status

- **Category**: Data Handler
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
The `status` returned by a data handler should be a valid numeric HTTP status code (100–599, e.g. 200, 404, 500).

#### Non-compliant Code ❌
```ts
const getData = async () => {
  return { status: 999 };
};
export default getData;
```

#### Compliant Code ✅
```ts
const getData = async () => {
  return { status: 200 };
};
export default getData;
```

---

### `streak:S301` — Missing Default Export

- **Category**: Framework Syntax
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
Streak pages, components, and handlers rely on default exports for automatic routing and discovery.

#### Non-compliant Code ❌
```tsx
export function Page() { return <h1>Page</h1>; }
```

#### Compliant Code ✅
```tsx
export function Page() { return <h1>Page</h1>; }
export default Page;
```

---

### `streak:S302` — React Hooks Not Allowed

- **Category**: Widget Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Streak widgets are static build-time components. React runtime hooks (`useState`, `useEffect`, `useRef`, etc.) are not allowed.

#### Non-compliant Code ❌
```tsx
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

#### Compliant Code ✅
```tsx
export default function Counter({ data }: { data?: { initialCount: number } }) {
  return <button>{data?.initialCount ?? 0}</button>;
}
```

---

### `streak:S303` — Unsafe Widget Data Access

- **Category**: Widget Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Widget `props.data` may be undefined if data handlers fail or return partial data. Access data properties safely using optional chaining.

#### Non-compliant Code ❌
```tsx
export default function Widget(props: { data?: { title: string } }) {
  return <h1>{props.data.title}</h1>;
}
```

#### Compliant Code ✅
```tsx
export default function Widget(props: { data?: { title: string } }) {
  return <h1>{props.data?.title}</h1>;
}
```

---

### `streak:S304` — Invalid Widget Props Contract

- **Category**: Widget Component
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
Widget props interfaces must define `data` as optional (`data?: T`) since data hydration is optional during rendering.

#### Non-compliant Code ❌
```tsx
interface WidgetProps {
  data: MyWidgetData;
}
```

#### Compliant Code ✅
```tsx
interface WidgetProps {
  data?: MyWidgetData;
}
```

---

### `streak:S401` — Script Closure Capture

- **Category**: Script Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
`<Script>` callbacks run isolated in the browser DOM. They cannot capture outer component closure variables. Pass data via the `options` prop instead.

#### Non-compliant Code ❌
```tsx
export default function Banner({ theme }: { theme: string }) {
  return (
    <Script>
      {(gDom) => {
        gDom.style.color = theme; // ❌ Captures outer 'theme'
      }}
    </Script>
  );
}
```

#### Compliant Code ✅
```tsx
export default function Banner({ theme }: { theme: string }) {
  return (
    <Script options={{ theme }}>
      {(gDom, options) => {
        gDom.style.color = options.theme; // ✅ Accessed safely via options
      }}
    </Script>
  );
}
```

---

### `streak:S402` — Invalid Script Signature

- **Category**: Script Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
The callback function passed to `<Script>` must accept at most two parameters: `(gDom, options) => void`.

#### Non-compliant Code ❌
```tsx
<Script>{(gDom, options, extraParam) => {}}</Script>
```

#### Compliant Code ✅
```tsx
<Script>{(gDom, options) => {}}</Script>
```

---

### `streak:S403` — Import Inside Script

- **Category**: Script Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Browser-side `<Script>` callbacks run directly in the DOM runtime and cannot contain module imports (`import()`) or `require()` calls.

#### Non-compliant Code ❌
```tsx
<Script>
  {(gDom) => {
    const utils = require("./utils");
  }}
</Script>
```

#### Compliant Code ✅
```tsx
<Script>
  {(gDom) => {
    gDom.classList.add("active");
  }}
</Script>
```

---

### `streak:S404` — Async Script Callback

- **Category**: Script Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
`<Script>` callbacks are executed synchronously during DOM initialization and cannot be declared `async`.

#### Non-compliant Code ❌
```tsx
<Script>
  {async (gDom) => {
    await fetch("/api");
  }}
</Script>
```

#### Compliant Code ✅
```tsx
<Script>
  {(gDom) => {
    fetch("/api");
  }}
</Script>
```

---

### `streak:S405` — Script Required ID

- **Category**: Script Component
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
`<Script>` components must specify a non-empty `id` attribute. This ID is used by dynamic triggers to coordinate initialization, scripting execution, and styling.

#### Non-compliant Code ❌
```tsx
<Script>
  {(gDom) => {
    console.log("no id");
  }}
</Script>
```

#### Compliant Code ✅
```tsx
<Script id="my-loader">
  {(gDom) => {
    console.log("loader initialized");
  }}
</Script>
```

---

### `streak:S501` — Invalid Dynamic Component ID

- **Category**: Dynamic Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
`<Dynamic>` components require a static, non-empty `id` attribute to identify the dynamic bundle at runtime.

#### Non-compliant Code ❌
```tsx
<Dynamic />
```

#### Compliant Code ✅
```tsx
<Dynamic id="interactive-chart" />
```

---

### `streak:S601` — Duplicated Widget

- **Category**: Workspace Registry
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
All widget components declared under `src/widgets/` must have unique default-exported names across the workspace registry.

#### Non-compliant Code ❌
```tsx
// file: src/widgets/ProductCard.tsx
export default function ProductCard() { return <div>Card</div>; }

// file: src/widgets/nested/ProductCard.tsx
export default function ProductCard() { return <div>Nested</div>; }
```

#### Compliant Code ✅
```tsx
// file: src/widgets/ProductCard.tsx
export default function ProductCard() { return <div>Card</div>; }

// file: src/widgets/nested/ProductListItem.tsx
export default function ProductListItem() { return <div>Item</div>; }
```

---

### `streak:S602` — Component Nesting

- **Category**: Jsx Nesting
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Ensures component nesting constraints are respected. Standard Streak components like `<WidgetPlaceholder>` cannot be nested inside browser-side `<Script>` callback functions, and `<Script>` tags cannot be nested inside other `<Script>` tags.

#### Non-compliant Code ❌
```tsx
<Script id="my-sc">
  {(gDom) => (
    <WidgetPlaceholder id="widget-in-script" type="MyWidget" />
  )}
</Script>
```

#### Compliant Code ✅
```tsx
<>
  <WidgetPlaceholder id="my-widget" type="MyWidget" />
  <Script id="my-sc">
    {(gDom) => {
      console.log("Script executed separately");
    }}
  </Script>
</>
```

---

### `streak:S603` — Script Structure

- **Category**: Script Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
`<Script>` components must contain exactly one child element wrapped inside a JSX expression executing a client-side arrow function or function expression.

#### Non-compliant Code ❌
```tsx
<Script id="my-script">
  <div>Invalid child</div>
</Script>
```

#### Compliant Code ✅
```tsx
<Script id="my-script">
  {(gDom) => {
    console.log("Correct execution callback");
  }}
</Script>
```

---

### `streak:S701` — Allowed Imports

- **Category**: Imports Control
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
Restricts file imports to a whitelisted set of approved modules (e.g. `streak-forge/components`, `react`). Unapproved module imports are flagged as warnings.

#### Non-compliant Code ❌
```tsx
import { someFunc } from "lodash";
```

#### Compliant Code ✅
```tsx
import { useState } from "react";
import { WidgetPlaceholder } from "streak-forge/components";
```

---

### `streak:S702` — Forbidden Patterns

- **Category**: Security / Code Smell
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Scans code content and flags matches of restricted regular expression code structures (e.g. `eval(`, `setTimeout(`) specified in your workspace rules configurations.

#### Non-compliant Code ❌
```tsx
const data = eval("x + y");
```

#### Compliant Code ✅
```tsx
const data = x + y;
```

---

### `streak:S801` — Widget Filename Matches Component

- **Category**: Widget Component
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Ensures widget component name matches its filename to guarantee correct automatic mapping and registration.

#### Non-compliant Code ❌
`HelloBanner.tsx`
```tsx
const HeroBanner = () => {
  return <div>Hello</div>;
};
export default HeroBanner;
```

#### Compliant Code ✅
`HelloBanner.tsx`
```tsx
const HelloBanner = () => {
  return <div>Hello</div>;
};
export default HelloBanner;
```

---

### `streak:S901` — Duplicate Route Detected

- **Category**: Sitemap / Routes
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Ensures sitemap page routes (`url` values) are unique across the project. Duplicate routes conflict at runtime.

#### Non-compliant Code ❌
```json
[
  { "url": "/about", "handler": "about" },
  { "url": "/about", "handler": "other" }
]
```

#### Compliant Code ✅
```json
[
  { "url": "/about", "handler": "about" },
  { "url": "/contact", "handler": "contact" }
]
```

---

### `streak:S902` — Referenced Widget Does Not Exist

- **Category**: Sitemap / Registry
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Ensures that all widget `type` values declared inside the sitemap match an existing custom widget source file inside `src/widgets/`.

#### Non-compliant Code ❌
```json
{
  "type": "NonExistentBanner"
}
```

#### Compliant Code ✅
```json
{
  "type": "HelloBanner"
}
```

---

### `streak:S903` — Referenced Handler Does Not Exist

- **Category**: Sitemap / Registry
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
Ensures that all page `dataHandler` (or `handler`) properties declared inside the sitemap match an existing `.ts` data handler source file inside `src/handler/` or `src/handlers/`.

#### Non-compliant Code ❌
```json
{
  "dataHandler": "missing-handler"
}
```

#### Compliant Code ✅
```json
{
  "dataHandler": "HomeDataHandler"
}
```

---

### `streak:S904` — Dead Widget Detected

- **Category**: Workspace Registry
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
Flags custom widgets inside `src/widgets/` that are not referenced by any page route inside `streak.sitemap.json`.

#### Non-compliant Code ❌
`LegacyWidget.tsx` (never declared in sitemap page routes)
```tsx
export default function LegacyWidget() { ... }
```

#### Compliant Code ✅
`HelloBanner.tsx` (referenced inside the sitemap widgets configuration list)
```tsx
export default function HelloBanner() { ... }
```

---

### `streak:S905` — Duplicate renderId Detected

- **Category**: Sitemap / Registry
- **Severity**: `Error`
- **Source**: `Streak Engine`

#### Description
Ensures sitemap page `renderId` values (inside `renderConfig` or top-level) are unique across all page configurations.

#### Non-compliant Code ❌
```json
[
  { "url": "/home", "renderConfig": { "renderId": "homeRenderId" } },
  { "url": "/dashboard", "renderConfig": { "renderId": "homeRenderId" } }
]
```

#### Compliant Code ✅
```json
[
  { "url": "/home", "renderConfig": { "renderId": "homeRenderId" } },
  { "url": "/dashboard", "renderConfig": { "renderId": "dashboardRenderId" } }
]
```

---

### `streak:S906` — Referenced Layout Does Not Exist

- **Category**: Sitemap / Registry
- **Severity**: `Warning`
- **Source**: `Streak Engine`

#### Description
Ensures that all page `rootLayout` (or `layout`) properties declared inside the sitemap match an existing `.tsx` layout source file inside `src/layout/` or `src/layouts/`.

#### Non-compliant Code ❌
```json
{
  "rootLayout": "MissingLayout"
}
```

#### Compliant Code ✅
```json
{
  "rootLayout": "MainLayout"
}
```



