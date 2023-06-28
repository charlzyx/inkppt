import chalk from "chalk";
import { spawn } from "child_process";
import * as fs from "fs";
import { createRequire } from "module";
import { nanoid } from "nanoid";
import * as os from "os";
import * as path from "path";
const require = createRequire(import.meta.url);

const WORKDIR = path.join(os.tmpdir(), ".inkppt");

const ensure = () => {
  if (!fs.existsSync(WORKDIR)) {
    fs.mkdirSync(WORKDIR, { recursive: true });
  }
};

const Mapping = {};

const cache = (code: string) => {
  if (Mapping[code]) return Mapping[code];
  Mapping[code] = nanoid();
  return Mapping[code];
};

const write = (code: string, lang: "js" | "ts" | "tsx" | "jsx") => {
  ensure();
  const id = cache(code);
  const filename = path.join(WORKDIR, id + "." + lang);
  try {
    fs.writeFileSync(filename, code, "utf-8");
  } catch (error) {
    chalk.red("WRITE FILE TO " + filename + "ERROR: ");
    return null;
  }
  return filename;
};

const tsx = () => {
  const tsxloader = require.resolve("tsx");
  const tsxexec = tsxloader.replace("tsx/dist/loader.js", "tsx/dist/cli.js");
  return tsxexec;
};

export const exec = (
  code: string,
  lang: Parameters<typeof write>["1"],
  on: (err: Error | undefined, line: string) => void,
) => {
  const file = write(code, lang);
  if (!file) return;
  const child = spawn(tsx(), [file], { cwd: WORKDIR, timeout: 1000 * 60 });

  child.stdout.on("data", (chunk) => {
    on(null, chunk);
  });
  child.stdout.on("error", (err) => {
    on(err, null);
  });
  child.stderr.on("data", (err) => {
    on(err, null);
  });
  child.stderr.on("error", (err) => {
    on(err, null);
  });
  child.stdin = null;
};
