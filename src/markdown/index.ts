import { marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import { highlight } from "../chalkcode/index.js";
import type { getInkPPTConfig } from "../config.js";
import { TerminalRenderer } from "./renderer.js";

marked.use(gfmHeadingId());

export const remark = (
  raw: string,
  options: {
    config: ReturnType<typeof getInkPPTConfig>;
    get(raw: string): string;
    set(raw: string, code: string): void;
  } = null,
  walkCode?: (code: string, lang: string) => void,
): [string, Promise<string> | null] => {
  const opts: marked.MarkedOptions = {
    async walkTokens(token) {
      if (token.type === "code") {
        token.lang = token.lang || "console";
        const hlcode = await highlight(options.config.shikiOptions, token.text, token.lang);
        if (walkCode) walkCode(token.text, token.lang);
        token.text = hlcode;
      }
    },
    mangle: false,
    renderer: new TerminalRenderer({ width: options.config.width, height: options.config.height }),
  };

  if (options?.get(raw) && !walkCode) {
    return [options.get(raw), null];
  } else if (options?.get(raw)) {
    return [
      options.get(raw),
      // just for walkcode
      marked(raw, { ...opts, async: true }),
    ];
  }

  return [
    null,
    marked(raw, { ...opts, async: true }).then(rendered => {
      if (options) {
        options.set(raw, rendered);
      }
      return rendered;
    }),
  ];
};
