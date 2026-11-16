#!/usr/bin/env node
/*
 * 漢字の塔の出題データ（tower/tower-data.js）を作る。
 * 第4章の問題（テスト回を指定）から漢字をひろい、KanjiVG の部品の区切りを使って、
 * 字ごとの部品・にせもの部品・問題文を書き出す。
 *
 * 使い方:
 *   node tower/tools/build_data.cjs <KanjiVG の kanji フォルダ> [テスト回,テスト回…] > tower/tower-data.js
 *   例: node tower/tools/build_data.cjs ~/kanjivg/kanji 11,12 > tower/tower-data.js
 * KanjiVG は部品の区切り（<g kvg:element=…>）が残っている元の SVG が必要。
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '../..');
const STROKES = require(path.join(ROOT, 'chapter4/kanji-strokes.js'));
const ST = require(path.join(ROOT, 'chapter4/stroke-trace.js'));

const dir = process.argv[2];
const tests = (process.argv[3] || '11,12').split(',').map(Number);
if (!dir) { console.error('usage: build_data.cjs <kanjivg/kanji> [tests]'); process.exit(1); }

// 1・2年生で習う字（この範囲に出るもの）。「もう知っているはず」として、確かめるところから始める
const KNOWN = new Set('人目中二出学字生先車形交今朝行帰会作新聞電組教楽歌言店');
// 部品の呼び名（部首として置かれているときの名前）
const RAD = { '亻': 'にんべん', '彳': 'ぎょうにんべん', '氵': 'さんずい', '扌': 'てへん', '糸': 'いとへん', '禾': 'のぎへん', '矢': 'やへん', '木': 'きへん', '日': 'ひへん', '言': 'ごんべん',
  '馬': 'うまへん', '宀': 'うかんむり', '艹': 'くさかんむり', '門': 'もんがまえ', '广': 'まだれ', '尸': 'しかばね', '雨': 'あめかんむり', '⻖': 'こざとへん', '阝': 'こざとへん', '攵': 'のぶん',
  '刂': 'りっとう', '斤': 'おのづくり', '牛': 'うしへん', '牜': 'うしへん', '頁': 'おおがい', '欠': 'あくび', '⺌': 'つかんむり', '𭕄': 'つかんむり', '巾': 'はば' };
const RAD_AT = { '阝right': 'おおざと', '⻏right': 'おおざと', '日top': '日', '日bottom': '日', '日right': '日', '木top': '木', '木bottom': '木', '木right': '木', '言right': '言', '糸right': '糸', '禾top': '禾（のぎ）', '刂left': '左の 部品' };
// 子どもが名前で呼びにくい部品は、場所で呼ぶ
const ODD = /[畀开彡咅帚乍且孝枼勿癶亠凵儿丨亅龶丷乀𠂉]/u;
// 部品に分けない字（画数が少ない字と、分け方が不自然な字）
const WHOLE = new Set('事央出');
const POS = { left: '左の 部品', right: '右の 部品', top: '上の 部品', bottom: '下の 部品' };
// 形がにている部品（にせもの えらびで 先に使う）
const ALIKE = { '亻': '彳氵扌忄', '彳': '亻氵', '氵': '冫亻彳', '扌': '才牜木', '糸': '幺禾米', '禾': '木米矢', '矢': '失禾夫', '木': '禾扌牛本', '牜': '扌木', '牛': '扌木午',
  '日': '目白田月', '月': '日目', '目': '日白自貝', '白': '日目自', '自': '目白日', '貝': '目見頁', '口': '日田', '田': '日由口', '由': '田',
  '宀': '冖穴艹', '艹': '竹宀', '广': '厂疒尸', '尸': '广戸', '門': '間', '阝': '卩', '⻖': '卩', '言': '音', '馬': '鳥', '方': '万力', '寺': '持等', '主': '王生土', '王': '主生', '生': '主王',
  '士': '土', '土': '士王', '及': '乃反友', '豆': '立員', '皆': '背', '至': '室', '尺': '尸', '直': '真', '冬': '各', '召': '台', '占': '古', '云': '去', '女': '子又文', '子': '了',
  '斤': '斥', '欠': '次', '攵': '夂又', '父': '交', '止': '上', '大': '太犬', '耳': '目', '比': '化北', '皮': '反', '立': '豆音', '寸': '才' };
// 「どの字？」で混ぜる、まぎらわしい字（形・読み・意味がにている字）
const CONFUSE = { '人': '入八大', '形': '型刑開', '目': '日自白', '鼻': '花算自', '歯': '葉羽止', '漢': '感館湯', '字': '学子寺', '交': '文父校', '中': '虫仲申', '央': '大夫英', '二': '三一工',
  '階': '皆陽界', '住': '往注柱', '部': '都郡倍', '屋': '室居局', '今': '令合会', '朝': '期明昼', '出': '山止入', '発': '登開始', '旅': '族放方', '行': '待竹後', '帰': '掃婦返', '委': '季秀妻',
  '員': '貝買院', '会': '合今絵', '仕': '任士使', '事': '書争筆', '学': '字覚楽', '級': '給紙吸', '新': '親進所', '聞': '間問開', '作': '昨使休', '昭': '照招明', '和': '知秋話', '店': '点庭庫',
  '駅': '験訳役', '電': '雲雪伝', '車': '東軍重', '待': '持特行', '組': '祖細紙', '教': '数考放', '皮': '反波川', '皿': '血四回', '終': '冬紙絵', '短': '豆知頭', '歌': '次飲家', '楽': '薬果学',
  '言': '信音語', '葉': '薬落歯', '表': '麦青現', '生': '主王牛', '先': '光洗兄', '植': '直根橋', '物': '牧特動' };
// 覚え方の一言（あるものだけ。ないものは部品名から作る）
const MEMO = { '住': '人（にんべん）が、主（あるじ）の いえに 住む。', '短': '矢（や）も 豆（まめ）も、どちらも 短い。', '委': 'いね（禾）を、女の人に 委（ゆだ）ねる。上が 禾、下が 女。',
  '級': '糸（いと）が つぎつぎ 及（およ）んで、学級の なかまに なる。', '階': 'おか（こざとへん）を、皆（みんな）で のぼる 階だん。', '鼻': '「自」ぶんの 顔の まん中。「田」と 台が 下に つく。',
  '駅': '馬（うま）を のりかえる ところが 駅。', '待': '行く 人（ぎょうにんべん）を、寺で 待つ。', '植': '木を まっ直ぐに 植える。', '漢': 'さんずいに、くさかんむり。右がわは 画が 多いので ゆっくり。' };
const MONSTERS = [['👻', 'ゴースト'], ['👺', 'ゴブリン'], ['🦇', 'コウモリ'], ['🕷️', 'グモ'], ['🗿', 'ゴーレム'], ['🐍', 'ヘビ'], ['🦂', 'サソリ'], ['🐲', 'ドラゴン'], ['🧟', 'ゾンビ'], ['🦑', 'クラーケン'], ['🐺', 'ウルフ'], ['🦉', 'フクロウ']];

const isKanji = c => /[一-鿿]/.test(c);
const isKana = c => /[ぁ-んァ-ヶー]/.test(c);

/* ---------- 第4章の問題 ---------- */
const html = fs.readFileSync(path.join(ROOT, 'chapter4/index.html'), 'utf8');
const questions = [];
for (const m of html.matchAll(/\{"?id"?:(\d+),"?s"?:(\d+),(?:"?test"?:(\d+),)?"?p"?:"((?:[^"\\]|\\.)*)","?a"?:"([^"]*)","?r"?:"([^"]*)"\}/g)) {
  if (tests.includes(+m[3])) questions.push({ id: +m[1], test: +m[3], p: m[4], a: m[5], r: m[6] });
}
if (!questions.length) { console.error('no questions for tests ' + tests); process.exit(1); }

