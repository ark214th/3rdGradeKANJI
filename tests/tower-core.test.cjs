// Run: node tests/tower-core.test.cjs
// 漢字の塔（試作4）の判定・出題の順番・データの確認。画面の配置は見ない。
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

// 練習の流れ：はじめての字は「思い出して書く」をしない。部品1つの字は 部品の問題なし
const multi = C.KANJI.find(e => e.parts.length > 1 && !e.known), single = C.KANJI.find(e => e.parts.length === 1);
assert.deepEqual(C.stepsFor(0, multi), ['meet', 'build', 'order', 'trace']);
assert.deepEqual(C.stepsFor(1, multi), ['pick', 'part', 'trace', 'recall']);
assert.deepEqual(C.stepsFor(2, multi), ['part', 'recall']);
assert.deepEqual(C.stepsFor(3, multi), ['pick', 'recall']);
assert.deepEqual(C.stepsFor(9, multi), ['pick', 'recall']);
assert.deepEqual(C.stepsFor(0, single), ['meet', 'order', 'trace']);
assert.deepEqual(C.stepsFor(2, single), ['pick', 'recall']);
// 1・2年生の字は、確かめる段から始まる
const known = C.KANJI.find(e => e.known);
assert.equal(C.lvOf(undefined, known), C.KNOWN_LV);
assert.equal(C.lvOf(undefined, multi), 0);

// 日付
assert.equal(C.dayKey(new Date(2026, 10, 30), 1), 20261201);
assert.equal(C.addDays(20261231, 1), 20270101);
assert.equal(C.daysBetween(20261116, 20261129), 13);

// 出来に合わせた段と間隔
const D1 = 20261116, D2 = 20261117, D3 = 20261118;
let r = C.advance(undefined, 'good', D1, multi, 1);
assert.deepEqual(r, { lv: 1, next: D2, seen: 1, first: D1, last: D1, miss: 0, t: 1 });
r = C.advance(r, 'good', D1, multi, 2); assert.deepEqual([r.lv, r.next], [2, D3], 'same-day practice may reach ★2');
let same = C.advance(r, 'good', D1, multi, 3); assert.equal(same.lv, 2, '★3 needs another day');
r = C.advance(r, 'good', D2, multi, 4); assert.deepEqual([r.lv, r.next], [3, C.addDays(D2, 4)]);
r = C.advance(r, 'good', D3, multi, 5); assert.deepEqual([r.lv, r.next], [3, C.addDays(D3, 7)]);
r = C.advance({ lv: 2, last: D1 }, 'close', D2, multi); assert.deepEqual([r.lv, r.next, r.miss], [2, D3, 1]);
r = C.advance({ lv: 3, last: D1 }, 'forgot', D2, multi); assert.deepEqual([r.lv, r.next], [1, D2], 'forgotten kanji come back the same day');
r = C.advance({ lv: 1, last: D1 }, 'forgot', D2, multi); assert.equal(r.lv, 0, 'forgotten again: back to the model');
// まちがいの多い字は、次に出るまでが短い
r = C.advance({ lv: 2, last: D1, miss: 2 }, 'good', D2, multi); assert.deepEqual([r.lv, r.next], [3, C.addDays(D2, 2)]);
// 知っているはずの字：書ければ一気に★3、書けなければ思い出しながらの段へ
r = C.advance(undefined, 'good', D1, known); assert.equal(r.lv, 3);
r = C.advance(undefined, 'forgot', D1, known); assert.deepEqual([r.lv, r.next], [1, D1]);

