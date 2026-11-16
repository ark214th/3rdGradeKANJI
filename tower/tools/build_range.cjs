#!/usr/bin/env node
/*
 * 漢字の塔のテスト範囲データを作る。
 *   node tower/tools/build_range.cjs tower/ranges/<名前>.txt
 * → tower/data/<id>.js（その範囲の出題データ）と tower/data/ranges.js（範囲の一覧）を書き出す。
 * 必要なのは このリポジトリの中のファイルだけ（字形と部品は tower/tools/kanji-db.json）。
 *
 * 範囲ファイルの書き方（tower/tools/README.md も参照）:
 *   id: 3g-01-02            ← 半角の名前（保存データの見出しになる。あとから変えない）
 *   title: 3学期 1・2回目    ← 画面に出る名前
 *   grade: 3                ← 学年。これより下の学年で習う字は「知っているはず」として確かめから始める
 *   ビルの{二|に}{階|かい}に{住む|すむ}。   ← 1行が1つの文。{こたえ|よみ} が 1問
 *   # で始まる行は メモ（## 11回目 のような見出しも メモ）
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const TOWER = path.join(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(__dirname, 'kanji-db.json'), 'utf8'));
const ST = require(path.join(TOWER, 'stroke-trace.js'));

/* ---------- 手で決めている表（新しい字が増えたら、必要に応じて足す。なくても自動で選ぶ） ---------- */
// 部品の呼び名（部首として置かれているときの名前）
const RAD = { '亻': 'にんべん', '彳': 'ぎょうにんべん', '氵': 'さんずい', '扌': 'てへん', '糸': 'いとへん', '禾': 'のぎへん', '矢': 'やへん', '木': 'きへん', '日': 'ひへん', '言': 'ごんべん',
  '馬': 'うまへん', '宀': 'うかんむり', '艹': 'くさかんむり', '門': 'もんがまえ', '广': 'まだれ', '尸': 'しかばね', '雨': 'あめかんむり', '⻖': 'こざとへん', '阝': 'こざとへん', '攵': 'のぶん',
  '刂': 'りっとう', '斤': 'おのづくり', '牛': 'うしへん', '牜': 'うしへん', '頁': 'おおがい', '欠': 'あくび', '⺌': 'つかんむり', '𭕄': 'つかんむり', '巾': 'はば',
  '忄': 'りっしんべん', '辶': 'しんにょう', '⻌': 'しんにょう', '囗': 'くにがまえ', '竹': 'たけかんむり', '金': 'かねへん', '食': 'しょくへん', '飠': 'しょくへん', '女': 'おんなへん', '土': 'つちへん',
  '火': 'ひへん', '灬': 'れんが', '礻': 'しめすへん', '衤': 'ころもへん', '貝': 'かいへん', '車': 'くるまへん', '足': 'あしへん', '𧾷': 'あしへん', '月': 'にくづき', '疒': 'やまいだれ', '穴': 'あなかんむり',
  '冫': 'にすい', '厂': 'がんだれ', '弓': 'ゆみへん', '王': 'おうへん', '石': 'いしへん', '米': 'こめへん', '田': 'たへん', '目': 'めへん', '口': 'くちへん', '山': 'やまへん', '犭': 'けものへん', '方': 'ほうへん' };
