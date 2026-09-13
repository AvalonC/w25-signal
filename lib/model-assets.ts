// Change the URL when replacing a model so Safari cannot reuse an older asset.
// V6 parts, rigidly assembled with outward-facing stones and an intact fan.
export const MODEL_REVISION = 'GU1893-v6-ring-r1';
export const BRACELET_ASSETS = {
  model: `models/bracelet-ring.glb?v=${MODEL_REVISION}`,
  poster: `model-ring-preview.png?v=${MODEL_REVISION}`,
  file: `models/bracelet-ring.usdz?v=${MODEL_REVISION}`,
  ar: `models/bracelet-ring.usdz?v=${MODEL_REVISION}#allowsContentScaling=0`,
} as const;
