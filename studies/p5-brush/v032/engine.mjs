export const BAND_COUNT = 8;
export const BRISTLE_COUNT = 44;
export const POINT_COUNT = 56;
export const STAGES = 13;
export const MEMORY_LIMIT = 3;
export const MIN_RAKE_MS = 160;
export const MAX_RAKE_MS = 1000;
export const MIN_TRAVEL = 0.14;
export const UNDO_LIMIT = 12;

const TAU = Math.PI * 2;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

function seeded(index, salt) {
  return (hash(0x42525532 + index * 997 + salt * 317) >>> 0) / 4294967296;
}

function normalizePoint(point, fallback = { x: 0.5, y: 0.5 }) {
  return {
    x: round(clamp(Number.isFinite(Number(point?.x)) ? Number(point.x) : fallback.x, 0.05, 0.95)),
    y: round(clamp(Number.isFinite(Number(point?.y)) ? Number(point.y) : fallback.y, 0.08, 0.92))
  };
}

function normalizeRake(rake) {
  const start = normalizePoint(rake?.start);
  const end = normalizePoint(rake?.end, start);
  return {
    start,
    end,
    duration: Math.round(clamp(Number(rake?.duration) || 0, 0, 5000)),
    pressure: round(clamp(Number(rake?.pressure) || 0.68, 0.18, 1))
  };
}

function rakeKey(rake) {
  const normalized = normalizeRake(rake);
  return `${normalized.start.x}:${normalized.start.y}>${normalized.end.x}:${normalized.end.y}@${normalized.duration}:${normalized.pressure}`;
}

const STROKE_LAYOUTS = [
  { startX: 0.08, startY: 0.72, endX: 0.92, endY: 0.24, amplitude: 0.046, width: 0.048, grain: 0.9, color: 0 },
  { startX: 0.11, startY: 0.79, endX: 0.86, endY: 0.55, amplitude: 0.032, width: 0.036, grain: 0.76, color: 1 },
  { startX: 0.06, startY: 0.34, endX: 0.72, endY: 0.2, amplitude: 0.038, width: 0.029, grain: 0.62, color: 2 },
  { startX: 0.24, startY: 0.18, endX: 0.93, endY: 0.46, amplitude: 0.05, width: 0.043, grain: 0.73, color: 3 },
  { startX: 0.08, startY: 0.48, endX: 0.89, endY: 0.75, amplitude: 0.052, width: 0.056, grain: 0.84, color: 4 },
  { startX: 0.27, startY: 0.84, endX: 0.95, endY: 0.78, amplitude: 0.022, width: 0.026, grain: 0.58, color: 5 },
  { startX: 0.29, startY: 0.5, endX: 0.77, endY: 0.67, amplitude: 0.062, width: 0.032, grain: 0.68, color: 6 },
  { startX: 0.1, startY: 0.28, endX: 0.57, endY: 0.34, amplitude: 0.025, width: 0.022, grain: 0.52, color: 7 }
];

export const CONTROL_RAKES = [
  { start: { x: 0.15, y: 0.72 }, end: { x: 0.43, y: 0.31 }, duration: 310, pressure: 0.76 },
  { start: { x: 0.77, y: 0.3 }, end: { x: 0.55, y: 0.7 }, duration: 480, pressure: 0.88 },
  { start: { x: 0.21, y: 0.26 }, end: { x: 0.52, y: 0.54 }, duration: 220, pressure: 0.62 },
  { start: { x: 0.81, y: 0.66 }, end: { x: 0.58, y: 0.37 }, duration: 690, pressure: 0.94 }
];

export function nextControlRake(cursor = 0) {
  const index = ((Math.trunc(cursor) % CONTROL_RAKES.length) + CONTROL_RAKES.length) % CONTROL_RAKES.length;
  return { ...CONTROL_RAKES[index], controlIndex: index };
}

function baselineBand(index) {
  const layout = STROKE_LAYOUTS[index % STROKE_LAYOUTS.length];
  return {
    id: index,
    startX: layout.startX,
    startY: layout.startY,
    endX: layout.endX,
    endY: layout.endY,
    phase: round(seeded(index, 2) * TAU),
    amplitude: round(layout.amplitude + (seeded(index, 3) - 0.5) * 0.012),
    width: round(layout.width + (seeded(index, 4) - 0.5) * 0.008),
    grain: round(layout.grain + (seeded(index, 5) - 0.5) * 0.12),
    pigment: layout.color,
    dryT: 0.5,
    dryEnergy: 0,
    shear: 0,
    thinning: 0,
    swelling: 0,
    scoring: 0,
    bristles: []
  };
}

function bell(value, center, radius) {
  const distance = Math.abs(value - center) / Math.max(radius, 0.001);
  return distance >= 1 ? 0 : 1 - distance * distance * (3 - 2 * distance);
}

