import * as THREE from 'three';

export const T = 0.25;
const DADO = 1.1;
const SKIRT = 0.14;
const CUT = 0.02;
const FRAME = 0.12;
const TILE = 2;

export function uvBox(w, h, d, tile = TILE) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv');
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
  }
  return g;
}

export function uvPlane(w, d, tile = TILE) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  return g;
}

export class Arch {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;
    this.walk = [];
    this.circles = [];
    this.rects = [];
  }

  add(mesh, { cast = false, receive = true } = {}) {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    this.scene.add(mesh);
    return mesh;
  }

  box(w, h, d, x, y, z, mat, opts) {
    const m = new THREE.Mesh(uvBox(w, h, d), mat);
    m.position.set(x, y, z);
    return this.add(m, opts);
  }

  floor(x0, x1, z0, z1, mat, tile = 3) {
    const m = new THREE.Mesh(uvPlane(x1 - x0, z1 - z0, tile), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    return this.add(m);
  }

  ceiling(x0, x1, z0, z1, y, mat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    return this.add(m, { receive: false });
  }

  #solid(axis, line, u0, u1, y0, y1, trims) {
    if (u1 - u0 < 1e-3 || y1 - y0 < 1e-3) return;
    const { mats } = this;
    const piece = (a, b, mat, depth = T) => {
      const len = u1 - u0, h = b - a, uc = (u0 + u1) / 2, yc = (a + b) / 2;
      if (axis === 'x') this.box(len, h, depth, uc, yc, line, mat);
      else this.box(depth, h, len, line, yc, uc, mat);
    };
    if (y0 < DADO) piece(y0, Math.min(DADO, y1), mats.dado);
    if (y1 > DADO) piece(Math.max(DADO, y0), y1, mats.plaster);
    if (trims && y0 === 0) {
      piece(0, SKIRT, mats.skirting, T + 0.04);
      piece(DADO - 0.02, DADO + 0.02, mats.pink, T + 0.03);
    }
  }

  wall(axis, line, from, to, height, openings = []) {
    const ops = [...openings].sort((a, b) => a.c - b.c);
    let u = from;
    for (const o of ops) {
      const a = o.c - o.w / 2 - CUT, b = o.c + o.w / 2 + CUT;
      this.#solid(axis, line, u, a, 0, height, true);
      this.#solid(axis, line, a, b, o.h + CUT, height, false);
      u = b;
    }
    this.#solid(axis, line, u, to, 0, height, true);
  }

  room({ x0, x1, z0, z1, h, floor, floorTile = 3, ceiling = this.mats.ceiling, openings = {}, skylight = null }) {
    this.floor(x0, x1, z0, z1, floor, floorTile);
    this.wall('x', z0 - T / 2, x0 - T, x1 + T, h, openings.n);
    this.wall('x', z1 + T / 2, x0 - T, x1 + T, h, openings.s);
    this.wall('z', x0 - T / 2, z0, z1, h, openings.w);
    this.wall('z', x1 + T / 2, z0, z1, h, openings.e);
    if (skylight) {
      const { cx, cz, size } = skylight;
      const a = cx - size / 2, b = cx + size / 2, c = cz - size / 2, d = cz + size / 2;
      this.ceiling(x0, x1, z0, c, h, ceiling);
      this.ceiling(x0, x1, d, z1, h, ceiling);
      this.ceiling(x0, a, c, d, h, ceiling);
      this.ceiling(b, x1, c, d, h, ceiling);
      const shaft = 1.0, lip = 0.06, th = 0.12;
      for (const [w, dd, x, z] of [[size + 2 * th, th, cx, c - th / 2 + 0.01], [size + 2 * th, th, cx, d + th / 2 - 0.01], [th, size, a - th / 2 + 0.01, cz], [th, size, b + th / 2 - 0.01, cz]]) {
        this.box(w, shaft + lip, dd, x, h + (shaft - lip) / 2, z, this.mats.plaster, { receive: false });
      }
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mats.sky);
      sky.rotation.x = Math.PI / 2;
      sky.position.set(cx, h + shaft, cz);
      this.scene.add(sky);
      const n = 4;
      for (let k = 1; k < n; k++) {
        const o = -size / 2 + (size * k) / n;
        this.box(size, 0.12, 0.06, cx, h + shaft - 0.06, cz + o, this.mats.steel, { receive: false });
        this.box(0.06, 0.12, size, cx + o, h + shaft - 0.06, cz, this.mats.steel, { receive: false });
      }
    } else {
      this.ceiling(x0, x1, z0, z1, h, ceiling);
    }
    this.walk.push([x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3]);
  }

  doorway(axis, line, c, w, h, { closed = false, depth = 2 * T + 0.1 } = {}) {
    const { mats } = this;
    const put = (du, y, dl, sw, sh, sd, mat) => {
      if (axis === 'x') this.box(sw, sh, sd, c + du, y, line + dl, mat);
      else this.box(sd, sh, sw, line + dl, y, c + du, mat);
    };
    for (const s of [-1, 1]) put(s * (w / 2 + FRAME / 2), (h + FRAME) / 2, 0, FRAME, h + FRAME, depth, mats.pink);
    put(0, h + FRAME / 2, 0, w + 2 * FRAME, FRAME, depth, mats.pink);
    if (closed) {
      put(0, h / 2, 0, w, h, 0.08, mats.darkwood);
      for (const s of [-1, 1]) put(w * 0.32, h * 0.48, s * 0.06, 0.04, 0.4, 0.05, mats.brass);
      return;
    }
    put(0, 0.006, 0, w, 0.012, depth, mats.stone);
    const half = depth / 2 + 0.4;
    if (axis === 'x') this.walk.push([c - w / 2 + 0.3, c + w / 2 - 0.3, line - half, line + half]);
    else this.walk.push([line - half, line + half, c - w / 2 + 0.3, c + w / 2 - 0.3]);
  }

  blockCircle(x, z, r) { this.circles.push({ x, z, r }); }
  blockRect(x0, x1, z0, z1) { this.rects.push([x0, x1, z0, z1]); }

  isValid = (x, z) =>
    this.walk.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1) &&
    this.circles.every(o => (x - o.x) ** 2 + (z - o.z) ** 2 > o.r * o.r) &&
    this.rects.every(([x0, x1, z0, z1]) => x < x0 - 0.3 || x > x1 + 0.3 || z < z0 - 0.3 || z > z1 + 0.3);
}
