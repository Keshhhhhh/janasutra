"""
Download candidate evaluation photos for the civic scene classifier from
Wikimedia Commons (search per group, 640 px thumbnails, licence recorded in
<out>/sources.json) and write one numbered contact sheet per group.

Candidates are NOT labels: every photo is checked by eye and only the ones
that clearly show the problem go into eval_civic_detector.POSITIVES.
Usage: SSL_CERT_FILE=$(python3 -m certifi) python training/fetch_commons_eval.py <out_dir> [group ...]
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "JanaSutra-eval/1.0 (civic complaints student project; contact via GitHub Keshhhhhh/janasutra)"
GROUPS = {
    "broken_streetlight": ["broken street light", "damaged street lamp", "broken lamp post"],
    "fallen_pole": ["fallen electricity pole", "leaning utility pole", "fallen lamp post road"],
    "hanging_wires": ["tangled overhead wires India", "hanging electrical wires street", "dangling power line"],
    "overflowing_bin": ["overflowing garbage bin", "overflowing dustbin street", "overflowing trash can"],
    "sewage_overflow": ["sewage overflow street", "overflowing drain India", "open drain sewage road"],
    "rocks_on_road": ["landslide road blocked", "rockfall on road", "boulders on road"],
    "cattle_on_road": ["cows on road India", "cattle on highway", "stray cattle street India"],
    "broken_footpath": ["broken pavement", "damaged sidewalk", "broken footpath India"],
    "damaged_sign": ["damaged road sign", "bent traffic sign", "fallen road sign"],
    "damaged_barrier": ["damaged guardrail", "broken crash barrier", "damaged road barrier"],
    "abandoned_vehicle": ["abandoned car street", "abandoned vehicle roadside", "abandoned scooter street"],
    "streetlight_normal": ["street light pole", "street lamp India", "street lights road night"],
}
PER_QUERY = 14


def get(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            time.sleep(5 * (i + 1))
    return None


def search(query):
    q = {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{query} filetype:bitmap",
         "gsrnamespace": 6, "gsrlimit": PER_QUERY, "prop": "imageinfo",
         "iiprop": "url|extmetadata|mime", "iiurlwidth": 640}
    data = json.loads(get(API + "?" + urllib.parse.urlencode(q)))
    for pid, page in (data.get("query", {}).get("pages", {}) or {}).items():
        info = (page.get("imageinfo") or [{}])[0]
        if info.get("mime") not in ("image/jpeg", "image/png"):
            continue
        lic = info.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "")
        yield pid, page["title"], info.get("thumburl"), lic


def sheet(paths, out):
    from PIL import Image, ImageDraw
    cols, w, h = 6, 220, 165
    rows = (len(paths) + cols - 1) // cols
    im = Image.new("RGB", (cols * w, max(1, rows) * h), "white")
    d = ImageDraw.Draw(im)
    for i, p in enumerate(paths):
        try:
            t = Image.open(p).convert("RGB")
        except Exception:
            continue
        t.thumbnail((w - 6, h - 22))
        x, y = (i % cols) * w, (i // cols) * h
        im.paste(t, (x + 3, y + 20))
        d.text((x + 4, y + 3), os.path.basename(p)[:-4], fill="black")
    im.save(out, quality=82)


def main(out, groups):
    srcf = os.path.join(out, "sources.json")
    sources = json.load(open(srcf)) if os.path.exists(srcf) else {}
    for g in groups:
        os.makedirs(os.path.join(out, g), exist_ok=True)
        paths, seen = [], set()
        for query in GROUPS[g]:
            for pid, title, url, lic in search(query):
                rel = f"{g}/{pid}.jpg"
                path = os.path.join(out, rel)
                if pid in seen or not url:
                    continue
                seen.add(pid)
                if not os.path.exists(path):
                    try:
                        blob = get(url)
                    except Exception as e:  # skip a single bad file
                        print("skip", title, e)
                        continue
                    from io import BytesIO
                    from PIL import Image
                    try:
                        Image.open(BytesIO(blob)).convert("RGB").save(path, quality=90)
                    except Exception:
                        continue
                    time.sleep(0.5)
                sources[rel] = {"title": title, "license": lic, "query": query}
                paths.append(path)
            time.sleep(1)
        sheet(sorted(paths), os.path.join(out, f"sheet_{g}.jpg"))
        print(g, len(paths), "candidates")
        json.dump(sources, open(srcf, "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:] or list(GROUPS))
