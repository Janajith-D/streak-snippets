// ── JSON Location Parser ──────────────────────────────────────────────────────

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONNode[]
  | Record<string, { keyNode: JSONNode; valNode: JSONNode }>;

export interface JSONNode {
  type: "string" | "number" | "literal" | "array" | "object";
  value: JSONValue;
  start: number;
  end: number;
}

export class JSONLocationParser {
  private pos = 0;
  constructor(private readonly text: string) {}

  private skipWhitespace() {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) {
      this.pos++;
    }
  }

  public parse(): JSONNode | null {
    this.skipWhitespace();
    if (this.pos >= this.text.length) {
      return null;
    }

    const start = this.pos;
    const char = this.text[this.pos];

    if (char === "{") {
      return this.parseObject();
    } else if (char === "[") {
      return this.parseArray();
    } else if (char === '"') {
      return this.parseString();
    } else if (/[0-9-]/.test(char)) {
      return this.parseNumber();
    } else if (this.text.startsWith("true", this.pos)) {
      this.pos += 4;
      return { type: "literal", value: true, start, end: this.pos };
    } else if (this.text.startsWith("false", this.pos)) {
      this.pos += 5;
      return { type: "literal", value: false, start, end: this.pos };
    } else if (this.text.startsWith("null", this.pos)) {
      this.pos += 4;
      return { type: "literal", value: null, start, end: this.pos };
    }

    // Recover from unexpected characters
    this.pos++;
    return null;
  }

  private parseString(): JSONNode {
    const start = this.pos;
    this.pos++; // skip '"'
    let value = "";
    while (this.pos < this.text.length && this.text[this.pos] !== '"') {
      if (this.text[this.pos] === "\\") {
        this.pos++;
      }
      value += this.text[this.pos];
      this.pos++;
    }
    this.pos++; // skip '"'
    return { type: "string", value, start, end: this.pos };
  }

  private parseNumber(): JSONNode {
    const start = this.pos;
    while (this.pos < this.text.length && /[0-9.\-eE]/.test(this.text[this.pos])) {
      this.pos++;
    }
    const value = Number(this.text.substring(start, this.pos));
    return { type: "number", value, start, end: this.pos };
  }

  private parseArray(): JSONNode {
    const start = this.pos;
    this.pos++; // skip '['
    const elements: JSONNode[] = [];
    while (this.pos < this.text.length) {
      this.skipWhitespace();
      if (this.text[this.pos] === "]") {
        this.pos++;
        break;
      }
      const el = this.parse();
      if (el) {
        elements.push(el);
      }
      this.skipWhitespace();
      if (this.text[this.pos] === ",") {
        this.pos++;
      }
    }
    return { type: "array", value: elements, start, end: this.pos };
  }

  private parseObject(): JSONNode {
    const start = this.pos;
    this.pos++; // skip '{'
    const properties: Record<string, { keyNode: JSONNode; valNode: JSONNode }> = {};
    while (this.pos < this.text.length) {
      this.skipWhitespace();
      if (this.text[this.pos] === "}") {
        this.pos++;
        break;
      }
      const keyNode = this.parse();
      this.skipWhitespace();
      if (this.text[this.pos] === ":") {
        this.pos++;
      }
      const valNode = this.parse();
      if (keyNode?.type === "string" && valNode) {
        properties[keyNode.value as string] = { keyNode, valNode };
      }
      this.skipWhitespace();
      if (this.text[this.pos] === ",") {
        this.pos++;
      }
    }
    return { type: "object", value: properties, start, end: this.pos };
  }
}

// ── Sitemap Registry ──────────────────────────────────────────────────────────

export interface SitemapPageWidget {
  type: string;
  start: number;
  end: number;
}

export interface SitemapPage {
  url?: string;
  urlStart?: number;
  urlEnd?: number;
  renderId?: string;
  renderIdStart?: number;
  renderIdEnd?: number;
  handler?: string;
  handlerStart?: number;
  handlerEnd?: number;
  widgets: SitemapPageWidget[];
  start: number;
  end: number;
}

