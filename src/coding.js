/* Coding + developer toolchain layer.

   Pure helpers shared by the editor UI and the terminal. No DOM access and no
   imports from world.js, so this module can be used anywhere in the game.
   All project analysis is bounded; large files fall back to plain text. */
import { esc, clamp } from './util.js';
import {
  allFiles, getNode, readFile, writeFile, ensureDir, listDir, joinPath, dirname, basename, HOME
} from './vfs.js';

export const CODING_VERSION = 1;

const SAFE_HIGHLIGHT_LIMIT = 180000;
const TEXT_FILE = /\.(js|mjs|cjs|jsx|ts|tsx|py|pyw|c|h|cpp|cc|hpp|rs|go|sql|html|htm|css|scss|json|jsonc|md|markdown|sh|bash|yml|yaml|toml|xml|txt|env|gitignore|makefile)$/i;
const BINARY_FILE = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|bz2|xz|woff2?|ttf|otf|mp3|mp4|wav|ogg|wasm|exe|bin|so|dll|db|sqlite)$/i;

/* ---------------- language registry ---------------- */
const COMMON = {
  line: ['//'], block: ['/*', '*/']
};
const LANGUAGES = [
  {
    id: 'javascript', name: 'JavaScript', short: 'JS', extensions: ['js','mjs','cjs','jsx'], mode: 'js',
    line: ['//'], block: ['/*','*/'], indent: 'spaces', runtime: 'node', test: 'node --test',
    keywords: 'const let var function return if else for while do switch case break continue new class extends super this async await import export from default try catch finally throw typeof instanceof in of delete void yield static get set',
    types: 'Array Object String Number Boolean Promise Map Set WeakMap WeakSet Symbol BigInt JSON Math Date RegExp Error TypeError',
    builtins: 'console process require module exports globalThis fetch setTimeout clearTimeout setInterval clearInterval structuredClone URL URLSearchParams TextEncoder TextDecoder Buffer'
  },
  {
    id: 'typescript', name: 'TypeScript', short: 'TS', extensions: ['ts','tsx'], mode: 'ts',
    line: ['//'], block: ['/*','*/'], indent: 'spaces', runtime: 'node', test: 'node --test',
    keywords: 'const let var function return if else for while do switch case break continue new class extends super this async await import export from default try catch finally throw typeof instanceof in of delete void yield static get set type interface enum namespace declare abstract implements public private protected readonly as satisfies keyof infer never unknown any',
    types: 'Array Object String Number Boolean Promise Map Set Record Partial Required Pick Omit Readonly JSON Math Date RegExp Error',
    builtins: 'console process require module exports globalThis fetch setTimeout setInterval URL URLSearchParams Buffer'
  },
  {
    id: 'python', name: 'Python', short: 'PY', extensions: ['py','pyw'], mode: 'python',
    line: ['#'], block: null, indent: 'spaces', runtime: 'python3', test: 'python3',
    keywords: 'def class return if elif else for while break continue pass import from as try except finally raise with lambda yield global nonlocal assert del in is not and or None True False async await match case',
    types: 'int float str bool list dict set tuple bytes bytearray complex object type',
    builtins: 'print len range str int float list dict set tuple sum min max sorted enumerate zip open input abs round any all isinstance map filter repr super property staticmethod classmethod'
  },
  {
    id: 'c', name: 'C', short: 'C', extensions: ['c','h'], mode: 'c',
    line: ['//'], block: ['/*','*/'], indent: 'spaces', runtime: 'gcc', test: 'make test',
    keywords: 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while _Bool',
    types: 'int char float double void size_t ssize_t FILE uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t',
    builtins: 'printf fprintf sprintf snprintf scanf malloc calloc realloc free memcpy memset strlen strcmp strcpy strncpy fopen fclose fread fwrite exit'
  },
  {
    id: 'cpp', name: 'C++', short: 'C++', extensions: ['cpp','cc','cxx','hpp','hh'], mode: 'cpp',
    line: ['//'], block: ['/*','*/'], indent: 'spaces', runtime: 'g++', test: 'make test',
    keywords: 'auto break case char const constexpr continue default do double else enum class extern float for friend if inline int long namespace new noexcept nullptr operator private protected public register return short signed sizeof static struct switch template this throw try catch typedef typename union unsigned using virtual void volatile while override final',
    types: 'std::string std::vector std::map std::unordered_map std::set int char float double void size_t',
    builtins: 'std::cout std::cerr std::cin std::endl printf malloc free memcpy strlen std::move std::make_unique std::make_shared'
  },
  {
    id: 'rust', name: 'Rust', short: 'RS', extensions: ['rs'], mode: 'rust',
    line: ['//'], block: ['/*','*/'], indent: 'spaces', runtime: 'rustc', test: 'cargo test',
    keywords: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
    types: 'i8 i16 i32 i64 u8 u16 u32 u64 usize isize f32 f64 bool char str String Vec Option Result Box Rc Arc HashMap HashSet',
    builtins: 'println! print! format! vec! panic! assert! assert_eq! Some None Ok Err'
  },
  {
    id: 'go', name: 'Go', short: 'GO', extensions: ['go'], mode: 'go',
    line: ['//'], block: ['/*','*/'], indent: 'tabs', runtime: 'go', test: 'go test',
    keywords: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
    types: 'bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr',
    builtins: 'append cap close complex copy delete imag len make new panic print println real recover'
  },
  {
    id: 'sql', name: 'SQL', short: 'SQL', extensions: ['sql'], mode: 'sql',
    line: ['--'], block: ['/*','*/'], indent: 'spaces', runtime: 'sqlite3', test: 'sqlite3',
    keywords: 'select from where insert into values update set delete create table alter drop index view trigger join left right inner outer on group by order having limit offset union all as distinct case when then else end begin commit rollback primary key foreign references not null default unique check',
    types: 'integer text real blob numeric varchar char boolean date timestamp',
    builtins: 'count sum avg min max coalesce ifnull nullif length substr upper lower round random'
  },
  {
    id: 'html', name: 'HTML', short: 'HTML', extensions: ['html','htm'], mode: 'html',
    line: [], block: ['<!--','-->'], indent: 'spaces', runtime: 'browser', test: 'browser',
    keywords: '', types: '', builtins: ''
  },
  {
    id: 'css', name: 'CSS', short: 'CSS', extensions: ['css','scss'], mode: 'css',
    line: ['//'], block: ['/*','*/'], indent: 'spaces', runtime: 'browser', test: 'browser',
    keywords: '@media @supports @import @keyframes from to and not only screen print', types: '', builtins: ''
  },
  {
    id: 'json', name: 'JSON', short: 'JSON', extensions: ['json','jsonc'], mode: 'json',
    line: [], block: null, indent: 'spaces', runtime: 'json', test: 'json',
    keywords: 'true false null', types: '', builtins: ''
  },
  {
    id: 'markdown', name: 'Markdown', short: 'MD', extensions: ['md','markdown'], mode: 'markdown',
    line: [], block: null, indent: 'spaces', runtime: 'text', test: 'text',
    keywords: '', types: '', builtins: ''
  },
  {
    id: 'bash', name: 'Shell', short: 'SH', extensions: ['sh','bash','zsh'], mode: 'bash',
    line: ['#'], block: null, indent: 'spaces', runtime: 'bash', test: 'bash',
    keywords: 'if then else elif fi for while until do done case in esac function return exit export local readonly set unset shift break continue source alias',
    types: '', builtins: 'echo printf read cd pwd test ls cat grep sed awk curl wget git python3 node gcc make chmod mkdir rm cp mv touch'
  },
  {
    id: 'yaml', name: 'YAML', short: 'YAML', extensions: ['yml','yaml'], mode: 'yaml',
    line: ['#'], block: null, indent: 'spaces', runtime: 'text', test: 'text',
    keywords: 'true false null yes no on off', types: '', builtins: ''
  },
  {
    id: 'toml', name: 'TOML', short: 'TOML', extensions: ['toml'], mode: 'toml',
    line: ['#'], block: null, indent: 'spaces', runtime: 'text', test: 'text',
    keywords: 'true false', types: '', builtins: ''
  },
  {
    id: 'text', name: 'Plain text', short: 'TXT', extensions: ['txt','log','env','ini','cfg','conf','gitignore','dockerfile','makefile'], mode: 'text',
    line: [], block: null, indent: 'spaces', runtime: 'text', test: 'text',
    keywords: '', types: '', builtins: ''
  }
];
const LANG_BY_ID = Object.fromEntries(LANGUAGES.map(l => [l.id, l]));
const LANG_BY_EXT = (() => {
  const map = {};
  for (const lang of LANGUAGES) for (const ext of lang.extensions) map[ext] = lang.id;
  // A few special filenames with no useful extension.
  map.makefile = 'text';
  map.dockerfile = 'text';
  map['.gitignore'] = 'text';
  return map;
})();

