import type { HighlighterOptions } from "shiki";

export const getInkPPTConfig = () => {
  return {
    width: 80,
    height: 200,
    shikiOptions: {
      langs: ["js", "jsx", "ts", "tsx", "bash", "console", "cmd", "json", "vue", "yaml", "md", "mdx", "mermaid"],
      themes: ["material-theme-ocean", "github-dark", "github-light"],
    } as Partial<HighlighterOptions>,
  };
};
