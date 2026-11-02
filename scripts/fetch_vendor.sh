#!/usr/bin/env bash
set -euo pipefail
THREE=0.187.0
PDFJS=6.5.438
root="$(cd "$(dirname "$0")/.." && pwd)"
v="$root/web/vendor"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
rm -rf "$v" && mkdir -p "$v/three/addons" "$v/pdfjs"
curl -sfL "https://registry.npmjs.org/three/-/three-$THREE.tgz" | tar -xz -C "$tmp" && mv "$tmp/package" "$tmp/three"
cp "$tmp/three/build/three.webgpu.js" "$tmp/three/build/three.core.js" "$tmp/three/build/three.tsl.js" "$v/three/"
cp "$tmp/three/LICENSE" "$v/three/"
for f in environments/RoomEnvironment.js geometries/RoundedBoxGeometry.js tsl/display/GTAONode.js utils/BufferGeometryUtils.js; do
  mkdir -p "$v/three/addons/$(dirname "$f")"
  cp "$tmp/three/examples/jsm/$f" "$v/three/addons/$f"
done
curl -sfL "https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-$PDFJS.tgz" | tar -xz -C "$tmp" && mv "$tmp/package" "$tmp/pdfjs"
cp "$tmp/pdfjs/build/pdf.min.mjs" "$tmp/pdfjs/build/pdf.worker.min.mjs" "$tmp/pdfjs/LICENSE" "$v/pdfjs/"
cp -r "$tmp/pdfjs/wasm" "$v/pdfjs/wasm"