// 字ごとの問題文。[ ] の中が、その字の読み。二字で一つの読み（部屋・今朝）は「何字目」を添える
function promptFor(q, k) {
  const ks = [...q.a].filter(isKanji);
  let read = q.r, tail = '', note = '';
  if (ks.length === 1) {
    const a = [...q.a];
    while (a.length && isKana(a[a.length - 1]) && read.endsWith(a[a.length - 1])) { tail = a.pop() + tail; read = read.slice(0, -1); }
  } else note = `${ks.indexOf(k) + 1}字目`;
  const text = q.p.replace(/<span class='reading'>.*?<\/span>/, `[${read}]${tail}`).replace(/<[^>]*>/g, '');
  return { q: text, note };
}

/* ---------- KanjiVG の部品 ---------- */
function partsOf(k) {
  const f = path.join(dir, k.codePointAt(0).toString(16).padStart(5, '0') + '.svg');
  const svg = fs.readFileSync(f, 'utf8').split('<g id="kvg:StrokeNumbers')[0];
  const stack = [], top = [];
  let n = 0, depth = 0;
  for (const t of svg.matchAll(/<g\b([^>]*)>|<\/g>|<path\b[^>]*>/g)) {
    if (t[0].startsWith('<g')) {
      depth++;
      const attr = a => (t[1].match(new RegExp(`kvg:${a}="([^"]*)"`)) || [])[1] || '';
      const g = { el: attr('element'), pos: attr('position'), from: n + 1, to: n };
      stack.push(g);
      if (depth === 3) top.push(g); // StrokePaths > 字 > 部品
    } else if (t[0] === '</g>') { const g = stack.pop(); if (g) g.to = n; depth--; }
    else { n++; if (depth === 2) top.push({ el: '', pos: '', from: n, to: n, loose: true }); }
  }
  for (const g of stack) g.to = n;
  // グループに入っていない画は、前（なければ後ろ）の部品にまとめる
  const parts = [];
  for (const g of top) {
    if (g.loose && parts.length) parts[parts.length - 1].to = g.to;
    else if (parts.length && parts[parts.length - 1].loose) { g.from = parts[parts.length - 1].from; parts[parts.length - 1] = g; }
    else parts.push(g);
  }
  if (n !== STROKES[k].length) throw new Error(`${k}: stroke count ${n} != ${STROKES[k].length}`);
  for (const g of parts) g.src = k;
  if (n <= 4 || WHOLE.has(k) || parts.length < 2 || parts[0].from !== 1 || parts[parts.length - 1].to !== n) return [{ el: k, pos: '', from: 1, to: n, whole: true }];
  return parts;
}
function box(k, from, to) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = from - 1; i < to; i++) for (const p of ST.flatten(STROKES[k][i])) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function nameOf(p, k, others) {
  if (p.whole) return k;
  if (RAD_AT[p.el + p.pos]) return RAD_AT[p.el + p.pos];
  if (RAD[p.el] && (p.pos === 'left' || p.pos === 'top' || /kamae|tare|nyo/.test(p.pos) || !p.pos)) return RAD[p.el];
  if (p.el && (STROKES[p.el] || /[一-鿿]/.test(p.el)) && !ODD.test(p.el)) return p.el;
  const b = box(k, p.from, p.to);
  return POS[p.pos] || (others.every(o => o === p || box(k, o.from, o.to).cy > b.cy) ? POS.top : others.every(o => o === p || box(k, o.from, o.to).cy < b.cy) ? POS.bottom : b.cx < 54 ? POS.left : POS.right);
}

