// 漢字の塔 — 3Dの場面。絵は すべて図形から作る（外部の画像・モデルは使わない）。
// 場面は 3つ：home（塔の地図）／battle（たたかい）／shop（ぶきや）。読み込めたら window.TowerScene に入る。
// 画面側（app.js）は TowerScene が なくても動く（3Dが使えない端末では 絵なしで練習できる）。
import * as T from './vendor/three.module.min.js';

const V3 = (x, y, z) => new T.Vector3(x, y, z);
const HERO_X = -1.7, ENEMY_X = 1.7;
let renderer, scene, camera, clock, host = null, mode = 'home', running = false;
let world, homeG, battleG, shopG, sky, clouds = [], hemi, sun;
let hero, heroArm, shieldArm, weaponGroup, heroParts = {}, enemy = null, dummy = null, chestG = null, showcase = null;
let area = null, towerKey = '', towerL = 30, towerCleared = 0, plats = [], heroPlat = 0, auraT = 0, curWeapon = null;
let shake = 0, flash = 0, dim = 0, slow = 1, climbing = false;
const cam = { pos: V3(0, 3, 9), look: V3(0, 1, 0), over: null, sweep: null };
const tweens = [];

/* ---------- 小さな道具 ---------- */
let GRAD, OUTLINE;
const toon = (color, o) => new T.MeshToonMaterial(Object.assign({ color, gradientMap: GRAD }, o || {}));
const basic = (color, o) => new T.MeshBasicMaterial(Object.assign({ color }, o || {}));
const glowMat = (color, opacity) => new T.MeshBasicMaterial({ color, transparent: true, opacity: opacity == null ? 0.9 : opacity, depthWrite: false, side: T.DoubleSide });
const mesh = (geo, material, x, y, z) => { const m = new T.Mesh(geo, material); m.position.set(x || 0, y || 0, z || 0); return m; };
// まんがの ような りんかく線（うら返した 少し大きい形を 黒で ぬる）
function ol(m, s) { const o = new T.Mesh(m.geometry, OUTLINE); o.scale.setScalar(s || 1.08); m.add(o); return m; }
const ease = t => 1 - Math.pow(1 - t, 3);
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tween(dur, step, done) { tweens.push({ t: 0, dur, step, done }); }
function wait(sec, done) { tween(sec, () => {}, done); }
const hsl = (h, s, l) => new T.Color().setHSL((((h % 360) + 360) % 360) / 360, s, l);
function disposeTree(o) { o.traverse(x => { if (x.geometry && x.geometry !== (x.parent && x.parent.geometry)) x.geometry.dispose(); }); }

/* ---------- パーティクル（光のつぶ） ---------- */
const PN = 1400;
let pGeo, pPos, pCol, pSize, pAlpha, pts;
const P = Array.from({ length: PN }, () => ({ life: 0, max: 1, v: V3(0, 0, 0), g: 0, c: new T.Color(), s: 1, drag: 0 }));
let pNext = 0;
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
function initParticles() {
  pGeo = new T.BufferGeometry();
  pPos = new Float32Array(PN * 3); pCol = new Float32Array(PN * 3); pSize = new Float32Array(PN); pAlpha = new Float32Array(PN);
  pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
  pGeo.setAttribute('size', new T.BufferAttribute(pSize, 1));
  pGeo.setAttribute('alpha', new T.BufferAttribute(pAlpha, 1));
  const m = new T.ShaderMaterial({
    uniforms: { map: { value: dotTexture() }, scale: { value: 300 } },
    vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/(-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(map,gl_PointCoord); float core=smoothstep(0.55,1.0,t.a); gl_FragColor=vec4(mix(vC,vec3(1.0),core*0.6),t.a*vA); }',
    blending: T.NormalBlending, depthWrite: false, transparent: true,
  });
  pts = new T.Points(pGeo, m); pts.frustumCulled = false; pts.renderOrder = 10; scene.add(pts);
}
// at から n つぶ。speed: とぶ速さ、up: 上むきの勢い、g: 重さ、size、life、dir: とぶ向き（ベクトル）
function burst(at, n, color, o) {
  o = o || {};
  for (let i = 0; i < n; i++) {
    const idx = pNext, p = P[idx]; pNext = (pNext + 1) % PN;
    const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), sp = (o.speed || 3) * (0.35 + Math.random() * 0.65);
    p.v.set(Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp + (o.up || 0), Math.sin(b) * Math.sin(a) * sp);
    if (o.dir) p.v.addScaledVector(o.dir, 1);
    p.life = p.max = (o.life || 0.7) * (0.6 + Math.random() * 0.6); p.g = o.g == null ? 4 : o.g; p.s = (o.size || 0.28) * (0.6 + Math.random() * 0.8); p.drag = o.drag || 0;
    p.c.set(color); if (o.vary) p.c.offsetHSL((Math.random() - 0.5) * o.vary, 0, (Math.random() - 0.5) * 0.2);
    const j = idx * 3, sp2 = o.spread || 0.15;
    pPos[j] = at.x + (Math.random() - 0.5) * sp2; pPos[j + 1] = at.y + (Math.random() - 0.5) * sp2; pPos[j + 2] = at.z + (Math.random() - 0.5) * sp2;
  }
}
function stepParticles(dt) {
  for (let i = 0; i < PN; i++) {
    const p = P[i], j = i * 3;
    if (p.life <= 0) { pSize[i] = 0; pAlpha[i] = 0; continue; }
    p.life -= dt; p.v.y -= p.g * dt; if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
    pPos[j] += p.v.x * dt; pPos[j + 1] += p.v.y * dt; pPos[j + 2] += p.v.z * dt;
    const k = Math.max(0, p.life / p.max);
    pCol[j] = p.c.r; pCol[j + 1] = p.c.g; pCol[j + 2] = p.c.b; pAlpha[i] = Math.min(1, k * 1.4); pSize[i] = p.s * (0.4 + 0.6 * k);
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = pGeo.attributes.alpha.needsUpdate = true;
}

/* ---------- 空と雲 ---------- */
function buildSky() {
  const m = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(0x6ec3ff) }, bottom: { value: new T.Color(0xd8f3ff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h=clamp(vP.y*1.6+0.25,0.0,1.0); gl_FragColor=vec4(mix(bottom,top,h),1.0); }',
  });
  sky = mesh(new T.SphereGeometry(70, 24, 12), m); sky.renderOrder = -1; world.add(sky);
  const cm = toon(0xffffff);
  for (let i = 0; i < 9; i++) {
    const c = new T.Group();
    for (let k = 0; k < 5; k++) c.add(mesh(new T.SphereGeometry(0.9 + Math.random() * 0.7, 10, 8), cm, k * 1.0 - 2, Math.sin(k) * 0.3, Math.random() * 0.5));
    const a = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
    c.position.set(Math.cos(a) * (22 + Math.random() * 10), 5 + Math.random() * 12, Math.sin(a) * (22 + Math.random() * 10));
    c.scale.setScalar(0.8 + Math.random() * 0.9); c.userData.v = 0.2 + Math.random() * 0.3;
    world.add(c); clouds.push(c);
  }
}

