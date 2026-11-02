let ctx = null;
let master = null;
let analyser = null;
let voice = null;
const levelBuf = new Uint8Array(256);

export const settings = {
  volume: +(localStorage.getItem('volume') ?? 0.8),
  muted: localStorage.getItem('muted') === '1',
};

export function saveSettings() {
  localStorage.setItem('volume', settings.volume);
  localStorage.setItem('muted', settings.muted ? '1' : '0');
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
}

export function unlock() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : settings.volume;
    master.connect(ctx.destination);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const sink = ctx.createGain();
    sink.gain.value = 0;
    analyser.connect(sink).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function env(node, t0, a, d, peak = 1) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.exponentialRampToValueAtTime(peak, t0 + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function noise(dur) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

export function sfx(type) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const g = ctx.createGain();
  g.connect(master);
  if (type === 'rifle' || type === 'shotgun') {
    const n = noise(type === 'rifle' ? 0.15 : 0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = type === 'rifle' ? 2400 : 900;
    n.connect(f).connect(g);
    env(g, t0, 0.004, type === 'rifle' ? 0.12 : 0.35, type === 'rifle' ? 0.5 : 0.8);
    n.start(t0);
    return;
  }
  const o = ctx.createOscillator();
  o.connect(g);
  if (type === 'pop') {
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t0);
    o.frequency.exponentialRampToValueAtTime(1100, t0 + 0.09);
    env(g, t0, 0.005, 0.15, 0.4);
  } else if (type === 'oops') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(330, t0);
    o.frequency.exponentialRampToValueAtTime(140, t0 + 0.3);
    env(g, t0, 0.01, 0.35, 0.4);
  } else if (type === 'bounce') {
    o.type = 'square';
    o.frequency.setValueAtTime(200, t0);
    o.frequency.exponentialRampToValueAtTime(260, t0 + 0.06);
    env(g, t0, 0.003, 0.08, 0.15);
  } else if (type === 'clank') {
    o.type = 'square';
    o.frequency.setValueAtTime(1500, t0);
    o.frequency.exponentialRampToValueAtTime(900, t0 + 0.12);
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 2130;
    o2.connect(g);
    o2.start(t0);
    o2.stop(t0 + 0.3);
    env(g, t0, 0.002, 0.22, 0.12);
  } else if (type === 'bell') {
    o.type = 'sine';
    o.frequency.value = 880;
    env(g, t0, 0.005, 0.8, 0.3);
  }
  o.start(t0);
  o.stop(t0 + 1);
}

const bufferCache = new Map();
async function loadBuffer(url) {
  if (!bufferCache.has(url)) {
    bufferCache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.arrayBuffer();
    }).then(b => ctx.decodeAudioData(b)));
  }
  return bufferCache.get(url);
}

export async function speak(url) {
  stopVoice();
  if (!ctx) return 0;
  let buf;
  try { buf = await loadBuffer(url); } catch { return 0; }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(analyser);
  src.connect(master);
  src.start();
  voice = src;
  src.onended = () => { if (voice === src) voice = null; };
  return buf.duration;
}

export function stopVoice() {
  if (voice) { try { voice.stop(); } catch {} voice = null; }
}

export function voiceLevel() {
  if (!voice || !analyser) return 0;
  analyser.getByteTimeDomainData(levelBuf);
  let s = 0;
  for (const v of levelBuf) s += ((v - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(s / levelBuf.length) * 5);
}
