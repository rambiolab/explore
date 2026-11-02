import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T } from '../arch.js';
import { HUB, DOOR } from './hub.js';
import { wallSign, textPanel, FONT } from '../text.js';
import { t } from '../i18n.js';
import { sfx } from '../audio.js';

export const GAME = { x0: HUB.x0 - 2 * T - 13, x1: HUB.x0 - 2 * T, z0: -6, z1: 6, h: 5 };
const COUNTER_X = GAME.x1 - 5;
const LANES = [
  { x: COUNTER_X - 2.4, y: 1.95, half: 4.2 },
  { x: COUNTER_X - 4.2, y: 2.55, half: 4.6 },
  { x: COUNTER_X - 6.0, y: 3.15, half: 5.0 },
];
const BUG_SCALE = 1.5;
const DURATION = 150;
const KNOB_R = 0.034;
const KNOBS_PER_DRUG = 3;

export const GRAM = { '+': '#6b3fa0', '-': '#e2708f' };

export const DRUGS = {
  penicillin: { color: '#2f6fdc', spectrum: '+', form: 'tablet', protein: 'PBP2a' },
  vancomycin: { color: '#f08c2a', spectrum: '+', form: 'tablet', protein: 'VanA' },
  gentamicin: { color: '#f2c230', spectrum: '-', form: 'tablet', protein: "AAC(6')-Ib" },
  colistin: { color: '#19b5a5', spectrum: '-', form: 'tablet', protein: 'MCR-1' },
  imipenem: { color: '#d6283c', spectrum: '+-', form: 'capsule', protein: 'KPC / NDM-1' },
};
export const DRUG_ORDER = Object.keys(DRUGS);

const rod = (r, len) => { const g = new THREE.CapsuleGeometry(r, len, 6, 14); g.rotateZ(Math.PI / 2); return g; };
const tube = (pts, r, seg = 64) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8);
const at = (x, y = 0, z = 0, rz = 0, ry = 0) => ({ p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)) });

export const SPECIES = {
  saureus: {
    name: 'Staphylococcus aureus', gram: '+', pathogen: true, shape: 'grapes',
    geo: () => new THREE.SphereGeometry(0.12, 20, 14),
    cells: [[0, 0, 0], [0.22, 0.06, 0.02], [-0.21, 0.08, -0.03], [0.04, -0.21, 0.05], [-0.14, -0.15, -0.1], [0.14, 0.2, -0.09], [0.0, 0.08, 0.2]].map(c => at(...c)),
  },
  efaecium: {
    name: 'Enterococcus faecium', gram: '+', pathogen: true, shape: 'pairs',
    geo: () => { const g = new THREE.SphereGeometry(0.11, 20, 14); g.scale(1.25, 1, 1); return g; },
    cells: [-0.42, -0.17, 0.17, 0.42].map((x, k) => at(x, k % 2 ? 0.02 : -0.02)),
  },
  kpneu: {
    name: 'Klebsiella pneumoniae', gram: '-', pathogen: true, shape: 'fat',
    geo: () => rod(0.14, 0.2),
    cells: [at(0, 0.16, 0, 0.08), at(0.04, -0.15, 0.02, -0.06)],
  },
  paer: {
    name: 'Pseudomonas aeruginosa', gram: '-', pathogen: true, shape: 'flagellum',
    geo: () => {
      const pts = [];
      for (let k = 0; k <= 30; k++) { const u = k / 30; pts.push(new THREE.Vector3(0.26 + u * 0.5, Math.sin(u * 14) * 0.05, Math.cos(u * 14) * 0.05)); }
      return mergeGeometries([rod(0.085, 0.34), tube(pts, 0.016)]);
    },
    cells: [at(0)],
  },
  campy: {
    name: 'Campylobacter jejuni', gram: '-', pathogen: true, shape: 'spiral',
    geo: () => {
      const pts = [];
      for (let k = 0; k <= 40; k++) { const u = k / 40; pts.push(new THREE.Vector3(-0.32 + u * 0.64, Math.sin(u * Math.PI * 3) * 0.1, Math.cos(u * Math.PI * 3) * 0.04)); }
      return tube(pts, 0.05, 80);
    },
    cells: [at(0)],
  },
  lacto: {
    name: 'Lactobacillus', gram: '+', pathogen: false, shape: 'chain',
    geo: () => rod(0.055, 0.28),
    cells: [at(-0.42, 0, 0, 0.06), at(0, 0.02, 0, -0.04), at(0.42, 0.0, 0, 0.08)],
  },
  bifido: {
    name: 'Bifidobacterium', gram: '+', pathogen: false, shape: 'y',
    geo: () => {
      const stem = rod(0.07, 0.3); stem.translate(-0.17, 0, 0);
      const up = rod(0.065, 0.24); up.rotateZ(0.7); up.translate(0.13, 0.12, 0);
      const dn = rod(0.065, 0.24); dn.rotateZ(-0.7); dn.translate(0.13, -0.12, 0);
      return mergeGeometries([stem, up, dn]);
    },
    cells: [at(0)],
  },
  bacteroides: {
    name: 'Bacteroides', gram: '-', pathogen: false, shape: 'clump',
    geo: () => rod(0.075, 0.1),
    cells: [at(-0.13, 0.1, 0, 0.3), at(0.14, 0.12, 0.03, -0.2), at(-0.1, -0.12, -0.02, -0.4), at(0.15, -0.1, 0, 0.5)],
  },
  treponema: {
    name: 'Treponema', gram: '-', pathogen: false, shape: 'corkscrew',
    geo: () => {
      const pts = [];
      for (let k = 0; k <= 120; k++) { const u = k / 120; pts.push(new THREE.Vector3(-0.5 + u, Math.sin(u * Math.PI * 12) * 0.05, Math.cos(u * Math.PI * 12) * 0.05)); }
      return tube(pts, 0.022, 240);
    },
    cells: [at(0)],
  },
};