/* ---------- 勇者 ---------- */
function eyes(parent, y, z, gap, r, look) {
  for (const s of [-1, 1]) {
    const w = mesh(new T.SphereGeometry(r, 12, 10), basic(0xffffff), s * gap, y, z); parent.add(w);
    w.add(mesh(new T.SphereGeometry(r * 0.6, 10, 8), basic(0x16122e), 0, 0, r * 0.55));
    w.add(mesh(new T.SphereGeometry(r * 0.2, 6, 5), basic(0xffffff), r * 0.2, r * 0.25, r * 0.95));
  }
}
function buildHero() {
  const g = new T.Group();
  heroParts.body = ol(mesh(new T.CylinderGeometry(0.3, 0.42, 0.8, 10), toon(0x3b6fd6), 0, 0.75, 0)); g.add(heroParts.body);
  g.add(ol(mesh(new T.CylinderGeometry(0.44, 0.44, 0.12, 10), toon(0xffd166), 0, 0.55, 0)));
  g.add(ol(mesh(new T.SphereGeometry(0.36, 14, 12), toon(0xffd9b0), 0, 1.45, 0)));
  heroParts.helm = ol(mesh(new T.SphereGeometry(0.39, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), toon(0xd9dde6), 0, 1.5, 0)); g.add(heroParts.helm);
  heroParts.plume = ol(mesh(new T.ConeGeometry(0.1, 0.38, 6), toon(0xff5a5a), 0, 1.97, -0.05)); g.add(heroParts.plume);
  heroParts.crown = new T.Group(); heroParts.crown.position.set(0, 1.86, 0); heroParts.crown.visible = false;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; heroParts.crown.add(mesh(new T.ConeGeometry(0.07, 0.2, 4), toon(0xffd166, { emissive: 0x664400 }), Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22)); }
  g.add(heroParts.crown);
  eyes(g, 1.45, 0.3, 0.13, 0.075);
  g.add(mesh(new T.SphereGeometry(0.05, 6, 5), toon(0xff9a9a), 0.2, 1.36, 0.3)); g.add(mesh(new T.SphereGeometry(0.05, 6, 5), toon(0xff9a9a), -0.2, 1.36, 0.3));
  heroParts.cape = ol(mesh(new T.BoxGeometry(0.64, 0.95, 0.06), toon(0xd94a4a), 0, 0.82, -0.33)); heroParts.cape.rotation.x = 0.18; g.add(heroParts.cape);
  for (const s of [-1, 1]) g.add(ol(mesh(new T.CylinderGeometry(0.12, 0.14, 0.4, 8), toon(0x2a3b6e), s * 0.17, 0.2, 0)));
  shieldArm = new T.Group(); shieldArm.position.set(-0.42, 1.05, 0);
  shieldArm.add(mesh(new T.CylinderGeometry(0.09, 0.09, 0.5, 8), toon(0x3b6fd6), 0, -0.22, 0));
  const sh = ol(mesh(new T.CylinderGeometry(0.34, 0.34, 0.07, 16), toon(0xc0c8d8), -0.12, -0.35, 0.12)); sh.rotation.z = Math.PI / 2; shieldArm.add(sh);
  sh.add(mesh(new T.CylinderGeometry(0.16, 0.16, 0.08, 5), toon(0xffd166), 0, 0.01, 0));
  g.add(shieldArm);
  heroArm = new T.Group(); heroArm.position.set(0.42, 1.05, 0);
  heroArm.add(mesh(new T.CylinderGeometry(0.09, 0.09, 0.5, 8), toon(0x3b6fd6), 0, -0.22, 0));
  weaponGroup = new T.Group(); weaponGroup.position.set(0, -0.45, 0.05); weaponGroup.rotation.x = Math.PI / 2; heroArm.add(weaponGroup);
  g.add(heroArm);
  g.add(shadowBlob(0.6));
  return g;
}
function shadowBlob(r) { const m = mesh(new T.CircleGeometry(r, 20), basic(0x000000, { transparent: true, opacity: 0.22, depthWrite: false }), 0, 0.02, 0); m.rotation.x = -Math.PI / 2; return m; }
function setLook(look) {
  if (!hero || !look) return;
  heroParts.helm.material.color.set(look.helm); heroParts.cape.material.color.set(look.cape); heroParts.body.material.color.set(look.body);
  heroParts.crown.visible = !!look.crown; heroParts.plume.visible = !look.crown;
}
function buildWeapon(w) {
  const g = new T.Group();
  const blade = toon(w.color, { emissive: w.color, emissiveIntensity: 0.35 }), wood = toon(0x6b4a2f), gold = toon(0xffd166, { emissive: 0x553300 }), dark = toon(0x2b2240);
  const add = (geo, m, y, o) => { const x = ol(mesh(geo, m, 0, y, 0), 1.12); if (o) o(x); g.add(x); return x; };
  const tip = new T.Object3D(); g.add(tip);
  const k = w.kind;
  if (k === 'spear') { add(new T.CylinderGeometry(0.035, 0.035, 1.9, 6), wood, 0.7); add(new T.OctahedronGeometry(0.2), blade, 1.85, x => { x.scale.set(0.6, 1.6, 0.6); }); add(new T.TorusGeometry(0.1, 0.03, 6, 10), gold, 1.55, x => { x.rotation.x = Math.PI / 2; }); tip.position.y = 2.1; }
  else if (k === 'hammer') { add(new T.CylinderGeometry(0.045, 0.045, 1.2, 6), wood, 0.45); add(new T.BoxGeometry(0.6, 0.38, 0.38), blade, 1.1); add(new T.BoxGeometry(0.66, 0.08, 0.42), gold, 1.1); for (const s of [-1, 1]) add(new T.ConeGeometry(0.08, 0.25, 4), gold, 1.1, x => { x.position.x = s * 0.42; x.rotation.z = -s * Math.PI / 2; }); tip.position.y = 1.2; }
  else if (k === 'scythe') { add(new T.CylinderGeometry(0.035, 0.035, 1.8, 6), dark, 0.6); add(new T.TorusGeometry(0.46, 0.06, 6, 14, Math.PI * 0.8), blade, 1.45, x => { x.position.x = 0.42; x.rotation.z = Math.PI * 0.55; }); add(new T.SphereGeometry(0.09, 8, 6), toon(0xff4dd2, { emissive: 0xaa2288 }), 1.45); tip.position.set(0.7, 1.6, 0); }
  else {
    const kat = k === 'katana' || k === 'star', len = { sword: 1.0, broad: 1.05, flame: 1.1, katana: 1.25, holy: 1.2, dragon: 1.25, star: 1.3, legend: 1.4 }[k] || 1, wid = { broad: 0.17, flame: 0.14, holy: 0.15, dragon: 0.15, legend: 0.17 }[k] || (kat ? 0.08 : 0.11);
    add(new T.CylinderGeometry(0.045, 0.045, 0.3, 6), k === 'legend' || k === 'holy' ? gold : wood, 0);
    add(new T.BoxGeometry(kat ? 0.18 : 0.38, 0.06, 0.12), gold, 0.17);
    add(new T.BoxGeometry(wid, len, 0.035), blade, 0.2 + len / 2, kat ? x => { x.rotation.z = -0.05; } : null);
    add(new T.ConeGeometry(wid * 0.55, 0.2, 4), blade, 0.2 + len + 0.09);
    if (k === 'flame') for (let i = 0; i < 3; i++) add(new T.ConeGeometry(0.06, 0.22, 5), toon(0xffb347, { emissive: 0xff6a00 }), 0.45 + i * 0.3, x => { x.position.x = (i % 2 ? 1 : -1) * 0.1; x.rotation.z = (i % 2 ? -1 : 1) * 0.5; });
    if (k === 'holy') for (const s of [-1, 1]) add(new T.ConeGeometry(0.12, 0.38, 3), toon(0xffffff, { emissive: 0x888866 }), 0.2, x => { x.position.x = s * 0.3; x.rotation.z = -s * 1.3; x.scale.z = 0.3; });
    if (k === 'dragon') { add(new T.BoxGeometry(0.22, 0.2, 0.2), toon(0xb3123a), 0.17, x => { x.position.z = 0.08; }); for (const s of [-1, 1]) add(new T.ConeGeometry(0.05, 0.2, 4), gold, 0.3, x => { x.position.x = s * 0.08; x.rotation.z = -s * 0.4; }); }
    if (k === 'star') add(new T.OctahedronGeometry(0.12), toon(0xfff6b0, { emissive: 0xaa8800 }), 0.17);
    if (k === 'legend') { add(new T.OctahedronGeometry(0.11), toon(0x3ad1ff, { emissive: 0x0077aa }), 0.17); add(new T.TorusGeometry(0.16, 0.025, 6, 16), gold, 0.75, x => { x.rotation.x = Math.PI / 2; }); }
    tip.position.y = 0.2 + len + 0.15;
  }
  g.userData = { glow: w.glow, color: w.color, aura: w.aura, tip };
  return g;
}
function setWeapon(w) {
  if (!weaponGroup || !w) return;
  curWeapon = w;
  while (weaponGroup.children.length) { const c = weaponGroup.children[0]; weaponGroup.remove(c); disposeTree(c); }
  weaponGroup.add(buildWeapon(w));
  if (showcase) { while (showcase.children.length) { const c = showcase.children[0]; showcase.remove(c); disposeTree(c); } const big = buildWeapon(w); const b = new T.Box3().setFromObject(big), h = b.max.y - b.min.y || 1; const k = 1.6 / h; big.scale.set(k * 1.7, k, k * 1.7); big.position.y = -0.75; big.rotation.z = 0.25; showcase.add(big); }
}
const weaponData = () => (weaponGroup && weaponGroup.children[0] ? weaponGroup.children[0].userData : { glow: 0xffffff, color: 0xffffff });
const AURA = { ember: [0xff8a2a, 1.5, -1.2], snow: [0xe8f8ff, 0.5, 0.6], spark: [0xfff27a, 2.4, 0], leaf: [0x7dffb0, 1.2, -0.4], shadow: [0xb06bff, 0.6, -0.8], star: [0xfff6c8, 1.4, -0.3] };
function emitAura(dt) {
  const d = weaponData(); if (!d.aura || !d.tip) return;
  auraT += dt; if (auraT < 0.06) return; auraT = 0;
  const a = AURA[d.aura], at = new T.Vector3(); d.tip.getWorldPosition(at);
  burst(at, 1, a[0], { speed: a[1], g: a[2], life: 0.6, size: 0.18, spread: 0.25 });
}

