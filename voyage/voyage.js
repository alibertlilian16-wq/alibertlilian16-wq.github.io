// Le voyage : une maquette en 3D (Three.js) qu'on traverse à la molette.
// Les cartes sont de vrais éléments HTML placés dans la scène (CSS3DRenderer) : texte net, liens cliquables.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from './lib/CSS3DRenderer.js';

const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
function goFlat() { root.classList.remove('loading'); root.classList.add('flat'); }

// ---------- Projets ajoutés dans projets.json : une carte de plus, à sa date ----------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
async function addProjects() {
  let data = {};
  try { const r = await fetch('../projets.json', { cache: 'no-cache' }); if (r.ok) data = await r.json(); } catch (e) {}
  const list = $('#cards');
  (data.projets || []).forEach((p) => {
    if (!p.titre) return;
    const card = el('article', 'card');
    card.dataset.tri = p.tri || ''; card.dataset.rail = p.date || ''; card.dataset.year = (p.tri || '').slice(0, 4); card.dataset.prop = 'projet';
    const inner = el('div', 'card__inner');
    const front = el('div', 'card__face card__front');
    front.append(el('p', 'card__when', p.date || ''), el('h2', '', p.titre));
    if (p.contexte) front.append(el('p', 'card__where', p.contexte));
    if (p.resume) front.append(el('p', '', p.resume));
    const back = el('div', 'card__face card__back');
    back.append(el('p', 'card__when', 'Ce que j’ai fait'));
    if (p.puces && p.puces.length) { const ul = el('ul'); ul.style.margin = '0 0 10px'; ul.style.paddingLeft = '1.1em'; p.puces.slice(0, 4).forEach((x) => ul.append(el('li', '', x))); back.append(ul); }
    if (p.competences && p.competences.length) { const t = el('ul', 'card__tags'); p.competences.forEach((x) => t.append(el('li', '', x))); back.append(t); }
    if (p.lien && /^https:\/\//.test(p.lien.url || '')) { const a = el('a', 'card__link', p.lien.texte || 'Voir le projet'); a.href = p.lien.url; a.rel = 'noopener'; back.append(a); }
    const f1 = el('button', 'card__flip', 'Ce que j’ai fait'); f1.type = 'button'; front.append(f1);
    const f2 = el('button', 'card__flip', 'Retourner la carte'); f2.type = 'button'; back.append(f2);
    inner.append(front, back); card.append(inner);
    const next = [...list.querySelectorAll('.card')].find((c) => c.dataset.tri > (p.tri || '')) || $('.card--end');
    list.insertBefore(card, next);
  });
}

// ---------- Interactions des cartes ----------
function wireCards(cards) {
  cards.forEach((card) => {
    if (card.classList.contains('card--end')) return;
    let busy = false;
    // Retournement : la carte pivote jusqu'à la tranche, change de face, puis revient.
    const toggle = () => {
      if (busy) return; busy = true;
      card.classList.add('is-turning');
      setTimeout(() => { card.classList.toggle('is-flipped'); card.classList.remove('is-turning'); setTimeout(() => { busy = false; }, 220); }, 210);
    };
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (e.target.closest('.card__flip')) { e.stopPropagation(); toggle(); return; }
      toggle();
    });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg');
      card.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
}

// ---------- Palette lue dans les variables CSS (suit le thème) ----------
function palette() {
  const cs = getComputedStyle(root);
  const g = (n) => new THREE.Color(cs.getPropertyValue(n).trim());
  return { bg: g('--bg'), model: g('--model'), ground: g('--ground'), olive: g('--olive'), soft: g('--olive-soft'), line: g('--line'), glow: g('--glow') };
}

async function main() {
  await addProjects();
  const cards = [...document.querySelectorAll('.card')];
  wireCards(cards);
  if (root.classList.contains('flat') || !hasWebGL()) { goFlat(); return; }
  build(cards);
}

function build(cards) {
  const N = cards.length;
  const narrow = innerWidth < 760;
  const SP = 26;            // distance entre deux étapes
  const OPEN = 1.0;         // écrans de défilement pour ouvrir la porte
  const STEP = 1.15;        // écrans de défilement par étape

  // ----- Rendu -----
  const canvas = $('#scene');
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  gl.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  gl.setSize(innerWidth, innerHeight);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.05;

  const css = new CSS3DRenderer();
  css.setSize(innerWidth, innerHeight);
  css.domElement.classList.add('css3d');
  document.body.insertBefore(css.domElement, $('.loader'));

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  let pal = palette();
  scene.background = pal.bg.clone();
  scene.fog = new THREE.Fog(pal.bg.clone(), 14, 62);

  const camera = new THREE.PerspectiveCamera(narrow ? 62 : 52, innerWidth / innerHeight, 0.1, 220);
  // Sur téléphone, l'horizon remonte dans le tiers haut : les décors occupent le haut de l'écran, la carte le bas.
  const frameView = () => { if (narrow) camera.setViewOffset(innerWidth, innerHeight * 1.5, 0, innerHeight * 0.5, innerWidth, innerHeight); else camera.clearViewOffset(); };
  frameView();
  const sheet = narrow ? document.body.insertBefore(el('div', 'sheet'), $('.loader')) : null;

  // ----- Matières : une maquette en pierre claire, accents olive -----
  const M = {
    model: new THREE.MeshStandardMaterial({ color: pal.model, roughness: 0.82 }),
    accent: new THREE.MeshStandardMaterial({ color: pal.olive, roughness: 0.65 }),
    soft: new THREE.MeshStandardMaterial({ color: pal.soft, roughness: 0.9 }),
    ground: new THREE.MeshStandardMaterial({ color: pal.ground, roughness: 1 }),
    glow: new THREE.MeshBasicMaterial({ color: pal.glow }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.65, roughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b3026, roughness: 0.6 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x3435ff, roughness: 0.6 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff8200, roughness: 0.6 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1, depthWrite: false }),
  };
  const line = new THREE.LineBasicMaterial({ color: pal.olive, transparent: true, opacity: 0.55 });

  // ----- Lumières -----
  const hemi = new THREE.HemisphereLight(0xffffff, pal.ground, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  scene.add(sun, sun.target);

  // ----- Sol et quadrillage -----
  const depth = N * SP + 80;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, depth), M.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -depth / 2 + 30);
  scene.add(ground);
  const grid = new THREE.GridHelper(depth, Math.round(depth / 2), pal.line, pal.line);
  grid.material.transparent = true; grid.material.opacity = 0.6;
  grid.position.set(0, 0.004, -depth / 2 + 30);
  scene.add(grid);

  // ----- Outils de construction -----
  const box = (g, w, h, d, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  const cyl = (g, r, h, m, x, y, z, seg = 20) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); g.add(o); return o; };
  const blob = (g, r, x = 0, z = 0, sx = 1) => { const o = new THREE.Mesh(new THREE.CircleGeometry(r, 32), M.shadow); o.rotation.x = -Math.PI / 2; o.position.set(x, 0.012, z); o.scale.x = sx; g.add(o); };
  const animated = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const PROPS = {
    lycee() {
      const g = new THREE.Group(); blob(g, 2.4, 0, 0, 1.3);
      box(g, 3.4, 1.6, 1.8, M.model, 0, 0.8, 0);
      box(g, 3.6, 0.12, 2, M.accent, 0, 1.66, 0);
      [-1.25, -0.45, 0.45, 1.25].forEach((x) => box(g, 0.42, 0.5, 0.04, M.glow, x, 1.0, 0.92));
      box(g, 0.5, 0.75, 0.04, M.accent, 0, 0.38, 0.92);
      cyl(g, 0.03, 2.4, M.model, 2.1, 1.2, 0.7, 8); box(g, 0.6, 0.36, 0.02, M.accent, 2.4, 2.2, 0.7);
      box(g, 0.9, 0.12, 0.6, M.accent, -2.2, 0.06, 1.4, 0.1); box(g, 0.85, 0.12, 0.56, M.model, -2.2, 0.18, 1.4, -0.12); box(g, 0.8, 0.12, 0.6, M.soft, -2.2, 0.3, 1.4, 0.2);
      return g;
    },
    athle() {
      const g = new THREE.Group(); blob(g, 2.6, 0, 0, 1.5);
      const field = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.03, 48), M.soft); field.scale.x = 1.7; field.position.y = 0.015; g.add(field);
      for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.5 + k * 0.22, 0.022, 6, 80), k % 2 ? M.model : M.accent); t.rotation.x = Math.PI / 2; t.scale.x = 1.55; t.position.y = 0.03; g.add(t); }
      [[-1.2, 2.1], [0.4, 2.15]].forEach(([x, z]) => { box(g, 0.04, 0.5, 0.04, M.model, x - 0.35, 0.25, z); box(g, 0.04, 0.5, 0.04, M.model, x + 0.35, 0.25, z); box(g, 0.78, 0.08, 0.04, M.accent, x, 0.48, z); });
      box(g, 0.6, 0.6, 0.6, M.model, 3.2, 0.3, 0.2); box(g, 0.6, 0.4, 0.6, M.model, 2.6, 0.2, 0.2); box(g, 0.6, 0.25, 0.6, M.model, 3.8, 0.125, 0.2);
      return g;
    },
    auto() {
      const g = new THREE.Group(); blob(g, 1.9, 0, 0, 1.2);
      cyl(g, 2, 0.1, M.soft, 0, 0.05, 0, 48);
      const car = new THREE.Group(); car.position.y = 0.1; g.add(car);
      box(car, 2.6, 0.5, 1.15, M.model, 0, 0.5, 0);
      box(car, 1.4, 0.46, 1.05, M.model, -0.15, 0.97, 0);
      box(car, 1.42, 0.28, 1.07, M.dark, -0.15, 1.0, 0);
      box(car, 0.1, 0.14, 0.9, M.glow, 1.31, 0.55, 0);
      [[-0.85, 0.58], [0.85, 0.58], [-0.85, -0.58], [0.85, -0.58]].forEach(([x, z]) => { const w = cyl(car, 0.28, 0.18, M.dark, x, 0.28, z); w.rotation.x = Math.PI / 2; });
      animated.push((t) => { car.rotation.y = Math.sin(t * 0.25) * 0.35; });
      cyl(g, 0.03, 1.2, M.model, 2.2, 0.6, 0.9, 8); box(g, 0.55, 0.38, 0.03, M.accent, 2.2, 1.25, 0.9);
      return g;
    },
    iut() {
      const g = new THREE.Group(); blob(g, 2.6, 0, 0, 1.2);
      box(g, 4.2, 0.15, 2.6, M.model, 0, 0.075, 0); box(g, 3.8, 0.15, 2.3, M.model, 0, 0.22, 0);
      box(g, 3.6, 1.7, 1.2, M.model, 0, 1.15, -0.45);
      for (let k = 0; k < 6; k++) cyl(g, 0.11, 1.7, M.model, -1.5 + k * 0.6, 1.15, 0.6, 16);
      box(g, 3.9, 0.22, 1.9, M.accent, 0, 2.1, 0.05);
      [-1.2, -0.4, 0.4, 1.2].forEach((x) => box(g, 0.36, 0.7, 0.04, M.glow, x, 1.2, 0.16));
      return g;
    },
    era() {
      const g = new THREE.Group(); blob(g, 2.2, 0, 0, 1.2);
      cyl(g, 2.2, 0.08, M.soft, 0, 0.04, 0, 48);
      box(g, 2.1, 1.3, 1.7, M.model, 0, 0.73, 0);
      const s = new THREE.Shape(); s.moveTo(-1.2, 0); s.lineTo(1.2, 0); s.lineTo(0, 0.9); s.closePath();
      const roofG = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: false }); roofG.translate(0, 0, -0.95);
      const roof = new THREE.Mesh(roofG, M.accent); roof.position.y = 1.38; g.add(roof);
      [-0.55, 0.55].forEach((x) => box(g, 0.4, 0.4, 0.04, M.glow, x, 0.85, 0.86));
      box(g, 0.42, 0.72, 0.04, M.accent, 0, 0.44, 0.86);
      box(g, 0.3, 0.5, 0.3, M.model, 0.6, 1.9, -0.3);
      cyl(g, 0.03, 1.3, M.model, 1.7, 0.65, 1.1, 8); box(g, 0.75, 0.48, 0.04, M.accent, 1.7, 1.25, 1.1);
      const key = new THREE.Group(); key.position.set(0, 3.0, 0.2); g.add(key);
      key.add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 12, 32), M.gold));
      box(key, 0.75, 0.08, 0.08, M.gold, 0.6, 0, 0); box(key, 0.08, 0.2, 0.08, M.gold, 0.85, -0.12, 0); box(key, 0.08, 0.14, 0.08, M.gold, 0.7, -0.1, 0);
      animated.push((t) => { key.rotation.y = t * 0.9; key.position.y = 3.0 + Math.sin(t * 1.4) * 0.12; });
      const pl = new THREE.PointLight(0xffd59a, 6, 7, 1.6); pl.position.set(0, 2.2, 1.6); g.add(pl);
      return g;
    },
    ba() {
      const g = new THREE.Group(); blob(g, 2.4, 0, 0, 1.3);
      const crate = (x, y, z, r = 0) => { box(g, 0.62, 0.44, 0.46, M.model, x, y, z, r); box(g, 0.64, 0.06, 0.48, M.accent, x, y, z, r); };
      crate(-1.2, 0.22, 0); crate(-0.55, 0.22, 0.05, 0.08); crate(-0.88, 0.66, 0.02, -0.06); crate(-1.2, 0.22, -0.55); crate(-0.55, 0.22, -0.5);
      const hub = new THREE.Vector3(1.2, 0.9, -0.2);
      cyl(g, 0.05, 0.9, M.model, hub.x, 0.45, hub.z, 8);
      const hb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), M.accent); hb.position.copy(hub); g.add(hb);
      const pts = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + 0.3, r = 1.0 + rnd() * 0.8;
        const p = new THREE.Vector3(hub.x + Math.cos(a) * r, 0.35 + rnd() * 0.25, hub.z + Math.sin(a) * r * 0.8);
        const pin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), k % 3 ? M.model : M.accent); pin.position.copy(p); g.add(pin);
        cyl(g, 0.015, p.y, M.model, p.x, p.y / 2, p.z, 6);
        pts.push(hub.clone(), p);
      }
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), line));
      animated.push((t) => { hb.scale.setScalar(1 + Math.sin(t * 2.2) * 0.12); });
      return g;
    },
    rayon() {
      const g = new THREE.Group(); blob(g, 1.8, 0, 0, 1.3);
      box(g, 0.06, 1.9, 0.55, M.model, -1, 0.95, 0); box(g, 0.06, 1.9, 0.55, M.model, 1, 0.95, 0); box(g, 2.06, 1.9, 0.04, M.model, 0, 0.95, -0.26);
      [0.06, 0.66, 1.26, 1.86].forEach((y) => box(g, 2, 0.05, 0.55, M.model, 0, y, 0));
      const mats = [M.blue, M.orange, M.model, M.accent];
      [0.1, 0.7, 1.3].forEach((y) => { let x = -0.85; while (x < 0.8) { const w = 0.16 + rnd() * 0.18, h = 0.22 + rnd() * 0.25; box(g, w, h, 0.3, mats[Math.floor(rnd() * 4)], x + w / 2, y + h / 2, 0.02); x += w + 0.05; } });
      return g;
    },
    lpj() {
      const g = new THREE.Group(); blob(g, 2.7, 0, 0, 1.2);
      box(g, 4.2, 0.06, 3.2, M.soft, 0, 0.03, 0);
      const tall = [];
      for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) {
        if (i === 4 || j === 3) continue; // une avenue en croix
        const h = 0.15 + Math.pow(rnd(), 2) * 1.5;
        tall.push([h, box(g, 0.34, h, 0.34, M.model, -1.8 + i * 0.45, 0.06 + h / 2, -1.35 + j * 0.45)]);
      }
      tall.sort((a, b) => b[0] - a[0]).slice(0, 6).forEach(([, b]) => { b.material = M.accent; });
      const pin = new THREE.Group(); pin.position.set(0.25, 1.9, 0.2); g.add(pin);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 16), M.accent); cone.rotation.x = Math.PI; pin.add(cone);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), M.accent); head.position.y = 0.22; pin.add(head);
      animated.push((t) => { pin.position.y = 1.9 + Math.sin(t * 1.6) * 0.1; pin.rotation.y = t * 0.6; });
      return g;
    },
    projet() {
      const g = new THREE.Group(); blob(g, 1.3);
      const board = box(g, 1.3, 0.9, 0.05, M.model, 0, 1.35, 0); board.rotation.x = -0.12;
      box(g, 1.1, 0.05, 0.04, M.accent, 0, 1.6, 0.04);
      [-0.45, 0.45].forEach((x) => { const l = box(g, 0.05, 1.5, 0.05, M.model, x, 0.75, 0.1); l.rotation.x = -0.12; });
      box(g, 0.6, 0.12, 0.45, M.soft, 0.9, 0.06, 0.4); box(g, 0.55, 0.1, 0.42, M.model, 0.9, 0.17, 0.4, 0.2);
      return g;
    },
  };

  // ----- Trajet : des points d'arrêt qui serpentent doucement -----
  const F = [new THREE.Vector3(0, 1.65, narrow ? 15 : 8)];
  for (let i = 1; i <= N; i++) F.push(new THREE.Vector3(i === N || narrow ? 0 : (i % 2 ? 0.9 : -0.9), 1.65, -i * SP));
  const curve = new THREE.CatmullRomCurve3(F, false, 'catmullrom', 0.3);

  // ----- La porte d'entrée, centrée sur le trajet -----
  const entry = new THREE.Group(); scene.add(entry);
  const DW = 2.5, DH = 3.5, WH = 9;
  box(entry, 40, WH, 0.5, M.model, -20 - DW / 2, WH / 2, 0);
  box(entry, 40, WH, 0.5, M.model, 20 + DW / 2, WH / 2, 0);
  box(entry, DW, WH - DH, 0.5, M.model, 0, DH + (WH - DH) / 2, 0);
  box(entry, 0.16, DH + 0.16, 0.62, M.accent, -DW / 2 - 0.08, (DH + 0.16) / 2, 0);
  box(entry, 0.16, DH + 0.16, 0.62, M.accent, DW / 2 + 0.08, (DH + 0.16) / 2, 0);
  box(entry, DW + 0.32, 0.16, 0.62, M.accent, 0, DH + 0.08, 0);
  const hinge = new THREE.Group(); hinge.position.set(-DW / 2, 0, -0.05); entry.add(hinge);
  box(hinge, DW - 0.04, DH - 0.04, 0.1, M.accent, DW / 2, DH / 2, 0);
  box(hinge, DW - 0.5, DH * 0.38, 0.12, M.soft, DW / 2, DH * 0.72, 0.01);
  box(hinge, DW - 0.5, DH * 0.38, 0.12, M.soft, DW / 2, DH * 0.27, 0.01);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), M.gold); knob.position.set(DW - 0.25, DH * 0.48, 0.1); hinge.add(knob);
  const doorLight = new THREE.PointLight(0xffe2a8, 0, 12, 1.4); doorLight.position.set(0, 2.2, -2.5); scene.add(doorLight);

  // ----- Étapes : carte HTML, décor, année, et une porte à traverser -----
  const stations = [];
  const scaleCard = narrow ? 0.0068 : 0.0048;
  cards.forEach((card, k) => {
    const i = k + 1; const f = F[i]; const end = i === N;
    const side = end ? -1 : (i % 2 ? 1 : -1);
    const cPos = f.clone().add(new THREE.Vector3(end ? 0 : side * 1.55, end ? 0.2 : 0.08, -3.6));
    let obj = null;
    if (narrow) sheet.append(card);  // sur téléphone : la carte de l'étape s'affiche en bas de l'écran
    else { obj = new CSS3DObject(card); obj.position.copy(cPos); obj.scale.setScalar(scaleCard); obj.lookAt(f); cssScene.add(obj); }

    let prop;
    if (end) {
      prop = new THREE.Group();
      const fx = 0;
      box(prop, 0.3, 4.6, 0.4, M.accent, fx - 1.55, 2.3, 0); box(prop, 0.3, 4.6, 0.4, M.accent, fx + 1.55, 2.3, 0); box(prop, 3.4, 0.3, 0.4, M.accent, fx, 4.6, 0);
      const light = box(prop, 2.8, 4.45, 0.04, M.glow, fx, 2.23, -0.12);
      const pl = new THREE.PointLight(0xffe2a8, 10, 14, 1.3); pl.position.set(fx, 2.5, 1.5); prop.add(pl);
      animated.push((t) => { light.scale.setScalar(1 + Math.sin(t * 1.3) * 0.01); pl.intensity = 10 + Math.sin(t * 1.3) * 1.5; });
      prop.position.copy(f).add(new THREE.Vector3(0, -1.65, narrow ? -12 : -7.5));
      if (narrow) prop.scale.setScalar(0.72);
    } else {
      prop = PROPS[card.dataset.prop] ? PROPS[card.dataset.prop]() : PROPS.projet();
      prop.position.copy(f).add(narrow ? new THREE.Vector3(-side * 1.2, -1.65, -10.5) : new THREE.Vector3(-side * 2.7, -1.65, -9.2));
      prop.rotation.y = side * (narrow ? 0.6 : 0.45);
    }
    scene.add(prop);

    let year = null;
    if (card.dataset.year) {
      year = new CSS3DObject(el('div', 'year', card.dataset.year)); year.scale.setScalar(narrow ? 0.008 : 0.011);
      year.position.copy(f).add(narrow ? new THREE.Vector3(side * 2.2, 2.6, -19) : new THREE.Vector3(-side * 4.2, 1.6, -13.5));
      year.lookAt(f); cssScene.add(year);
    }
    if (i > 1) {
      const a = F[i - 1].clone().lerp(f, 0.42); const arch = new THREE.Group(); arch.position.set(a.x, 0, a.z);
      box(arch, 0.22, 3.7, 0.22, M.model, -1.7, 1.85, 0); box(arch, 0.22, 3.7, 0.22, M.model, 1.7, 1.85, 0); box(arch, 3.62, 0.22, 0.22, M.accent, 0, 3.7, 0);
      blob(arch, 0.5, -1.7); blob(arch, 0.5, 1.7);
      scene.add(arch);
    }
    const focus = narrow ? prop.position.clone().add(new THREE.Vector3(side * 0.35, end ? 2.2 : 1.0, 0)) : cPos;
    stations.push({ card, obj, year, pos: cPos, focus, s: OPEN + i * STEP });
  });

  // ----- Un chemin de dalles qui suit le trajet -----
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.03, 0.55), M.soft, 600);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3(), tg = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const pathLen = curve.getLength(); let nSlab = 0;
  for (let d = 9; d < pathLen && nSlab < 600; d += 0.95) {
    const uu = d / pathLen; curve.getPointAt(uu, pp); curve.getTangentAt(uu, tg);
    q.setFromAxisAngle(up, Math.atan2(tg.x, tg.z));
    m4.compose(pp.set(pp.x, 0.016, pp.z), q, sc); slabs.setMatrixAt(nSlab++, m4);
  }
  slabs.count = nSlab; scene.add(slabs);

  // ----- Poussière en suspension -----
  const dustN = narrow ? 260 : 520;
  const dg = new THREE.BufferGeometry(); const dp = new Float32Array(dustN * 3);
  for (let k = 0; k < dustN; k++) { dp[k * 3] = (rnd() - 0.5) * 18; dp[k * 3 + 1] = 0.3 + rnd() * 5; dp[k * 3 + 2] = 6 - rnd() * (N * SP + 12); }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: pal.olive, size: narrow ? 0.05 : 0.04, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);

  // ----- Navigation : la molette, le doigt ou le clavier font avancer la caméra (la page elle-même ne défile pas) -----
  const maxS = OPEN + N * STEP;
  let target = 0;
  const setT = (v) => { target = clamp(v, 0, maxS); };
  root.classList.add('immersive');
  addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;
    e.preventDefault();
    let d = e.deltaY; if (e.deltaMode === 1) d *= 40; else if (e.deltaMode === 2) d *= innerHeight;
    setT(target + clamp(d, -240, 240) / innerHeight * 0.9);
  }, { passive: false });
  let ty = null;
  addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (ty === null) return;
    e.preventDefault();
    const y = e.touches[0].clientY; setT(target + (ty - y) / innerHeight * 1.6); ty = y;
  }, { passive: false });
  addEventListener('touchend', () => { ty = null; });
  const now = $('#now'); const intro = $('#intro');

  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('a,button,input,textarea')) return;
    if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Home') { setT(0); return; }
    if (e.key === 'End') { setT(maxS); return; }
    const marks = [0, ...stations.map((x) => x.s)];
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    const next = down ? marks.find((m) => m > target + 0.05) : [...marks].reverse().find((m) => m < target - 0.05);
    if (next !== undefined) setT(next);
  });
  $('#restart').addEventListener('click', (e) => { e.preventDefault(); setT(0); });

  // Parallaxe à la souris
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  // Thème
  const isDark = () => root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  function applyPalette() {
    pal = palette();
    scene.background.copy(pal.bg); scene.fog.color.copy(pal.bg);
    M.model.color.copy(pal.model); M.accent.color.copy(pal.olive); M.soft.color.copy(pal.soft); M.ground.color.copy(pal.ground); M.glow.color.copy(pal.glow);
    line.color.copy(pal.olive); dust.material.color.copy(pal.olive); hemi.groundColor.copy(pal.ground);
    grid.material.color = pal.line.clone();
    hemi.intensity = isDark() ? 0.8 : 1.15; gl.toneMappingExposure = isDark() ? 1.2 : 1.05;
  }
  $('.bar__theme').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next; try { localStorage.setItem('theme', next); } catch (e) {}
    applyPalette();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPalette);
  applyPalette();

  addEventListener('resize', () => {
    if ((innerWidth < 760) !== narrow) { location.reload(); return; }
    camera.aspect = innerWidth / innerHeight; frameView(); camera.updateProjectionMatrix();
    gl.setSize(innerWidth, innerHeight); css.setSize(innerWidth, innerHeight);
  });

  // ----- Boucle -----
  let u = 0, open = 0, last = performance.now(), current = -2;
  const look = new THREE.Vector3(), ahead = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  const clock = new THREE.Clock();

  function frame(nowT) {
    const dt = Math.min(0.05, Math.max(0, (nowT - last) / 1000)); last = nowT;
    const t = clock.getElapsedTime();
    const k = 1 - Math.exp(-dt * 5.5);
    const s = target;
    open += (clamp(s / OPEN, 0, 1) - open) * k;
    u += (clamp((s - OPEN) / (N * STEP), 0, 1) - u) * k;

    hinge.rotation.y = open * 1.9;
    doorLight.intensity = open * 14;
    intro.style.opacity = clamp(1 - open * 1.8, 0, 1).toFixed(3);
    intro.style.visibility = open > 0.6 ? 'hidden' : 'visible';

    ptr.sx += (ptr.x - ptr.sx) * k; ptr.sy += (ptr.y - ptr.sy) * k;
    curve.getPoint(u, camera.position);
    camera.position.x += ptr.sx * 0.5; camera.position.y -= ptr.sy * 0.25;

    const uN = u * N;
    if (u + 0.3 / N <= 1) curve.getPoint(u + 0.3 / N, ahead); else ahead.copy(F[N]).add(tmp.set(0, 0, -6));
    ahead.y -= 0.08;
    const j = Math.round(uN);
    look.copy(ahead);
    if (j >= 1) { const w = clamp(1 - Math.abs(uN - j) * 1.6, 0, 1); look.lerp(stations[j - 1].focus, w * (narrow ? 0.7 : 0.5)); }
    camera.lookAt(look);
    camera.getWorldDirection(fwd);

    sun.position.copy(camera.position).add(tmp.set(6, 12, 8));
    sun.target.position.copy(camera.position).add(tmp.set(0, 0, -10));

    stations.forEach((st, idx) => {
      if (narrow) {
        st.card.classList.toggle('is-on', Math.abs(uN - (idx + 1)) < 0.32);
      } else {
        tmp.copy(st.pos).sub(camera.position);
        const along0 = tmp.dot(fwd), dist0 = tmp.length();
        const o = clamp((along0 - 0.6) / 1.4, 0, 1) * clamp(1 - (dist0 - 8) / 26, 0, 1);
        st.card.style.opacity = o.toFixed(3);
        st.card.style.visibility = o < 0.02 ? 'hidden' : 'visible';
        st.card.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
      }
      tmp.copy(st.year ? st.year.position : st.pos).sub(camera.position);
      const along = tmp.dot(fwd), dist = tmp.length();
      if (st.year) { const yo = clamp((along - 4) / 4, 0, 1) * clamp(1 - (dist - 16) / 30, 0, 1); st.year.element.style.opacity = (yo * 0.9).toFixed(3); }
    });

    const c = uN < 0.5 ? -1 : clamp(Math.round(uN) - 1, 0, N - 1);
    if (c !== current) {
      current = c;
      now.textContent = c < 0 ? 'Faites défiler pour ouvrir la porte' : (stations[c].card.dataset.rail + ' · ' + ($('h2', stations[c].card) || {}).textContent);
    }

    animated.forEach((fn) => fn(t));
    dust.position.y = Math.sin(t * 0.3) * 0.15;

    gl.render(scene, camera);
    css.render(cssScene, camera);
    if (root.classList.contains('loading')) root.classList.remove('loading');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((err) => { console.error(err); goFlat(); });
