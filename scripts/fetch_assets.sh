#!/usr/bin/env bash
set -euo pipefail
a="$(cd "$(dirname "$0")/.." && pwd)/web/assets"
TEXTURES="marble_01 herringbone_parquet grey_plaster brushed_concrete poly_wool_herringbone"
mkdir -p "$a/tex"
for id in $TEXTURES; do
  for res in 1k 2k; do
    for map in diff nor_gl arm; do
      f="$a/tex/${id}_${map}_${res}.jpg"
      [ -s "$f" ] || curl -sfL "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/$res/$id/${id}_${map}_${res}.jpg" -o "$f"
    done
  done
done
{
  echo "# Asset credits"
  echo
  echo "All textures are CC0 from Poly Haven (https://polyhaven.com)."
  echo
  for id in $TEXTURES; do echo "- Texture: $id — https://polyhaven.com/a/$id"; done
} > "$a/CREDITS.md"