function eventInfluence(rake, eventIndex) {
  const normalized = normalizeRake(rake);
  const travel = Math.hypot(normalized.end.x - normalized.start.x, normalized.end.y - normalized.start.y);
  const field = hash(Math.round((normalized.start.x * 211 + normalized.end.y * 379 + normalized.duration * 0.031 + travel * 997) * 1000) + eventIndex * 1013 + 0x42525532);
  const entryBand = field % BAND_COUNT;
  const remoteBand = (entryBand + 2 + (field % (BAND_COUNT - 3))) % BAND_COUNT;
  const counterBand = (remoteBand + 3 + eventIndex) % BAND_COUNT;
  const scarBand = (counterBand + 3 + (field % 3)) % BAND_COUNT;
  const remoteT = clamp((normalized.start.x + normalized.end.x) * 0.5 + (seeded(eventIndex, 9) - 0.5) * 0.18, 0.16, 0.84);
  const energy = clamp((normalized.duration - MIN_RAKE_MS) / (MAX_RAKE_MS - MIN_RAKE_MS) * 2.4, 0.24, 1) * clamp(travel / 0.54, 0.35, 1) * normalized.pressure;
  return {
    entryBand,
    remoteBand,
    counterBand,
    scarBand,
    remoteT: round(remoteT),
    energy: round(energy),
    travel: round(travel)
  };
}

function buildBristle(band, bandIndex, bristleIndex, effects) {
  const middle = (BRISTLE_COUNT - 1) / 2;
  const depth = (bristleIndex - middle) / middle;
  const seed = seeded(bandIndex * BRISTLE_COUNT + bristleIndex, 8);
  const startTrim = 0.025 + seeded(bristleIndex, 12) * 0.1;
  const endTrim = 0.02 + seeded(bristleIndex, 13) * 0.12;
  const points = [];
  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const t = pointIndex / (POINT_COUNT - 1);
    const curve = Math.sin(t * TAU * (0.42 + seeded(bandIndex, 21) * 0.22) + band.phase) * band.amplitude;
    const secondaryCurve = Math.sin(t * TAU * 1.65 + seed * 23) * band.amplitude * 0.24;
    const centerX = band.startX + (band.endX - band.startX) * t + Math.sin(t * TAU * 0.35 + band.phase) * band.amplitude * 0.2;
    const centerY = band.startY + (band.endY - band.startY) * t + curve + secondaryCurve;
    const tangentX = band.endX - band.startX + Math.cos(t * TAU * 0.42 + band.phase) * band.amplitude * 0.45;
    const tangentY = band.endY - band.startY + Math.cos(t * TAU * 0.7 + band.phase) * band.amplitude * 0.45;
    const tangentLength = Math.max(0.001, Math.hypot(tangentX, tangentY));
    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;
    let x = centerX + normalX * (depth * band.width * (0.7 + Math.sin(t * Math.PI) * 0.28));
    let y = centerY + normalY * (depth * band.width * (0.7 + Math.sin(t * Math.PI) * 0.28));
    const individualWobble = Math.sin(t * TAU * (2.2 + seed * 1.7) + seed * 40) * band.width * (0.045 + Math.abs(depth) * 0.11);
    x += normalX * individualWobble;
    y += normalY * individualWobble;
    effects.forEach((effect) => {
      const local = bell(t, effect.remoteT, 0.27);
      if (bandIndex === effect.remoteBand) {
        y += effect.energy * 0.085 * local * (0.65 + depth * 0.9);
        x += effect.energy * 0.024 * local;
      }
      if (bandIndex === effect.counterBand) {
        y -= effect.energy * 0.06 * local * (1 - depth * 0.8);
        x -= effect.energy * 0.02 * local;
      }
      if (bandIndex === effect.scarBand) {
        y += Math.sin(t * TAU * 1.4 + effect.energy * 4) * effect.energy * 0.025 * local;
      }
    });
    const withinTrim = t >= startTrim && t <= 1 - endTrim;
    const gapSignal = Math.sin(t * 31 + seed * 17 + bandIndex * 0.8) + Math.sin(t * 67 + seed * 9) * 0.32;
    const dryLocal = band.dryEnergy > 0 ? bell(t, band.dryT, 0.22) : 0;
    const dryGap = clamp(band.thinning * (0.16 + dryLocal * 2.8), 0, 0.96);
    const dryLift = dryLocal > 0.3 && gapSignal < 0.2;
    const visible = withinTrim && !dryLift && (gapSignal > -1.12 + dryGap || pointIndex < 2 || pointIndex > POINT_COUNT - 3);
    const taper = 0.72 + Math.sin(t * Math.PI) * 0.3;
    const alpha = clamp(0.14 + band.grain * 0.58 + Math.sin(t * 9 + seed) * 0.16 - band.thinning * 0.22, 0.04, 0.95);
    points.push({
      x: round(x),
      y: round(y),
      alpha: round(alpha),
      weight: round(clamp((0.0007 + band.grain * 0.0028 + (1 - Math.abs(depth)) * 0.0016) * taper, 0.0007, 0.006)),
      visible
    });
  }
  return {
    id: bristleIndex,
    opacity: round(clamp(0.26 + seed * 0.64 - band.thinning * 0.18, 0.06, 0.96)),
    points
  };
}

