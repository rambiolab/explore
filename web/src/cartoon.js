import * as THREE from 'three';
import { parseStructure, fetchText } from './structure.js';
import { assignSecondaryStructure } from './ss.js';

const SAMPLES = 8;
const RING = 12;
const SHAPE = {
  C: [0.7, 0.7],
  H: [2.4, 0.55],
  G: [2.4, 0.55],
  E: [2.2, 0.55],
};
const ARROW = 3.6;
const RADIUS = { C: 1.7, N: 1.55, O: 1.52, S: 1.8, P: 1.8 };

const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);

function catmull(p0, p1, p2, p3, t, out) {
  const t2 = t * t, t3 = t2 * t;
  return out.set(0, 0, 0)
    .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t)
    .addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
    .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t)
    .addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
}

function segments(residues) {
  const segs = [];
  let cur = [];
  residues.forEach((r, i) => {
    const prev = residues[i - 1];
    if (prev && (prev.chain !== r.chain || prev.CA && Math.hypot(...r.CA.map((v, k) => v - prev.CA[k])) > 4.3)) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push(i);
  });
  if (cur.length > 1) segs.push(cur);
  return segs;
}

function buildRibbon(residues, ss) {
  const pos = [], nrm = [], resIdx = [], index = [];
  const centre = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3();

  for (const seg of segments(residues)) {
    const n = seg.length;
    const P = seg.map((ri, k) => {
      const p = v3(residues[ri].CA);
      if (ss[ri] === 'E' && k > 0 && k < n - 1 && ss[seg[k - 1]] === 'E' && ss[seg[k + 1]] === 'E') {
        p.multiplyScalar(2).add(v3(residues[seg[k - 1]].CA)).add(v3(residues[seg[k + 1]].CA)).multiplyScalar(0.25);
      }
      return p;
    });
    const S = [];
    seg.forEach((ri, k) => {
      const r = residues[ri];
      const s = v3(r.O).sub(v3(r.C)).normalize();
      if (k > 0 && s.dot(S[k - 1]) < 0) s.negate();
      S.push(s);
    });

    const ext = k => P[Math.max(0, Math.min(n - 1, k))];
    let ringStart = pos.length / 3;
    let rings = 0;
    const emitRing = (k, t, w, h, rIndex) => {
      catmull(ext(k - 1), ext(k), ext(k + 1), ext(k + 2), t, centre);
      catmull(ext(k - 1), ext(k), ext(k + 1), ext(k + 2), Math.min(1, t + 0.01), a);
      catmull(ext(k - 1), ext(k), ext(k + 1), ext(k + 2), Math.max(0, t - 0.01), b);
      tan.subVectors(a, b).normalize();
      side.copy(S[k]).lerp(S[Math.min(n - 1, k + 1)], t);
      side.addScaledVector(tan, -side.dot(tan)).normalize();
      up.crossVectors(tan, side).normalize();
      for (let j = 0; j < RING; j++) {
        const th = (j / RING) * Math.PI * 2;
        const c = Math.cos(th), s = Math.sin(th);
        pos.push(
          centre.x + side.x * c * w / 2 + up.x * s * h / 2,
          centre.y + side.y * c * w / 2 + up.y * s * h / 2,
          centre.z + side.z * c * w / 2 + up.z * s * h / 2,
        );
        const nx = side.x * c / w + up.x * s / h, ny = side.y * c / w + up.y * s / h, nz = side.z * c / w + up.z * s / h;
        const l = Math.hypot(nx, ny, nz);
        nrm.push(nx / l, ny / l, nz / l);
        resIdx.push(rIndex);
      }
      if (rings > 0) {
        const r0 = ringStart + (rings - 1) * RING, r1 = ringStart + rings * RING;
        for (let j = 0; j < RING; j++) {
          const j2 = (j + 1) % RING;
          index.push(r0 + j, r1 + j, r0 + j2, r0 + j2, r1 + j, r1 + j2);
        }
      }
      rings++;
    };

    for (let k = 0; k < n - 1; k++) {
      const s0 = ss[seg[k]], s1 = ss[seg[k + 1]];
      const arrow = s0 === 'E' && s1 !== 'E';
      for (let q = 0; q < SAMPLES; q++) {
        const t = q / SAMPLES;
        const ri = seg[t < 0.5 ? k : k + 1];
        let w, h;
        if (arrow) {
          if (q === 0) emitRing(k, t, SHAPE.E[0], SHAPE.E[1], seg[k]);
          w = THREE.MathUtils.lerp(ARROW, SHAPE.C[0], t);
          h = THREE.MathUtils.lerp(SHAPE.E[1], SHAPE.C[1], t);
          emitRing(k, t, w, h, seg[k]);
          continue;
        }
        const f = t * t * (3 - 2 * t);
        w = THREE.MathUtils.lerp(SHAPE[s0][0], SHAPE[s1][0], s0 === s1 ? 0 : f);
        h = THREE.MathUtils.lerp(SHAPE[s0][1], SHAPE[s1][1], s0 === s1 ? 0 : f);
        emitRing(k, t, w, h, ri);
      }
    }
    emitRing(n - 2, 1, SHAPE.C[0], SHAPE.C[1], seg[n - 1]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  geo.setIndex(index);
  return { geo, resIdx };
}

export async function loadCartoon(url, { chains = null, size = 1.2 } = {}) {
  const { residues, ligands } = parseStructure(await fetchText(url), chains);
  const ss = assignSecondaryStructure(residues);

  const center = new THREE.Vector3();
  residues.forEach(r => center.add(v3(r.CA)));
  center.divideScalar(residues.length);
  let rad = 0;
  residues.forEach(r => { rad = Math.max(rad, v3(r.CA).distanceTo(center)); });
  const scale = size / 2 / (rad + 2);

  const { geo, resIdx } = buildRibbon(residues, ss);
  geo.translate(-center.x, -center.y, -center.z);
  geo.scale(scale, scale, scale);
  geo.computeBoundingSphere();
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const ribbon = new THREE.Mesh(geo, mat);
  ribbon.castShadow = true;

  const group = new THREE.Group();
  group.add(ribbon);

  if (ligands.length) {
    const sphere = new THREE.IcosahedronGeometry(1, 2);
    const lig = new THREE.InstancedMesh(sphere, new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.5 }), ligands.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    ligands.forEach((at, k) => {
      const metal = !RADIUS[at.el];
      const r = (metal ? 1.4 : (RADIUS[at.el] ?? 1.6) * 0.55) * scale;
      m.makeScale(r, r, r).setPosition((at.x - center.x) * scale, (at.y - center.y) * scale, (at.z - center.z) * scale);
      lig.setMatrixAt(k, m);
      lig.setColorAt(k, col.set(metal ? '#9aa7b0' : at.el === 'O' ? '#e8506e' : at.el === 'N' ? '#5b6fd6' : at.el === 'S' ? '#e8c53a' : at.el === 'P' ? '#f08c2a' : '#f4b6c2'));
    });
    lig.computeBoundingSphere();
    group.add(lig);
  }

  const chainStart = new Map(), chainLen = new Map();
  residues.forEach((r, i) => {
    if (!chainStart.has(r.chain)) chainStart.set(r.chain, i);
    chainLen.set(r.chain, (chainLen.get(r.chain) ?? 0) + 1);
  });
  const attr = geo.getAttribute('color');
  const c = new THREE.Color();
  let last = -1;
  for (let v = 0; v < resIdx.length; v++) {
    if (resIdx[v] !== last) {
      last = resIdx[v];
      const r = residues[last];
      c.setHSL(0.68 * (1 - (last - chainStart.get(r.chain)) / Math.max(1, chainLen.get(r.chain) - 1)), 0.72, 0.55);
    }
    attr.setXYZ(v, c.r, c.g, c.b);
  }
  return { group, residues: residues.length, chains: chainStart.size };
}
