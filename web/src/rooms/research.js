import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { T } from '../arch.js';
import { HUB, DOOR } from './hub.js';
import { wallSign, textPanel, FONT } from '../text.js';
import { t } from '../i18n.js';

export const RESEARCH = { x0: HUB.x1 + 2 * T, x1: HUB.x1 + 2 * T + 16, z0: -8, z1: 8, h: 4.5 };
const DESK = { x: RESEARCH.x0 + 6.2, z: RESEARCH.z1 - 0.55, w: 2.6, d: 0.95, y: 0.76 };

export function buildResearch(ctx) {
  const { arch, mats, scene, signs, tier } = ctx;
  arch.room({ ...RESEARCH, floor: mats.parquet, floorTile: 3, openings: { w: [{ c: 0, ...DOOR }] } });
  arch.doorway('z', HUB.x1 + T, 0, DOOR.w, DOOR.h);

  for (let x = RESEARCH.x0 + 2.5; x < RESEARCH.x1; x += 4) arch.box(0.35, 0.04, 10, x, RESEARCH.h - 0.03, 0, mats.glow, { receive: false });

  const about = wallSign(11, 3.0, () => [
    { text: t('research_title'), size: 0.13 },
    { text: t('research_inst'), size: 0.065, weight: 500, fill: '#e69aa9', gap: 0.7 },
    { text: t('research_p1'), size: 0.07, weight: 400, fill: '#2a3832', gap: 0.3 },
    { text: ' ', size: 0.05, weight: 400 },
    { text: t('research_p2'), size: 0.07, weight: 400, fill: '#2a3832', gap: 0.3 },
    { text: ' ', size: 0.05, weight: 400 },
    { text: t('research_p3'), size: 0.07, weight: 400, fill: '#2a3832', gap: 0.3 },
  ], { align: 'left' });
  about.position.set((RESEARCH.x0 + RESEARCH.x1) / 2, 2.6, RESEARCH.z0 + 0.02);
  scene.add(about);
  signs.push(about);

  const bench = new RoundedBoxGeometry(2.6, 0.45, 0.6, 3, 0.05);
  for (const z of [-1.6, 1.6]) {
    const b = new THREE.Mesh(bench, mats.darkwood);
    b.position.set(RESEARCH.x0 + 9, 0.225, z);
    b.rotation.y = Math.PI / 2;
    arch.add(b, { cast: true });
  }

  const slots = [-3.7, 3.7].map(z => ({ x: RESEARCH.x1 - 0.02, y: 2.05, z, ry: -Math.PI / 2, height: 2.8 }));
  if (tier === 'high') {
    for (const s of slots) {
      const l = new THREE.SpotLight(0xffffff, 30, 8, 0.36, 0.7, 2);
      l.position.set(s.x - 2.2, RESEARCH.h - 0.05, s.z);
      l.target.position.set(s.x, s.y, s.z);
      scene.add(l, l.target);
    }
  }
  return { posterSlots: slots, desk: buildDesk(ctx) };
}

