"""
Image-level check of the zero-shot civic-issue detector (YOLO-World prompts).

Positives: Wikimedia Commons photos, each checked by eye by the developer to
clearly show the issue (list in POSITIVES; sources.json records title/licence).
Negatives: ordinary road photos from the RDD2022 India+Czech test split (they
contain road cracks/potholes but were checked only by their RDD labels, so a
roadside garbage heap would count as a false alarm) and photos of CLOSED
manhole covers. Small sample: numbers are indicative, not field accuracy.

For each prompt group the threshold is the lowest one whose false-alarm rate on
the negatives is <= MAX_FALSE_ALARM (precision first: a wrong hazard in a
complaint is worse than a missed one, which the citizen can still report).
Usage: python training/eval_civic_detector.py <civic_eval_dir>
"""
import glob, json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.services.road_damage_detector import Detector

ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(os.path.dirname(ROOT), "backend", "ml_models", "civic_issues")
MAX_FALSE_ALARM = 0.02
POSITIVES = {
    "fallen tree": ["119619921", "119619922", "14064556", "160751737", "65067341", "72954526", "84142039"],
    "garbage pile": ["195998218", "23467496", "58848407", "92323649", "92323798"],
    "flooded road": ["123188675", "130889529", "140023081", "150241651", "150241652", "150241655", "150241656",
                     "150241657", "154731647"],
    "open manhole": ["140991558", "140991572"],
    "construction debris on road": ["107301290", "13893154", "13940231", "163358497", "62273549"],
}
# Prompts that count as finding the group (a branch on the road is still a tree blockage)
GROUP = {"fallen tree": {"fallen tree", "tree branch lying on road"},
         "garbage pile": {"garbage pile", "overflowing garbage bin"}}


def scores(det, path):
    """Highest raw score per prompt (thresholds disabled)."""
    session, cfg = det.load()
    from backend.services.pothole_detector import _letterbox
    from PIL import Image
    t, *_ = _letterbox(Image.open(path).convert("RGB"))
    p = session.run(None, {session.get_inputs()[0].name: t})[0][0]
    return {c["name"]: float(p[4 + i].max()) for i, c in enumerate(cfg["classes"])}


def main(edir):
    det = Detector(MODEL + ".onnx", MODEL + ".json")
    names = [c["name"] for c in det.load()[1]["classes"]]
    pos = {g: [scores(det, f) for f in glob.glob(f"{edir}/*/*.jpg")
               if os.path.splitext(os.path.basename(f))[0] in ids] for g, ids in POSITIVES.items()}
    negs = sorted(glob.glob(os.path.join(ROOT, "data", "road_damage", "test", "images", "*.jpg")))[::5]
    negs += [f for f in glob.glob(f"{edir}/open_manhole/*.jpg")
             if os.path.splitext(os.path.basename(f))[0] not in POSITIVES["open manhole"]]
    neg = [scores(det, f) for f in negs]
    thresholds, summary = {}, {"negatives": len(neg), "max_false_alarm": MAX_FALSE_ALARM, "groups": {}}
    for name in names:
        t = next((t for t in np.arange(0.05, 0.95, 0.01) if np.mean([s[name] >= t for s in neg]) <= MAX_FALSE_ALARM), 0.95)
        thresholds[name] = round(float(t), 2)
    for g, rows in pos.items():
        prompts = GROUP.get(g, {g})
        hit = [any(r[p] >= thresholds[p] for p in prompts) for r in rows]
        fa = np.mean([any(s[p] >= thresholds[p] for p in prompts) for s in neg])
        summary["groups"][g] = {"positives": len(rows), "found": int(sum(hit)), "recall": round(float(np.mean(hit)), 2),
                                "false_alarm_rate": round(float(fa), 3)}
        print(g, summary["groups"][g], {p: thresholds[p] for p in prompts})
    anyfa = np.mean([any(s[n] >= thresholds[n] for n in names) for s in neg])
    summary["any_prompt_false_alarm_rate"] = round(float(anyfa), 3)
    print("any-prompt false alarm rate on negatives:", summary["any_prompt_false_alarm_rate"])
    json.dump({"thresholds": thresholds, "summary": summary}, open(os.path.join(ROOT, "runs", "civic_detector_eval.json"), "w"), indent=2)


if __name__ == "__main__":
    main(sys.argv[1])