const PHASES = [
  { at: 0, speed: 0.75, pop: 9, mix: { saureus: 2, efaecium: 1, kpneu: 1.5, paer: 1, campy: 0.6, lacto: 1.4, bifido: 1, bacteroides: 1.2, treponema: 0.7 }, res: {} },
  { at: 28, speed: 0.95, pop: 12, mix: { saureus: 2.4, efaecium: 1, kpneu: 1.8, paer: 1.2, campy: 0.6, lacto: 1.3, bifido: 1, bacteroides: 1.2, treponema: 0.7 },
    res: { saureus: [[0.55, ['penicillin']]], kpneu: [[0.45, ['gentamicin']]], paer: [[0.45, ['gentamicin']]] } },
  { at: 65, speed: 1.15, pop: 15, mix: { saureus: 2, efaecium: 2, kpneu: 2.2, paer: 1.2, campy: 0.8, lacto: 1.4, bifido: 1, bacteroides: 1.4, treponema: 0.8 },
    res: {
      saureus: [[0.5, ['penicillin']], [0.15, ['penicillin', 'vancomycin']]],
      efaecium: [[0.6, ['penicillin', 'vancomycin']]],
      kpneu: [[0.35, ['gentamicin']], [0.3, ['gentamicin', 'colistin']]],
      paer: [[0.5, ['gentamicin']]],
    } },
  { at: 100, speed: 1.35, pop: 18, mix: { saureus: 2, efaecium: 2, kpneu: 2.8, paer: 1.4, campy: 0.8, lacto: 1.4, bifido: 1, bacteroides: 1.4, treponema: 0.8 },
    res: {
      saureus: [[0.5, ['penicillin']], [0.25, ['penicillin', 'vancomycin']]],
      efaecium: [[0.7, ['penicillin', 'vancomycin']]],
      kpneu: [[0.35, ['gentamicin', 'imipenem']], [0.3, ['gentamicin', 'colistin']]],
      paer: [[0.4, ['gentamicin', 'imipenem']]],
      campy: [[0.4, ['imipenem']]],
    } },
  { at: 128, speed: 1.5, pop: 20, mix: { saureus: 2, efaecium: 1.5, kpneu: 3, paer: 1.5, campy: 0.8, lacto: 1, bifido: 0.6, bacteroides: 1, treponema: 0.5 },
    res: Object.fromEntries(['saureus', 'efaecium', 'kpneu', 'paer', 'campy'].map(id => [id, [[0.75, DRUG_ORDER]]])) },
];

function spread(geo, n) {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const pts = [];
  for (let i = 0; i < pos.count; i += 2) pts.push({ p: new THREE.Vector3().fromBufferAttribute(pos, i), n: new THREE.Vector3().fromBufferAttribute(nor, i) });
  const picked = [pts.reduce((a, b) => (b.p.y > a.p.y ? b : a))];
  const dist = pts.map(q => q.p.distanceToSquared(picked[0].p));
  while (picked.length < n) {
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (dist[i] > dist[best]) best = i;
    picked.push(pts[best]);
    pts.forEach((q, i) => { dist[i] = Math.min(dist[i], q.p.distanceToSquared(pts[best].p)); });
  }
  return picked.map(({ p, n }) => p.clone().addScaledVector(n, KNOB_R * 0.35));
}

