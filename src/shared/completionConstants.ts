/**
 * Shared regex constants for completion providers.
 * Centralised here to avoid duplication and satisfy SonarQube pattern rules.
 */

/**
 * Matches a trailing word (identifier chars) at the end of a string.
 * Anchored with $ to prevent backtracking. Group 1 = the word.
 */
export const TRAILING_WORD_RE = /(\w*)$/;

/**
 * Matches a `gDom.<method>` property access at the end of a text slice.
 * Uses \b word boundary to avoid false matches inside longer identifiers.
 * e.g. `gDom.showEl` — group 1 captures the partial method name.
 */
export const GDOM_ACCESS_RE = /\bgDom\.(\w*)$/;

/**
 * Matches the start of a loadDynamicComponent() call with an open string argument.
 * e.g. `gDom.loadDynamicComponent("` or `loadDynamicComponent('my-comp`
 * Uses \b word boundary instead of an optional prefix group to avoid backtracking.
 * [^"']* is safe: the character class explicitly excludes both quote types.
 */
export const LOAD_DYNAMIC_RE = /\bloadDynamicComponent\s*\(\s*["'][^"']*$/;

/**
 * Matches the opening brace+signature of a Script element callback.
 * Handles all valid forms:
 *   {(gDom) => {
 *   {(gDom: any) => {
 *   {(gDom, options) => {
 *   {(gDom: any, options: any) => {
 *
 * Uses [^)]* to consume optional params/types without backtracking.
 * (The character class [^)] deterministically stops at the closing paren.)
 */
export const SCRIPT_CALLBACK_RE = /\{\s*\(\s*gDom[^)]*\)\s*=>\s*\{/;
