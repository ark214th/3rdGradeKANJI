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
// テストの回ごとの区切り（ドラゴンで 回ごとに 練習できる）。第4章と同じく 11回目 30問・12回目 29問
assert.deepEqual(R0.sections, ['11回目', '12回目']);
assert.equal(R0.questions.filter(q => q.sec === 0).length, 30);
assert.equal(R0.questions.filter(q => q.sec === 1).length, 29);
assert.deepEqual(R0.questions.slice(29, 31).map(q => [q.id, q.sec]), [[30, 0], [31, 1]]);
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
// その日に 思い出せなかった字は、同じ日に 書けても 段は 上がらず、あした もう一度
{
  const lapsed = C.advance({ lv: 2, last: D1, first: D1 }, 'forgot', D2, multi, 1);
  assert.deepEqual([lapsed.lv, lapsed.next, lapsed.lapse], [1, D2, D2]);
  const again = C.advance(lapsed, 'good', D2, multi, 2);
  assert.deepEqual([again.lv, again.next], [1, C.addDays(D2, 1)], 'same-day success after a lapse waits for tomorrow');
  const tomorrow = C.advance(again, 'good', C.addDays(D2, 1), multi, 3);
  assert.equal(tomorrow.lv, 2, 'next day it can climb again');
  assert.equal(tomorrow.lapse, undefined);
  const close = C.advance({ lv: 2, last: D1 }, 'close', D2, multi);
  assert.equal(C.advance(close, 'good', D2, multi).lv, 2);
}
// まちがいの多い字は、次に出るまでが短い
r = C.advance({ lv: 2, last: D1, miss: 2 }, 'good', D2, multi); assert.deepEqual([r.lv, r.next], [3, C.addDays(D2, 2)]);
// 知っているはずの字：書ければ一気に★3、書けなければ思い出しながらの段へ
r = C.advance(undefined, 'good', D1, known); assert.equal(r.lv, 3);
r = C.advance(undefined, 'forgot', D1, known); assert.deepEqual([r.lv, r.next], [1, D1]);