/* ---------- まもの ---------- */
function buildEnemy(kind, hue, size) {
  const g = new T.Group(), body = hsl(hue, 0.7, 0.58), dark = hsl(hue, 0.6, 0.36), lite = hsl(hue, 0.85, 0.78);
  const B = (geo, c, x, y, z, o) => { const m = mesh(geo, toon(c), x, y, z); if (o !== false) ol(m); g.add(m); return m; };
  const mouth = (y, z, w) => { const m = mesh(new T.TorusGeometry(w || 0.1, 0.025, 6, 12, Math.PI), basic(0x3a1020), 0, y, z); m.rotation.z = Math.PI; g.add(m); };
  g.userData = { kind, bob: 0.08, base: 0, parts: {}, style: 'lunge' };
  if (kind === 'dragon') {
    B(new T.SphereGeometry(0.75, 14, 10), hsl(hue, 0.7, 0.48), 0, 1.05, 0).scale.set(1, 0.9, 1.25);
    B(new T.SphereGeometry(0.5, 12, 8), hsl(hue, 0.6, 0.78), 0, 0.95, 0.45).scale.set(0.9, 1, 0.6);
    const head = B(new T.BoxGeometry(0.68, 0.55, 0.78), hsl(hue, 0.7, 0.52), 0, 1.98, 0.55);
    B(new T.BoxGeometry(0.52, 0.22, 0.5), hsl(hue, 0.6, 0.4), 0, 1.74, 0.98);
    for (const s of [-1, 1]) { const h = B(new T.ConeGeometry(0.1, 0.5, 6), 0xfff1c0, s * 0.24, 2.42, 0.32); h.rotation.x = -0.45; }
    eyes(g, 2.06, 0.95, 0.2, 0.1);
    for (const s of [-1, 1]) { const w = B(new T.ConeGeometry(0.8, 1.4, 3), hsl(hue + 25, 0.65, 0.4), s * 1.0, 1.65, -0.25); w.rotation.z = s * -1.1; w.scale.z = 0.12; g.userData.parts['wing' + s] = w; }
    const tail = B(new T.ConeGeometry(0.3, 1.4, 8), hsl(hue, 0.6, 0.42), 0, 0.6, -1.08); tail.rotation.x = -1.35;
    for (let i = 0; i < 4; i++) B(new T.ConeGeometry(0.11, 0.32, 4), 0xfff1c0, 0, 1.78 - i * 0.02, -0.12 - i * 0.28);
    for (const s of [-1, 1]) B(new T.CylinderGeometry(0.16, 0.2, 0.5, 8), hsl(hue, 0.6, 0.42), s * 0.45, 0.25, 0.1);
    g.userData.bob = 0.14; g.userData.base = 0.25; g.userData.head = head; g.userData.style = 'breath';
  } else if (kind === 'slime') {
    B(new T.SphereGeometry(0.62, 18, 14), body, 0, 0.5, 0).scale.set(1.1, 0.8, 1.1);
    B(new T.SphereGeometry(0.17, 8, 6), lite, 0.25, 0.85, 0.25, false);
    eyes(g, 0.62, 0.52, 0.2, 0.11); mouth(0.42, 0.6, 0.1); g.userData.squash = true; g.userData.style = 'jump';
  } else if (kind === 'ghost') {
    B(new T.SphereGeometry(0.54, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), lite, 0, 1.15, 0);
    B(new T.CylinderGeometry(0.54, 0.38, 0.72, 14, 1, true), lite, 0, 0.78, 0).material.side = T.DoubleSide;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; B(new T.ConeGeometry(0.14, 0.3, 6), lite, Math.cos(a) * 0.3, 0.33, Math.sin(a) * 0.3, false).rotation.x = Math.PI; }
    for (const s of [-1, 1]) B(new T.SphereGeometry(0.12, 8, 6), lite, s * 0.58, 0.95, 0.1);
    eyes(g, 1.2, 0.46, 0.18, 0.11); mouth(1.0, 0.5, 0.08); g.userData.bob = 0.2; g.userData.base = 0.25; g.userData.style = 'shoot';
  } else if (kind === 'bat') {
    B(new T.SphereGeometry(0.38, 12, 10), dark, 0, 1.3, 0);
    for (const s of [-1, 1]) { const w = B(new T.ConeGeometry(0.55, 0.95, 3), body, s * 0.66, 1.35, 0); w.rotation.z = s * -1.25; w.scale.z = 0.1; g.userData.parts['wing' + s] = w; B(new T.ConeGeometry(0.1, 0.28, 4), dark, s * 0.2, 1.7, 0); }
    eyes(g, 1.34, 0.33, 0.13, 0.09); mouth(1.18, 0.36, 0.07); g.userData.bob = 0.22; g.userData.base = 0.2; g.userData.flap = true;
  } else if (kind === 'golem') {
    B(new T.BoxGeometry(0.95, 0.9, 0.7), body, 0, 0.85, 0); B(new T.BoxGeometry(0.58, 0.48, 0.52), dark, 0, 1.57, 0);
    for (const s of [-1, 1]) { B(new T.BoxGeometry(0.3, 0.8, 0.34), dark, s * 0.68, 0.8, 0); B(new T.BoxGeometry(0.34, 0.4, 0.4), dark, s * 0.25, 0.2, 0); }
    B(new T.OctahedronGeometry(0.14), lite, 0, 0.95, 0.38, false);
    eyes(g, 1.6, 0.27, 0.14, 0.08); g.userData.bob = 0.03; g.userData.style = 'stomp';
  } else if (kind === 'eye') {
    B(new T.SphereGeometry(0.56, 18, 14), 0xf4f1ff, 0, 1.15, 0);
    g.add(mesh(new T.SphereGeometry(0.31, 14, 10), toon(body), 0, 1.15, 0.36)); g.add(mesh(new T.SphereGeometry(0.15, 10, 8), basic(0x16122e), 0, 1.15, 0.6));
    g.add(mesh(new T.SphereGeometry(0.05, 6, 5), basic(0xffffff), 0.06, 1.22, 0.72));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const t = B(new T.ConeGeometry(0.08, 0.42, 5), dark, Math.cos(a) * 0.6, 1.15 + Math.sin(a) * 0.6, -0.05); t.rotation.z = a - Math.PI / 2; }
    g.userData.bob = 0.16; g.userData.base = 0.15; g.userData.style = 'shoot';
  } else { // shroom
    B(new T.CylinderGeometry(0.27, 0.34, 0.75, 10), 0xf6ecd6, 0, 0.4, 0);
    B(new T.SphereGeometry(0.7, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), body, 0, 0.72, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(mesh(new T.SphereGeometry(0.11, 8, 6), toon(0xffffff), Math.cos(a) * 0.42, 1.08, Math.sin(a) * 0.42)); }
    eyes(g, 0.52, 0.3, 0.12, 0.08); mouth(0.36, 0.33, 0.06); g.userData.squash = true; g.userData.style = 'jump';
  }
  if (size && size > 1 && kind !== 'dragon') { // 中ボス：大きくて 王かんを かぶる
    const top = { slime: 1.0, shroom: 1.15, ghost: 1.75, bat: 1.75, golem: 1.9, eye: 1.8 }[kind] || 1.5;
    const cr = new T.Group(); cr.position.y = top;
    cr.add(ol(mesh(new T.CylinderGeometry(0.28, 0.3, 0.14, 10, 1, true), toon(0xffd166, { emissive: 0x553300, side: T.DoubleSide }), 0, 0, 0)));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cr.add(mesh(new T.ConeGeometry(0.06, 0.18, 4), toon(0xffd166, { emissive: 0x553300 }), Math.cos(a) * 0.27, 0.14, Math.sin(a) * 0.27)); }
    cr.add(mesh(new T.OctahedronGeometry(0.07), toon(0xff3d6e, { emissive: 0x880022 }), 0, 0.05, 0.3));
    g.add(cr);
  }
  g.rotation.y = -Math.PI / 2 + 0.38; // 勇者のほうを向く（少し こちら向き）
  g.userData.color = body;
  return g;
}

/* ---------- 景色（エリアごとの かざり） ---------- */
function props(group, a, count, radius, spreadY, full) {
  const idx = Math.max(0, ['はじまりの森', 'こおりの山', 'ほのおの火山', 'くもの城', 'うみの神殿', 'ほしの宮殿'].indexOf(a.name));
  const R = (k) => { let x = Math.sin(k * 999.13) * 43758.5; return x - Math.floor(x); };
  for (let i = 0; i < count; i++) {
    const ang = full ? (i / count) * Math.PI * 2 + R(i) * 0.3 : Math.PI * (0.05 + (i / (count - 1)) * 0.9) + (R(i) - 0.5) * 0.15, r = radius + R(i + 7) * 3, x = Math.cos(ang) * r, z = -Math.sin(ang) * r + (full ? 0 : 1.2), s = (0.7 + R(i + 3) * 0.7) * (full ? 1.6 : 1);
    const p = new T.Group(); p.position.set(x, spreadY ? R(i + 11) * spreadY : 0, z); p.scale.setScalar(s);
    if (idx === 0) { p.add(ol(mesh(new T.CylinderGeometry(0.16, 0.22, 1.1, 7), toon(0x8a5a3a), 0, 0.55, 0))); p.add(ol(mesh(new T.ConeGeometry(0.9, 1.5, 8), toon(0x3fae4a), 0, 1.6, 0))); p.add(ol(mesh(new T.ConeGeometry(0.7, 1.2, 8), toon(0x5cc85a), 0, 2.3, 0))); }
    else if (idx === 1) { p.add(ol(mesh(new T.ConeGeometry(0.5, 2.2, 6), toon(0xbfe9ff, { emissive: 0x204060 }), 0, 1.1, 0))); p.add(ol(mesh(new T.ConeGeometry(0.3, 1.3, 6), toon(0xe8f8ff), 0.5, 0.65, 0.2))); }
    else if (idx === 2) { p.add(ol(mesh(new T.DodecahedronGeometry(0.7), toon(0x5a3a30), 0, 0.5, 0))); const lava = mesh(new T.CircleGeometry(0.6, 14), basic(0xff7a1a), 0.9, 0.03, 0.3); lava.rotation.x = -Math.PI / 2; p.add(lava); }
    else if (idx === 3) { for (let k = 0; k < 3; k++) p.add(mesh(new T.SphereGeometry(0.6, 10, 8), toon(0xffffff), k * 0.6 - 0.6, 0.5 + (k % 2) * 0.3, 0)); p.add(ol(mesh(new T.CylinderGeometry(0.2, 0.2, 2, 8), toon(0xffd8f0), 0, 1, -0.5))); }
    else if (idx === 4) { p.add(ol(mesh(new T.CylinderGeometry(0.28, 0.32, 2.4, 10), toon(0xf4f0e0), 0, 1.2, 0))); p.add(ol(mesh(new T.BoxGeometry(0.8, 0.2, 0.8), toon(0x9fe0e0), 0, 2.45, 0))); }
    else { p.add(ol(mesh(new T.OctahedronGeometry(0.6), toon(0xc8a8ff, { emissive: 0x402080 }), 0, 1.2, 0))); p.children[0].scale.y = 1.8; }
    group.add(p);
  }
  if (idx === 0 && !full) for (let i = 0; i < 26; i++) { const ang = Math.random() * Math.PI, r = 2 + Math.random() * 3.5; group.add(mesh(new T.SphereGeometry(0.08, 6, 5), toon([0xff6b8a, 0xffe066, 0xffffff, 0x9b7bff][i % 4]), Math.cos(ang) * r, 0.06, -Math.sin(ang) * r * 0.6 + 0.5)); }
}

