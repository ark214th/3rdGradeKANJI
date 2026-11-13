/*
 * 漢字の塔（試作2）— 画面に依存しない部分。
 * 「書く前に形を知る」練習：読みから字をえらぶ → 部品を正しい場所に置く → 書き順をタップ → ゆるいなぞり → 思い出して書く。
 * 字は日をあけて戻ってきて、そのたびに段（lv）が上がる。
 * 画の形の判定は chapter4/stroke-trace.js（StrokeTrace）を使う。座標は KanjiVG と同じ 109×109。
 * ブラウザでは window.TowerCore、node では require() で使う。
 */
(function (root) {
  'use strict';
  const ST = root.StrokeTrace || (typeof require !== 'undefined' ? require('../chapter4/stroke-trace.js') : null);

  /*
   * 試作の漢字。
   * parts: 部品ごとの画の範囲（from〜to は 1 始まり）。
   * decoys: 組み立てに混ぜる、にている別の部品（src の字の from〜to 画）。
   * q: 問題文。[ ] の中が書く字の読み。memo: 部品でおぼえる一言。
   */
  const KANJI = [
    { k: '住', enemy: '👻', name: 'すみつきゴースト', q: 'ビルの にかいに [す]む。', memo: '人（にんべん）が、主（あるじ）の いえに 住む。',
      parts: [{ name: 'にんべん', from: 1, to: 2 }, { name: '主', from: 3, to: 7 }],
      decoys: [{ src: '行', from: 1, to: 3 }, { src: '理', from: 1, to: 4 }, { src: '生', from: 1, to: 5 }] },
    { k: '短', enemy: '👺', name: 'ちび矢ゴブリン', q: '[みじか]い ことばで あらわす。', memo: '矢（や）も 豆（まめ）も、どちらも 短い。',
      parts: [{ name: 'やへん', from: 1, to: 5 }, { name: '豆', from: 6, to: 12 }],
      decoys: [{ src: '和', from: 1, to: 5 }, { src: '立', from: 1, to: 5 }, { src: '員', from: 1, to: 10 }] },
    { k: '委', enemy: '🌾', name: 'いなほの まじょ', q: '[い]いんかいの しごと。', memo: 'いね（禾）を、女の人に 委（ゆだ）ねる。上が 禾、下が 女。',
      parts: [{ name: '禾（のぎ）', from: 1, to: 5 }, { name: '女', from: 6, to: 8 }],
      decoys: [{ src: '米', from: 1, to: 6 }, { src: '字', from: 4, to: 6 }, { src: '文', from: 1, to: 4 }] },
    { k: '級', enemy: '🕷️', name: 'いとまきグモ', q: 'がっ[きゅう]しんぶんを つくる。', memo: '糸（いと）が つぎつぎ 及（およ）んで、学級の なかまに なる。',
      parts: [{ name: 'いとへん', from: 1, to: 6 }, { name: '及', from: 7, to: 9 }],
      decoys: [{ src: '橋', from: 1, to: 4 }, { src: '板', from: 5, to: 8 }, { src: '友', from: 1, to: 4 }] },
    { k: '階', enemy: '🗿', name: 'かいだんゴーレム', q: 'ビルの に[かい]に すむ。', memo: 'おか（こざとへん）を、皆（みんな）で のぼる 階だん。',
      parts: [{ name: 'こざとへん', from: 1, to: 3 }, { name: '比', from: 4, to: 7 }, { name: '白', from: 8, to: 12 }],
      decoys: [{ src: '持', from: 1, to: 3 }, { src: '化', from: 1, to: 4 }, { src: '目', from: 1, to: 5 }] },
  ];

  const MAX_LV = 3;
  const GAPS = [1, 2, 4, 7];      // lv が 1,2,3 になったあと、次に出るまでの日数（さいごは 仕上がった後の見直し）
  const NEW_PER_DAY = 2;          // 1日に出会う新しい字
  const PER_DAY = 4;              // 1日に出る字の上限
  const TRACE_TOL = 28;           // なぞりは ゆるく：向きと おおよその場所だけ見る
  const TRACE_AUTO = 3;           // 同じ画で これだけ外れたら、代わりに書いて進む

  // 段ごとの練習の流れ
  const STEPS = [
    ['meet', 'build', 'order', 'trace'],     // lv0：はじめまして（お手本つき）
    ['pick', 'build', 'trace', 'recall'],    // lv1：思い出しながら
    ['pick', 'recall'],                      // lv2〜：テストと同じ
  ];
  const stepsFor = lv => STEPS[Math.min(lv, STEPS.length - 1)];

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
  function addDays(key, n) {
    return dayKey(new Date(Math.floor(key / 10000), Math.floor(key / 100) % 100 - 1, key % 100), n);
  }
  // きょう出す字：先に 戻ってきた字（古い順）、あまりに 新しい字を NEW_PER_DAY まで
  function todayList(recs, order, today) {
    const due = order.filter(k => recs[k] && recs[k].lv > 0 && recs[k].next <= today).sort((a, b) => recs[a].next - recs[b].next).slice(0, PER_DAY);
    const fresh = order.filter(k => !recs[k] || !recs[k].lv).slice(0, Math.min(NEW_PER_DAY, PER_DAY - due.length));
    return due.concat(fresh);
  }
  /*
   * 1字の練習が終わったときの記録。
   * result: 'good'（おなじに書けた／思い出す場面なし）、'close'（すこし ちがった）、'forgot'（思い出せなかった）
   * good は段が上がる。close は同じ段を あした もう一度。forgot は 思い出しながらの段（lv1）へ戻る。
   */
  function advance(rec, result, today) {
    const lv = rec ? rec.lv | 0 : 0;
    const nlv = result === 'good' ? Math.min(MAX_LV, lv + 1) : result === 'close' ? Math.max(1, lv) : 1;
    const gap = result !== 'good' ? 1 : lv >= MAX_LV ? GAPS[MAX_LV] : GAPS[nlv - 1];
    return { lv: nlv, next: addDays(today, gap), seen: ((rec && rec.seen) | 0) + 1 };
  }

  const api = { KANJI, MAX_LV, GAPS, NEW_PER_DAY, PER_DAY, TRACE_TOL, TRACE_AUTO, stepsFor, prep, boxOf, partOf, distToStroke, pickStroke, judgeTrace, dayKey, addDays, todayList, advance };
  root.TowerCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
