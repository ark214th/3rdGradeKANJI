// 漢字の塔 — 3Dの場面（勇者・まもの・武器・パーティクル・画面ゆれ）。
// 絵は すべて図形から作る（外部の画像・モデルは使わない）。読み込めたら window.TowerScene に入る。
// 画面側（app.js）は TowerScene が なくても動く（3Dが使えない端末では 絵なしで練習できる）。
import * as T from './vendor/three.module.min.js';

const V3 = (x, y, z) => new T.Vector3(x, y, z);
const HERO_X = -1.7, ENEMY_X = 1.7;
let renderer, scene, camera, clock, host = null, mode = 'home', running = false;
let hero, heroArm, weaponGroup, enemy = null, platform, pillars = [], torchLights = [], stars, hemi, sun, ring;
let shake = 0, flash = 0, climbT = 0;
const tweens = [];

/* ---------- 小さな道具 ---------- */
const mat = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05, flatShading: true }, o || {}));
const mesh = (geo, material, x, y, z) => { const m = new T.Mesh(geo, material); m.position.set(x || 0, y || 0, z || 0); return m; };
const ease = t => 1 - Math.pow(1 - t, 3);
// だんだん変える：tween(秒, t => { … }, 終わったら)
function tween(dur, step, done) { tweens.push({ t: 0, dur, step, done }); }
function wait(sec, done) { tween(sec, () => {}, done); }
const hsl = (h, s, l) => new T.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l);