function stripes(w, h, n, a, b) {
  return textPanel(w, h, (g, W, H) => {
    for (let k = 0; k < n; k++) {
      g.fillStyle = k % 2 ? a : b;
      g.fillRect((k * W) / n, 0, W / n + 1, H);
    }
  }, 128);
}

function agarBackdrop(w, h) {
  return textPanel(w, h, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#163f30');
    grad.addColorStop(1, '#0c2a20');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    for (let k = 0; k < 70; k++) {
      const x = Math.random() * W, y = Math.random() * H, r = 6 + Math.random() * 40;
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '244,182,194' : '78,179,119'},${0.05 + Math.random() * 0.1})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }, 64);
}

export function drawSpecies(g, id, cx, cy, s) {
  const col = GRAM[SPECIES[id].gram];
  g.save();
  g.translate(cx, cy);
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineCap = 'round';
  const ball = (x, y, r, sx = 1) => { g.beginPath(); g.ellipse(x * s, y * s, r * s * sx, r * s, 0, 0, Math.PI * 2); g.fill(); };
  const stick = (x0, y0, x1, y1, w) => { g.lineWidth = w * s; g.beginPath(); g.moveTo(x0 * s, y0 * s); g.lineTo(x1 * s, y1 * s); g.stroke(); };
  const curve = (f, w, n = 60) => { g.lineWidth = w * s; g.beginPath(); for (let k = 0; k <= n; k++) { const [x, y] = f(k / n); k ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s); } g.stroke(); };
  switch (id) {
    case 'saureus': [[0, 0], [0.22, -0.06], [-0.21, -0.08], [0.04, 0.21], [-0.14, 0.15], [0.14, -0.2], [0.24, 0.17]].forEach(([x, y]) => ball(x, y, 0.12)); break;
    case 'efaecium': [-0.42, -0.17, 0.17, 0.42].forEach(x => ball(x, 0, 0.11, 1.25)); break;
    case 'kpneu': stick(-0.14, -0.15, 0.14, -0.17, 0.28); stick(-0.1, 0.16, 0.18, 0.14, 0.28); break;
    case 'paer': stick(-0.17, 0, 0.17, 0, 0.17); curve(u => [0.26 + u * 0.4, Math.sin(u * 14) * 0.05], 0.03); break;
    case 'campy': curve(u => [-0.32 + u * 0.64, -Math.sin(u * Math.PI * 3) * 0.1], 0.1); break;
    case 'lacto': [-0.42, 0, 0.42].forEach(x => stick(x - 0.14, 0, x + 0.14, 0, 0.11)); break;
    case 'bifido': stick(-0.32, 0, -0.02, 0, 0.14); stick(0.04, -0.04, 0.22, -0.2, 0.13); stick(0.04, 0.04, 0.22, 0.2, 0.13); break;
    case 'bacteroides': [[-0.13, -0.1, 0.3], [0.14, -0.12, -0.2], [-0.1, 0.12, -0.4], [0.15, 0.1, 0.5]].forEach(([x, y, a]) => stick(x - 0.05 * Math.cos(a), y + 0.05 * Math.sin(a), x + 0.05 * Math.cos(a), y - 0.05 * Math.sin(a), 0.15)); break;
    case 'treponema': curve(u => [-0.5 + u, Math.sin(u * Math.PI * 12) * 0.05], 0.045, 200); break;
  }
  g.restore();
}

