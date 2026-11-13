// Run: node tests/tower-core.test.cjs
// 漢字の塔（試作3）の判定・出題の順番・データの確認。画面の配置は見ない。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../chapter4/kanji-strokes.js');
const ST = require('../chapter4/stroke-trace.js');
const C = require('../tower/tower-core.js');

// 出題データは第4章の11・12回目の54字
assert.deepEqual(C.DATA.tests, [11, 12]);
assert.equal(C.KANJI.length, 54);
assert.equal(new Set(C.KANJI.map(e => e.k)).size, 54);

// データ：書き順データがあり、部品が全画をすき間なく分け、にせもの部品の元の字もある
for (const e of C.KANJI) {
  assert(S[e.k], `no strokes for ${e.k}`);
  let next = 1;
  for (const p of e.parts) { assert.equal(p.from, next, `${e.k} ${p.name}`); assert(p.to >= p.from); next = p.to + 1; }
  assert.equal(next - 1, S[e.k].length, `${e.k} parts cover all strokes`);
  assert(/\[[ぁ-ん]+\]/.test(e.q), `${e.k} question marks the reading`);
  assert(e.memo && e.enemy && e.name);
  if (e.parts.length > 1) assert(e.decoys.length >= 2, `${e.k} decoys`);
  for (const d of e.decoys || []) { assert(S[d.src], `${e.k} decoy ${d.src}`); assert(d.from >= 1 && d.to <= S[d.src].length && d.from <= d.to, `${e.k} decoy range ${d.src}`); }
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

// 練習の流れ：はじめての字は「思い出して書く」をしない。2回目から入る。部品1つの字は「くみたて」なし
const multi = C.KANJI.find(e => e.parts.length > 1 && !e.known), single = C.KANJI.find(e => e.parts.length === 1);
assert(!C.stepsFor(0, multi).includes('recall'));
assert.equal(C.stepsFor(0, multi)[0], 'meet');
assert(C.stepsFor(1, multi).includes('recall') && C.stepsFor(1, multi).includes('build'));
assert(!C.stepsFor(0, single).includes('build') && !C.stepsFor(1, single).includes('build'));
assert.deepEqual(C.stepsFor(2, multi), ['pick', 'recall']);
assert.deepEqual(C.stepsFor(9, multi), ['pick', 'recall']);
// 1・2年生の字は、確かめる段から始まる
const known = C.KANJI.find(e => e.known);
assert.equal(C.lvOf(undefined, known), C.KNOWN_LV);
assert.equal(C.lvOf(undefined, multi), 0);
assert.equal(C.lvOf({ lv: 1 }, known), 1);

// 日付
assert.equal(C.dayKey(new Date(2026, 10, 30), 1), 20261201);
assert.equal(C.addDays(20261231, 1), 20270101);
assert.equal(C.daysBetween(20261116, 20261129), 13);
assert.equal(C.daysBetween(20261231, 20270101), 1);

// 段の上がり方と間隔
let r = C.advance(undefined, 'good', 20261113, multi); assert.deepEqual(r, { lv: 1, next: 20261114, seen: 1, first: 20261113 });
r = C.advance(r, 'good', 20261114, multi); assert.deepEqual([r.lv, r.next, r.first], [2, 20261116, 20261113]);
r = C.advance(r, 'good', 20261116, multi); assert.deepEqual([r.lv, r.next], [3, 20261120]);
r = C.advance(r, 'good', 20261120, multi); assert.deepEqual([r.lv, r.next], [3, 20261127]);
r = C.advance({ lv: 2 }, 'close', 20261116, multi); assert.deepEqual([r.lv, r.next], [2, 20261117]);
r = C.advance({ lv: 3 }, 'forgot', 20261116, multi); assert.deepEqual([r.lv, r.next], [1, 20261117]);
// 知っているはずの字：書ければ一気に★3、書けなければ思い出しながらの段へ
r = C.advance(undefined, 'good', 20261116, known); assert.deepEqual([r.lv, r.next], [3, 20261120]);
r = C.advance(undefined, 'forgot', 20261116, known); assert.deepEqual([r.lv, r.next], [1, 20261117]);

// 2週間の配分：全部「書けた」として進めると、テストの3日前までに全部の字が一度は出て、新しい字は1日5字まで
{
  const start = 20261116, test = C.addDays(start, 13);
  const recs = {};
  let peak = 0;
  for (let d = 0; d < 14; d++) {
    const day = C.addDays(start, d), p = C.todayPlan(recs, C.KANJI, day, test);
    assert(p.fresh.length <= 5 && p.check.length <= 6, `day ${d + 1} new`);
    assert.deepEqual(p.list, p.due.concat(p.fresh, p.check));
    if (d >= 14 - C.BUFFER_DAYS) assert.equal(p.fresh.length + p.check.length, 0, `day ${d + 1}: review only`);
    peak = Math.max(peak, p.list.length);
    // 半分だけやって やめても、同じ日の残りは へるだけ（新しい字が ふえない）
    const half = p.list.slice(0, Math.ceil(p.list.length / 2));
    for (const k of half) { const e = C.KANJI.find(x => x.k === k); recs[k] = C.advance(recs[k], 'good', day, e); }
    const rest = C.todayPlan(recs, C.KANJI, day, test).list;
    assert.deepEqual(rest, p.list.slice(half.length), `day ${d + 1}: remaining list is stable`);
    for (const k of rest) { const e = C.KANJI.find(x => x.k === k); recs[k] = C.advance(recs[k], 'good', day, e); }
    assert.deepEqual(C.todayPlan(recs, C.KANJI, day, test).list, [], `day ${d + 1}: done`);
  }
  assert(C.KANJI.every(e => recs[e.k]), 'every kanji met before the test');
  assert(peak <= 18, `peak ${peak}`);
}

// 画面側：スクリプトの構文と、参照している id
const html = fs.readFileSync(path.join(__dirname, '../tower/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new (require('node:vm').Script)(script);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'duplicate DOM IDs');
assert(html.includes('<script src="tower-data.js"></script>'));
for (const m of script.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(m[1]), `missing DOM ID ${m[1]}`);
// 章選択からはリンクしない
assert(!fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').includes('tower/'), 'tower must stay unlinked');
console.log('tower-core: ok');