/* ---------- たたかいの 場所 ---------- */
let arenaGround, arenaRim, propsG;
function buildArena() {
  battleG = new T.Group();
  arenaGround = mesh(new T.CylinderGeometry(4.4, 4.7, 0.5, 32), toon(0x7ccf5a), 0, -0.25, 0); battleG.add(arenaGround);
  arenaRim = mesh(new T.TorusGeometry(4.4, 0.14, 8, 48), toon(0xd9cfb4), 0, 0.02, 0); arenaRim.rotation.x = Math.PI / 2; battleG.add(arenaRim);
  const far = mesh(new T.CircleGeometry(60, 32), toon(0x7ccf5a), 0, -0.6, 0); far.rotation.x = -Math.PI / 2; battleG.add(far); battleG.userData.far = far;
  propsG = new T.Group(); battleG.add(propsG);
  scene.add(battleG);
}
function buildShop() {
  shopG = new T.Group();
  const floor = mesh(new T.CylinderGeometry(3.6, 3.8, 0.4, 32), toon(0xb07a4a), 0, -0.2, 0); shopG.add(floor);
  const rug = mesh(new T.CircleGeometry(1.4, 24), toon(0xc0392b), -1.0, 0.01, 0); rug.rotation.x = -Math.PI / 2; shopG.add(rug);
  for (let i = 0; i < 5; i++) { // たなと 武器の かざり
    const a = Math.PI * (0.18 + i * 0.16), x = Math.cos(a) * 3.6, z = -Math.sin(a) * 3.6 + 0.6;
    const r = new T.Group(); r.position.set(x, 0, z); r.lookAt(0, 0, 1);
    r.add(ol(mesh(new T.BoxGeometry(1.2, 2.2, 0.3), toon(0x8a5a3a), 0, 1.1, 0)));
    for (let k = 0; k < 3; k++) r.add(mesh(new T.BoxGeometry(0.08, 1.2, 0.05), toon([0xc9d3dd, 0xff6a2a, 0x8fe3ff, 0xffe14a, 0x7dffb0][(i + k) % 5]), -0.35 + k * 0.35, 1.2, 0.2));
    shopG.add(r);
  }
  const ped = new T.Group(); ped.position.set(0.25, 0, 1.0);
  ped.add(ol(mesh(new T.CylinderGeometry(0.42, 0.5, 0.5, 12), toon(0xe8dcc0), 0, 0.25, 0)));
  const halo = mesh(new T.TorusGeometry(0.55, 0.05, 8, 32), toon(0xffd166, { emissive: 0x664400 }), 0, 0.52, 0); halo.rotation.x = Math.PI / 2; ped.add(halo);
  showcase = new T.Group(); showcase.position.set(0, 1.25, 0); ped.add(showcase); shopG.add(ped);
  dummy = new T.Group(); dummy.position.set(1.6, 0, 0);
  dummy.add(ol(mesh(new T.CylinderGeometry(0.06, 0.06, 1.8, 6), toon(0x8a5a3a), 0, 0.9, 0)));
  dummy.add(ol(mesh(new T.CylinderGeometry(0.32, 0.38, 0.9, 10), toon(0xe8c879), 0, 1.15, 0)));
  dummy.add(ol(mesh(new T.SphereGeometry(0.26, 12, 10), toon(0xe8c879), 0, 1.85, 0)));
  const tgt = mesh(new T.CircleGeometry(0.22, 16), toon(0xff4d4d), 0, 1.2, 0.39); dummy.add(tgt); tgt.add(mesh(new T.CircleGeometry(0.1, 16), toon(0xffffff), 0, 0, 0.01));
  dummy.add(shadowBlob(0.5)); dummy.rotation.y = -0.5; dummy.userData = { base: 0, color: new T.Color(0xe8c879) };
  shopG.add(dummy);
  scene.add(shopG);
}

/* ---------- 塔の地図 ---------- */
const platPos = i => { const a = i * 0.55 + 0.4, r = 2.85; return V3(Math.cos(a) * r, 0.35 + i * 0.42, Math.sin(a) * r); };
function buildTower(a, L, cleared) {
  if (homeG) { scene.remove(homeG); disposeTree(homeG); }
  homeG = new T.Group(); plats = []; towerL = L;
  const H = 0.35 + L * 0.42 + 0.6;
  const ground = mesh(new T.CircleGeometry(60, 40), toon(a.ground), 0, 0, 0); ground.rotation.x = -Math.PI / 2; homeG.add(ground);
  const core = ol(mesh(new T.CylinderGeometry(1.9, 2.2, H, 16), toon(a.stone), 0, H / 2, 0), 1.02); homeG.add(core);
  for (let y = 2; y < H; y += 2.1) { const ring = mesh(new T.TorusGeometry(1.95 + (1 - y / H) * 0.25, 0.08, 6, 24), toon(a.accent), 0, y, 0); ring.rotation.x = Math.PI / 2; homeG.add(ring); }
  for (let i = 0; i < Math.floor(H / 1.4); i++) { const ang = i * 1.7, y = 0.9 + i * 1.4; const w = mesh(new T.BoxGeometry(0.3, 0.45, 0.1), basic(0x3a2f55), Math.cos(ang) * 2.02, y, Math.sin(ang) * 2.02); w.lookAt(0, y, 0); homeG.add(w); }
  homeG.add(ol(mesh(new T.ConeGeometry(2.5, 1.6, 16), toon(a.accent), 0, H + 0.8, 0), 1.03));
  for (let i = 0; i <= L; i++) {
    const p = platPos(i), kind = i === L ? 'top' : i > 0 && i % 10 === 0 ? 'mid' : 'step';
    const g = new T.Group(); g.position.copy(p); g.lookAt(0, p.y, 0);
    const top = kind === 'top', w = kind === 'step' ? 0.95 : 1.4;
    const slab = ol(mesh(new T.BoxGeometry(w, 0.2, top ? 1.4 : 0.8), toon(0xffffff), 0, 0, 0), 1.04); g.add(slab);
    if (kind !== 'step') {
      const pole = mesh(new T.CylinderGeometry(0.03, 0.03, 1.1, 6), toon(0x6b4a2f), 0.45, 0.6, 0.2); g.add(pole);
      const flag = mesh(new T.BoxGeometry(0.42, 0.26, 0.02), toon(top ? 0xff3d6e : a.accent), 0.66, 1.0, 0.2); g.add(flag); g.userData.flag = flag;
      const boss = buildEnemy(top ? 'dragon' : a.mid, top ? a.hue + 180 : a.hue, top ? 1 : 1.4); boss.scale.setScalar(top ? 0.42 : 0.38); boss.position.set(0, 0.1, top ? 0.1 : 0); boss.rotation.y = Math.PI; g.add(boss); g.userData.boss = boss;
    }
    if (i % 5 === 0 && kind === 'step' && i > 0) { const num = numberSprite(i); num.position.set(0, 0.55, -0.5); g.add(num); }
    g.userData.slab = slab; g.userData.kind = kind; homeG.add(g); plats.push(g);
  }
  // てっぺんの 黒い雲
  const storm = new T.Group(); storm.position.set(0, H + 2.6, 0);
  for (let i = 0; i < 6; i++) storm.add(mesh(new T.SphereGeometry(0.9, 10, 8), toon(0x4a4060), Math.cos(i) * 1.4, Math.sin(i * 2) * 0.3, Math.sin(i) * 1.4));
  homeG.add(storm); homeG.userData.storm = storm;
  props(homeG, a, 16, 19, 0, true);
  for (let i = 0; i < 40; i++) { const ang = Math.random() * Math.PI * 2, r = 4 + Math.random() * 9; homeG.add(mesh(new T.SphereGeometry(0.12, 6, 5), toon([0xff6b8a, 0xffe066, 0xffffff, 0x9b7bff][i % 4]), Math.cos(ang) * r, 0.08, Math.sin(ang) * r)); }
  scene.add(homeG);
  setCleared(cleared);
}
function numberSprite(n) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#1b1530'; g.strokeText(n + 'F', 64, 34); g.fillStyle = '#fff'; g.fillText(n + 'F', 64, 34);
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false })); s.scale.set(0.8, 0.4, 1); return s;
}
function setCleared(n) {
  towerCleared = n;
  plats.forEach((g, i) => {
    const done = i <= n, next = i === n + 1;
    g.userData.slab.material.color.set(done ? 0xffd166 : next ? 0xffffff : 0xb8b0c8);
    g.userData.slab.material.emissive = new T.Color(next ? 0x332200 : 0x000000);
    if (g.userData.boss) { const b = g.userData.boss, beaten = i <= n; b.rotation.z = beaten ? 1.4 : 0; b.position.y = beaten ? -0.05 : 0.1; b.traverse(x => { if (x.material && x.material.color && x.material !== OUTLINE) x.material.transparent = beaten, x.material.opacity = beaten ? 0.45 : 1; }); }
  });
  heroPlat = Math.min(n, plats.length - 1);
  if (homeG && homeG.userData.storm) homeG.userData.storm.visible = n < towerL; // てっぺんの ドラゴンを たおしたら 雲が はれる
  if (mode === 'home' && hero && !climbing) { hero.position.copy(platPos(heroPlat)).add(V3(0, 0.1, 0)); faceAlong(heroPlat); cam.jump = true; }
}
function faceAlong(i) { const a = platPos(i), b = platPos(Math.min(i + 1, towerL)); hero.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); }

