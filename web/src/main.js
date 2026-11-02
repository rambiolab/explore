import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadLocales, t, getLang, setLang, onLang } from './i18n.js';
import { qualityTier, loadMaterials, TEXTURE_COUNT } from './assets.js';
import { Arch } from './arch.js';
import { buildHub } from './rooms/hub.js';
import { buildGallery, plaque, panresWall } from './rooms/gallery.js';
import { buildResearch, paperSheet } from './rooms/research.js';
import { buildGame, DRUGS, DRUG_ORDER } from './rooms/game.js';
import { buildEducation, videoPanel, linkPanel } from './rooms/education.js';
import { loadCartoon } from './cartoon.js';
import { loadPoster } from './poster.js';
import { createMascot } from './mascot.js';
import { Player } from './controls.js';
import { settings, saveSettings, unlock, speak, stopVoice, voiceLevel } from './audio.js';

const VOICE = { da: 'chatterbox', en: 'piper' };
const touch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', touch);
const $ = id => document.getElementById(id);
const hashParam = name => location.hash.match(new RegExp(`${name}=([^&]+)`))?.[1];

await loadLocales();
const tierSetting = localStorage.getItem('quality') ?? 'auto';
const tier = qualityTier();

const canvas = $('c');
const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
await renderer.init();
renderer.setPixelRatio(Math.min(devicePixelRatio, tier === 'high' ? 2 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = tier === 'high';
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9f3fb);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);
scene.add(camera);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const total = TEXTURE_COUNT + 22;
let done = 0;
const tick = () => { $('progress').firstElementChild.style.width = `${Math.min(100, (100 * ++done) / total)}%`; };

const mats = await loadMaterials(renderer, tier, tick);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const arch = new Arch(scene, mats);
const ctx = { arch, mats, scene, signs: [], tier };
const hub = buildHub(ctx);
const gallery = buildGallery(ctx);
const research = buildResearch(ctx);
const game = buildGame(ctx);
const edu = buildEducation(ctx);
game.attach(camera);

const mascot = createMascot();
mascot.root.position.copy(hub.mascotSpot);
mascot.root.rotation.y = 0.6;
mascot.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
scene.add(mascot.root);
arch.blockCircle(hub.mascotSpot.x, hub.mascotSpot.z, 0.75);

const player = new Player(camera, canvas, { isValid: arch.isValid, start: hub.start });
const pos = hashParam('pos')?.split(',').map(Number);
if (pos) {
  player.pos.set(pos[0], 0, pos[1]);
  player.yaw = pos[2] ?? 0;
  player.pitch = pos[3] ?? 0;
}

const exhibits = [];
const spinners = [];
const clickables = [];
const clickable = (object, label, url) => clickables.push({ object, label, url });
const loadImage = url => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
const getJson = async url => (await fetch(url)).json();

const tr = (prefix, val) => {
  const k = `${prefix}.${val}`;
  const s = t(k);
  return s === k ? val.replace(/_/g, ' ') : s;
};

const [content, manifest, media, stats] = await Promise.all(
  ['content/proteins.json', 'content/manifest.json', 'content/media.json', 'content/panres_stats.json'].map(getJson));

const classicJobs = content.classics.map(async (p, k) => {
  const ped = gallery.pedestals[k];
  if (!ped) return;
  const c = await loadCartoon(`content/pdb/${p.pdb}.cif.gz`, { chains: p.chains, size: 1.2 });
  ped.holder.add(c.group);
  spinners.push({ obj: c.group, seed: k });
  const pl = plaque(p);
  pl.position.set(-ped.side * 0.62, 0.8, 0);
  pl.rotation.set(0, -ped.side * Math.PI / 2, 0);
  pl.rotateX(-0.4);
  ped.group.add(pl);
  ctx.signs.push(pl);
  exhibits.push({ x: ped.x, z: ped.z, r: 2.6, kind: 'classic', data: p });
  tick();
});

