// Run: node tests/tower-core.test.cjs
// 漢字の塔の判定・出題の順番・ごほうびの計算・テスト範囲データの確認。画面の配置は見ない。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const TOWER = path.join(__dirname, '../tower');
const ST = require('../tower/stroke-trace.js');
const C = require('../tower/tower-core.js');
const LIST = require('../tower/data/ranges.js');

// なぞり判定の写しは、第4章のものと同じ中身
assert.equal(fs.readFileSync(path.join(TOWER, 'stroke-trace.js'), 'utf8').split('*/').slice(1).join('*/'), fs.readFileSync(path.join(__dirname, '../chapter4/stroke-trace.js'), 'utf8').split('*/').slice(1).join('*/'));

// 範囲の一覧：ranges/*.txt と 1対1。どの範囲にも データがある
const txt = fs.readdirSync(path.join(TOWER, 'ranges')).filter(f => f.endsWith('.txt'));
assert.equal(LIST.length, txt.length);
assert(LIST.length >= 1);
const RANGES = LIST.map(r => { assert(fs.existsSync(path.join(TOWER, 'data', r.id + '.js')), `no data for ${r.id}`); const R = require(`../tower/data/${r.id}.js`); assert.equal(R.id, r.id); assert.equal(R.title, r.title); return R; });

// どの範囲のデータも、画面が必要とする形になっている
for (const R of RANGES) {
  const S = R.strokes;
  assert(R.kanji.length >= C.FLOOR_SIZE && R.questions.length >= 1, R.id);
  assert.equal(new Set(R.kanji.map(e => e.k)).size, R.kanji.length);
  assert.equal(new Set(R.questions.map(q => q.id)).size, R.questions.length);
  for (const q of R.questions) { assert(/\[[ぁ-んァ-ヶー]+\]/.test(q.q), `${R.id} question ${q.id}`); for (const c of q.a) assert(S[c], `${R.id} question ${q.id} char ${c}`); }
  // 問題の答えに出る漢字は、ぜんぶ 塔の字として入っている
  for (const q of R.questions) for (const c of q.a) if (/[\u4e00-\u9fff]/.test(c)) assert(R.kanji.some(e => e.k === c), `${R.id} ${c}`);
  for (const e of R.kanji) {
    assert(S[e.k], `no strokes for ${e.k}`);
    let next = 1;
    for (const p of e.parts) { assert.equal(p.from, next, `${e.k} ${p.name}`); assert(p.to >= p.from && p.name); next = p.to + 1; }
    assert.equal(next - 1, S[e.k].length, `${e.k} parts cover all strokes`);
    assert(/\[[ぁ-んァ-ヶー]+\]/.test(e.q), `${e.k} question marks the reading`);
    assert(e.memo && e.mon && e.name && typeof e.hue === 'number');
    assert.equal(C.partOf(e, 0), 0);
    assert.equal(C.partOf(e, S[e.k].length - 1), e.parts.length - 1);
    const M = C.prep(S[e.k]);
    // 部品のわくは、字のマスの中で大きさを持つ
    for (const p of e.parts) { const b = C.boxOf(M, p.from, p.to, 4); assert(b[2] - b[0] > 8 && b[3] - b[1] > 8, `${e.k} ${p.name} box`); }
    // どの字？の まぎらわしい字：3つ、ぜんぶ ちがう字で、正解と かぶらない
    assert.equal([...e.alts].length, 3, `${e.k} alts`);
    assert.equal(new Set([...e.alts].concat(e.k)).size, 4, `${e.k} alts distinct`);
    // 部品えらび：部品ごとに にている部品が3つ。元の字の書き順データがある
    if (e.parts.length > 1) for (const p of e.parts) {
      assert.equal(p.alts.length, 3, `${e.k} ${p.name} alts`);
      for (const d of p.alts) { assert(S[d.src] && d.src !== e.k, `${e.k} alt ${d.src}`); assert(d.from >= 1 && d.to <= S[d.src].length && d.from <= d.to); }
    }
    const pts = i => ST.resample(M[i], 16), mid = i => ST.resample(M[i], 3)[1];
    for (let i = 0; i < M.length; i++) {
      // 書き順タップ：画のまん中をタップすれば、順番どおりに進む
      assert.equal(C.pickStroke(M, i, mid(i)), i, `${e.k} tap ${i + 1}`);
      // なぞり：そのまま、ずれても（±8）当たる。長い画の逆向きは外れ
      assert(C.judgeTrace(pts(i), M, i).ok, `${e.k} trace ${i + 1}`);
      assert(C.judgeTrace(pts(i).map(p => [p[0] + 8, p[1] - 8]), M, i).ok, `${e.k} sloppy trace ${i + 1}`);
      if (ST.polyLength(M[i]) > 20) assert.equal(C.judgeTrace(pts(i).reverse(), M, i).reason, 'reverse', `${e.k} reverse ${i + 1}`);
    }
    assert.equal(C.pickStroke(M, 0, [1, 108]), -1);
    const last = M.length - 1;
    if (C.distToStroke(mid(last), M[0]) > 12) { assert.equal(C.pickStroke(M, 0, mid(last)), last, `${e.k} wrong tap`); assert.equal(C.judgeTrace(pts(last), M, 0).ok, false, `${e.k} wrong-order trace`); }
  }
}

