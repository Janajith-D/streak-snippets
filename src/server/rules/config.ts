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
};

function parseRuleSeverities(rules: NonNullable<StreakSettings["rules"]>): Record<string, string> {
  const severities: Record<string, string> = {};
  for (const [settingsKey, ruleId] of Object.entries(SETTINGS_MAP)) {
    const ruleConf = rules[settingsKey];
    if (ruleConf && !Array.isArray(ruleConf) && ruleConf.severity) {
      severities[ruleId] = ruleConf.severity;
    }
  }
  return severities;
}

function parseForbiddenPatterns(
  fbConf: string[] | RuleConfig | undefined,
): { patterns?: string[]; severity?: string } {
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

/**
 * Extracts rule severities and options from the workspace StreakSettings object.
 */
export function buildRuleConfiguration(streakSettings: StreakSettings | undefined): {
  ruleSeverities: Record<string, string>;
  ruleOptions: Record<string, unknown>;
} {
  if (!streakSettings?.rules) {
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