export function languages() {
  return LANGUAGES.map(l => ({
    id: l.id, name: l.name, short: l.short, extensions: l.extensions.slice(),
    runtime: l.runtime, test: l.test, indent: l.indent
  }));
}

export function languageFor(path, content = '') {
  const name = basename(String(path || '')).toLowerCase();
  if (name === 'makefile') return LANG_BY_ID.c;
  const ext = name.includes('.') ? name.split('.').pop() : name;
  let id = LANG_BY_EXT[ext] || LANG_BY_EXT[name] || null;
  if (!id && content) {
    if (/^#!.*\bpython/.test(content)) id = 'python';
    else if (/^#!.*\b(?:bash|sh|zsh)/.test(content)) id = 'bash';
    else if (/^#!.*\bnode/.test(content)) id = 'javascript';
    else if (/^#include\s*</.test(content)) id = 'c';
    else if (/^<!doctype html/i.test(content) || /<html[\s>]/i.test(content)) id = 'html';
    else if (/^\s*[\{\[]/.test(content)) id = 'json';
  }
  return LANG_BY_ID[id] || LANG_BY_ID.text;
}

export function languageName(id) { return (LANG_BY_ID[id] || LANG_BY_ID.text).name; }

/* ---------------- syntax highlighting ---------------- */
const escChar = c => esc(c);

function span(cls, text) { return text ? `<span class="${cls}">${esc(text)}</span>` : ''; }

function keywordSet(lang) {
  return new Set(String(lang.keywords || '').split(/\s+/).filter(Boolean));
}
function typeSet(lang) {
  return new Set(String(lang.types || '').split(/\s+/).filter(Boolean));
}
function builtinSet(lang) {
  return new Set(String(lang.builtins || '').split(/\s+/).filter(Boolean));
}

export function highlight(code, langId) {
  const src = String(code ?? '');
  if (src.length > SAFE_HIGHLIGHT_LIMIT) return esc(src);
  const lang = LANG_BY_ID[langId] || LANG_BY_ID.text;
  if (lang.mode === 'html') return highlightHTML(src, lang);
  if (lang.mode === 'markdown') return highlightMarkdown(src);
  if (lang.mode === 'json') return highlightGeneric(src, lang, { json: true });
  if (lang.mode === 'css') return highlightGeneric(src, lang, { css: true });
  return highlightGeneric(src, lang);
}

function highlightGeneric(src, lang, opts = {}) {
  const kw = keywordSet(lang), types = typeSet(lang), builtins = builtinSet(lang);
  const lineComment = (lang.line || []).find(Boolean) || null;
  const block = lang.block;
  let out = '';
  let i = 0;
  let lastNonSpace = '';
  const n = src.length;
  const isIdentStart = c => /[A-Za-z_$]/.test(c);
  const isIdent = c => /[A-Za-z0-9_$]/.test(c);
  while (i < n) {
    const c = src[i];
    // whitespace
    if (/\s/.test(c)) { out += escChar(c); i++; continue; }
    // line comment
    if (lineComment && src.startsWith(lineComment, i)) {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      out += span('tok-comment', src.slice(i, j));
      i = j;
      continue;
    }
    // block comment
    if (block && src.startsWith(block[0], i)) {
      let j = src.indexOf(block[1], i + block[0].length);
      j = j < 0 ? n : j + block[1].length;
      out += span('tok-comment', src.slice(i, j));
      i = j;
      continue;
    }
    // python triple quoted strings
    if (lang.mode === 'python' && (src.startsWith('"""', i) || src.startsWith("'''", i))) {
      const q = src.slice(i, i + 3);
      let j = src.indexOf(q, i + 3);
      j = j < 0 ? n : j + 3;
      out += span('tok-str', src.slice(i, j));
      i = j;
      lastNonSpace = '"';
      continue;
    }
    // strings
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === quote) { j++; break; }
        if (quote !== '`' && src[j] === '\n') break;
        j++;
      }
      out += span('tok-str', src.slice(i, j));
      i = j;
      lastNonSpace = quote;
      continue;
    }
    // numbers
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = src.slice(i).match(/^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)/);
      const text = m ? m[0] : c;
      out += span('tok-num', text);
      i += text.length;
      lastNonSpace = text;
      continue;
    }
    // identifiers
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdent(src[j])) j++;
      const word = src.slice(i, j);
      let after = j;
      while (after < n && /[ \t]/.test(src[after])) after++;
      const next = src[after] || '';
      let cls = 'tok-id';
      if (opts.json) {
        cls = /^(true|false|null)$/.test(word) ? 'tok-kw' : (next === ':' ? 'tok-attr' : 'tok-id');
      } else if (kw.has(word)) cls = 'tok-kw';
      else if (types.has(word)) cls = 'tok-type';
      else if (builtins.has(word)) cls = 'tok-builtin';
      else if (lastNonSpace === '.' || lastNonSpace === '@') cls = 'tok-prop';
      else if (/^[A-Z][A-Z0-9_]+$/.test(word)) cls = 'tok-const';
      else if (next === '(') cls = 'tok-fn';
      else if (/^[A-Z]/.test(word)) cls = 'tok-type';
      else if (opts.css && next === ':') cls = 'tok-prop';
      out += span(cls, word);
      i = j;
      lastNonSpace = word;
      continue;
    }
    // decorators / annotations
    if (c === '@' && lang.mode === 'python') {
      const m = src.slice(i).match(/^@[A-Za-z_][\w.]*/);
      if (m) { out += span('tok-meta', m[0]); i += m[0].length; lastNonSpace = '@'; continue; }
    }
    // operators and punctuation
    if (/[{}()[\];:,.<>=+\-*/%&|^!?~]/.test(c)) {
      out += span('tok-op', c);
      i++;
      lastNonSpace = c;
      continue;
    }
    out += escChar(c);
    lastNonSpace = c;
    i++;
  }
  return out;
}

