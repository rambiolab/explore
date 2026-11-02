# 3D AMR experience

Web-first immersive AMR exhibition, served on a rambio.dk subdomain. Rebuild of an earlier Unity/WebGL + Quest 1 prototype.

## Decisions
- Target: web first (phones + laptops). VR is nice-to-have, not core. (2026-11-02)
- Audience: everyone, staged. General gallery first, school-class features (quizzes, multiplayer tours) after. (2026-11-02)

- Languages: Danish + English from day one. All strings and voice lines in locale tables. (2026-11-02)
- Starting fresh: no assets reused from the old Unity prototype. (2026-11-02)
- First milestone: walkable gallery (posters + protein pedestals from a content manifest) + bacterium mascot with pre-generated DA/EN voice. (2026-11-02)

- Backend: as little as possible. Anything we run lives under rambio.dk; deploying from the lab GitHub is fine. (2026-11-02)
- Voice: generated locally with open-source TTS, no paid provider. Candidates: CoRal `roest-v3-chatterbox-500m` (Danish fine-tune, OpenRAIL, watermarked output) and Piper `da_DK-talesyntese` as a CPU fallback. Not yet tested. (2026-11-02)
- Mascot: an upright green rod bacterium (E. coli-like) with a cartoony face. (2026-11-02)
- Starter content: 10 classic AMR proteins listed in `web/content/manifest.json`. Regenerate with `scripts/fetch_content.sh`. (2026-11-02)

- Prototype stack: Three.js `WebGPURenderer` (falls back to WebGL2), plain ES modules, no build step and no npm. Three.js and pdf.js are pinned and vendored by `scripts/fetch_vendor.sh`. (2026-11-02)
- Palette from rambio.dk: deep #0f5f42, green #14855a, mid #379b60, leaf #4eb377, pink #f4b6c2, rose #e69aa9. (2026-11-02)

### Round 2 (interview 2026-11-05)
- Look: modern museum, realistic. CC0 PBR textures, HDRI lighting, soft shadows, ambient occlusion.
- Quality is adaptive: phones get 1K textures and no post-processing (~15 MB); laptops get 2K textures, GTAO and shadows (~40 MB).
- Layout: a central hub with wings for the protein gallery, rambio research (posters) and the game room, plus closed "coming soon" doors for the guided tour, AMR quiz and cell model.
- Proteins: the 10 classic experimental PDB structures, each linked to its PanRes entry for metadata. "Protein of the day" uses PanRes AlphaFold models and rotates through resistance classes by UTC date.
- PanRes access: a reproducible snapshot script (`scripts/panres_snapshot.py`), not live fetches. panres.rambio.dk sends no CORS headers. Field names mirror the PanRes OWL properties.
- Proteins are drawn as ribbons by our own JS cartoon renderer (can move to Rust/WASM later). Ligands and metals stay as spheres. (Colour modes superseded in round 3: rainbow only.)
- Game room: carnival shooting gallery (rules superseded in round 3).
  - Rifle = narrow-spectrum, with switchable anti-Gram+ / anti-Gram− ammo; it only kills the matching group.
  - Shotgun = broad-spectrum, kills everything in its cone.
  - Species differ in shape and colour, with a legend board.
  - Scoring: +10 per pathogen, −15 per commensal. 5 rounds.
  - Desktop uses the mouse; phones get a crosshair plus fire/weapon/ammo buttons.
- Posters: Patrick's own (PanRes poster; DKBiC26 co-assembly poster by Freitag et al.).
- Controls: click-drag look always works; pointer lock is only an optional setting (it is flaky in Parallels and hides the cursor). An Esc menu holds keybinds, language, quality and audio.
- Voice: compare Piper and CoRal Chatterbox (decided in round 3).
- Deferred: guided tour, AMR quiz.

