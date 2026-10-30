const SEED = '0x4e413430';
const LAYER_COUNT = 11;
const MEMORY_WINDOW = 4;
const MIN_PRESSURE = 0.2;
const MAX_PRESSURE = 0.92;
const MIN_SWEEP = 0.24;
const MAX_SWEEP = 0.92;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(Number(value) * 10000) / 10000;
const validLayer = (value) => Number.isInteger(value) && value >= 0 && value < LAYER_COUNT;
const clone = (value) => JSON.parse(JSON.stringify(value));

function baseLayer(index) {
  const phase = ((index * 17 + 3) % 29) / 29;
  return {
    id: index,
    y: round(0.09 + index * 0.082),
    x: round(0.49 + Math.sin(index * 1.7) * 0.045),
    span: round(0.58 - (index % 3) * 0.025 + Math.sin(index * 0.8) * 0.025),
    depth: round(0.12 + (index % 4) * 0.011),
    bend: round(Math.sin(index * 1.31) * 0.12),
    offsetX: round(Math.cos(index * 1.9) * 0.018),
    offsetY: round(Math.sin(index * 2.3) * 0.012),
    notch: (index * 3 + 1) % 5 === 0 ? 1 : 0,
    tilt: round((phase - 0.5) * 0.16),
    hardness: round(0.28 + (index % 5) * 0.04),
    phase: round(phase),
    tone: (index * 7 + 2) % 6,
    role: 'soft'
  };
}

const BASE_LAYERS = Array.from({ length: LAYER_COUNT }, (_, index) => baseLayer(index));

function distanceBetween(a, b) {
  return Math.abs(a - b) / (LAYER_COUNT - 1);
}

function remoteIndex(source, memoryIndex, offset, used = new Set()) {
  let candidate = (source + offset + memoryIndex * 3) % LAYER_COUNT;
  for (let attempt = 0; attempt < LAYER_COUNT; attempt += 1) {
    if (candidate !== source && !used.has(candidate) && distanceBetween(source, candidate) >= 0.25) return candidate;
    candidate = (candidate + 3) % LAYER_COUNT;
  }
  return source === 0 ? LAYER_COUNT - 1 : 0;
}

function layerSignature(layer) {
  return [
    layer.id, layer.y, layer.x, layer.span, layer.depth, layer.bend,
    layer.offsetX, layer.offsetY, layer.notch, layer.tilt, layer.hardness,
    layer.phase, layer.tone, layer.role
  ].join(':');
}

function applyEvent(layers, event) {
  const source = layers[event.layer];
  const cast = layers[event.cast];
  const dent = layers[event.dent];
  const ridge = layers[event.ridge];
  const pressure = clamp(event.pressure, MIN_PRESSURE, MAX_PRESSURE);
  const sweep = clamp(event.sweep, MIN_SWEEP, MAX_SWEEP);

  // The band receiving pressure is kept exact. Material error is displaced into the next form.
  cast.role = 'overcast';
  cast.span = round(cast.span + 0.12 + pressure * 0.12);
  cast.depth = round(cast.depth + 0.035 + sweep * 0.04);
  cast.bend = round(cast.bend + 0.16 + pressure * 0.08);
  cast.offsetX = round(cast.offsetX + 0.028 + event.memoryIndex * 0.006);
  cast.offsetY = round(cast.offsetY - 0.022 - sweep * 0.025);
  cast.notch = 1;
  cast.tilt = round(cast.tilt + 0.08);
  cast.hardness = round(Math.min(1, cast.hardness + 0.28 + pressure * 0.16));
  cast.phase = round((source.phase + 0.27 + event.memoryIndex * 0.09) % 1);
  cast.tone = (source.tone + 3 + event.memoryIndex) % 6;

  dent.role = 'underformed';
  dent.span = round(Math.max(0.26, dent.span - 0.12 - sweep * 0.09));
  dent.depth = round(Math.max(0.055, dent.depth - 0.025));
  dent.bend = round(dent.bend - 0.18 - pressure * 0.07);
  dent.offsetX = round(dent.offsetX - 0.024 - event.memoryIndex * 0.005);
  dent.offsetY = round(dent.offsetY + 0.018);
  dent.notch = 1;
  dent.tilt = round(dent.tilt - 0.07);
  dent.hardness = round(Math.max(0.08, dent.hardness - 0.12));
  dent.tone = (dent.tone + 5) % 6;

  ridge.role = 'memory-ridge';
  ridge.span = round(ridge.span + 0.035);
  ridge.depth = round(ridge.depth + 0.018);
  ridge.bend = round(ridge.bend + (event.memoryIndex % 2 ? -0.11 : 0.11));
  ridge.offsetX = round(ridge.offsetX + (event.memoryIndex % 2 ? -0.016 : 0.016));
  ridge.offsetY = round(ridge.offsetY + 0.012);
  ridge.notch = 1;
  ridge.tilt = round(ridge.tilt + 0.035);
  ridge.hardness = round(Math.min(1, ridge.hardness + 0.12));
  ridge.tone = (ridge.tone + 1) % 6;
}