/* ---------- 組み立てる ---------- */
const order = [];
const firstQ = {};
for (const q of questions) for (const c of q.a) if (isKanji(c) && !firstQ[c]) { firstQ[c] = q; order.push(c); }

const raw = {};
for (const k of order) raw[k] = partsOf(k);

// にせもの部品の候補：第4章に出てくる すべての漢字の部品と、画数の少ない字そのもの
const pool = [];
for (const k of Object.keys(STROKES).filter(isKanji)) {
  let ps;
  try { ps = raw[k] || partsOf(k); } catch (e) { continue; }
  if (ps.length > 1) for (const p of ps) pool.push({ src: k, from: p.from, to: p.to, el: p.el || `${k}#${p.from}`, pos: p.pos, n: p.to - p.from + 1, b: box(k, p.from, p.to) });
  if (STROKES[k].length <= 7) pool.push({ src: k, from: 1, to: STROKES[k].length, el: k, pos: '', n: STROKES[k].length, b: box(k, 1, STROKES[k].length) });
}
const shape = b => Math.log((b.w + 6) / (b.h + 6));
// 部品ごとに、にている別の部品を3つ：形がにている部品 → 同じ場所の部品 → 画数と たてよこの形が近い部品
function altsFor(k, p) {
  const own = new Set(raw[k].map(q => q.el).concat(k)), b = box(k, p.from, p.to), n = p.to - p.from + 1, like = ALIKE[p.el] || '';
  const list = pool.filter(c => !own.has(c.el) && c.src !== k && c.el !== p.el)
    .map(c => ({ c, s: (like.includes(c.el) ? -100 : 0) + (p.pos && c.pos === p.pos ? -6 : 0) + Math.abs(c.n - n) * 3 + Math.abs(shape(c.b) - shape(b)) * 10 }))
    .sort((x, y) => x.s - y.s || (x.c.src + x.c.from < y.c.src + y.c.from ? -1 : 1));
  const used = new Set(), out = [];
  for (const x of list) { if (used.has(x.c.el)) continue; used.add(x.c.el); out.push({ src: x.c.src, from: x.c.from, to: x.c.to }); if (out.length === 3) break; }
  return out;
}

