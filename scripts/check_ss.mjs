import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseStructure } from '../web/src/structure.js';
import { assignSecondaryStructure } from '../web/src/ss.js';

function loop(text, prefix) {
  const lines = text.split('\n');
  let i = lines.findIndex(l => l.startsWith(prefix + '.'));
  if (i < 0) return [];
  if (lines[i - 1].trim() !== 'loop_') {
    const row = {};
    for (; lines[i].startsWith(prefix + '.'); i++) {
      const [k, ...v] = lines[i].trim().split(/\s+/);
      row[k.slice(prefix.length + 1)] = v.join(' ');
    }
    return [row];
  }
  const cols = [];
  for (; lines[i].startsWith(prefix + '.'); i++) cols.push(lines[i].trim().slice(prefix.length + 1));
  const rows = [];
  for (; i < lines.length && !lines[i].startsWith('#'); i++) {
    const f = lines[i].trim().split(/\s+/);
    rows.push(Object.fromEntries(cols.map((c, k) => [c, f[k]])));
  }
  return rows;
}

const dir = new URL('../web/content/pdb/', import.meta.url);
console.log('pdb   residues  agree  H(ref/ours)  E(ref/ours)');
for (const f of readdirSync(dir).filter(f => f.endsWith('.cif.gz')).sort()) {
  const text = gunzipSync(readFileSync(new URL(f, dir))).toString();
  const { residues } = parseStructure(text);
  const ours = assignSecondaryStructure(residues).map(x => x === 'G' ? 'H' : x);
  const ref = new Map(residues.map(r => [`${r.chain}:${r.seq}`, 'C']));
  const mark = (chain, a, b, s) => { for (let k = +a; k <= +b; k++) if (ref.has(`${chain}:${k}`)) ref.set(`${chain}:${k}`, s); };
  for (const r of loop(text, '_struct_conf')) if (r.conf_type_id?.startsWith('HELX_RH_AL') || r.conf_type_id === 'HELX_P') mark(r.beg_auth_asym_id, r.beg_auth_seq_id, r.end_auth_seq_id, 'H');
  for (const r of loop(text, '_struct_sheet_range')) mark(r.beg_auth_asym_id, r.beg_auth_seq_id, r.end_auth_seq_id, 'E');
  let agree = 0, rh = 0, re = 0, oh = 0, oe = 0;
  residues.forEach((r, i) => {
    const a = ref.get(`${r.chain}:${r.seq}`), b = ours[i];
    if (a === b) agree++;
    if (a === 'H') rh++; if (a === 'E') re++; if (b === 'H') oh++; if (b === 'E') oe++;
  });
  console.log(`${f.slice(0, 4)}  ${String(residues.length).padStart(8)}  ${(100 * agree / residues.length).toFixed(0).padStart(4)}%  ${rh}/${oh}`.padEnd(40) + `${re}/${oe}`);
}
