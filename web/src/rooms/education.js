import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { T, uvBox } from '../arch.js';
import { HUB, DOOR } from './hub.js';
import { wallSign, textPanel, FONT } from '../text.js';
import { t } from '../i18n.js';

export const EDU = { x0: -8, x1: 8, z0: HUB.z1 + 2 * T, z1: HUB.z1 + 2 * T + 13, h: 4.5 };
const SCREEN = { w: 3.6, h: 3.6 * 9 / 16 };

export function buildEducation(ctx) {
  const { arch, mats, scene, signs } = ctx;
  arch.room({ ...EDU, floor: mats.parquet, floorTile: 3, openings: { n: [{ c: 0, ...DOOR }] } });
  arch.doorway('x', HUB.z1 + T, 0, DOOR.w, DOOR.h);

  for (let z = EDU.z0 + 2; z < EDU.z1; z += 3.5) arch.box(6, 0.04, 0.35, 0, EDU.h - 0.03, z, mats.glow, { receive: false });

  const rugLen = 6.5;
  const rug = arch.box(9, 0.012, rugLen, 0, 0.006, EDU.z1 - 2.2 - rugLen / 2, mats.carpet);
  rug.geometry = uvBox(9, 0.012, rugLen, 1.2);
  const bench = new RoundedBoxGeometry(3.2, 0.45, 0.6, 3, 0.05);
  for (const [x, z] of [[-2.2, EDU.z1 - 6.2], [2.2, EDU.z1 - 6.2], [0, EDU.z1 - 8.2]]) {
    const b = new THREE.Mesh(bench, mats.darkwood);
    b.position.set(x, 0.225, z);
    arch.add(b, { cast: true });
  }

  const title = wallSign(9, 0.9, () => [
    { text: t('edu_title'), size: 0.42 },
    { text: t('edu_sub'), size: 0.2, weight: 400 },
  ]);
  title.position.set(0, 3.85, EDU.z1 - 0.02);
  title.rotation.y = Math.PI;
  scene.add(title);
  signs.push(title);

  const screens = [-1, 0, 1].map(k => {
    const g = new THREE.Group();
    g.position.set(k * 4.9, 2.15, EDU.z1 - 0.02);
    g.rotation.y = Math.PI;
    const frame = new THREE.Mesh(new RoundedBoxGeometry(SCREEN.w + 0.12, SCREEN.h + 0.12, 0.06, 2, 0.02), new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.4 }));
    frame.position.z = 0.03;
    frame.castShadow = true;
    g.add(frame);
    scene.add(g);
    return g;
  });

  const links = [
    { x: EDU.x0 + 0.02, ry: Math.PI / 2 },
    { x: EDU.x1 - 0.02, ry: -Math.PI / 2 },
  ].map(s => ({ ...s, y: 2.1, z: (EDU.z0 + EDU.z1) / 2 + 0.5 }));

  return { screens, links };
}

export function videoPanel(video, image) {
  const panel = textPanel(SCREEN.w, SCREEN.h, (g, W, H, { wrap }) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    if (image) {
      const s = Math.max(W / image.width, H / image.height);
      g.drawImage(image, (W - image.width * s) / 2, (H - image.height * s) / 2, image.width * s, image.height * s);
    }
    const grad = g.createLinearGradient(0, H * 0.55, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = grad;
    g.fillRect(0, H * 0.55, W, H * 0.45);
    g.fillStyle = 'rgba(230,154,169,0.95)';
    g.beginPath();
    g.arc(W / 2, H * 0.42, H * 0.11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(W / 2 - H * 0.035, H * 0.42 - H * 0.055);
    g.lineTo(W / 2 - H * 0.035, H * 0.42 + H * 0.055);
    g.lineTo(W / 2 + H * 0.06, H * 0.42);
    g.fill();
    const key = `video.${video.id}`;
    const title = t(key) === key ? video.title : t(key);
    g.font = `700 ${H * 0.062}px ${FONT}`;
    let y = H * 0.8;
    const lines = wrap(title, W * 0.9);
    y -= (lines.length - 1) * H * 0.075;
    for (const l of lines) { g.fillText(l, W * 0.05, y); y += H * 0.075; }
    g.font = `500 ${H * 0.042}px ${FONT}`;
    g.fillStyle = '#f4b6c2';
    g.fillText(`${video.author} · ${t('edu_in_danish')}`, W * 0.05, H * 0.94);
  }, 600);
  panel.material = new THREE.MeshBasicMaterial({ map: panel.material.map, toneMapped: false });
  panel.position.z = 0.065;
  return panel;
}

export function linkPanel(link) {
  const W = 3.4, H = 1.9;
  const panel = textPanel(W, H, (g, cw, ch, { wrap }) => {
    const grad = g.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, '#0f5f42');
    grad.addColorStop(1, '#14855a');
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(0, 0, cw, ch, ch * 0.06);
    g.fill();
    g.fillStyle = '#f4b6c2';
    g.fillRect(0, ch * 0.9, cw, ch * 0.1);
    g.fillStyle = '#fff';
    g.font = `800 ${ch * 0.2}px ${FONT}`;
    g.fillText(link.label, cw * 0.07, ch * 0.3);
    g.font = `400 ${ch * 0.075}px ${FONT}`;
    g.fillStyle = '#e8f4ee';
    let y = ch * 0.47;
    for (const l of wrap(t(`link_${link.key}`), cw * 0.86)) { g.fillText(l, cw * 0.07, y); y += ch * 0.1; }
    g.font = `700 ${ch * 0.08}px ${FONT}`;
    g.fillStyle = '#f4b6c2';
    g.fillText(`${t('link_visit')} ${link.url.replace(/^https?:\/\//, '')} ↗`, cw * 0.07, ch * 0.83);
  }, 400);
  panel.material = new THREE.MeshBasicMaterial({ map: panel.material.map, transparent: true, toneMapped: false });
  return panel;
}