/* ---------- パーティクル（光のつぶ） ---------- */
const PN = 900;
let pGeo, pPos, pCol, pSize, pts;
const P = Array.from({ length: PN }, () => ({ life: 0, max: 1, v: V3(0, 0, 0), g: 0, c: new T.Color(), s: 1 }));
let pNext = 0;
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
function initParticles() {
  pGeo = new T.BufferGeometry();
  pPos = new Float32Array(PN * 3); pCol = new Float32Array(PN * 3); pSize = new Float32Array(PN);
  pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
  pGeo.setAttribute('size', new T.BufferAttribute(pSize, 1));
  const m = new T.ShaderMaterial({
    uniforms: { map: { value: dotTexture() }, scale: { value: 300 } },
    vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/(-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC*t.a,t.a); }',
    blending: T.AdditiveBlending, depthWrite: false, transparent: true,
  });
  pts = new T.Points(pGeo, m); pts.frustumCulled = false; scene.add(pts);
}
// at から n つぶ。speed: とぶ速さ、up: 上むきの勢い、g: 重さ、size、life
function burst(at, n, color, o) {
  o = o || {};
  for (let i = 0; i < n; i++) {
    const idx = pNext, p = P[idx]; pNext = (pNext + 1) % PN;
    const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), sp = (o.speed || 3) * (0.35 + Math.random() * 0.65);
    p.v.set(Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp + (o.up || 0), Math.sin(b) * Math.sin(a) * sp);
    p.life = p.max = (o.life || 0.7) * (0.6 + Math.random() * 0.6); p.g = o.g == null ? 4 : o.g; p.s = (o.size || 0.28) * (0.6 + Math.random() * 0.8);
    p.c.set(color); if (o.vary) p.c.offsetHSL((Math.random() - 0.5) * o.vary, 0, (Math.random() - 0.5) * 0.2);
    const j = idx * 3, sp2 = o.spread || 0.15;
    pPos[j] = at.x + (Math.random() - 0.5) * sp2; pPos[j + 1] = at.y + (Math.random() - 0.5) * sp2; pPos[j + 2] = at.z + (Math.random() - 0.5) * sp2;
  }
}
function stepParticles(dt) {
  for (let i = 0; i < PN; i++) {
    const p = P[i], j = i * 3;
    if (p.life <= 0) { pSize[i] = 0; continue; }
    p.life -= dt; p.v.y -= p.g * dt;
    pPos[j] += p.v.x * dt; pPos[j + 1] += p.v.y * dt; pPos[j + 2] += p.v.z * dt;
    const k = Math.max(0, p.life / p.max);
    pCol[j] = p.c.r * k; pCol[j + 1] = p.c.g * k; pCol[j + 2] = p.c.b * k; pSize[i] = p.s * (0.4 + 0.6 * k);
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = true;
}

/* ---------- 勇者 ---------- */
function eyes(parent, y, z, gap, r) {
  for (const s of [-1, 1]) {
    parent.add(mesh(new T.SphereGeometry(r, 10, 8), mat(0xffffff, { flatShading: false }), s * gap, y, z));
    parent.add(mesh(new T.SphereGeometry(r * 0.55, 8, 6), mat(0x16122e, { flatShading: false }), s * gap, y, z + r * 0.6));
  }
}
function buildHero() {
  const g = new T.Group();
  g.add(mesh(new T.CylinderGeometry(0.3, 0.42, 0.8, 8), mat(0x3b6fd6), 0, 0.75, 0));              // からだ
  g.add(mesh(new T.CylinderGeometry(0.44, 0.44, 0.1, 8), mat(0xffd166), 0, 0.55, 0));              // ベルト
  const head = mesh(new T.SphereGeometry(0.34, 12, 10), mat(0xffd9b0, { flatShading: false }), 0, 1.45, 0); g.add(head);
  g.add(mesh(new T.SphereGeometry(0.37, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0xd9dde6, { metalness: 0.5, roughness: 0.4 }), 0, 1.5, 0)); // かぶと
  g.add(mesh(new T.ConeGeometry(0.09, 0.35, 6), mat(0xff5a5a), 0, 1.95, 0));                         // かざり
  eyes(g, 1.45, 0.29, 0.13, 0.065);
  const cape = mesh(new T.BoxGeometry(0.62, 0.9, 0.06), mat(0xd94a4a), 0, 0.8, -0.32); cape.rotation.x = 0.18; g.add(cape);
  for (const s of [-1, 1]) g.add(mesh(new T.CylinderGeometry(0.12, 0.14, 0.4, 6), mat(0x2a3b6e), s * 0.17, 0.2, 0)); // あし
  g.add(mesh(new T.CylinderGeometry(0.09, 0.09, 0.5, 6), mat(0x3b6fd6), -0.42, 0.85, 0));          // 左うで
  heroArm = new T.Group(); heroArm.position.set(0.42, 1.05, 0);                                     // 右うで（武器を持つ）
  heroArm.add(mesh(new T.CylinderGeometry(0.09, 0.09, 0.5, 6), mat(0x3b6fd6), 0, -0.22, 0));
  weaponGroup = new T.Group(); weaponGroup.position.set(0, -0.45, 0.05); weaponGroup.rotation.x = Math.PI / 2; heroArm.add(weaponGroup);
  g.add(heroArm);
  g.rotation.y = Math.PI / 2; // 右（まもの）を向く
  return g;
}
function setWeapon(w) {
  if (!weaponGroup) return;
  while (weaponGroup.children.length) weaponGroup.remove(weaponGroup.children[0]);
  const blade = mat(w.color, { emissive: w.color, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.3 }), wood = mat(0x6b4a2f), gold = mat(0xffd166, { metalness: 0.6, roughness: 0.3 });
  const add = (geo, m, y, o) => { const x = mesh(geo, m, 0, y, 0); if (o) o(x); weaponGroup.add(x); return x; };
  if (w.kind === 'spear') { add(new T.CylinderGeometry(0.035, 0.035, 1.9, 6), wood, 0.7); add(new T.ConeGeometry(0.11, 0.45, 6), blade, 1.85); }
  else if (w.kind === 'hammer') { add(new T.CylinderGeometry(0.04, 0.04, 1.2, 6), wood, 0.45); add(new T.BoxGeometry(0.55, 0.34, 0.34), blade, 1.1); }
  else if (w.kind === 'scythe') { add(new T.CylinderGeometry(0.035, 0.035, 1.7, 6), wood, 0.6); add(new T.TorusGeometry(0.42, 0.05, 6, 12, Math.PI * 0.75), blade, 1.4, x => { x.position.x = 0.4; x.rotation.z = Math.PI * 0.55; }); }
  else {
    const kat = w.kind === 'katana';
    add(new T.CylinderGeometry(0.04, 0.04, 0.28, 6), wood, 0);
    add(new T.BoxGeometry(kat ? 0.16 : 0.34, 0.05, 0.1), gold, 0.16);
    add(new T.BoxGeometry(kat ? 0.07 : 0.11, kat ? 1.25 : 1.0, 0.03), blade, kat ? 0.82 : 0.7, kat ? x => { x.rotation.z = -0.06; } : null);
    add(new T.ConeGeometry(kat ? 0.036 : 0.055, 0.16, 4), blade, kat ? 1.5 : 1.27);
  }
  weaponGroup.userData.glow = w.glow; weaponGroup.userData.color = w.color;
}

/* ---------- まもの ---------- */
function buildEnemy(kind, hue, boss) {
  const g = new T.Group(), body = hsl(hue, 0.6, 0.52), dark = hsl(hue, 0.55, 0.32), lite = hsl(hue, 0.7, 0.72);
  const B = (geo, c, x, y, z) => { const m = mesh(geo, mat(c), x, y, z); g.add(m); return m; };
  g.userData = { kind, bob: 0.08, base: 0, parts: {} };
  if (boss) { // りゅう
    B(new T.SphereGeometry(0.75, 10, 8), hsl(hue, 0.65, 0.4), 0, 1.05, 0).scale.set(1, 0.9, 1.25);
    const head = B(new T.BoxGeometry(0.62, 0.5, 0.75), hsl(hue, 0.65, 0.46), 0, 1.95, 0.55);
    B(new T.BoxGeometry(0.5, 0.2, 0.5), hsl(hue, 0.6, 0.36), 0, 1.72, 0.95);
    for (const s of [-1, 1]) { const h = B(new T.ConeGeometry(0.09, 0.45, 5), 0xfff1c0, s * 0.22, 2.38, 0.35); h.rotation.x = -0.4; }
    eyes(g, 2.02, 0.92, 0.2, 0.09);
    for (const s of [-1, 1]) { const w = B(new T.ConeGeometry(0.75, 1.3, 3), hsl(hue + 20, 0.6, 0.3), s * 0.95, 1.6, -0.25); w.rotation.z = s * -1.1; w.scale.z = 0.12; g.userData.parts['wing' + s] = w; }
    const tail = B(new T.ConeGeometry(0.3, 1.3, 6), hsl(hue, 0.6, 0.36), 0, 0.6, -1.05); tail.rotation.x = -1.35;
    for (let i = 0; i < 4; i++) B(new T.ConeGeometry(0.11, 0.3, 4), 0xfff1c0, 0, 1.75 - i * 0.02, -0.15 - i * 0.28);
    g.userData.bob = 0.14; g.userData.base = 0.25; g.userData.head = head; g.scale.setScalar(1.15);
  } else if (kind === 'slime') {
    B(new T.SphereGeometry(0.62, 14, 10), body, 0, 0.5, 0).scale.set(1.1, 0.8, 1.1);
    B(new T.SphereGeometry(0.2, 8, 6), lite, 0.22, 0.86, 0.22);
    eyes(g, 0.6, 0.55, 0.2, 0.1); g.userData.squash = true;
  } else if (kind === 'ghost') {
    B(new T.SphereGeometry(0.52, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), lite, 0, 1.15, 0);
    B(new T.CylinderGeometry(0.52, 0.36, 0.7, 10, 1, true), lite, 0, 0.78, 0).material.side = T.DoubleSide;
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; B(new T.ConeGeometry(0.14, 0.3, 5), lite, Math.cos(a) * 0.3, 0.33, Math.sin(a) * 0.3).rotation.x = Math.PI; }
    eyes(g, 1.2, 0.46, 0.18, 0.1); g.userData.bob = 0.2; g.userData.base = 0.25;
  } else if (kind === 'bat') {
    B(new T.SphereGeometry(0.36, 10, 8), dark, 0, 1.3, 0);
    for (const s of [-1, 1]) { const w = B(new T.ConeGeometry(0.5, 0.9, 3), body, s * 0.62, 1.35, 0); w.rotation.z = s * -1.25; w.scale.z = 0.1; g.userData.parts['wing' + s] = w; B(new T.ConeGeometry(0.09, 0.26, 4), dark, s * 0.2, 1.68, 0); }
    eyes(g, 1.34, 0.32, 0.13, 0.08); g.userData.bob = 0.22; g.userData.base = 0.2; g.userData.flap = true;
  } else if (kind === 'golem') {
    B(new T.BoxGeometry(0.95, 0.9, 0.7), body, 0, 0.85, 0); B(new T.BoxGeometry(0.55, 0.45, 0.5), dark, 0, 1.55, 0);
    for (const s of [-1, 1]) { B(new T.BoxGeometry(0.3, 0.8, 0.34), dark, s * 0.68, 0.8, 0); B(new T.BoxGeometry(0.34, 0.4, 0.4), dark, s * 0.25, 0.2, 0); }
    eyes(g, 1.58, 0.26, 0.13, 0.07); g.userData.bob = 0.03;
  } else if (kind === 'eye') {
    B(new T.SphereGeometry(0.55, 14, 10), 0xf4f1ff, 0, 1.15, 0);
    B(new T.SphereGeometry(0.3, 12, 8), body, 0, 1.15, 0.36); B(new T.SphereGeometry(0.15, 8, 6), 0x16122e, 0, 1.15, 0.58);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const t = B(new T.ConeGeometry(0.07, 0.4, 4), dark, Math.cos(a) * 0.58, 1.15 + Math.sin(a) * 0.58, -0.05); t.rotation.z = a - Math.PI / 2; }
    g.userData.bob = 0.16; g.userData.base = 0.15;
  } else { // shroom
    B(new T.CylinderGeometry(0.26, 0.34, 0.75, 8), 0xf1e6cf, 0, 0.4, 0);
    B(new T.SphereGeometry(0.68, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), body, 0, 0.72, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; B(new T.SphereGeometry(0.11, 6, 5), 0xffffff, Math.cos(a) * 0.4, 1.12, Math.sin(a) * 0.4); }
    eyes(g, 0.5, 0.3, 0.12, 0.07); g.userData.squash = true;
  }
  g.rotation.y = -Math.PI / 2 + 0.35; // 勇者のほうを向く（少し こちら向き）
  g.userData.color = body;
  return g;
}

