/*
 * 漢字の塔 — 画面に依存しない部分（判定、出題の順番、ごほうびの計算）。
 * 練習の考え方は「書く前に形を知る」：読みから字をえらぶ → 部品をえらぶ・正しい場所に置く → 書き順をタップ → ゆるいなぞり → 思い出して書く。
 * 1日の上限はなく、出来に合わせて 字ごとの段（★）と 次に出る日が かわる。テストの日は 決めない（いつ来るか わからないので、早めに ひと通り出会う）。
 * ボスでは テストと同じ問題文で れんしゅうする。
 * テスト範囲のデータ（tower/data/*.js）は 引数で受け取る。座標は KanjiVG と同じ 109×109。
 * ブラウザでは window.TowerCore、node では require() で使う。
 */
(function (root) {
  'use strict';
  const ST = root.StrokeTrace || (typeof require !== 'undefined' ? require('./stroke-trace.js') : null);

  const MAX_LV = 3;
  const GAPS = [1, 2, 4, 7];      // ★が 1,2,3 になったあと、次に「ふっかつ」するまでの日数（さいごは 仕上がった後の見直し）
  const KNOWN_LV = 2;             // 下の学年の字は「もう知っているはず」として、確かめる段から始める
  const INTRO_DAYS = 5;           // はじめの この日数で、ぜんぶの字に 一度は出会う（1日の めやす）
  const FLOOR_SIZE = 3;           // 1かい（ひとくぎり）で たたかう数
  const EXAM_SIZE = 10;           // ボス 1回の問題数
  const TRACE_TOL = 28;           // なぞりは ゆるく：向きと おおよその場所だけ見る
  const TRACE_AUTO = 3;           // 同じ画で これだけ外れたら、代わりに書いて進む

  // 段ごとの練習の流れ
  const STEPS = [
    ['meet', 'build', 'order', 'trace'],     // ★0：はじめまして（お手本つき）
    ['pick', 'part', 'trace', 'recall'],     // ★1：思い出しながら
    ['part', 'recall'],                      // ★2：部品を たしかめて、思い出して書く
    ['pick', 'recall'],                      // ★3：テストと同じ
  ];
  // 部品が1つだけの字は「くみたて」「部品えらび」をしない（★2 は かわりに「どの字？」）
  function stepsFor(lv, entry) {
    const steps = STEPS[Math.min(lv, STEPS.length - 1)];
    if (!entry || entry.parts.length > 1) return steps.slice();
    const out = steps.filter(s => s !== 'build' && s !== 'part');
    return out.length < 2 && !out.includes('pick') ? ['pick'].concat(out) : out;
  }
  const startLv = entry => (entry && entry.known ? KNOWN_LV : 0);
  const lvOf = (rec, entry) => (rec ? rec.lv | 0 : startLv(entry));

  const prep = strokes => strokes.map(d => ST.flatten(d));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  // 部品（from〜to 画）の外わく [x0,y0,x1,y1]
  function boxOf(models, from, to, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = from - 1; i < to; i++) for (const p of models[i]) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const d = pad || 0;
    return [x0 - d, y0 - d, x1 + d, y1 + d];
  }
  // 画番号（0始まり）が入っている部品の番号
  function partOf(entry, pos) {
    return entry.parts.findIndex(p => pos + 1 >= p.from && pos + 1 <= p.to);
  }

  /* ---------- 書き順タップ ---------- */
  function distToStroke(pt, pts) {
    let best = 1e9;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L)) : 0;
      best = Math.min(best, dist(pt, [a[0] + dx * t, a[1] + dy * t]));
    }
    return best;
  }
  /*
   * タップした場所から、どの画をえらんだかを返す（まだの画だけが対象）。
   * 指は太いので、次に書くべき画が いちばん近い画と ほぼ同じ近さなら、次の画をえらんだことにする。
   * どの画からも遠いときは -1。
   */
  function pickStroke(models, pos, pt, reach) {
    const r = reach || 12;
    let best = -1, bd = 1e9;
    for (let j = pos; j < models.length; j++) { const d = distToStroke(pt, models[j]); if (d < bd) { bd = d; best = j; } }
    if (bd > r) return -1;
    if (distToStroke(pt, models[pos]) <= Math.max(bd * 1.4, bd + 3.5)) return pos;
    return best;
  }

  /* ---------- ゆるいなぞり ---------- */
  // 向きと おおよその場所が合えば当たり。外れたとき、後ろの画に ぴったり合うなら「書き順ちがい」。
  function judgeTrace(user, models, pos) {
    const r = ST.judgeStroke(user, models[pos], { tol: TRACE_TOL });
    if (r.ok) return r;
    if (r.reason !== 'reverse') for (let j = pos + 1; j < models.length; j++) {
      if (ST.judgeStroke(user, models[j], { tol: ST.TOL }).ok) return { ok: false, reason: 'order', at: j };
    }
    return r;
  }

  /* ---------- 日付 ---------- */
  function dayKey(date, offset) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (offset || 0));
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  const toDate = key => new Date(Math.floor(key / 10000), Math.floor(key / 100) % 100 - 1, key % 100);
  function addDays(key, n) { return dayKey(toDate(key), n); }
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
  const strokesOf = e => e.parts[e.parts.length - 1].to;

  /* ---------- 出題の順番 ---------- */
  /*
   * いまの ようす。1日の上限は ない（いくらでも遊べる）。
   * due: ふっかつした字（弱い字・古い字が先）／fresh: まだ出会っていない この学年の字（画数の少ない順）
   * check: まだ確かめていない 下の学年の字／extra: 出会ったけれど まだ ふっかつしていない字（弱い字・ごぶさたの字が先）
   */
  function queues(recs, entries, today) {
    const met = e => !!recs[e.k];
    const by = (...keys) => (a, b) => { for (const f of keys) { const d = f(a) - f(b); if (d) return d; } return 0; };
    return {
      due: entries.filter(e => met(e) && recs[e.k].next <= today).sort(by(e => recs[e.k].lv, e => recs[e.k].next, e => recs[e.k].t || 0)),
      fresh: entries.filter(e => !met(e) && !e.known).sort(by(strokesOf)),
      check: entries.filter(e => !met(e) && e.known),
      extra: entries.filter(e => met(e) && recs[e.k].next > today).sort(by(e => (recs[e.k].last === today ? 1 : 0), e => recs[e.k].lv, e => recs[e.k].t || 0)),
    };
  }
  /*
   * つぎの かい（n体）。ふっかつ・はじめての字・たしかめを 順ぐりにまぜる。
   * ぜんぶ なくなっても、おまけの練習（extra）で いつでも n体 そろう。
   */
  function nextFloor(recs, entries, today, n) {
    const q = queues(recs, entries, today), out = [], size = Math.min(n || FLOOR_SIZE, entries.length);
    const src = [['due', q.due], ['new', q.fresh], ['check', q.check]];
    for (let i = 0; out.length < size && src.some(s => s[1].length); i++) {
      const s = src[i % src.length];
      if (s[1].length) out.push({ k: s[1].shift().k, kind: s[0] });
    }
    for (const e of q.extra) { if (out.length >= size) break; out.push({ k: e.k, kind: 'extra' }); }
    return out;
  }
  /*
   * きょうの めやす（のこり）。こえても 止めない。
   * ふっかつした字は ぜんぶ。はじめての字は、開始から INTRO_DAYS 日で 全部に出会える数。
   * floors は それを「何かい ぶんか」に直した数（画面では 体の数でなく こちらを見せる）。
   */
  function guide(recs, entries, today, startDay) {
    const q = queues(recs, entries, today);
    const left = Math.max(1, INTRO_DAYS - Math.max(0, daysBetween(startDay || today, today)));
    const metToday = entries.filter(e => recs[e.k] && recs[e.k].first === today).length;
    const unmet = q.fresh.length + q.check.length;
    const intro = Math.min(unmet, Math.max(0, Math.ceil((unmet + metToday) / left) - metToday));
    const count = q.due.length + intro;
    return { due: q.due.length, intro, unmet, count, floors: Math.ceil(count / FLOOR_SIZE) };
  }
  /*
   * 1字の練習が終わったときの記録（出来に合わせて、段と 次に出る日が かわる）。
   * result: 'good'（同じに書けた／まちがいなし）、'close'（すこし ちがった・えらぶ問題で まちがえた）、'forgot'（思い出せなかった）
   * - good: 段が上がる。ただし ★3 は、前に練習した日と ちがう日に書けたときだけ（ねむった後も おぼえているか）。
   * - close: 同じ段（★0 は ★1 へ）。あした もう一度。
   * - forgot: ★2 以上は ★1 へ、★1 以下は お手本つきの ★0 へ。きょうのうちに もう一度 出る。
   * まちがいが 2回以上ある字は、次に出るまでの日数を 半分にする。
   */
  function advance(rec, result, today, entry, now) {
    const lv = lvOf(rec, entry);
    let nlv = result === 'good' ? Math.min(MAX_LV, lv + 1) : result === 'close' ? Math.max(1, lv) : lv >= 2 ? 1 : 0;
    if (result === 'good' && nlv === MAX_LV && rec && rec.last === today && lv < MAX_LV) nlv = MAX_LV - 1;
    const miss = ((rec && rec.miss) | 0) + (result === 'good' ? 0 : 1);
    let gap = result === 'forgot' ? 0 : result === 'close' ? 1 : lv >= MAX_LV ? GAPS[MAX_LV] : GAPS[Math.max(1, nlv) - 1];
    if (result === 'good' && miss >= 2) gap = Math.max(1, Math.ceil(gap / 2));
    return { lv: nlv, next: addDays(today, gap), seen: ((rec && rec.seen) | 0) + 1, first: (rec && rec.first) || today, last: today, miss, t: now || Date.now() };
  }
  /*
   * ボス（テストれんしゅう）の出題（n問）：まだ ○ に なっていない問題 → 前に × だった問題 → 前に やってから 時間がたった問題。
   * tq[id] = { r: 'good' | 'bad', t: いつ }
   */
  function examList(tq, questions, n) {
    const rank = q => { const r = tq[q.id]; return !r ? 1 : r.r === 'bad' ? 0 : 2; };
    return questions.slice().sort((a, b) => rank(a) - rank(b) || ((tq[a.id] || {}).t || 0) - ((tq[b.id] || {}).t || 0) || a.id - b.id).slice(0, n || EXAM_SIZE);
  }

  /* ---------- ごほうび（何か月も つづけられるよう、ひかえめに） ---------- */
  // レベル L に なるのに必要な 経験値の合計。L2=80、L5=560、L10=2160、L20=8360、L30=18560
  const xpFor = L => 20 * (L - 1) * (L + 2);
  function levelOf(xp) { let L = 1; while (xpFor(L + 1) <= xp) L++; return L; }
  // レベルの中での進み具合（0〜1）
  function levelProgress(xp) { const L = levelOf(xp); return (xp - xpFor(L)) / (xpFor(L + 1) - xpFor(L)); }

  // 武器。強さ（atk）は ダメージの数字と えんしゅつが かわるだけで、問題の やさしさは かわらない
  const WEAPONS = [
    { id: 'w0', name: '木のつるぎ', price: 0, atk: 2, kind: 'sword', color: 0xb9814a, glow: 0xffe0a0 },
    { id: 'w1', name: 'てつのつるぎ', price: 400, atk: 5, kind: 'sword', color: 0xc9d3dd, glow: 0xffffff },
    { id: 'w2', name: 'ほのおのつるぎ', price: 1000, atk: 9, kind: 'sword', color: 0xff6a2a, glow: 0xffb347 },
    { id: 'w3', name: 'こおりのやり', price: 2000, atk: 14, kind: 'spear', color: 0x8fe3ff, glow: 0xc8f4ff },
    { id: 'w4', name: 'かみなりハンマー', price: 3500, atk: 20, kind: 'hammer', color: 0xffe14a, glow: 0xfff7a8 },
    { id: 'w5', name: 'かぜのかたな', price: 5500, atk: 27, kind: 'katana', color: 0x7dffb0, glow: 0xd4ffe6 },
    { id: 'w6', name: 'ひかりのつるぎ', price: 8000, atk: 35, kind: 'sword', color: 0xfff6c8, glow: 0xffffff },
    { id: 'w7', name: 'やみのかま', price: 11000, atk: 44, kind: 'scythe', color: 0xb06bff, glow: 0xe2c8ff },
    { id: 'w8', name: 'りゅうのつるぎ', price: 14500, atk: 54, kind: 'sword', color: 0xff3d6e, glow: 0xffa8c0 },
    { id: 'w9', name: 'ほしのつるぎ', price: 18500, atk: 65, kind: 'katana', color: 0x6ea8ff, glow: 0xdde9ff },
    { id: 'w10', name: 'でんせつの漢字剣', price: 23000, atk: 80, kind: 'sword', color: 0xffd166, glow: 0xfff1c0 },
  ];
  const weaponOf = id => WEAPONS.find(w => w.id === id) || WEAPONS[0];
  const attackOf = (xp, weaponId) => levelOf(xp) * 2 + weaponOf(weaponId).atk;

  /*
   * まもの1体を たおしたときの ごほうび。
   * kind: 'due' | 'new' | 'check' | 'extra'、result: 'good' | 'close' | 'forgot'
   * slips: えらぶ問題の まちがい数、star3: いま ★3 に なった、repeat: きょう もう練習した字
   * めやすを こえた「おまけ」と、同じ日の くり返しは 半分ずつ（かせぎ目当ての 連打を ふせぐ）。
   */
  function rewardFor(o) {
    let gold = o.result === 'forgot' ? 4 : 8, xp = o.result === 'forgot' ? 8 : 12;
    if (o.kind === 'new' || o.kind === 'check') { gold += 4; xp += 6; }
    if (o.result === 'good' && !o.slips) { gold += 4; xp += 4; }
    if (o.star3) { gold += 10; xp += 10; }
    let f = 1;
    if (o.kind === 'extra') f *= 0.5;
    if (o.repeat) f *= 0.5;
    return { gold: Math.max(1, Math.round(gold * f)), xp: Math.max(1, Math.round(xp * f)) };
  }
  const BONUS = {
    floor: { gold: 10, xp: 0 },        // 1かい のぼった
    daily: { gold: 50, xp: 30 },       // きょうの めやす達成の たからばこ（1日1回）
    examHit: { gold: 6, xp: 8 },       // ボスの問題を 一回で ○
    examRetry: { gold: 2, xp: 3 },     // 出し直しで ○
    bossWin: { gold: 40, xp: 30 },     // ボスに勝った（8わり以上を 一回で ○。1日1回）
  };
  const BOSS_PASS = 0.8;

  // 塔のエリア（10かいごとに 景色が かわる。さいごまで行ったら 色ちがいで くり返す）
  const ZONES = [
    { name: '石の間', sky: 0x1b1838, fog: 0x2b2760, floor: 0x5d5a7a, light: 0xffc98a },
    { name: '森の回廊', sky: 0x10281f, fog: 0x1f4a35, floor: 0x4f7a56, light: 0xd8ff9a },
    { name: '氷の広間', sky: 0x10243a, fog: 0x2a5578, floor: 0x8fb8d6, light: 0xcfefff },
    { name: '溶岩の階', sky: 0x2a0f0c, fog: 0x5a1f14, floor: 0x7a4a3c, light: 0xff8a4a },
    { name: '雲の上', sky: 0x3a4f8a, fog: 0x8fa8e0, floor: 0xd8e2ff, light: 0xffffff },
    { name: '星の間', sky: 0x08061c, fog: 0x1a1450, floor: 0x3b2f7a, light: 0xc8b8ff },
  ];
  const ZONE_FLOORS = 10;
  const zoneIndex = floor => Math.floor(floor / ZONE_FLOORS) % ZONES.length;
  const zoneOf = floor => ZONES[zoneIndex(floor)];

  const api = { MAX_LV, GAPS, KNOWN_LV, INTRO_DAYS, FLOOR_SIZE, EXAM_SIZE, TRACE_TOL, TRACE_AUTO, stepsFor, startLv, lvOf, prep, boxOf, partOf, distToStroke, pickStroke, judgeTrace,
    dayKey, addDays, daysBetween, queues, nextFloor, guide, advance, examList,
    xpFor, levelOf, levelProgress, WEAPONS, weaponOf, attackOf, rewardFor, BONUS, BOSS_PASS, ZONES, ZONE_FLOORS, zoneIndex, zoneOf };
  root.TowerCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
