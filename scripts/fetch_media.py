#!/usr/bin/env python3
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "web" / "content"
LOCAL_PDFS = Path(__file__).resolve().parent / "papers"
UA = {"User-Agent": "Mozilla/5.0 (rambio explore media fetch)"}
FIREFOX = next((p for p in ["/snap/firefox/current/usr/lib/firefox/firefox", shutil.which("firefox")] if p and Path(p).exists()), "firefox")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def europepmc(doi):
    q = urllib.parse.quote(f'DOI:"{doi}"')
    res = json.loads(get(f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query={q}"))
    hits = res["resultList"]["result"]
    if not hits:
        sys.exit(f"no Europe PMC record for {doi}")
    r = hits[0]
    authors = [a.get("lastName", a.get("collectiveName", "")) for a in r.get("authorList", {}).get("author", [])]
    journal = r.get("journalInfo", {}).get("journal", {}).get("title") or r.get("bookOrReportDetails", {}).get("publisher") or "bioRxiv"
    return {
        "title": r["title"].rstrip("."),
        "authors": authors,
        "journal": journal,
        "year": int(r["pubYear"]),
        "abstract": " ".join(r.get("abstractText", "").split()),
    }


def first_page(key, url, out):
    pdf = LOCAL_PDFS / f"{key}.pdf"
    with tempfile.TemporaryDirectory() as tmp:
        if not pdf.exists() and url:
            try:
                data = get(url)
            except Exception as e:
                print(f"  {key}: download failed ({e})")
                data = b""
            if data.startswith(b"%PDF"):
                pdf = Path(tmp) / "p.pdf"
                pdf.write_bytes(data)
        if not pdf.exists():
            return None
        subprocess.run(["pdftoppm", "-f", "1", "-l", "1", "-jpeg", "-jpegopt", "quality=85", "-scale-to-x", "1100", "-scale-to-y", "-1",
                        str(pdf), str(Path(tmp) / "page")], check=True)
        page = next(Path(tmp).glob("page*.jpg"))
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(page, out)
    return str(out.relative_to(CONTENT))


def papers(manifest):
    out = []
    for p in manifest["papers"]:
        meta = europepmc(p["doi"])
        cover = first_page(p["key"], p.get("pdf"), CONTENT / "research" / f"{p['key']}.jpg")
        print(f"paper {p['key']}: {meta['year']} {meta['title'][:60]} cover={'yes' if cover else 'typeset'}")
        out.append({"key": p["key"], "doi": p["doi"], "url": f"https://doi.org/{p['doi']}", "cover": cover, **meta})
    return out


def videos(manifest):
    out = []
    for vid in manifest["videos"]:
        meta = json.loads(get(f"https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v={vid}"))
        thumb = CONTENT / "videos" / f"{vid}.jpg"
        thumb.parent.mkdir(parents=True, exist_ok=True)
        for size in ["maxresdefault", "hqdefault"]:
            try:
                thumb.write_bytes(get(f"https://i.ytimg.com/vi/{vid}/{size}.jpg"))
                break
            except Exception:
                continue
        print(f"video {vid}: {meta['title'][:60]}")
        out.append({"id": vid, "title": meta["title"], "author": meta["author_name"], "thumb": str(thumb.relative_to(CONTENT))})
    return out


def site(manifest):
    out = CONTENT / "research" / "site.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=Path.home()) as tmp:
        png = Path(tmp) / "site.png"
        subprocess.run([FIREFOX, "--headless", "--window-size=1440,900", "--screenshot", str(png), manifest["site"]["url"]],
                       check=True, capture_output=True, timeout=120)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(png), "-q:v", "3", str(out)], check=True)
    print(f"site {manifest['site']['url']} -> {out.relative_to(ROOT)}")
    return {"url": manifest["site"]["url"], "image": str(out.relative_to(CONTENT))}


if __name__ == "__main__":
    manifest = json.loads((CONTENT / "manifest.json").read_text())
    media = {"papers": papers(manifest), "videos": videos(manifest), "links": manifest["links"], "site": site(manifest)}
    (CONTENT / "media.json").write_text(json.dumps(media, indent=2, ensure_ascii=False) + "\n")
