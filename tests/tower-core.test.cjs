// Run: node tests/tower-core.test.cjs
// 漢字の塔（試作）の判定とデータの確認。画面の配置は見ない。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../chapter4/kanji-strokes.js');
const ST = require('../chapter4/stroke-trace.js');
const C = require('../tower/tower-core.js');

// データ：書き順データがあり、部品が全画をすき間なく分けている
for (const e of C.KANJI) {
  assert(S[e.k], `no strokes for ${e.k}`);
  let next = 1;
  for (const p of e.parts) { assert.equal(p.from, next, `${e.k} ${p.name}`); assert(p.to >= p.from); next = p.to + 1; }
  assert.equal(next - 1, S[e.k].length, `${e.k} parts cover all strokes`);
  assert(/\[[ぁ-ん]+\]/.test(e.q), `${e.k} question marks the reading`);
  assert.equal(C.partOf(e, 0), 0);
  assert.equal(C.partOf(e, S[e.k].length - 1), e.parts.length - 1);
}

for (const e of C.KANJI) {
  const M = C.prep(S[e.k]);
  const pts = i => ST.resample(M[i], 16);
  for (const ph of C.PHASES) {
    // 正しい順なら全部当たる。字全体が少しずれていても、ずれを伝えれば当たる
    for (let i = 0; i < M.length; i++) {
      assert(C.judgeFree(pts(i), M, i, { tol: ph.tol }).ok, `${e.k} stroke ${i + 1}`);
      assert(C.judgeFree(C.shift(pts(i), [10, -8]), M, i, { tol: ph.tol, offset: [10, -8] }).ok, `${e.k} shifted ${i + 1}`);
      // 逆向きは外れ（短い点は向きを見ない）
      if (ST.polyLength(M[i]) > 20) assert(!C.judgeFree(pts(i).reverse(), M, i, { tol: ph.tol }).ok, `${e.k} reverse ${i + 1}`);
    }
  }
  // 最後の画を最初に書くと「書き順ちがい」になる
  const last = M.length - 1;
  const r = C.judgeFree(pts(last), M, 0, { tol: C.PHASES[2].tol });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'order', `${e.k} order`);
  assert.equal(r.at, last);
}

// 二画をつなげて書くと 'long'
{
  const M = C.prep(S['住']);
  const joined = ST.resample(M[2], 12).concat(ST.resample(M[3], 12), ST.resample(M[4], 12));
  assert.equal(C.judgeFree(joined, M, 2, { tol: 23 }).ok, false);
}

// 位置ずれの見積もりは上限つき
assert.deepEqual(C.driftOf([]), [0, 0]);
assert.deepEqual(C.driftOf([{ u: [60, 50], m: [50, 50] }, { u: [56, 44], m: [50, 50] }]), [8, -3]);
assert.deepEqual(C.driftOf([{ u: [99, 0], m: [50, 50] }]), [C.MAX_SHIFT, -C.MAX_SHIFT]);

// 助けの出し方
assert.equal(C.helpLevel(0, 0), 'model');
assert.equal(C.helpLevel(1, 0), 'dot');
assert.equal(C.helpLevel(2, 0), 'none');
assert.equal(C.helpLevel(2, 1), 'dot');
assert.equal(C.helpLevel(2, 2), 'stroke');

// 画面側：スクリプトの構文と、参照している id
const html = fs.readFileSync(path.join(__dirname, '../tower/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new (require('node:vm').Script)(script);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'duplicate DOM IDs');
for (const m of script.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(m[1]), `missing DOM ID ${m[1]}`);
// トップページからはリンクしない
assert(!fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').includes('tower/'), 'tower must stay unlinked');
console.log('tower-core: ok');
