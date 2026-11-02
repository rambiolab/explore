import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { T, uvBox } from '../arch.js';
import { HUB, DOOR } from './hub.js';
import { wallSign, textPanel, FONT } from '../text.js';
import { t } from '../i18n.js';

export const GALLERY = { x0: -9, x1: 9, z0: -42.5, z1: HUB.z0 - 2 * T, h: 4.5 };

export function buildGallery(ctx) {
  const { arch, mats, scene, signs, tier } = ctx;
  arch.room({ ...GALLERY, floor: mats.parquet, floorTile: 3, openings: { s: [{ c: 0, ...DOOR }] } });
  arch.doorway('x', HUB.z0 - T, 0, DOOR.w, DOOR.h);

  const runLen = GALLERY.z1 - GALLERY.z0 - 6;
  const runner = arch.box(2.2, 0.012, runLen, 0, 0.006, (GALLERY.z0 + GALLERY.z1) / 2 + 1, mats.carpet);
  runner.geometry = uvBox(2.2, 0.012, runLen, 1.2);
  for (const s of [-1, 1]) arch.box(0.05, 0.016, runLen, s * 1.1, 0.008, runner.position.z, mats.dado);

  for (let z = GALLERY.z1 - 2.5; z > GALLERY.z0; z -= 4) arch.box(5, 0.04, 0.35, 0, GALLERY.h - 0.03, z, mats.glow, { receive: false });

  const endWall = { x: 0, y: 2.35, z: GALLERY.z0 + 0.02 };

  const plinthGeo = new RoundedBoxGeometry(0.8, 1.0, 0.8, 4, 0.04);
  const pedestals = [];
  for (let k = 0; k < 10; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    const x = side * 3.6;
    const z = GALLERY.z1 - 4.5 - Math.floor(k / 2) * 5.5;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(plinthGeo, mats.stone);
    base.position.y = 0.5;
    base.castShadow = base.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.03, 0.84), mats.brass);
    cap.position.y = 1.015;
    const holder = new THREE.Group();
    holder.position.y = 1.9;
    g.add(base, cap, holder);
    scene.add(g);
    arch.blockCircle(x, z, 0.75);
    if (tier === 'high') {
      const s = new THREE.SpotLight(0xfff2e6, 45, 7, 0.32, 0.7, 2);
      s.position.set(x - side * 1.2, GALLERY.h - 0.05, z);
      s.target.position.set(x, 1.6, z);
      scene.add(s, s.target);
    }
    pedestals.push({ group: g, holder, x, z, side });
  }
  return { pedestals, endWall };
}

export function plaque(protein) {
  return textPanel(0.9, 0.5, (g, w, h) => {
    g.fillStyle = 'rgba(30,26,22,0.92)';
    g.beginPath();
    g.roundRect(0, 0, w, h, h * 0.06);
    g.fill();
    g.fillStyle = '#c9a46a';
    g.fillRect(0, 0, w, h * 0.02);
    g.font = `700 ${h * 0.1}px ${FONT}`;
    g.fillText(`PDB ${protein.pdb}${protein.panres ? ' · ' + protein.panres.pan_gene : ''}`, w * 0.07, h * 0.22);
    g.fillStyle = '#fbfaf7';
    g.font = `700 ${h * 0.28}px ${FONT}`;
    g.fillText(protein.name, w * 0.07, h * 0.52);
    g.fillStyle = '#d8d2c6';
    g.font = `italic 400 ${h * 0.12}px ${FONT}`;
    g.fillText(protein.gene, w * 0.07, h * 0.7);
    g.fillStyle = '#f4b6c2';
    g.font = `600 ${h * 0.12}px ${FONT}`;
    g.fillText(t(`mech.${protein.mechanism}`), w * 0.07, h * 0.88);
  }, 900);
}

const fmt = n => n.toLocaleString(t('locale'));

