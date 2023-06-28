import { highlight } from "../chalkcode/index.js";
import { marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import { TerminalRenderer } from "./Renderer.js";

marked.use(gfmHeadingId());

export const remark = (
  raw: string,
  cache: {
    get(raw: string): string;
    set(raw: string, code: string): void;
  } = null,
  walkCode?: (code: string, lang: string) => void,
): [string, Promise<string> | null] => {
  const opts: marked.MarkedOptions = {
    async walkTokens(token) {
      if (token.type === "code" && token.lang) {
        const hlcode = await highlight(token.text, token.lang);
        if (walkCode) walkCode(token.text, token.lang);
        token.text = hlcode;
      }
    },
    mangle: false,
    renderer: new TerminalRenderer(),
  };

  if (cache?.get(raw) && !walkCode) {
    return [cache.get(raw), null];
  } else if (cache?.get(raw)) {
    return [
      cache.get(raw),
      // just for walkcode
      marked(raw, { ...opts, async: true }),
    ];
  }

  return [
    null,
    marked(raw, { ...opts, async: true }).then(rendered => {
      if (cache) {
        cache.set(raw, rendered);
      }
      return rendered;
    }),
  ];
};