/* ---------- 場面の 切りかえ ---------- */
function applyArea(a) {
  area = a;
  sky.material.uniforms.top.value.set(a.sky[0]); sky.material.uniforms.bottom.value.set(a.sky[1]);
  scene.fog = new T.Fog(a.fog, 24, 70);
  arenaGround.material.color.set(a.ground); battleG.userData.far.material.color.set(a.ground).multiplyScalar(0.92); arenaRim.material.color.set(a.stone);
  while (propsG.children.length) { const c = propsG.children[0]; propsG.remove(c); disposeTree(c); }
  props(propsG, a, 9, 6.5, 0);
  hemi.color.set(a.light); hemi.groundColor.set(a.ground);
}
function placeHero() {
  if (!hero) return;
  hero.rotation.set(0, 0, 0); hero.scale.setScalar(1);
  if (mode === 'battle') { hero.position.set(HERO_X, 0, 0); hero.rotation.y = Math.PI / 2; }
  else if (mode === 'shop') { hero.position.set(-1.0, 0, 0); hero.rotation.y = Math.PI / 2 - 0.5; }
  else { hero.position.copy(platPos(heroPlat)).add(V3(0, 0.1, 0)); faceAlong(heroPlat); }
}
function showMode() {
  if (homeG) homeG.visible = mode === 'home';
  battleG.visible = mode === 'battle'; shopG.visible = mode === 'shop';
  if (enemy) enemy.visible = mode === 'battle';
  if (chestG && mode !== 'battle') { battleG.remove(chestG); chestG = null; }
  placeHero(); cam.over = null; cam.jump = true; // 場面を かえたら カメラは すぐ うつる
}

/* ---------- はじめる ---------- */
function init() {
  if (renderer) return true;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' }); } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  GRAD = new T.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, T.RedFormat); GRAD.minFilter = GRAD.magFilter = T.NearestFilter; GRAD.needsUpdate = true;
  OUTLINE = new T.MeshBasicMaterial({ color: 0x1b1530, side: T.BackSide });
  scene = new T.Scene(); clock = new T.Clock();
  camera = new T.PerspectiveCamera(42, 1, 0.1, 160);
  hemi = new T.HemisphereLight(0xffffff, 0x7ccf5a, 1.6); scene.add(hemi);
  sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 8, 6); scene.add(sun);
  scene.add(new T.AmbientLight(0xffffff, 0.35));
  world = new T.Group(); scene.add(world); buildSky();
  buildArena(); buildShop(); initParticles();
  hero = buildHero(); scene.add(hero);
  addEventListener('resize', () => { resize(); setTimeout(resize, 300); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && host) start(); });
  return true;
}
function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 1.3 ? 50 : 42; camera.updateProjectionMatrix();
}
function start() { if (running) return; running = true; clock.getDelta(); requestAnimationFrame(frame); }
// el の中に 3Dの絵を出す。m: 'home'／'battle'／'shop'
function attach(el, m) {
  if (!init()) return false;
  host = el; mode = m || 'home'; el.appendChild(renderer.domElement);
  showMode(); resize(); start(); return true;
}
// エリア（a: tower-core の AREAS の 1つ）と 塔の高さ・のぼった かい数
function setArea(a, L, cleared) {
  if (!init()) return;
  const key = a.name + L;
  if (key !== towerKey) { towerKey = key; applyArea(a); buildTower(a, L, cleared); }
  else setCleared(cleared);
  showMode();
}
// 塔の 上から 勇者まで カメラを おろす（目標を 見せる）
function sweep() { if (mode !== 'home' || !plats.length) return; cam.sweep = { t: 0, dur: 2.4 }; }

