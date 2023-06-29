import { HighlighterOptions } from "shiki";

let shikiConfig = {
  langs: ["console", "bash", "javascript", "css", "html", "vue", "markdown", "typescript", "jsx", "tsx"],
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
  shikiConfig = {
    ...shikiConfig,
    ...config,
    langs: Array.from(new Set([...shikiConfig.langs, ...config.langs])),
    themes: Array.from(new Set([...shikiConfig.themes, ...config.themes])),
  };
}

export const ShikiThemeTokenFontStyleTypes = {
  NotSet: -1,
  None: 0,
  Italic: 1,
  Bold: 2,
  Underline: 4,
} as const;

export function nonUndefined<T>(param: T | undefined): T {
  return param as T;
}