/* ---------- 部屋 ---------- */
function buildWorld() {
  platform = mesh(new T.CylinderGeometry(4.2, 4.6, 0.6, 24), mat(0x5d5a7a), 0, -0.3, 0); scene.add(platform);
  ring = mesh(new T.TorusGeometry(4.2, 0.09, 6, 40), mat(0xffd166, { emissive: 0xffd166, emissiveIntensity: 0.4 }), 0, 0.02, 0); ring.rotation.x = Math.PI / 2; scene.add(ring);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + i / 6 * 0.76), x = Math.cos(a) * 5.2, z = -Math.sin(a) * 5.2 + 1;
    const p = new T.Group(); p.position.set(x, 0, z);
    p.add(mesh(new T.CylinderGeometry(0.34, 0.4, 4.6, 8), mat(0x47446a), 0, 2.3, 0));
    p.add(mesh(new T.BoxGeometry(0.95, 0.3, 0.95), mat(0x3a3760), 0, 4.7, 0));
    scene.add(p); pillars.push(p);
    if (i % 2 === 1) { // たいまつ
      const f = mesh(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color: 0xffc98a }), x * 0.93, 2.3, z * 0.93 + 0.1); scene.add(f);
      const l = new T.PointLight(0xffc98a, 14, 12, 1.6); l.position.copy(f.position); scene.add(l); torchLights.push({ l, f });
    }
  }
  const sg = new T.BufferGeometry(), sp = new Float32Array(360 * 3);
  for (let i = 0; i < 360; i++) { const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 14; sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = Math.random() * 18 - 2; sp[i * 3 + 2] = -Math.abs(Math.sin(a) * r) - 4; }
  sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.8 })); scene.add(stars);
}
function setZone(z) {
  if (!scene) return;
  scene.background = new T.Color(z.sky); scene.fog = new T.Fog(z.fog, 9, 30);
  platform.material.color.set(z.floor);
  for (const p of pillars) { p.children[0].material.color.set(z.floor).multiplyScalar(0.72); p.children[1].material.color.set(z.floor).multiplyScalar(0.55); }
  for (const t of torchLights) { t.l.color.set(z.light); t.f.material.color.set(z.light); }
  hemi.color.set(z.light).lerp(new T.Color(0xffffff), 0.5); hemi.groundColor.set(z.fog);
}

