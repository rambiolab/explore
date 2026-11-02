const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function linked(a, b) {
  return a.chain === b.chain && dist(a.C, b.N) < 2.0;
}

export function assignSecondaryStructure(res) {
  const n = res.length;
  const prevLinked = res.map((r, i) => i > 0 && linked(res[i - 1], r));
  const H = res.map((r, i) => {
    if (!prevLinked[i] || r.name === 'PRO') return null;
    const p = res[i - 1];
    const v = sub(p.C, p.O);
    const l = Math.hypot(...v);
    return [r.N[0] + v[0] / l, r.N[1] + v[1] / l, r.N[2] + v[2] / l];
  });

  const cell = 9;
  const grid = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  res.forEach((r, i) => {
    const k = key(...r.CA.map(v => Math.floor(v / cell)));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });

  const hb = new Set();
  const HB = (i, j) => i >= 0 && j >= 0 && i < n && j < n && hb.has(i * n + j);
  for (let i = 0; i < n; i++) {
    const [cx, cy, cz] = res[i].CA.map(v => Math.floor(v / cell));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(key(cx + dx, cy + dy, cz + dz)) ?? []) {
        if (Math.abs(i - j) < 2 || !H[j] || dist(res[i].CA, res[j].CA) > 9) continue;
        const O = res[i].O, C = res[i].C, N = res[j].N, h = H[j];
        const e = 27.888 * (1 / dist(O, N) + 1 / dist(C, h) - 1 / dist(O, h) - 1 / dist(C, N));
        if (e < -0.5) hb.add(i * n + j);
      }
    }
  }

  const contiguous = (i, len) => {
    for (let k = i + 1; k <= i + len; k++) if (k >= n || !prevLinked[k]) return false;
    return true;
  };
  const ss = new Array(n).fill('C');
  for (let i = 1; i + 4 < n; i++) {
    if (contiguous(i - 1, 5) && HB(i - 1, i + 3) && HB(i, i + 4)) for (let k = i; k < i + 4; k++) ss[k] = 'H';
  }
  for (let i = 1; i + 3 < n; i++) {
    if (contiguous(i - 1, 4) && HB(i - 1, i + 2) && HB(i, i + 3) && ss[i - 1] !== 'H' && ss[i + 3] !== 'H') for (let k = i; k < i + 3; k++) if (ss[k] === 'C') ss[k] = 'G';
  }

  const bridge = new Array(n).fill(false);
  const ok = i => i > 0 && i < n - 1 && prevLinked[i] && prevLinked[i + 1];
  for (let i = 1; i < n - 1; i++) {
    if (!ok(i)) continue;
    for (let j = 1; j < n - 1; j++) {
      if (Math.abs(i - j) < 3 || !ok(j) || dist(res[i].CA, res[j].CA) > 6.5) continue;
      const par = (HB(i - 1, j) && HB(j, i + 1)) || (HB(j - 1, i) && HB(i, j + 1));
      const anti = (HB(i, j) && HB(j, i)) || (HB(i - 1, j + 1) && HB(j - 1, i + 1));
      if (par || anti) { bridge[i] = true; bridge[j] = true; }
    }
  }
  for (let i = 0; i < n; i++) {
    if (ss[i] === 'H' || !bridge[i]) continue;
    const runPrev = i > 0 && (bridge[i - 1] || (i > 1 && bridge[i - 2] && prevLinked[i - 1]));
    const runNext = i < n - 1 && (bridge[i + 1] || (i < n - 2 && bridge[i + 2] && prevLinked[i + 2]));
    if (runPrev || runNext) ss[i] = 'E';
  }
  for (let i = 1; i < n - 1; i++) {
    if (ss[i] === 'C' && ss[i - 1] === 'E' && ss[i + 1] === 'E' && prevLinked[i] && prevLinked[i + 1]) ss[i] = 'E';
  }
  return ss;
}
