import { HighlighterOptions } from "shiki";
import { renderCodeTokens } from "./renderer.js";
import { generateCodeTokens, ShikiLanguageType, ShikiThemeType } from "./tokenizer.js";

export async function highlight(
  options: HighlighterOptions = {},
  codeText: string,
  languageType: ShikiLanguageType = "javascript",
  themeType: ShikiThemeType = "monokai",
) {
  const codeTokens = await generateCodeTokens(codeText, languageType, themeType);
  if (!codeTokens) return codeText;
  const renderedResult = renderCodeTokens(codeTokens);
  return renderedResult;
}

export { configureShiki } from "./config.js";
