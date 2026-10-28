import React, { useEffect, useRef, useState } from 'react';
import { loadCivicDetectors, detectBoxes, detectScene, summarise } from '../utils/civicDetect';
import { Icon } from './Icon';

// Live detection: the camera is scanned on-device for potholes, road cracks and
// scene-level problems (fallen trees, garbage, flooding, debris, open manholes).
// A problem seen in several consecutive frames is captured automatically with
// the device's GPS position; "Capture" takes the current frame at any time.

const FRAME_INTERVAL_MS = 80;
const SCENE_INTERVAL_MS = 900;      // the scene model is slower; run it about once a second
const CONSECUTIVE_HITS_REQUIRED = 3;
const MASK_RGBA = [236, 72, 153, 140];

function frameToBlob(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

function drawMasks(canvas, boxes) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  for (const { mask, x1, y1, x2, y2 } of boxes) {
    if (!mask) continue;
    const tile = document.createElement('canvas');
    tile.width = mask.width;
    tile.height = mask.height;
    const img = new ImageData(mask.width, mask.height);
    mask.data.forEach((on, i) => { if (on) img.data.set(MASK_RGBA, i * 4); });
    tile.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tile, x1 * W, y1 * H, (x2 - x1) * W, (y2 - y1) * H);
  }
}

function getFreshPosition() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition((pos) => resolve(pos), () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 });
  });
}

export function LiveCameraDetector({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const positionRef = useRef(null);
  const hitsRef = useRef(0);
  const doneRef = useRef(false);
  const sceneRef = useRef({ at: 0, issues: [] });
  const latestRef = useRef({ boxes: [], scene: [] });
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [boxes, setBoxes] = useState([]);
  const [scene, setScene] = useState([]);
  const [status, setStatus] = useState('Starting camera…');
  const [error, setError] = useState('');
  const [hasGps, setHasGps] = useState(false);
  const [progress, setProgress] = useState(0);

  // Camera + GPS lifecycle
  useEffect(() => {
    let watchId = null;
    let cancelled = false;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Live detection needs HTTPS and a browser with camera support.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
      })
      .catch((err) => setError(err.name === 'NotAllowedError'
        ? 'Camera permission denied. Allow camera access and try again.'
        : `Could not start camera: ${err.message}`));
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => { positionRef.current = pos; setHasGps(true); },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Detection loop
  useEffect(() => {
    let timer = null;
    let stopped = false;

    const tick = async () => {
      if (stopped || doneRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth) {
        try {
          const found = await detectBoxes(video);
          if (performance.now() - sceneRef.current.at >= SCENE_INTERVAL_MS) {
            sceneRef.current = { at: performance.now(), issues: await detectScene(video) };
            setScene(sceneRef.current.issues);
          }
          if (stopped) return;
          const sceneNow = sceneRef.current.issues;
          latestRef.current = { boxes: found, scene: sceneNow };
          setBoxes(found);
          const items = summarise(found, sceneNow);
          if (items.length) {
            hitsRef.current += 1;
            setStatus(`${items[0].label} spotted (${Math.round(items[0].confidence * 100)}%) — hold steady…`);
          } else {
            hitsRef.current = 0;
            setStatus('Point the camera at the problem');
          }
          setProgress(Math.min(1, hitsRef.current / CONSECUTIVE_HITS_REQUIRED));
          if (hitsRef.current >= CONSECUTIVE_HITS_REQUIRED) {
            doneRef.current = true;
            await capture(items);
            return;
          }
        } catch (err) {
          if (!stopped) setError(`Detection failed: ${err.message}`);
          return;
        }
      }
      timer = setTimeout(tick, FRAME_INTERVAL_MS);
    };

    setStatus('Loading detection models…');
    loadCivicDetectors()
      .then(() => {
        if (stopped) return;
        setStatus('Point the camera at the problem');
        timer = setTimeout(tick, FRAME_INTERVAL_MS);
      })
      .catch((err) => !stopped && setError(`Could not load the detection models: ${err.message}`));
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (maskCanvasRef.current) drawMasks(maskCanvasRef.current, boxes);
  }, [boxes]);

  const capture = async (items) => {
    doneRef.current = true;
    setStatus('Capturing photo and location…');
    const capturedAt = new Date();
    const blob = await frameToBlob(videoRef.current);
    const file = new File([blob], `live_${capturedAt.getTime()}.jpg`, { type: 'image/jpeg' });
    const pos = positionRef.current || await getFreshPosition();
    const location = pos ? { lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'live_camera' } : null;
    const top = items[0];
    onDetectedRef.current({
      file, location, capturedAt, items,
      detection: { count: items.reduce((n, i) => n + i.count, 0), max_confidence: top?.confidence || 0 },
    });
  };

  const captureNow = () => {
    const { boxes: b, scene: s } = latestRef.current;
    capture(summarise(b, s));
  };

  return (
    <div className="live-camera-overlay" role="dialog" aria-label="Live detection">
      <div className="live-camera-header">
        <span className="live-camera-title"><span className="live-dot" /> Live detection</span>
        <button type="button" className="btn btn-sm live-camera-close" onClick={onClose}><Icon name="x" size={16} /> Close</button>
      </div>

      <div className="live-camera-frame">
        <div className="live-camera-stage">
          {scene.length > 0 && (
            <div className="scene-chips">
              {scene.map((i) => <span key={i.name} className="scene-chip"><Icon name="alert" size={14} /> {i.label} {Math.round(i.probability * 100)}%</span>)}
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted className="live-camera-video" />
          <canvas ref={maskCanvasRef} className="detection-masks" />
          {boxes.map((b, i) => (
            <div key={i} className={`detection-box kind-${b.name}${b.mask ? ' detection-box-seg' : ''}`}
              style={{ left: `${b.x1 * 100}%`, top: `${b.y1 * 100}%`, width: `${(b.x2 - b.x1) * 100}%`, height: `${(b.y2 - b.y1) * 100}%` }}>
              <span className="detection-label">{b.label} {Math.round(b.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="live-camera-status">
        <div className="live-progress"><span style={{ width: `${progress * 100}%` }} /></div>
        <div>{error ? <span className="text-error">{error}</span> : status}</div>
        <div className="live-controls">
          <button type="button" className="btn btn-capture" onClick={captureNow} disabled={!!error}>
            <Icon name="camera" size={20} /> Capture
          </button>
          <span className="small" style={{ opacity: 0.8 }}>
            <Icon name="pin" size={14} /> {hasGps ? 'GPS locked' : 'Waiting for GPS…'}
          </span>
        </div>
      </div>
    </div>
  );
}