export function drawPill(g, drug, cx, cy, s) {
  const d = DRUGS[drug];
  g.save();
  g.translate(cx, cy);
  if (d.form === 'tablet') {
    g.fillStyle = d.color;
    g.beginPath(); g.arc(0, 0, s * 0.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = s * 0.06;
    g.beginPath(); g.moveTo(-s * 0.3, 0); g.lineTo(s * 0.3, 0); g.stroke();
  } else {
    const w = s * 1.1, h = s * 0.48;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill();
    g.fillStyle = d.color;
    g.beginPath(); g.roundRect(0, -h / 2, w / 2, h, [0, h / 2, h / 2, 0]); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = s * 0.03;
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.stroke();
  }
  g.restore();
}

function legend() {
  return textPanel(3.3, 0.78, (g, W, H) => {
    g.fillStyle = '#fbfaf7';
    g.beginPath(); g.roundRect(0, 0, W, H, H * 0.05); g.fill();
    const split = W * 0.64;
    g.fillStyle = '#0f5f42';
    g.font = `700 ${H * 0.085}px ${FONT}`;
    g.fillText(t('game_legend_bugs'), W * 0.015, H * 0.11);
    g.fillText(t('game_legend_drugs'), split + W * 0.015, H * 0.11);
    const ids = Object.keys(SPECIES);
    const colW = (split - W * 0.02) / 5;
    ids.forEach((id, k) => {
      const row = k < 5 ? 0 : 1, col = row ? k - 5 : k;
      const cx = W * 0.015 + colW * (col + 0.5) + (row ? colW * 0.5 : 0);
      const cy = H * (0.27 + row * 0.42);
      drawSpecies(g, id, cx, cy, H * 0.17);
      const s = SPECIES[id];
      g.textAlign = 'center';
      g.fillStyle = '#1d2a24';
      g.font = `italic 700 ${H * 0.058}px ${FONT}`;
      g.fillText(s.name.replace(/^(\w)\w+ /, '$1. '), cx, cy + H * 0.13);
      g.font = `800 ${H * 0.05}px ${FONT}`;
      g.fillStyle = s.pathogen ? '#b3144f' : '#0f5f42';
      g.fillText(`${t(s.pathogen ? 'game_pathogen' : 'game_commensal')} · Gram${s.gram === '+' ? '+' : '−'}`, cx, cy + H * 0.19);
      g.textAlign = 'left';
    });
    g.fillStyle = '#d9d4ca';
    g.fillRect(split - W * 0.004, H * 0.05, W * 0.002, H * 0.9);
    DRUG_ORDER.forEach((id, k) => {
      const d = DRUGS[id];
      const y = H * (0.25 + k * 0.155);
      drawPill(g, id, split + W * 0.03, y - H * 0.02, H * 0.09);
      g.fillStyle = '#1d2a24';
      g.font = `700 ${H * 0.06}px ${FONT}`;
      g.fillText(t(`drug_${id}`), split + W * 0.055, y);
      g.font = `600 ${H * 0.046}px ${FONT}`;
      g.fillStyle = '#1d2a24';
      g.fillText(`${t(`spec_${d.spectrum === '+-' ? 'broad' : d.spectrum === '+' ? 'pos' : 'neg'}`)} · ${t('game_blocked')} ${d.protein}`, split + W * 0.15, y);
      g.fillStyle = d.color;
      g.beginPath(); g.arc(W * 0.985, y - H * 0.02, H * 0.025, 0, Math.PI * 2); g.fill();
    });
  }, 900);
}

const pillMat = new Map();
const matFor = color => pillMat.get(color) ?? pillMat.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.35 })).get(color);
const TABLET = new THREE.CylinderGeometry(0.035, 0.035, 0.018, 20).rotateX(Math.PI / 2);
const HALF = new THREE.CapsuleGeometry(0.018, 0.026, 4, 10, 1).rotateX(Math.PI / 2);

function tabletMesh(drug) {
  return new THREE.Mesh(TABLET, matFor(DRUGS[drug].color));
}

function capsuleMesh(drug) {
  const g = new THREE.Group();
  for (const [color, s] of [['#ffffff', -1], [DRUGS[drug].color, 1]]) {
    const m = new THREE.Mesh(HALF, matFor(color));
    m.position.z = s * 0.013;
    g.add(m);
  }
  return g;
}

function buildGuns(mats) {
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.45 });
  const steel = mats.steel;
  const part = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  const rifle = new THREE.Group();
  part(new THREE.BoxGeometry(0.05, 0.07, 0.34), wood, 0, -0.02, 0.12, rifle);
  part(new THREE.BoxGeometry(0.045, 0.11, 0.12), wood, 0, -0.06, 0.28, rifle);
  const rb = part(new THREE.CylinderGeometry(0.011, 0.013, 0.5, 16), steel, 0, 0.022, -0.2, rifle);
  rb.rotation.x = Math.PI / 2;
  const mag = part(new THREE.CylinderGeometry(0.02, 0.02, 0.035, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 0, 0.045, -0.05, rifle);
  mag.rotation.x = Math.PI / 2;
  part(new THREE.BoxGeometry(0.012, 0.02, 0.012), mats.brass, 0, 0.045, -0.42, rifle);
  rifle.userData = { mag, tip: new THREE.Vector3(0, 0.022, -0.46) };

  const shotgun = new THREE.Group();
  part(new THREE.BoxGeometry(0.07, 0.08, 0.3), wood, 0, -0.03, 0.14, shotgun);
  part(new THREE.BoxGeometry(0.06, 0.12, 0.12), wood, 0, -0.07, 0.3, shotgun);
  for (const s of [-1, 1]) {
    const b = part(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 18), steel, s * 0.019, 0.025, -0.16, shotgun);
    b.rotation.x = Math.PI / 2;
  }
  const band = part(new THREE.CylinderGeometry(0.041, 0.041, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 0, 0.025, -0.02, shotgun);
  band.rotation.z = Math.PI / 2;
  band.scale.set(1, 1, 0.62);
  shotgun.userData = { mag: band, tip: new THREE.Vector3(0, 0.025, -0.38) };

  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  root.add(rifle, shotgun, puff);
  return { root, rifle, shotgun, puff };
}