// いくらでも遊べる：どんな状態でも、つぎの かいは 3体そろう。同じ字は 1かいに 1回だけ
// めやすどおりに進めると、3日目までに ぜんぶの字に出会う
{
  const recs = {}; let t = 0;
  for (let d = 0; d < 8; d++) {
    const day = C.addDays(D1, d);
    const g0 = C.guide(recs, C.KANJI, day, D1);
    if (d === 0) assert.equal(g0.intro, Math.ceil(C.KANJI.length / C.INTRO_DAYS));
    for (let guard = 0; C.guide(recs, C.KANJI, day, D1).count > 0; guard++) {
      assert(guard < 60, 'guide never reaches zero');
      const floor = C.nextFloor(recs, C.KANJI, day);
      assert.equal(floor.length, C.FLOOR_SIZE);
      assert.equal(new Set(floor.map(x => x.k)).size, C.FLOOR_SIZE);
      for (const x of floor) recs[x.k] = C.advance(recs[x.k], 'good', day, C.KANJI.find(e => e.k === x.k), ++t);
    }
    if (d === C.INTRO_DAYS - 1) assert.equal(Object.keys(recs).length, C.KANJI.length, 'all kanji met within the intro days');
    // めやすを こえても 続けられる（おまけ）。弱い字・ごぶさたの字が先で、同じ3字ばかりに ならない
    const a = C.nextFloor(recs, C.KANJI, day);
    assert.equal(a.length, C.FLOOR_SIZE);
    if (Object.keys(recs).length === C.KANJI.length) {
      assert(a.every(x => x.kind === 'extra'));
      for (const x of a) recs[x.k] = C.advance(recs[x.k], 'good', day, C.KANJI.find(e => e.k === x.k), ++t);
      const b = C.nextFloor(recs, C.KANJI, day);
      assert(!b.some(x => a.some(y => y.k === x.k)), 'extra floors rotate');
    }
  }
  assert(C.KANJI.every(e => recs[e.k].lv === C.MAX_LV), 'steady success reaches ★3');
}
// 思い出せなかった字は、その日のうちに つぎの かいへ出てくる
{
  const recs = {}; const e = C.KANJI.find(x => !x.known);
  recs[e.k] = C.advance({ lv: 2, last: D1, first: D1 }, 'forgot', D2, e, 1);
  assert(C.nextFloor(recs, C.KANJI, D2).some(x => x.k === e.k && x.kind === 'due'));
}

// どの字？の まぎらわしい字：3つ、ぜんぶ ちがう字で、正解と かぶらない
for (const e of C.KANJI) {
  const alts = [...e.alts];
  assert.equal(alts.length, 3, `${e.k} alts`);
  assert.equal(new Set(alts.concat(e.k)).size, 4, `${e.k} alts distinct`);
  // 部品えらび：部品ごとに にている部品が3つ。元の字の書き順データがある
  if (e.parts.length > 1) for (const p of e.parts) {
    assert.equal(p.alts.length, 3, `${e.k} ${p.name} alts`);
    for (const d of p.alts) { assert(S[d.src] && d.src !== e.k, `${e.k} alt ${d.src}`); assert(d.from >= 1 && d.to <= S[d.src].length && d.from <= d.to); }
  }
}

// テストれんしゅう：テストと同じ59問。答えの字は ぜんぶ 書き順データがある
assert.equal(C.DATA.questions.length, 59);
for (const q of C.DATA.questions) { assert(/\[[ぁ-ん]+\]/.test(q.q), `question ${q.id}`); for (const c of q.a) assert(S[c], `question ${q.id} char ${c}`); }
// 出題は、まだの問題 と × だった問題が先
{
  const qs = C.DATA.questions, tq = {};
  assert.deepEqual(C.examList(tq, qs).map(q => q.id), qs.slice(0, C.EXAM_SIZE).map(q => q.id));
  for (const q of qs.slice(0, 10)) tq[q.id] = { r: 'good', t: 1 };
  tq[qs[3].id] = { r: 'bad', t: 2 };
  const next = C.examList(tq, qs).map(q => q.id);
  assert.equal(next[0], qs[3].id);
  assert(!next.includes(qs[0].id));
  for (const q of qs) tq[q.id] = { r: 'good', t: q.id };
  assert.equal(C.examList(tq, qs).length, C.EXAM_SIZE, 'never runs out');
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