/* ---------- はじめる ---------- */
function init() {
  if (renderer) return true;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }); } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  scene = new T.Scene(); clock = new T.Clock();
  camera = new T.PerspectiveCamera(42, 1, 0.1, 80);
  hemi = new T.HemisphereLight(0xffffff, 0x2b2760, 1.5); scene.add(hemi);
  sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 6, 5); scene.add(sun);
  buildWorld(); initParticles();
  hero = buildHero(); scene.add(hero);
  addEventListener('resize', () => { resize(); setTimeout(resize, 300); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && host) start(); });
  return true;
}
function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // よこに せまい画面では 少し 引く
  camera.fov = w / h < 1.3 ? 52 : 42; camera.updateProjectionMatrix();
}
function start() { if (running) return; running = true; clock.getDelta(); requestAnimationFrame(frame); }
// el の中に 3Dの絵を出す。m: 'home'（勇者ひとり）／'battle'（勇者と まもの）
function attach(el, m) {
  if (!init()) return false;
  host = el; mode = m || 'home'; el.appendChild(renderer.domElement);
  hero.position.set(mode === 'battle' ? HERO_X : 0, 0, 0); hero.rotation.y = mode === 'battle' ? Math.PI / 2 : 0.3;
  if (enemy) enemy.visible = mode === 'battle';
  resize(); start(); return true;
}