### Round 3 (interview 2026-11-05)
- Branding: `explore.rambio.dk`. Title "Explore" + subtitle: DA "antibiotikaresistens (AMR)", EN "AntiMicrobial Resistance (AMR)".
- Never write "DTU Food": EN "DTU National Food Institute", DA "DTU Fødevareinstituttet".
- Voice: Piper for EN, CoRal Chatterbox for DA. Language picks the voice; no voice selector.
- Proteins: one colouring only, rainbow N→C. No pLDDT in the UI (the ≥80 filter for the daily pool stays internal).
- Game rebuilt around drugs and resistance:
  - Bugs are coloured by Gram stain (Gram+ purple, Gram− pink). Pathogen vs commensal is told by morphology only: no faces, no hover help. The legend lies on the counter top.
  - Tablets (narrow, rifle): penicillin → vancomycin (Gram+), gentamicin → colistin (Gram−). Capsule (broad, shotgun): imipenem, white + colour.
  - Resistant bugs carry surface-protein knobs in the colour of each drug they resist: PBP2a, VanA, AAC(6')-Ib, MCR-1, KPC/NDM-1, all gallery proteins.
  - Clusters die one cell per tablet; the capsule clears the whole cluster.
  - One continuous ~2.5 min wave that ramps up in resistance. It ends with pan-resistant bugs that nothing kills, then a closing message.
- Research room: a messy desk with a PC showing a rambio.dk snapshot, and Patrick's papers (PanRes, Flankophile, mgcalibrator, Martiny+Munk 2025) opening their DOIs. Plus a wall text on what rambio does.
- PanRes wall at the end of the gallery: headline numbers + mechanisms chart from `panres_stats.json`, drawn at runtime.
- Education room behind the centre south door of the hub: YouTube screens (thumbnail → in-page youtube-nocookie overlay) and link panels to stopAMR.dk and amr-alliancen.dk.

### Hosting (2026-11-02)
- GitHub Pages from the public repo `rambiolab/explore`. `.github/workflows/pages.yml` publishes `web/` on every push to `main`. `web/CNAME` sets `explore.rambio.dk`; DNS needs a CNAME record `explore` → `rambiolab.github.io`.
- The interview notes and original poster PDFs in the repo root are gitignored and stay local.

## Layout
- `web/` is the static site root. No build step. Run locally with `python3 -m http.server 8765 -d web`; from the Mac host, open `http://10.211.55.3:8765` while the VM serves it.
- Content:
  - `web/content/manifest.json` lists the classic proteins (PDB ID, chains, curated metadata keys, `panres` PanGene ID) and the posters.
  - `web/content/proteins.json` is generated by `scripts/panres_snapshot.py`: classics plus PanRes metadata, and a `daily` pool per class group of AlphaFold models with mean pLDDT ≥ 80. The models live in `web/content/panres/*.pdb.gz`. The same script writes `panres_stats.json` for the PanRes wall.
  - `manifest.json` also lists `papers` (DOI, optional PDF URL), `videos` (YouTube IDs), `links` and `site`. `scripts/fetch_media.py` resolves them into `media.json` and downloads into `content/research/` and `content/videos/`:
    - paper metadata from Europe PMC; page 1 rendered with `pdftoppm`;
    - YouTube oEmbed titles and thumbnails;
    - a headless-Firefox screenshot of rambio.dk.
  - A paper with no downloadable PDF is drawn as a typeset title page. Drop a PDF at `scripts/papers/<key>.pdf` to use the real page; PMC and the publishers bot-block the PanRes and Flankophile PDFs.
- `web/locales/{da,en}.json` holds every visible string, including PanRes ontology values (`class.*`, `group.*`, `mechp.*`, `pheno.*`; missing ones fall back to the raw value with `_` → space). Keys must match across languages.
- `web/src/`:
  - `arch.js`: rooms, walls with openings, door frames, collision. Each room owns its walls outside its floor; wall cut-outs are 2 cm larger than door frames, so no faces are ever coplanar (this fixed the doorway flicker).
  - `rooms/{hub,gallery,research,game,education}.js`.
    - `game.js` holds the species, drugs, phases (the director) and the first-person guns.
    - Bugs are instanced per cell; resistance knobs are one InstancedMesh with per-instance colour.
  - `assets.js`: tiers, PBR materials.
  - `structure.js` + `ss.js`: mmCIF/PDB parsing and DSSP-style secondary structure, pure JS, no three.
  - `cartoon.js`: ribbon geometry, rainbow N→C colouring.
  - `poster.js`: pdf.js → texture, with OpenJPEG wasm for JPEG 2000 images.
  - `mascot.js`, `controls.js`, `audio.js` (WebAudio SFX and voice with level-driven mouth), `main.js`.
- Lighting: neutral `RoomEnvironment` IBL plus a skylight sun (shadows on the high tier only) and spotlights. GTAO runs on the high tier. An HDRI was tried and rejected: its directional windows tinted walls brown and left blobs on glossy floors.
- Scripts:
  - `fetch_vendor.sh`: three r187, pdf.js 6.5.
  - `fetch_content.sh`: RCSB structures.
  - `fetch_assets.sh`: Poly Haven CC0 textures, credits in `web/assets/CREDITS.md`.
  - `panres_snapshot.py`
  - `check_ss.mjs`: DSSP vs deposited helix/sheet records; 90–94% agreement.
  - `fetch_media.py`: papers, videos, site snapshot → `media.json`.
  - `tts/setup.sh` + `tts/generate.py`: Piper EN → `web/audio/piper/en/`, CoRal Chatterbox DA → `web/audio/chatterbox/da/`. Its venv is `scripts/tts/.venv`. Rerun after editing `mascot.*` lines.
- URL hash options:
  - `#pos=x,z,yaw[,pitch]`: start position.
  - `#day=N`: force a protein-of-the-day index.
  - `#ao=0`: disable ambient occlusion.
  - `#debug=1`: exposes `window.__amr`.

## Open
- Engine: trying Three.js first. Bevy is not ruled out. See response-8-topics.md §1.