function parseWidgets(widgetsNode: JSONNode | undefined): SitemapPageWidget[] {
  const widgets: SitemapPageWidget[] = [];
  if (widgetsNode?.type !== "array") {
    return widgets;
  }
  for (const wNode of widgetsNode.value as JSONNode[]) {
    if (wNode?.type !== "object") {
      continue;
    }
    const wProps = wNode.value as Record<string, { keyNode: JSONNode; valNode: JSONNode }>;
    const typeNode = wProps["type"]?.valNode;
    if (typeNode?.type === "string") {
      widgets.push({
        type: typeNode.value as string,
        start: typeNode.start,
        end: typeNode.end,
      });
    }
  }
  return widgets;
}

function parseRenderId(props: Record<string, { keyNode: JSONNode; valNode: JSONNode }>): {
  renderId?: string;
  renderIdStart?: number;
  renderIdEnd?: number;
} {
  const renderConfigIdNode = props["renderConfigID"]?.valNode;
  if (renderConfigIdNode?.type === "string") {
    return {
      renderId: renderConfigIdNode.value as string,
      renderIdStart: renderConfigIdNode.start,
      renderIdEnd: renderConfigIdNode.end,
    };
  }

  const renderConfigNode = props["renderConfig"]?.valNode;
  if (renderConfigNode?.type === "object") {
    const renderConfigProps = renderConfigNode.value as Record<string, { keyNode: JSONNode; valNode: JSONNode }>;
    const renderIdNode = renderConfigProps["renderId"]?.valNode;
    if (renderIdNode?.type === "string") {
      return {
        renderId: renderIdNode.value as string,
        renderIdStart: renderIdNode.start,
        renderIdEnd: renderIdNode.end,
      };
    }
  }

  return {};
}

function parsePageNode(pageNode: JSONNode): SitemapPage | null {
  if (pageNode.type !== "object") {
    return null;
  }
  const props = pageNode.value as Record<string, { keyNode: JSONNode; valNode: JSONNode }>;
  const urlNode = props["url"]?.valNode;
  const handlerNode = props["handler"]?.valNode;
  const widgetsNode = props["widgets"]?.valNode;

  const widgets = parseWidgets(widgetsNode);
  const { renderId, renderIdStart, renderIdEnd } = parseRenderId(props);

  return {
    url: urlNode?.type === "string" ? (urlNode.value as string) : undefined,
    urlStart: urlNode?.start,
    urlEnd: urlNode?.end,
    renderId,
    renderIdStart,
    renderIdEnd,
    handler: handlerNode?.type === "string" ? (handlerNode.value as string) : undefined,
    handlerStart: handlerNode?.start,
    handlerEnd: handlerNode?.end,
    widgets,
    start: pageNode.start,
    end: pageNode.end,
  };
}

function extractRawPages(root: JSONNode | null): JSONNode[] {
  if (!root) {
    return [];
  }
  if (root.type === "array") {
    return root.value as JSONNode[];
  }
  if (root.type === "object") {
    const props = root.value as Record<string, { keyNode: JSONNode; valNode: JSONNode }>;
    const pagesNode = props["pages"]?.valNode;
    if (pagesNode?.type === "array") {
      return pagesNode.value as JSONNode[];
    }
  }
  return [];
}

export class SitemapRegistry {
  private static instance: SitemapRegistry;
  private sitemapPath = "";
  private pages: SitemapPage[] = [];

  private constructor() {
    // Singleton
  }

  public static getInstance(): SitemapRegistry {
    if (!SitemapRegistry.instance) {
      SitemapRegistry.instance = new SitemapRegistry();
    }
    return SitemapRegistry.instance;
  }

  public getPages(): SitemapPage[] {
    return this.pages;
  }

  public getSitemapPath(): string {
    return this.sitemapPath;
  }

  public setPages(sitemapPath: string, pages: SitemapPage[]) {
    this.sitemapPath = sitemapPath.replaceAll("\\", "/");
    this.pages = pages;
  }

  public parseAndRegister(sitemapPath: string, text: string): void {
    const pages: SitemapPage[] = [];
    try {
      const root = new JSONLocationParser(text).parse();
      const rawPages = extractRawPages(root);

      for (const pageNode of rawPages) {
        const parsed = parsePageNode(pageNode);
        if (parsed) {
          pages.push(parsed);
        }
      }
    } catch {
      // Ignore parse errors, load what we can
    }
    this.setPages(sitemapPath, pages);
  }

  public clear() {
    this.pages = [];
    this.sitemapPath = "";
  }
}

export const sitemapRegistry = SitemapRegistry.getInstance();
