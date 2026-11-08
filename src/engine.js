// room-from-photos by Stas Rise — движок 3D-комнаты (Three.js).
// Данные комнаты берутся из <script id="room-data" type="application/json">.
// Единицы в JSON — сантиметры. Внутри сцены — метры.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const CM = 0.01;
const T = 0.1; // толщина стен, м
const SNAP = 0.05;
const DATA = JSON.parse(document.getElementById('room-data').textContent);
const R = DATA.room;
const W = R.width * CM, D = R.depth * CM, H = (R.height || 260) * CM;
const WALL_NAMES = Object.assign({ N: 'дальняя стена', S: 'ближняя стена', W: 'левая стена', E: 'правая стена' }, DATA.wallNames || {});
const PALETTE = DATA.palette || [
  { name: 'Белый', hex: '#F1EEE8' }, { name: 'Шалфей', hex: '#A9B79A' }, { name: 'Графит', hex: '#4A4D52' },
  { name: 'Терракота', hex: '#C6754F' }, { name: 'Песочный', hex: '#D9C3A0' }, { name: 'Голубой', hex: '#A9C3D3' },
];

// ---------- сцена ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(app.clientWidth, app.clientHeight);
labelRenderer.domElement.className = 'labels';
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.18; }
if (/[?&]ui=0/.test(location.search)) document.body.classList.add('noui');
const camera = new THREE.PerspectiveCamera(38, app.clientWidth / app.clientHeight, 0.05, 200);
const center = new THREE.Vector3(W / 2, 0.6, D / 2);
const diag = Math.hypot(W, D);
const ASP = Math.min(1, app.clientWidth / app.clientHeight); const K = 1 / Math.pow(ASP, 0.75);
const CORNERS = [{ sx: 1, sz: 1, hides: ['S', 'E'] }, { sx: -1, sz: 1, hides: ['S', 'W'] }, { sx: 1, sz: -1, hides: ['N', 'E'] }, { sx: -1, sz: -1, hides: ['N', 'W'] }];
const opScore = (wall) => (DATA.openings || []).reduce((a, o) => a + (o.wall === wall ? (o.type === 'door' ? 2 : 1) : 0), 0);
const cScore = (c) => c.hides.reduce((a, w) => a + opScore(w), 0);
const corner = (DATA.camera && CORNERS.find((c) => c.hides.join('') === DATA.camera.hide)) || CORNERS[0]; // по умолчанию — как с фото от двери
const HOME = new THREE.Vector3(W / 2 + corner.sx * diag * 0.75 * K, diag * 0.95 * K + 1.2, corner.sz > 0 ? D + diag * 0.95 * K : -diag * 0.95 * K);
camera.position.copy(HOME).multiplyScalar(1.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(center);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 2;
controls.maxDistance = diag * 4;

scene.add(new THREE.HemisphereLight(0xfffaf2, 0x4a3d33, 0.9));
const sun = new THREE.DirectionalLight(0xfff6ea, 1.9);
sun.position.set(W * 0.75 + 2.5, 9, D * 0.85 + 3);
sun.target.position.copy(center);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -diag; sc.right = diag; sc.top = diag; sc.bottom = -diag; sc.near = 1; sc.far = 30;
sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const fill = new THREE.PointLight(0xffd6b0, 3, diag * 2.5, 2);
fill.position.set(W * 0.5, H * 0.9, D * 0.5);
scene.add(fill);

// ---------- материалы и текстуры ----------
const mat = (color, rough = 0.75, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
function plankTexture(base) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d'); const col = new THREE.Color(base);
  for (let row = 0; row < 8; row++) {
    for (let k = 0; k < 3; k++) {
      const shift = (row % 2) * 170 + k * 341 - 170;
      const v = 0.86 + Math.random() * 0.22;
      g.fillStyle = `rgb(${(col.r * 255 * v) | 0},${(col.g * 255 * v) | 0},${(col.b * 255 * v) | 0})`;
      g.fillRect(shift, row * 64, 341, 64);
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.strokeRect(shift, row * 64, 341, 64);
      for (let s = 0; s < 6; s++) { g.strokeStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`; g.beginPath(); const y = row * 64 + 6 + Math.random() * 52; g.moveTo(shift, y); g.bezierCurveTo(shift + 100, y + 3, shift + 220, y - 3, shift + 341, y); g.stroke(); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const floorCfg = DATA.floor || {};
const floorMat = floorCfg.type === 'plain' ? mat(floorCfg.color || '#bfa58a', 0.85) : new THREE.MeshStandardMaterial({ map: plankTexture(floorCfg.color || '#A88462'), roughness: 0.7 });
if (floorMat.map) floorMat.map.repeat.set(W / 1.8, D / 1.8);

// ---------- корень сцены ----------
const roomGroup = new THREE.Group();
scene.add(roomGroup);

const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * T, 0.06, D + 2 * T), floorMat);
floor.position.set(W / 2, -0.03, D / 2); floor.receiveShadow = true;
roomGroup.add(floor);
const base = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * T + 0.3, 0.12, D + 2 * T + 0.3), mat('#2a211b', 0.9));
base.position.set(W / 2, -0.12, D / 2); base.receiveShadow = true;
roomGroup.add(base);

// ---------- стены с проёмами ----------
const openings = (DATA.openings || []).map((o) => ({ ...o }));
const walls = {};
const wallColor = R.wallColor || (DATA.walls && DATA.walls.color) || '#F1EEE8';
function wallLen(id) { return id === 'N' || id === 'S' ? W : D; }
function buildWall(id) {
  const L = wallLen(id);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(L, 0); shape.lineTo(L, H); shape.lineTo(0, H); shape.lineTo(0, 0);
  openings.filter((o) => o.wall === id).forEach((o) => {
    const x0 = o.offset * CM, x1 = x0 + o.width * CM;
    const y0 = (o.type === 'door' ? 0.001 : (o.sill ?? 90) * CM), y1 = y0 + o.height * CM;
    const hole = new THREE.Path(); hole.moveTo(x0, y0); hole.lineTo(x0, y1); hole.lineTo(x1, y1); hole.lineTo(x1, y0); hole.lineTo(x0, y0);
    shape.holes.push(hole);
  });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  const m = mat(wallColor, 0.92);
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  if (id === 'N') g.position.set(0, 0, -T);
  if (id === 'S') { g.position.set(0, 0, D); }
  if (id === 'W') { g.rotation.y = -Math.PI / 2; g.position.set(0, 0, 0); }
  if (id === 'E') { g.rotation.y = -Math.PI / 2; g.position.set(W + T, 0, 0); }
  // плинтус-обрезка, видна когда стена спрятана
  const stub = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, T), mat(wallColor, 0.9));
  stub.position.set(L / 2, 0.04, T / 2); stub.visible = false; stub.castShadow = true; g.add(stub);
  // наличник у пола
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.015), mat('#e9e3da', 0.6));
  skirting.position.set(L / 2, 0.035, id === 'N' || id === 'E' ? T + 0.008 : -0.008);
  g.add(skirting);
  g.userData = { wallId: id, mesh, stub, skirting, mat: m };
  mesh.userData.wallId = id;
  roomGroup.add(g);
  walls[id] = g;
  openings.filter((o) => o.wall === id).forEach((o) => buildOpening(g, id, o));
}
function buildOpening(g, id, o) {
  const x0 = o.offset * CM, w = o.width * CM, h = o.height * CM;
  const y0 = o.type === 'door' ? 0 : (o.sill ?? 90) * CM;
  const inner = id === 'N' || id === 'E' ? T : 0; // сторона, смотрящая в комнату (в локальных z)
  const frameM = mat('#f4f1ec', 0.5);
  const parts = new THREE.Group();
  const bar = (bw, bh, bd, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), frameM); b.position.set(x, y, z); b.castShadow = true; parts.add(b); };
  const fz = T / 2;
  bar(0.05, h + 0.05, T + 0.02, x0 - 0.025, y0 + h / 2, fz);
  bar(0.05, h + 0.05, T + 0.02, x0 + w + 0.025, y0 + h / 2, fz);
  bar(w + 0.1, 0.05, T + 0.02, x0 + w / 2, y0 + h + 0.025, fz);
  if (o.type === 'window') {
    bar(w + 0.14, 0.04, T + 0.12, x0 + w / 2, y0 - 0.02, inner === 0 ? fz - 0.05 : fz + 0.05);
    bar(0.035, h, 0.05, x0 + w / 2, y0 + h / 2, fz);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.35 }));
    glass.position.set(x0 + w / 2, y0 + h / 2, fz); parts.add(glass);
    if (o.curtains !== false) {
      const cm = new THREE.MeshStandardMaterial({ color: o.curtainColor || '#E8DCCB', roughness: 1, side: THREE.DoubleSide });
      const top = Math.min(H - 0.06, y0 + h + 0.28), bot = Math.max(0.02, y0 - 0.55), ch = top - bot, pw = Math.min(0.55, w * 0.32);
      const zc = inner === 0 ? -0.07 : T + 0.07;
      for (const side of [-1, 1]) {
        const cx0 = side < 0 ? x0 - 0.12 : x0 + w + 0.12 - pw;
        for (let f = 0; f < 6; f++) { const fold = new THREE.Mesh(new THREE.CylinderGeometry(pw / 12 + 0.012, pw / 12 + 0.012, ch, 10, 1, true, 0, Math.PI), cm); fold.position.set(cx0 + (pw / 6) * (f + 0.5), bot + ch / 2, zc); fold.rotation.y = inner === 0 ? Math.PI : 0; fold.castShadow = true; parts.add(fold); }
      }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, w + 0.5, 10), mat('#3a3330', 0.4, 0.6)); rod.rotation.z = Math.PI / 2; rod.position.set(x0 + w / 2, top + 0.02, zc); parts.add(rod);
    }
    const wl = new THREE.PointLight('#ffe9cc', 1.4 * w * h, 4, 1.8); wl.position.set(x0 + w / 2, y0 + h * 0.6, inner === 0 ? -0.45 : T + 0.45); parts.add(wl);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ffe2bd' }));
    sky.position.set(x0 + w / 2, y0 + h / 2, inner === 0 ? T + 0.001 : -0.001);
    sky.rotation.y = inner === 0 ? Math.PI : 0; parts.add(sky);
  } else {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.04), mat(o.color || '#d9cdbd', 0.55));
    leaf.position.set(x0 + w / 2, h / 2, inner === 0 ? 0.03 : T - 0.03); leaf.castShadow = true; parts.add(leaf);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 12), mat('#8c8c8c', 0.3, 0.8));
    handle.rotation.z = Math.PI / 2; handle.position.set(x0 + w - 0.1, 1.0, inner === 0 ? -0.0 : T); parts.add(handle);
    // дуга открывания на полу
    const r = w; const pts = [];
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; pts.push(new THREE.Vector3(x0 + Math.cos(a) * r, 0.006, (inner === 0 ? -1 : 1) * Math.sin(a) * r + inner)); }
    const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#D97757', dashSize: 0.06, gapSize: 0.04 }));
    arc.computeLineDistances(); parts.add(arc);
  }
  g.add(parts);
}
['N', 'S', 'W', 'E'].forEach(buildWall);

// ---------- мебель ----------
function rbox(w, h, d, color, r = 0.02, rough = 0.75) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), mat(color, rough));
  m.castShadow = true; m.receiveShadow = true; return m;
}
function legs(g, w, d, h, color, inset = 0.04, r = 0.02) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 10), mat(color, 0.5)); l.castShadow = true;
    l.position.set(sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)); g.add(l);
  }
}
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const BUILDERS = {
  bed(g, w, d, h, c) {
    const fh = h * 0.45; const wood = c.frame || '#7a5a43';
    const frame = rbox(w, fh, d, wood, 0.02); frame.position.y = fh / 2 + 0.03; g.add(frame); legs(g, w, d, 0.04, '#3b2c22', 0.06);
    const mat1 = rbox(w - 0.04, h - fh, d - 0.04, '#f3f1ec', 0.05, 0.95); mat1.position.y = fh + (h - fh) / 2 + 0.03; g.add(mat1);
    const head = rbox(w + 0.02, h + 0.55, 0.08, wood, 0.03); head.position.set(0, (h + 0.55) / 2, -d / 2 + 0.04); g.add(head);
    const pillowN = w >= 1.2 ? 2 : 1;
    for (let i = 0; i < pillowN; i++) { const p = rbox(w / pillowN - 0.1, 0.12, 0.38, '#ffffff', 0.05, 1); p.position.set(pillowN === 1 ? 0 : (i ? 1 : -1) * w / 4, h + 0.09, -d / 2 + 0.3); p.rotation.x = -0.25; g.add(p); }
    const blanket = rbox(w + 0.02, 0.05, d * 0.62, c.color || '#c9b9a6', 0.025, 1); blanket.position.set(0, h + 0.05, d / 2 - d * 0.31 + 0.01); g.add(blanket);
  },
  sofa(g, w, d, h, c) {
    const col = c.color || '#8b8f97'; const seatH = Math.min(0.45, h * 0.55); const arm = Math.min(0.2, w * 0.1);
    const baseM = rbox(w, seatH * 0.55, d, shade(col, 0.85), 0.04); baseM.position.y = seatH * 0.275 + 0.06; g.add(baseM); legs(g, w, d, 0.06, '#2d241e', 0.08, 0.018);
    const back = rbox(w, h - 0.06, d * 0.24, col, 0.06); back.position.set(0, (h - 0.06) / 2 + 0.06, -d / 2 + d * 0.12); g.add(back);
    for (const s of [-1, 1]) { const a = rbox(arm, h * 0.68, d, col, 0.06); a.position.set(s * (w / 2 - arm / 2), h * 0.34 + 0.06, 0); g.add(a); }
    const n = w > 1.7 ? 3 : 2; const cw = (w - 2 * arm) / n;
    for (let i = 0; i < n; i++) { const cu = rbox(cw - 0.02, seatH * 0.4, d * 0.72, shade(col, 1.08), 0.06, 1); cu.position.set(-w / 2 + arm + cw * (i + 0.5), seatH * 0.55 + seatH * 0.2 + 0.06, d * 0.1); g.add(cu); }
  },
  armchair(g, w, d, h, c) { BUILDERS.sofa(g, w, d, h, c); },
  wardrobe(g, w, d, h, c) {
    const col = c.color || '#e9e4dc'; const b = rbox(w, h, d, col, 0.015, 0.6); b.position.y = h / 2; g.add(b);
    const n = Math.max(2, Math.round(w / 0.5));
    for (let i = 1; i < n; i++) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.006, h - 0.06, 0.004), mat(shade(col, 0.7))); line.position.set(-w / 2 + (w / n) * i, h / 2, d / 2 + 0.001); g.add(line); }
    for (let i = 0; i < n; i++) { const hd = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.02), mat('#8f8a84', 0.3, 0.7)); hd.position.set(-w / 2 + (w / n) * (i + 0.5) + (i % 2 ? -1 : 1) * (w / n) * 0.4, h * 0.52, d / 2 + 0.012); g.add(hd); }
  },
  dresser(g, w, d, h, c) {
    const col = c.color || '#d8c7b1'; const lg = c.elevation > 0 ? 0 : 0.08; const b = rbox(w, h - lg, d, col, 0.015, 0.55); b.position.y = (h - lg) / 2 + lg; g.add(b); if (lg) legs(g, w, d, lg, '#3b2c22', 0.05, 0.015);
    const rows = Math.max(1, Math.round((h - (c.elevation > 0 ? 0 : 0.08)) / 0.22));
    for (let i = 0; i < rows; i++) { const y = lg + ((h - lg) / rows) * (i + 0.5); const ln = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.005, 0.004), mat(shade(col, 0.7))); ln.position.set(0, lg + ((h - lg) / rows) * (i + 1) - 0.004, d / 2 + 0.001); if (i < rows - 1) g.add(ln); const k = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.18, w * 0.3), 0.015, 0.02), mat('#6f6a64', 0.3, 0.7)); k.position.set(0, y, d / 2 + 0.01); g.add(k); }
  },
  nightstand(g, w, d, h, c) { BUILDERS.dresser(g, w, d, h, c); },
  desk(g, w, d, h, c) {
    const col = c.color || '#cfae86'; const top = rbox(w, 0.035, d, col, 0.01, 0.5); top.position.y = h - 0.0175; g.add(top);
    legs(g, w, d, h - 0.035, c.legs || '#2b2b2b', 0.05, 0.018);
    if (c.kind === 'desk') { const lap = rbox(0.34, 0.015, 0.24, '#bfc3c8', 0.005, 0.3); lap.position.set(w * 0.1, h + 0.008, 0); g.add(lap); const scr = rbox(0.34, 0.22, 0.012, '#1d1f22', 0.005, 0.3); scr.position.set(w * 0.1, h + 0.11, -0.12); scr.rotation.x = -0.2; g.add(scr); }
  },
  table(g, w, d, h, c) { BUILDERS.desk(g, w, d, h, c); },
  chair(g, w, d, h, c) {
    const col = c.color || '#6b5444'; const sh = Math.min(0.46, h * 0.52);
    const seat = rbox(w, 0.04, d, col, 0.015); seat.position.y = sh; g.add(seat); legs(g, w, d, sh - 0.02, '#2b2b2b', 0.03, 0.013);
    const back = rbox(w, h - sh, 0.03, col, 0.015); back.position.set(0, sh + (h - sh) / 2, -d / 2 + 0.015); g.add(back);
  },
  tv(g, w, d, h, c) {
    const onWall = c.elevation > 0; const standH = onWall ? -0.06 : Math.max(0.35, h - (w * 0.56)); if (!onWall) { const st = rbox(w, standH, d, c.color || '#3a3a3a', 0.015, 0.5); st.position.y = standH / 2; g.add(st); }
    const sw = w * 0.85; const sh = sw * 0.56; const scr = rbox(sw, sh, 0.04, '#111214', 0.008, 0.25); scr.position.set(0, standH + sh / 2 + 0.06, 0); g.add(scr);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(sw * 0.96, sh * 0.92), new THREE.MeshBasicMaterial({ color: '#2b3a52' })); glow.position.set(0, standH + sh / 2 + 0.06, 0.021); g.add(glow);
  },
  shelf(g, w, d, h, c) {
    const col = c.color || '#d6c3a5'; const t = 0.022;
    for (const s of [-1, 1]) { const side = rbox(t, h, d, col, 0.005); side.position.set(s * (w / 2 - t / 2), h / 2, 0); g.add(side); }
    const n = Math.max(2, Math.round(h / 0.36));
    for (let i = 0; i <= n; i++) { const y = i === 0 ? t / 2 : (h / n) * i - t / 2; const sh = rbox(w, t, d, col, 0.005); sh.position.set(0, y, 0); g.add(sh);
      if (i < n) { let x = -w / 2 + t + 0.02; const books = ['#c6754f', '#3f5b73', '#e2cf9e', '#6c7f5d', '#8a4b3d', '#d9d4cc']; while (x < w / 2 - t - 0.06) { const bw = 0.025 + Math.random() * 0.03, bh = (h / n) * (0.55 + Math.random() * 0.3); if (Math.random() < 0.15) { x += 0.08; continue; } const b = rbox(bw, bh, d * 0.75, books[(Math.random() * books.length) | 0], 0.003, 0.8); b.position.set(x + bw / 2, y + t / 2 + bh / 2, 0.01); g.add(b); x += bw + 0.004; } } }
  },
  plant(g, w, d, h, c) {
    const potH = Math.min(0.4, h * 0.3); const pot = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.33, w * 0.26, potH, 24), mat(c.color || '#c9b8a3', 0.8)); pot.position.y = potH / 2; pot.castShadow = true; g.add(pot);
    const leafM = mat('#5f7f4f', 0.85); const n = 9;
    for (let i = 0; i < n; i++) { const r = w * (0.22 + Math.random() * 0.18); const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafM); const a = (i / n) * Math.PI * 2; l.position.set(Math.cos(a) * w * 0.18, potH + (h - potH) * (0.35 + Math.random() * 0.5), Math.sin(a) * d * 0.18); l.castShadow = true; g.add(l); }
  },
  rug(g, w, d, h, c) {
    const r = rbox(w, 0.012, d, c.color || '#d8c5ad', 0.006, 1); r.position.y = 0.006; r.castShadow = false; g.add(r);
    const border = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.013, d - 0.12), mat(shade(c.color || '#d8c5ad', 0.85), 1)); border.position.y = 0.0065; g.add(border);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.0135, d - 0.2), mat(c.color || '#d8c5ad', 1)); inner.position.y = 0.0068; g.add(inner);
  },
  lamp(g, w, d, h, c) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.4, w * 0.45, 0.03, 24), mat('#2b2b2b', 0.4, 0.5)); b.position.y = 0.015; g.add(b);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.3, 10), mat('#2b2b2b', 0.4, 0.5)); pole.position.y = (h - 0.3) / 2; g.add(pole);
    const shadeM = new THREE.MeshStandardMaterial({ color: '#f6e7cf', emissive: '#ffcf8a', emissiveIntensity: 0.6, roughness: 0.9, side: THREE.DoubleSide });
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.5, 0.3, 24, 1, true), shadeM); sh.position.y = h - 0.15; g.add(sh);
    const pl = new THREE.PointLight('#ffcf8a', 1.2, 3, 2); pl.position.y = h - 0.2; g.add(pl);
  },
  box(g, w, d, h, c) { const b = rbox(w, h, d, c.color || '#cdbfae', 0.02); b.position.y = h / 2; g.add(b); },
};
BUILDERS.kitchen = (g, w, d, h, c) => {
  const col = c.color || '#e8e4dd'; const plinth = 0.1; const body = rbox(w, h - plinth - 0.04, d - 0.03, col, 0.01, 0.5); body.position.set(0, plinth + (h - plinth - 0.04) / 2, -0.015); g.add(body);
  const pl = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, plinth, d - 0.08), mat('#2b2b2b', 0.8)); pl.position.set(0, plinth / 2, -0.04); g.add(pl);
  const top = rbox(w, 0.04, d, c.top || '#3d3a37', 0.008, 0.35); top.position.y = h - 0.02; g.add(top);
  const n = Math.max(1, Math.round(w / 0.6)); for (let i = 1; i < n; i++) { const ln = new THREE.Mesh(new THREE.BoxGeometry(0.005, h - plinth - 0.08, 0.004), mat(shade(col, 0.75))); ln.position.set(-w / 2 + (w / n) * i, plinth + (h - plinth) / 2 - 0.02, d / 2 - 0.029); g.add(ln); }
  for (let i = 0; i < n; i++) { const hd = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.02), mat('#9a9a9a', 0.3, 0.8)); hd.position.set(-w / 2 + (w / n) * (i + 0.5), h - 0.12, d / 2 - 0.02); g.add(hd); }
  if (w >= 1.2) { const sink = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.4), mat('#b9bec3', 0.25, 0.9)); sink.position.set(-w / 2 + 0.45, h + 0.001, 0); g.add(sink); const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 10), mat('#c9ccd0', 0.2, 0.9)); tap.position.set(-w / 2 + 0.45, h + 0.12, -d / 2 + 0.08); g.add(tap); }
  if (w >= 1.8) { const hob = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.008, 0.5), mat('#111', 0.2)); hob.position.set(w / 2 - 0.5, h + 0.004, 0); g.add(hob); for (const [ox, oz] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 6, 24), mat('#555', 0.4)); r.rotation.x = Math.PI / 2; r.position.set(w / 2 - 0.5 + ox, h + 0.01, oz); g.add(r); } }
};
BUILDERS.fridge = (g, w, d, h, c) => { const col = c.color || '#e9ebee'; const b = rbox(w, h, d, col, 0.04, 0.3); b.position.y = h / 2; g.add(b); const ln = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.006, 0.004), mat(shade(col, 0.7))); ln.position.set(0, h * 0.62, d / 2 + 0.001); g.add(ln); for (const y of [h * 0.45, h * 0.8]) { const hd = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.03), mat('#a7abb0', 0.3, 0.8)); hd.position.set(w / 2 - 0.08, y, d / 2 + 0.02); g.add(hd); } };
BUILDERS.radiator = (g, w, d, h, c) => { const n = Math.max(4, Math.round(w / 0.08)); for (let i = 0; i < n; i++) { const f = rbox(w / n - 0.012, h, d, c.color || '#f2f2f2', 0.012, 0.4); f.position.set(-w / 2 + (w / n) * (i + 0.5), h / 2 + 0.12, 0); g.add(f); } };
BUILDERS.mirror = (g, w, d, h, c) => { const fr = rbox(w, h, Math.max(d, 0.03), c.color || '#2b2b2b', 0.01, 0.4); fr.position.y = h / 2; g.add(fr); const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshStandardMaterial({ color: '#dfe8ee', roughness: 0.02, metalness: 1 })); m.position.set(0, h / 2, Math.max(d, 0.03) / 2 + 0.002); g.add(m); };
BUILDERS.art = (g, w, d, h, c) => {
  const fr = rbox(w, h, Math.max(d, 0.03), c.frame || '#2b2420', 0.006, 0.5); fr.position.y = h / 2; g.add(fr);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d');
  const pal = c.palette || ['#F1E6D8', '#D97757', '#A9B79A', '#3E4A57', '#E8C07D'];
  x.fillStyle = pal[0]; x.fillRect(0, 0, 256, 256);
  x.fillStyle = pal[1]; x.beginPath(); x.arc(170, 110, 60, 0, Math.PI * 2); x.fill();
  x.fillStyle = pal[2]; x.fillRect(30, 140, 150, 90);
  x.fillStyle = pal[3]; x.beginPath(); x.moveTo(20, 230); x.quadraticCurveTo(128, 150, 236, 230); x.fill();
  x.fillStyle = pal[4]; x.fillRect(60, 40, 40, 40);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, h - 0.08), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); pic.position.set(0, h / 2, Math.max(d, 0.03) / 2 + 0.002); g.add(pic);
};
BUILDERS.cabinet = BUILDERS.dresser; BUILDERS.bookcase = BUILDERS.shelf; BUILDERS.other = BUILDERS.box;

const items = new Map();
function footprint(it, x = it.x, z = it.z, rot = it.rot) {
  const swap = ((Math.round(rot / 90) % 2) + 2) % 2 === 1;
  const fw = (swap ? it.d : it.w) * CM, fd = (swap ? it.w : it.d) * CM;
  return { x0: x * CM - fw / 2, x1: x * CM + fw / 2, z0: z * CM - fd / 2, z1: z * CM + fd / 2, fw, fd };
}
function makeItem(spec) {
  const it = { kind: 'box', rot: 0, confidence: 'medium', collide: true, ...spec };
  it.rot = ((Math.round((it.rot || 0) / 90) * 90) % 360 + 360) % 360;
  if (it.kind === 'rug' || it.elevation > 0) it.collide = spec.collide ?? false;
  if (spec.fixed === undefined) it.fixed = it.kind === 'radiator' || it.kind === 'kitchen' || it.kind === 'art' || it.elevation > 0;
  const g = new THREE.Group();
  const inner = new THREE.Group();
  (BUILDERS[it.kind] || BUILDERS.box)(inner, it.w * CM, it.d * CM, it.h * CM, it);
  g.add(inner);
  g.position.set(it.x * CM, (it.elevation || 0) * CM, it.z * CM);
  g.rotation.y = -THREE.MathUtils.degToRad(it.rot);
  g.traverse((o) => { if (o.isMesh) o.userData.itemId = it.id; });
  it.group = g; it.inner = inner; it.target = { x: it.x, z: it.z, rot: it.rot };
  // подпись
  const el = document.createElement('div'); el.className = 'tag';
  const lbl = new CSS2DObject(el); lbl.position.set(0, it.h * CM + 0.25, 0); g.add(lbl);
  it.tagEl = el; it.tag = lbl; lbl.visible = false;
  roomGroup.add(g); items.set(it.id, it);
  return it;
}
(DATA.items || []).forEach((s) => { const it = makeItem(s); const c = clampToRoom(it, it.x, it.z, it.rot); it.x = it.target.x = c.x; it.z = it.target.z = c.z; it.group.position.x = c.x * CM; it.group.position.z = c.z * CM; });

// ---------- столкновения ----------
function overlaps(a, b, gap = 0) { return a.x0 < b.x1 - gap && a.x1 > b.x0 + gap && a.z0 < b.z1 - gap && a.z1 > b.z0 + gap; }
function inRoom(f) { return f.x0 >= -0.001 && f.z0 >= -0.001 && f.x1 <= W + 0.001 && f.z1 <= D + 0.001; }
function blockedBy(it, f, ignore) {
  for (const o of items.values()) { if (o === it || o.removed || (ignore && ignore.has(o))) continue; if (!o.collide && !(o.elevation > 0 && it.h > o.elevation && o.kind !== 'rug')) continue; if (overlaps(f, footprint(o, o.target.x, o.target.z, o.target.rot), 0.001)) return o; }
  return null;
}
function doorZones() {
  return openings.filter((o) => o.type === 'door').map((o) => {
    const a = o.offset * CM, b = a + o.width * CM, r = o.width * CM;
    if (o.wall === 'N') return { x0: a, x1: b, z0: 0, z1: r };
    if (o.wall === 'S') return { x0: a, x1: b, z0: D - r, z1: D };
    if (o.wall === 'W') return { x0: 0, x1: r, z0: a, z1: b };
    return { x0: W - r, x1: W, z0: a, z1: b };
  });
}

// ---------- размерные линии ----------
const dimGroup = new THREE.Group(); roomGroup.add(dimGroup);
const dimMat = new THREE.LineDashedMaterial({ color: '#D97757', dashSize: 0.05, gapSize: 0.03 });
function clearDims() { while (dimGroup.children.length) { const c = dimGroup.children.pop(); c.traverse((o) => { if (o.element) o.element.remove(); }); } }
function dimLine(ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az); if (len < 0.02) return;
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, 0.02, az), new THREE.Vector3(bx, 0.02, bz)]), dimMat);
  l.computeLineDistances(); dimGroup.add(l);
  const el = document.createElement('div'); el.className = 'dim'; el.textContent = Math.round(len * 100) + ' см';
  const o = new CSS2DObject(el); o.position.set((ax + bx) / 2, 0.03, (az + bz) / 2); dimGroup.add(o);
}
function showDims(it) {
  clearDims(); if (!it) return;
  const f = footprint(it, it.target.x, it.target.z, it.target.rot);
  const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
  // до ближайших препятствий по 4 сторонам
  const others = [...items.values()].filter((o) => o !== it && o.collide && !o.removed).map((o) => footprint(o, o.target.x, o.target.z, o.target.rot));
  let left = 0, right = W, back = 0, front = D;
  for (const o of others) {
    if (o.z0 < f.z1 && o.z1 > f.z0) { if (o.x1 <= f.x0 + 0.001) left = Math.max(left, o.x1); if (o.x0 >= f.x1 - 0.001) right = Math.min(right, o.x0); }
    if (o.x0 < f.x1 && o.x1 > f.x0) { if (o.z1 <= f.z0 + 0.001) back = Math.max(back, o.z1); if (o.z0 >= f.z1 - 0.001) front = Math.min(front, o.z0); }
  }
  dimLine(left, cz, f.x0, cz); dimLine(f.x1, cz, right, cz); dimLine(cx, back, cx, f.z0); dimLine(cx, f.z1, cx, front);
}

// ---------- выбор и перетаскивание ----------
let selected = null;
const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: '#D97757', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; ring.visible = false; roomGroup.add(ring);
function select(it) {
  if (selected && selected !== it) { selected.tag.visible = false; setGlow(selected, 0); }
  selected = it;
  if (it) {
    it.tagEl.replaceChildren(Object.assign(document.createElement('b'), { textContent: it.label }), Object.assign(document.createElement('span'), { textContent: `${it.w}×${it.d}×${it.h} см` }));
    it.tag.visible = true; setGlow(it, 0.18);
  }
  ring.visible = !!it && !it.fixed; showDims(it); ui.onSelect && ui.onSelect(it);
}
function setGlow(it, k, color = '#D97757') {
  it.group.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) { if (!o.userData.baseEm) o.userData.baseEm = o.material.emissive.clone(); o.material.emissive.copy(k ? new THREE.Color(color).multiplyScalar(k) : o.userData.baseEm); } });
}
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null;
function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
renderer.domElement.addEventListener('pointerdown', (ev) => {
  pick(ev);
  const meshes = []; items.forEach((it) => { if (!it.removed) it.group.traverse((o) => o.isMesh && meshes.push(o)); });
  Object.values(walls).forEach((w) => w.userData.mesh.visible && meshes.push(w.userData.mesh));
  const hit = ray.intersectObjects(meshes, false)[0];
  if (hit && hit.object.userData.itemId) {
    const it = items.get(hit.object.userData.itemId); select(it);
    if (it.fixed) { ui.toast(`${it.label} закреплён — не двигается`); return; }
    const p = new THREE.Vector3(); ray.ray.intersectPlane(floorPlane, p);
    drag = { it, dx: it.target.x * CM - p.x, dz: it.target.z * CM - p.z, id: ev.pointerId };
    controls.enabled = false; renderer.domElement.setPointerCapture(ev.pointerId);
  } else if (hit && hit.object.userData.wallId && ui.wallMode === 'one') {
    ui.pickWall(hit.object.userData.wallId);
  } else if (!hit) select(null);
});
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (!drag) return; pick(ev);
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(floorPlane, p)) return;
  tryMove(drag.it, (p.x + drag.dx) / CM, (p.z + drag.dz) / CM);
});
let hoverT = 0;
renderer.domElement.addEventListener('pointermove', (ev) => { if (drag || ev.pointerType !== 'mouse' || performance.now() - hoverT < 60) return; hoverT = performance.now(); pick(ev); const meshes = []; items.forEach((it) => { if (!it.removed && !it.fixed) it.group.traverse((o) => o.isMesh && meshes.push(o)); }); renderer.domElement.style.cursor = ray.intersectObjects(meshes, false).length ? 'grab' : ''; });
const endDrag = () => { if (drag) { controls.enabled = true; drag = null; renderer.domElement.style.cursor = ''; } };
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);

function clampToRoom(it, x, z, rot) {
  const f = footprint(it, x, z, rot); const hw = (f.x1 - f.x0) / 2 / CM, hd = (f.z1 - f.z0) / 2 / CM;
  return { x: Math.min(Math.max(x, hw), R.width - hw), z: Math.min(Math.max(z, hd), R.depth - hd) };
}
function tryMove(it, x, z, rot = it.target.rot) {
  x = Math.round(x / (SNAP / CM)) * (SNAP / CM); z = Math.round(z / (SNAP / CM)) * (SNAP / CM);
  const c = clampToRoom(it, x, z, rot);
  const f = footprint(it, c.x, c.z, rot);
  const cur = footprint(it, it.target.x, it.target.z, it.target.rot); const already = new Set([...items.values()].filter((o) => o !== it && o.collide && !o.removed && overlaps(cur, footprint(o, o.target.x, o.target.z, o.target.rot), 0.001)));
  const b = it.collide ? blockedBy(it, f, already) : null;
  if (b) { flash(it); return false; }
  it.target.x = c.x; it.target.z = c.z; it.target.rot = rot; showDims(it); warnDoor(it); return true;
}
function warnDoor(it) {
  const f = footprint(it, it.target.x, it.target.z, it.target.rot);
  const hit = it.collide && doorZones().some((z) => overlaps(f, z));
  ui.toast && hit && ui.toast(`${it.label} мешает открывать дверь`);
}
let flashT = 0;
function flash(it) { setGlow(it, 0.5, '#ff3b30'); clearTimeout(flashT); flashT = setTimeout(() => setGlow(it, selected === it ? 0.18 : 0), 220); }
function rotateSelected() {
  if (!selected) return; if (selected.fixed) { ui.toast(`${selected.label} закреплён`); return; } const it = selected; const nr = (it.target.rot + 90) % 360;
  const c = clampToRoom(it, it.target.x, it.target.z, nr);
  if (!tryMove(it, c.x, c.z, nr)) ui.toast && ui.toast('Не помещается при повороте');
}
addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'к') rotateSelected(); if (e.key === 'Escape') select(null); });

// ---------- цвет стен ----------
const wallTargets = {};
Object.keys(walls).forEach((k) => { wallTargets[k] = { from: new THREE.Color(wallColor), to: new THREE.Color(wallColor), t0: 0, dur: 1 }; });
function paintWalls(hex, ids = Object.keys(walls), wave = true) {
  const now = performance.now(); const order = ['W', 'N', 'E', 'S'];
  ids.forEach((id) => {
    const w = walls[id]; const wt = wallTargets[id];
    wt.from = w.userData.mat.color.clone(); wt.to = new THREE.Color(hex); wt.t0 = now + (wave ? order.indexOf(id) * 140 : 0); wt.dur = 650;
  });
}

// ---------- планировки ----------
function applyLayout(i) {
  const L = (DATA.layouts || [])[i]; if (!L) return;
  [...items.values()].filter((o) => o.fit).forEach((o) => removeItem(o.id));
  items.forEach((o) => { if (o.hiddenFor) { o.hiddenFor = false; o.group.visible = true; o.collide = o._collide; } });
  let k = 0;
  const base = Object.fromEntries((DATA.items || []).map((s) => [s.id, s]));
  for (const it of items.values()) {
    if (it.fit || it.removed) continue;
    const id = it.id; const p = (L.items || {})[id] || base[id] || {};
    it.tween = { from: { x: it.target.x, z: it.target.z, rot: it.target.rot }, to: { x: p.x ?? it.target.x, z: p.z ?? it.target.z, rot: p.rot ?? it.target.rot }, t0: performance.now() + k * 70, dur: 850 };
    k++;
  }
  select(null);
}

// ---------- проверка «влезет ли» ----------
function windowZones(hItem) {
  return openings.filter((o) => o.type === 'window' && hItem > (o.sill ?? 90)).map((o) => {
    const a = o.offset * CM, b = a + o.width * CM, r = 0.3;
    if (o.wall === 'N') return { x0: a, x1: b, z0: 0, z1: r };
    if (o.wall === 'S') return { x0: a, x1: b, z0: D - r, z1: D };
    if (o.wall === 'W') return { x0: 0, x1: r, z0: a, z1: b };
    return { x0: W - r, x1: W, z0: a, z1: b };
  });
}
function fitCheck({ label = 'Новый предмет', kind = 'sofa', w, d, h = 85, replace = '' }) {
  if (!(w > 0 && d > 0 && h > 0) || w > 2000 || d > 2000) return { fits: false, text: 'Введи ширину, глубину и высоту в сантиметрах (больше нуля)' };
  const old = [...items.values()].find((o) => o.fit); if (old) removeItem(old.id);
  items.forEach((o) => { if (o.hiddenFor) { o.hiddenFor = false; o.group.visible = true; o.collide = o._collide; } });
  const rep = replace && items.get(replace);
  if (rep) {
    rep._collide = rep.collide; rep.collide = false; rep.hiddenFor = true; rep.group.visible = false;
    const r = rep.target.rot; const of = footprint(rep, rep.target.x, rep.target.z, r);
    const fwN = r % 180 === 90 ? d : w, fdN = r % 180 === 90 ? w : d;
    let x = rep.target.x, z = rep.target.z;
    if (r === 0) z = of.z0 / CM + fdN / 2; else if (r === 180) z = of.z1 / CM - fdN / 2; else if (r === 90) x = of.x1 / CM - fwN / 2; else x = of.x0 / CM + fwN / 2;
    const tmp2 = { w, d, h, collide: true, target: { x, z, rot: r } }; const f2 = footprint(tmp2, x, z, r);
    if (inRoom(f2) && !blockedBy(tmp2, f2) && !doorZones().some((q) => overlaps(f2, q))) {
      const it = makeItem({ id: 'fit-' + Date.now(), label, kind, w, d, h, x, z, rot: r, confidence: 'high', fit: true, color: '#D97757' });
      it.group.position.y = 1.2; it.drop = performance.now(); select(it);
      const g = Math.round(clearance(it, f2, r === 0 ? 'N' : r === 180 ? 'S' : r === 90 ? 'E' : 'W'));
      return { fits: true, gap: g, text: `Влезает вместо «${rep.label}» — запас ${g} см` };
    }
    rep.hiddenFor = false; rep.group.visible = true; rep.collide = rep._collide;
  }
  const spec = { id: 'fit-' + Date.now(), label, kind, w, d, h, x: R.width / 2, z: R.depth / 2, rot: 0, confidence: 'high', fit: true, color: '#D97757' };
  const tmp = { ...spec, collide: true, target: {} };
  const dz = doorZones().concat(windowZones(h));
  let best = null; const walls4 = ['N', 'W', 'E', 'S'];
  for (const wid of walls4) {
    const rot = wid === 'N' ? 0 : wid === 'S' ? 180 : wid === 'E' ? 90 : 270;
    const swap = rot % 180 === 90; const fw = swap ? d : w, fd = swap ? w : d;
    const along = wid === 'N' || wid === 'S' ? R.width : R.depth;
    for (let s = (wid === 'N' || wid === 'S' ? fw : fd) / 2; s <= along - (wid === 'N' || wid === 'S' ? fw : fd) / 2 + 0.01; s += 1) {
      let x, z;
      if (wid === 'N') { x = s; z = fd / 2; } else if (wid === 'S') { x = s; z = R.depth - fd / 2; } else if (wid === 'W') { x = fw / 2; z = s; } else { x = R.width - fw / 2; z = s; }
      tmp.target = { x, z, rot }; tmp.x = x; tmp.z = z; tmp.rot = rot;
      const f = footprint(tmp, x, z, rot);
      if (!inRoom(f) || blockedBy(tmp, f) || dz.some((q) => overlaps(f, q))) continue;
      // зазор до соседей вдоль стены
      const gap = clearance(tmp, f, wid);
      if (!best || gap > best.gap) best = { wid, x, z, rot, gap };
    }
  }
  if (best) {
    const it = makeItem({ ...spec, x: best.x, z: best.z, rot: best.rot });
    it.group.position.y = 1.2; it.drop = performance.now();
    select(it);
    return { fits: true, wall: WALL_NAMES[best.wid], gap: Math.round(best.gap), text: (rep ? `На место «${rep.label}» не встаёт, но в` : 'В') + `лезает у стены «${WALL_NAMES[best.wid]}», запас ${Math.round(best.gap)} см` };
  }
  // не влезает: самый длинный свободный отрезок у стен
  let maxRun = 0, runWall = 'N';
  for (const wid of walls4) { const r = freeRun(wid, d, h); if (r > maxRun) { maxRun = r; runWall = wid; } }
  const short = Math.max(1, Math.round(w - maxRun));
  return { fits: false, short, text: `Не влезает: у стены «${WALL_NAMES[runWall]}» свободно ${Math.round(maxRun)} см, не хватает ${short} см` };
}
function clearance(it, f, wid) {
  const others = [...items.values()].filter((o) => o.collide && !o.removed && !o.fit).map((o) => footprint(o, o.target.x, o.target.z, o.target.rot));
  let lo, hi;
  if (wid === 'N' || wid === 'S') { lo = f.x0; hi = W - f.x1; for (const o of others) if (o.z0 < f.z1 && o.z1 > f.z0) { if (o.x1 <= f.x0) lo = Math.min(lo, f.x0 - o.x1); if (o.x0 >= f.x1) hi = Math.min(hi, o.x0 - f.x1); } }
  else { lo = f.z0; hi = D - f.z1; for (const o of others) if (o.x0 < f.x1 && o.x1 > f.x0) { if (o.z1 <= f.z0) lo = Math.min(lo, f.z0 - o.z1); if (o.z0 >= f.z1) hi = Math.min(hi, o.z0 - f.z1); } }
  return Math.min(lo, hi) / CM + Math.max(lo, hi) / CM * 0; // минимальный зазор, см
}
function freeRun(wid, depthCm, hCm = 85) {
  const along = wid === 'N' || wid === 'S' ? R.width : R.depth; const blocked = new Array(Math.ceil(along)).fill(false);
  const dd = depthCm * CM;
  const strip = wid === 'N' ? { x0: 0, x1: W, z0: 0, z1: dd } : wid === 'S' ? { x0: 0, x1: W, z0: D - dd, z1: D } : wid === 'W' ? { x0: 0, x1: dd, z0: 0, z1: D } : { x0: W - dd, x1: W, z0: 0, z1: D };
  const obs = [...items.values()].filter((o) => !o.removed && !o.fit && (o.collide || (o.elevation > 0 && hCm > o.elevation && o.kind !== 'rug'))).map((o) => footprint(o, o.target.x, o.target.z, o.target.rot)).concat(doorZones(), windowZones(hCm));
  for (const o of obs) { if (!overlaps(strip, o)) continue; const a = (wid === 'N' || wid === 'S' ? o.x0 : o.z0) / CM, b = (wid === 'N' || wid === 'S' ? o.x1 : o.z1) / CM; for (let i = Math.max(0, Math.floor(a)); i < Math.min(along, Math.ceil(b)); i++) blocked[i] = true; }
  let best = 0, cur = 0; for (const b of blocked) { cur = b ? 0 : cur + 1; best = Math.max(best, cur); } return best;
}
function removeItem(id) { const it = items.get(id); if (!it) return; it.removed = true; it.tagEl.remove(); roomGroup.remove(it.group); items.delete(id); if (selected === it) select(null); }

// ---------- камера ----------
let camTween = null; let topView = false;
function flyTo(pos, target, dur = 1100) { camTween = { p0: camera.position.clone(), p1: pos.clone(), t0: performance.now(), dur, c0: controls.target.clone(), c1: target.clone() }; }
const planDims = new THREE.Group(); planDims.visible = false; roomGroup.add(planDims);
{ const mk = (txt, x, z) => { const e = document.createElement('div'); e.className = 'dim big'; e.textContent = txt; const o = new CSS2DObject(e); o.position.set(x, 0.05, z); planDims.add(o); }; mk(R.width + ' см', W / 2, -T - 0.25); mk(R.depth + ' см', -T - 0.35, D / 2); }
function toggleTop(on = !topView) {
  topView = on; planDims.visible = on; camera.fov = on ? 24 : 38; camera.updateProjectionMatrix();
  if (on) { controls.maxPolarAngle = Math.PI * 0.47; flyTo(new THREE.Vector3(W / 2, diag * 2.9 * K + 1, D / 2 + 0.01), new THREE.Vector3(W / 2, 0, D / 2)); }
  else flyTo(HOME, center);
  return topView;
}

// ---------- интро: стены растут, мебель падает ----------
let introT0 = performance.now(); const t0 = introT0; const INTRO = !/[?&]intro=0/.test(location.search);
Object.values(walls).forEach((w) => { w.scale.y = INTRO ? 0.001 : 1; w.userData.grown = !INTRO; });
let k = 0; items.forEach((it) => { it.drop = INTRO ? t0 + 900 + k * 110 : 0; if (INTRO) it.group.position.y = 1.4; k++; });
if (INTRO) flyTo(HOME, center, 2200); else camera.position.copy(HOME);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
let autoRotate = /[?&]spin=1/.test(location.search);

// ---------- цикл ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(); const dt = Math.min(clock.getDelta(), 0.05);
  // интро стен
  Object.values(walls).forEach((w, i) => { if (w.userData.grown) return; const t = Math.min(Math.max((now - introT0 - i * 160) / 1200, 0), 1); w.scale.y = Math.max(0.001, 1 - Math.pow(1 - t, 3)); if (t >= 1) { w.scale.y = 1; w.userData.grown = true; } });
  // камера
  if (camTween) { const t = Math.min((now - camTween.t0) / camTween.dur, 1), e = ease(t); camera.position.lerpVectors(camTween.p0, camTween.p1, e); controls.target.lerpVectors(camTween.c0, camTween.c1, e); if (t >= 1) camTween = null; }
  if (autoRotate && !camTween && !drag) { const a = dt * 0.12; const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); camera.position.copy(controls.target).add(off); }
  // мебель: падение, твины, плавное следование
  items.forEach((it) => {
    if (it.tween) { const t = Math.min(Math.max((now - it.tween.t0) / it.tween.dur, 0), 1), e = ease(t); it.target.x = it.tween.from.x + (it.tween.to.x - it.tween.from.x) * e; it.target.z = it.tween.from.z + (it.tween.to.z - it.tween.from.z) * e; let dr = it.tween.to.rot - it.tween.from.rot; if (dr > 180) dr -= 360; if (dr < -180) dr += 360; it.target.rot = it.tween.from.rot + dr * e; if (t >= 1) { it.target.rot = ((Math.round(it.tween.to.rot / 90) * 90) % 360 + 360) % 360; it.tween = null; } }
    const g = it.group; const k2 = 1 - Math.pow(0.0005, dt);
    g.position.x += (it.target.x * CM - g.position.x) * k2; g.position.z += (it.target.z * CM - g.position.z) * k2;
    const tr = -THREE.MathUtils.degToRad(it.target.rot); let d = tr - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * k2;
    const baseY = (it.elevation || 0) * CM;
    if (it.drop) { const t = Math.min(Math.max((now - it.drop) / 650, 0), 1); g.position.y = baseY + (1 - easeOutBounce(t)) * 1.4; if (t >= 1) { it.drop = 0; g.position.y = baseY; } }
    else g.position.y = baseY + (drag && drag.it === it ? 0.04 : 0) * 1;
  });
  if (selected && ring.visible) { const g = selected.group; ring.position.x = g.position.x; ring.position.z = g.position.z; const r = Math.hypot(selected.w, selected.d) * CM / 2 + 0.12; ring.scale.setScalar(r * (1 + Math.sin(now / 260) * 0.03)); }
  // стены: цвет
  Object.entries(walls).forEach(([id, w]) => { const wt = wallTargets[id]; const t = Math.min(Math.max((now - wt.t0) / wt.dur, 0), 1); w.userData.mat.color.lerpColors(wt.from, wt.to, ease(t)); w.userData.stub.material.color.copy(w.userData.mat.color); });
  // кукольный домик: прячем стены, которые между камерой и комнатой
  const c = camera.position; const top = topView && !camTween;
  const hide = { N: c.z < -0.2, S: c.z > D + 0.2, W: c.x < -0.2, E: c.x > W + 0.2 };
  Object.entries(walls).forEach(([id, w]) => { const h = !top && hide[id]; w.userData.mesh.visible = !h; w.children.forEach((ch) => { if (ch !== w.userData.mesh && ch !== w.userData.stub && ch !== w.userData.skirting) ch.visible = !h; }); w.userData.stub.visible = h; });
  items.forEach((it) => { const f = footprint(it, it.target.x, it.target.z, it.target.rot); const near = it.h > 140 && ((hide.S && D - f.z1 < 0.8) || (hide.E && W - f.x1 < 0.8) || (hide.N && f.z0 < 0.8) || (hide.W && f.x0 < 0.8)) && !top && selected !== it; const op = near ? 0.28 : 1; if (it._op !== op) { it._op = op; it.group.traverse((o) => { if (o.isMesh && o.material) { o.material.transparent = op < 1; o.material.opacity = op; o.material.depthWrite = op === 1; o.castShadow = op === 1; } }); } });
  controls.update();
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
}
function easeOutBounce(x) { const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375; }
frame();

addEventListener('resize', () => {
  camera.aspect = app.clientWidth / app.clientHeight; camera.updateProjectionMatrix();
  renderer.setSize(app.clientWidth, app.clientHeight); labelRenderer.setSize(app.clientWidth, app.clientHeight);
});

// ---------- интерфейс ----------
const ui = {
  wallMode: 'all', wallPick: null,
  toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2200); },
  pickWall(id) { ui.wallPick = id; Object.entries(walls).forEach(([k, w]) => setWallGlow(k, k === id)); document.getElementById('wall-pick').textContent = 'Стена: ' + WALL_NAMES[id]; },
  onSelect(it) {
    const p = document.getElementById('sel');
    if (!it) { p.classList.remove('on'); return; }
    p.classList.add('on');
    p.querySelector('.n').textContent = it.label;
    p.querySelector('.s').textContent = `${it.w} × ${it.d} × ${it.h} см` + (it.confidence === 'low' ? ' · перемерь' : '');
    p.querySelector('.rm').style.display = it.fixed ? 'none' : ''; p.querySelector('.rot2').style.display = it.fixed ? 'none' : ''; p.querySelector('.dup').style.display = it.fixed ? 'none' : '';
  },
};
function setWallGlow(id, on) { const m = walls[id].userData.mat; m.emissive.set(on ? '#D97757' : '#000000'); m.emissiveIntensity = on ? 0.25 : 0; }

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => (k === 'on' ? Object.entries(v).forEach(([ev, f]) => e.addEventListener(ev, f)) : e.setAttribute(k, v))); kids.forEach((k) => e.append(k)); return e; }
document.getElementById('title').textContent = DATA.name || 'Моя комната';
document.getElementById('subtitle').textContent = `${R.width} × ${R.depth} см · потолок ${R.height || 260} см`;
const sw = document.getElementById('swatches');
PALETTE.forEach((p) => sw.append(el('button', { class: 'sw', title: p.name, style: `--c:${p.hex}`, on: { click: () => { const ids = ui.wallMode === 'one' && ui.wallPick ? [ui.wallPick] : Object.keys(walls); Object.keys(walls).forEach((k) => setWallGlow(k, false)); paintWalls(p.hex, ids); } } })));
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  ui.wallMode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
  document.getElementById('wall-pick').textContent = ui.wallMode === 'one' ? 'Нажми на стену' : '';
  if (ui.wallMode === 'all') { ui.wallPick = null; Object.keys(walls).forEach((k) => setWallGlow(k, false)); }
}));
const lay = document.getElementById('layouts');
(DATA.layouts || []).forEach((L, i) => lay.append(el('button', { class: 'chip' + (i === 0 ? ' on' : ''), on: { click: (e) => { applyLayout(i); lay.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget)); } } }, L.name)));
document.getElementById('tools-toggle').addEventListener('click', () => document.getElementById('tools').classList.toggle('open'));
document.getElementById('top').addEventListener('click', (e) => { const on = toggleTop(); e.currentTarget.classList.toggle('on', on); });
document.querySelector('#sel .rm').addEventListener('click', () => selected && removeItem(selected.id));
document.getElementById('fit-go').addEventListener('click', () => {
  const v = (id) => parseFloat(document.getElementById(id).value);
  const res = fitCheck({ label: document.getElementById('fit-name').value || 'Новый предмет', kind: document.getElementById('fit-kind').value, w: v('fit-w'), d: v('fit-d'), h: v('fit-h') || 85, replace: document.getElementById('fit-rep').value });
  const out = document.getElementById('fit-out'); out.textContent = res.text; out.className = res.fits ? 'ok' : 'bad';
});
{ const sel = document.getElementById('fit-rep'); (DATA.items || []).filter((x) => !['rug', 'radiator', 'kitchen', 'plant', 'lamp'].includes(x.kind) && !(x.elevation > 0)).forEach((x) => { const o = document.createElement('option'); o.value = x.id; o.textContent = 'вместо: ' + x.label; sel.append(o); }); }
const tbody = document.getElementById('sizes');
const conf = { high: ['точно', 'hi'], medium: ['примерно', 'mid'], low: ['перемерь', 'lo'] };
tbody.append(el('tr', {}, el('td', {}, 'Комната'), el('td', {}, `${R.width}×${R.depth}×${R.height || 260}`), el('td', {}, el('i', { class: conf[R.confidence || 'medium'][1] }, conf[R.confidence || 'medium'][0]))));
(DATA.items || []).forEach((s) => { const c = conf[s.confidence || 'medium']; tbody.append(el('tr', { on: { click: () => select(items.get(s.id)) } }, el('td', {}, s.label), el('td', {}, `${s.w}×${s.d}×${s.h}`), el('td', {}, el('i', { class: c[1] }, c[0])))); });
openings.forEach((o) => { const c = conf[o.confidence || 'medium']; tbody.append(el('tr', {}, el('td', {}, (o.type === 'door' ? 'Дверь' : 'Окно') + ' · ' + WALL_NAMES[o.wall]), el('td', {}, `${o.width}×${o.height}`), el('td', {}, el('i', { class: c[1] }, c[0])))); });
if (DATA.notes && DATA.notes.length) document.getElementById('notes').textContent = DATA.notes.join(' ');
document.getElementById('sizes-toggle').addEventListener('click', () => document.getElementById('sizes-panel').classList.toggle('on'));

// ---------- каталог ----------
const CATALOG = [
  ['sofa', 'Диван', 200, 90, 85], ['armchair', 'Кресло', 85, 85, 80], ['bed', 'Кровать 160', 160, 200, 50], ['bed', 'Кровать 90', 90, 200, 45],
  ['wardrobe', 'Шкаф', 120, 60, 210], ['dresser', 'Комод', 100, 45, 85], ['nightstand', 'Тумба', 45, 40, 50], ['desk', 'Стол рабочий', 120, 60, 75],
  ['table', 'Стол обеденный', 140, 80, 75], ['chair', 'Стул', 45, 50, 88], ['bookcase', 'Стеллаж', 80, 35, 180], ['tv', 'ТВ с тумбой', 140, 40, 110],
  ['plant', 'Растение', 45, 45, 120], ['lamp', 'Торшер', 40, 40, 160], ['rug', 'Ковёр', 160, 230, 1], ['box', 'Коробка', 60, 40, 40],
];
let addN = 0;
function addItem(i) {
  const [kind, label, w, d, h] = CATALOG[i];
  const res = fitCheck({ label, kind, w, d, h });
  const it = [...items.values()].find((o) => o.fit);
  if (it) { it.fit = false; it.user = true; it.id = it.id.replace('fit-', 'add-' + addN++ + '-'); items.delete([...items.keys()].find((k) => items.get(k) === it)); items.set(it.id, it); it.group.traverse((o) => { if (o.isMesh) o.userData.itemId = it.id; }); it.color = undefined; it.inner.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.getHexString() === 'd97757') o.material.color.set('#b9a58f'); }); select(it); ui.toast(`${label} добавлен — тащи на место`); }
  else ui.toast(`${label} не помещается: ${res.text.replace(/^Не влезает: /, '')}`);
}
function duplicateSel() {
  if (!selected || selected.fixed) return; const s0 = selected;
  const spec = { id: 'add-' + addN++, kind: s0.kind, label: s0.label, w: s0.w, d: s0.d, h: s0.h, rot: s0.target.rot, color: s0.color, confidence: s0.confidence, x: s0.target.x, z: s0.target.z };
  for (const [dx, dz] of [[s0.w + 10, 0], [-(s0.w + 10), 0], [0, s0.d + 10], [0, -(s0.d + 10)]]) { const t = { ...spec, collide: true, target: {} }; const c = clampToRoom(t, spec.x + dx, spec.z + dz, spec.rot); const f = footprint(t, c.x, c.z, spec.rot); if (!blockedBy(t, f)) { const it = makeItem({ ...spec, x: c.x, z: c.z }); it.user = true; it.drop = performance.now(); it.group.position.y = 1; select(it); return; } }
  ui.toast('Рядом нет места для копии');
}
{ const cat = document.getElementById('catalog'); CATALOG.forEach((c, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${c[1]} · ${c[2]}×${c[3]}`; cat.append(o); }); document.getElementById('add-go').addEventListener('click', () => addItem(+cat.value)); }
document.querySelector('#sel .rot2').addEventListener('click', rotateSelected);
document.querySelector('#sel .dup').addEventListener('click', duplicateSel);
setTimeout(() => ui.toast('Тащи мебель мышкой или пальцем'), INTRO ? 3200 : 600);

function replayIntro() {
  const now = performance.now(); let k = 0;
  Object.values(walls).forEach((w) => { w.scale.y = 0.001; w.userData.grown = false; });
  introT0 = now;
  items.forEach((it) => { if (it.removed) return; it.drop = now + 700 + k * 110; it.group.position.y = 1.4; k++; });
}
// API для записи видео и автотестов
window.RFP = {
  select: (id) => select(id ? items.get(id) : null), move: (id, x, z) => tryMove(items.get(id), x, z), rotate: (id) => { select(items.get(id)); rotateSelected(); },
  paint: (hex, ids) => paintWalls(hex, ids), layout: applyLayout, fit: fitCheck, top: toggleTop, spin: (on = true) => (autoRotate = on),
  add: addItem, dup: duplicateSel, replay: replayIntro, camera, center, controls, renderer, sun,
  look: (px, py, pz, tx, ty, tz) => { camTween = null; camera.position.set(px, py, pz); controls.target.set(tx, ty, tz); },
  fly: (x, y, z, tx = W / 2, ty = 0.6, tz = D / 2, dur = 1200) => flyTo(new THREE.Vector3(x, y, z), new THREE.Vector3(tx, ty, tz), dur),
  screen: (id) => { const it = items.get(id); const v = it.group.position.clone(); v.y += it.h * CM * 0.6; v.project(camera); const r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  items: () => [...items.values()].map((i) => ({ id: i.id, x: i.target.x, z: i.target.z, rot: i.target.rot })), W: R.width, D: R.depth,
};