const RAD_AT = { '阝right': 'おおざと', '⻏right': 'おおざと', '禾top': '禾（のぎ）', '刂left': '左の 部品' };
// 子どもが名前で呼びにくい部品は、場所で呼ぶ
const ODD = /[畀开彡咅帚乍且孝枼勿癶亠凵儿丨亅龶丷乀𠂉丿丶乚𠆢]/u;
// 部品に分けない字（分け方が不自然な字）
const WHOLE = new Set('事央出');
const POS = { left: '左の 部品', right: '右の 部品', top: '上の 部品', bottom: '下の 部品' };
// 形がにている部品（部品えらび・くみたての にせものに、先に使う）
const ALIKE = { '亻': '彳氵扌忄', '彳': '亻氵', '氵': '冫亻彳', '扌': '才牜木', '糸': '幺禾米', '禾': '木米矢', '矢': '失禾夫', '木': '禾扌牛本', '牜': '扌木', '牛': '扌木午',
  '日': '目白田月', '月': '日目', '目': '日白自貝', '白': '日目自', '自': '目白日', '貝': '目見頁', '口': '日田', '田': '日由口', '由': '田',
  '宀': '冖穴艹', '艹': '竹宀', '广': '厂疒尸', '尸': '广戸', '門': '間', '阝': '卩', '⻖': '卩', '言': '音', '馬': '鳥', '方': '万力', '寺': '持等', '主': '王生土', '王': '主生', '生': '主王',
  '士': '土', '土': '士王', '及': '乃反友', '豆': '立員', '皆': '背', '至': '室', '尺': '尸', '直': '真', '冬': '各', '召': '台', '占': '古', '云': '去', '女': '子又文', '子': '了',
  '斤': '斥', '欠': '次', '攵': '夂又', '父': '交', '止': '上', '大': '太犬', '耳': '目', '比': '化北', '皮': '反', '立': '豆音', '寸': '才', '礻': '衤', '衤': '礻', '辶': '廴', '忄': '亻扌', '冫': '氵' };
// 「どの字？」で混ぜる、まぎらわしい字（形・読み・意味がにている字）。ない字は、同じ部品を持つ字から自動で選ぶ
const CONFUSE = { '人': '入八大', '形': '型刑開', '目': '日自白', '鼻': '花算自', '歯': '葉羽止', '漢': '感館湯', '字': '学子寺', '交': '文父校', '中': '虫仲申', '央': '大夫英', '二': '三一工',
  '階': '皆陽界', '住': '往注柱', '部': '都郡倍', '屋': '室居局', '今': '令合会', '朝': '期明昼', '出': '山止入', '発': '登開始', '旅': '族放方', '行': '待竹後', '帰': '掃婦返', '委': '季秀妻',
  '員': '貝買院', '会': '合今絵', '仕': '任士使', '事': '書争筆', '学': '字覚楽', '級': '給紙吸', '新': '親進所', '聞': '間問開', '作': '昨使休', '昭': '照招明', '和': '知秋話', '店': '点庭庫',
  '駅': '験訳役', '電': '雲雪伝', '車': '東軍重', '待': '持特行', '組': '祖細紙', '教': '数考放', '皮': '反波川', '皿': '血四回', '終': '冬紙絵', '短': '豆知頭', '歌': '次飲家', '楽': '薬果学',
  '言': '信音語', '葉': '薬落歯', '表': '麦青現', '生': '主王牛', '先': '光洗兄', '植': '直根橋', '物': '牧特動' };
// 覚え方の一言（あるものだけ。ないものは部品名から作る）
const MEMO = { '住': '人（にんべん）が、主（あるじ）の いえに 住む。', '短': '矢（や）も 豆（まめ）も、どちらも 短い。', '委': 'いね（禾）を、女の人に 委（ゆだ）ねる。上が 禾、下が 女。',
  '級': '糸（いと）が つぎつぎ 及（およ）んで、学級の なかまに なる。', '階': 'おか（こざとへん）を、皆（みんな）で のぼる 階だん。', '鼻': '「自」ぶんの 顔の まん中。「田」と 台が 下に つく。',
  '駅': '馬（うま）を のりかえる ところが 駅。', '待': '行く 人（ぎょうにんべん）を、寺で 待つ。', '植': '木を まっ直ぐに 植える。', '漢': 'さんずいに、くさかんむり。右がわは 画が 多いので ゆっくり。' };
// まものの種類（3Dの形）と呼び名
const MONSTERS = [['slime', 'スライム'], ['ghost', 'ゴースト'], ['bat', 'コウモリ'], ['golem', 'ゴーレム'], ['eye', 'メダマ'], ['shroom', 'キノコ']];

