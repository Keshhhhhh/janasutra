// One entry point for every on-device detector, shared by Live detection,
// Road Scan and uploaded photos:
//   potholes   - JanaSutra pothole segmentation model (boxes + masks)
//   cracks     - pretrained RDD2022 road-damage model (its pothole class is off)
//   scene      - CLIP scene classifier (fallen tree, garbage, flooding, debris, open manhole)
import { loadDetector, detectPotholes } from './potholeDetector';
import { loadRoadDamage, detectRoadDamage } from './roadDamageDetector';
import { loadCivicScene, classifyScene } from './civicScene';

const available = { potholes: false, cracks: false, scene: false };

/** Load every model that is installed; returns which ones are usable. */
export async function loadCivicDetectors({ scene = true } = {}) {
  const [p, c, s] = await Promise.allSettled([
    loadDetector(), loadRoadDamage(), scene ? loadCivicScene() : Promise.reject(new Error('skipped')),
  ]);
  available.potholes = p.status === 'fulfilled';
  available.cracks = c.status === 'fulfilled';
  available.scene = s.status === 'fulfilled';
  if (!available.potholes && !available.cracks && !available.scene) throw new Error('no detection model could be loaded');
  return { ...available };
}

/** Box detections (potholes + cracks) for one frame, in a common shape. */
export async function detectBoxes(source) {
  const out = [];
  if (available.potholes) {
    const r = await detectPotholes(source);
    r.boxes.forEach((b) => out.push({ ...b, classIndex: 100, name: 'pothole', label: 'Pothole', subcategoryId: 'ROAD.POTHOLE' }));
  }
  if (available.cracks) out.push(...(await detectRoadDamage(source)));
  return out;
}

export async function detectScene(source) {
  return available.scene ? classifyScene(source) : [];
}

/**
 * Everything found in one image, merged per label:
 * [{ name, label, subcategoryId, confidence, kind: 'box' | 'scene', count }]
 */
export async function analyseImage(source) {
  const [boxes, scene] = [await detectBoxes(source), await detectScene(source)];
  return summarise(boxes, scene);
}

export function summarise(boxes, scene) {
  const by = new Map();
  for (const b of boxes) {
    const k = b.name;
    const prev = by.get(k);
    by.set(k, { name: k, label: b.label, subcategoryId: b.subcategoryId, kind: 'box',
                confidence: Math.max(prev?.confidence || 0, b.confidence), count: (prev?.count || 0) + 1 });
  }
  for (const s of scene) {
    by.set(s.name, { name: s.name, label: s.label, subcategoryId: s.subcategoryId, kind: 'scene',
                     confidence: s.probability, count: 1 });
  }
  return [...by.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Decode an uploaded file into an <img> the detectors can read. */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read image')); };
    img.src = url;
  });
}

/** Short description of findings, e.g. "Pothole (2) and garbage dumped in public". */
export function describeFindings(items) {
  const parts = items.map((i) => `${i.label.split(' / ')[0]}${i.count > 1 ? ` (${i.count})` : ''}`);
  if (!parts.length) return '';
  const text = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1).toLowerCase()}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
