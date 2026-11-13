/*
 * 漢字の塔（試作3）— 画面に依存しない部分。
 * 「書く前に形を知る」練習：読みから字をえらぶ → 部品を正しい場所に置く → 書き順をタップ → ゆるいなぞり → 思い出して書く。
 * 字は日をあけて戻ってきて、そのたびに段（lv）が上がる。
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
  const GAPS = [1, 2, 4, 7];      // lv が 1,2,3 になったあと、次に出るまでの日数（さいごは 仕上がった後の見直し）
  const KNOWN_LV = 2;             // 1・2年生の字は「もう知っているはず」として、確かめる段から始める
  const BUFFER_DAYS = 3;          // テスト前のこの日数は、新しい字を入れず 見直しだけにする
  const FLOOR_SIZE = 3;           // 1かい（ひとくぎり）で たたかう数
  const TRACE_TOL = 28;           // なぞりは ゆるく：向きと おおよその場所だけ見る
  const TRACE_AUTO = 3;           // 同じ画で これだけ外れたら、代わりに書いて進む

  // 段ごとの練習の流れ
  const STEPS = [
    ['meet', 'build', 'order', 'trace'],     // lv0：はじめまして（お手本つき）
    ['pick', 'build', 'trace', 'recall'],    // lv1：思い出しながら
    ['pick', 'recall'],                      // lv2〜：テストと同じ
  ];
  // 部品が1つだけの字は「くみたて」をしない
  const stepsFor = (lv, entry) => STEPS[Math.min(lv, STEPS.length - 1)].filter(s => s !== 'build' || !entry || entry.parts.length > 1);
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
  /*
   * きょう出す字（テストの日から逆算する）。
   * 1) 戻ってきた字（古い順） 2) はじめての 3年生の字 3) 知っているはずの字の確かめ
   * 2) と 3) は、テストの BUFFER_DAYS 日前までに全部 一度は出るように、1日の数を決める。
   * recs[k].first が きょうの字は「きょう もう始めた分」として数から引く。
   */
  function todayPlan(recs, entries, today, testDay) {
    const started = e => !!recs[e.k];
    const due = entries.filter(e => started(e) && recs[e.k].next <= today).sort((a, b) => recs[a.k].next - recs[b.k].next);
    const learnDays = Math.max(1, daysBetween(today, testDay) - BUFFER_DAYS);
    const pick = (known, lo, hi) => {
      // はじめての字は、画数の少ないものから（やさしい字で はずみをつける）
      const strokes = e => e.parts[e.parts.length - 1].to;
      const rest = entries.filter(e => !started(e) && !!e.known === known).sort((a, b) => (known ? 0 : strokes(a) - strokes(b)));
      const doneToday = entries.filter(e => started(e) && recs[e.k].first === today && !!e.known === known).length;
      const rate = Math.max(lo, Math.min(hi, Math.ceil((rest.length + doneToday) / learnDays)));
      return rest.slice(0, Math.max(0, rate - doneToday));
    };
    const fresh = pick(false, 2, 5), check = pick(true, 2, 6);
    return { due: due.map(e => e.k), fresh: fresh.map(e => e.k), check: check.map(e => e.k), list: due.concat(fresh, check).map(e => e.k) };
  }
  /*
   * 1字の練習が終わったときの記録。
   * result: 'good'（おなじに書けた／思い出す場面なし）、'close'（すこし ちがった）、'forgot'（思い出せなかった）
   * good は段が上がる。close は同じ段を あした もう一度。forgot は 思い出しながらの段（lv1）へ戻る。
   */
  function advance(rec, result, today, entry) {
    const lv = lvOf(rec, entry);
    const nlv = result === 'good' ? Math.min(MAX_LV, lv + 1) : result === 'close' ? Math.max(1, lv) : 1;
    const gap = result !== 'good' ? 1 : lv >= MAX_LV ? GAPS[MAX_LV] : GAPS[nlv - 1];
    return { lv: nlv, next: addDays(today, gap), seen: ((rec && rec.seen) | 0) + 1, first: (rec && rec.first) || today };
  }

  const api = { KANJI, DATA, MAX_LV, GAPS, KNOWN_LV, BUFFER_DAYS, FLOOR_SIZE, TRACE_TOL, TRACE_AUTO, stepsFor, startLv, lvOf, prep, boxOf, partOf, distToStroke, pickStroke, judgeTrace, dayKey, addDays, daysBetween, todayPlan, advance };
  root.TowerCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