const dayIndex = +(hashParam('day') ?? Math.floor(Date.now() / 86400000));
const groups = Object.keys(content.daily);
const dailyGroup = groups[((dayIndex % groups.length) + groups.length) % groups.length];
const pool = content.daily[dailyGroup];
const daily = pool[(Math.imul(dayIndex ^ 0x9e3779b9, 2654435761) >>> 0) % pool.length];
const dailyJob = loadCartoon(`content/${daily.file}`, { size: 2.3 }).then(c => {
  hub.centre.add(c.group);
  spinners.push({ obj: c.group, seed: 99 });
  exhibits.push({ x: 0, z: 0, r: 3.4, kind: 'daily', data: daily, group: dailyGroup });
  tick();
});

const posterJobs = manifest.posters.map(async (ps, k) => {
  const slot = research.posterSlots[k];
  if (!slot) return;
  const maxPx = tier === 'high' ? 5120 : 3072;
  const { texture, aspect } = await loadPoster(`content/${ps.file}`, maxPx, Math.min(16, renderer.getMaxAnisotropy?.() ?? 8));
  const h = slot.height, w = h * aspect;
  const g = new THREE.Group();
  g.position.set(slot.x, slot.y, slot.z);
  g.rotation.y = slot.ry;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.05), mats.darkwood);
  frame.position.z = 0.025;
  frame.castShadow = true;
  const mount = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.06, h + 0.06), new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.9 }));
  mount.position.z = 0.051;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75 }));
  sheet.position.z = 0.053;
  g.add(frame, mount, sheet);
  scene.add(g);
  exhibits.push({ x: slot.x - 1.6, z: slot.z, r: 2.6, kind: 'poster', data: ps });
  tick();
});

const { desk } = research;
const paperJobs = media.papers.map(async (p, k) => {
  const slot = desk.paperSlots[k];
  if (!slot) return;
  const img = p.cover ? await loadImage(`content/${p.cover}`) : null;
  const sheet = paperSheet(p, img);
  sheet.position.set(slot.px, slot.py, slot.pz);
  sheet.rotation.set(-Math.PI / 2, 0, Math.PI + slot.rz);
  desk.group.add(sheet);
  if (!img) ctx.signs.push(sheet);
  clickable(sheet, () => `${p.title} (${p.year}) ↗`, p.url);
  tick();
});
const siteJob = loadImage(`content/${media.site.image}`).then(img => {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  desk.screen.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  clickable(desk.screen, () => `${media.site.url.replace(/^https?:\/\//, '')} ↗`, media.site.url);
  tick();
});

const videoJobs = media.videos.map(async (v, k) => {
  const screen = edu.screens[k];
  if (!screen) return;
  const img = await loadImage(`content/${v.thumb}`);
  const panel = videoPanel(v, img);
  screen.add(panel);
  ctx.signs.push(panel);
  clickables.push({ object: panel, label: () => `▶ ${t('edu_play')}`, action: () => openVideo(v) });
  tick();
});
media.links.forEach((l, k) => {
  const s = edu.links[k];
  if (!s) return;
  const p = linkPanel(l);
  p.position.set(s.x, s.y, s.z);
  p.rotation.y = s.ry;
  scene.add(p);
  ctx.signs.push(p);
  clickable(p, () => `${l.label} ↗`, l.url);
});

const wall = panresWall(stats, tr);
wall.position.set(gallery.endWall.x, gallery.endWall.y, gallery.endWall.z);
scene.add(wall);
ctx.signs.push(wall);
clickable(wall, () => 'panres.rambio.dk ↗', 'https://panres.rambio.dk');

Promise.allSettled([...classicJobs, dailyJob, ...posterJobs, ...paperJobs, siteJob, ...videoJobs]).then(results => {
  results.filter(r => r.status === 'rejected').forEach(r => console.error(r.reason));
  done = total - 1;
  tick();
  $('go').disabled = false;
});

