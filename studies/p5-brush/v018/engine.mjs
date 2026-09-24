export const SEED = 0x42525538;
export const STAGES = 15;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 48;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const gaussian = (distance, spread) => Math.exp(-((distance / Math.max(spread, 0.0001)) ** 2));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const copyPoint = (point) => ({ ...point });
const copyEvent = (event) => ({ ...event, point: copyPoint(event.point) });

function baseSurface(stage) {
  const random = rng(SEED + stage * 8191);
  const upper = [];
  const lower = [];
  const count = 18;
  for (let index = 0; index < count; index += 1) {
    const x = 0.08 + (0.84 * index) / (count - 1);
    const swell = Math.sin(index * 0.7 + stage * 0.19) * 0.018;
    upper.push({
      x,
      y: 0.26 + swell + (random() - 0.5) * 0.024,
      thickness: 0.62 + random() * 0.22,
      grain: 0.2 + random() * 0.6
    });
  }
  for (let index = count - 1; index >= 0; index -= 1) {
    const x = 0.08 + (0.84 * index) / (count - 1);
    const swell = Math.cos(index * 0.63 + stage * 0.21) * 0.022;
    lower.push({
      x,
      y: 0.75 + swell + (random() - 0.5) * 0.026,
      thickness: 0.5 + random() * 0.25,
      grain: 0.18 + random() * 0.66
    });
  }
  return [...upper, ...lower];
}

const baseFold = () => ({
  x: 0.79,
  y: 0.22,
  span: 0.16,
  depth: 0.018,
  turn: -0.12,
  load: 0.08,
  crease: 0.06
});

const makeAperture = () => ({
  x: 0.5,
  y: 0.48,
  rx: 0.018,
  ry: 0.025,
  rotation: 0,
  depth: 0,
  area: 0
});

function makeEvent(stage, point, source = 'autonomous-departure', pressure = 0.62) {
  const safePoint = {
    x: clamp(Number.isFinite(Number(point?.x)) ? Number(point.x) : 0.5, 0.1, 0.9),
    y: clamp(Number.isFinite(Number(point?.y)) ? Number(point.y) : 0.5, 0.15, 0.85)
  };
  const safePressure = clamp(Number(pressure) || 0.62, 0.28, 0.96);
  return {
    id: `${source}-fold-${stage}-${Math.round(safePoint.x * 1000)}-${Math.round(safePoint.y * 1000)}`,
    stage,
    source,
    kind: 'departure-fold',
    point: safePoint,
    pressure: safePressure,
    depth: 0.08 + safePressure * 0.12,
    aperture: 0.07 + safePressure * 0.07,
    fold: 0.08 + safePressure * 0.18,
    rule: 'departure-fold-back'
  };
}

function automaticDeparture(stage) {
  const random = rng(SEED + stage * 1543);
  return makeEvent(stage, {
    x: 0.18 + random() * 0.64,
    y: 0.23 + random() * 0.5
  }, 'autonomous-departure', 0.42 + random() * 0.38);
}

function applyEventToSurface(surface, event) {
  return surface.map((point, index) => {
    const distance = Math.hypot(point.x - event.point.x, point.y - event.point.y);
    const influence = gaussian(distance, 0.28);
    const side = index < surface.length / 2 ? -1 : 1;
    return {
      x: clamp(point.x + influence * event.depth * (event.point.x - 0.5) * 0.14, 0.04, 0.96),
      y: clamp(point.y + influence * event.depth * (0.35 + side * 0.22), 0.08, 0.92),
      thickness: clamp(point.thickness - influence * event.depth * 0.56, 0.08, 1),
      grain: clamp(point.grain + influence * event.fold * 0.24, 0.05, 1)
    };
  });
}

function applyEventToFold(fold, event) {
  const direction = event.point.x < 0.5 ? 1 : -1;
  return {
    x: clamp(fold.x + direction * event.fold * 0.18, 0.58, 0.92),
    y: clamp(fold.y + (event.point.y - 0.5) * event.fold * 0.24, 0.12, 0.42),
    span: clamp(fold.span + event.fold * 0.22, 0.12, 0.52),
    depth: clamp(fold.depth + event.fold * 0.52, 0.012, 0.42),
    turn: fold.turn - direction * event.fold * 0.62,
    load: clamp(fold.load + event.fold * 0.72, 0.04, 1),
    crease: clamp(fold.crease + event.depth * 0.55, 0.02, 0.86)
  };
}

function applyEventToApertures(apertures, event) {
  const aperture = {
    x: event.point.x,
    y: clamp(0.47 + (event.point.y - 0.5) * 0.18, 0.28, 0.68),
    rx: 0.028 + event.aperture * 0.34,
    ry: 0.04 + event.aperture * 0.48,
    rotation: (event.point.x - 0.5) * 0.9,
    depth: event.depth,
    area: Math.PI * (0.028 + event.aperture * 0.34) * (0.04 + event.aperture * 0.48)
  };
  return [...apertures, aperture].slice(-MEMORY_LIMIT);
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let surface = baseSurface(safeStage);
  let fold = baseFold();
  let apertures = [];
  inherited.forEach((event) => {
    surface = applyEventToSurface(surface, event);
    fold = applyEventToFold(fold, event);
    apertures = applyEventToApertures(apertures, event);
  });
  const aperture = apertures.at(-1) ?? makeAperture();
  return {
    stage: safeStage,
    memory: inherited,
    surface,
    fold,
    backFold: fold,
    apertures,
    aperture,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'continuous-membrane-backfold'
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, automaticDeparture(stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function registerDeparture(frame, point) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const normalized = {
    x: clamp(Number(point?.x) || 0.5, 0.1, 0.9),
    y: clamp(Number(point?.y) || 0.5, 0.15, 0.85)
  };
  const pressure = clamp(0.38 + Math.hypot(normalized.x - 0.5, normalized.y - 0.5) * 1.3, 0.28, 0.94);
  const departure = makeEvent(baseline.stage, normalized, 'visitor-departure', pressure);
  return {
    ...buildFrame(baseline.stage, [...baseline.memory, departure]),
    interaction: 'visitor-departure-fold',
    restoreMemory: baseline.memory.map(copyEvent)
  };
}

export function liftLatestDeparture(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'departure-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'departure-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'departure-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    surface: frame.surface.map((point) => [point.x, point.y, point.thickness, point.grain]),
    apertures: frame.apertures,
    fold: frame.fold
  });
}