function buildDesk({ arch, mats, scene }) {
  const { x, z, w, d, y } = DESK;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = Math.PI;
  scene.add(group);
  const put = (geo, mat, px, py, pz, ry = 0, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.y = ry;
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const oak = new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.5 });
  const plastic = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.9 });

  put(new RoundedBoxGeometry(w, 0.04, d, 2, 0.01), oak, 0, y, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(new THREE.BoxGeometry(0.04, y - 0.02, 0.04), mats.steel, sx * (w / 2 - 0.06), (y - 0.02) / 2, sz * (d / 2 - 0.06));
  arch.blockRect(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  const top = y + 0.02;

  put(new THREE.BoxGeometry(0.22, 0.01, 0.16), mats.steel, -0.2, top + 0.005, -0.33);
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 12), mats.steel, -0.2, top + 0.13, -0.33);
  put(new RoundedBoxGeometry(1.0, 0.6, 0.035, 2, 0.01), plastic(0x1d1f22), -0.2, top + 0.52, -0.32);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.54), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  screen.position.set(-0.2, top + 0.53, -0.3);
  group.add(screen);
  for (const [sx, sy, c, r] of [[0.46, 0.22, 0xf7e27a, 0.12], [0.47, 0.11, 0xf4b6c2, -0.08], [-0.46, 0.21, 0x9fe0b8, 0.05]]) {
    const note = put(new THREE.PlaneGeometry(0.07, 0.07), plastic(c), -0.2 + sx, top + 0.52 + sy, -0.297, 0, false);
    note.rotateZ(r);
  }

  put(new RoundedBoxGeometry(0.46, 0.022, 0.15, 2, 0.006), plastic(0x2a2d31), -0.2, top + 0.011, 0.08, 0.04);
  put(new RoundedBoxGeometry(0.06, 0.03, 0.1, 2, 0.012), plastic(0x2a2d31), 0.2, top + 0.015, 0.1, -0.2);

  const mugMat = mats.pink.clone();
  mugMat.side = THREE.DoubleSide;
  put(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 24, 1, true), mugMat, -0.9, top + 0.05, 0.1);
  put(new THREE.CircleGeometry(0.043, 24), plastic(0x3b2416), -0.9, top + 0.085, 0.1).rotation.x = -Math.PI / 2;
  put(new THREE.CylinderGeometry(0.04, 0.04, 0.005, 24), mats.pink, -0.9, top + 0.003, 0.1);
  put(new THREE.TorusGeometry(0.028, 0.008, 8, 16), mats.pink, -0.95, top + 0.05, 0.1, Math.PI / 2);

  for (let k = 0; k < 7; k++) put(new THREE.BoxGeometry(0.22, 0.006, 0.3), paper, -0.95 + Math.sin(k) * 0.02, top + 0.004 + k * 0.007, -0.25, Math.sin(k * 2.3) * 0.12, false);
  for (let k = 0; k < 4; k++) put(new THREE.BoxGeometry(0.22, 0.006, 0.3), paper, 0.98, top + 0.004 + k * 0.007, -0.28, 0.3 + Math.sin(k * 3.1) * 0.1, false);

  put(new THREE.BoxGeometry(0.12, 0.06, 0.08), plastic(0x2f6fdc), 0.55, top + 0.03, -0.34, 0.3);
  put(new THREE.BoxGeometry(0.122, 0.006, 0.082), plastic(0x9cc0f0), 0.55, top + 0.063, -0.34, 0.3);
  put(new THREE.BoxGeometry(0.1, 0.02, 0.04), plastic(0x9aa1a8), 0.8, top + 0.01, -0.12, 0.7);
  put(new THREE.BoxGeometry(0.05, 0.008, 0.018), plastic(0xe69aa9), 0.35, top + 0.004, -0.1, 1.2);

  [[0x14855a, 0.05], [0xe69aa9, 0.04], [0x3b2a20, 0.035], [0xf3f0ea, 0.045]].reduce((yy, [c, h], k) => {
    put(new THREE.BoxGeometry(0.26, h, 0.19), plastic(c), -1.05, yy + h / 2, 0.32, 0.1 * (k % 2 ? 1 : -1));
    return yy + h;
  }, top);
  for (const [px, pz] of [[0.25, 0.32], [1.15, -0.05], [-0.45, 0.33]]) {
    const ball = put(new THREE.IcosahedronGeometry(0.035, 1), paper, px, top + 0.03, pz);
    ball.scale.set(1, 0.85, 1.1);
  }
  const mug2 = new THREE.MeshStandardMaterial({ color: 0x14855a, roughness: 0.4, side: THREE.DoubleSide });
  put(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 24, 1, true), mug2, 1.12, top + 0.045, -0.35);
  put(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 24), mug2, 1.12, top + 0.002, -0.35);

  const chair = new THREE.Group();
  chair.position.set(-0.15, 0, 0.75);
  chair.rotation.y = Math.PI + 0.35;
  group.add(chair);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.08, 0.48, 3, 0.03), plastic(0x0f5f42));
  seat.position.y = 0.48;
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.55, 0.06, 3, 0.03), plastic(0x0f5f42));
  back.position.set(0, 0.82, -0.24);
  back.rotation.x = -0.12;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 12), mats.steel);
  pole.position.y = 0.25;
  chair.add(seat, back, pole);
  for (let k = 0; k < 5; k++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.04), mats.steel);
    leg.position.set(Math.cos((k / 5) * Math.PI * 2) * 0.15, 0.05, Math.sin((k / 5) * Math.PI * 2) * 0.15);
    leg.rotation.y = -(k / 5) * Math.PI * 2;
    chair.add(leg);
  }
  chair.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const brass = mats.brass.clone();
  brass.side = THREE.DoubleSide;
  put(new THREE.ConeGeometry(0.08, 0.1, 20, 1, true), brass, 0.9, top + 0.55, -0.1);
  put(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8), mats.brass, 0.9, top + 0.27, -0.22).rotation.x = -0.4;
  put(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 20), mats.brass, 0.9, top + 0.01, -0.32);
  const lamp = new THREE.PointLight(0xfff0dc, 2.5, 3, 2);
  lamp.position.set(0.9, top + 0.45, -0.1);
  group.add(lamp);

  const paperSlots = [
    { px: 0.42, pz: 0.2, rz: 0.18 },
    { px: 0.74, pz: 0.26, rz: -0.12 },
    { px: 1.06, pz: 0.18, rz: 0.3 },
    { px: -0.6, pz: 0.24, rz: -0.25 },
  ].map(s => ({ ...s, py: top + 0.012 }));
  return { group, screen, paperSlots };
}