let pipeline = null;
if (tier === 'high' && hashParam('ao') !== '0') {
  try {
    const { pass, vec4 } = await import('three/tsl');
    const { ao } = await import('three/addons/tsl/display/GTAONode.js');
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode('output');
    const aoPass = ao(scenePass.getTextureNode('depth'), null, camera);
    aoPass.resolutionScale = 0.5;
    aoPass.radius.value = 0.5;
    pipeline = new THREE.RenderPipeline(renderer);
    pipeline.outputNode = vec4(color.rgb.mul(aoPass.getTextureNode().r), color.a);
  } catch (e) {
    console.warn('AO disabled', e);
    pipeline = null;
  }
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const info = $('info');
let current = null;
function panresBlock(r) {
  if (!r) return `<p class="hint">${t('panres_missing')}</p>`;
  const tags = [...r.has_resistance_class.map(x => tr('class', x)), ...r.has_predicted_phenotype.map(x => tr('pheno', x))];
  return `
    <div class="tags">${[...new Set(tags)].map(s => `<span>${esc(s)}</span>`).join('')}</div>
    <p class="hint">${t('label_dbs')}: ${r.is_from_database.map(esc).join(', ')}</p>
    <a class="go" href="${r.panres_url}" target="_blank" rel="noopener">${t('see_panres')} ↗</a>`;
}
function renderInfo(ex) {
  const d = ex.data;
  if (ex.kind === 'classic') {
    return `
      <div class="pdb">PDB ${d.pdb}${d.panres ? ` · PanRes ${d.panres.pan_gene}` : ''}</div>
      <h2>${esc(d.name)}</h2>
      <dl>
        <dt>${t('label_gene')}</dt><dd><i>${esc(d.gene)}</i></dd>
        <dt>${t('label_host')}</dt><dd><i>${esc(d.host)}</i></dd>
        <dt>${t('label_mech')}</dt><dd>${t(`mech.${d.mechanism}`)}</dd>
        <dt>${t('label_drug')}</dt><dd>${t(`drug.${d.drug}`)}</dd>
      </dl>
      <p>${t(`desc.${d.pdb}`)}</p>
      ${panresBlock(d.panres)}
      <p class="hint">${t('rainbow_hint')}</p>`;
  }
  if (ex.kind === 'daily') {
    return `
      <div class="kicker">${t('daily_kicker')} · ${tr('group', ex.group)}</div>
      <h2>${esc(d.display_name)}</h2>
      <dl>
        <dt>PanRes</dt><dd>${d.pan_gene}</dd>
        <dt>${t('label_length')}</dt><dd>${d.residues} ${t('label_aa')}</dd>
        <dt>${t('label_mech')}</dt><dd>${d.has_mechanism_of_resistance.map(x => tr('mechp', x)).join(', ') || '–'}</dd>
      </dl>
      <p>${t('daily_body')}</p>
      ${panresBlock(d)}
      <p class="hint">${t('rainbow_hint')}</p>`;
  }
  return `<div class="kicker">${t('poster_credit')}</div><p><b>${esc(d.credit)}</b></p>`;
}
function showInfo(ex) {
  current = ex;
  if (!ex) { info.classList.add('hidden'); return; }
  info.innerHTML = renderInfo(ex);
  info.classList.remove('hidden');
}

const lines = ['mascot.0', 'mascot.1', 'mascot.2', 'mascot.3'];
const speech = { el: $('speech'), idx: 0, resume: 0, shown: 0, rate: 45, active: false, finished: false, away: 0 };
const speechText = speech.el.querySelector('.text');
const speechNext = speech.el.querySelector('.next');

async function say(i) {
  speech.idx = i;
  speech.shown = 0;
  speech.active = true;
  speech.away = 0;
  speech.rate = 45;
  speech.el.classList.remove('hidden');
  speechNext.textContent = t('mascot.next');
  if (i === 0) mascot.wave();
  speech.el.style.opacity = 1;
  const dur = await speak(`audio/${VOICE[getLang()]}/${getLang()}/mascot_${i}.mp3`);
  if (dur > 0 && speech.idx === i) speech.rate = t(lines[i]).length / dur;
  else if (speech.idx === i) mascot.talk(t(lines[i]).length / 45);
}
function closeSpeech(finished) {
  speech.active = false;
  speech.finished = finished;
  speech.resume = finished ? 0 : speech.idx;
  speech.el.classList.add('hidden');
  stopVoice();
}
function advance() {
  if (!speech.active) return false;
  const full = t(lines[speech.idx]);
  if (speech.shown < full.length) { speech.shown = full.length; return true; }
  if (speech.idx + 1 < lines.length) say(speech.idx + 1);
  else closeSpeech(true);
  return true;
}
speech.el.addEventListener('click', advance);

const prompt = $('prompt');
let promptAction = null;
function setPrompt(text, action) {
  promptAction = text ? action : null;
  if (text) { prompt.textContent = text; prompt.classList.remove('hidden'); }
  else prompt.classList.add('hidden');
}
prompt.addEventListener('click', () => promptAction?.());

let entered = false;
let paused = true;
let gaming = false;
const ndc = new THREE.Vector2();
const centre = new THREE.Vector2();

const drugBar = $('drugs');
drugBar.innerHTML = DRUG_ORDER.map((id, k) => `
  <button class="drug" data-drug="${id}" style="--c:${DRUGS[id].color}">
    <span class="dose ${DRUGS[id].form}" style="--c:${DRUGS[id].color}"></span>
    <b data-i18n="drug_${id}"></b><small></small><kbd>${k + 1}</kbd>
  </button>`).join('');
drugBar.querySelectorAll('.drug').forEach(b => b.onclick = () => game.setDrug(b.dataset.drug));
const specKey = d => `spec_${d.spectrum === '+-' ? 'broad' : d.spectrum === '+' ? 'pos' : 'neg'}`;

function updateHud() {
  $('gScore').textContent = `${t('game_score')} ${game.score}`;
  $('gTime').textContent = `${Math.ceil(game.timeLeft)} s`;
  drugBar.querySelectorAll('.drug').forEach(b => {
    const d = DRUGS[b.dataset.drug];
    b.classList.toggle('on', b.dataset.drug === game.drug);
    b.querySelector('b').textContent = t(`drug_${b.dataset.drug}`);
    b.querySelector('small').textContent = `${t(d.form === 'tablet' ? 'game_rifle' : 'game_shotgun')} · ${t(specKey(d))}`;
  });
}
game.on('hud', updateHud);
let toastTimer = 0;
game.on('phase', p => {
  $('gToast').innerHTML = `<b>${t(`game_phase${p}_title`)}</b><span>${t(`game_phase${p}`)}</span>`;
  $('gToast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('gToast').classList.add('hidden'), 6500);
});
game.on('popup', (p, text, cls) => {
  const s = p.clone().project(camera);
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.textContent = text;
  el.style.left = `${(s.x * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-s.y * 0.5 + 0.5) * innerHeight}px`;
  $('popups').append(el);
  setTimeout(() => el.remove(), 900);
});

function card(kicker, title, body, stats, next, onNext) {
  $('rcKicker').textContent = kicker;
  $('rcTitle').textContent = title;
  $('rcBody').innerHTML = body;
  $('rcStats').textContent = stats;
  $('rcNext').textContent = next;
  $('rcNext').onclick = () => { $('roundcard').classList.add('hidden'); onNext(); };
  $('roundcard').classList.remove('hidden');
}
game.on('over', () => {
  updateHud();
  $('gToast').classList.add('hidden');
  const st = game.stats;
  card(t('game_over_kicker'), `${t('game_final')}: ${game.score}`, t('game_over_body').split('\n').map(p => `<p>${esc(p)}</p>`).join(''),
    `${t('game_stats_path')}: ${st.pathogen} · ${t('game_stats_comm')}: ${st.commensal} · ${t('game_stats_resisted')}: ${st.resisted}`,
    t('game_again'), () => { game.start(); introCard(); });
});
$('rcLeave').onclick = () => { $('roundcard').classList.add('hidden'); stopGame(); };

function introCard() {
  updateHud();
  card(t('game_title'), t('game_how'), t('game_intro').split('\n').map(p => `<p>${esc(p)}</p>`).join(''), '', t('game_go'), () => game.play());
}

function startGame() {
  unlock();
  gaming = true;
  setPrompt(null);
  showInfo(null);
  closeSpeech(false);
  const s = game.stand;
  player.pos.set(s.x, 0, s.z);
  player.yaw = s.yaw;
  player.pitch = 0;
  player.enabled = false;
  player.mouseLook = false;
  player.pitchLimit = 0.45;
  document.body.classList.add('gaming');
  $('crosshair').style.display = touch ? '' : 'none';
  $('gamehud').classList.remove('hidden');
  game.start();
  introCard();
}
function stopGame() {
  gaming = false;
  game.stop();
  player.enabled = true;
  player.mouseLook = true;
  player.pitchLimit = 1.2;
  document.body.classList.remove('gaming');
  $('crosshair').style.display = touch ? 'none' : '';
  $('gamehud').classList.add('hidden');
  $('gToast').classList.add('hidden');
  $('roundcard').classList.add('hidden');
}
$('gQuit').onclick = stopGame;
$('gFire').addEventListener('pointerdown', e => { e.preventDefault(); game.fire(camera, centre); });
const toNdc = e => ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
canvas.addEventListener('pointerdown', e => {
  if (gaming && e.pointerType === 'mouse' && e.button === 0 && !paused) game.fire(camera, toNdc(e));
});
canvas.addEventListener('contextmenu', e => { if (gaming) { e.preventDefault(); game.cycleDrug(1); } });
canvas.addEventListener('wheel', e => { if (gaming && !paused) game.cycleDrug(Math.sign(e.deltaY || e.deltaX)); }, { passive: true });

const raycaster = new THREE.Raycaster();
const tip = $('tip');
let hovered = null;
let press = null;
function clickableAt(x, y) {
  raycaster.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  raycaster.far = 6;
  const hits = raycaster.intersectObjects(clickables.map(c => c.object), true);
  if (!hits.length) return null;
  const first = raycaster.intersectObjects(scene.children.filter(o => o !== camera && o !== mascot.root), true)[0];
  const c = clickables.find(c => { let o = hits[0].object; while (o) { if (o === c.object) return true; o = o.parent; } return false; });
  if (!c || (first && first.distance < hits[0].distance - 0.05)) return null;
  return c;
}
function activate(c) {
  if (c.action) c.action();
  else window.open(c.url, '_blank', 'noopener');
}
canvas.addEventListener('pointerdown', e => { press = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (!press || gaming || paused) return;
  const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
  press = null;
  if (moved > 6) return;
  const c = clickableAt(e.clientX, e.clientY);
  if (c) activate(c);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  if (gaming) { toNdc(e); return; }
  if (paused || e.buttons) return;
  hovered = clickableAt(e.clientX, e.clientY);
  canvas.classList.toggle('pointing', !!hovered);
  if (hovered) {
    tip.textContent = hovered.label();
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
    tip.classList.remove('hidden');
  } else tip.classList.add('hidden');
});

function openVideo(v) {
  $('videoFrame').src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`;
  $('videoLink').href = `https://www.youtube.com/watch?v=${v.id}`;
  const key = `video.${v.id}`;
  $('videoTitle').textContent = t(key) === key ? v.title : t(key);
  stopVoice();
  openOverlay('video');
}

const overlays = { help: $('help'), menu: $('menu'), video: $('video') };
function openOverlay(name) {
  paused = true;
  tip.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  Object.entries(overlays).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
  if (name === 'menu') {
    $('setLang').value = getLang();
    $('setQuality').value = tierSetting;
    $('setVolume').value = settings.volume;
    $('setMute').checked = settings.muted;
    $('setCapture').checked = player.capture;
  }
}
function closeOverlays() {
  Object.values(overlays).forEach(el => el.classList.add('hidden'));
  $('videoFrame').src = 'about:blank';
  paused = !entered;
}
document.querySelectorAll('.overlay .close').forEach(b => b.onclick = closeOverlays);
$('helpBtn').onclick = () => openOverlay('help');
$('menuBtn').onclick = () => openOverlay('menu');
$('showHelp').onclick = () => openOverlay('help');
$('setLang').onchange = e => setLang(e.target.value);
$('setQuality').onchange = e => {
  if (e.target.value === 'auto') localStorage.removeItem('quality'); else localStorage.setItem('quality', e.target.value);
  location.reload();
};
$('setVolume').oninput = e => { settings.volume = +e.target.value; saveSettings(); };
$('setMute').onchange = e => { settings.muted = e.target.checked; saveSettings(); };
$('setCapture').onchange = e => player.setCapture(e.target.checked);

addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Escape') {
    if (Object.values(overlays).some(o => !o.classList.contains('hidden'))) closeOverlays();
    else if (entered) openOverlay('menu');
    return;
  }
  if (paused) return;
  if (e.code === 'KeyH') { openOverlay('help'); return; }
  if (gaming) {
    const n = +e.key;
    if (n >= 1 && n <= DRUG_ORDER.length) game.setDrug(DRUG_ORDER[n - 1]);
    if (e.code === 'Space') game.fire(camera, touch ? centre : ndc);
    return;
  }
  if (e.code === 'Space' || e.code === 'KeyF' || e.code === 'Enter') {
    if (!advance()) promptAction?.();
  }
});