// ここからは、いちばん新しい範囲（11・12回目：59問・54字）で しくみを確かめる
const R0 = RANGES.find(r => r.id === '2g-11-12');
assert.equal(R0.questions.length, 59);
assert.equal(R0.kanji.length, 54);
assert.equal(R0.kanji.filter(e => e.known).length, 27);
const KANJI = R0.kanji;

// 練習の流れ：はじめての字は「思い出して書く」をしない。部品1つの字は 部品の問題なし
const multi = KANJI.find(e => e.parts.length > 1 && !e.known), single = KANJI.find(e => e.parts.length === 1);
assert.deepEqual(C.stepsFor(0, multi), ['meet', 'build', 'order', 'trace']);
assert.deepEqual(C.stepsFor(1, multi), ['pick', 'part', 'trace', 'recall']);
assert.deepEqual(C.stepsFor(2, multi), ['part', 'recall']);
assert.deepEqual(C.stepsFor(3, multi), ['pick', 'recall']);
assert.deepEqual(C.stepsFor(9, multi), ['pick', 'recall']);
assert.deepEqual(C.stepsFor(0, single), ['meet', 'order', 'trace']);
assert.deepEqual(C.stepsFor(2, single), ['pick', 'recall']);
// 1・2年生の字は、確かめる段から始まる
const known = KANJI.find(e => e.known);
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
    const g0 = C.guide(recs, KANJI, day, D1);
    if (d === 0) { assert.equal(g0.intro, Math.ceil(KANJI.length / C.INTRO_DAYS)); assert.equal(g0.floors, Math.ceil(g0.count / C.FLOOR_SIZE)); assert(g0.floors <= 4, 'first day guide stays small'); }
    for (let guard = 0; C.guide(recs, KANJI, day, D1).count > 0; guard++) {
      assert(guard < 60, 'guide never reaches zero');
      const floor = C.nextFloor(recs, KANJI, day);
      assert.equal(floor.length, C.FLOOR_SIZE);
      assert.equal(new Set(floor.map(x => x.k)).size, C.FLOOR_SIZE);
      for (const x of floor) recs[x.k] = C.advance(recs[x.k], 'good', day, KANJI.find(e => e.k === x.k), ++t);
    }
    if (d === C.INTRO_DAYS - 1) assert.equal(Object.keys(recs).length, KANJI.length, 'all kanji met within the intro days');
    // めやすを こえても 続けられる（おまけ）。弱い字・ごぶさたの字が先で、同じ3字ばかりに ならない
    const a = C.nextFloor(recs, KANJI, day);
    assert.equal(a.length, C.FLOOR_SIZE);
    if (Object.keys(recs).length === KANJI.length) {
      assert(a.every(x => x.kind === 'extra'));
      for (const x of a) recs[x.k] = C.advance(recs[x.k], 'good', day, KANJI.find(e => e.k === x.k), ++t);
      const b = C.nextFloor(recs, KANJI, day);
      assert(!b.some(x => a.some(y => y.k === x.k)), 'extra floors rotate');
    }
  }
  assert(KANJI.every(e => recs[e.k].lv === C.MAX_LV), 'steady success reaches ★3');
}
// 思い出せなかった字は、その日のうちに つぎの かいへ出てくる
{
  const recs = {}; const e = KANJI.find(x => !x.known);
  recs[e.k] = C.advance({ lv: 2, last: D1, first: D1 }, 'forgot', D2, e, 1);
  assert(C.nextFloor(recs, KANJI, D2).some(x => x.k === e.k && x.kind === 'due'));
}

