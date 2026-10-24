export const SEED = 0x57473333;
export const STAGES = 9;
export const GRID_W = 18;
export const GRID_H = 12;
export const SAMPLE_COUNT = GRID_W * GRID_H;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 42;
export const MIN_SWIPE = 0.18;
export const MIN_DURATION = 120;
export const MAX_DURATION = 1400;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const round = (value) => Number(value.toFixed(5));
const pseudo = (value) => {
  const raw = Math.sin(value * 23.117 + SEED * 0.000021) * 43758.5453;
  return raw - Math.floor(raw);
};
const normalizePoint = (value, fallback = 0.5) => clamp(finite(value, fallback), 0, 1);
const normalizeIndex = (value) => integer(value, 0, SAMPLE_COUNT - 1);
const normalizeDirection = (value) => ['east', 'south', 'west', 'north'].includes(value) ? value : 'east';
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => ({
    id: `beat-${index}`,
    mode: 'propagation-beat',
    direction: normalizeDirection(event.direction),
    start: { x: normalizePoint(event.start?.x), y: normalizePoint(event.start?.y) },
    end: { x: normalizePoint(event.end?.x), y: normalizePoint(event.end?.y) },
    distance: round(clamp(finite(event.distance, 0.72), MIN_SWIPE, 1.4143)),
    duration: round(clamp(finite(event.duration, 420), MIN_DURATION, MAX_DURATION)),
    force: round(clamp(finite(event.force, 0.72), 0.52, 1)),
    serial: index
  }));
const normalizeDrag = (drag = null) => {
  if (!drag) return null;
  return {
    start: { x: normalizePoint(drag.start?.x), y: normalizePoint(drag.start?.y) },
    current: { x: normalizePoint(drag.current?.x), y: normalizePoint(drag.current?.y) },
    startedAt: finite(drag.startedAt, 0)
  };
};

const baseSamples = () => Array.from({ length: SAMPLE_COUNT }, (_, id) => {
  const x = id % GRID_W;
  const y = Math.floor(id / GRID_W);
  const u = x / (GRID_W - 1);
  const v = y / (GRID_H - 1);
  const broad = 0.5 + Math.sin(u * Math.PI * 2.15 + v * 1.7) * 0.11 + Math.cos(v * Math.PI * 3.2 - u * 1.2) * 0.09;
  const ridge = Math.exp(-Math.pow((u * 0.95 + v * 0.62) - 0.72, 2) / 0.026) * 0.13;
  return {
    id,
    x,
    y,
    u: round(u),
    v: round(v),
    height: round(clamp(broad + ridge + (pseudo(id + 41) - 0.5) * 0.035, 0.18, 0.86)),
    phase: round((pseudo(id + 81) - 0.5) * 0.08),
    inheritance: 0,
    fold: round(0.12 + pseudo(id + 121) * 0.22),
    depth: round(pseudo(id + 161) * 0.5)
  };
});
const neighborId = (sample, direction) => {
  const dx = direction === 'east' ? 1 : direction === 'west' ? -1 : 0;
  const dy = direction === 'south' ? 1 : direction === 'north' ? -1 : 0;
  return clamp(sample.x + dx, 0, GRID_W - 1) + clamp(sample.y + dy, 0, GRID_H - 1) * GRID_W;
};
const directionVector = (direction) => ({ east: [1, 0], south: [0, 1], west: [-1, 0], north: [0, -1] })[direction];
const buildSurface = (memory) => {
  let samples = baseSamples();
  const routes = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const previous = samples.map((sample) => ({ ...sample }));
    const [dx, dy] = directionVector(event.direction);
    const gain = 0.18 + event.force * 0.13 + serial * 0.015;
    const front = (serial * 0.23 + event.end.x * 0.41 + event.end.y * 0.29) % 1;
    samples = previous.map((sample) => {
      const neighbor = previous[neighborId(sample, event.direction)];
      const delta = neighbor.height - sample.height;
      const along = sample.u * dx + sample.v * dy;
      const crest = Math.sin((along + front) * Math.PI * 5.1 + serial * 0.7) * event.force * 0.035;
      const inherited = clamp(sample.inheritance + Math.abs(delta) * 1.35 + gain * 0.16, 0, 1);
      return {
        ...sample,
        height: round(clamp(sample.height + delta * gain + crest + event.force * 0.12 * Math.sin((sample.u - sample.v + serial * 0.17) * Math.PI * 2) + (0.5 - sample.v) * dy * event.force * 0.018, 0.08, 0.94)),
        phase: round(sample.phase + (neighbor.phase - sample.phase) * 0.52 + delta * 0.4 + dx * event.force * 0.012 - dy * event.force * 0.009 + event.force * 0.055 * Math.sin((sample.u + sample.v + serial * 0.21) * Math.PI * 2)),
        inheritance: round(inherited),
        fold: round(clamp(sample.fold + Math.abs(delta) * 0.7 + event.force * 0.025 * (0.5 + Math.abs(along - front)), 0.06, 0.86)),
        depth: round(clamp(sample.depth + delta * 0.42 + (sample.u - sample.v) * (dx - dy) * 0.014, 0, 1))
      };
    });
    routes.push(`${event.direction}:${event.start.x},${event.start.y}>${event.end.x},${event.end.y}`);
  });
  const signature = JSON.stringify({
    routes: routes.join('|') || 'quiet',
    samples: samples.map((sample) => [sample.id, sample.height, sample.phase, sample.inheritance, sample.fold, sample.depth])
  });
  return { samples, routes: routes.join('|') || 'quiet', signature };
};

