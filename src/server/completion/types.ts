import type { CompletionItem } from "vscode-languageserver/node";

/**
 * The context in which the autocompletion was triggered.
 */
export interface CompletionContext {
  /** The full text of the active document. */
  text: string;
  /** The absolute path or URI of the active document. */
  uri: string;
  /** The 0-based character offset of the cursor in the document text. */
  offset: number;
  /** The 0-based line number of the cursor. */
  line: number;
  /** The 0-based character position of the cursor on that line. */
  character: number;
}

/**
 * A provider interface for suggesting completion items.
 */
export interface CompletionProvider {
  /**
   * Returns list of completion items or empty array if not applicable.
   */
  getCompletions(
    context: CompletionContext,
    workspaceRoot: string | undefined,
  ): Promise<CompletionItem[]>;
}
