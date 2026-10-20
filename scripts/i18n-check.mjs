// Storefront i18n CI check (Phase L8). Blocking: key parity, empties, TODO
// values, mojibake markers, control chars, duplicate keys. Warnings (listed,
// non-blocking): identical-to-en values, length outliers.
// Usage: node scripts/i18n-check.mjs
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('file:///D:/Default%20Project/package.json'));
const ts = require('typescript');

const DICT_DIR = path.resolve('src/app/i18n');
const CONFIG = path.resolve('src/app/core/config/i18n.config.ts');
const SOURCE = 'en';

const files = readdirSync(DICT_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
const dicts = {};
let dupCount = 0, blocking = 0;

function parseFile(file, wantLocale) {
  const s = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let root = null, any = null;
  (function f(n) {
    if (ts.isVariableDeclaration(n) && ts.isObjectLiteralExpression(n.initializer)) {
      any ??= n.initializer;
      if (n.name.getText(ast) === wantLocale) root = n.initializer;
    }
    ts.forEachChild(n, f);
  })(ast);
  root ??= any;
  if (!root) { console.error(`FAIL no dict for ${wantLocale} in ${file}`); blocking++; return null; }
  const leaves = new Map();
  const dupes = new Set();
  (function w(o, p) {
    const seen = new Set();
    for (const m of o.properties) {
      if (!ts.isPropertyAssignment(m)) continue;
      const name = m.name.getText(ast).replace(/["'`]/g, '');
      if (seen.has(name)) dupes.add(`${wantLocale}:${p ? p + '.' + name : name}`);
      seen.add(name);
      const key = p ? `${p}.${name}` : name;
      if (ts.isObjectLiteralExpression(m.initializer)) w(m.initializer, key);
      else if (ts.isStringLiteralLike(m.initializer) || ts.isNoSubstitutionTemplateLiteral(m.initializer)) {
        if (leaves.has(key)) dupes.add(`${wantLocale}:${key}`);
        leaves.set(key, m.initializer.text);
      }
    }
  })(root, '');
  blocking += dupes.size;
  for (const d of dupes) console.error(`DUPLICATE KEY ${d}`);
  return leaves;
}

for (const f of files) {
  const locale = path.basename(f, '.ts');
  if (locale.startsWith('resilience')) continue; // merged dict layers validated separately below
  const parsed = parseFile(path.join(DICT_DIR, f), locale);
  if (parsed) dicts[locale] = parsed;
}

// resilience dict layer (if present): 8 sub-dicts must match storefront locales
const resFile = path.join(DICT_DIR, 'resilience.ts');
let resilience = null;
if (readdirSync(DICT_DIR).some((f) => f === 'resilience.ts')) {
  const s = readFileSync(resFile, 'utf8');
  const ast = ts.createSourceFile(resFile, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const collectLeaves = (root) => {
    const leaves = new Map();
    (function w(o, p) {
      for (const m of o.properties) {
        if (!ts.isPropertyAssignment(m)) continue;
        const name = m.name.getText(ast).replace(/["'`]/g, '');
        const key = p ? `${p}.${name}` : name;
        if (ts.isObjectLiteralExpression(m.initializer)) w(m.initializer, key);
        else if (ts.isStringLiteralLike(m.initializer) || ts.isNoSubstitutionTemplateLiteral(m.initializer)) leaves.set(key, m.initializer.text);
      }
    })(root, '');
    return leaves;
  };
  const inner = [];
  for (const lang of Object.keys(dicts)) {
    let root = null;
    (function f(n) { if (ts.isVariableDeclaration(n) && n.name.getText(ast) === lang && ts.isObjectLiteralExpression(n.initializer)) root = n.initializer; ts.forEachChild(n, f); })(ast);
    if (!root) { console.error(`FAIL resilience layer missing locale ${lang}`); blocking++; continue; }
    inner.push([lang, collectLeaves(root)]);
  }
  if (inner.length) {
    const ref = inner[0][1];
    for (const [lang, leaves] of inner.slice(1)) {
      if (leaves.size !== ref.size) { console.error(`FAIL resilience key count differs: ${lang} ${leaves.size} vs ${inner[0][0]} ${ref.size}`); blocking++; }
    }
    resilience = inner;
  }
}

const MOJI = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00E2\u0080\u00A6/;
const CTL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const en = dicts[SOURCE];
if (!en) { console.error('FAIL source en dict missing'); process.exit(1); }

for (const [lang, dict] of Object.entries(dicts)) {
  if (lang === SOURCE) continue;
  for (const key of en.keys()) if (!dict.has(key)) { console.error(`MISSING ${lang}:${key}`); blocking++; }
  for (const key of dict.keys()) {
    if (!en.has(key)) { console.error(`ORPHAN ${lang}:${key}`); blocking++; continue; }
    const val = dict.get(key), src = en.get(key);
    if (val.trim() === '') { console.error(`EMPTY ${lang}:${key}`); blocking++; }
    else if (/^(todo|tbd|xxx|translation needed)$/i.test(val.trim())) { console.error(`PLACEHOLDER VALUE ${lang}:${key}`); blocking++; }
    if (MOJI.test(val)) { console.error(`MOJIBAKE ${lang}:${key} :: ${val.slice(0, 60)}`); blocking++; }
    if (CTL.test(val)) { console.error(`CONTROL CHAR ${lang}:${key} code ${val.match(CTL)?.[0]?.charCodeAt(0)}`); blocking++; }
    const ph = [...val.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const phSrc = [...src.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    if (ph !== phSrc) { console.error(`PLACEHOLDER MISMATCH ${lang}:${key} got(${ph}) want(${phSrc})`); blocking++; }
  }
  if (lang === 'ar') {
    for (const key of dict.keys()) {
      const v = dict.get(key);
      if (/[\p{Script=Cyrillic}]/u.test(v)) { console.error(`WRONG SCRIPT (cyrillic) ar:${key}`); blocking++; }
    }
  }
}

// warnings (non-blocking)
let identicalCount = 0, outliers = 0;
for (const [lang, dict] of Object.entries(dicts)) {
  if (lang === SOURCE) continue;
  for (const key of en.keys()) {
    const val = dict.get(key), src = en.get(key);
    if (val === src) { identicalCount++; }
    else {
      const r = val.length / Math.max(1, src.length);
      if (r > 2 || r < 0.3) { outliers++; }
    }
  }
}
console.log(`i18n-check storefront: ${Object.keys(dicts).length} dicts, ${en.size} keys`);
if (resilience) console.log(`i18n-check storefront: resilience layer ${resilience.length} locales OK`);
console.log(`warnings: identical-to-en values=${identicalCount} (legit shared words today), length outliers=${outliers}`);
console.log(blocking === 0 ? 'PASS' : `FAIL blocking=${blocking}`);
process.exitCode = blocking > 0 ? 1 : 0;
