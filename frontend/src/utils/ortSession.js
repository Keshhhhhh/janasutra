// Shared ONNX Runtime Web setup for every on-device model. The runtime's WASM
// backend must be initialised exactly once, so session creation is queued:
// concurrent first calls fail with "multiple calls to 'initWasm()'".
import * as ort from 'onnxruntime-web/webgpu';

// WASM binaries are fetched from the CDN build matching the installed package
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;

let queue = Promise.resolve();
let gpuPromise = null;

// navigator.gpu can exist without a usable adapter (headless, blocklisted GPUs)
function hasWebGpu() {
  if (!gpuPromise) {
    gpuPromise = Promise.resolve(navigator.gpu?.requestAdapter?.())
      .then((adapter) => !!adapter)
      .catch(() => false);
  }
  return gpuPromise;
}

/** Create an inference session; WebGPU only when asked for and actually available. */
export function createSession(url, { preferGpu = false } = {}) {
  const run = queue.then(async () => {
    if (preferGpu && (await hasWebGpu())) {
      try {
        return await ort.InferenceSession.create(url, { executionProviders: ['webgpu', 'wasm'] });
      } catch {
        // Some WebGPU implementations reject ops the model needs; WASM always works
      }
    }
    return ort.InferenceSession.create(url, { executionProviders: ['wasm'] });
  });
  queue = run.catch(() => {});
  return run;
}

export { ort };
