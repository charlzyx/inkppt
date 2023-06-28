import { merge } from "merge";
import { HighlighterOptions } from "shiki";

let shikiConfig = {
  langs: ["javascript", "css", "html", "vue-html", "typescript", "jsx", "tsx"],
  themes: ["monokai", "one-dark-pro", "material-theme"],
} as HighlighterOptions;

/** Global getter for highlighter configurations */
export function getShikiConfig(): HighlighterOptions {
  return shikiConfig;
}

/**
 * Global Configuration for shiki highlighter
 * the configs of shiki will be merged to the global shiki config
 * @export
 * @param {Partial<HighlighterOptions>} [config] ShikiHighlighterConfig
 */
export function configureShiki(config?: Partial<HighlighterOptions>) {
  const targetConfig = config ?? {};
  shikiConfig = merge(shikiConfig, targetConfig);
}

export const ShikiThemeTokenFontStyleTypes = {
  NotSet: -1,
  None: 0,
  Italic: 1,
  Bold: 2,
  Underline: 4,
} as const;

export type ExcludeUndefined<T> = T extends (infer R | undefined) ? ExcludeUndefined<R> : T;
export function nonUndefined<T>(param: T | undefined): T {
  return param as T;
}