const langBtn = $('lang');
const refreshChrome = () => {
  langBtn.textContent = getLang() === 'da' ? 'English' : 'Dansk';
  $('controls').textContent = t(touch ? 'controls_touch' : 'controls_desktop');
  document.title = `${t('title')} ${t('title_sub')} · RaMBio`;
};
refreshChrome();
langBtn.onclick = () => setLang(getLang() === 'da' ? 'en' : 'da');
onLang(() => {
  refreshChrome();
  ctx.signs.forEach(s => s.userData.redraw());
  if (current) showInfo(current);
  if (speech.active) { stopVoice(); say(speech.idx); }
  if (gaming) updateHud();
});

$('go').onclick = () => {
  unlock();
  entered = true;
  paused = false;
  $('start').classList.add('gone');
  player.enabled = true;
  $('crosshair').style.display = touch ? 'none' : '';
  if (player.capture && !touch) canvas.requestPointerLock?.();
};

if (hashParam('debug')) window.__amr = { game, camera, player, clickables, activate, speech, exhibits, get current() { return current; } };

const timer = new THREE.Timer();
timer.connect(document);
const v = new THREE.Vector3();
renderer.setAnimationLoop(stamp => {
  timer.update(stamp);
  const dt = Math.min(timer.getDelta(), 0.05);
  const time = timer.getElapsed();
  player.update(paused ? 0 : dt);

  if (gaming) {
    player.yaw = THREE.MathUtils.clamp(player.yaw, game.stand.yaw - 0.9, game.stand.yaw + 0.9);
    camera.updateMatrixWorld();
    game.pointGuns(camera, touch ? centre : ndc);
    game.update(paused ? 0 : dt, time);
    if (game.state === 'play') $('gTime').textContent = `${Math.ceil(game.timeLeft)} s`;
  } else {
    game.update(dt, time);
    if (entered && !paused) setPrompt(game.zone(player.pos) ? t(touch ? 'game_prompt_touch' : 'game_prompt') : null, startGame);
  }

  const toMascot = Math.hypot(player.pos.x - mascot.root.position.x, player.pos.z - mascot.root.position.z);
  mascot.level = voiceLevel();
  mascot.update(time, dt, toMascot < 8 ? player.pos : null);
  v.copy(mascot.headPosition).project(camera);
  const onScreen = v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 1.1;
  if (entered && !gaming && !paused) {
    if (toMascot < 3.6 && onScreen && !speech.active && !speech.finished) say(speech.resume);
    if (toMascot > 6) { speech.finished = false; speech.resume = 0; }
  }
  if (speech.active) {
    speech.away = onScreen ? 0 : speech.away + dt;
    if (toMascot > 4.5 || speech.away > 1) closeSpeech(false);
  }
  if (speech.active) {
    const full = t(lines[speech.idx]);
    speech.shown = Math.min(full.length, speech.shown + dt * speech.rate);
    speechText.textContent = full.slice(0, Math.floor(speech.shown));
    const r = speech.el.getBoundingClientRect();
    const sx = (v.x * 0.5 + 0.5) * innerWidth - r.width / 2;
    const sy = Math.max(60, (-v.y * 0.5 + 0.5) * innerHeight - r.height - 14);
    speech.el.style.opacity = speech.away > 0 ? 0 : 1;
    speech.el.style.transform = `translate(${sx}px, ${sy}px)`;
  }

  for (const s of spinners) {
    s.obj.rotation.y = time * 0.22 + s.seed;
    s.obj.rotation.x = Math.sin(time * 0.3 + s.seed) * 0.12;
    s.obj.position.y = Math.sin(time * 0.7 + s.seed) * 0.04;
  }
  if (!gaming) {
    const d = ex => Math.hypot(player.pos.x - ex.x, player.pos.z - ex.z);
    let best = current && d(current) < current.r + 0.8 ? current : null;
    if (!best) {
      let bestD = Infinity;
      for (const ex of exhibits) { const dd = d(ex); if (dd < ex.r && dd < bestD) { bestD = dd; best = ex; } }
    }
    if (best !== current) showInfo(best);
  }

  if (pipeline) pipeline.render();
  else renderer.render(scene, camera);
});
