import * as THREE from 'three';

export const PALETTE = {
  deep: 0x0f5f42, green: 0x14855a, mid: 0x379b60, leaf: 0x4eb377,
  pink: 0xf4b6c2, rose: 0xe69aa9, wall: 0xf3f0ea, ink: 0x1d2a24,
};

export function qualityTier() {
  const stored = localStorage.getItem('quality');
  if (stored === 'low' || stored === 'high') return stored;
  const touch = matchMedia('(pointer: coarse)').matches;
  return touch || Math.min(screen.width, screen.height) < 700 ? 'low' : 'high';
}

export async function loadMaterials(renderer, tier, onProgress = () => {}) {
  const res = tier === 'high' ? '2k' : '1k';
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.getMaxAnisotropy?.() ?? 4);
  const load = (id, map) => new Promise((ok, fail) => loader.load(`assets/tex/${id}_${map}_${res}.jpg`, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    if (map === 'diff') t.colorSpace = THREE.SRGBColorSpace;
    onProgress();
    ok(t);
  }, undefined, fail));
  const pbr = async (id, opts = {}) => {
    const [map, normalMap, arm] = await Promise.all(['diff', 'nor_gl', 'arm'].map(m => load(id, m)));
    return new THREE.MeshStandardMaterial({
      map: opts.noMap ? null : map, normalMap, roughnessMap: arm, aoMap: arm, metalnessMap: opts.metal ? arm : null,
      color: opts.color ?? 0xffffff, roughness: opts.roughness ?? 1, metalness: opts.metalness ?? 0,
      normalScale: new THREE.Vector2(opts.normal ?? 1, opts.normal ?? 1),
    });
  };
  const [marble, parquet, plaster, concrete, carpet] = await Promise.all([
    pbr('marble_01', { color: 0xf3f1ee }),
    pbr('herringbone_parquet', { normal: 0.6 }),
    pbr('grey_plaster', { noMap: true, color: PALETTE.wall, normal: 0.35 }),
    pbr('brushed_concrete', { color: 0x6d6a66 }),
    pbr('poly_wool_herringbone', { normal: 1.4 }),
  ]);
  carpet.color.setRGB(1.85, 1.12, 1.28);
  const dado = plaster.clone();
  dado.color.set(PALETTE.deep);
  return {
    marble, parquet, plaster, dado, concrete, carpet,
    stone: new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.42, normalMap: plaster.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }),
    pink: new THREE.MeshStandardMaterial({ color: PALETTE.pink, roughness: 0.55 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.32, metalness: 1 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcbf, roughness: 0.28, metalness: 1 }),
    darkwood: new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.55 }),
    skirting: new THREE.MeshStandardMaterial({ color: 0x0b3b2a, roughness: 0.6 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, emissive: 0xffffff, emissiveIntensity: 0.35 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xfffaf0 }),
    sky: new THREE.MeshBasicMaterial({ color: 0xe9f3fb }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.18, metalness: 0 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x0f2a20, transparent: true, opacity: 0.22, depthWrite: false }),
  };
}

export const TEXTURE_COUNT = 5 * 3;