/* ---------- うごき ---------- */
const heroAt = () => V3(hero.position.x, 1.1, hero.position.z + 0.3);
const target = () => (mode === 'shop' ? dummy : enemy);
const targetAt = () => { const g = target(); return g ? V3(g.position.x, 1.0 + (g.userData.base || 0) * (g.scale.x || 1), 0.3) : V3(ENEMY_X, 1, 0.3); };
function spawn(o) {
  if (!scene) return;
  if (enemy) { scene.remove(enemy); disposeTree(enemy); }
  const kind = o.boss === 'dragon' ? 'dragon' : o.mon, size = o.boss === 'mid' ? 1.6 : o.boss === 'dragon' ? 1.25 : 1;
  const inner = buildEnemy(kind, o.hue || 0, size);
  enemy = new T.Group(); enemy.add(inner); enemy.add(shadowBlob(0.7)); enemy.userData = inner.userData; enemy.userData.inner = inner; enemy.userData.size = size;
  enemy.scale.setScalar(size); enemy.position.set(ENEMY_X + (size > 1 ? 0.35 : 0), o.boss ? 0 : 6, 0); scene.add(enemy);
  if (o.boss) { enemy.visible = false; return; } // ボスは とうじょう えんしゅつで 出す
  const g = enemy;
  tween(0.45, t => { g.position.y = 6 * (1 - ease(t)); }, () => { burst(V3(g.position.x, 0.2, 0.2), 26, 0xffffff, { speed: 2.4, up: 1, life: 0.5, size: 0.3 }); shake = Math.max(shake, 0.14); tween(0.18, t => { g.scale.y = size * (1 - 0.25 * Math.sin(t * Math.PI)); }); });
}
// ボスの とうじょう：暗くなって、地ひびきと ともに おりてくる
function bossIntro(done) {
  if (!scene || !enemy) { if (done) done(); return; }
  const g = enemy, s = g.userData.size; g.visible = true; g.position.y = 9; dim = 1;
  cam.over = { pos: V3(g.position.x - 1.5, 1.4, 4.2), look: V3(g.position.x, 2.0, 0) };
  for (let i = 0; i < 5; i++) wait(i * 0.25, () => { shake = Math.max(shake, 0.25); });
  tween(1.3, t => { g.position.y = 9 * (1 - easeIO(t)); }, () => {
    shake = 0.8; flash = 1; burst(V3(g.position.x, 0.2, 0.2), 90, 0xffffff, { speed: 5, up: 1.5, life: 0.8, size: 0.45 });
    tween(0.25, t => { g.scale.set(s * (1 + 0.15 * Math.sin(t * Math.PI)), s * (1 - 0.2 * Math.sin(t * Math.PI)), s); });
    roar();
    wait(0.9, () => { cam.over = null; dim = 0; if (done) done(); });
  });
}
function roar() { if (!enemy) return; const g = enemy, at = targetAt(); tween(0.6, t => { g.userData.inner.rotation.x = -0.25 * Math.sin(t * Math.PI); }); for (let i = 0; i < 4; i++) wait(i * 0.12, () => burst(at, 18, 0xfff6c8, { speed: 4, life: 0.5, size: 0.3, g: 0 })); shake = Math.max(shake, 0.5); }
// HPが へった ボスが おこる：赤く光って、オーラが 出る
function bossRage() {
  if (!enemy) return; enemy.userData.rage = true; roar();
  enemy.traverse(x => { if (x.material && x.material.isMeshToonMaterial) { x.material.emissive = new T.Color(0xff1a1a); x.material.emissiveIntensity = 0.28; } });
  const g = enemy, s = g.scale.x; tween(0.4, t => g.scale.setScalar(s * (1 + 0.12 * t)));
}
// こうげき。o.big: 大きな一撃、o.done: 当たった しゅんかん
function attack(o) {
  o = o || {};
  const g = target();
  if (!scene || !g) { if (o.done) o.done(); return; }
  const x0 = hero.position.x, x1 = g.position.x - 1.35 * (g.scale.x > 1.2 ? 1.25 : 1), d = weaponData();
  tween(0.16, t => { hero.position.x = x0 + (x1 - x0) * ease(t); heroArm.rotation.x = -2.4 * ease(t); }, () => {
    tween(0.1, t => { heroArm.rotation.x = -2.4 + 3.6 * t; }, () => {
      const at = targetAt();
      burst(at, o.big ? 70 : 34, d.glow, { speed: o.big ? 6 : 4.2, life: 0.6, size: o.big ? 0.42 : 0.32, vary: 0.08 });
      burst(at, o.big ? 30 : 12, d.color, { speed: 2.5, up: 2, life: 0.8, size: 0.24 });
      arc(at, d.color, o.big ? 1.5 : 1, Math.PI * 0.65);
      if (o.crit) { arc(at, 0xffffff, 1.8, Math.PI * 0.3); burst(at, 40, 0xffffff, { speed: 7, life: 0.4, size: 0.3, g: 0 }); }
      shake = Math.max(shake, o.big ? 0.42 : 0.2); flash = Math.max(flash, o.crit ? 1 : 0.6);
      knock(g, o.big ? 0.45 : 0.3);
      if (o.done) o.done();
      tween(0.25, t => { hero.position.x = x1 + (x0 - x1) * ease(t); heroArm.rotation.x = 1.2 * (1 - t); });
    });
  });
}
function knock(g, d) { const kx = g.position.x; tween(0.22, t => { g.position.x = kx + d * Math.sin(t * Math.PI); g.rotation.z = -0.25 * Math.sin(t * Math.PI); }, () => { g.position.x = kx; g.rotation.z = 0; }); }
// 光の すじ
function arc(at, color, s, rot) {
  const m = mesh(new T.RingGeometry(0.75, 1.0, 24, 1, 0, Math.PI * 0.9), glowMat(color), at.x - 0.2, at.y, at.z + 0.4);
  m.rotation.z = rot; scene.add(m);
  tween(0.3, t => { m.scale.setScalar(s * (0.7 + t * 0.9)); m.material.opacity = 1 - t; m.rotation.z += 0.12; }, () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
}
// まものの はんげき：勇者は たてで うける（こわくない ていど）
function enemyAttack(done) {
  const g = enemy;
  if (!scene || !g) { if (done) done(); return; }
  const style = g.userData.style, x0 = g.position.x, hit = () => { block(); if (done) done(); };
  if (style === 'shoot' || style === 'breath') {
    tween(0.25, t => { g.userData.inner.rotation.x = -0.2 * Math.sin(t * Math.PI); });
    const from = targetAt(), to = heroAt(), col = style === 'breath' ? 0xff7a2a : g.userData.color;
    if (style === 'breath') { for (let i = 0; i < 10; i++) wait(i * 0.04, () => burst(from, 10, i % 2 ? 0xffd166 : 0xff5a1a, { speed: 1, dir: to.clone().sub(from).multiplyScalar(1.6), g: 0, life: 0.55, size: 0.45, spread: 0.3 })); wait(0.5, hit); }
    else {
      const orb = mesh(new T.SphereGeometry(0.2, 10, 8), glowMat(col)); orb.position.copy(from); scene.add(orb);
      tween(0.4, t => { orb.position.lerpVectors(from, to, t); orb.position.y += Math.sin(t * Math.PI) * 0.6; burst(orb.position, 1, col, { speed: 0.4, life: 0.3, size: 0.25, g: 0 }); }, () => { scene.remove(orb); orb.geometry.dispose(); hit(); });
    }
  } else {
    const x1 = HERO_X + 1.25, up = style === 'jump' ? 1.4 : style === 'stomp' ? 0.6 : 0.3;
    tween(0.3, t => { g.position.x = x0 + (x1 - x0) * easeIO(t); g.position.y = up * Math.sin(t * Math.PI); }, () => {
      if (style === 'stomp') { shake = Math.max(shake, 0.3); burst(V3(g.position.x, 0.1, 0.2), 24, 0xd9cfb4, { speed: 3, up: 1, life: 0.5, size: 0.3 }); }
      hit(); tween(0.3, t => { g.position.x = x1 + (x0 - x1) * easeIO(t); }, () => { g.position.x = x0; });
    });
  }
}
function block() {
  shake = Math.max(shake, 0.18);
  tween(0.35, t => { shieldArm.rotation.x = -1.5 * Math.sin(t * Math.PI); hero.position.x = HERO_X - 0.25 * Math.sin(t * Math.PI); });
  burst(V3(hero.position.x + 0.5, 1.0, 0.4), 22, 0xfff6c8, { speed: 3, life: 0.35, size: 0.22, g: 0 });
}
// まちがえた：小さく はねるだけ（はんげきは enemyAttack）
function miss() { if (!enemy) return; const g = enemy, y = g.position.y; tween(0.3, t => { g.position.y = y + 0.4 * Math.sin(t * Math.PI); }); }

/* ---------- 漢字の光（たおした字が 空に 書かれて、勇者に とびこむ） ---------- */
function kanjiPlane(strokes, color) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const m = mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide }));
  m.renderOrder = 11;
  const draw = n => {
    const g = c.getContext('2d'); g.clearRect(0, 0, 256, 256); g.save(); g.scale(256 / 109, 256 / 109);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = color || '#ffd166'; g.shadowBlur = 18;
    // 明るい空でも 見えるように、こい ふちどり → 金 → 白の しん
    for (let i = 0; i < Math.min(n, strokes.length); i++) { const p = new Path2D(strokes[i]); g.shadowBlur = 0; g.strokeStyle = '#7a3d00'; g.lineWidth = 13; g.stroke(p); g.shadowBlur = 18; g.strokeStyle = color || '#ffd166'; g.lineWidth = 9; g.stroke(p); g.shadowBlur = 0; g.strokeStyle = '#fffbe8'; g.lineWidth = 3.5; g.stroke(p); }
    g.restore(); tex.needsUpdate = true;
  };
  m.userData.draw = draw; return m;
}
function kanjiLight(strokes, at, o) {
  if (!strokes || !strokes.length || typeof Path2D === 'undefined') { if (o && o.done) o.done(); return; }
  o = o || {};
  const m = kanjiPlane(strokes, o.color); m.position.copy(at).add(V3(0, 1.3, 0.6)); m.scale.setScalar(o.size || 1.8); scene.add(m);
  const n = strokes.length, wdur = Math.min(0.9, 0.08 * n + 0.2);
  tween(wdur, t => { m.userData.draw(Math.ceil(t * n)); }, () => {
    burst(m.position, 40, 0xffd166, { speed: 3, life: 0.6, size: 0.3, g: 0 });
    const from = m.position.clone(), s0 = m.scale.x;
    wait(o.hold || 0.25, () => tween(0.45, t => { const to = heroAt(); m.position.lerpVectors(from, to, easeIO(t)); m.scale.setScalar(s0 * (1 - 0.85 * t)); m.material.opacity = 1 - t * 0.5; }, () => {
      burst(heroAt(), 30, 0xffd166, { speed: 2, up: 2, life: 0.6, size: 0.3 }); scene.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); cheer(); if (o.done) o.done();
    }));
  });
}
// たおした：くるくる回って 小さくなり、光と コインが はじけ、字が 空に 光る
function die(o) {
  o = typeof o === 'function' ? { done: o } : o || {};
  const g = target();
  if (!scene || !g || g === dummy) { if (o.done) o.done(); return; }
  const at = targetAt(), c = g.userData.color; enemy = null;
  shake = Math.max(shake, 0.5); flash = 1;
  burst(at, 110, c, { speed: 6.5, life: 0.95, size: 0.42, vary: 0.12 });
  burst(at, 44, 0xffd166, { speed: 3.4, up: 5, g: 9, life: 1.2, size: 0.34 });
  const s0 = g.scale.x;
  tween(0.5, t => { g.rotation.y += 0.5; g.scale.setScalar(Math.max(0.001, s0 * (1 - ease(t)))); g.position.y = t * 1.2; }, () => { scene.remove(g); disposeTree(g); });
  if (o.strokes) kanjiLight(o.strokes, at, { done: o.done }); else { cheer(); if (o.done) wait(0.5, o.done); }
}
function cheer() { if (!hero) return; tween(0.5, t => { hero.position.y = (mode === 'home' ? platPos(heroPlat).y + 0.1 : 0) + 0.55 * Math.sin(t * Math.PI); heroArm.rotation.x = -2.6 * Math.sin(t * Math.PI); }); }
// レベルアップ・新しい武器：勇者が 光に つつまれる
function levelUp(color) {
  if (!scene) return;
  const at = V3(hero.position.x, hero.position.y + 0.2, hero.position.z + 0.2); flash = 1; shake = Math.max(shake, 0.25);
  for (let i = 0; i < 6; i++) wait(i * 0.07, () => burst(V3(at.x, at.y + i * 0.35, at.z), 26, color || 0xffd166, { speed: 1.6, up: 4, g: -1, life: 0.9, size: 0.36, spread: 0.9 }));
  cheer();
}

