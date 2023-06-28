import ansiEscapes from "ansi-escapes";
import chalk from "chalk";
import Table from "cli-table3";
import { marked, Renderer } from "marked";
import * as emoji from "node-emoji";
import supportsHyperlinks from "supports-hyperlinks";

class RE {
  static escape(str: string) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

  static TEXT = /\u001b\[(?:\d{1,3})(?:;\d{1,3})*m/g;
  static LINE_SPLIT = /(\u001b\[(?:\d{1,3})(?:;\d{1,3})*m)/g;
  static EMOJI = /:([A-Za-z0-9_\-\+]+?):/g;
  static WORD_SPLIT = /[ \t\n]+/;
  static TABLE_CELL_SPLIT = "^*||*^";
  static TABLE_ROW_WRAP = "*|*|*|*";
  static COLON_REPLACER = "*#COLON|*";
  static TAB_ALLOWED_CHARACTERS = ["\t"];
  static BULLET_POINT = "* ";

  // HARD_RETURN holds a character sequence used to indicate text has a
  // hard (no-reflowing) line break.  static Previously \r and \r\n were turned
  // into \n in marked's lexer- preprocessing step. So \r is safe to use
  // to indicate a hard (non-reflowed) return.
  static HARD_RETURN = "\r";
  static BULLET_POINT_REGEX = "\\*";
  static NUMBERED_POINT_REGEX = "\\d+\\.";
  static POINT_REGEX = "(?:" + [RE.BULLET_POINT_REGEX, RE.NUMBERED_POINT_REGEX].join("|") + ")";
  static TABLE_ROW_WRAP_REGEXP = new RegExp(RE.escape("*|*|*|*"), "g");
  static COLON_REPLACER_REGEXP = new RegExp(RE.escape("*#COLON|*"), "g");
  static HARD_RETURN_RE = new RegExp(RE.HARD_RETURN);
  static HARD_RETURN_GFM_RE = new RegExp(RE.HARD_RETURN + "|<br />");
}

const helper = {
  isAllowedTabString(string: string) {
    return RE.TAB_ALLOWED_CHARACTERS.some(function(char) {
      return string.match("^(" + char + ")+$");
    });
  },
  isPointedLine(line: string, indent: string) {
    return line.match("^(?:" + indent + ")*" + RE.POINT_REGEX);
  },
  identity(str: string) {
    return str;
  },
  indentify(indent: string = "", text?: string) {
    if (!text) return text;
    return indent + text.split("\n").join("\n" + indent);
  },
  indentLines(indent: string, text: string) {
    return text.replace(/(^|\n)(.+)/g, "$1" + indent + "$2");
  },
  sanitizeTab(tab: string | number, fallbackTab: number) {
    if (typeof tab === "number") {
      return new Array(tab + 1).join(" ");
    } else if (typeof tab === "string" && helper.isAllowedTabString(tab)) {
      return tab;
    } else {
      return new Array(fallbackTab + 1).join(" ");
    }
  },
  // Prevents nested lists from joining their parent list's last line
  fixNestedLists(body: string, indent: string) {
    const regex = new RegExp(
      ""
        + "(\\S(?: |  )?)" // Last char of current point, plus one or two spaces
        // to allow trailing spaces
        + "((?:"
        + indent
        + ")+)" // Indentation of sub point
        + "("
        + RE.POINT_REGEX
        + "(?:.*)+)$",
      "gm",
    ); // Body of subpoint
    return body.replace(regex, "$1\n" + indent + "$2$3");
  },
  toSpaces(str: string) {
    return " ".repeat(str.length);
  },
  bulletPointLine(indent: string, line: string) {
    return helper.isPointedLine(line, indent) ? line : helper.toSpaces(RE.BULLET_POINT) + line;
  },
  bulletPointLines(lines: string, indent: string) {
    const transform = helper.bulletPointLine.bind(null, indent);
    return lines.split("\n").filter(helper.identity).map(transform).join("\n");
  },
  numberedPoint(n: number) {
    return n + ". ";
  },
  numberedLine(indent: string, line: string, num: number) {
    return helper.isPointedLine(line, indent)
      ? {
        num: num + 1,
        line: line.replace(RE.BULLET_POINT, helper.numberedPoint(num + 1)),
      }
      : {
        num: num,
        line: helper.toSpaces(helper.numberedPoint(num)) + line,
      };
  },
  numberedLines(lines: string, indent: string) {
    const transform = helper.numberedLine.bind(null, indent);
    let num = 0;
    return lines
      .split("\n")
      .filter(helper.identity)
      .map((line) => {
        const numbered = transform(line, num);
        num = numbered.num;

        return numbered.line;
      })
      .join("\n");
  },
  list(body: string, ordered: boolean, indent: string) {
    body = body.trim();
    body = ordered ? helper.numberedLines(body, indent) : helper.bulletPointLines(body, indent);
    return body;
  },
  section(text: string) {
    return text + "\n\n";
  },
  textLength(str: string) {
    return str.replace(RE.TEXT, "").length;
  },

  // Munge \n's and spaces in "text" so that the number of
  // characters between \n's is less than or equal to "width".
  reflowText(text: string, width: number, gfm: boolean) {
    // Hard break was inserted by Renderer.prototype.br or is
    // <br /> when gfm is true
    const splitRe = gfm ? RE.HARD_RETURN_GFM_RE : RE.HARD_RETURN_RE,
      sections = text.split(splitRe),
      reflowed = [];

    sections.forEach(function(section) {
      // Split the section by escape codes so that we can
      // deal with them separately.
      const fragments = section.split(RE.LINE_SPLIT);
      let column = 0;
      let currentLine = "";
      let lastWasEscapeChar = false;

      while (fragments.length) {
        const fragment = fragments[0];

        if (fragment === "") {
          fragments.splice(0, 1);
          lastWasEscapeChar = false;
          continue;
        }

        // This is an escape code - leave it whole and
        // move to the next fragment.
        if (!helper.textLength(fragment)) {
          currentLine += fragment;
          fragments.splice(0, 1);
          lastWasEscapeChar = true;
          continue;
        }

        const words = fragment.split(RE.WORD_SPLIT);

        for (let i = 0; i < words.length; i++) {
          let word = words[i];
          let addSpace = column != 0 ? 1 : 0;
          if (lastWasEscapeChar) addSpace = 0;

          // If adding the new word overflows the required width
          if (column + word.length + addSpace > width) {
            if (word.length <= width) {
              // If the new word is smaller than the required width
              // just add it at the beginning of a new line
              reflowed.push(currentLine);
              currentLine = word;
              column = word.length;
            } else {
              // If the new word is longer than the required width
              // split this word into smaller parts.
              const w = word.substr(0, width - column - addSpace);
              if (addSpace) currentLine += " ";
              currentLine += w;
              reflowed.push(currentLine);
              currentLine = "";
              column = 0;

              word = word.substr(w.length);
              while (word.length) {
                const w = word.substr(0, width);

                if (!w.length) break;

                if (w.length < width) {
                  currentLine = w;
                  column = w.length;
                  break;
                } else {
                  reflowed.push(w);
                  word = word.substr(width);
                }
              }
            }
          } else {
            if (addSpace) {
              currentLine += " ";
              column++;
            }

            currentLine += word;
            column += word.length;
          }

          lastWasEscapeChar = false;
        }

        fragments.splice(0, 1);
      }

      if (helper.textLength(currentLine)) reflowed.push(currentLine);
    });

    return reflowed.join("\n");
  },
  fixHardReturn(text: string, reflow: boolean) {
    // FIXME: /\n/g 是怎么回事
    return reflow ? text.replace(RE.HARD_RETURN, /\n/g as any) : text;
  },
  insertEmojis(text: string) {
    return text.replace(RE.EMOJI, function(emojiString) {
      const emojiSign = emoji.get(emojiString);
      if (!emojiSign) return emojiString;
      return emojiSign + " ";
    });
  },
  hr(inputHrStr: string, length?: number) {
    length = length || (process.stdout as any)?.columns;
    return new Array(length).join(inputHrStr);
  },
  undoColon(str: string) {
    return str.replace(RE.COLON_REPLACER_REGEXP, ":");
  },

  generateTableRow(text?: string, escape?: (...args: any) => string) {
    if (!text) return [];
    escape = escape || helper.identity;
    const lines = escape(text).split("\n");

    const data = [];
    lines.forEach(function(line) {
      if (!line) return;
      const parsed = line
        .replace(RE.TABLE_ROW_WRAP_REGEXP, "")
        .split(RE.TABLE_CELL_SPLIT);

      data.push(parsed.splice(0, parsed.length - 1));
    });
    return data;
  },
  unescapeEntities(html: string) {
    return html
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'");
  },
  compose<T extends ((...args: any) => any)>(...funcs: T[]) {
    return function composeFn(...args: any[]) {
      for (let i = funcs.length; i-- > 0;) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  },
};

const defaults = {
  code: chalk.yellow,
  blockquote: chalk.gray.italic,
  html: chalk.gray,
  heading: chalk.green.bold,
  firstHeading: chalk.magenta.underline.bold,
  hr: chalk.reset,
  listitem: chalk.reset,
  list: helper.list,
  table: chalk.reset,
  paragraph: chalk.reset,
  strong: chalk.bold,
  em: chalk.italic,
  codespan: chalk.yellow,
  del: chalk.dim.gray.strikethrough,
  link: chalk.blue,
  href: chalk.blue.underline,
  text: helper.identity,
  unescape: true,
  emoji: true,
  width: 80,
  showSectionPrefix: true,
  reflowText: false,
  tab: 2,
  tableOptions: {},
};

export type TerminalRendererOptions = Partial<typeof defaults> & marked.MarkedOptions;
export class TerminalRenderer extends Renderer {
  opts: TerminalRendererOptions = {};

  tab: string;
  transform: (text: string) => string;
  emoji: (text: string) => string;

  constructor(options?: TerminalRendererOptions) {
    const opts = { ...defaults, ...options };
    if (!options?.width && (process.stdout as any)?.columns) {
      opts.width = options?.width || (process.stdout as any).columns;
    }
    super(opts);
    this.opts = Object.assign(this.options, opts);
    this.tab = helper.sanitizeTab(opts.tab, defaults.tab);
    const unespace = opts.unescape ? helper.unescapeEntities : helper.identity;
    this.emoji = opts.emoji ? helper.insertEmojis : helper.identity;
    this.transform = helper.compose(helper.undoColon, unespace, this.emoji);
  }

  textLength(...args: Parameters<typeof helper.textLength>) {
    return helper.textLength.apply(this, ...args);
  }

  text(text: string) {
    const opts = this.opts;
    return opts.text(text);
  }

  blockquote(quote: string) {
    const opts = this.opts;
    return helper.section(opts.blockquote(helper.indentify(this.tab, quote.trim())));
  }

  heading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6, raw: string, slugger: marked.Slugger): string {
    text = this.transform(text);
    const opts = this.opts;

    const prefix = opts.showSectionPrefix
      ? new Array(level + 1).join("#") + " "
      : "";
    text = prefix + text;
    if (opts.reflowText) {
      text = helper.reflowText(text, opts.width, opts.gfm);
    }
    return helper.section(
      level === 1 ? opts.firstHeading(text) : opts.heading(text),
    );
  }
  hr() {
    const opts = this.opts;
    return helper.section(opts.hr(helper.hr("-", opts.reflowText ? opts.width : null)));
  }
  list(body: string, ordered: boolean) {
    const opts = this.opts;
    body = opts.list(body, ordered, this.tab);
    return helper.section(helper.fixNestedLists(helper.indentLines(this.tab, body), this.tab));
  }
  listitem(text: string) {
    const opts = this.opts;
    const transform = helper.compose(opts.listitem, this.transform);
    const isNested = text.indexOf("\n") !== -1;
    if (isNested) text = text.trim();

    // Use BULLET_POINT as a marker for ordered or unordered list item
    return "\n" + RE.BULLET_POINT + transform(text);
  }
  checkbox(checked: boolean) {
    return "[" + (checked ? "X" : " ") + "] ";
  }
  paragraph(text: string) {
    const opts = this.opts;
    const transform = helper.compose(opts.paragraph, this.transform);
    text = transform(text);
    if (opts.reflowText) {
      text = helper.reflowText(text, opts.width, opts.gfm);
    }
    return helper.section(text);
  }
  table(header: string, body: string) {
    const opts = this.opts;
    const table = new Table(
      Object.assign(
        {},
        {
          head: helper.generateTableRow(header)[0],
        },
        opts.tableOptions,
      ),
    );

    helper.generateTableRow(body, this.transform).forEach(function(row) {
      table.push(row);
    });
    return helper.section(opts.table(table.toString()));
  }
  tablerow(content: string) {
    return RE.TABLE_ROW_WRAP + content + RE.TABLE_ROW_WRAP + "\n";
  }

  tablecell(content: string, flags: { header: boolean; align: "center" | "left" | "right" }): string {
    return content + RE.TABLE_CELL_SPLIT;
  }
  strong(text: string) {
    const opts = this.opts;
    return opts.strong(text);
  }
  em(text: string) {
    const opts = this.opts;
    text = helper.fixHardReturn(text, opts.reflowText);
    return opts.em(text);
  }
  codespan(text: string) {
    const opts = this.opts;
    text = helper.fixHardReturn(text, opts.reflowText);
    return opts.codespan(text.replace(/:/g, RE.COLON_REPLACER));
  }
  br() {
    const opts = this.opts;
    return opts.reflowText ? RE.HARD_RETURN : "\n";
  }
  del(text: string) {
    const opts = this.opts;
    return opts.del(text);
  }

  link(href: string, title: string, text: string) {
    const opts = this.opts;

    const hasText = text && text !== href;

    let out = "";

    if (supportsHyperlinks.stdout) {
      let link = "";
      if (text) {
        link = opts.href(this.emoji(text));
      } else {
        link = opts.href(href);
      }
      out = ansiEscapes.link(link, href);
    } else {
      if (hasText) out += this.emoji(text) + " (";
      out += opts.href(href);
      if (hasText) out += ")";
    }
    return opts.link(out);
  }
  image(href: string, title: string, text: string) {
    // const opts = this.opts;
    // if (typeof opts.image === "function") {
    //   return opts.image(href, title, text);
    // }
    let out = "![" + text;
    if (title) out += " – " + title;
    return out + "](" + href + ")\n";
  }
  html(html: string) {
    const opts = this.opts;
    return opts.html(html);
  }
  code(code: string, lang: string, escaped: boolean) {
    // const opts = this.opts;
    return helper.section(helper.indentify(this.tab, code));
  }
}