function highlightHTML(src, lang) {
  let out = '';
  let i = 0;
  const n = src.length;
  const pushText = text => { out += esc(text); };
  while (i < n) {
    if (src.startsWith('<!--', i)) {
      let j = src.indexOf('-->', i + 4);
      j = j < 0 ? n : j + 3;
      out += span('tok-comment', src.slice(i, j));
      i = j;
      continue;
    }
    if (src[i] === '<') {
      let j = src.indexOf('>', i + 1);
      if (j < 0) { pushText(src.slice(i)); break; }
      const tag = src.slice(i, j + 1);
      out += spanTag(tag);
      i = j + 1;
      continue;
    }
    let j = src.indexOf('<', i);
    if (j < 0) j = n;
    pushText(src.slice(i, j));
    i = j;
  }
  return out;
}

function spanTag(tag) {
  let out = '';
  let i = 0;
  const n = tag.length;
  while (i < n) {
    const c = tag[i];
    if (c === '<' || c === '/' || c === '>' || c === '=' || c === '!' || c === '?') {
      out += span('tok-op', c); i++; continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      while (j < n && tag[j] !== q) j++;
      j = Math.min(n, j + 1);
      out += span('tok-str', tag.slice(i, j));
      i = j;
      continue;
    }
    if (/\s/.test(c)) { out += esc(c); i++; continue; }
    let j = i;
    while (j < n && /[A-Za-z0-9_:.-]/.test(tag[j])) j++;
    const word = tag.slice(i, j);
    let after = j;
    while (after < n && /\s/.test(tag[after])) after++;
    let cls = 'tok-tag';
    if (tag[after] === '=') cls = 'tok-attr';
    if (/^(html|head|body|div|span|p|a|img|script|style|link|meta|title|h[1-6]|section|header|footer|main|nav|button|form|input|label|canvas|svg|ul|ol|li|table|tr|td|th)$/i.test(word)) cls = 'tok-tag';
    out += span(cls, word);
    i = j || i + 1;
  }
  return out;
}

function highlightMarkdown(src) {
  const lines = src.split('\n');
  let inFence = false;
  return lines.map(line => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return span('tok-comment', line); }
    if (inFence) return span('tok-code', line);
    if (/^\s*#{1,6}\s/.test(line)) return span('tok-head', inlineMarkdown(line));
    if (/^\s*>\s?/.test(line)) return span('tok-quote', inlineMarkdown(line));
    if (/^\s*(?:[-*+]|\d+\.)\s/.test(line)) return span('tok-list', inlineMarkdown(line));
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) return span('tok-op', line);
    return inlineMarkdown(line);
  }).join('\n');
}

function inlineMarkdown(text) {
  const parts = String(text).split(/(`[^`]*`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map(part => {
    if (!part) return '';
    if (part.startsWith('`') && part.endsWith('`')) return span('tok-code', part);
    if (part.startsWith('**') && part.endsWith('**')) return span('tok-bold', part);
    if (/^\[[^\]]+\]\([^)]+\)$/.test(part)) {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      return span('tok-link', m[1]) + span('tok-op', '(') + span('tok-url', m[2]) + span('tok-op', ')');
    }
    return esc(part);
  }).join('');
}

/* ---------------- static analysis ---------------- */
function maskCode(code, lang) {
  const src = String(code || '');
  const out = src.split('');
  const lineComment = (lang.line || []).find(Boolean) || null;
  const block = lang.block;
  const n = src.length;
  let i = 0;
  while (i < n) {
    if (lineComment && src.startsWith(lineComment, i)) {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      for (let k = i; k < j; k++) out[k] = ' ';
      i = j;
      continue;
    }
    if (block && src.startsWith(block[0], i)) {
      let j = src.indexOf(block[1], i + block[0].length);
      j = j < 0 ? n : j + block[1].length;
      for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' ';
      i = j;
      continue;
    }
    if (lang.mode === 'python' && (src.startsWith('"""', i) || src.startsWith("'''", i))) {
      const q = src.slice(i, i + 3);
      let j = src.indexOf(q, i + 3);
      j = j < 0 ? n : j + 3;
      for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' ';
      i = j;
      continue;
    }
    if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const q = src[i];
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === q) { j++; break; }
        if (q !== '`' && src[j] === '\n') break;
        j++;
      }
      for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' ';
      i = j;
      continue;
    }
    i++;
  }
  return out.join('');
}