function buildFrameFrom(stage, memory, interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map((rake) => ({ kind: 'weather-rake', ...normalizeRake(rake), source: rake.source || 'unknown' }));
  const bands = Array.from({ length: BAND_COUNT }, (_, index) => baselineBand(index));
  const effects = [];
  boundedMemory.forEach((rake, eventIndex) => {
    const influence = eventInfluence(rake, eventIndex);
    effects.push({ ...influence, eventIndex });
    const remote = bands[influence.remoteBand];
    const counter = bands[influence.counterBand];
    const scar = bands[influence.scarBand];
    remote.shear += influence.energy * 0.92;
    remote.thinning += influence.energy * 0.88;
    remote.dryT = influence.remoteT;
    remote.dryEnergy += influence.energy;
    counter.swelling += influence.energy * 0.86;
    counter.shear -= influence.energy * 0.62;
    scar.scoring += influence.energy * 0.9;
  });
  bands.forEach((band, bandIndex) => {
    band.bristles = Array.from({ length: BRISTLE_COUNT }, (_, bristleIndex) => buildBristle(band, bandIndex, bristleIndex, effects));
  });
  return {
    grammar: 'bristle-weather',
    stage,
    memory: boundedMemory,
    rakes: boundedMemory,
    effects,
    bands,
    undoStack: [],
    controlCursor: 0,
    bristleCount: BAND_COUNT * BRISTLE_COUNT,
    visiblePointCount: bands.reduce((sum, band) => sum + band.bristles.reduce((inner, bristle) => inner + bristle.points.filter((point) => point.visible).length, 0), 0),
    shearedCount: bands.filter((band) => band.shear > 0.01).length,
    thinnedCount: bands.filter((band) => band.thinning > 0.01).length,
    swollenCount: bands.filter((band) => band.swelling > 0.01).length,
    scoredCount: bands.filter((band) => band.scoring > 0.01).length,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function applyRake(frame, rake, source = 'pointer-rake') {
  const normalized = normalizeRake(rake);
  const travel = Math.hypot(normalized.end.x - normalized.start.x, normalized.end.y - normalized.start.y);
  if (normalized.duration < MIN_RAKE_MS) return { ...frame, interaction: 'rake-refused-weak' };
  if (normalized.duration > MAX_RAKE_MS) return { ...frame, interaction: 'rake-refused-overheld' };
  if (travel < MIN_TRAVEL) return { ...frame, interaction: 'rake-refused-still' };
  const previous = frame.memory.at(-1);
  if (previous && rakeKey(previous) === rakeKey(normalized)) return { ...frame, interaction: 'rake-refused-repeat' };
  const nextFrame = buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, { ...normalized, source }], 'rake-committed');
  nextFrame.undoStack = [...(frame.undoStack || []), {
    memory: frame.memory,
    stage: frame.stage,
    controlCursor: frame.controlCursor ?? 0
  }].slice(-UNDO_LIMIT);
  nextFrame.controlCursor = frame.controlCursor ?? 0;
  return nextFrame;
}

export function liftLatestRake(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'rake-lift-refused' };
  const snapshot = frame.undoStack?.at(-1);
  if (snapshot) {
    const restored = buildFrameFrom(snapshot.stage, snapshot.memory, 'rake-lifted');
    restored.undoStack = frame.undoStack.slice(0, -1);
    restored.controlCursor = snapshot.controlCursor ?? 0;
    return restored;
  }
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'rake-lifted');
}

export function releaseRakes(frame) {
  return buildFrameFrom(0, [], 'rakes-released');
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % 3 === 0) memory = [...memory, { ...CONTROL_RAKES[(stage / 3 - 1) % CONTROL_RAKES.length], source: 'timeline' }].slice(-MEMORY_LIMIT);
    timeline.push(buildFrameFrom(stage, memory, stage === 0 ? 'baseline' : 'timeline'));
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    grammar: frame.grammar,
    stage: frame.stage,
    memory: frame.memory,
    effects: frame.effects,
    bands: frame.bands.map((band) => ({
      id: band.id,
      shear: round(band.shear),
      thinning: round(band.thinning),
      swelling: round(band.swelling),
      scoring: round(band.scoring),
      bristles: band.bristles.map((bristle) => bristle.points.map((point) => [point.x, point.y, point.visible]))
    }))
  });
}

export { eventInfluence, normalizeRake, rakeKey };
