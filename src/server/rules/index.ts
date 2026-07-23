import { Rule } from "./types";
import { widgetPlaceholderRule } from "./widgetPlaceholderRule";
import { dataHandlerStatusRule } from "./dataHandlerStatusRule";
import { missingDefaultExportRule } from "./missingDefaultExportRule";

export * from "./types";
export * from "./widgetPlaceholderRule";
export * from "./dataHandlerStatusRule";
export * from "./missingDefaultExportRule";

export const allRules: Rule[] = [
  widgetPlaceholderRule,
  dataHandlerStatusRule,
  missingDefaultExportRule,
];