// 出題は、まだの問題 と × だった問題が先
{
  const qs = R0.questions, tq = {};
  assert.deepEqual(C.examList(tq, qs).map(q => q.id), qs.slice(0, C.EXAM_SIZE).map(q => q.id));
  for (const q of qs.slice(0, 10)) tq[q.id] = { r: 'good', t: 1 };
  tq[qs[3].id] = { r: 'bad', t: 2 };
  const next = C.examList(tq, qs).map(q => q.id);
  assert.equal(next[0], qs[3].id);
  assert(!next.includes(qs[0].id));
  for (const q of qs) tq[q.id] = { r: 'good', t: q.id };
  assert.equal(C.examList(tq, qs).length, C.EXAM_SIZE, 'never runs out');
}

// ごほうび：レベルは だんだん上がりにくく、武器は 何か月も かけて そろえる量
assert.equal(C.levelOf(0), 1);
assert.equal(C.levelOf(C.xpFor(2) - 1), 1);
assert.equal(C.levelOf(C.xpFor(2)), 2);
assert.equal(C.levelOf(C.xpFor(30)), 30);
for (let L = 2; L < 60; L++) assert(C.xpFor(L + 1) - C.xpFor(L) > C.xpFor(L) - C.xpFor(L - 1));
assert(C.levelProgress(C.xpFor(5)) === 0 && C.levelProgress(C.xpFor(6) - 1) < 1);
assert.equal(C.WEAPONS[0].price, 0);
for (let i = 1; i < C.WEAPONS.length; i++) { assert(C.WEAPONS[i].price > C.WEAPONS[i - 1].price); assert(C.WEAPONS[i].atk > C.WEAPONS[i - 1].atk); }
assert.equal(new Set(C.WEAPONS.map(w => w.id)).size, C.WEAPONS.length);
assert.equal(C.weaponOf('nope').id, 'w0');
assert.equal(C.attackOf(0, 'w0'), 2 + C.WEAPONS[0].atk);
// まちがえても もらえる。ノーミス・はじめて・★3 は 少し多い。おまけと くり返しは 半分ずつ
const base = C.rewardFor({ kind: 'due', result: 'good', slips: 0 });
assert(C.rewardFor({ kind: 'due', result: 'forgot', slips: 0 }).gold > 0);
assert(C.rewardFor({ kind: 'due', result: 'good', slips: 1 }).gold < base.gold);
assert(C.rewardFor({ kind: 'new', result: 'good', slips: 0 }).gold > base.gold);
assert(C.rewardFor({ kind: 'due', result: 'good', slips: 0, star3: true }).gold > base.gold);
assert.equal(C.rewardFor({ kind: 'extra', result: 'good', slips: 0 }).gold, base.gold / 2);
assert.equal(C.rewardFor({ kind: 'extra', result: 'good', slips: 0, repeat: true }).gold, base.gold / 4);
// めやすどおりに 毎日 全部「書けた」で進めた 2週間の かせぎ：さいしょの武器は 2日以内、ぜんぶ そろうには 何か月も かかる
{
  const recs = {}; let gold = 0, t = 0, firstBuy = 0;
  const D0 = 20261116;
  for (let d = 0; d < 14; d++) {
    const day = C.addDays(D0, d); let floors = 0;
    for (let guard = 0; guard < 60 && C.guide(recs, KANJI, day, D0).count > 0; guard++) {
      for (const x of C.nextFloor(recs, KANJI, day)) { const e = KANJI.find(y => y.k === x.k), prev = recs[x.k], before = C.lvOf(prev, e); recs[x.k] = C.advance(prev, 'good', day, e, ++t); gold += C.rewardFor({ kind: x.kind, result: 'good', slips: 0, star3: recs[x.k].lv === 3 && before < 3, repeat: !!prev && prev.last === day }).gold; }
      floors++;
    }
    gold += floors * C.BONUS.floor.gold + C.BONUS.daily.gold;
    if (!firstBuy && gold >= C.WEAPONS[1].price) firstBuy = d + 1;
  }
  const all = C.WEAPONS.reduce((s, w) => s + w.price, 0), perDay = gold / 14;
  assert(firstBuy >= 1 && firstBuy <= 3, `first weapon on day ${firstBuy}`);
  assert(all / perDay > 120, `all weapons in ${Math.round(all / perDay)} days`);
  assert(all / perDay < 500, `all weapons in ${Math.round(all / perDay)} days`);
}
// エリア：10かいごとに かわり、さいごまで行ったら くり返す
assert.equal(C.zoneIndex(0), 0);
assert.equal(C.zoneIndex(9), 0);
assert.equal(C.zoneIndex(10), 1);
assert.equal(C.zoneIndex(C.ZONES.length * C.ZONE_FLOORS), 0);
for (const z of C.ZONES) assert(z.name && z.sky >= 0 && z.fog >= 0 && z.floor >= 0 && z.light >= 0);

