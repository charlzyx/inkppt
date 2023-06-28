#!/usr/bin/env node

import { render } from "ink";
import React from "react";
import { App } from "./App.js";

import fs from "fs";
import path from "path";

const input = process.argv.slice(2)[0];
let content = "";
if (!input) {
  const guess = fs.readdirSync(process.cwd()).filter(x => /\.md$/.test(x))?.[0];
  if (guess) {
    content = fs.readFileSync(guess, "utf-8");
  } else {
    console.log(`markdown file is required. example: inkppt path/of/ppt.md`);
  }
} else {
  const filename = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
  if (!fs.existsSync(filename)) {
    console.log(`file not exists. Please ensure ${filename} exists.`);
  } else {
    content = fs.readFileSync(filename, "utf-8");
  }
}

if (content) {
  render(React.createElement(App, { children: content }));
}