export function buildGame(ctx) {
  const { arch, mats, scene, signs, tier } = ctx;
  arch.room({ ...GAME, floor: mats.concrete, floorTile: 3, openings: { e: [{ c: 0, ...DOOR }] } });
  arch.walk.pop();
  arch.walk.push([COUNTER_X + 0.6, GAME.x1 - 0.3, GAME.z0 + 0.3, GAME.z1 - 0.3]);
  arch.doorway('z', HUB.x0 - T, 0, DOOR.w, DOOR.h);

  const W = GAME.z1 - GAME.z0;
  arch.box(0.7, 1.05, W + 0.04, COUNTER_X, 0.525, 0, mats.darkwood, { cast: true });
  arch.box(0.8, 0.05, W + 0.04, COUNTER_X, 1.075, 0, mats.brass);
  const front = stripes(W, 0.9, 24, '#f4b6c2', '#fbfaf7');
  front.position.set(COUNTER_X + 0.36, 0.5, 0);
  front.rotation.y = Math.PI / 2;
  scene.add(front);

  const lect = legend();
  const TILT = 0.42;
  const lpos = new THREE.Vector3(COUNTER_X, 1.27, 0);
  lect.position.copy(lpos);
  lect.lookAt(lpos.clone().add(new THREE.Vector3(Math.sin(TILT), Math.cos(TILT), 0)));
  lect.material.depthWrite = true;
  lect.material.transparent = false;
  scene.add(lect);
  signs.push(lect);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.86, 0.04), mats.darkwood);
  back.position.copy(lpos).add(new THREE.Vector3(-Math.sin(TILT), -Math.cos(TILT), 0).multiplyScalar(0.025));
  back.quaternion.copy(lect.quaternion);
  scene.add(back);

  const awning = stripes(W, 1.3, 18, '#14855a', '#fbfaf7');
  awning.material.side = THREE.DoubleSide;
  awning.position.set(COUNTER_X - 0.45, 3.85, 0);
  awning.rotation.set(-Math.PI / 2 + 0.45, Math.PI / 2, 0, 'YXZ');
  scene.add(awning);

  const backdrop = agarBackdrop(W, GAME.h);
  backdrop.position.set(GAME.x0 + 0.02, GAME.h / 2, 0);
  backdrop.rotation.y = Math.PI / 2;
  scene.add(backdrop);

  const flatMat = k => new THREE.MeshStandardMaterial({ color: [0x0f5f42, 0x14855a, 0x379b60][k], roughness: 0.8 });
  LANES.forEach((lane, k) => {
    const shape = new THREE.Shape();
    const len = W;
    shape.moveTo(-len / 2, 0);
    for (let i = 0; i <= 60; i++) shape.lineTo(-len / 2 + (i / 60) * len, lane.y - 0.6 + Math.sin(i * 0.8 + k) * 0.08);
    shape.lineTo(len / 2, 0);
    const wave = new THREE.Mesh(new THREE.ShapeGeometry(shape), flatMat(k));
    wave.position.set(lane.x + 0.3, 0, 0);
    wave.rotation.y = Math.PI / 2;
    scene.add(wave);
    arch.box(0.04, 0.04, 2 * lane.half, lane.x + 0.25, lane.y - 0.62, 0, mats.brass);
    for (const s of [-1, 1]) {
      const w = GAME.z1 - (lane.half - 0.25);
      const flat = stripes(w, lane.y + 0.6, 5, '#f4b6c2', '#fbfaf7');
      flat.material.transparent = false;
      flat.material.depthWrite = true;
      flat.position.set(lane.x + 0.45, (lane.y + 0.6) / 2, s * (GAME.z1 - w / 2));
      flat.rotation.y = Math.PI / 2;
      scene.add(flat);
    }
  });

  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b8 }), 48);
  const m4 = new THREE.Matrix4();
  for (let k = 0; k < 48; k++) {
    const u = (k % 24) / 23, row = Math.floor(k / 24);
    m4.makeTranslation(COUNTER_X - 1.5 - row * 4, 4.6 - Math.sin(u * Math.PI) * 0.6, -5.5 + u * 11);
    bulbs.setMatrixAt(k, m4);
  }
  scene.add(bulbs);
  const stageLight = new THREE.SpotLight(0xffe7c8, tier === 'high' ? 130 : 80, 14, 0.75, 0.6, 1.6);
  stageLight.position.set(COUNTER_X + 1, 4.7, 0);
  stageLight.target.position.set(COUNTER_X - 5, 1.8, 0);
  scene.add(stageLight, stageLight.target);
  scene.add(new THREE.PointLight(0xffd9a8, 18, 10, 2).translateX(COUNTER_X + 2.5).translateY(3.6));

  const title = wallSign(7, 1.0, () => [
    { text: t('game_title'), size: 0.4, fill: '#fbfaf7' },
    { text: t('game_sub'), size: 0.17, weight: 400, fill: '#f4b6c2' },
  ]);
  title.position.set(GAME.x0 + 0.03, 4.3, 0);
  title.rotation.y = Math.PI / 2;
  scene.add(title);
  signs.push(title);

  const pools = {}, anchors = {};
  for (const [id, sp] of Object.entries(SPECIES)) {
    const geo = sp.geo();
    anchors[id] = spread(geo, DRUG_ORDER.length * KNOBS_PER_DRUG);
    const mat = new THREE.MeshPhysicalMaterial({ color: GRAM[sp.gram], roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4 });
    const mesh = new THREE.InstancedMesh(geo, mat, 24 * sp.cells.length);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
    pools[id] = mesh;
  }
  const knobs = new THREE.InstancedMesh(new THREE.SphereGeometry(KNOB_R, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.12 }), 6000);
  knobs.count = 0;
  knobs.frustumCulled = false;
  knobs.setColorAt(0, new THREE.Color());
  scene.add(knobs);

  return new ShootingGallery({ scene, pools, anchors, knobs, guns: buildGuns(mats) });
}

