/*
 * 漢字の塔（試作）— 画面に依存しない部分。
 * 「一画＝一撃」の判定（お手本なしで書いた画を、書き順どおりかどうか見る）と、試作1フロア分のデータ。
 * 画の形の判定そのものは chapter4/stroke-trace.js（StrokeTrace）を使う。座標は KanjiVG と同じ 109×109。
 * ブラウザでは window.TowerCore、node では require() で使う。
 */
(function (root) {
  'use strict';
  const ST = root.StrokeTrace || (typeof require !== 'undefined' ? require('../chapter4/stroke-trace.js') : null);

  /*
   * 試作フロアの漢字（第4章 11・12回目の範囲から）。
   * parts: 部品ごとの画の範囲（from〜to は 1 始まりの画番号）。
   * q: 問題文。[ ] の中が書く字の読み。
   */
  const KANJI = [
    { k: '住', enemy: '👻', name: 'すみつきゴースト', q: 'ビルの にかいに [す]む。',
      parts: [{ name: 'にんべん', from: 1, to: 2 }, { name: '主', from: 3, to: 7 }] },
    { k: '級', enemy: '🕷️', name: 'いとまきグモ', q: 'がっ[きゅう]しんぶんを つくる。',
      parts: [{ name: 'いとへん', from: 1, to: 6 }, { name: '及', from: 7, to: 9 }] },
    { k: '短', enemy: '👺', name: 'ちび矢ゴブリン', q: '[みじか]い ことばで あらわす。',
      parts: [{ name: 'やへん', from: 1, to: 5 }, { name: '豆', from: 6, to: 12 }] },
    { k: '階', enemy: '🗿', name: 'かいだんゴーレム', q: 'ビルの に[かい]に すむ。',
      parts: [{ name: 'こざとへん', from: 1, to: 3 }, { name: '比', from: 4, to: 7 }, { name: '白', from: 8, to: 12 }] },
  ];
  const BOSS = { enemy: '🐉', name: '塔のぬし ドラゴン' };

  // 段階ごとの助け：0＝お手本つき、1＝書き始めの点だけ、2＝何もなし
  const PHASES = [
    { label: '見て書く', tol: 17 },
    { label: '点だけ', tol: 20 },
    { label: '自力', tol: 23 },
  ];
  const MAX_SHIFT = 14;   // お手本なしのとき、字全体の位置ずれをここまで追いかける
  const AUTO_AFTER = 5;   // 同じ画でこれだけ外れたら、代わりに書いて先へ進む

  const prep = strokes => strokes.map(d => ST.flatten(d));
  const shift = (pts, o) => (o && (o[0] || o[1])) ? pts.map(p => [p[0] + o[0], p[1] + o[1]]) : pts;

  function centroid(pts) {
    const r = ST.resample(pts, 12);
    let x = 0, y = 0;
    for (const p of r) { x += p[0]; y += p[1]; }
    return [x / r.length, y / r.length];
  }

  /*
   * お手本なしで書いた一画を判定する。
   * models: 字の全画の点列、pos: いま書くべき画（0始まり）、opts.offset: 字全体の位置ずれ。
   * 外れたとき、後ろの画にぴったり合うなら「書き順ちがい」（reason:'order'、at:その画）として返す。
   */
  function judgeFree(user, models, pos, opts) {
    const tol = (opts && opts.tol) || ST.TOL;
    const off = (opts && opts.offset) || [0, 0];
    const r = ST.judgeStroke(user, shift(models[pos], off), { tol });
    if (r.ok) return r;
    for (let j = pos + 1; j < models.length; j++) {
      if (ST.judgeStroke(user, shift(models[j], off), { tol: Math.min(tol, ST.TOL) }).ok) return { ok: false, reason: 'order', at: j };
    }
    // 二画をつなげて一気に書いたとき
    if (ST.polyLength(user || []) > ST.polyLength(models[pos]) * 1.6 + 8) return { ok: false, reason: 'long' };
    return r;
  }

  // これまでに当たった画から、字全体の位置ずれ（子どもの字 − お手本）を見積もる
  function driftOf(pairs) {
    if (!pairs.length) return [0, 0];
    let x = 0, y = 0;
    for (const p of pairs) { x += p.u[0] - p.m[0]; y += p.u[1] - p.m[1]; }
    const c = v => Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, v / pairs.length));
    return [c(x), c(y)];
  }

  // 画番号（0始まり）が入っている部品の番号
  function partOf(entry, pos) {
    return entry.parts.findIndex(p => pos + 1 >= p.from && pos + 1 <= p.to);
  }

  // 外れが増えるほど助けを出す：'none' → 'dot'（書き始めの点）→ 'stroke'（その一画を見せる）
  function helpLevel(phase, miss) {
    if (phase === 0) return 'model';
    if (miss >= 2) return 'stroke';
    if (phase === 1 || miss >= 1) return 'dot';
    return 'none';
  }

  const api = { KANJI, BOSS, PHASES, MAX_SHIFT, AUTO_AFTER, prep, shift, centroid, judgeFree, driftOf, partOf, helpLevel };
  root.TowerCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