const isKanji = c => /[一-鿿々]/.test(c);
const isKana = c => /[ぁ-んァ-ヶー]/.test(c);
const fail = m => { console.error('エラー: ' + m); process.exit(1); };

/* ---------- 範囲ファイルを読む ---------- */
const src = process.argv[2];
if (!src) fail('使い方: node tower/tools/build_range.cjs tower/ranges/<名前>.txt');
function parse(file) {
  const head = {}, sentences = [];
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, n) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const h = t.match(/^(id|title|grade)\s*[:：]\s*(.+)$/);
    if (h) { head[h[1]] = h[2].trim(); return; }
    if (!/\{[^{}|]+\|[^{}|]+\}/.test(t)) fail(`${path.basename(file)} ${n + 1}行目：{こたえ|よみ} が ありません → ${t}`);
    sentences.push({ line: n + 1, text: t });
  });
  if (!/^[A-Za-z0-9_-]+$/.test(head.id || '')) fail(`${path.basename(file)}：「id: 半角の名前」が必要です`);
  if (!head.title) fail(`${path.basename(file)}：「title: 画面に出る名前」が必要です`);
  return { id: head.id, title: head.title, grade: +head.grade || 3, sentences };
}
const R = parse(src);

// 文 → 問題。問題文は、ほかの {こたえ|よみ} を よみに もどし、その問題のところだけ [よみ] にする
const questions = [];
for (const s of R.sentences) {
  const marks = [...s.text.matchAll(/\{([^{}|]+)\|([^{}|]+)\}/g)];
  marks.forEach((m, i) => {
    let j = 0;
    const q = s.text.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (_, a, r) => (j++ === i ? `[${r}]` : r));
    for (const c of m[1]) if (!DB[c]) fail(`${s.line}行目：「${c}」の字形データが ありません（小学校で習う漢字と かな だけ使えます）`);
    if (![...m[1]].some(isKanji)) fail(`${s.line}行目：{${m[1]}|${m[2]}} の こたえに 漢字が ありません`);
    questions.push({ id: questions.length + 1, q, a: m[1], r: m[2] });
  });
}

/* ---------- 字ごとのデータ ---------- */
const models = {};
const pts = k => models[k] || (models[k] = DB[k].s.map(d => ST.flatten(d)));
function box(k, from, to) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = from - 1; i < to; i++) for (const p of pts(k)[i]) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
// 部品（部品に分けない字は 1つ）
function partsOf(k) {
  const n = DB[k].s.length, p = DB[k].p;
  if (n <= 4 || WHOLE.has(k) || p.length < 2) return [{ el: k, pos: '', from: 1, to: n, whole: true }];
  return p.map(([el, pos, from, to]) => ({ el, pos, from, to }));
}
function nameOf(p, k, all) {
  if (p.whole) return k;
  if (RAD_AT[p.el + p.pos]) return RAD_AT[p.el + p.pos];
  if (RAD[p.el] && (p.pos === 'left' || /kamae|tare|nyo/.test(p.pos) || (p.pos === 'top' && /かんむり|がしら/.test(RAD[p.el])))) return RAD[p.el];
  if (p.el && isKanji(p.el) && !ODD.test(p.el)) return p.el;
  if (RAD[p.el] && !p.pos) return RAD[p.el];
  const b = box(k, p.from, p.to);
  return POS[p.pos] || (all.every(o => o === p || box(k, o.from, o.to).cy > b.cy) ? POS.top : all.every(o => o === p || box(k, o.from, o.to).cy < b.cy) ? POS.bottom : b.cx < 54 ? POS.left : POS.right);
}

const order = [], firstQ = {};
for (const q of questions) for (const c of q.a) if (isKanji(c) && !firstQ[c]) { firstQ[c] = q; order.push(c); }
const raw = {};
for (const k of order) raw[k] = partsOf(k);

