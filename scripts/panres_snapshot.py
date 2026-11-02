#!/usr/bin/env python3
import gzip
import hashlib
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

BASE = "https://panres.rambio.dk"
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
WEB = ROOT / "web" / "content"
OUT_PDB = WEB / "panres"
PER_CLASS = 8
MIN_CLASS = 3
MIN_PLDDT = 80.0
GROUPS = {
    "Beta_Lactam": {"Beta_Lactam"},
    "Aminoglycoside": {"Aminoglycoside"},
    "Tetracycline": {"Tetracycline"},
    "MLS": {"Macrolide", "Lincosamide", "Streptogramin", "Pleuromutilin", "Pleuromutilins"},
    "Quinolone": {"Fluoroquinolone", "Quinolone"},
    "Phenicol": {"Phenicol"},
    "Folate_Pathway_Antagonist": {"Folate_Pathway_Antagonist"},
    "Glycopeptide": {"Glycopeptide"},
    "Polymyxin": {"Polymyxin", "Peptide", "Lipopeptide", "Polypeptide"},
    "Fosfomycin": {"Fosfomycin"},
    "Rifamycin": {"Rifamycin"},
    "Oxazolidinone": {"Oxazolidinone"},
}
PROPS = ["has_resistance_class", "has_mechanism_of_resistance", "has_predicted_phenotype", "is_from_database", "same_as"]


def fetch(url, dest):
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=60) as r:
            dest.write_bytes(r.read())
    return dest


def values(subject, prop):
    return [v["value"] for v in subject["properties"].get(prop, [])]


def mean_plddt(pdb_text):
    b = [float(l[60:66]) for l in pdb_text.splitlines() if l.startswith("ATOM") and l[12:16].strip() == "CA"]
    return sum(b) / len(b) if b else 0.0, len(b)


def family(name):
    base = re.sub(r"\(.*?\)", "", name)
    return re.split(r"[-_.\d]", base, maxsplit=1)[0].lower() or name.lower()


def record(gid, s, disp):
    rec = {"pan_gene": gid, "display_name": disp.get(gid) or gid, "panres_url": f"{BASE}/#details/{gid}"}
    for p in PROPS:
        rec[p] = values(s, p)
    prot = values(s, "translates_to")
    rec["pan_protein"] = prot[0] if prot else None
    rec["has_length"] = int(values(s, "has_length")[0]) if values(s, "has_length") else None
    card = values(s, "card_link")
    rec["card_link"] = card[0] if card else None
    return rec


def stats(subjects, sha):
    types = Counter(t for v in subjects.values() for t in v["types"])
    genes = [v for v in subjects.values() if "PanGene" in v["types"]]
    mech, dbs, classes, annotated = Counter(), set(), set(), 0
    for g in genes:
        m = set(values(g, "has_mechanism_of_resistance"))
        annotated += bool(m)
        mech.update(m)
        dbs.update(values(g, "is_from_database"))
        classes.update(values(g, "has_resistance_class"))
    return {
        "snapshot": date.today().isoformat(),
        "panres_json_sha256": sha,
        "original_genes": types["OriginalGene"],
        "pan_genes": len(genes),
        "amr_genes": types["AntimicrobialResistanceGene"],
        "metal_genes": types["MetalResistanceGene"],
        "biocide_genes": types["BiocideResistanceGene"],
        "structures": types["PanStructure"],
        "resistance_classes": len(classes),
        "databases": sorted(dbs),
        "mechanism_annotated": annotated,
        "mechanisms": dict(mech.most_common()),
    }


def main():
    subjects = json.loads(fetch(f"{BASE}/panres2.json", CACHE / "panres2.json").read_text())["subjects"]
    disp_lines = fetch(f"{BASE}/PanDisplayNames.tsv", CACHE / "PanDisplayNames.tsv").read_text(encoding="latin-1").splitlines()
    disp = {}
    for line in disp_lines[1:]:
        f = line.split("\t")
        if len(f) > 1 and f[1]:
            disp[f[0]] = f[1]

    manifest = json.loads((WEB / "manifest.json").read_text())
    classics = []
    for p in manifest["proteins"]:
        gid = p.get("panres")
        entry = dict(p)
        if gid and gid in subjects:
            entry["panres"] = record(gid, subjects[gid], disp)
        else:
            entry["panres"] = None
            print(f"WARNING: {p['name']}: no PanRes entry {gid!r}", file=sys.stderr)
        classics.append(entry)

    by_class = defaultdict(list)
    for gid, s in subjects.items():
        if "PanGene" not in s["types"] or "AntimicrobialResistanceGene" not in s["types"]:
            continue
        prot = values(s, "translates_to")
        if not prot or f"{prot[0]}_struct" not in subjects:
            continue
        name = disp.get(gid)
        if not name:
            continue
        classes = set(values(s, "has_resistance_class"))
        for group, members in GROUPS.items():
            if classes and classes <= members:
                by_class[group].append((len(values(s, "is_from_database")), name, gid))

    OUT_PDB.mkdir(parents=True, exist_ok=True)
    daily = {}
    for cls in GROUPS:
        picked, families = [], set()
        for ndb, name, gid in sorted(by_class[cls], key=lambda t: (-t[0], t[1])):
            if len(picked) >= PER_CLASS:
                break
            fam = family(name)
            if fam in families:
                continue
            prot = values(subjects[gid], "translates_to")[0]
            struct = f"{prot}_struct"
            raw = fetch(f"{BASE}/PDBs/{struct}.pdb", CACHE / "PDBs" / f"{struct}.pdb").read_text()
            plddt, nres = mean_plddt(raw)
            if plddt < MIN_PLDDT:
                continue
            atoms = "".join(l + "\n" for l in raw.splitlines() if l.startswith(("ATOM", "HETATM", "TER", "END")))
            (OUT_PDB / f"{struct}.pdb.gz").write_bytes(gzip.compress(atoms.encode(), mtime=0))
            rec = record(gid, subjects[gid], disp)
            rec.update({"pan_structure": struct, "file": f"panres/{struct}.pdb.gz", "mean_plddt": round(plddt, 1), "residues": nres})
            picked.append(rec)
            families.add(fam)
        if len(picked) >= MIN_CLASS:
            daily[cls] = picked

    out = {
        "source": BASE,
        "panres_json_sha256": hashlib.sha256((CACHE / "panres2.json").read_bytes()).hexdigest(),
        "classics": classics,
        "daily": daily,
    }
    (WEB / "proteins.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    (WEB / "panres_stats.json").write_text(json.dumps(stats(subjects, out["panres_json_sha256"]), indent=1))

    print("classic proteins:")
    for c in classics:
        r = c["panres"]
        print(f"  {c['name']:<12} {c['pdb']}  ->  {r['pan_gene'] + ' ' + r['display_name'] if r else 'NOT IN PANRES'}")
    print("protein of the day pool:")
    for cls, recs in daily.items():
        print(f"  {cls:<28} {len(recs)}  " + ", ".join(f"{r['display_name']}({r['mean_plddt']:.0f})" for r in recs))


if __name__ == "__main__":
    main()