/* ---------- 必殺技 ---------- */
// まず 勇者に よって 力をためて（カットイン）、そのあと 武器ごとの わざが 出る
function special(w, done) {
  if (!scene || !target()) { if (done) done(); return; }
  w = w || curWeapon || { fx: 'slash', glow: 0xffffff, color: 0xffffff };
  const hp = hero.position.clone(); dim = 0.7; slow = 1;
  cam.over = { pos: V3(hp.x + 1.6, 1.5, hp.z + 2.4), look: V3(hp.x, 1.3, hp.z) };
  tween(0.7, t => { heroArm.rotation.x = -2.8 * ease(t); hero.position.y = 0.3 * Math.sin(t * Math.PI * 0.5); if (Math.random() < 0.7) { const tp = new T.Vector3(); weaponData().tip.getWorldPosition(tp); burst(tp, 3, w.glow, { speed: 2, life: 0.4, size: 0.3, g: 0 }); } }, () => {
    cam.over = null; dim = 0.35;
    const at = targetAt();
    FX[w.fx] ? FX[w.fx](at, w) : FX.slash(at, w);
    wait(FX_HIT[w.fx] || 0.25, () => { shake = Math.max(shake, 0.7); flash = 1; dim = 0; slowmo(); const g = target(); if (g) knock(g, 0.6); if (done) done(); });
    tween(0.4, t => { heroArm.rotation.x = -2.8 + 4 * t; hero.position.y = 0.3 * (1 - t); });
  });
}
function slowmo() { slow = 0.25; wait(0.12, () => { slow = 1; }); }
const FX_HIT = { fire: 0.35, ice: 0.55, thunder: 0.2, wind: 0.5, light: 0.4, dark: 0.55, dragon: 0.6, star: 0.65, kanji: 0.7 };
function bolt(from, to, color) {
  const pts = [from.clone()], n = 8;
  for (let i = 1; i < n; i++) { const p = from.clone().lerp(to, i / n); p.x += (Math.random() - 0.5) * 0.8; p.z += (Math.random() - 0.5) * 0.4; pts.push(p); }
  pts.push(to.clone());
  const g = new T.Group(), m = glowMat(color);
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], len = a.distanceTo(b); const seg = mesh(new T.BoxGeometry(0.12, 0.12, len), m); seg.position.copy(a).lerp(b, 0.5); seg.lookAt(b); g.add(seg); }
  scene.add(g); tween(0.35, t => { m.opacity = 1 - t; }, () => { scene.remove(g); disposeTree(g); m.dispose(); });
}
const FX = {
  slash(at, w) { arc(at, w.color, 2.0, Math.PI * 0.65); burst(at, 60, w.glow, { speed: 6, life: 0.6, size: 0.4 }); },
  slash2(at, w) { arc(at, w.color, 2.0, Math.PI * 0.65); wait(0.12, () => { arc(at, 0xffffff, 2.0, Math.PI * 0.15); burst(at, 70, w.glow, { speed: 6, life: 0.6, size: 0.4 }); }); },
  fire(at) {
    for (let i = 0; i < 14; i++) wait(i * 0.03, () => { burst(V3(at.x, 0.1, at.z), 16, i % 2 ? 0xff5a1a : 0xffb347, { speed: 1.2, up: 7, g: -1, life: 0.7, size: 0.55, spread: 0.6 }); });
    const ring = mesh(new T.RingGeometry(0.3, 0.6, 24), glowMat(0xff8a2a), at.x, 0.05, at.z); ring.rotation.x = -Math.PI / 2; scene.add(ring);
    tween(0.6, t => { ring.scale.setScalar(1 + t * 5); ring.material.opacity = 1 - t; }, () => { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); });
  },
  ice(at) {
    for (let i = 0; i < 9; i++) wait(i * 0.05, () => {
      const s = ol(mesh(new T.ConeGeometry(0.18, 0.9, 6), toon(0xbff0ff, { emissive: 0x2a6a8a }), at.x + (Math.random() - 0.5) * 1.6, 7, at.z + (Math.random() - 0.5) * 0.8)); s.rotation.x = Math.PI; scene.add(s);
      const y0 = 7; tween(0.35, t => { s.position.y = y0 - (y0 - 0.6) * t * t; }, () => { burst(s.position, 18, 0xd8f6ff, { speed: 3, life: 0.5, size: 0.28 }); scene.remove(s); s.geometry.dispose(); });
    });
  },
  thunder(at) { for (let i = 0; i < 3; i++) wait(i * 0.08, () => { bolt(V3(at.x + (Math.random() - 0.5), 12, at.z), at, i === 1 ? 0xffffff : 0xfff27a); burst(at, 40, 0xfff7a8, { speed: 6, life: 0.4, size: 0.3, g: 0 }); flash = 1; }); },
  wind(at) { for (let i = 0; i < 30; i++) wait(i * 0.02, () => { const a = i * 0.7, r = 0.9 - i * 0.02; burst(V3(at.x + Math.cos(a) * r, 0.2 + i * 0.08, at.z + Math.sin(a) * r), 4, i % 2 ? 0x7dffb0 : 0xffffff, { speed: 0.6, up: 2, g: 0, life: 0.5, size: 0.35 }); }); arc(at, 0x7dffb0, 2.2, 0); },
  light(at) {
    const beam = mesh(new T.CylinderGeometry(0.7, 0.7, 14, 20, 1, true), glowMat(0xfff6c8, 0.8), at.x, 7, at.z); scene.add(beam);
    tween(0.7, t => { beam.scale.set(1 - t * 0.6, 1, 1 - t * 0.6); beam.material.opacity = 0.8 * (1 - t); }, () => { scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); });
    wait(0.35, () => { for (let k = 0; k < 4; k++) arc(at, 0xffffff, 1.6, k * Math.PI / 2); burst(at, 80, 0xfff6c8, { speed: 6, life: 0.7, size: 0.4, g: 0 }); });
  },
  dark(at) {
    const v = mesh(new T.TorusGeometry(1.4, 0.18, 8, 28), glowMat(0xb06bff), at.x, at.y, at.z + 0.2); scene.add(v);
    tween(0.6, t => { v.rotation.z += 0.3; v.scale.setScalar(1.4 * (1 - t) + 0.1); }, () => { scene.remove(v); v.geometry.dispose(); v.material.dispose(); burst(at, 90, 0xd8a8ff, { speed: 7, life: 0.6, size: 0.4, g: 0 }); });
    for (let i = 0; i < 20; i++) wait(i * 0.025, () => burst(at.clone().add(V3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, 0)), 3, 0x6a2aff, { speed: 0.5, g: 0, life: 0.4, size: 0.3 }));
  },
  dragon(at) {
    const from = heroAt();
    for (let i = 0; i < 24; i++) wait(i * 0.025, () => { const t = i / 24, p = from.clone().lerp(at, t); p.y += Math.sin(t * Math.PI * 3) * 0.8; p.z += Math.cos(t * Math.PI * 3) * 0.6; burst(p, 10, i % 3 ? 0xff2d55 : 0xffd166, { speed: 1, g: 0, life: 0.5, size: 0.5 }); });
    wait(0.6, () => burst(at, 100, 0xff5a7a, { speed: 7, life: 0.7, size: 0.45 }));
  },
  star(at) {
    for (let i = 0; i < 7; i++) wait(i * 0.07, () => {
      const s = mesh(new T.OctahedronGeometry(0.25), glowMat(0xfff6c8)), x = at.x + (Math.random() - 0.5) * 1.5; s.position.set(x - 3, 9, at.z); scene.add(s);
      tween(0.35, t => { s.position.set(x - 3 * (1 - t), 9 - (9 - at.y) * t, at.z); s.rotation.y += 0.4; burst(s.position, 2, 0x8fb8ff, { speed: 0.3, g: 0, life: 0.4, size: 0.3 }); }, () => { burst(s.position, 26, 0xdde9ff, { speed: 4, life: 0.5, size: 0.32 }); scene.remove(s); s.geometry.dispose(); s.material.dispose(); });
    });
  },
  kanji(at) {
    const m = kanjiPlane(KANJI_FX.strokes || [], '#ffcc33'); m.position.set(at.x, 9, at.z + 0.5); m.scale.setScalar(3.2); scene.add(m); m.userData.draw(99);
    tween(0.7, t => { m.position.y = 9 - (9 - at.y) * t * t; m.rotation.z = (1 - t) * 0.6; }, () => { burst(at, 140, 0xffd166, { speed: 8, life: 0.8, size: 0.5 }); tween(0.4, t => { m.material.opacity = 1 - t; m.scale.setScalar(3.2 + t * 2); }, () => { scene.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); }); });
  },
};
const KANJI_FX = { strokes: null };

