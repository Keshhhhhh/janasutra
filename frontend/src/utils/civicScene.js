// On-device civic scene classifier (CLIP ViT-B/32 image encoder, int8 ONNX):
// fallen trees, garbage, flooding, debris and open manholes are compared with
// text prompts whose embeddings ship in civic_scene.json (see
// training/export_clip_scene.py for how the thresholds were measured).
import * as ort from 'onnxruntime-web/webgpu';

ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;

let promise = null;

async function create() {
  const config = await fetch('/models/civic_scene.json').then((r) => {
    if (!r.ok) throw new Error('scene model not installed');
    return r.json();
  });
  // int8 (dynamically quantised) ops run on the WASM backend
  const session = await ort.InferenceSession.create('/models/civic_scene.onnx', { executionProviders: ['wasm'] });
  const n = config.inputSize;
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  return { session, config, ctx, n };
}

export function loadCivicScene() {
  if (!promise) {
    promise = create().catch((err) => {
      promise = null;
      throw err;
    });
  }
  return promise;
}

/** Returns the issues above their thresholds: [{ name, label, subcategoryId, probability }] */
export async function classifyScene(source) {
  const { session, config, ctx, n } = await loadCivicScene();
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  // Shortest side to n, centre crop (same as training/export_clip_scene.py)
  const side = Math.min(w, h);
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, n, n);
  const { data } = ctx.getImageData(0, 0, n, n);
  const area = n * n;
  const input = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    for (let c = 0; c < 3; c++) input[c * area + i] = (data[i * 4 + c] / 255 - config.mean[c]) / config.std[c];
  }
  const out = await session.run({ pixels: new ort.Tensor('float32', input, [1, 3, n, n]) });
  const v = out.embedding.data;
  const logits = config.textEmbeddings.map((t) => config.logitScale * t.reduce((s, x, k) => s + x * v[k], 0));
  const max = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - max));
  const total = exps.reduce((a, b) => a + b, 0);
  const probs = {};
  config.prompts.forEach((p, i) => { probs[p.key] = (probs[p.key] || 0) + exps[i] / total; });
  out.embedding.dispose?.();
  return config.classes
    .filter((c) => probs[c.name] >= c.threshold)
    .map((c) => ({ name: c.name, label: c.label_en, subcategoryId: c.subcategory_id, probability: probs[c.name] }))
    .sort((a, b) => b.probability - a.probability);
}