// 範囲を作る道具：別の文章からでも データが作れる（一覧は ranges フォルダだけから作り直すので、変わらない）
{
  const { execFileSync } = require('node:child_process');
  const tmp = path.join(require('node:os').tmpdir(), `tower-range-${process.pid}.txt`);
  fs.writeFileSync(tmp, 'id: zz-test\ntitle: テスト用\ngrade: 3\n# メモ\n{湖|みずうみ}で{泳ぐ|およぐ}。\n{遊ぶ|あそぶ}{時|じ}{間|かん}。\n');
  const before = fs.readFileSync(path.join(TOWER, 'data/ranges.js'), 'utf8');
  try {
    execFileSync(process.execPath, [path.join(TOWER, 'tools/build_range.cjs'), tmp], { stdio: 'pipe' });
    const Z = require('../tower/data/zz-test.js');
    assert.equal(Z.questions.length, 5);
    assert.deepEqual(Z.questions[1], { id: 2, q: 'みずうみで[およぐ]。', a: '泳ぐ' });
    assert.deepEqual(Z.kanji.map(e => e.k), ['湖', '泳', '遊', '時', '間']);
    assert.equal(Z.kanji.find(e => e.k === '泳').q, 'みずうみで[およ]ぐ。');
    assert(Z.kanji.find(e => e.k === '時').known && !Z.kanji.find(e => e.k === '湖').known);
    for (const e of Z.kanji) assert.equal([...e.alts].length, 3);
    assert.equal(fs.readFileSync(path.join(TOWER, 'data/ranges.js'), 'utf8'), before);
  } finally { fs.rmSync(path.join(TOWER, 'data/zz-test.js'), { force: true }); fs.rmSync(tmp, { force: true }); }
}

// 画面側：スクリプトの構文と、参照している id
const html = fs.readFileSync(path.join(TOWER, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(TOWER, 'app.js'), 'utf8');
new (require('node:vm').Script)(app);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'duplicate DOM IDs');
for (const m of app.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(m[1]), `missing DOM ID ${m[1]}`);
for (const f of ['stroke-trace.js', 'tower-core.js', 'data/ranges.js', 'app.js', 'scene.mjs']) { assert(html.includes(`src="${f}"`), f); assert(fs.existsSync(path.join(TOWER, f)), f); }
for (const f of ['vendor/three.module.min.js', 'vendor/three.core.min.js', 'vendor/LICENSE-three.txt', 'tools/kanji-db.json']) assert(fs.existsSync(path.join(TOWER, f)), f);
// 章選択からはリンクしない（公開の合図が あるまで）
assert(!fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').includes('tower/'), 'tower must stay unlinked');
console.log('tower-core: ok');