// きょうの 予定は その日の はじめに 1回 作る。予定の 字を ぜんぶ やると めやす 0。
// いくらでも遊べる：どんな状態でも、つぎの かいは 3体そろう。同じ字は 1かいに 1回だけ。5日目までに ぜんぶの字に出会う
{
  const recs = {}; let t = 0;
  for (let d = 0; d < 8; d++) {
    const day = C.addDays(D1, d), plan = C.makePlan(recs, KANJI, day, D1);
    const g0 = C.guide(recs, KANJI, day, D1, plan);
    if (d === 0) { assert.equal(g0.intro, Math.ceil(KANJI.length / C.INTRO_DAYS)); assert.equal(g0.floors, Math.ceil(g0.count / C.FLOOR_SIZE)); assert(g0.floors <= 4, 'first day guide stays small'); }
    assert(g0.count <= C.DAY_MAX && (g0.count >= C.DAY_MIN || g0.count === Object.keys(recs).length + g0.intro), `day ${d + 1}: ${g0.count} within the limits`);
    assert.equal(new Set(plan.map(x => x.k)).size, plan.length);
    for (let guard = 0; C.guide(recs, KANJI, day, D1, plan).count > 0; guard++) {
      assert(guard < 60, 'guide never reaches zero');
      const floor = C.nextFloor(recs, KANJI, day, 3, D1, plan);
      assert.equal(floor.length, C.FLOOR_SIZE);
      assert.equal(new Set(floor.map(x => x.k)).size, C.FLOOR_SIZE);
      for (const x of floor) recs[x.k] = C.advance(recs[x.k], 'good', day, KANJI.find(e => e.k === x.k), ++t);
    }
    if (d === C.INTRO_DAYS - 1) assert.equal(Object.keys(recs).length, KANJI.length, 'all kanji met within the intro days');
    // めやすを こえても 続けられる（おまけ）。同じ3字ばかりに ならない
    const a = C.nextFloor(recs, KANJI, day, 3, D1, plan);
    assert.equal(a.length, C.FLOOR_SIZE);
    if (Object.keys(recs).length === KANJI.length && a.every(x => x.kind === 'extra')) {
      for (const x of a) recs[x.k] = C.advance(recs[x.k], 'good', day, KANJI.find(e => e.k === x.k), ++t);
      const b = C.nextFloor(recs, KANJI, day, 3, D1, plan);
      assert(!b.some(x => a.some(y => y.k === x.k)), 'extra floors rotate');
    }
  }
}
// 思い出せなかった字は、その日のうちに もう一度 出る。ただし きょうの めやすには 数えず、めやすの 字の あとに 出る
{
  const recs = {}; const e = KANJI.find(x => !x.known);
  KANJI.forEach((x, i) => { recs[x.k] = { lv: 3, next: C.addDays(D2, 30), first: D1, last: D1, t: i }; });
  recs[e.k] = C.advance({ lv: 2, last: D1, first: D1 }, 'forgot', D2, e, 1);
  const plan = C.makePlan(recs, KANJI, D2, D1);
  assert(!plan.some(x => x.k === e.k));
  assert.deepEqual(C.nextFloor(recs, KANJI, D2, 3, D1, plan.filter(() => false))[0], { k: e.k, kind: 'due' });
}
// 上限：ふっかつの字が 多い日は、上限まで。のこりは あした（弱い字が 先）。めやすを こえて 遊ぶと 出てくる
{
  const recs = {};
  KANJI.forEach((x, i) => { recs[x.k] = { lv: i % 3, next: D2, first: D1, last: D1, t: i }; });
  const plan = C.makePlan(recs, KANJI, D2, D1);
  assert.equal(plan.length, C.DAY_MAX);
  assert(plan.every(x => recs[x.k].lv === 0), 'weakest first');
  const rest = KANJI.filter(x => !plan.some(y => y.k === x.k));
  assert(rest.every(x => recs[x.k].next <= D2), 'the rest stays due for tomorrow');
  for (const x of plan) recs[x.k] = C.advance(recs[x.k], 'good', D2, KANJI.find(y => y.k === x.k), 1);
  assert.equal(C.guide(recs, KANJI, D2, D1, plan).count, 0);
  assert.equal(C.nextFloor(recs, KANJI, D2, 3, D1, plan)[0].kind, 'due', 'after the chest, postponed kanji come first');
}
// 下限：ふっかつの字が 少ない日は、近い日に ふっかつする字を 前だおし
{
  const recs = {};
  KANJI.forEach((x, i) => { recs[x.k] = { lv: 2, next: C.addDays(D2, 1 + (i % 5)), first: D1, last: D1, t: i }; });
  const plan = C.makePlan(recs, KANJI, D2, D1);
  assert.equal(plan.length, C.DAY_MIN);
  assert(plan.every(x => recs[x.k].next === C.addDays(D2, 1)), 'soonest first');
}
// 予定を 作る前に 遊んだ分も 上限に 数える
{
  const recs = {};
  KANJI.forEach((x, i) => { recs[x.k] = { lv: 1, next: D2, first: D1, last: i < 10 ? D2 : D1, t: i }; });
  assert.equal(C.makePlan(recs, KANJI, D2, D1).length, C.DAY_MAX - 10);
}
// 宝箱の メーター（あと ◯かい）と、じっさいに 宝箱が出るまでの 回数は いつも 同じ。1日の かい数は 上限・下限の あいだ
// 毎日 メーターの 回数だけ たたかう。まちがいが 多くても、めやすより 多く 遊んだ 次の日でも ずれない
for (const [rate, extra] of [[0, 0], [0.2, 0], [0.4, 0], [0.1, 6]]) {
  const recs = {}; let t = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let d = 0; d < 14; d++) {
    const day = C.addDays(D1, d), plan = C.makePlan(recs, KANJI, day, D1), want = Math.max(1, C.guide(recs, KANJI, day, D1, plan).floors), plays = want + (d === 0 ? extra : 0);
    assert(want <= C.DAY_MAX / C.FLOOR_SIZE, `day ${d + 1}: ${want} floors`);
    let chestAt = 0;
    for (let f = 1; f <= plays; f++) {
      for (const x of C.nextFloor(recs, KANJI, day, 3, D1, plan)) { const e = KANJI.find(y => y.k === x.k); recs[x.k] = C.advance(recs[x.k], C.lvOf(recs[x.k], e) >= 1 && rnd() < rate ? 'forgot' : 'good', day, e, ++t); }
      if (!chestAt && C.guide(recs, KANJI, day, D1, plan).count === 0) chestAt = f;
    }
    assert.equal(chestAt || 1, want, `rate ${rate} extra ${extra} day ${d + 1}: meter ${want}, chest at ${chestAt}`);
  }
}
// 中ボスの かいを はさむときは、その 1回も 足して 数える。ドラゴンの 前からは かいが 進まない
assert.equal(C.fightsToChest(0, 30, 4), 4);
assert.equal(C.fightsToChest(7, 30, 4), 5);
assert.equal(C.fightsToChest(9, 30, 1), 2);
assert.equal(C.fightsToChest(27, 30, 4), 4);
assert.equal(C.fightsToChest(29, 30, 3), 3);
assert.equal(C.fightsToChest(30, 30, 2), 2);

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
    const plan = C.makePlan(recs, KANJI, day, D0);
    for (let guard = 0; guard < 60 && C.guide(recs, KANJI, day, D0, plan).count > 0; guard++) {
      for (const x of C.nextFloor(recs, KANJI, day, 3, D0, plan)) { const e = KANJI.find(y => y.k === x.k), prev = recs[x.k], before = C.lvOf(prev, e); recs[x.k] = C.advance(prev, 'good', day, e, ++t); gold += C.rewardFor({ kind: x.kind, result: 'good', slips: 0, star3: recs[x.k].lv === 3 && before < 3, repeat: !!prev && prev.last === day }).gold; }
      floors++;
    }
    gold += floors * C.BONUS.floor.gold + C.CHESTS.daily[1].gold + (floors >= 10 ? C.CHESTS.mid[1].gold : 0);
    if (!firstBuy && gold >= C.WEAPONS[1].price) firstBuy = d + 1;
  }
  const all = C.WEAPONS.reduce((s, w) => s + w.price, 0), perDay = gold / 14;
  assert(firstBuy >= 1 && firstBuy <= 3, `first weapon on day ${firstBuy}`);
  assert(all / perDay > 120, `all weapons in ${Math.round(all / perDay)} days`);
  assert(all / perDay < 500, `all weapons in ${Math.round(all / perDay)} days`);
}
// 武器：レベルで ぶきやに 並ぶ。どれも 必殺技の えんしゅつと 名前を もつ
assert(C.WEAPONS.every(w => w.fx && w.skill && w.lv >= 1));
for (let i = 1; i < C.WEAPONS.length; i++) assert(C.WEAPONS[i].lv > C.WEAPONS[i - 1].lv);
assert(C.weaponOpen(C.WEAPONS[0], 0) && !C.weaponOpen(C.WEAPONS[1], 0) && C.weaponOpen(C.WEAPONS[1], C.xpFor(C.WEAPONS[1].lv)));
assert.equal(new Set(C.WEAPONS.map(w => w.fx)).size, C.WEAPONS.length, 'every weapon has its own special');
assert.equal(C.heroLook(0).lv, 1);
assert.equal(C.heroLook(C.xpFor(10)).lv, 10);
// 宝箱：がんばりで きまる（運では きまらない）。いいほど 多い
for (const k of ['daily', 'mid', 'dragon']) { assert.equal(C.CHESTS[k].length, 3); assert(C.CHESTS[k][0].gold < C.CHESTS[k][1].gold && C.CHESTS[k][1].gold < C.CHESTS[k][2].gold); }
assert.deepEqual([C.dailyGrade(0, 0), C.dailyGrade(4, 10), C.dailyGrade(5, 10), C.dailyGrade(8, 10)], [0, 0, 1, 2]);
assert.deepEqual([C.midGrade(0), C.midGrade(2), C.midGrade(3)], [2, 1, 0]);
assert.deepEqual([C.dragonGrade(10, 10), C.dragonGrade(8, 10), C.dragonGrade(7, 10)], [2, 1, 0]);
// エリア：テスト範囲 1つが 1エリア。54字で 30かい。10かいごとに 中ボス、てっぺんに ドラゴン
assert.equal(C.areaFloors(54), 30);
assert.equal(C.areaFloors(5), 20);
assert.equal(C.areaFloors(200), 40);
assert.deepEqual([0, 8, 9, 10, 19, 28, 29, 30].map(f => C.floorKind(f, 30)), ['battle', 'battle', 'mid', 'battle', 'mid', 'battle', 'dragon', 'top']);
assert.equal(C.areaOf(0).name, C.AREAS[0].name);
assert.equal(C.areaOf(C.AREAS.length), C.AREAS[0]);
for (const a of C.AREAS) { assert(a.name && a.sky.length === 2 && a.mon.length >= 3 && a.mid && typeof a.hue === 'number'); assert(a.mon.every(m => ['slime', 'ghost', 'bat', 'golem', 'eye', 'shroom'].includes(m))); }
// 中ボスの 問題：出会った字だけ、弱い字から
{
  const recs = {}; KANJI.slice(0, 8).forEach((e, i) => { recs[e.k] = { lv: i % 4, next: 0, t: i, miss: 0 }; });
  const pick = C.reviewPick(recs, KANJI, 6);
  assert.equal(pick.length, 6);
  assert(pick.every(k => recs[k]));
  assert.equal(recs[pick[0]].lv, 0);
  assert.equal(C.reviewPick({}, KANJI, 6).length, 0);
}

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
    assert.deepEqual(Z.sections, undefined, 'no section picker without headings');
    for (const e of Z.kanji) assert.equal([...e.alts].length, 3);
    assert.equal(fs.readFileSync(path.join(TOWER, 'data/ranges.js'), 'utf8'), before);
  } finally { fs.rmSync(path.join(TOWER, 'data/zz-test.js'), { force: true }); fs.rmSync(tmp, { force: true }); }
}

