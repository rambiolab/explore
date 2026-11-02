const SKIP_HET = new Set(['HOH', 'DOD', 'SO4', 'GOL', 'EDO', 'PEG', 'PGE', 'CL', 'NA', 'K', 'ACT', 'FMT', 'MPD', 'DMS', 'BME', 'NO3', 'PO4', 'IOD', 'BR', 'TRS', 'EPE', 'MES']);

export async function fetchText(url) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return new TextDecoder().decode(buf);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function parseMmcif(text) {
  const lines = text.split('\n');
  const cols = [];
  let i = lines.findIndex(l => l.startsWith('_atom_site.'));
  for (; lines[i].startsWith('_atom_site.'); i++) cols.push(lines[i].trim().slice(11));
  const c = n => cols.indexOf(n);
  const k = {
    group: c('group_PDB'), el: c('type_symbol'), name: c('label_atom_id'), alt: c('label_alt_id'), res: c('label_comp_id'),
    x: c('Cartn_x'), y: c('Cartn_y'), z: c('Cartn_z'), b: c('B_iso_or_equiv'), chain: c('auth_asym_id'),
    seq: c('auth_seq_id'), ins: c('pdbx_PDB_ins_code'), model: c('pdbx_PDB_model_num'),
  };
  const atoms = [];
  let model = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l || l[0] === '#' || l[0] === '_' || l.startsWith('loop_')) break;
    const f = l.trim().split(/\s+/);
    if (model === null) model = f[k.model];
    if (f[k.model] !== model) break;
    atoms.push({
      hetero: f[k.group] === 'HETATM', el: f[k.el], name: f[k.name].replace(/"/g, ''), alt: f[k.alt], res: f[k.res],
      chain: f[k.chain], seq: f[k.seq] + (f[k.ins] === '?' ? '' : f[k.ins]),
      x: +f[k.x], y: +f[k.y], z: +f[k.z], b: +f[k.b],
    });
  }
  return atoms;
}

function parsePdb(text) {
  const atoms = [];
  for (const l of text.split('\n')) {
    if (l.startsWith('ENDMDL')) break;
    const rec = l.slice(0, 6);
    if (rec !== 'ATOM  ' && rec !== 'HETATM') continue;
    const name = l.slice(12, 16).trim();
    atoms.push({
      hetero: rec === 'HETATM', name, alt: l[16] === ' ' ? '.' : l[16], res: l.slice(17, 20).trim(),
      chain: l[21].trim() || 'A', seq: l.slice(22, 27).trim(),
      x: +l.slice(30, 38), y: +l.slice(38, 46), z: +l.slice(46, 54), b: +l.slice(60, 66),
      el: (l.slice(76, 78).trim() || name[0]).toUpperCase(),
    });
  }
  return atoms;
}

export function parseStructure(text, chains = null) {
  const atoms = (/^data_/m.test(text) && text.includes('_atom_site.') ? parseMmcif(text) : parsePdb(text))
    .filter(a => (a.alt === '.' || a.alt === 'A') && (!chains || chains.includes(a.chain)));
  const residues = [];
  const ligands = [];
  let cur = null;
  for (const a of atoms) {
    if (a.hetero) {
      if (!SKIP_HET.has(a.res)) ligands.push(a);
      continue;
    }
    if (!cur || cur.chain !== a.chain || cur.seq !== a.seq) {
      cur = { chain: a.chain, seq: a.seq, name: a.res, b: a.b };
      residues.push(cur);
    }
    if (a.name === 'N' || a.name === 'CA' || a.name === 'C' || a.name === 'O') cur[a.name] = [a.x, a.y, a.z];
  }
  return { residues: residues.filter(r => r.N && r.CA && r.C && r.O), ligands };
}