function indexToLineCol(text, index) {
  const before = text.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

function problem(line, col, severity, message, rule) {
  return { line: Math.max(1, line), col: Math.max(1, col), severity, message, rule };
}

export function lint(code, langId, path = '') {
  const src = String(code ?? '');
  const lang = LANG_BY_ID[langId] || languageFor(path, src);
  const problems = [];
  const add = (line, col, severity, message, rule) => {
    if (problems.length < 80) problems.push(problem(line, col, severity, message, rule));
  };
  const rawLines = src.replace(/\r/g, '').split('\n');
  const masked = maskCode(src, lang);
  const maskedLines = masked.split('\n');

  // Bracket balance on the masked text, so strings/comments do not count.
  const stack = [];
  const pairs = { '(': ')', '[': ']', '{': '}' };
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (pairs[c]) stack.push({ c, i });
    else if (c === ')' || c === ']' || c === '}') {
      const top = stack.pop();
      const pos = indexToLineCol(masked, i);
      if (!top || pairs[top.c] !== c) add(pos.line, pos.col, 'error', `Unexpected '${c}'.`, 'bracket-match');
    }
  }
  for (const open of stack.slice(-4)) {
    const pos = indexToLineCol(masked, open.i);
    add(pos.line, pos.col, 'error', `'${open.c}' is never closed.`, 'bracket-match');
  }

  // JSON is precise enough to validate outright.
  if (lang.id === 'json') {
    try { JSON.parse(src); }
    catch (err) {
      const msg = String(err?.message || 'Invalid JSON');
      const m = msg.match(/position\s+(\d+)/i);
      const pos = m ? indexToLineCol(src, Number(m[1])) : { line: 1, col: 1 };
      add(pos.line, pos.col, 'error', msg.replace(/\s*in JSON at position.*$/i, ''), 'json-parse');
    }
  }

  // Per-line hygiene and language-specific heuristics.
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const line = maskedLines[i] || '';
    const ln = i + 1;
    if (raw.length > 180) add(ln, 181, 'info', `Line is ${raw.length} characters; consider wrapping.`, 'max-line-length');
    if (/[ \t]+$/.test(raw)) add(ln, raw.length, 'info', 'Trailing whitespace.', 'trailing-whitespace');
    if (/\b(TODO|FIXME|XXX|HACK)\b/.test(raw)) add(ln, raw.search(/\b(TODO|FIXME|XXX|HACK)\b/) + 1, 'info', 'Unfinished work marker.', 'todo');
    if (/^\s*\t+/.test(raw) && ['javascript','typescript','python','c','cpp','rust','go','sql'].includes(lang.id)) {
      add(ln, 1, 'warning', 'Tab indentation mixed with space-based style.', 'indent-style');
    }
    if (lang.mode === 'js' || lang.mode === 'ts') {
      if (/\bvar\s+[A-Za-z_$]/.test(line)) add(ln, line.indexOf('var') + 1, 'warning', 'Prefer let or const over var.', 'no-var');
      if (/(^|[^=!<>])(?:==|!=)(?!=)/.test(line)) add(ln, 1, 'warning', 'Use strict equality (=== / !==).', 'eqeqeq');
      if (/\bconsole\.(?:log|debug)\s*\(/.test(line)) add(ln, line.indexOf('console') + 1, 'info', 'Remove debug logging before release.', 'no-console');
      if (/\bdebugger\b/.test(line)) add(ln, line.indexOf('debugger') + 1, 'warning', 'Debugger statement left in code.', 'no-debugger');
      if (/\beval\s*\(/.test(line)) add(ln, line.indexOf('eval') + 1, 'warning', 'eval executes arbitrary strings.', 'no-eval');
      if (/\bdocument\.write\s*\(/.test(line)) add(ln, line.indexOf('document.write') + 1, 'warning', 'document.write can overwrite the page.', 'no-document-write');
    }
    if (lang.id === 'python') {
      if (/^\s*except\s*:/.test(line)) add(ln, 1, 'warning', 'Bare except catches every exception.', 'no-bare-except');
      if (/==\s*None|!=\s*None/.test(line)) add(ln, 1, 'warning', 'Use "is None" / "is not None".', 'none-comparison');
      if (/^\s*print\s+[^(]/.test(raw) && !/^\s*#/.test(raw)) add(ln, 1, 'info', 'Python 3 print needs parentheses.', 'print-parens');
    }
    if (lang.id === 'c' || lang.id === 'cpp') {
      if (/\bgets\s*\(/.test(line)) add(ln, line.indexOf('gets') + 1, 'error', 'gets cannot be used safely.', 'no-gets');
      if (/\bstrcpy\s*\(/.test(line)) add(ln, line.indexOf('strcpy') + 1, 'warning', 'Prefer snprintf over strcpy.', 'bounded-copy');
      if (/\bsystem\s*\(/.test(line)) add(ln, line.indexOf('system') + 1, 'info', 'Shell execution from C is risky.', 'no-system');
    }
    if (lang.id === 'html') {
      if (/target\s*=\s*["']_blank["']/i.test(raw) && !/rel\s*=/.test(raw)) add(ln, 1, 'warning', 'Add rel="noopener" to target="_blank" links.', 'noopener');
      if (/<img\b/i.test(raw) && !/\balt\s*=/.test(raw)) add(ln, 1, 'warning', 'Images need alt text for accessibility.', 'img-alt');
      if (/http:\/\//i.test(raw) && !/localhost|127\.0\.0\.1/.test(raw)) add(ln, 1, 'warning', 'Insecure http:// reference.', 'no-insecure-http');
    }
    if (lang.id === 'bash') {
      if (/rm\s+-rf\s+\/(?:\s|$)/.test(raw)) add(ln, 1, 'error', 'This command would delete the root filesystem.', 'dangerous-rm');
      if (/chmod\s+777\b/.test(raw)) add(ln, 1, 'warning', '777 permissions grant write access to everyone.', 'world-writable');
    }
    if (/(api[_-]?key|secret|token|passwd|password)\s*[:=]\s*['"][^'"]{6,}/i.test(raw)) {
      add(ln, 1, 'warning', 'Possible hard-coded credential.', 'hardcoded-secret');
    }
  }
  if (lang.id === 'c' || lang.id === 'cpp') {
    if (/\bprintf\s*\(/.test(src) && !/#include\s*<stdio\.h>/.test(src)) {
      add(1, 1, 'error', 'printf is used without #include <stdio.h>.', 'missing-include');
    }
  }
  if (src.length && !src.endsWith('\n')) add(rawLines.length, rawLines[rawLines.length - 1].length + 1, 'info', 'File has no final newline.', 'final-newline');
  return problems;
}

export function formatCode(code, langId) {
  const lang = LANG_BY_ID[langId] || LANG_BY_ID.text;
  let src = String(code ?? '').replace(/\r\n?/g, '\n');
  if (lang.id === 'json') {
    try { src = JSON.stringify(JSON.parse(src), null, 2) + '\n'; }
    catch { /* leave malformed JSON alone */ }
  }
  const lines = src.split('\n').map(line => {
    let out = line.replace(/[ \t]+$/g, '');
    if (out.startsWith('\t')) out = out.replace(/^\t+/, m => '    '.repeat(m.length));
    return out;
  });
  let text = '';
  let blanks = 0;
  for (const line of lines) {
    if (!line.trim()) {
      blanks++;
      if (blanks > 2) continue;
    } else blanks = 0;
    text += line + '\n';
  }
  return text.replace(/\n+$/, '\n');
}

export function outline(code, langId) {
  const lang = LANG_BY_ID[langId] || LANG_BY_ID.text;
  const rawLines = String(code ?? '').replace(/\r/g, '').split('\n');
  const masked = maskCode(String(code ?? ''), lang).split('\n');
  const out = [];
  const push = (name, kind, line, indent = 0) => {
    if (!name || out.length >= 200) return;
    out.push({ name: String(name).trim(), kind, line, indent });
  };
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const line = masked[i] || '';
    const indent = raw.match(/^\s*/)[0].replace(/\t/g, '    ').length;
    if (lang.mode === 'markdown') {
      const m = raw.match(/^(#{1,6})\s+(.+)$/);
      if (m) push(m[2].replace(/[#*`]/g, '').trim(), `h${m[1].length}`, i + 1, (m[1].length - 1) * 2);
      continue;
    }
    if (lang.id === 'html') {
      const ids = [...raw.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)];
      for (const id of ids) push(`#${id[1]}`, 'id', i + 1, indent);
      continue;
    }
    if (lang.id === 'css') {
      const m = raw.match(/^\s*([.#][\w-]+(?:\s*[>+~]?\s*[.#\w-]+)*)\s*\{/);
      if (m) push(m[1].trim(), 'selector', i + 1, indent);
      continue;
    }
    if (lang.id === 'python') {
      let m = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/);
      if (m) { push(m[1], 'function', i + 1, indent); continue; }
      m = line.match(/^\s*class\s+([A-Za-z_]\w*)/);
      if (m) { push(m[1], 'class', i + 1, indent); continue; }
      continue;
    }
    if (lang.id === 'javascript' || lang.id === 'typescript') {
      let m = line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
      if (m) { push(m[1], 'function', i + 1, indent); continue; }
      m = line.match(/^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/);
      if (m) { push(m[1], 'class', i + 1, indent); continue; }
      m = line.match(/^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/);
      if (m) { push(m[1], 'type', i + 1, indent); continue; }
      m = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function)/);
      if (m) { push(m[1], 'function', i + 1, indent); continue; }
      continue;
    }
    if (lang.id === 'c' || lang.id === 'cpp') {
      let m = line.match(/^\s*(?:static\s+)?(?:inline\s+)?(?:[A-Za-z_][\w:<>*&]*\s+)+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/);
      if (m) { push(m[1], 'function', i + 1, indent); continue; }
      m = line.match(/^\s*(?:typedef\s+)?struct\s+([A-Za-z_]\w*)/);
      if (m) { push(m[1], 'struct', i + 1, indent); continue; }
      continue;
    }
    if (lang.id === 'rust') {
      let m = line.match(/^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/);
      if (m) { push(m[1], 'function', i + 1, indent); continue; }
      m = line.match(/^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)/);
      if (m) { push(m[1], 'type', i + 1, indent); continue; }
      continue;
    }
    if (lang.id === 'go') {
      let m = line.match(/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/);
      if (m) { push(m[1], 'function', i + 1, indent); continue; }
      m = line.match(/^\s*type\s+([A-Za-z_]\w*)/);
      if (m) { push(m[1], 'type', i + 1, indent); continue; }
      continue;
    }
    if (lang.id === 'bash') {
      const m = line.match(/^\s*(?:function\s+)?([A-Za-z_]\w*)\s*\(\)\s*\{/);
      if (m) push(m[1], 'function', i + 1, indent);
      continue;
    }
    if (lang.id === 'sql') {
      const m = line.match(/^\s*create\s+(?:table|view|index|trigger)\s+(?:if\s+not\s+exists\s+)?([A-Za-z_]\w*)/i);
      if (m) push(m[1], 'table', i + 1, indent);
    }
  }
  return out;
}

export function completions(code, langId, prefix = '') {
  const lang = LANG_BY_ID[langId] || LANG_BY_ID.text;
  const p = String(prefix || '').toLowerCase();
  const out = [];
  const seen = new Set();
  const add = (label, kind, detail, insert = label) => {
    if (!label || seen.has(label) || out.length >= 60) return;
    if (p && !label.toLowerCase().startsWith(p) && !label.toLowerCase().includes(p)) return;
    seen.add(label);
    out.push({ label, kind, detail, insert });
  };
  for (const word of String(lang.keywords || '').split(/\s+/).filter(Boolean)) add(word, 'keyword', 'language keyword');
  for (const word of String(lang.types || '').split(/\s+/).filter(Boolean)) add(word, 'type', 'built-in type');
  for (const word of String(lang.builtins || '').split(/\s+/).filter(Boolean)) add(word, 'builtin', 'standard library');
  for (const sym of outline(code, lang.id)) add(sym.name, sym.kind, `line ${sym.line}`);
  for (const snip of snippetsFor(lang.id)) add(snip.label, 'snippet', snip.detail, snip.body.replace(/\|/g, ''));
  return out.slice(0, 40);
}

const BASE_SNIPPETS = [
  { trigger: 'log', label: 'log', detail: 'print a value', body: 'console.log(|);', langs: ['javascript','typescript'] },
  { trigger: 'fn', label: 'fn', detail: 'function', body: 'function |() {\n    \n}', langs: ['javascript','typescript'] },
  { trigger: 'afn', label: 'afn', detail: 'async function', body: 'async function |() {\n    \n}', langs: ['javascript','typescript'] },
  { trigger: 'try', label: 'try', detail: 'try / catch', body: 'try {\n    |\n} catch (error) {\n    console.error(error);\n}', langs: ['javascript','typescript'] },
  { trigger: 'fetch', label: 'fetch', detail: 'fetch JSON', body: 'const response = await fetch("|");\nconst data = await response.json();', langs: ['javascript','typescript'] },
  { trigger: 'def', label: 'def', detail: 'function', body: 'def |():\n    pass', langs: ['python'] },
  { trigger: 'class', label: 'class', detail: 'class', body: 'class |:\n    def __init__(self):\n        pass', langs: ['python'] },
  { trigger: 'main', label: 'main', detail: 'main guard', body: 'if __name__ == "__main__":\n    |', langs: ['python'] },
  { trigger: 'with', label: 'with', detail: 'open a file', body: 'with open("|", "r", encoding="utf-8") as handle:\n    data = handle.read()', langs: ['python'] },
  { trigger: 'printf', label: 'printf', detail: 'formatted output', body: 'printf("|\\n");', langs: ['c','cpp'] },
  { trigger: 'main', label: 'main', detail: 'C main', body: 'int main(int argc, char **argv) {\n    |\n    return 0;\n}', langs: ['c','cpp'] },
  { trigger: 'html', label: 'html', detail: 'HTML document', body: '<!doctype html>\n<html lang="en">\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>|</title>\n</head>\n<body>\n    \n</body>\n</html>', langs: ['html'] },
  { trigger: 'fetch', label: 'fetch', detail: 'fetch and render', body: 'fetch("|")\n    .then(response => response.json())\n    .then(data => console.log(data));', langs: ['html'] },
  { trigger: 'test', label: 'test', detail: 'test case', body: 'test("|", () => {\n    assert.equal(1, 1);\n});', langs: ['javascript','typescript'] }
];

export function snippetsFor(langId) {
  return BASE_SNIPPETS.filter(s => s.langs.includes(langId)).map(s => ({ ...s, body: s.body }));
}

export function runCommandFor(path, langId) {
  const p = String(path || '').replace(/"/g, '\\"');
  const lang = LANG_BY_ID[langId] || languageFor(path);
  switch (lang.id) {
    case 'python': return { kind: 'run', command: `python3 "${p}"`, label: 'Run Python' };
    case 'javascript': return { kind: 'run', command: `node "${p}"`, label: 'Run Node' };
    case 'typescript': return { kind: 'build', command: `tsc "${p}" --outDir /tmp/tsbuild && node "/tmp/tsbuild/${basename(p).replace(/\.tsx?$/, '.js')}"`, label: 'Compile and run TypeScript' };
    case 'c': return { kind: 'build', command: `gcc "${p}" -o /tmp/app && /tmp/app`, label: 'Compile and run C' };
    case 'cpp': return { kind: 'build', command: `g++ "${p}" -o /tmp/app && /tmp/app`, label: 'Compile and run C++' };
    case 'rust': return { kind: 'build', command: `rustc "${p}" -o /tmp/app && /tmp/app`, label: 'Compile and run Rust' };
    case 'go': return { kind: 'build', command: `go run "${p}"`, label: 'Run Go' };
    case 'bash': return { kind: 'run', command: `bash "${p}"`, label: 'Run shell script' };
    case 'sql': return { kind: 'run', command: `sqlite3 /tmp/query.db < "${p}"`, label: 'Execute SQL' };
    case 'html': return { kind: 'preview', command: null, label: 'Preview page' };
    case 'json': return { kind: 'validate', command: `cat "${p}"`, label: 'Validate JSON' };
    case 'markdown': return { kind: 'preview', command: null, label: 'Preview Markdown' };
    default: return { kind: 'run', command: `cat "${p}"`, label: 'Run' };
  }
}

export function testCommandFor(path, langId) {
  const p = String(path || '').replace(/"/g, '\\"');
  const lang = LANG_BY_ID[langId] || languageFor(path);
  switch (lang.id) {
    case 'python': return `python3 "${p}"`;
    case 'javascript': return `node --test "${p}"`;
    case 'typescript': return `node --test "${p}"`;
    case 'c': case 'cpp': return 'make test';
    case 'rust': return 'cargo test';
    case 'go': return 'go test ./...';
    case 'sql': return `sqlite3 /tmp/test.db < "${p}"`;
    default: return null;
  }
}

/* ---------------- project analysis ---------------- */
const IGNORED_DIRS = /(^|\/)(?:\.git|node_modules|dist|build|\.cache|vendor|target|coverage)(\/|$)/;
const MANIFEST_NAMES = new Set(['package.json','requirements.txt','pyproject.toml','Cargo.toml','go.mod','Makefile','makefile','Dockerfile','docker-compose.yml','compose.yml','tsconfig.json','vite.config.js','webpack.config.js','.gitignore','README.md']);

function isTextPath(path) {
  const name = basename(path).toLowerCase();
  return TEXT_FILE.test(path) || MANIFEST_NAMES.has(basename(path)) || /^readme/i.test(name) || name === 'license';
}

export function analyzeProject(fs, root = '/home/operator') {
  const files = (allFiles(fs, root) || [])
    .filter(f => !IGNORED_DIRS.test(f.path))
    .slice(0, 3000);
  const languages = {};
  let lines = 0, bytes = 0, todos = 0, tests = 0, textFiles = 0;
  const largest = [];
  const manifests = [];
  const todosByFile = [];
  for (const file of files) {
    const size = (file.node.content || '').length;
    bytes += size;
    const name = basename(file.path);
    if (MANIFEST_NAMES.has(name)) manifests.push(file.path);
    if (/(^|\/)(tests?|__tests__|spec)(\/|\.|$)/i.test(file.path) || /\.(test|spec)\.[a-z]+$/i.test(file.path)) tests++;
    if (!isTextPath(file.path) || BINARY_FILE.test(file.path) || size > 400000) continue;
    textFiles++;
    const content = file.node.content || '';
    const count = content.split('\n').length;
    lines += count;
    const lang = languageFor(file.path, content);
    const entry = languages[lang.id] || (languages[lang.id] = { id: lang.id, name: lang.name, files: 0, lines: 0 });
    entry.files++;
    entry.lines += count;
    const flags = content.match(/\b(TODO|FIXME|XXX|HACK)\b/g);
    if (flags) { todos += flags.length; todosByFile.push({ path: file.path, count: flags.length }); }
    largest.push({ path: file.path, lines: count, bytes: size, language: lang.id });
  }
  largest.sort((a, b) => b.lines - a.lines);
  const hasGit = !!getNode(fs, joinPath(root, '.git/repo.json'));
  const hasReadme = files.some(f => /^readme(\.|$)/i.test(basename(f.path)));
  const hasManifest = manifests.length > 0;
  const hasTests = tests > 0;
  const testFiles = files.filter(f => /(^|\/)(tests?|__tests__|spec)(\/|\.|$)/i.test(f.path) || /\.(test|spec)\.[a-z]+$/i.test(f.path)).slice(0, 20).map(f => f.path);
  let health = 42;
  if (hasReadme) health += 10;
  if (hasManifest) health += 10;
  if (hasTests) health += 16;
  if (hasGit) health += 8;
  if (textFiles === 0) health -= 10;
  health -= Math.min(18, todos * 2);
  if (languages.javascript || languages.typescript || languages.python) health += 4;
  health = clamp(Math.round(health), 0, 100);
  const checks = [];
  if (!hasReadme) checks.push('Add a README that explains what the project does.');
  if (!hasTests) checks.push('Add at least one test so changes can be verified.');
  if (!hasGit) checks.push('Initialise version control with git init.');
  if (todos > 0) checks.push(`Resolve or label ${todos} TODO/FIXME marker${todos === 1 ? '' : 's'}.`);
  if (!hasManifest) checks.push('Add a manifest or Makefile so builds are reproducible.');
  return {
    root, files: files.length, textFiles, lines, bytes, languages: Object.values(languages).sort((a, b) => b.lines - a.lines),
    largest: largest.slice(0, 8), manifests: manifests.slice(0, 12), tests, testFiles, todos, todosByFile: todosByFile.slice(0, 8),
    hasGit, hasReadme, hasManifest, hasTests, health, checks
  };
}

export function findInProject(fs, root, query, opts = {}) {
  const q = String(query || '');
  if (!q) return [];
  const max = clamp(Number(opts.max) || 120, 1, 300);
  const out = [];
  const files = (allFiles(fs, root) || []).filter(f => !IGNORED_DIRS.test(f.path)).slice(0, 2500);
  for (const file of files) {
    if (!isTextPath(file.path) || BINARY_FILE.test(file.path)) continue;
    const content = file.node.content || '';
    if (content.length > 400000) continue;
    let index = content.toLowerCase().indexOf(q.toLowerCase());
    while (index >= 0 && out.length < max) {
      const before = content.slice(0, index).split('\n');
      const line = before.length;
      const col = before[before.length - 1].length + 1;
      const text = content.split('\n')[line - 1] || '';
      out.push({ path: file.path, line, col, text: text.trim().slice(0, 180) });
      index = content.toLowerCase().indexOf(q.toLowerCase(), index + q.length);
    }
    if (out.length >= max) break;
  }
  return out;
}

/* ---------------- project scaffolding ---------------- */
const TEMPLATES = [
  {
    id: 'blank', name: 'Blank workspace', description: 'A README and nothing else. Start from zero.',
    language: 'text', files: ['README.md'], build: () => ({ 'README.md': '# {{name}}\n\n{{name}} is a new workspace.\n\n## Notes\n\n- Add source files.\n- Keep a README current.\n' })
  },
  {
    id: 'web', name: 'Static website', description: 'HTML, CSS and JavaScript with a responsive starter page.',
    language: 'html', files: ['index.html','styles.css','app.js','README.md'], build: () => ({
      'index.html': '<!doctype html>\n<html lang="en">\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>{{name}}</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n    <main>\n        <h1>{{name}}</h1>\n        <p id="status">Loading…</p>\n    </main>\n    <script src="app.js"></script>\n</body>\n</html>\n',
      'styles.css': ':root {\n    color-scheme: dark;\n    --bg: #0b1013;\n    --text: #d7e2e8;\n    --accent: #79e6a3;\n}\n\nbody {\n    margin: 0;\n    min-height: 100vh;\n    display: grid;\n    place-items: center;\n    background: var(--bg);\n    color: var(--text);\n    font-family: system-ui, sans-serif;\n}\n\nmain {\n    max-width: 42rem;\n    padding: 2rem;\n}\n\nh1 { color: var(--accent); }\n',
      'app.js': "const status = document.getElementById('status');\nstatus.textContent = 'The page is alive.';\nconsole.log('{{name}} loaded');\n",
      'README.md': '# {{name}}\n\nA static site. Open `index.html` in the browser, or run a local server.\n\n## Files\n\n- `index.html` — document structure\n- `styles.css` — presentation\n- `app.js` — behaviour\n'
    })
  },
  {
    id: 'python', name: 'Python project', description: 'A small Python package with tests and a Makefile.',
    language: 'python', files: ['main.py','test_main.py','Makefile','README.md','.gitignore'], build: () => ({
      'main.py': '"""{{name}} — a small Python project."""\n\nimport argparse\n\n\ndef greet(name: str = "world") -> str:\n    return f"Hello, {name}."\n\n\ndef main() -> int:\n    parser = argparse.ArgumentParser(description="{{name}}")\n    parser.add_argument("name", nargs="?", default="world")\n    args = parser.parse_args()\n    print(greet(args.name))\n    return 0\n\n\nif __name__ == "__main__":\n    raise SystemExit(main())\n',
      'test_main.py': 'import unittest\n\nfrom main import greet\n\n\nclass GreetTests(unittest.TestCase):\n    def test_default(self):\n        self.assertEqual(greet(), "Hello, world.")\n\n    def test_name(self):\n        self.assertEqual(greet("Kai"), "Hello, Kai.")\n\n\nif __name__ == "__main__":\n    unittest.main()\n',
      'Makefile': 'run:\n\tpython3 main.py\n\ntest:\n\tpython3 -m unittest -v\n\n.PHONY: run test\n',
      'README.md': '# {{name}}\n\n```sh\nmake run\nmake test\n```\n',
      '.gitignore': '__pycache__/\n*.pyc\n.venv/\n'
    })
  },
  {
    id: 'node', name: 'Node.js CLI', description: 'A dependency-free Node CLI with a test file and package manifest.',
    language: 'javascript', files: ['package.json','index.js','test.js','README.md','.gitignore'], build: () => ({
      'package.json': JSON.stringify({ name: '{{slug}}', version: '0.1.0', private: true, type: 'module', bin: { '{{slug}}': './index.js' }, scripts: { start: 'node index.js', test: 'node --test test.js' } }, null, 2) + '\n',
      'index.js': "#!/usr/bin/env node\n\nexport function greet(name = 'world') {\n    return `Hello, ${name}.`;\n}\n\nif (process.argv[1] && process.argv[1].endsWith('index.js')) {\n    console.log(greet(process.argv[2]));\n}\n",
      'test.js': "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { greet } from './index.js';\n\ntest('greets the world', () => {\n    assert.equal(greet(), 'Hello, world.');\n});\n",
      'README.md': '# {{name}}\n\n```sh\nnode index.js\nnode --test test.js\n```\n',
      '.gitignore': 'node_modules/\n.env\n'
    })
  },
  {
    id: 'api', name: 'HTTP API', description: 'A small JSON API using only the Node standard library.',
    language: 'javascript', files: ['package.json','server.js','test.js','README.md','.gitignore'], build: () => ({
      'package.json': JSON.stringify({ name: '{{slug}}-api', version: '0.1.0', private: true, type: 'module', scripts: { start: 'node server.js', test: 'node --test test.js' } }, null, 2) + '\n',
      'server.js': "import { createServer } from 'node:http';\n\nconst routes = {\n    '/health': () => ({ ok: true }),\n    '/': () => ({ service: '{{name}}', version: '0.1.0' })\n};\n\nexport function handler(req, res) {\n    const route = routes[req.url];\n    res.setHeader('content-type', 'application/json');\n    if (!route) {\n        res.statusCode = 404;\n        res.end(JSON.stringify({ error: 'not found' }));\n        return;\n    }\n    res.end(JSON.stringify(route()));\n}\n\nif (process.argv[1] && process.argv[1].endsWith('server.js')) {\n    createServer(handler).listen(3000, () => console.log('listening on :3000'));\n}\n",
      'test.js': "import test from 'node:test';\nimport assert from 'node:assert/strict';\n\n// Endpoint behaviour is exercised through the HTTP runtime when deployed.\ntest('api scaffold exists', () => assert.ok(true));\n",
      'README.md': '# {{name}}\n\nA minimal JSON API.\n\n```sh\nnode server.js\ncurl http://localhost:3000/health\n```\n',
      '.gitignore': 'node_modules/\n.env\n'
    })
  },
  {
    id: 'game', name: 'Canvas game', description: 'A small browser game loop with keyboard input and a score.',
    language: 'javascript', files: ['index.html','game.js','styles.css','README.md'], build: () => ({
      'index.html': '<!doctype html>\n<html lang="en">\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>{{name}}</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n    <canvas id="game" width="640" height="360"></canvas>\n    <script src="game.js"></script>\n</body>\n</html>\n',
      'game.js': "const canvas = document.getElementById('game');\nconst ctx = canvas.getContext('2d');\nconst player = { x: 40, y: 160, size: 14, vy: 0 };\nlet score = 0;\n\naddEventListener('keydown', event => {\n    if (event.code === 'Space') player.vy = -6;\n});\n\nfunction frame() {\n    player.vy += .3;\n    player.y = Math.min(330, player.y + player.vy);\n    if (player.y >= 330) player.vy = 0;\n    score += .01;\n    ctx.fillStyle = '#0b1013';\n    ctx.fillRect(0, 0, canvas.width, canvas.height);\n    ctx.fillStyle = '#79e6a3';\n    ctx.fillRect(player.x, player.y, player.size, player.size);\n    ctx.fillStyle = '#d7e2e8';\n    ctx.fillText(`score ${Math.floor(score)}`, 12, 20);\n    requestAnimationFrame(frame);\n}\nframe();\n",
      'styles.css': 'html,body{height:100%;margin:0;display:grid;place-items:center;background:#070b0d}canvas{width:min(100vw,640px);image-rendering:pixelated;border:1px solid #1b232a}\n',
      'README.md': '# {{name}}\n\nPress Space to jump. Open `index.html` to play.\n'
    })
  },
  {
    id: 'library', name: 'Library package', description: 'A reusable module with a test file and package manifest.',
    language: 'javascript', files: ['package.json','index.js','index.test.js','README.md','.gitignore'], build: () => ({
      'package.json': JSON.stringify({ name: '{{slug}}', version: '0.1.0', type: 'module', main: 'index.js', exports: './index.js', scripts: { test: 'node --test index.test.js' } }, null, 2) + '\n',
      'index.js': "/** {{name}} */\nexport function sum(values) {\n    return values.reduce((total, value) => total + value, 0);\n}\n\nexport function unique(values) {\n    return [...new Set(values)];\n}\n",
      'index.test.js': "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { sum, unique } from './index.js';\n\ntest('sum', () => assert.equal(sum([1, 2, 3]), 6));\ntest('unique', () => assert.deepEqual(unique([1, 1, 2]), [1, 2]));\n",
      'README.md': '# {{name}}\n\nA small library.\n\n```js\nimport { sum } from \'./index.js\';\nconsole.log(sum([1, 2, 3]));\n```\n',
      '.gitignore': 'node_modules/\n'
    })
  },
  {
    id: 'c', name: 'C program', description: 'A C program with a Makefile and a small test target.',
    language: 'c', files: ['main.c','Makefile','README.md','.gitignore'], build: () => ({
      'main.c': '#include <stdio.h>\n\nint main(int argc, char **argv) {\n    const char *name = argc > 1 ? argv[1] : "world";\n    printf("Hello, %s.\\n", name);\n    return 0;\n}\n',
      'Makefile': 'CC=cc\nCFLAGS=-Wall -Wextra -O2\n\nall: app\n\napp: main.c\n\t$(CC) $(CFLAGS) -o app main.c\n\nrun: app\n\t./app\n\ntest: app\n\t./app test\n\nclean:\n\trm -f app\n\n.PHONY: all run test clean\n',
      'README.md': '# {{name}}\n\n```sh\nmake run\nmake test\n```\n',
      '.gitignore': 'app\n*.o\n'
    })
  },
  {
    id: 'docs', name: 'Documentation site', description: 'A Markdown handbook with a table of contents.',
    language: 'markdown', files: ['README.md','docs/getting-started.md','docs/reference.md'], build: () => ({
      'README.md': '# {{name}}\n\nA documentation workspace.\n\n- [Getting started](docs/getting-started.md)\n- [Reference](docs/reference.md)\n',
      'docs/getting-started.md': '# Getting started\n\nDescribe the first successful path through the project.\n\n1. Install the runtime.\n2. Clone the repository.\n3. Run the test suite.\n',
      'docs/reference.md': '# Reference\n\n| Name | Type | Description |\n| --- | --- | --- |\n| example | string | Replace this row. |\n'
    })
  }
];

export function projectTemplates() {
  return TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, language: t.language, files: t.files.slice() }));
}

export function scaffoldProject(fs, root, templateId, opts = {}) {
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) return { ok: false, error: `Unknown template '${templateId}'. Try: ${TEMPLATES.map(t => t.id).join(', ')}` };
  const name = String(opts.name || basename(root) || 'workspace').trim().slice(0, 60) || 'workspace';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const year = new Date().getFullYear();
  const files = template.build();
  const created = [];
  const skipped = [];
  for (const [rel, body] of Object.entries(files)) {
    const abs = joinPath(root, rel);
    if (getNode(fs, abs) && !opts.force) { skipped.push(rel); continue; }
    const content = String(body).replace(/\{\{name\}\}/g, name).replace(/\{\{slug\}\}/g, slug).replace(/\{\{year\}\}/g, year);
    if (writeFile(fs, abs, content, { owner: opts.owner || 'operator' })) created.push(rel);
  }
  if (opts.git !== false) {
    ensureDir(fs, joinPath(root, '.git'), opts.owner || 'operator');
    const repoPath = joinPath(root, '.git/repo.json');
    if (!getNode(fs, repoPath)) {
      writeFile(fs, repoPath, JSON.stringify({ branch: 'main', staged: [], commits: [], remote: null }, null, 2), { owner: opts.owner || 'operator' });
    }
  }
  return { ok: true, template, root, name, files: created, skipped, startedGit: opts.git !== false };
}

/* ---------------- coding progression ---------------- */
const XP_KINDS = {
  save: 1, run: 3, compile: 5, build: 6, test: 7, pass: 8, fail: 2,
  format: 1, fix: 3, commit: 10, scaffold: 8, publish: 12, review: 4,
  debug: 4, docs: 2, install: 2, deploy: 9, profile: 2
};

export function ensureCoding(game) {
  if (!game.coding || typeof game.coding !== 'object') {
    game.coding = {
      version: CODING_VERSION, startedAt: Date.now(), xp: 0, level: 1,
      counts: {}, linesWritten: 0, linesRemoved: 0, filesTouched: 0,
      streak: 0, lastDay: null, activeDays: [], history: [], projects: [],
      bugsFound: 0, bugsFixed: 0, builds: 0, releases: 0, deployments: 0
    };
  }
  const c = game.coding;
  c.version = CODING_VERSION;
  if (!c.counts || typeof c.counts !== 'object' || Array.isArray(c.counts)) c.counts = {};
  for (const key of ['activeDays','history','projects']) if (!Array.isArray(c[key])) c[key] = [];
  for (const key of ['xp','level','linesWritten','linesRemoved','filesTouched','streak','bugsFound','bugsFixed','builds','releases','deployments']) {
    if (typeof c[key] !== 'number' || !Number.isFinite(c[key])) c[key] = 0;
  }
  if (c.level < 1) c.level = 1;
  if (c.startedAt == null) c.startedAt = Date.now();
  return c;
}

export function codingLevel(xp) {
  return clamp(1 + Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 18)), 1, 60);
}
function xpForLevel(level) {
  return Math.pow(Math.max(1, level) - 1, 2) * 18;
}

export function recordCoding(game, kind, amount = 1, memo = '') {
  const c = ensureCoding(game);
  if (typeof amount === 'string') { memo = amount; amount = 1; }
  const count = clamp(Number(amount) || 1, 0.1, 1000);
  const base = XP_KINDS[kind] || 1;
  const before = codingLevel(c.xp);
  c.counts[kind] = (c.counts[kind] || 0) + count;
  c.xp += base * count;
  const after = codingLevel(c.xp);
  c.level = after;
  const day = Math.floor((Number(game.worldMinutes) || 0) / 1440);
  if (c.lastDay !== day) {
    if (c.lastDay != null && day === c.lastDay + 1) c.streak = (c.streak || 0) + 1;
    else c.streak = 1;
    c.lastDay = day;
    c.activeDays.push(day);
    if (c.activeDays.length > 90) c.activeDays = c.activeDays.slice(-90);
  }
  if (kind === 'pass') { c.bugsFixed = (c.bugsFixed || 0) + count; }
  if (kind === 'fix') { c.bugsFound = (c.bugsFound || 0) + count; }
  if (kind === 'build' || kind === 'compile') c.builds = (c.builds || 0) + count;
  if (kind === 'publish') c.releases = (c.releases || 0) + count;
  if (kind === 'deploy') c.deployments = (c.deployments || 0) + count;
  c.history.unshift({ world: Number(game.worldMinutes) || 0, kind, amount: count, memo: String(memo || '').slice(0, 120) });
  if (c.history.length > 60) c.history.length = 60;
  // Coding competence contributes a little to the civilization identity.
  if (game.civ?.player?.professional && ['compile','test','pass','commit','publish','deploy','review'].includes(kind)) {
    game.civ.player.professional.score = clamp((game.civ.player.professional.score || 0) + .02 * count, 0, 100);
  }
  return { level: after, xp: c.xp, leveled: after > before, streak: c.streak, gain: base * count };
}

/* Track an edit as a diff rather than a raw keystroke count. */
export function recordEdit(game, path, before = '', after = '') {
  const c = ensureCoding(game);
  const prev = String(before ?? '').split('\n');
  const next = String(after ?? '').split('\n');
  if (JSON.stringify(prev) === JSON.stringify(next)) return null;
  c.filesTouched = (c.filesTouched || 0) + 1;
  c.linesWritten = (c.linesWritten || 0) + next.length;
  c.linesRemoved = (c.linesRemoved || 0) + prev.length;
  const project = String(path || '').split('/').slice(0, 4).join('/') || HOME;
  let entry = c.projects.find(p => p.root === project);
  if (!entry) {
    entry = { root: project, edits: 0, firstWorld: Number(game.worldMinutes) || 0, lastWorld: Number(game.worldMinutes) || 0 };
    c.projects.push(entry);
    if (c.projects.length > 40) c.projects.shift();
  }
  entry.edits++;
  entry.lastWorld = Number(game.worldMinutes) || 0;
  return recordCoding(game, 'save', 1, path);
}

export function codingSummary(game) {
  const c = ensureCoding(game);
  const level = codingLevel(c.xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level, xp: Math.round(c.xp), streak: c.streak || 0,
    nextLevelXp: Math.round(next), progress: clamp((c.xp - current) / Math.max(1, next - current), 0, 1),
    counts: { ...c.counts }, linesWritten: c.linesWritten, linesRemoved: c.linesRemoved,
    filesTouched: c.filesTouched, bugsFound: c.bugsFound, bugsFixed: c.bugsFixed,
    builds: c.builds, releases: c.releases, deployments: c.deployments,
    activeDays: c.activeDays.length, projects: (c.projects || []).slice(-8).reverse(),
    history: (c.history || []).slice(0, 20)
  };
}

export function codingSkillBonus(game) {
  const c = ensureCoding(game);
  return clamp(codingLevel(c.xp) / 14 + (c.bugsFixed || 0) / 120, 0, 1.5);
}