/* ---------- うごき ---------- */
const heroAt = () => V3(hero.position.x, 1.1, 0.3), enemyAt = () => (enemy ? V3(enemy.position.x, 1.0 + enemy.userData.base, 0.3) : V3(ENEMY_X, 1, 0.3));
function spawn(o) {
  if (!scene) return;
  if (enemy) scene.remove(enemy);
  const inner = buildEnemy(o.mon, o.hue || 0, !!o.boss);
  enemy = new T.Group(); enemy.add(inner); enemy.userData = inner.userData; enemy.userData.inner = inner; enemy.position.set(ENEMY_X + (o.boss ? 0.3 : 0), 6, 0); scene.add(enemy);
  const g = enemy;
  tween(0.45, t => { g.position.y = 6 * (1 - ease(t)); }, () => { burst(V3(g.position.x, 0.2, 0.2), 26, 0xcfc8ff, { speed: 2.4, up: 1, life: 0.5, size: 0.3 }); shake = Math.max(shake, o.boss ? 0.35 : 0.14); tween(0.18, t => { g.scale.y = 1 - 0.25 * Math.sin(t * Math.PI); }); });
}
// こうげき。o.big: 大きな一撃（ステップの さいご・ボス）、o.done: 当たった しゅんかんに よぶ
function attack(o) {
  o = o || {};
  if (!scene || !enemy) { if (o.done) o.done(); return; }
  const g = enemy, x0 = HERO_X, x1 = g.position.x - 1.35, glow = weaponGroup.userData.glow || 0xffffff, col = weaponGroup.userData.color || 0xffffff;
  tween(0.16, t => { hero.position.x = x0 + (x1 - x0) * ease(t); heroArm.rotation.x = -2.4 * ease(t); }, () => {
    tween(0.1, t => { heroArm.rotation.x = -2.4 + 3.6 * t; }, () => {
      const at = enemyAt();
      burst(at, o.big ? 70 : 34, glow, { speed: o.big ? 6 : 4.2, life: 0.6, size: o.big ? 0.42 : 0.32, vary: 0.08 });
      burst(at, o.big ? 30 : 12, col, { speed: 2.5, up: 2, life: 0.8, size: 0.24 });
      slash(at, col, o.big);
      shake = Math.max(shake, o.big ? 0.42 : 0.2); flash = 1;
      const kx = g.position.x;
      tween(0.22, t => { g.position.x = kx + 0.35 * Math.sin(t * Math.PI); g.rotation.z = -0.25 * Math.sin(t * Math.PI); });
      if (o.done) o.done();
      tween(0.25, t => { hero.position.x = x1 + (x0 - x1) * ease(t); heroArm.rotation.x = 1.2 * (1 - t); });
    });
  });
}
// きりつけた あとの 光のすじ
function slash(at, color, big) {
  const m = mesh(new T.RingGeometry(0.75, 1.0, 20, 1, 0, Math.PI * 0.9), new T.MeshBasicMaterial({ color, transparent: true, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false }), at.x - 0.2, at.y, at.z + 0.4);
  m.rotation.z = Math.PI * 0.65; const s = big ? 1.5 : 1; scene.add(m);
  tween(0.28, t => { m.scale.setScalar(s * (0.7 + t * 0.9)); m.material.opacity = 1 - t; m.rotation.z += 0.12; }, () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
}
// まちがえたとき：まものが はねて、勇者が 少し のけぞる（こわくない ていどに）
function miss() {
  if (!scene || !enemy) return;
  const g = enemy; shake = Math.max(shake, 0.1);
  tween(0.3, t => { g.position.y = 0.45 * Math.sin(t * Math.PI); });
  tween(0.3, t => { hero.rotation.z = 0.18 * Math.sin(t * Math.PI); });
  burst(heroAt(), 8, 0xff7b8a, { speed: 1.6, life: 0.4, size: 0.2 });
}
// たおした：くるくる回って 小さくなり、光と コインが はじける
function die(done) {
  if (!scene || !enemy) { if (done) done(); return; }
  const g = enemy, at = enemyAt(), c = g.userData.color; enemy = null;
  shake = Math.max(shake, 0.5); flash = 1;
  burst(at, 110, c, { speed: 6.5, life: 0.95, size: 0.42, vary: 0.12 });
  burst(at, 44, 0xffd166, { speed: 3.4, up: 5, g: 9, life: 1.2, size: 0.34 });
  tween(0.5, t => { g.rotation.y += 0.5; g.scale.setScalar(Math.max(0.001, 1 - ease(t))); g.position.y = t * 1.2; }, () => { scene.remove(g); if (done) done(); });
  cheer();
}
function cheer() { if (!hero) return; tween(0.5, t => { hero.position.y = 0.55 * Math.sin(t * Math.PI); heroArm.rotation.x = -2.6 * Math.sin(t * Math.PI); }); }
// レベルアップ・新しい武器：勇者が 光に つつまれる
function levelUp(color) {
  if (!scene) return;
  const at = V3(hero.position.x, 0.2, 0.2); flash = 1; shake = Math.max(shake, 0.25);
  for (let i = 0; i < 6; i++) wait(i * 0.07, () => burst(V3(at.x, 0.2 + i * 0.35, at.z), 26, color || 0xffd166, { speed: 1.6, up: 4, g: -1, life: 0.9, size: 0.36, spread: 0.9 }));
  cheer();
}
// 1かい のぼる：床が しずんで、新しい床が せり上がる
function climb() { if (!scene) return; climbT = 1; burst(V3(hero.position.x, 0.2, 0.2), 40, 0xffffff, { speed: 2, up: 5, g: -2, life: 0.9, size: 0.3, spread: 1.4 }); cheer(); }

function frame() {
  if (!host || !host.isConnected || !host.offsetParent || document.hidden) { running = false; return; }
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05), now = clock.elapsedTime;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.step(k);
    if (k >= 1) { tweens.splice(i, 1); if (w.done) w.done(); }
  }
  // いつもの ゆれ
  if (hero) { hero.children[0].scale.y = 1 + Math.sin(now * 3) * 0.03; if (mode === 'home') hero.rotation.y = 0.3 + Math.sin(now * 0.6) * 0.35; }
  if (enemy) {
    const u = enemy.userData, inner = u.inner;
    inner.position.y = u.base + (Math.sin(now * 2.4) * 0.5 + 0.5) * u.bob;
    if (u.squash) inner.scale.y = inner.scale.x * (1 + Math.sin(now * 3.2) * 0.07);
    for (const s of [-1, 1]) if (u.parts['wing' + s]) u.parts['wing' + s].rotation.z = s * (-1.2 + Math.sin(now * (u.flap ? 14 : 4)) * 0.35);
  }
  for (const t of torchLights) { t.l.intensity = 12 + Math.sin(now * 9 + t.l.position.x) * 2.5; if (Math.random() < 0.25) burst(t.f.position, 1, t.f.material.color, { speed: 0.4, up: 1.2, g: -0.6, life: 0.6, size: 0.2, spread: 0.1 }); }
  ring.material.emissiveIntensity = 0.35 + Math.sin(now * 2) * 0.15;
  stars.rotation.y = now * 0.01;
  // 1かい のぼる うごき
  let lift = 0; if (climbT > 0) { climbT = Math.max(0, climbT - dt / 0.9); lift = Math.sin((1 - climbT) * Math.PI) * -1.6; }
  platform.position.y = -0.3 + lift; for (const p of pillars) p.position.y = lift * 2.2;
  stepParticles(dt);
  // カメラ（ゆれ つき）
  shake *= Math.pow(0.0015, dt); flash = Math.max(0, flash - dt * 5);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  if (mode === 'battle') { // 勇者と まものの 両方が 入るように、画面の形に合わせて 引く
    const z = Math.max(6.4, Math.min(15, 3.3 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect)));
    camera.position.set(sx, 1.6 + z * 0.12 + sy, z); camera.lookAt(sx * 0.5, 1.1, 0); }
  else { // ホーム：下半分に カードが出るので、勇者が 画面の上のほうに 来るように見下ろす
    const tall = camera.aspect < 1; camera.position.set(Math.sin(now * 0.25) * 1.4 + sx, 2.6 + sy, tall ? 10.5 : 8.6); camera.lookAt(0, tall ? -0.9 : -1.15, 0); }
  sun.intensity = 1.6 + flash * 2.5;
  renderer.render(scene, camera);
}

window.TowerScene = { attach, setZone, setWeapon, spawn, attack, miss, die, cheer, levelUp, climb, resize, get ok() { return !!renderer; } };
window.dispatchEvent(new Event('towerscene'));
