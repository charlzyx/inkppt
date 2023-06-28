import { remark } from "./markdown/index.js";
import chalk from "chalk";
import dayjs from "dayjs";
import { Box, render, Text, useInput } from "ink";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { exec } from "./exec.js";

const CacheContext = createContext({
  get(raw: string) {
    return "";
  },
  set(raw: string, output: string) {
  },
});

const supported = {
  ts: /ts|typescript/,
  tsx: /tsx|typescriptreact/,
  js: /js|javascript/,
  mjs: /mjs/,
};

const short = (x: string) => {
  return Object.keys(supported).reduce((suffix, ext) => {
    if (suffix) return suffix;
    const reg = supported[ext];
    return reg.test(x) ? ext : suffix;
  }, "");
};

const Output = (props: { code?: string; lang?: string }) => {
  const [outputs, setOuputs] = useState([]);
  useEffect(() => {
    if (!props.code || !props.lang) return;
    exec(props.code, props.lang as any, (err, line) => {
      if (err) {
        setOuputs(lines => {
          return [...lines, chalk.bgRed("ERROR:" + err)];
        });
      } else if (line) {
        setOuputs(lines => {
          return [...lines, `${chalk.gray(dayjs().format("HH:MM:ss.SSS"))} ${line}`];
        });
      }
    });
  }, [props.code, props.lang]);

  return (
    <Box borderStyle="classic" flexDirection="column" alignItems="flex-start" justifyContent="flex-start">
      {outputs.length
        ? outputs.map(item => {
          return (
            <Text key={item}>
              {item.toString()}
            </Text>
          );
        })
        : <Text>`Ctrl + E` to Run Code</Text>}
    </Box>
  );
};

const Markdown = (props: { children: string; slient?: boolean }) => {
  const [content, setContent] = useState(props.children);
  const [runable, setRunable] = useState(false);
  const [code, setCode] = useState<{ code: string; lang: string }>();
  const codes = useRef<typeof code[]>([]);
  const appCache = useContext(CacheContext);

  useInput((input, key) => {
    if (props.slient) return;
    if (key.ctrl && input == "e") {
      const code = codes.current[0];
      if (!code) return;
      setCode(code);
    }
  });

  useEffect(() => {
    const [cache, lazy] = remark(props.children, appCache, (code, lang) => {
      codes.current.push({ code, lang: short(lang) });
      setRunable(Boolean(code && supported[lang]));
    });
    if (cache) {
      setContent(cache);
    } else {
      lazy.then((hl) => {
        setContent(hl);
      });
    }
  }, [props.children]);

  return (
    <Box minHeight={10} justifyContent="center" flexDirection="column">
      <Text>{content}</Text>
      {runable
        ? <Output code={code?.code} lang={code?.lang}></Output>
        : null}
    </Box>
  );
};

export const App = (props: {
  children: string;
}) => {
  const slides = useMemo(() => {
    return props.children.trim().split("---").filter(Boolean);
  }, [props.children]);
  const [page, setPage] = useState(0);
  const last = useRef({ input: null, time: 0 });

  const current = useMemo(() => {
    return slides[page];
  }, [page]);

  useInput((input, key) => {
    const prev = () => {
      setPage(page - 1 < 0 ? slides.length - 1 : page - 1);
    };
    const next = () => {
      setPage(page + 1 > slides.length - 1 ? 0 : page + 1);
    };
    const now = +Date.now();
    const timing = now - last.current.time;

    last.current.input = input;
    last.current.time = now;

    if (key.downArrow || key.pageDown || key.rightArrow) {
      next();
    } else if (key.upArrow || key.pageUp || key.leftArrow) {
      prev();
    } else if (input == "g" && last.current.input == "g" && timing < 500) {
      setPage(0);
    }
  });

  const memo = useRef({});

  const cache = useMemo(() => {
    return {
      get(raw: string) {
        return memo.current[raw];
      },
      set(raw: string, output: string) {
        memo.current[raw] = output;
      },
    };
  }, []);

  useEffect(() => {
    // run cache
    slides.forEach(section => remark(section, cache));
  }, [slides]);

  return (
    <CacheContext.Provider value={cache}>
      <Box flexDirection="column">
        <Text>[{page + 1} / {slides.length}]</Text>
        <Markdown key={page}>
          {current}
        </Markdown>
      </Box>
    </CacheContext.Provider>
  );
};
// render(React.createElement(App, { children: `# Hello ` }));
