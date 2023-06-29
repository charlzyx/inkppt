#!/usr/bin/env node

import fs from "fs";
import { render } from "ink";
import path from "path";
import React from "react";
import { App } from "./App.js";
import { pickMetadata } from "./util.js";

const input = process.argv.slice(2)[0];

const pority = (x: string): any => /readme|home|index/i.test(x) ? 1000000 : x;

const tryFile = (filepath: string = process.cwd()) => {
  const exists = fs.existsSync(filepath);
  if (!exists) {
    console.log(`markdown file is required. example: inkppt path/of/ppt.md`);
    return;
  }
  filepath = path.isAbsolute(filepath) ? filepath : path.resolve(process.cwd(), filepath);

  const isDir = fs.statSync(filepath).isDirectory();
  if (isDir) {
    const filelist = fs.readdirSync(filepath).filter(x => /md$/.test(x));
    if (filelist.length == 0) {
      console.log(`markdown file is required. example: inkppt path/of/ppt.md`);
      return;
    } else {
      filelist.sort((a, b) => pority(b) - pority(a));
      if (filelist.length == 1) {
        console.log(`mutiple markdown file found, ${filelist[0]} is using.`);
      }
      return path.join(filepath, filelist[0]);
    }
  } else {
    return filepath;
  }
};

const run = () => {
  const mdfile = tryFile(input);
  if (!mdfile) return;
  const content = fs.readFileSync(mdfile, "utf-8");
  const [meta, body] = pickMetadata(content);
  render(React.createElement(App, { children: body, meta }));
};

run();
