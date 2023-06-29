import { Key } from "ink";
import { useStdout } from "ink";
import yaml from "js-yaml";
import { useEffect, useState } from "react";

export const RUNABLE = {
  ts: /ts|typescript/,
  tsx: /tsx|typescriptreact/,
  js: /js|javascript/,
  mjs: /mjs/,
};

export const onKey = (input: string, key: Key, len: number, cur: number) => {
  if (/\d/.test(input)) {
    let n = Math.max(0, +input - 1);
    if (key.ctrl) {
      n = n + 10;
    }
    const isNext = n > cur;
    const isPrev = n < cur;
    if (isPrev) {
      n = Math.min(n, cur);
    }
    if (isNext) {
      n = Math.min(cur + n, len - 1);
    }
    return n;
  }

  const isNext = / |j|l/.test(input) || key.pageDown || key.rightArrow || key.downArrow || key.return
    || (input == "n" && !key.shift);
  const isPrev = /p|h|k/.test(input) || key.pageUp || key.leftArrow || key.upArrow
    || (input == "n" && key.shift);

  let to = cur;
  if (isPrev) {
    to = Math.max(0, cur - 1);
  }
  if (isNext) {
    to = Math.min(cur + 1, len - 1);
  }
  return to;
};

export const short = (x: string) => {
  return Object.keys(RUNABLE).reduce((suffix, ext) => {
    if (suffix) return suffix;
    const reg = RUNABLE[ext];
    return reg.test(x) ? ext : suffix;
  }, "");
};

export const pickMetadata = (md: string) => {
  // Splits the given string into a meta section and a markdown section if a meta section is present, else returns null
  let meta = {};
  if (md.slice(0, 3) !== "---") {
    return [meta, md] as const;
  }

  const matcher = /\n(\.{3}|-{3})/g;
  const metaEnd = matcher.exec(md);
  const [metaLines, body] = metaEnd ? [md.slice(0, metaEnd.index), md.slice(matcher.lastIndex)] : [, md];
  if (metaLines) {
    try {
      meta = yaml.load(metaLines);
    } catch (error) {
      console.log("inkppt parser metadata error: " + error);
    }
  }

  return [meta, body] as const;
};

export const useStdoutDimensions = () => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState([stdout.columns, stdout.rows]);
  useEffect(() => {
    const handler = () => setDimensions([stdout.columns, stdout.rows]);
    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);
  return dimensions;
};