const PELLETS = 9;
const SPREAD = 0.07;
const SPEED = 26;

class ShootingGallery {
  constructor({ scene, pools, anchors, knobs, guns }) {
    Object.assign(this, { scene, pools, anchors, knobs, guns });
    this.bugs = [];
    this.shots = [];
    this.active = false;
    this.state = 'idle';
    this.drug = 'penicillin';
    this.cooldown = 0;
    this.kick = 0;
    this.listeners = {};
    this.ray = new THREE.Raycaster();
    this.hitRay = new THREE.Raycaster();
    this.slots = {};
    this.aim = new THREE.Vector3(0, 0, -1);
    this.reset();
  }

  reset() {
    this.score = 0;
    this.elapsed = 0;
    this.phase = 0;
    this.stats = { pathogen: 0, commensal: 0, resisted: 0, noeffect: 0 };
  }

  on(evt, f) { (this.listeners[evt] ??= []).push(f); }
  emit(evt, ...a) { (this.listeners[evt] ?? []).forEach(f => f(...a)); }

  zone(pos) { return pos.x > COUNTER_X + 0.5 && pos.x < COUNTER_X + 3.0 && Math.abs(pos.z) < 4; }
  get stand() { return { x: COUNTER_X + 1.5, z: 0, yaw: Math.PI / 2 }; }
  get timeLeft() { return Math.max(0, DURATION - this.elapsed); }
  get weapon() { return DRUGS[this.drug].form === 'tablet' ? 'rifle' : 'shotgun'; }

  attach(camera) {
    camera.add(this.guns.root);
    this.guns.root.visible = false;
  }

  start() {
    this.active = true;
    this.state = 'intro';
    this.reset();
    this.bugs = [];
    for (let k = 0; k < PHASES[0].pop; k++) this.#spawn(true);
    this.guns.root.visible = true;
    this.setDrug(this.drug);
  }

  play() { this.state = 'play'; this.emit('phase', 0); }

  stop() {
    this.active = false;
    this.state = 'idle';
    this.bugs = [];
    this.shots.forEach(s => this.scene.remove(s.mesh));
    this.shots = [];
    this.guns.root.visible = false;
    this.phase = 0;
    this.#sync();
  }

  setDrug(d) {
    this.drug = d;
    const { rifle, shotgun } = this.guns;
    rifle.visible = this.weapon === 'rifle';
    shotgun.visible = !rifle.visible;
    for (const g of [rifle, shotgun]) g.userData.mag.material.color.set(DRUGS[d].color);
    this.emit('hud');
  }
  cycleDrug(step) {
    const i = DRUG_ORDER.indexOf(this.drug);
    this.setDrug(DRUG_ORDER[(i + step + DRUG_ORDER.length) % DRUG_ORDER.length]);
  }