// にせもの部品の候補：この学年までに習う すべての漢字の部品と、画数の少ない字そのもの
const learned = Object.keys(DB).filter(k => DB[k].g && DB[k].g <= R.grade);
const pool = [];
for (const k of learned) {
  const ps = raw[k] || partsOf(k);
  if (ps.length > 1) for (const p of ps) pool.push({ src: k, from: p.from, to: p.to, el: p.el || `${k}#${p.from}`, pos: p.pos, n: p.to - p.from + 1, b: box(k, p.from, p.to) });
  if (DB[k].s.length <= 7) pool.push({ src: k, from: 1, to: DB[k].s.length, el: k, pos: '', n: DB[k].s.length, b: box(k, 1, DB[k].s.length) });
}
const shape = b => Math.log((b.w + 6) / (b.h + 6));
const tie = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// 部品ごとに、にている別の部品を3つ：形がにている部品 → 同じ場所の部品 → 画数と たてよこの形が近い部品
function altsFor(k, p) {
  const own = new Set(raw[k].map(q => q.el).concat(k)), b = box(k, p.from, p.to), n = p.to - p.from + 1, like = ALIKE[p.el] || '';
  const list = pool.filter(c => !own.has(c.el) && c.src !== k && c.el !== p.el)
    .map(c => ({ c, s: (like.includes(c.el) ? -100 : 0) + (p.pos && c.pos === p.pos ? -6 : 0) + Math.abs(c.n - n) * 3 + Math.abs(shape(c.b) - shape(b)) * 10 + (order.includes(c.src) ? -0.5 : 0) }))
    .sort((x, y) => x.s - y.s || tie(x.c.src + x.c.from, y.c.src + y.c.from));
  const used = new Set(), out = [];
  for (const x of list) { if (used.has(x.c.el)) continue; used.add(x.c.el); out.push({ src: x.c.src, from: x.c.from, to: x.c.to }); if (out.length === 3) break; }
  return out;
}
// 「どの字？」の まぎらわしい字：表にあれば それ。なければ、同じ部品を 同じ場所に持つ字 → 画数の近い字
function confuse(k) {
  if (CONFUSE[k]) return CONFUSE[k];
  const mine = raw[k], n = DB[k].s.length;
  const list = learned.filter(c => c !== k).map(c => {
    const ps = raw[c] || partsOf(c);
    let s = Math.abs(DB[c].s.length - n);
    for (const p of mine) for (const q of ps) if (!p.whole && !q.whole && p.el && p.el === q.el) s -= p.pos === q.pos ? 40 : 15;
    if (ps.some(q => q.el === k) || mine.some(p => p.el === c)) s -= 30; // 字そのものが 部品になっている
    return { c, s };
  }).sort((x, y) => x.s - y.s || tie(x.c, y.c));
  return list.slice(0, 3).map(x => x.c).join('');
}
// 字ごとの問題文。[ ] の中が その字の読み。二字で一つの読み（部屋・今朝）は「何字目」を添える
function promptFor(q, k) {
  const ks = [...q.a].filter(isKanji);
  let read = q.r, tail = '', note = '';
  if (ks.length === 1) {
    const a = [...q.a];
    while (a.length && isKana(a[a.length - 1]) && read.endsWith(a[a.length - 1]) && read.length > 1) { tail = a.pop() + tail; read = read.slice(0, -1); }
  } else note = `${ks.indexOf(k) + 1}字目`;
  return { q: q.q.replace(/\[.*?\]/, `[${read}]${tail}`), note, read };
}