// 画面側：スクリプトの構文と、参照している id
const html = fs.readFileSync(path.join(TOWER, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(TOWER, 'app.js'), 'utf8');
new (require('node:vm').Script)(app);
new (require('node:vm').Script)(fs.readFileSync(path.join(TOWER, 'sound.js'), 'utf8'));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'duplicate DOM IDs');
const made = [...app.matchAll(/\bid="([^"$]+)"/g)].map(m => m[1]); // 画面の動きの中で 作る ボタン
for (const m of app.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(m[1]) || made.includes(m[1]), `missing DOM ID ${m[1]}`);
for (const f of ['stroke-trace.js', 'tower-core.js', 'sound.js', 'data/ranges.js', 'app.js', 'scene.mjs']) { assert(html.includes(`src="${f}"`), f); assert(fs.existsSync(path.join(TOWER, f)), f); }
for (const f of ['vendor/three.module.min.js', 'vendor/three.core.min.js', 'vendor/LICENSE-three.txt', 'tools/kanji-db.json']) assert(fs.existsSync(path.join(TOWER, f)), f);
// 章選択から 入れる。第1〜4章とは べつの ゲームだと 書いてある。塔からは 章選択へ もどれる
const top = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(top.includes('href="tower/index.html"') && top.includes('第1〜4章とは べつの ゲーム'));
assert(html.includes('href="../index.html"'));
console.log('tower-core: ok');
