/*
 * 漢字の塔（試作4）— 画面に依存しない部分。
 * 「書く前に形を知る」練習：読みから字をえらぶ → 部品をえらぶ・正しい場所に置く → 書き順をタップ → ゆるいなぞり → 思い出して書く。
 * 1日の上限はなく、出来に合わせて 字ごとの段（lv）と 次に出る日が かわる。テスト前は テストと同じ問題文で れんしゅうする。
 * 画の形の判定は chapter4/stroke-trace.js（StrokeTrace）を使う。座標は KanjiVG と同じ 109×109。
 * ブラウザでは window.TowerCore、node では require() で使う。
 */
(function (root) {
  'use strict';
  const ST = root.StrokeTrace || (typeof require !== 'undefined' ? require('../chapter4/stroke-trace.js') : null);

  // 出題データ（tower/tower-data.js。tools/build_data.cjs で第4章のテスト範囲から作る）
  const DATA = root.TOWER_DATA || (typeof require !== 'undefined' ? require('./tower-data.js') : { kanji: [] });
  const KANJI = DATA.kanji;

  const MAX_LV = 3;
  const GAPS = [1, 2, 4, 7];      // lv が 1,2,3 になったあと、次に「ふっかつ」するまでの日数（さいごは 仕上がった後の見直し）
  const KNOWN_LV = 2;             // 1・2年生の字は「もう知っているはず」として、確かめる段から始める
  const INTRO_DAYS = 3;           // はじめの この日数で、ぜんぶの字に 一度は出会う（1日の めやす）
  const EXAM_DAYS = 3;            // テスト前の この日数は、テストれんしゅうを すすめる
  const FLOOR_SIZE = 3;           // 1かい（ひとくぎり）で たたかう数
  const EXAM_SIZE = 10;           // テストれんしゅう 1回の問題数
  const TRACE_TOL = 28;           // なぞりは ゆるく：向きと おおよその場所だけ見る
  const TRACE_AUTO = 3;           // 同じ画で これだけ外れたら、代わりに書いて進む

  // 段ごとの練習の流れ
  const STEPS = [
    ['meet', 'build', 'order', 'trace'],     // lv0：はじめまして（お手本つき）
    ['pick', 'part', 'trace', 'recall'],     // lv1：思い出しながら
    ['part', 'recall'],                      // lv2：部品を たしかめて、思い出して書く
    ['pick', 'recall'],                      // lv3：テストと同じ
  ];
  // 部品が1つだけの字は「くみたて」「部品えらび」をしない（lv2 は かわりに「どの字？」）
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

  /* ---------- 日をあけて戻ってくる ---------- */
  function dayKey(date, offset) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (offset || 0));
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function addDays(key, n) { return dayKey(toDate(key), n); }
  const toDate = key => new Date(Math.floor(key / 10000), Math.floor(key / 100) % 100 - 1, key % 100);
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
  const strokesOf = e => e.parts[e.parts.length - 1].to;

  /*
   * いまの ようす。1日の上限は ない（いくらでも遊べる）。
   * due: ふっかつした字（弱い字・古い字が先）／fresh: まだ出会っていない3年生の字（画数の少ない順）
   * check: まだ確かめていない1・2年生の字／extra: 出会ったけれど まだ ふっかつしていない字（弱い字・ごぶさたの字が先）
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
    const q = queues(recs, entries, today), out = [];
    const src = [['due', q.due], ['new', q.fresh], ['check', q.check]];
    for (let i = 0; out.length < (n || FLOOR_SIZE) && src.some(s => s[1].length); i++) {
      const s = src[i % src.length];
      if (s[1].length) out.push({ k: s[1].shift().k, kind: s[0] });
    }
    for (const e of q.extra) { if (out.length >= (n || FLOOR_SIZE)) break; out.push({ k: e.k, kind: 'extra' }); }
    return out;
  }
  /*
   * きょうの めやす（のこり何体か）。こえても 止めない。
   * ふっかつした字は ぜんぶ。はじめての字は、開始から INTRO_DAYS 日で 全部に出会える数。
   */
  function guide(recs, entries, today, startDay) {
    const q = queues(recs, entries, today);
    const left = Math.max(1, INTRO_DAYS - Math.max(0, daysBetween(startDay || today, today)));
    const metToday = entries.filter(e => recs[e.k] && recs[e.k].first === today).length;
    const unmet = q.fresh.length + q.check.length;
    const intro = Math.min(unmet, Math.max(0, Math.ceil((unmet + metToday) / left) - metToday));
    return { due: q.due.length, intro, unmet, count: q.due.length + intro };
  }
  /*
   * 1字の練習が終わったときの記録（出来に合わせて、段と 次に出る日が かわる）。
   * result: 'good'（同じに書けた／まちがいなし）、'close'（すこし ちがった・えらぶ問題で まちがえた）、'forgot'（思い出せなかった）
   * - good: 段が上がる。ただし ★3（lv3）は、前に練習した日と ちがう日に書けたときだけ（ねむった後も おぼえているか）。
   * - close: 同じ段（lv0 は lv1 へ）。あした もう一度。
   * - forgot: lv2 以上は lv1 へ、lv1 以下は お手本つきの lv0 へ。きょうのうちに もう一度 出る。
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
   * テストれんしゅうの出題（n問）：まだ ○ に なっていない問題 → 前に × だった問題 → 前に やってから 時間がたった問題。
   * tq[id] = { r: 'good' | 'bad', t: いつ }
   */
  function examList(tq, questions, n) {
    const rank = q => { const r = tq[q.id]; return !r ? 1 : r.r === 'bad' ? 0 : 2; };
    return questions.slice().sort((a, b) => rank(a) - rank(b) || ((tq[a.id] || {}).t || 0) - ((tq[b.id] || {}).t || 0) || a.id - b.id).slice(0, n || EXAM_SIZE);
  }

  const api = { KANJI, DATA, MAX_LV, GAPS, KNOWN_LV, INTRO_DAYS, EXAM_DAYS, FLOOR_SIZE, EXAM_SIZE, TRACE_TOL, TRACE_AUTO, stepsFor, startLv, lvOf, prep, boxOf, partOf, distToStroke, pickStroke, judgeTrace, dayKey, addDays, daysBetween, queues, nextFloor, guide, advance, examList };
  root.TowerCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
