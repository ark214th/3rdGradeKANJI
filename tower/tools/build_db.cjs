#!/usr/bin/env node
/*
 * 漢字の塔の道具用データベース（tower/tools/kanji-db.json）を作る。ふだんは作り直さなくてよい。
 * 小学校で習う漢字（1〜6年）・ひらがな・カタカナについて、画ごとの線（KanjiVG）、部品の区切り、習う学年を1つにまとめる。
 * これがあれば、テスト範囲の追加（build_range.cjs）は このリポジトリだけで できる。
 *
 * 使い方:
 *   node tower/tools/build_db.cjs <KanjiVG の kanji フォルダ> <学年別の漢字リストのフォルダ> > tower/tools/kanji-db.json
 *   - KanjiVG は、部品の区切り（<g kvg:element=…>）が残っている元の SVG（例：npm の kanjivg-js に入っている kanji/）
 *   - 学年別リストは grade.g01.json 〜 grade.g06.json（漢字の配列。例：npm の kanji に入っている lib/data/）
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const [kvgDir, gradeDir] = process.argv.slice(2);
if (!kvgDir || !gradeDir) { console.error('usage: build_db.cjs <kanjivg/kanji> <grade lists dir>'); process.exit(1); }

const grade = {};
for (let g = 1; g <= 6; g++) for (const k of JSON.parse(fs.readFileSync(path.join(gradeDir, `grade.g0${g}.json`), 'utf8'))) grade[k] = g;
const chars = Object.keys(grade);
for (let c = 0x3041; c <= 0x3096; c++) chars.push(String.fromCodePoint(c));
for (let c = 0x30a1; c <= 0x30fa; c++) chars.push(String.fromCodePoint(c));
chars.push('ー', '々');

const num = m => { const v = Math.round(parseFloat(m) * 10) / 10; return Object.is(v, -0) ? '0' : String(v); };
// 数字を小数1けたに丸める。丸めた結果「-0.04」→「0」で前の数字とくっつかないよう、区切りを入れ直す
function tidy(d) {
  const tk = d.match(/[MmCcSsLlHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let out = '';
  for (const t of tk) {
    if (/[A-Za-z]/.test(t)) { out += t; continue; }
    const n = num(t);
    out += (out && /[\d.]$/.test(out) && !n.startsWith('-') ? ',' : '') + n;
  }
  return out;
}

function read(ch) {
  const f = path.join(kvgDir, ch.codePointAt(0).toString(16).padStart(5, '0') + '.svg');
  if (!fs.existsSync(f)) return null;
  const svg = fs.readFileSync(f, 'utf8').split('<g id="kvg:StrokeNumbers')[0];
  const stack = [], top = [], strokes = [];
  let depth = 0;
  for (const t of svg.matchAll(/<g\b([^>]*)>|<\/g>|<path\b([^>]*)>/g)) {
    if (t[0].startsWith('<g')) {
      depth++;
      const attr = a => (t[1].match(new RegExp(`kvg:${a}="([^"]*)"`)) || [])[1] || '';
      const g = { el: attr('element'), pos: attr('position'), from: strokes.length + 1, to: strokes.length };
      stack.push(g);
      if (depth === 3) top.push(g); // StrokePaths > 字 > 部品
    } else if (t[0] === '</g>') { const g = stack.pop(); if (g) g.to = strokes.length; depth--; }
    else {
      strokes.push(tidy((t[2].match(/\sd="([^"]+)"/) || [])[1] || ''));
      if (depth === 2) top.push({ el: '', pos: '', from: strokes.length, to: strokes.length, loose: true });
    }
  }
  for (const g of stack) g.to = strokes.length;
  // グループに入っていない画は、前（なければ後ろ）の部品にまとめる
  const parts = [];
  for (const g of top) {
    if (g.loose && parts.length) parts[parts.length - 1].to = g.to;
    else if (parts.length && parts[parts.length - 1].loose) { g.from = parts[parts.length - 1].from; parts[parts.length - 1] = g; }
    else parts.push(g);
  }
  const ok = parts.length > 1 && parts[0].from === 1 && parts[parts.length - 1].to === strokes.length && !parts.some(p => p.loose);
  return { s: strokes, p: ok ? parts.map(p => [p.el, p.pos, p.from, p.to]) : [], g: grade[ch] || 0 };
}

const db = {}, missing = [];
for (const ch of chars) { const r = read(ch); if (r && r.s.length) db[ch] = r; else missing.push(ch); }
if (missing.length) console.error('KanjiVG にない字: ' + missing.join(''));
process.stdout.write('{\n' + Object.keys(db).map(k => JSON.stringify(k) + ':' + JSON.stringify(db[k])).join(',\n') + '\n}\n');
