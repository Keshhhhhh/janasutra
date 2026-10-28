"""
Civic scene classifier for Road Scan: OpenAI CLIP ViT-B/32 (MIT licence) used
zero-shot. Fallen trees, garbage, flooding, debris and open manholes are scene-
level problems that box detectors trained on potholes cannot see; CLIP compares
the photo with text prompts (training/clip_scene_prompts.py).

This script
  1. exports CLIP's image encoder to ONNX and quantises it to int8 (~90 MB),
  2. precomputes the prompt text embeddings (the app never runs the text encoder),
  3. measures it: threshold per issue = just above the highest score any
     calibration negative got (precision first), then reports recall on the
     checked positives and the false-alarm rate on a SEPARATE set of negatives
     that played no part in choosing thresholds,
  4. installs frontend/public/models/civic_scene.{onnx,json} and backend/ml_models/.

Positives are Wikimedia Commons photos checked by eye (eval_civic_detector.POSITIVES).
Small sample: indicative, not field accuracy.
Usage: python training/export_clip_scene.py <civic_eval_dir>
"""
import glob
import json
import os
import shutil
import sys

import numpy as np
import torch

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(ROOT)
sys.path.insert(0, ROOT)
from clip_scene_prompts import ISSUES, NORMAL  # noqa: E402
from eval_civic_detector import NORMAL_LOOKALIKES, POSITIVES  # noqa: E402

OUT = os.path.join(PROJECT, "models", "clip-vit-b32")
GROUP = {"fallen tree": "fallen_tree", "garbage pile": "garbage", "flooded road": "flooding",
         "construction debris on road": "debris", "open manhole": "open_manhole",
         "damaged pole": "damaged_pole", "overflowing bin": "overflowing_bin"}
MEAN = [0.48145466, 0.4578275, 0.40821073]
STD = [0.26862954, 0.26130258, 0.27577711]
LOGIT_SCALE = 100.0
MARGIN = 0.05


def export_onnx(model):
    os.makedirs(OUT, exist_ok=True)
    fp32, int8 = os.path.join(OUT, "visual_fp32.onnx"), os.path.join(OUT, "visual_int8.onnx")

    class Visual(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.v = m.visual

        def forward(self, x):
            e = self.v(x)
            return e / e.norm(dim=-1, keepdim=True)

    torch.onnx.export(Visual(model).eval(), torch.zeros(1, 3, 224, 224), fp32, input_names=["pixels"],
                      output_names=["embedding"], opset_version=17, dynamo=False)
    from onnxruntime.quantization import QuantType, quantize_dynamic
    quantize_dynamic(fp32, int8, weight_type=QuantType.QUInt8)
    return int8


def preprocess(path):
    """Same steps as the browser: shortest side to 224 (bicubic), centre crop, CLIP normalisation."""
    from PIL import Image
    im = Image.open(path).convert("RGB")
    s = 224 / min(im.size)
    im = im.resize((max(224, round(im.width * s)), max(224, round(im.height * s))), Image.BICUBIC)
    l, t = (im.width - 224) // 2, (im.height - 224) // 2
    a = (np.asarray(im.crop((l, t, l + 224, t + 224)), dtype=np.float32) / 255 - MEAN) / STD
    return a.transpose(2, 0, 1)[None].astype(np.float32)


def main(edir):
    import clip
    import onnxruntime as ort
    model, _ = clip.load("ViT-B/32", device="cpu")
    onnx_path = export_onnx(model)
    texts = [(k, t) for k, (_, _, ts) in ISSUES.items() for t in ts] + [("normal", t) for t in NORMAL]
    with torch.no_grad():
        T = model.encode_text(clip.tokenize([t for _, t in texts])).float()
        T = (T / T.norm(dim=-1, keepdim=True)).numpy()

    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])

    def probs(path):
        v = sess.run(None, {"pixels": preprocess(path)})[0][0]
        z = LOGIT_SCALE * T @ v
        p = np.exp(z - z.max()); p /= p.sum()
        out = {}
        for (k, _), x in zip(texts, p):
            out[k] = out.get(k, 0.0) + float(x)
        return out

    road = sorted(glob.glob(os.path.join(ROOT, "data", "road_damage", "test", "images", "*.jpg")))
    closed = [f for f in glob.glob(f"{edir}/open_manhole/*.jpg")
              if os.path.basename(f)[:-4] not in POSITIVES["open manhole"]]
    look = sorted(f for f in glob.glob(f"{edir}/*/*.jpg") if os.path.basename(f)[:-4] in NORMAL_LOOKALIKES)
    calib = [probs(f) for f in road[::5] + closed[::2] + look[::2]]
    other = glob.glob(os.path.join(ROOT, "data", "authenticity", "*", "real", "gi_real_*"))[:100]
    held = [probs(f) for f in road[2::5] + closed[1::2] + look[1::2] + other]

    classes, report = [], {"calibration_negatives": len(calib), "heldout_negatives": len(held), "issues": {}}
    for g, k in GROUP.items():
        thr = round(min(0.95, max(n[k] for n in calib) + MARGIN), 2)
        pos = [probs(f) for f in glob.glob(f"{edir}/*/*.jpg") if os.path.basename(f)[:-4] in POSITIVES[g]]
        found = sum(p[k] >= thr for p in pos)
        fa = float(np.mean([n[k] >= thr for n in held]))
        report["issues"][k] = {"threshold": thr, "positives": len(pos), "found": int(found),
                               "heldout_false_alarm_rate": round(fa, 3)}
        label, sid, _ = ISSUES[k]
        classes.append({"name": k, "label_en": label, "subcategory_id": sid, "threshold": thr})
        print(k, report["issues"][k])
    report["heldout_any_issue_false_alarm_rate"] = round(float(np.mean(
        [any(n[c["name"]] >= c["threshold"] for c in classes) for n in held])), 3)
    print("held-out negatives with any issue flagged:", report["heldout_any_issue_false_alarm_rate"])

    config = {"inputSize": 224, "mean": MEAN, "std": STD, "logitScale": LOGIT_SCALE,
              "prompts": [{"key": k, "text": t} for k, t in texts],
              "textEmbeddings": [[round(float(x), 5) for x in row] for row in T],
              "classes": classes, "evaluation": report,
              "model": "OpenAI CLIP ViT-B/32 image encoder (MIT), int8, zero-shot prompts"}
    for d in (os.path.join(PROJECT, "frontend", "public", "models"), os.path.join(PROJECT, "backend", "ml_models")):
        shutil.copy(onnx_path, os.path.join(d, "civic_scene.onnx"))
        json.dump(config, open(os.path.join(d, "civic_scene.json"), "w"))
    json.dump(report, open(os.path.join(ROOT, "runs", "civic_scene_eval.json"), "w"), indent=2)
    print("installed", round(os.path.getsize(onnx_path) / 1e6, 1), "MB")


if __name__ == "__main__":
    main(sys.argv[1])