/* ---------- 宝箱 ---------- */
const CHEST_COLORS = [[0xa0683a, 0x6b4a2f], [0xdfe6ee, 0x8b98a8], [0xffd166, 0xd99a1a]];
function chest(grade) {
  if (!scene) return;
  if (chestG) { battleG.remove(chestG); disposeTree(chestG); }
  const c = CHEST_COLORS[grade] || CHEST_COLORS[0], g = new T.Group(), body = toon(c[0]), band = toon(c[1], { emissive: grade === 2 ? 0x553300 : 0x000000 });
  g.add(ol(mesh(new T.BoxGeometry(1.2, 0.7, 0.8), body, 0, 0.35, 0)));
  for (const x of [-0.42, 0.42]) g.add(mesh(new T.BoxGeometry(0.12, 0.72, 0.82), band, x, 0.35, 0));
  const lid = new T.Group(); lid.position.set(0, 0.7, -0.4);
  const top = ol(mesh(new T.CylinderGeometry(0.4, 0.4, 1.2, 14, 1, false, 0, Math.PI), body, 0, 0, 0.4)); top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.scale.set(1, 1, 1); lid.add(top);
  for (const x of [-0.42, 0.42]) { const b = mesh(new T.CylinderGeometry(0.41, 0.41, 0.12, 14, 1, false, 0, Math.PI), band, x, 0, 0.4); b.rotation.z = Math.PI / 2; b.rotation.y = Math.PI / 2; lid.add(b); }
  lid.add(mesh(new T.BoxGeometry(0.2, 0.26, 0.08), toon(0xffd166, { emissive: 0x664400 }), 0, -0.02, 0.82));
  g.add(lid); g.userData.lid = lid; g.add(shadowBlob(0.8));
  g.position.set(0.1, 7, 0.6); g.rotation.y = -0.3; battleG.add(g); chestG = g;
  cam.over = { pos: V3(0.1, 2.6, 5.4), look: V3(0.1, 0.6, 0.6) };
  tween(0.5, t => { g.position.y = 7 * (1 - t * t); }, () => { shake = 0.35; burst(V3(0.1, 0.1, 0.6), 30, 0xffffff, { speed: 2.5, up: 1, life: 0.5, size: 0.3 }); tween(0.3, t => { g.position.y = 0.4 * Math.sin(t * Math.PI); }); });
  g.userData.wiggle = true; g.userData.grade = grade;
}
function openChest(done) {
  const g = chestG;
  if (!g) { if (done) done(); return; }
  g.userData.wiggle = false;
  const col = [0xffe0a0, 0xdde9ff, 0xffd166][g.userData.grade] || 0xffffff;
  const sh = k => tween(0.18, t => { g.rotation.z = 0.12 * k * Math.sin(t * Math.PI * 2); g.position.y = 0.08 * k * Math.sin(t * Math.PI); }, () => { g.rotation.z = 0; burst(V3(0.1, 0.9, 0.6), 8 * k, col, { speed: 2, life: 0.4, size: 0.25 }); });
  sh(1); wait(0.3, () => sh(1.6)); wait(0.6, () => sh(2.3));
  wait(0.95, () => {
    shake = 0.5; flash = 1;
    tween(0.35, t => { g.userData.lid.rotation.x = -1.9 * ease(t); });
    const beams = new T.Group(); beams.position.set(0.1, 0.7, 0.6); g.parent.add(beams);
    for (let i = 0; i < 6; i++) { const b = mesh(new T.ConeGeometry(0.35, 5, 8, 1, true), glowMat(col, 0.45), 0, 2.5, 0); b.rotation.z = (i - 2.5) * 0.18; beams.add(b); }
    tween(1.6, t => { beams.rotation.y += 0.03; beams.children.forEach(b => b.material.opacity = 0.45 * (1 - t)); }, () => { g.parent && g.parent.remove(beams); disposeTree(beams); });
    for (let i = 0; i < 8; i++) wait(i * 0.08, () => burst(V3(0.1, 0.9, 0.6), 14, i % 2 ? 0xffd166 : col, { speed: 2, up: 6, g: 8, life: 1.1, size: 0.34, spread: 0.3 }));
    wait(0.5, () => { if (done) done(); });
  });
}
function closeChest() { if (chestG) { const g = chestG; chestG = null; tween(0.3, t => g.scale.setScalar(Math.max(0.001, 1 - t)), () => { g.parent && g.parent.remove(g); disposeTree(g); }); } cam.over = null; }

/* ---------- 塔を のぼる ---------- */
function climb(from, to, done) {
  if (!scene || mode !== 'home' || !plats.length) { setCleared(to); if (done) done(); return; }
  heroPlat = Math.min(from, plats.length - 1); setCleared(from); climbing = true;
  const steps = []; for (let i = from + 1; i <= Math.min(to, plats.length - 1); i++) steps.push(i);
  const hop = k => {
    if (k >= steps.length) { climbing = false; towerCleared = to; setCleared(to); cam.jump = false; cheer(); if (done) done(); return; }
    const a = platPos(steps[k] - 1).add(V3(0, 0.1, 0)), b = platPos(steps[k]).add(V3(0, 0.1, 0));
    hero.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    tween(0.32, t => { hero.position.lerpVectors(a, b, t); hero.position.y += Math.sin(t * Math.PI) * 0.5; }, () => { heroPlat = steps[k]; burst(b, 8, 0xffffff, { speed: 1.2, up: 0.6, life: 0.4, size: 0.22 }); hop(k + 1); });
  };
  wait(0.4, () => hop(0));
}

/* ---------- 毎フレーム ---------- */
function frame() {
  if (!host || !host.isConnected || !host.offsetParent || document.hidden) { running = false; return; }
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 0.05), dt = raw * slow, now = clock.elapsedTime;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.step(k);
    if (k >= 1) { tweens.splice(i, 1); if (w.done) w.done(); }
  }
  if (hero) { hero.children[0].scale.y = 1 + Math.sin(now * 3) * 0.03; heroParts.cape.rotation.x = 0.18 + Math.sin(now * 4) * 0.06; }
  if (mode === 'shop' && hero && !tweens.length) hero.rotation.y = Math.PI / 2 - 0.5 + Math.sin(now * 0.8) * 0.25;
  if (enemy) {
    const u = enemy.userData, inner = u.inner;
    inner.position.y = u.base + (Math.sin(now * 2.4) * 0.5 + 0.5) * u.bob;
    if (u.squash) inner.scale.y = 1 + Math.sin(now * 3.2) * 0.07;
    for (const s of [-1, 1]) if (u.parts['wing' + s]) u.parts['wing' + s].rotation.z = s * (-1.2 + Math.sin(now * (u.flap ? 14 : 4)) * 0.35);
    if (u.rage && Math.random() < 0.6) burst(V3(enemy.position.x + (Math.random() - 0.5) * 1.6, Math.random() * 2.5, 0), 1, 0xff3d3d, { speed: 0.5, up: 1.5, g: -0.5, life: 0.6, size: 0.35 });
  }
  if (chestG && chestG.userData.wiggle) { chestG.rotation.z = Math.sin(now * 9) * 0.05 * (Math.sin(now * 2) > 0.5 ? 1 : 0); if (Math.random() < 0.3) burst(V3(0.1 + (Math.random() - 0.5) * 1.2, 0.9, 0.6), 1, 0xffd166, { speed: 0.4, up: 1, g: 0, life: 0.6, size: 0.25 }); }
  if (homeG && mode === 'home') { if (homeG.userData.storm) homeG.userData.storm.rotation.y = now * 0.2; plats.forEach((g, i) => { if (g.userData.flag) g.userData.flag.rotation.y = Math.sin(now * 3 + i) * 0.3; if (g.userData.boss && i > towerCleared) g.userData.boss.position.y = 0.1 + Math.abs(Math.sin(now * 2 + i)) * 0.08; }); }
  for (const c of clouds) { c.position.x += c.userData.v * raw; if (c.position.x > 34) c.position.x = -34; }
  emitAura(raw);
  if (showcase && mode === 'shop') { showcase.rotation.y = now * 1.4; showcase.position.y = 1.25 + Math.sin(now * 2) * 0.06; if (Math.random() < 0.25 && curWeapon) burst(V3(showcase.parent.position.x + (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 1.2, showcase.parent.position.z), 1, curWeapon.glow, { speed: 0.4, up: 0.8, g: 0, life: 0.8, size: 0.22 }); }
  stepParticles(dt);
  // カメラ
  shake *= Math.pow(0.0015, raw); flash = Math.max(0, flash - raw * 4);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  let want = null, look = null;
  if (cam.over) { want = cam.over.pos; look = cam.over.look; }
  else if (mode === 'battle') {
    const z = Math.max(6.4, Math.min(15, 3.3 / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)));
    want = V3(0, 1.6 + z * 0.12, z); look = V3(0, 1.1, 0);
  } else if (mode === 'shop') { const z = Math.max(5.2, Math.min(14, 2.9 / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect))); want = V3(0.3, 1.4 + z * 0.1, z); look = V3(0.3, 1.0, 0); }
  else {
    // 勇者を 画面の上の ほうに、これから のぼる かいだんと 塔が 見えるように（下には ボタンが 重なる）
    const p = hero.position, d = V3(p.x, 0, p.z).normalize(), tall = camera.aspect < 1, dist = tall ? 16 : 13.5;
    const tang = V3(-d.z, 0, d.x);
    want = p.clone().addScaledVector(d, dist).addScaledVector(tang, -2.2).add(V3(0, 1.2, 0)); look = p.clone().add(V3(0, tall ? -1.3 : -0.2, 0));
    if (cam.sweep) { // 塔の上から おりてくる
      const s = cam.sweep; s.t += raw; const k = easeIO(Math.min(1, s.t / s.dur)), topP = platPos(towerL);
      const td = V3(topP.x, 0, topP.z).normalize(), tw = topP.clone().addScaledVector(td, 9).add(V3(0, 2.5, 0));
      want = tw.lerp(want, k); look = topP.clone().add(V3(0, 1, 0)).lerp(look, k);
      if (s.t >= s.dur) cam.sweep = null;
    }
  }
  const snap = cam.jump ? 1 : cam.over ? 0.18 : cam.sweep ? 1 : 0.1; cam.jump = false;
  cam.pos.lerp(want, snap); cam.look.lerp(look, snap);
  camera.position.set(cam.pos.x + sx, cam.pos.y + sy, cam.pos.z); camera.lookAt(cam.look.x + sx * 0.5, cam.look.y, cam.look.z);
  sun.intensity = 2.2 + flash * 2.5 - dim * 1.6; hemi.intensity = 1.6 - dim * 1.1;
  renderer.render(scene, camera);
}

window.TowerScene = {
  attach, setArea, setLook, setWeapon, sweep, spawn, bossIntro, bossRage, attack, enemyAttack, miss, die, cheer, levelUp, special, climb, chest, openChest, closeChest,
  setKanjiFx(strokes) { KANJI_FX.strokes = strokes; }, resize, get ok() { return !!renderer; },
};
window.dispatchEvent(new Event('towerscene'));