export function paperSheet(p, image) {
  const W = 0.21 * 1.35, H = 0.297 * 1.35;
  const mesh = textPanel(W, H, (g, cw, ch, { wrap }) => {
    g.fillStyle = '#fbfaf7';
    g.fillRect(0, 0, cw, ch);
    if (image) { g.drawImage(image, 0, 0, cw, ch); return; }
    const m = cw * 0.08;
    g.fillStyle = '#14855a';
    g.font = `700 ${cw * 0.03}px ${FONT}`;
    g.fillText(`${p.journal} · ${p.year}`.toUpperCase(), m, m + cw * 0.03);
    g.fillRect(m, m + cw * 0.05, cw - 2 * m, 2);
    let y = m + cw * 0.13;
    g.fillStyle = '#1d2a24';
    g.font = `700 ${cw * 0.055}px Georgia, serif`;
    for (const l of wrap(p.title, cw - 2 * m)) { g.fillText(l, m, y); y += cw * 0.065; }
    y += cw * 0.02;
    g.font = `400 ${cw * 0.026}px ${FONT}`;
    g.fillStyle = '#3a4a42';
    for (const l of wrap(p.authors.join(', '), cw - 2 * m).slice(0, 3)) { g.fillText(l, m, y); y += cw * 0.034; }
    y += cw * 0.03;
    g.font = `700 ${cw * 0.028}px ${FONT}`;
    g.fillStyle = '#1d2a24';
    g.fillText('Abstract', m, y);
    y += cw * 0.04;
    g.font = `400 ${cw * 0.024}px Georgia, serif`;
    for (const l of wrap(p.abstract, cw - 2 * m)) { if (y > ch - m * 1.5) break; g.fillText(l, m, y); y += cw * 0.032; }
    g.fillStyle = '#8a948e';
    g.font = `400 ${cw * 0.022}px ${FONT}`;
    g.fillText(`doi:${p.doi}`, m, ch - m * 0.7);
  }, 1100 / W);
  mesh.material.transparent = false;
  mesh.material.depthWrite = true;
  return mesh;
}