function materialise(memory) {
  const layers = BASE_LAYERS.map((layer) => ({ ...layer }));
  for (const event of memory.slice(-MEMORY_WINDOW)) applyEvent(layers, event);
  const changedLayerCount = layers.reduce((count, layer, index) => count + (layerSignature(layer) === layerSignature(BASE_LAYERS[index]) ? 0 : 1), 0);
  return {
    layers,
    trace: {
      memoryCount: memory.length,
      changedLayerCount,
      lastLayer: memory.at(-1)?.layer ?? null,
      lastCast: memory.at(-1)?.cast ?? null,
      generation: memory.length
    },
    layerCount: LAYER_COUNT
  };
}

function stateFrom(memory, interaction = 'idle', pending = null) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'pressure-cast-relief',
    surface: 'single-relief-mould',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    pending: pending ? { layer: pending.layer } : null,
    interaction,
    scene: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }
export { layerSignature };
export function geometrySignature(state) { return state.scene.layers.map(layerSignature).join('|'); }

export function beginPress(state, { layer } = {}) {
  if (!validLayer(layer)) return stateFrom(state.memory, 'press-refused-invalid');
  return stateFrom(state.memory, 'press-armed', { layer });
}

function eventFor(layer, pressure, sweep, memoryIndex) {
  const cast = remoteIndex(layer, memoryIndex, 7);
  const used = new Set([layer, cast]);
  const dent = remoteIndex(layer, memoryIndex, 5, used);
  used.add(dent);
  const ridge = remoteIndex(layer, memoryIndex, 9, used);
  return {
    kind: 'pressure-cast',
    layer,
    cast,
    dent,
    ridge,
    distance: round(distanceBetween(layer, cast)),
    pressure: round(pressure),
    sweep: round(sweep),
    memoryIndex
  };
}

export function commitPress(state, { layer, pressure, sweep } = {}) {
  const selected = layer ?? state.pending?.layer;
  if (!validLayer(selected)) return stateFrom(state.memory, 'press-refused-invalid', state.pending);
  const level = Number(pressure);
  const distance = Number(sweep);
  if (!Number.isFinite(level) || level < MIN_PRESSURE) return stateFrom(state.memory, 'press-refused-light', state.pending);
  if (level > MAX_PRESSURE) return stateFrom(state.memory, 'press-refused-heavy', state.pending);
  if (!Number.isFinite(distance) || distance < MIN_SWEEP) return stateFrom(state.memory, 'press-refused-short', state.pending);
  if (distance > MAX_SWEEP) return stateFrom(state.memory, 'press-refused-wide', state.pending);
  const event = eventFor(selected, level, distance, state.memory.length);
  return stateFrom([...state.memory, event], 'press-committed');
}

export function liftLatestPress(state) {
  if (!state.memory.length) return stateFrom([], 'press-lifted');
  return stateFrom(state.memory.slice(0, -1), 'press-lifted');
}

export function releaseMemory() { return stateFrom([], 'memory-released'); }

export function buildTimeline() {
  return [
    { layer: 2, pressure: 0.62, sweep: 0.48 },
    { layer: 7, pressure: 0.46, sweep: 0.37 },
    { layer: 9, pressure: 0.76, sweep: 0.61 },
    { layer: 1, pressure: 0.55, sweep: 0.52 }
  ];
}

export {
  LAYER_COUNT,
  MAX_PRESSURE,
  MAX_SWEEP,
  MEMORY_WINDOW,
  MIN_PRESSURE,
  MIN_SWEEP,
  SEED
};
