import { Rule } from "./types";
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
} from "./scriptRules";
import { dynamicComponentIdRule } from "./dynamicComponentIdRule";

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
  dynamicComponentIdRule,
];