const out = order.map((k, i) => {
  const parts = raw[k].map(p => Object.assign({ name: nameOf(p, k, raw[k]), from: p.from, to: p.to }, raw[k].length > 1 ? { alts: altsFor(k, p) } : {}));
  if (!CONFUSE[k]) throw new Error(`no confusable kanji for ${k}`);
  const { q, note } = promptFor(firstQ[k], k);
  const read = (q.match(/\[(.+?)\]/) || [])[1] || '';
  const mon = MONSTERS[i % MONSTERS.length];
  const e = { k, q, enemy: mon[0], name: `${read.slice(0, 4)}${mon[1]}`, parts };
  if (note) e.note = note;
  if (KNOWN.has(k)) e.known = true;
  e.alts = CONFUSE[k];
  e.memo = MEMO[k] || (parts.length > 1 ? `「${parts.map(p => p.name).join('」と「')}」で できている。` : 'ひとまとまりの 字。書きじゅんを よく 見よう。');
  return e;
});

process.stdout.write(`/*
 * 漢字の塔の出題データ。tower/tools/build_data.cjs で作成（第4章 テスト ${tests.join('・')} 回の範囲）。手で編集しない。
 * 部品の区切りは KanjiVG (http://kanjivg.tagaini.net) による。
 * Copyright (C) 2009-2026 Ulrich Apel and contributors. Creative Commons Attribution-Share Alike 3.0.
 * https://creativecommons.org/licenses/by-sa/3.0/
 */
(function (root) {
  var D = { tests: ${JSON.stringify(tests)}, questions: [
${questions.map(q => '    ' + JSON.stringify({ id: q.id, q: q.p.replace(/<span class='reading'>(.*?)<\/span>/, '[$1]').replace(/<[^>]*>/g, ''), a: q.a })).join(',\n')}
  ], kanji: [
${out.map(e => '    ' + JSON.stringify(e)).join(',\n')}
  ] };
  root.TOWER_DATA = D;
  if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
`);
