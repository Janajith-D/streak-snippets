import * as fs from "node:fs";
import * as path from "node:path";

export interface RuleConfig {
  severity?: string;
  patterns?: string[];
}

export interface StreakSettings {
  snippets?: {
    widgetDirectory?: string;
    publicDirectory?: string;
  };
  rules?: {
    [key: string]: RuleConfig | string[] | undefined;
    forbiddenPatterns?: string[] | RuleConfig;
  };
}

const SETTINGS_MAP: Readonly<Record<string, string>> = {
  widgetPlaceholderProps: "streak:widget-placeholder-props",
  dataHandlerStatus: "streak:data-handler-status",
  missingDefaultExport: "streak:missing-default-export",
  dataHandlerAsync: "streak:data-handler-async",
  invalidHandlerStatus: "streak:invalid-handler-status",
  reactHooksNotAllowed: "streak:react-hooks-not-allowed",
  unsafeWidgetDataAccess: "streak:unsafe-widget-data-access",
  invalidWidgetPropsContract: "streak:invalid-widget-props-contract",
  scriptClosureCapture: "streak:script-closure-capture",
  invalidScriptSignature: "streak:invalid-script-signature",
  importInsideScript: "streak:import-inside-script",
  asyncScriptCallback: "streak:async-script-callback",
  scriptRequiredId: "streak:script-required-id",
  invalidDynamicComponentId: "streak:invalid-dynamic-component-id",
  duplicatedWidget: "streak:duplicated-widget",
  componentNesting: "streak:component-nesting",
  scriptStructure: "streak:script-structure",
  forbiddenPatterns: "streak:forbidden-patterns",
  duplicateRoute: "streak:duplicate-route",
  missingWidget: "streak:missing-widget",
  missingHandler: "streak:missing-handler",
  deadWidget: "streak:dead-widget",
  duplicateRenderId: "streak:duplicate-render-id",
  missingLayout: "streak:missing-layout",
  invalidLoadingStrategy: "streak:invalid-loading-strategy",
  passiveEventListener: "streak:passive-event-listener",
  dataHandlerWidgetKey: "streak:data-handler-widget-key",
  packageNotFound: "streak:package-not-found",
  packageAbsolutePath: "streak:package-absolute-path",
  packagePublicPath: "streak:package-public-path",
  packageInvalidExtension: "streak:package-invalid-extension",
  S407: "streak:package-not-found",
  S408: "streak:package-absolute-path",
  S409: "streak:package-public-path",
  S410: "streak:package-invalid-extension",
};

function parseRuleSeverities(rules: NonNullable<StreakSettings["rules"]>): Record<string, string> {
  const severities: Record<string, string> = {};
  for (const [settingsKey, ruleId] of Object.entries(SETTINGS_MAP)) {
    const ruleConf = rules[settingsKey];
    if (ruleConf && !Array.isArray(ruleConf) && ruleConf.severity) {
      severities[ruleId] = ruleConf.severity;
    }
  }
  for (const [key, conf] of Object.entries(rules)) {
    if (conf && !Array.isArray(conf) && conf.severity && key.startsWith("streak")) {
      severities[key] = conf.severity;
    }
  }
  return severities;
}

function parseForbiddenPatterns(fbConf: string[] | RuleConfig | undefined): {
  patterns?: string[];
  severity?: string;
} {
  if (Array.isArray(fbConf)) {
    return { patterns: fbConf };
  }
  if (fbConf && typeof fbConf === "object") {
    return {
      patterns: Array.isArray(fbConf.patterns) ? fbConf.patterns : undefined,
      severity: fbConf.severity,
    };
  }
  return {};
}

function ensureChildObject(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  if (typeof parent[key] !== "object" || parent[key] === null || Array.isArray(parent[key])) {
    parent[key] = {};
  }
  return parent[key] as Record<string, unknown>;
}

function setDottedProperty(
  target: Record<string, unknown>,
  dottedKey: string,
  value: unknown,
): void {
  const normalizedKey = dottedKey.startsWith("streak.") ? dottedKey.slice(7) : dottedKey;
  const parts = normalizedKey.split(".");
  let current = target;
  for (let i = 0; i < parts.length - 1; i++) {
    current = ensureChildObject(current, parts[i]);
  }
  const lastKey = parts.at(-1);
  if (!lastKey) {
    return;
  }
  const existing = current[lastKey];
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof existing === "object" &&
    existing !== null
  ) {
    Object.assign(existing, value);
  } else {
    current[lastKey] = value;
  }
}

function unflattenSettings(
  raw: StreakSettings | Record<string, unknown> | undefined,
): StreakSettings {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    setDottedProperty(result, k, v);
  }
  return result;
}

export interface ParsedRuleConfiguration {
  ruleSeverities: Record<string, string>;
  ruleOptions: Record<string, unknown>;
}

function parseJsonc(text: string): Record<string, unknown> | undefined {
  try {
    const cleaned = text.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "").replace(/,\s*([\]}])/g, "$1");
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Loads project-specific configuration from <projectRoot>/.vscode/settings.json.
 */
export function loadProjectSettings(projectRoot: string): StreakSettings | undefined {
  try {
    const settingsPath = path.join(projectRoot, ".vscode", "settings.json");
    if (!fs.existsSync(settingsPath)) {
      return undefined;
    }
    const rawContent = fs.readFileSync(settingsPath, "utf-8");
    const parsed = parseJsonc(rawContent);
    if (!parsed) {
      return undefined;
    }
    return unflattenSettings(parsed);
  } catch {
    return undefined;
  }
}

/**
 * Merges two parsed rule configurations, where override takes precedence over base.
 */
export function mergeRuleConfigurations(
  base: ParsedRuleConfiguration,
  override?: ParsedRuleConfiguration,
): ParsedRuleConfiguration {
  if (!override) {
    return base;
  }
  const ruleSeverities = {
    ...base.ruleSeverities,
    ...override.ruleSeverities,
  };
  const ruleOptions: Record<string, unknown> = {
    ...base.ruleOptions,
    ...override.ruleOptions,
  };
  if (!override.ruleOptions.forbiddenPatterns && base.ruleOptions.forbiddenPatterns) {
    ruleOptions.forbiddenPatterns = base.ruleOptions.forbiddenPatterns;
  }
  return { ruleSeverities, ruleOptions };
}

/**
 * Extracts rule severities and options from the workspace StreakSettings object.
 */
export function buildRuleConfiguration(
  rawSettings: StreakSettings | Record<string, unknown> | undefined,
): ParsedRuleConfiguration {
  const streakSettings = unflattenSettings(rawSettings);
  if (!streakSettings.rules) {
    return { ruleSeverities: {}, ruleOptions: {} };
  }

  const ruleSeverities = parseRuleSeverities(streakSettings.rules);
  const ruleOptions: Record<string, unknown> = {};

  const fb = parseForbiddenPatterns(streakSettings.rules.forbiddenPatterns);
  if (fb.patterns) {
    ruleOptions.forbiddenPatterns = fb.patterns;
  }
  if (fb.severity) {
    ruleSeverities["streak:forbidden-patterns"] = fb.severity;
  }

  return { ruleSeverities, ruleOptions };
}