const kanji = order.map((k, i) => {
  const parts = raw[k].map(p => Object.assign({ name: nameOf(p, k, raw[k]), from: p.from, to: p.to }, raw[k].length > 1 ? { alts: altsFor(k, p) } : {}));
  const { q, note, read } = promptFor(firstQ[k], k);
  const mon = MONSTERS[i % MONSTERS.length];
  const e = { k, q, mon: mon[0], hue: (i * 47) % 360, name: `${read.slice(0, 4)}${mon[1]}`, parts, alts: confuse(k) };
  if (note) e.note = note;
  if (DB[k].g && DB[k].g < R.grade) e.known = true;
  e.memo = MEMO[k] || (parts.length > 1 ? `「${parts.map(p => p.name).join('」と「')}」で できている。` : 'ひとまとまりの 字。書きじゅんを よく 見よう。');
  return e;
});

// 画面で線を引く字：出題の漢字、こたえの かな、にせもの部品の 元の字
const need = new Set();
for (const q of questions) for (const c of q.a) need.add(c);
for (const e of kanji) for (const p of e.parts) for (const d of p.alts || []) need.add(d.src);
const strokes = {};
for (const c of [...need].sort()) strokes[c] = DB[c].s;

/* ---------- 書き出す ---------- */
const lines = (arr, f) => arr.map(x => '    ' + f(x)).join(',\n');
const out = `/*
 * 漢字の塔のテスト範囲「${R.title}」。tower/ranges/${path.basename(src)} から tower/tools/build_range.cjs で作成。手で編集しない。
 * 字形と部品の区切りは KanjiVG (http://kanjivg.tagaini.net) による。
 * Copyright (C) 2009-2026 Ulrich Apel and contributors. Creative Commons Attribution-Share Alike 3.0.
 * https://creativecommons.org/licenses/by-sa/3.0/  Changes: coordinates rounded to 0.1, only the characters used here.
 */
(function (root) {
  var R = { id: ${JSON.stringify(R.id)}, title: ${JSON.stringify(R.title)}, grade: ${R.grade},
  questions: [
${lines(questions, q => JSON.stringify({ id: q.id, q: q.q, a: q.a }))}
  ],
  kanji: [
${lines(kanji, e => JSON.stringify(e))}
  ],
  strokes: {
${lines(Object.keys(strokes), c => JSON.stringify(c) + ': ' + JSON.stringify(strokes[c]))}
  } };
  (root.TOWER_RANGES = root.TOWER_RANGES || {})[R.id] = R;
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.mkdirSync(path.join(TOWER, 'data'), { recursive: true });
fs.writeFileSync(path.join(TOWER, 'data', R.id + '.js'), out);

// 範囲の一覧（ranges フォルダの全ファイルから作り直す。ファイル名の順＝古い順。さいごが いちばん新しい範囲）
const list = fs.readdirSync(path.join(TOWER, 'ranges')).filter(f => f.endsWith('.txt')).sort().map(f => { const r = parse(path.join(TOWER, 'ranges', f)); return { id: r.id, title: r.title }; });
const ids = list.map(r => r.id);
if (new Set(ids).size !== ids.length) fail('id が 重なっている範囲ファイルが あります: ' + ids.join(', '));
for (const r of list) if (!fs.existsSync(path.join(TOWER, 'data', r.id + '.js'))) console.error(`注意: ${r.id} のデータが まだ ありません（その範囲ファイルにも build_range.cjs を実行してください）`);
fs.writeFileSync(path.join(TOWER, 'data', 'ranges.js'), `/* 漢字の塔のテスト範囲の一覧。tower/tools/build_range.cjs が作る。手で編集しない。 */
(function (root) {
  var L = ${JSON.stringify(list)};
  root.TOWER_RANGE_LIST = L;
  if (typeof module !== 'undefined') module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
`);
console.log(`${R.title}（${R.id}）：${R.sentences.length}文・${questions.length}問・漢字${kanji.length}字（はじめて ${kanji.filter(e => !e.known).length}／たしかめ ${kanji.filter(e => e.known).length}）→ tower/data/${R.id}.js`);
const auto = kanji.filter(e => !CONFUSE[e.k]);
if (auto.length) console.log('「どの字？」の まぎらわしい字を 自動で選んだ字: ' + auto.map(e => `${e.k}→${e.alts}`).join('  '));
