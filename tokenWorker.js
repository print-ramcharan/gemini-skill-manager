// tokenWorker.js
// Approximate tokenizer running in a WebWorker.
// Receives {type: 'count', text, model, id} and responds with {id, count}

// Attempt to load a browser-friendly encoder (gpt-3-encoder) via importScripts.
let browserEncoderAvailable = false;
try {
  importScripts('node_modules/gpt-3-encoder/dist/encoder.min.js');
  if (typeof encode === 'function') browserEncoderAvailable = true;
} catch (e) {
  // not available in worker environment
}

const modelWordFactor = {
  'gpt-4o-mini-16k': 1.3,
  'gpt-4o-mini-32k': 1.3,
  'gpt-4-turbo': 1.25,
  'gpt-3.5-turbo': 1.1,
  'claude-2': 1.15
};

function estimateTokensFast(text, model) {
  if (!text) return 0;
  // Prefer exact encoder if available
  if (browserEncoderAvailable) {
    try {
      const tokens = encode(text);
      return tokens.length;
    } catch (e) {
      // fall back
    }
  }

  // word-based estimate
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const factor = modelWordFactor[model] || 1.25;
  const byWords = Math.ceil(words * factor);

  // byte-based fallback (UTF-8 bytes / 4)
  let bytes = 0;
  try {
    bytes = new TextEncoder().encode(text).length;
  } catch (e) {
    bytes = text.length;
  }
  const byBytes = Math.ceil(bytes / 4);

  // heuristic: blend both estimates
  const blended = Math.round((byWords + byBytes) / 2);
  return Math.max(1, blended);
}

self.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'count') return;
  const { text = '', model = null, id = null } = msg;
  const count = estimateTokensFast(text, model);
  self.postMessage({ id, count });
});
