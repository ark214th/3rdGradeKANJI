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
      // again：きょう もう 練習して「思い出せなかった」字。きょうの めやすには 数えない（宝箱の メーターを 足止め しない）
      due: entries.filter(e => met(e) && recs[e.k].next <= today && recs[e.k].last !== today).sort(by(e => recs[e.k].lv, e => recs[e.k].next, e => recs[e.k].t || 0)),
      again: entries.filter(e => met(e) && recs[e.k].next <= today && recs[e.k].last === today).sort(by(e => recs[e.k].t || 0)),
      fresh: entries.filter(e => !met(e) && !e.known).sort(by(strokesOf)),
      check: entries.filter(e => !met(e) && e.known),
      extra: entries.filter(e => met(e) && recs[e.k].next > today).sort(by(e => (recs[e.k].last === today ? 1 : 0), e => recs[e.k].lv, e => recs[e.k].t || 0)),
    };
  }
  /*
   * つぎの かい（n体）。
   * 1) きょうの めやすに 入る字（ふっかつした字と、きょう出会う はじめての字）を 先に、まぜながら出す。
   *    こうすると「たからばこまで あと ◯かい」と、じっさいに たたかう かい数が ぴったり合う。
   * 2) めやすを こえたら、きょう 思い出せなかった字 → 先の はじめての字（やる気が あるときは どんどん進める）→ おまけの練習（extra）。
   * いつでも n体 そろう。startDay は めやすの 計算に使う（はじめた日）。
   */
  function nextFloor(recs, entries, today, n, startDay) {
    const q = queues(recs, entries, today), g = guide(recs, entries, today, startDay), out = [], size = Math.min(n || FLOOR_SIZE, entries.length);
    // はじめての字は、この学年の字と 下の学年の字を こうごに
    const fresh = q.fresh.slice(), check = q.check.slice(), news = [];
    while (fresh.length || check.length) { if (fresh.length) news.push({ k: fresh.shift().k, kind: 'new' }); if (check.length) news.push({ k: check.shift().k, kind: 'check' }); }
    const quota = news.slice(0, g.intro), later = news.slice(g.intro), due = q.due.map(e => ({ k: e.k, kind: 'due' }));
    for (let i = 0; out.length < size && (due.length || quota.length); i++) { const src = i % 2 ? quota : due; const x = (src.length ? src : src === due ? quota : due).shift(); if (x) out.push(x); }
    for (const e of q.again) { if (out.length >= size) break; out.push({ k: e.k, kind: 'due' }); }
    for (const x of later) { if (out.length >= size) break; out.push(x); }
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

  /*
   * 武器。強さ（atk）は ダメージの数字と えんしゅつが かわるだけで、問題の やさしさは かわらない。
   * lv: ぶきやに 並ぶレベル、fx: 必殺技の えんしゅつ、skill: 必殺技の名前、aura: 持っているだけで 出る光
   */
  const WEAPONS = [
    { id: 'w0', name: '木のつるぎ', price: 0, lv: 1, atk: 2, kind: 'sword', color: 0xc08a50, glow: 0xffe0a0, fx: 'slash', skill: 'えいっ！ぎり' },
    { id: 'w1', name: 'てつのつるぎ', price: 400, lv: 3, atk: 5, kind: 'broad', color: 0xd5dee8, glow: 0xffffff, fx: 'slash2', skill: 'れんぞくぎり' },
    { id: 'w2', name: 'ほのおのつるぎ', price: 1000, lv: 5, atk: 9, kind: 'flame', color: 0xff5a1f, glow: 0xffb347, fx: 'fire', skill: 'ほのおの柱', aura: 'ember' },
    { id: 'w3', name: 'こおりのやり', price: 2000, lv: 8, atk: 14, kind: 'spear', color: 0x7fdcff, glow: 0xd8f6ff, fx: 'ice', skill: 'こおりの雨', aura: 'snow' },
    { id: 'w4', name: 'かみなりハンマー', price: 3500, lv: 11, atk: 20, kind: 'hammer', color: 0xffd93a, glow: 0xfff7a8, fx: 'thunder', skill: 'いかずち落とし', aura: 'spark' },
    { id: 'w5', name: 'かぜのかたな', price: 5500, lv: 14, atk: 27, kind: 'katana', color: 0x5dffa0, glow: 0xd4ffe6, fx: 'wind', skill: 'たつまきぎり', aura: 'leaf' },
    { id: 'w6', name: 'ひかりのつるぎ', price: 8000, lv: 17, atk: 35, kind: 'holy', color: 0xfff3b0, glow: 0xffffff, fx: 'light', skill: 'せいなる光', aura: 'spark' },
    { id: 'w7', name: 'やみのかま', price: 11000, lv: 20, atk: 44, kind: 'scythe', color: 0xa45cff, glow: 0xe2c8ff, fx: 'dark', skill: 'やみのうず', aura: 'shadow' },
    { id: 'w8', name: 'りゅうのつるぎ', price: 14500, lv: 23, atk: 54, kind: 'dragon', color: 0xff2d55, glow: 0xffa8c0, fx: 'dragon', skill: 'りゅうの いぶき', aura: 'ember' },
    { id: 'w9', name: 'ほしのつるぎ', price: 18500, lv: 26, atk: 65, kind: 'star', color: 0x5a9bff, glow: 0xdde9ff, fx: 'star', skill: 'りゅうせいぐん', aura: 'star' },
    { id: 'w10', name: 'でんせつの漢字剣', price: 23000, lv: 30, atk: 80, kind: 'legend', color: 0xffcc33, glow: 0xfff1c0, fx: 'kanji', skill: '漢字 だいばくはつ', aura: 'star' },
  ];
  const weaponOf = id => WEAPONS.find(w => w.id === id) || WEAPONS[0];
  const attackOf = (xp, weaponId) => levelOf(xp) * 2 + weaponOf(weaponId).atk;
  // ぶきやに 並んでいるか（レベルが 足りないものは「？？？」で 見せる）
  const weaponOpen = (w, xp) => levelOf(xp) >= w.lv;
  // 勇者の見た目（レベルで かぶとと マントが かわる）
  const HERO_LOOKS = [
    { lv: 1, helm: 0xd9dde6, cape: 0xd94a4a, body: 0x3b6fd6 },
    { lv: 5, helm: 0xbfe3ff, cape: 0x2f9e5b, body: 0x2f5fc7 },
    { lv: 10, helm: 0xffd166, cape: 0x8e44ad, body: 0x2b4fb3 },
    { lv: 20, helm: 0xffffff, cape: 0xffb000, body: 0x1d3c99, crown: true },
  ];
  const heroLook = xp => { const L = levelOf(xp); let r = HERO_LOOKS[0]; for (const h of HERO_LOOKS) if (L >= h.lv) r = h; return r; };

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
    examHit: { gold: 6, xp: 8 },       // ドラゴンの問題を 一回で ○
    examRetry: { gold: 2, xp: 3 },     // 出し直しで ○
  };
  const BOSS_PASS = 0.8;

  /*
   * 宝箱。中身は 運ではなく がんばりで決まる（くじ引きに しない）。
   * grade: 0=木 1=銀 2=金。kind: 'daily'（きょうの めやす）／'mid'（中ボス）／'dragon'（てっぺんの ドラゴン）
   */
  const CHESTS = {
    daily: [{ gold: 30, xp: 20 }, { gold: 50, xp: 30 }, { gold: 80, xp: 45 }],
    mid: [{ gold: 40, xp: 30 }, { gold: 60, xp: 45 }, { gold: 90, xp: 60 }],
    dragon: [{ gold: 50, xp: 40 }, { gold: 80, xp: 60 }, { gold: 120, xp: 90 }],
  };
  const CHEST_NAMES = ['木の たからばこ', '銀の たからばこ', '金の たからばこ'];
  // きょうの宝箱：まちがえずに たおした割合。中ボス：まちがいの数。ドラゴン：一回で ○ の割合
  const dailyGrade = (clean, total) => (total && clean / total >= 0.8 ? 2 : total && clean / total >= 0.5 ? 1 : 0);
  const midGrade = miss => (miss === 0 ? 2 : miss <= 2 ? 1 : 0);
  const dragonGrade = (ok, n) => (n && ok === n ? 2 : n && ok / n >= BOSS_PASS ? 1 : 0);

  /*
   * 塔のエリア。テスト範囲 1つが エリア 1つ（範囲の一覧の 順番で 景色が かわる。ぜんぶ使ったら くり返す）。
   * エリアの高さは 字の数から決める（54字で 30かい）。10かいごとに 中ボス、てっぺんに ドラゴン（テストと同じ問題）。
   */
  const AREAS = [
    { name: 'はじまりの森', sky: [0x6ec3ff, 0xd8f3ff], ground: 0x7ccf5a, stone: 0xd9cfb4, accent: 0x4caf50, light: 0xfff2c8, fog: 0xbfe8ff, mon: ['slime', 'shroom', 'bat', 'ghost'], mid: 'shroom', hue: 110 },
    { name: 'こおりの山', sky: [0x8fd3ff, 0xf0fbff], ground: 0xe8f6ff, stone: 0xa8d4ee, accent: 0x5ab8f0, light: 0xffffff, fog: 0xe0f4ff, mon: ['slime', 'golem', 'ghost', 'eye'], mid: 'golem', hue: 200 },
    { name: 'ほのおの火山', sky: [0xff9a5a, 0xffe0b0], ground: 0x8a5a44, stone: 0x6b4434, accent: 0xff6a2a, light: 0xffd2a0, fog: 0xffc898, mon: ['slime', 'bat', 'golem', 'eye'], mid: 'slime', hue: 15 },
    { name: 'くもの城', sky: [0xa8c8ff, 0xfff0fa], ground: 0xffffff, stone: 0xf2e6ff, accent: 0xffa8d8, light: 0xffffff, fog: 0xf4eaff, mon: ['ghost', 'bat', 'eye', 'slime'], mid: 'ghost', hue: 300 },
    { name: 'うみの神殿', sky: [0x4fd2e8, 0xd8fbff], ground: 0xf2e2b0, stone: 0x9fe0e0, accent: 0x18a8c8, light: 0xe8ffff, fog: 0xbff4ff, mon: ['slime', 'eye', 'shroom', 'golem'], mid: 'eye', hue: 180 },
    { name: 'ほしの宮殿', sky: [0x2a2a7a, 0x9a7ae0], ground: 0x6a5ac8, stone: 0xc8b8ff, accent: 0xffd166, light: 0xe8e0ff, fog: 0x8878d0, mon: ['ghost', 'eye', 'golem', 'bat'], mid: 'golem', hue: 260 },
  ];
  const areaOf = index => AREAS[((index % AREAS.length) + AREAS.length) % AREAS.length];
  const areaFloors = kanjiCount => Math.max(20, Math.min(40, Math.round((kanjiCount * 0.55) / 5) * 5));
  const MID_EVERY = 10;
  // つぎに のぼる かい（cleared: のぼり終えた かい数、L: てっぺん）の 種類
  function floorKind(cleared, L) {
    const n = cleared + 1;
    if (cleared >= L) return 'top';         // てっぺんまで のぼった あとは しゅぎょう
    if (n === L) return 'dragon';
    if (n % MID_EVERY === 0) return 'mid';
    return 'battle';
  }
  /*
   * 宝箱まで あと何回 たたかうか。floors：めやすの のこり（ふつうの たたかいの 回数）。
   * とちゅうに 中ボスの かいが あれば、その 1回も 足す。ドラゴンの 前と てっぺんでは かいが 進まないので、のこりは そのまま。
   */
  function fightsToChest(cleared, L, floors) {
    let f = cleared, need = floors, k = 0;
    while (need > 0 && k < 500) {
      const kind = floorKind(f, L);
      if (kind === 'mid') { k++; f++; continue; }
      if (kind === 'dragon' || kind === 'top') return k + need;
      k++; need--; f++;
    }
    return k;
  }
  // 中ボス戦の 問題：出会った字から、弱い字・ごぶさたの字を 先に n字（同じ字は 1回）
  function reviewPick(recs, entries, n) {
    const met = entries.filter(e => recs[e.k]);
    return met.sort((a, b) => (recs[a.k].lv - recs[b.k].lv) || ((recs[b.k].miss | 0) - (recs[a.k].miss | 0)) || ((recs[a.k].t || 0) - (recs[b.k].t || 0))).slice(0, n || 6).map(e => e.k);
  }

  const api = { MAX_LV, GAPS, KNOWN_LV, INTRO_DAYS, FLOOR_SIZE, EXAM_SIZE, TRACE_TOL, TRACE_AUTO, stepsFor, startLv, lvOf, prep, boxOf, partOf, distToStroke, pickStroke, judgeTrace,
    dayKey, addDays, daysBetween, queues, nextFloor, guide, advance, examList,
    xpFor, levelOf, levelProgress, WEAPONS, weaponOf, attackOf, weaponOpen, HERO_LOOKS, heroLook, rewardFor, BONUS, BOSS_PASS,
    CHESTS, CHEST_NAMES, dailyGrade, midGrade, dragonGrade, AREAS, areaOf, areaFloors, MID_EVERY, floorKind, fightsToChest, reviewPick };
  root.TowerCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