const directionFrom = (start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
};

export const buildFrame = (stage = 0, memory = [], drag = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    drag: normalizeDrag(drag),
    lastAction,
    field: buildSurface(normalizedMemory)
  };
};

export const armSurface = (frame, input = {}) => {
  const point = { x: normalizePoint(input.x), y: normalizePoint(input.y) };
  return { ...frame, drag: { start: point, current: point, startedAt: finite(input.at, 0) }, lastAction: 'sweep-armed' };
};

export const moveSurface = (frame, input = {}) => {
  if (!frame.drag) return frame;
  return { ...frame, drag: { ...frame.drag, current: { x: normalizePoint(input.x), y: normalizePoint(input.y) } }, lastAction: 'sweep-moving' };
};

export const releaseSurface = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, drag: null, lastAction: 'memory-limit' };
  if (!frame.drag) return { ...frame, lastAction: 'sweep-refused-no-arm' };
  const start = frame.drag.start;
  const end = { x: normalizePoint(input.x, frame.drag.current.x), y: normalizePoint(input.y, frame.drag.current.y) };
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const duration = finite(input.releasedAt, frame.drag.startedAt) - frame.drag.startedAt;
  if (distance < MIN_SWIPE || duration < MIN_DURATION || duration > MAX_DURATION) return { ...frame, drag: null, lastAction: 'sweep-refused-bounds' };
  const event = {
    mode: 'propagation-beat',
    direction: directionFrom(start, end),
    start,
    end,
    distance,
    duration,
    force: 0.64 + ((frame.memory.length + Math.round(distance * 10)) % 3) * 0.08
  };
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'propagation-committed');
};

export const liftLatestBeat = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'beat-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');
export const defaultSweep = (frame) => {
  const directions = [
    [{ x: 0.16, y: 0.5 }, { x: 0.84, y: 0.5 }],
    [{ x: 0.5, y: 0.16 }, { x: 0.5, y: 0.84 }],
    [{ x: 0.84, y: 0.5 }, { x: 0.16, y: 0.5 }],
    [{ x: 0.5, y: 0.84 }, { x: 0.5, y: 0.16 }]
  ];
  return directions[frame.memory.length % directions.length];
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    if (frame.memory.length < MEMORY_LIMIT) {
      const [start, end] = defaultSweep(frame);
      frame = releaseSurface(armSurface(frame, { ...start, at: 0 }), { ...end, releasedAt: 420 });
    } else {
      frame = buildFrame(stage, frame.memory, null, 'settled-preview');
    }
    timeline.push(buildFrame(stage, frame.memory, null, frame.memory.length ? 'settled-preview' : 'quiet'));
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, samples: frame.field.samples });
export const samplePoints = () => baseSamples().map((sample) => ({ id: sample.id, x: sample.u, y: sample.v }));
export const sampleAt = (x, y) => {
  const column = integer(Math.round(normalizePoint(x) * (GRID_W - 1)), 0, GRID_W - 1);
  const row = integer(Math.round(normalizePoint(y) * (GRID_H - 1)), 0, GRID_H - 1);
  return column + row * GRID_W;
};
