export const SEED = 0x57475037;
export const STAGES = 7;
export const LAYER_COUNT = 14;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 42;
export const MIN_SWEEP = 0.22;
export const MAX_SWEEP = 0.72;
export const MIN_DURATION = 90;
export const MAX_DURATION = 1800;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const wrapLayer = (value) => ((value % LAYER_COUNT) + LAYER_COUNT) % LAYER_COUNT;
const layerDistance = (a, b) => Math.min(Math.abs(a - b), LAYER_COUNT - Math.abs(a - b));
const pseudo = (value) => {
  const raw = Math.sin(value * 17.173 + SEED * 0.000013) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizePoint = (point = {}, fallbackX = 0.5, fallbackY = 0.5) => ({
  x: clamp(finite(point.x, fallbackX), 0, 1),
  y: clamp(finite(point.y, fallbackY), 0, 1)
});

const normalizeEvent = (event = {}, index = 0) => {
  const start = normalizePoint(event.start, 0.16 + index * 0.12, 0.48);
  const end = normalizePoint(event.end, clamp(start.x + 0.34, 0, 1), start.y);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const sweep = clamp(finite(event.sweep, Math.hypot(dx, dy)), MIN_SWEEP, MAX_SWEEP);
  const sourceLayer = integer(event.sourceLayer ?? Math.floor(start.y * LAYER_COUNT), 0, LAYER_COUNT - 1);
  let remoteLayer = integer(event.remoteLayer ?? wrapLayer(sourceLayer + 4 + index * 2), 0, LAYER_COUNT - 1);
  if (remoteLayer === sourceLayer) remoteLayer = wrapLayer(sourceLayer + 5);
  return {
    id: `turn-${index}`,
    mode: 'remote-shear',
    start,
    end,
    sweep: round(sweep),
    direction: finite(event.direction, dx >= 0 ? 1 : -1) < 0 ? -1 : 1,
    sourceLayer,
    remoteLayer,
    duration: round(clamp(finite(event.duration, 420), MIN_DURATION, MAX_DURATION)),
    serial: index
  };
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const baseLayers = () => Array.from({ length: LAYER_COUNT }, (_, id) => ({
  id,
  y: round(-0.48 + id / (LAYER_COUNT - 1) * 0.96),
  depth: round(0.42 + pseudo(id + 11) * 0.36),
  thickness: round(0.044 + pseudo(id + 23) * 0.018),
  offset: round((pseudo(id + 37) - 0.5) * 0.045),
  shear: round((pseudo(id + 41) - 0.5) * 0.035),
  cut: round(0.035 + pseudo(id + 53) * 0.2),
  mass: round(0.58 + pseudo(id + 67) * 0.34),
  phase: round(pseudo(id + 79) * Math.PI * 2)
}));

const buildField = (memory) => {
  let layers = baseLayers();
  const seams = [];

  normalizeMemory(memory).forEach((event, serial) => {
    const previous = layers.map((layer) => ({ ...layer }));
    const source = event.sourceLayer;
    const remote = event.remoteLayer;
    const pressure = event.sweep * (0.92 + serial * 0.11) * event.direction;

    layers = previous.map((layer, index) => {
      const remoteDistance = layerDistance(index, remote);
      const sourceDistance = layerDistance(index, source);
      const remoteInfluence = Math.exp(-(remoteDistance * remoteDistance) / 4.7);
      const settling = Math.exp(-(sourceDistance * sourceDistance) / 5.4);
      const drift = Math.sin((index + 1) * 0.77 + event.sweep * 4.1 + serial) * 0.006 * remoteInfluence;
      return {
        ...layer,
        offset: round(clamp(layer.offset + pressure * 0.075 * remoteInfluence - pressure * 0.018 * settling + drift, -0.42, 0.42)),
        shear: round(clamp(layer.shear + pressure * 0.12 * remoteInfluence + (previous[(index + 1) % LAYER_COUNT].shear - layer.shear) * 0.08, -0.72, 0.72)),
        depth: round(clamp(layer.depth + Math.abs(pressure) * 0.06 * remoteInfluence - Math.abs(pressure) * 0.018 * settling, 0.12, 0.98)),
        cut: round(clamp(layer.cut + Math.abs(pressure) * 0.07 * remoteInfluence + (index === remote ? 0.08 : 0), 0.02, 0.82)),
        mass: round(clamp(layer.mass - Math.abs(pressure) * 0.045 * remoteInfluence + Math.abs(pressure) * 0.02 * settling, 0.18, 0.98))
      };
    });

    layers = layers.map((layer, index) => {
      if (index === source) {
        return {
          ...layer,
          offset: round(clamp(layer.offset - pressure * 0.012, -0.42, 0.42)),
          cut: round(clamp(layer.cut * 0.96, 0.02, 0.82))
        };
      }
      if (index === remote) {
        return {
          ...layer,
          offset: round(clamp(layer.offset + pressure * 0.11, -0.42, 0.42)),
          shear: round(clamp(layer.shear + pressure * 0.24, -0.72, 0.72)),
          cut: round(clamp(layer.cut + Math.abs(pressure) * 0.14, 0.02, 0.82)),
          depth: round(clamp(layer.depth + Math.abs(pressure) * 0.12, 0.12, 0.98))
        };
      }
      return layer;
    });
    seams.push(`${source}>${remote}:${event.direction}:${event.sweep.toFixed(3)}`);
  });

  const signature = JSON.stringify({
    seams: seams.join('|') || 'quiet',
    layers: layers.map((layer) => [layer.id, layer.offset, layer.shear, layer.depth, layer.cut, layer.mass])
  });
  return { kind: 'sediment-prism', layers, seams: seams.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], attention = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    attention: attention ? {
      start: normalizePoint(attention.start),
      current: normalizePoint(attention.current ?? attention.start),
      startedAt: finite(attention.startedAt, 0)
    } : null,
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const beginTurn = (frame, input = {}) => {
  const start = normalizePoint(input, 0.5, 0.5);
  return {
    ...frame,
    attention: { start, current: start, startedAt: finite(input.at, 0) },
    lastAction: 'turn-armed'
  };
};

export const turnVolume = (frame, input = {}) => {
  if (!frame.attention) return frame;
  const current = normalizePoint(input, frame.attention.current.x, frame.attention.current.y);
  return { ...frame, attention: { ...frame.attention, current }, lastAction: 'turn-preview' };
};

export const finishTurn = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, attention: null, lastAction: 'memory-limit' };
  if (!frame.attention) return { ...frame, lastAction: 'turn-refused-no-arm' };
  const end = normalizePoint(input, frame.attention.current.x, frame.attention.current.y);
  const dx = end.x - frame.attention.start.x;
  const dy = end.y - frame.attention.start.y;
  const sweep = Math.hypot(dx, dy);
  const duration = finite(input.finishedAt, frame.attention.startedAt) - frame.attention.startedAt;
  if (sweep < MIN_SWEEP - 1e-9 || sweep > MAX_SWEEP + 1e-9 || duration < MIN_DURATION || duration > MAX_DURATION) {
    return { ...frame, attention: null, lastAction: 'turn-refused-bounds' };
  }
  const sourceLayer = integer(Math.floor(frame.attention.start.y * LAYER_COUNT), 0, LAYER_COUNT - 1);
  const remoteLayer = wrapLayer(sourceLayer + 4 + frame.memory.length * 2 + (dx < 0 ? -1 : 0));
  const event = {
    mode: 'remote-shear',
    start: frame.attention.start,
    end,
    sweep,
    direction: dx >= 0 ? 1 : -1,
    sourceLayer,
    remoteLayer,
    duration
  };
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'turn-committed');
};

export const liftLatestTurn = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'turn-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultTurn = (frame) => {
  const starts = [[0.12, 0.18], [0.31, 0.31], [0.54, 0.5], [0.73, 0.69]];
  const [x, y] = starts[frame.memory.length % starts.length];
  return { start: { x, y }, end: { x: x + 0.42, y: y + (frame.memory.length % 2 ? 0.06 : -0.04) } };
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    if (frame.memory.length < MEMORY_LIMIT) {
      const turn = defaultTurn(frame);
      frame = finishTurn(beginTurn(frame, { ...turn.start, at: 0 }), { ...turn.end, finishedAt: 420 });
    } else {
      frame = buildFrame(stage, frame.memory, null, 'settled-preview');
    }
    timeline.push(buildFrame(stage, frame.memory, null, frame.memory.length ? 'settled-preview' : 'quiet'));
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, layers: frame.field.layers });
export const layerPoints = () => baseLayers().map((layer) => ({ id: layer.id, y: layer.y, depth: layer.depth }));