  #spawn(anywhere) {
    const ph = PHASES[this.phase];
    const ids = Object.keys(ph.mix);
    let r = Math.random() * ids.reduce((a, id) => a + ph.mix[id], 0);
    const id = ids.find(i => (r -= ph.mix[i]) < 0) ?? ids[0];
    let res = [];
    let u = Math.random();
    for (const [p, drugs] of ph.res[id] ?? []) { if ((u -= p) < 0) { res = drugs; break; } }
    const lane = Math.floor(Math.random() * LANES.length);
    const L = LANES[lane];
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.bugs.push({
      id, lane, dir, res: new Set(res),
      speed: ph.speed * (0.7 + Math.random() * 0.6) * (1 + lane * 0.12),
      z: anywhere ? (Math.random() * 2 - 1) * (L.half - 0.6) : -dir * (L.half + 0.9),
      phase: Math.random() * 10, spin: Math.random() * 6,
      cells: SPECIES[id].cells.map(() => ({ alive: true, dying: 0 })),
      flash: 0,
      pos: new THREE.Vector3(),
    });
  }

  pick(origin, dir) {
    this.hitRay.set(origin, dir);
    let best = null, bestD = Infinity;
    for (const id in this.pools) {
      const mesh = this.pools[id];
      if (!mesh.count) continue;
      mesh.boundingSphere = null;
      for (const h of this.hitRay.intersectObject(mesh, false)) {
        const slot = this.slots[id][h.instanceId];
        if (slot && slot.bug.cells[slot.cell].alive && h.distance < bestD) { bestD = h.distance; best = { ...slot, point: h.point }; }
      }
    }
    return best;
  }

  fire(camera, ndc) {
    if (this.state !== 'play' || this.cooldown > 0) return;
    this.ray.setFromCamera(ndc, camera);
    const { origin, direction } = this.ray.ray;
    const rifle = this.weapon === 'rifle';
    this.cooldown = rifle ? 0.35 : 1.0;
    this.kick = 1;
    sfx(rifle ? 'rifle' : 'shotgun');
    const gun = rifle ? this.guns.rifle : this.guns.shotgun;
    const tip = gun.localToWorld(gun.userData.tip.clone());
    const puff = this.guns.puff;
    puff.position.copy(this.guns.root.worldToLocal(tip.clone()));
    puff.material.opacity = 0.8;
    puff.scale.setScalar(rifle ? 0.6 : 1.4);

    const dirs = rifle ? [direction.clone()] : Array.from({ length: PELLETS }, () => {
      const d = direction.clone();
      d.x += (Math.random() * 2 - 1) * SPREAD;
      d.y += (Math.random() * 2 - 1) * SPREAD;
      d.z += (Math.random() * 2 - 1) * SPREAD;
      return d.normalize();
    });
    const claimed = new Set();
    for (const d of dirs) {
      const hit = this.pick(origin, d);
      const to = hit ? hit.point.clone() : origin.clone().addScaledVector(d, 12);
      let target = null;
      if (hit && (rifle || !claimed.has(hit.bug))) { target = hit; claimed.add(hit.bug); }
      const mesh = rifle ? tabletMesh(this.drug) : capsuleMesh(this.drug);
      mesh.position.copy(tip);
      mesh.lookAt(to);
      this.scene.add(mesh);
      this.shots.push({ mesh, from: tip.clone(), to, t: 0, dur: tip.distanceTo(to) / SPEED, drug: this.drug, target, whole: !rifle });
    }
  }

  #land(s) {
    this.scene.remove(s.mesh);
    if (!s.target) return;
    const { bug, cell } = s.target;
    const sp = SPECIES[bug.id];
    const d = DRUGS[s.drug];
    const cells = s.whole ? bug.cells.filter(c => c.alive) : [bug.cells[cell]].filter(c => c.alive);
    if (!cells.length) return;
    if (!d.spectrum.includes(sp.gram)) {
      this.stats.noeffect++;
      sfx('bounce');
      this.emit('popup', bug.pos, t('game_noeffect'), 'neutral');
      return;
    }
    if (bug.res.has(s.drug)) {
      this.stats.resisted++;
      bug.flash = 0.5;
      sfx('clank');
      this.emit('popup', bug.pos, t('game_resistant'), 'resist');
      return;
    }
    for (const c of cells) { c.alive = false; c.dying = 0.35; }
    const pts = (sp.pathogen ? 10 : -15) * cells.length;
    this.score += pts;
    this.stats[sp.pathogen ? 'pathogen' : 'commensal'] += cells.length;
    sfx(sp.pathogen ? 'pop' : 'oops');
    this.emit('popup', bug.pos, pts > 0 ? `+${pts}` : `${pts}`, pts > 0 ? 'good' : 'bad');
    this.emit('hud');
  }

  pointGuns(camera, ndc) {
    this.ray.setFromCamera(ndc, camera);
    this.ray.ray.at(8, this.aim);
  }

  update(dt, time) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.#animateGuns(dt);
    for (const s of this.shots) {
      s.t += dt;
      const u = Math.min(1, s.t / Math.max(0.01, s.dur));
      s.mesh.position.lerpVectors(s.from, s.to, u);
      s.mesh.rotateZ(dt * 20);
      if (u >= 1) { s.done = true; this.#land(s); }
    }
    this.shots = this.shots.filter(s => !s.done);

    if (this.active && this.state === 'play') {
      this.elapsed += dt;
      const next = PHASES[this.phase + 1];
      if (next && this.elapsed >= next.at) { this.phase++; this.emit('phase', this.phase); sfx('bell'); }
      if (this.elapsed >= DURATION) {
        this.state = 'over';
        this.emit('over');
      }
    }
    for (const b of this.bugs) {
      const L = LANES[b.lane];
      if (this.state !== 'intro') b.z += b.dir * b.speed * dt;
      if (Math.abs(b.z) > L.half + 1.0) b.gone = true;
      b.pos.set(L.x, L.y + Math.sin(time * 2.4 + b.phase) * 0.1, b.z);
      for (const c of b.cells) if (c.dying > 0) c.dying -= dt;
      b.flash = Math.max(0, b.flash - dt);
    }
    this.bugs = this.bugs.filter(b => !b.gone && b.cells.some(c => c.alive || c.dying > 0));
    if (!this.active || this.state === 'play') {
      const ph = PHASES[this.phase];
      const deficit = (this.active ? ph.pop : 6) - this.bugs.length;
      if (deficit > 0 && Math.random() < dt * (0.6 + deficit * 0.5)) this.#spawn(false);
    }
    this.#sync(time);
  }

  #animateGuns(dt) {
    const { root, puff } = this.guns;
    if (!root.visible) return;
    this.kick = Math.max(0, this.kick - dt * 6);
    const k = Math.sin(this.kick * Math.PI) * (this.weapon === 'rifle' ? 0.6 : 1);
    root.position.set(0.17, -0.19, -0.45 + k * 0.06);
    root.updateMatrixWorld();
    const p = root.getWorldPosition(new THREE.Vector3());
    root.lookAt(p.multiplyScalar(2).sub(this.aim));
    root.rotateX(k * 0.18);
    puff.material.opacity = Math.max(0, puff.material.opacity - dt * 4);
    puff.scale.multiplyScalar(1 + dt * 4);
  }

  #sync(time = 0) {
    const m = new THREE.Matrix4(), mc = new THREE.Matrix4(), mk = new THREE.Matrix4();
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    const col = new THREE.Color(), white = new THREE.Color(0xffffff);
    const counts = {};
    let nk = 0;
    for (const id in this.pools) { counts[id] = 0; this.slots[id] = []; }
    for (const b of this.bugs) {
      const mesh = this.pools[b.id];
      const sp = SPECIES[b.id];
      e.set(Math.sin(time * 1.3 + b.phase) * 0.35, b.dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.sin(time * 2 + b.spin) * 0.25);
      m.compose(b.pos, q.setFromEuler(e), s.setScalar(BUG_SCALE));
      sp.cells.forEach((cell, ci) => {
        const st = b.cells[ci];
        if (!st.alive && st.dying <= 0) return;
        const k = counts[b.id]++;
        if (k >= mesh.instanceMatrix.count) return;
        this.slots[b.id][k] = { bug: b, cell: ci };
        const cs = st.alive ? 1 : Math.max(0.01, st.dying / 0.35) * 1.4;
        mc.compose(cell.p, cell.q, s.setScalar(cs)).premultiply(m);
        mesh.setMatrixAt(k, mc);
        if (!st.alive || !b.res.size) return;
        let j = 0;
        for (const drug of DRUG_ORDER) {
          if (!b.res.has(drug)) continue;
          col.set(DRUGS[drug].color);
          if (b.flash > 0) col.lerp(white, b.flash);
          const base = DRUG_ORDER.indexOf(drug) * KNOBS_PER_DRUG;
          for (let r = 0; r < KNOBS_PER_DRUG && nk < this.knobs.instanceMatrix.count; r++, j++) {
            mk.compose(this.anchors[b.id][base + r], q.identity(), one).premultiply(mc);
            this.knobs.setMatrixAt(nk, mk);
            this.knobs.setColorAt(nk, col);
            nk++;
          }
        }
      });
    }
    for (const id in this.pools) {
      this.pools[id].count = Math.min(counts[id], this.pools[id].instanceMatrix.count);
      this.pools[id].instanceMatrix.needsUpdate = true;
    }
    this.knobs.count = nk;
    this.knobs.instanceMatrix.needsUpdate = true;
    if (this.knobs.instanceColor) this.knobs.instanceColor.needsUpdate = true;
  }
}
