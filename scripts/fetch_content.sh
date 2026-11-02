#!/usr/bin/env bash
set -euo pipefail
c="$(cd "$(dirname "$0")/.." && pwd)/web/content"
mkdir -p "$c/pdb" "$c/posters"
grep -o '"pdb": *"[0-9A-Za-z]\{4\}"' "$c/manifest.json" | grep -o '[0-9A-Za-z]\{4\}"$' | tr -d '"' | while read -r id; do
  [ -s "$c/pdb/$id.cif.gz" ] || curl -sfL "https://files.rcsb.org/download/$id.cif.gz" -o "$c/pdb/$id.cif.gz"
done