export function panresWall(stats, tr) {
  const panel = textPanel(10, 3.6, (g, W, H, { wrap }) => {
    g.fillStyle = '#fbfaf7';
    g.beginPath();
    g.roundRect(0, 0, W, H, H * 0.03);
    g.fill();
    g.fillStyle = '#0f5f42';
    g.fillRect(0, 0, W, H * 0.2);
    g.fillStyle = '#fff';
    g.font = `800 ${H * 0.1}px ${FONT}`;
    g.fillText('PanRes', W * 0.03, H * 0.135);
    const tx = W * 0.05 + g.measureText('PanRes').width;
    g.font = `400 ${H * 0.036}px ${FONT}`;
    g.fillStyle = '#d6eee0';
    wrap(t('panres_tagline'), W * 0.95 - tx).slice(0, 2).forEach((l, i) => g.fillText(l, tx, H * (0.09 + i * 0.05)));
    const tiles = [
      [stats.original_genes, t('pw_original'), `${stats.databases.length} ${t('pw_dbs')}`],
      [stats.pan_genes, t('pw_pangenes'), `${fmt(stats.amr_genes)} ${t('pw_amr')} · ${fmt(stats.metal_genes + stats.biocide_genes)} ${t('pw_metal')}`],
      [stats.structures, t('pw_structures'), t('pw_structures_sub')],
      [stats.resistance_classes, t('pw_classes'), t('pw_classes_sub')],
    ];
    const tw = W * 0.105, th = H * 0.32;
    tiles.forEach(([n, label, sub], k) => {
      const x = W * 0.03 + (k % 2) * (tw * 2 + W * 0.02), y = H * 0.25 + Math.floor(k / 2) * (th + H * 0.04);
      g.fillStyle = '#eef6f1';
      g.beginPath(); g.roundRect(x, y, tw * 2, th, H * 0.02); g.fill();
      g.fillStyle = '#14855a';
      g.font = `800 ${H * 0.1}px ${FONT}`;
      g.fillText(fmt(n), x + W * 0.012, y + th * 0.42);
      g.fillStyle = '#1d2a24';
      g.font = `700 ${H * 0.04}px ${FONT}`;
      g.fillText(label, x + W * 0.012, y + th * 0.64);
      g.fillStyle = '#5a6a62';
      g.font = `400 ${H * 0.03}px ${FONT}`;
      let yy = y + th * 0.8;
      for (const l of wrap(sub, tw * 2 - W * 0.024).slice(0, 2)) { g.fillText(l, x + W * 0.012, yy); yy += H * 0.035; }
    });
    const cx = W * 0.5, cw = W * 0.47;
    g.fillStyle = '#0f5f42';
    g.font = `700 ${H * 0.05}px ${FONT}`;
    g.fillText(t('pw_mech_title'), cx, H * 0.29);
    const mech = Object.entries(stats.mechanisms).slice(0, 8);
    const max = mech[0][1];
    const rowH = H * 0.069, lw = cw * 0.38;
    mech.forEach(([k, n], i) => {
      const y = H * 0.34 + i * rowH;
      g.fillStyle = '#1d2a24';
      g.font = `500 ${H * 0.034}px ${FONT}`;
      g.textAlign = 'right';
      g.fillText(tr('mechp', k), cx + lw - W * 0.008, y + rowH * 0.62);
      g.textAlign = 'left';
      const bw = Math.max(2, (cw - lw - W * 0.06) * n / max);
      g.fillStyle = i ? '#e69aa9' : '#14855a';
      g.beginPath(); g.roundRect(cx + lw, y + rowH * 0.15, bw, rowH * 0.66, rowH * 0.12); g.fill();
      g.fillStyle = '#3a4a42';
      g.font = `600 ${H * 0.03}px ${FONT}`;
      g.fillText(fmt(n), cx + lw + bw + W * 0.006, y + rowH * 0.62);
    });
    g.fillStyle = '#8a948e';
    g.font = `400 ${H * 0.028}px ${FONT}`;
    g.fillText(`${t('pw_mech_note').replace('{n}', fmt(stats.mechanism_annotated)).replace('{total}', fmt(stats.pan_genes))} · ${t('pw_snapshot')} ${stats.snapshot} · panres.rambio.dk ↗`, W * 0.03, H * 0.965);
  }, 300);
  panel.material.transparent = false;
  panel.material.depthWrite = true;
  return panel;
}
