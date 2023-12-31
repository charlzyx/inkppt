import chalk from "chalk";
import dayjs from "dayjs";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getInkPPTConfig } from "./config.js";
import { exec } from "./exec.js";
import { remark } from "./markdown/index.js";
import { KEY_WAITING, onKey, RUNABLE, short, useStdoutDimensions } from "./util.js";

const AppContext = createContext({
  config: getInkPPTConfig(),
  get(raw: string) {
    return "";
  },
  set(raw: string, output: string) {
  },
});

const Output = (props: { code?: string; lang?: string }) => {
  const [outputs, setOuputs] = useState([]);
  useEffect(() => {
    if (!props.code || !props.lang) return;
    exec(props.code, props.lang as any, (err, line) => {
      if (err) {
        setOuputs(lines => {
          return [...lines, chalk.red("ERROR:" + err)];
        });
      } else if (line) {
        setOuputs(lines => {
          return [...lines, `${chalk.gray(dayjs().format("HH:MM:ss.SSS"))} ${line}`];
        });
      }
    });
  }, [props.code, props.lang]);

  return (
    <Box borderStyle="round" flexDirection="column" alignItems="flex-start" justifyContent="flex-start">
      {outputs.length
        ? outputs.map(item => {
          return (
            <Text key={item}>
              {item.toString().trim()}
            </Text>
          );
        })
        : <Text>`Ctrl + E` to Run Code</Text>}
    </Box>
  );
};

const Markdown = (props: { children: string }) => {
  const [content, setContent] = useState("__INIT__");
  const [runable, setRunable] = useState(false);
  const [code, setCode] = useState<{ code: string; lang: string }>();
  const pickedCodesRef = useRef<typeof code[]>([]);
  const appCache = useContext(AppContext);

  useInput((input, key) => {
    if (key.ctrl && input == "e") {
      const code = pickedCodesRef.current[0];
      if (!code) return;
      setCode(code);
    }
  });

  useEffect(() => {
    const [cache, lazy] = remark(props.children, appCache, (code, lang) => {
      pickedCodesRef.current.push({ code, lang: short(lang) });
      setRunable(Boolean(code && RUNABLE[lang]));
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
    <Box flexShrink={1} minHeight={10} rowGap={0} justifyContent="center" flexDirection="column">
      <Text>
        {content === "__INIT__" ? <Spinner type="christmas"></Spinner> : content}
      </Text>
      {runable
        ? <Output code={code?.code} lang={code?.lang}></Output>
        : null}
    </Box>
  );
};

export const App = (props: {
  children: string;
  meta?: Partial<ReturnType<typeof getInkPPTConfig>>;
}) => {
  const slides = useMemo(() => {
    return props.children.trim().split(/\n---\n/).filter(Boolean);
  }, [props.children]);

  const len = slides.length;

  const [page, setPage] = useState(0);
  const last = useRef({ input: null, time: 0, using: false });
  const [width, height] = useStdoutDimensions();

  const current = useMemo(() => {
    return slides[page];
  }, [page]);

  useInput((input, key) => {
    const now = +Date.now();
    const timing = now - last.current.time;

    const to = onKey(input, key, len, page, last.current);

    last.current.input = input;
    last.current.time = now;

    setPage(to);

    if (!key.shift && input == "g" && last.current.input == "g" && timing < KEY_WAITING) {
      // gg to start
      setPage(0);
    } else if (input == "G") {
      // G to END
      setPage(len - 1);
    }
  });

  const memo = useRef({});

  const cache = useMemo(() => {
    return {
      config: {
        ...getInkPPTConfig(),
        ...props.meta,
        width,
        height,
      },
      get(raw: string) {
        return memo.current[raw];
      },
      set(raw: string, output: string) {
        memo.current[raw] = output;
      },
    };
  }, [width, height, props.meta]);

  useEffect(() => {
    // clear cache
    memo.current = {};
    // run cache
    slides.forEach(section => remark(section, cache));
  }, [slides, width, height]);

  return (
    <AppContext.Provider value={cache}>
      <Box height={height} width={width} padding={2} flexDirection="column">
        <Box justifyContent="flex-end" alignItems="flex-end">
          <Text italic>[{page + 1} / {len}]</Text>
        </Box>
        <Box flexShrink={1}>
          <Markdown key={page}>
            {current}
          </Markdown>
        </Box>
      </Box>
    </AppContext.Provider>
  );
};
