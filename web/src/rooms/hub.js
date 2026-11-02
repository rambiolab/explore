import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { T } from '../arch.js';
import { wallSign } from '../text.js';
import { t } from '../i18n.js';

export const HUB = { x0: -10, x1: 10, z0: -10, z1: 10, h: 7 };
export const DOOR = { w: 3.2, h: 3.4 };
const SOON = [{ c: -6, key: 'soon_tour' }, { c: 6, key: 'soon_cell' }];

export function buildHub(ctx) {
  const { arch, mats, scene, signs, tier } = ctx;
  arch.room({
    ...HUB, floor: mats.marble, floorTile: 2.5,
    openings: {
      n: [{ c: 0, ...DOOR }],
      e: [{ c: 0, ...DOOR }],
      w: [{ c: 0, ...DOOR }],
      s: [...SOON.map(s => ({ c: s.c, w: 2, h: 3 })), { c: 0, ...DOOR }],
    },
    skylight: { cx: 0, cz: 0, size: 8 },
  });
  for (const s of SOON) arch.doorway('x', HUB.z1 + T / 2, s.c, 2, 3, { closed: true });

  const sign = (keyA, keyB, w, x, y, z, ry) => {
    const m = wallSign(w, 1.0, () => [
      { text: t(keyA), size: 0.36 },
      { text: t(keyB), size: 0.17, weight: 400 },
    ]);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    signs.push(m);
  };
  sign('wing_gallery', 'wing_gallery_sub', 6, 0, 4.3, HUB.z0 + 0.02, 0);
  sign('wing_research', 'wing_research_sub', 6, HUB.x1 - 0.02, 4.3, 0, -Math.PI / 2);
  sign('wing_game', 'wing_game_sub', 6, HUB.x0 + 0.02, 4.3, 0, Math.PI / 2);
  sign('wing_learn', 'wing_learn_sub', 5.5, 0, 4.3, HUB.z1 - 0.02, Math.PI);
  for (const s of SOON) sign(s.key, 'soon', 2.6, s.c, 3.75, HUB.z1 - 0.02, Math.PI);

  const title = wallSign(9, 1.8, () => [
    { text: t('title'), size: 0.3, gap: 0.12 },
    { text: t('title_sub'), size: 0.15, weight: 500, fill: '#14855a', gap: 0.5 },
    { text: t('sign_welcome_sub'), size: 0.09, weight: 400, fill: '#3a4a42' },
  ]);
  title.position.set(0, 5.6, HUB.z0 + 0.02);
  scene.add(title);
  signs.push(title);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 1.0, 64), mats.stone);
  plinth.position.set(0, 0.5, 0);
  arch.add(plinth, { cast: true });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.04, 0.06, 64), mats.brass);
  ring.position.set(0, 1.03, 0);
  arch.add(ring, { cast: true });
  arch.blockCircle(0, 0, 1.5);
  const centre = new THREE.Group();
  centre.position.set(0, 2.45, 0);
  scene.add(centre);

  const bench = new RoundedBoxGeometry(2.4, 0.45, 0.6, 3, 0.05);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const b = new THREE.Mesh(bench, mats.darkwood);
    b.position.set(Math.sin(a) * 5.2, 0.225, Math.cos(a) * 5.2);
    b.rotation.y = a;
    arch.add(b, { cast: true });
  }

  const rugGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.012, 96, 1);
  const uv = rugGeo.getAttribute('uv'), p = rugGeo.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 1.2, p.getZ(i) / 1.2);
  const rug = new THREE.Mesh(rugGeo, mats.carpet);
  rug.position.set(-4, 0.006, 6.4);
  arch.add(rug);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.018, 8, 128), mats.dado);
  edge.rotation.x = -Math.PI / 2;
  edge.position.set(-4, 0.012, 6.4);
  arch.add(edge);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d3cc, 1.1));
  const sun = new THREE.DirectionalLight(0xfffbf4, 1.8);
  sun.position.set(1.5, 20, 3);
  sun.target.position.set(0, 0, 0);
  if (tier === 'high') {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 5, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 4;
  }
  scene.add(sun, sun.target);
  const spot = new THREE.SpotLight(0xfff0e0, 120, 14, 0.3, 0.6, 2);
  spot.position.set(0, 6.9, 2.5);
  spot.target.position.set(0, 2.2, 0);
  scene.add(spot, spot.target);

  return {
    centre,
    mascotSpot: new THREE.Vector3(-4, 0, 6.4),
    start: new THREE.Vector3(0, 0, 8.6),
  };
}
