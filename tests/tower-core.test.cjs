// Run: node tests/tower-core.test.cjs
// 漢字の塔（試作2）の判定・出題の順番・データの確認。画面の配置は見ない。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../chapter4/kanji-strokes.js');
const ST = require('../chapter4/stroke-trace.js');
const C = require('../tower/tower-core.js');

// データ：書き順データがあり、部品が全画をすき間なく分け、にせもの部品の元の字もある
for (const e of C.KANJI) {
  assert(S[e.k], `no strokes for ${e.k}`);
  let next = 1;
  for (const p of e.parts) { assert.equal(p.from, next, `${e.k} ${p.name}`); assert(p.to >= p.from); next = p.to + 1; }
  assert.equal(next - 1, S[e.k].length, `${e.k} parts cover all strokes`);
  assert(/\[[ぁ-ん]+\]/.test(e.q), `${e.k} question marks the reading`);
  assert(e.memo && e.decoys.length >= 2);
  for (const d of e.decoys) { assert(S[d.src], `${e.k} decoy ${d.src}`); assert(d.from >= 1 && d.to <= S[d.src].length && d.from <= d.to, `${e.k} decoy range ${d.src}`); }
  assert.equal(C.partOf(e, 0), 0);
  assert.equal(C.partOf(e, S[e.k].length - 1), e.parts.length - 1);
  // 部品のわくは、字のマスの中で大きさを持つ
  const M = C.prep(S[e.k]);
  for (const p of e.parts) { const b = C.boxOf(M, p.from, p.to, 4); assert(b[2] - b[0] > 8 && b[3] - b[1] > 8, `${e.k} ${p.name} box`); }
}

for (const e of C.KANJI) {
  const M = C.prep(S[e.k]);
  const pts = i => ST.resample(M[i], 16);
  const mid = i => ST.resample(M[i], 3)[1];
  for (let i = 0; i < M.length; i++) {
    // 書き順タップ：画のまん中をタップすれば、順番どおりに進む
    assert.equal(C.pickStroke(M, i, mid(i)), i, `${e.k} tap ${i + 1}`);
    // なぞり：そのまま、ずれても（±8）当たる。長い画の逆向きは外れ
    assert(C.judgeTrace(pts(i), M, i).ok, `${e.k} trace ${i + 1}`);
    assert(C.judgeTrace(pts(i).map(p => [p[0] + 8, p[1] - 8]), M, i).ok, `${e.k} sloppy trace ${i + 1}`);
    if (ST.polyLength(M[i]) > 20) assert.equal(C.judgeTrace(pts(i).reverse(), M, i).reason, 'reverse', `${e.k} reverse ${i + 1}`);
  }
  // 何もない すみっこのタップは無視
  assert.equal(C.pickStroke(M, 0, [1, 108]), -1);
  // さいごの画を さいしょにタップ／なぞると、その画番号がわかる（ただし1画目のすぐそばは 1画目あつかい）
  const last = M.length - 1;
  if (C.distToStroke(mid(last), M[0]) > 12) {
    assert.equal(C.pickStroke(M, 0, mid(last)), last, `${e.k} wrong tap`);
    const r = C.judgeTrace(pts(last), M, 0);
    assert.equal(r.ok, false, `${e.k} wrong-order trace`);
  }
}

// 練習の流れ：はじめての字は「思い出して書く」をしない。2回目から入る
assert(!C.stepsFor(0).includes('recall'));
assert.equal(C.stepsFor(0)[0], 'meet');
assert(C.stepsFor(1).includes('recall') && C.stepsFor(1).includes('build'));
assert.deepEqual(C.stepsFor(2), ['pick', 'recall']);
assert.deepEqual(C.stepsFor(9), C.stepsFor(2));

// 日付
assert.equal(C.dayKey(new Date(2026, 10, 30), 1), 20261201);
assert.equal(C.addDays(20261231, 1), 20270101);

// きょう出す字：新しい字は1日2字まで。戻ってきた字が先
const order = C.KANJI.map(e => e.k);
assert.deepEqual(C.todayList({}, order, 20261113), order.slice(0, 2));
let recs = {};
for (const k of order.slice(0, 2)) recs[k] = C.advance(recs[k], 'good', 20261113);
assert.deepEqual(recs[order[0]], { lv: 1, next: 20261114, seen: 1 });
assert.deepEqual(C.todayList(recs, order, 20261113), order.slice(2, 4), 'same day: only more new ones');
assert.deepEqual(C.todayList(recs, order, 20261114), order.slice(0, 4), 'next day: 2 due + 2 new');
// 段の上がり方と間隔
let r = C.advance({ lv: 1, next: 0 }, 'good', 20261114); assert.deepEqual([r.lv, r.next], [2, 20261116]);
r = C.advance(r, 'good', 20261116); assert.deepEqual([r.lv, r.next], [3, 20261120]);
r = C.advance(r, 'good', 20261120); assert.deepEqual([r.lv, r.next], [3, 20261127]);
r = C.advance({ lv: 2 }, 'close', 20261116); assert.deepEqual([r.lv, r.next], [2, 20261117]);
r = C.advance({ lv: 3 }, 'forgot', 20261116); assert.deepEqual([r.lv, r.next], [1, 20261117]);
// 全部おぼえたあとは、その日に出すものがない
const all = {}; for (const k of order) all[k] = { lv: 1, next: 20261120 };
assert.deepEqual(C.todayList(all, order, 20261114), []);

// 画面側：スクリプトの構文と、参照している id
const html = fs.readFileSync(path.join(__dirname, '../tower/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new (require('node:vm').Script)(script);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'duplicate DOM IDs');
for (const m of script.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(m[1]), `missing DOM ID ${m[1]}`);
// 章選択からはリンクしない
assert(!fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').includes('tower/'), 'tower must stay unlinked');
console.log('tower-core: ok');
