import * as THREE from 'three';

export const FONT = 'Rubik, Karla, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function textPanel(widthM, heightM, draw, pxPerM = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(widthM * pxPerM);
  canvas.height = Math.round(heightM * pxPerM);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, heightM),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, depthWrite: false })
  );
  mesh.userData.redraw = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, canvas.width, canvas.height, { wrap: (s, w) => wrap(ctx, s, w) });
    tex.needsUpdate = true;
  };
  mesh.userData.redraw();
  return mesh;
}

export function wallSign(w, h, lines, { color = '#0f5f42', sub = '#14855a', align = 'center' } = {}) {
  return textPanel(w, h, (g, W, H, { wrap }) => {
    g.textAlign = align;
    const x = align === 'center' ? W / 2 : 0;
    let y = 0;
    for (const { text, size, weight = 700, fill, italic = false, gap = 0.25 } of lines()) {
      const px = H * size;
      g.font = `${italic ? 'italic ' : ''}${weight} ${px}px ${FONT}`;
      g.fillStyle = fill ?? (weight >= 600 ? color : sub);
      for (const l of wrap(text, W * 0.98)) {
        y += px;
        g.fillText(l, x, y);
        y += px * gap;
      }
    }
  });
}
