import type { Rule } from "./types";
import { widgetPlaceholderRule } from "./widgetPlaceholderRule";
import { dataHandlerStatusRule } from "./dataHandlerStatusRule";
import { missingDefaultExportRule } from "./missingDefaultExportRule";
import { dataHandlerAsyncRule } from "./dataHandlerAsyncRule";
import { dataHandlerStatusValueRule } from "./dataHandlerStatusValueRule";
import { reactHooksNotAllowedRule } from "./reactHooksNotAllowedRule";
import { unsafeWidgetDataAccessRule } from "./unsafeWidgetDataAccessRule";
import { invalidWidgetPropsContractRule } from "./invalidWidgetPropsContractRule";
import {
  scriptClosureCaptureRule,
  invalidScriptSignatureRule,
  importInsideScriptRule,
  asyncScriptCallbackRule,
  scriptRequiredIdRule,
} from "./scriptRules";
import { dynamicComponentIdRule } from "./dynamicComponentIdRule";
import { duplicatedWidgetRule } from "./duplicatedWidgetRule";
import { componentNestingRule } from "./componentNestingRule";
import { scriptStructureRule } from "./scriptStructureRule";
import { allowedImportsRule } from "./allowedImportsRule";
import { forbiddenPatternsRule } from "./forbiddenPatternsRule";
import { widgetFilenameMatchesComponentRule } from "./widgetFilenameMatchesComponentRule";
import { deadWidgetRule } from "./deadWidgetRule";

export * from "./types";
export * from "./widgetPlaceholderRule";
export * from "./dataHandlerStatusRule";
export * from "./missingDefaultExportRule";
export * from "./dataHandlerAsyncRule";
export * from "./dataHandlerStatusValueRule";
export * from "./reactHooksNotAllowedRule";
export * from "./unsafeWidgetDataAccessRule";
export * from "./invalidWidgetPropsContractRule";
export * from "./scriptRules";
export * from "./dynamicComponentIdRule";
export * from "./duplicatedWidgetRule";
export * from "./componentNestingRule";
export * from "./scriptStructureRule";
export * from "./allowedImportsRule";
export * from "./forbiddenPatternsRule";
export * from "./widgetFilenameMatchesComponentRule";
export * from "./deadWidgetRule";

export const allRules: Rule[] = [
  widgetPlaceholderRule,
  dataHandlerStatusRule,
  missingDefaultExportRule,
  dataHandlerAsyncRule,
  dataHandlerStatusValueRule,
  reactHooksNotAllowedRule,
  unsafeWidgetDataAccessRule,
  invalidWidgetPropsContractRule,
  scriptClosureCaptureRule,
  invalidScriptSignatureRule,
  importInsideScriptRule,
  asyncScriptCallbackRule,
  scriptRequiredIdRule,
  dynamicComponentIdRule,
  duplicatedWidgetRule,
  componentNestingRule,
  scriptStructureRule,
  allowedImportsRule,
  forbiddenPatternsRule,
  widgetFilenameMatchesComponentRule,
  deadWidgetRule,
];
