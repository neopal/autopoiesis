export const FOLD_COUNT = 9;
export const MEMORY_LIMIT = 4;
export const STAGES = 13;
export const MIN_PRESS_MS = 120;
export const MAX_PRESS_MS = 560;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rounded = (value) => Number(value.toFixed(5));
const fract = (value) => value - Math.floor(value);

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

function seeded(index, salt = 0) {
  return fract(hash(0x42525530 + index * 991 + salt * 313) / 4294967296);
}

function number(value) {
  return rounded(Number.isFinite(value) ? value : 0);
}

function normalizePoint(point) {
  return {
    x: number(clamp(Number(point?.x) || 0.5, 0.04, 0.96)),
    y: number(clamp(Number(point?.y) || 0.5, 0.06, 0.94))
  };
}

function normalizePulse(pulse) {
  return {
    point: normalizePoint(pulse?.point),
    duration: Math.round(clamp(Number(pulse?.duration) || 0, 0, 5000))
  };
}

function pulseKey(pulse) {
  const normalized = normalizePulse(pulse);
  return `${normalized.point.x}:${normalized.point.y}@${normalized.duration}`;
}

function clonePulse(pulse, source = pulse?.source || 'unknown') {
  const normalized = normalizePulse(pulse);
  return {
    kind: 'pressure-pulse',
    point: normalized.point,
    duration: normalized.duration,
    source
  };
}

function baselineFold(index) {
  return {
    id: index,
    x: number(0.16 + index * 0.085 + (seeded(index, 2) - 0.5) * 0.018),
    y: number(0.5 + (seeded(index, 3) - 0.5) * 0.025),
    width: number(0.145 + seeded(index, 4) * 0.035),
    height: number(0.74 + seeded(index, 5) * 0.09),
    lean: number((seeded(index, 6) - 0.5) * 0.11),
    phase: number(seeded(index, 7) * TAU),
    pigment: number(0.55 + seeded(index, 8) * 0.42),
    buckle: 0,
    lift: 0,
    scar: 0,
    points: []
  };
}

function eventInfluence(event, eventIndex) {
  const normalized = normalizePulse(event);
  const field = hash(Math.round((normalized.point.x * 211 + normalized.point.y * 379 + normalized.duration * 0.031) * 1000) + eventIndex * 1013 + 0x42525530);
  const buckleIndex = field % FOLD_COUNT;
  const gap = 2 + Math.floor(fract(field / 4294967296) * 4);
  const liftIndex = (buckleIndex + gap) % FOLD_COUNT;
  const scarIndex = (liftIndex + 2 + (eventIndex % 2)) % FOLD_COUNT;
  const energy = clamp((normalized.duration - MIN_PRESS_MS) / (MAX_PRESS_MS - MIN_PRESS_MS), 0.08, 1);
  return {
    buckleIndex,
    liftIndex,
    scarIndex,
    energy,
    duration: normalized.duration,
    point: normalized.point
  };
}

function foldPoints(fold) {
  const points = [];
  const top = clamp(fold.y - fold.height / 2, 0.04, 0.86);
  const bottom = clamp(fold.y + fold.height / 2, 0.14, 0.96);
  const steps = 15;
  for (let side = -1; side <= 1; side += 2) {
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const wave = Math.sin(t * TAU + fold.phase) * 0.008;
      const center = fold.x + fold.lean * (t - 0.5) + wave;
      const buckle = Math.sin(Math.PI * t) * fold.buckle * 0.042;
      const lift = Math.sin(Math.PI * t) * fold.lift * 0.032;
      const scar = Math.sin(Math.PI * t * 2) * fold.scar * 0.026;
      const width = fold.width * (1 - fold.buckle * 0.22 * Math.sin(Math.PI * t) + fold.lift * 0.14 * Math.sin(Math.PI * t));
      points.push({
        x: number(clamp(center + side * width / 2 + side * buckle + scar, 0.02, 0.98)),
        y: number(clamp(top + (bottom - top) * t + lift * side, 0.02, 0.98))
      });
    }
  }
  return points;
}

function polygonPath(points) {
  return `${points.map((point, index) => `${index ? 'L' : 'M'} ${number(point.x * 1000)} ${number(point.y * 700)}`).join(' ')} Z`;
}

function replay(memory) {
  const folds = Array.from({ length: FOLD_COUNT }, (_, index) => baselineFold(index));
  let underside = 0;
  let lastPulse = null;

  memory.forEach((event, eventIndex) => {
    const influence = eventInfluence(event, eventIndex);
    const buckleFold = folds[influence.buckleIndex];
    const liftFold = folds[influence.liftIndex];
    const scarFold = folds[influence.scarIndex];

    buckleFold.buckle = clamp(buckleFold.buckle + 0.35 + influence.energy * 0.9, 0, 2.2);
    buckleFold.lean = clamp(buckleFold.lean + (influence.point.x - 0.5) * 0.16, -0.3, 0.3);
    buckleFold.pigment = clamp(buckleFold.pigment + 0.08 + influence.energy * 0.16, 0.2, 1.8);

    liftFold.lift = clamp(liftFold.lift + 0.28 + influence.energy * 0.76, 0, 2.2);
    liftFold.height = clamp(liftFold.height - 0.018 - influence.energy * 0.06, 0.58, 0.9);
    liftFold.pigment = clamp(liftFold.pigment - 0.05 - influence.energy * 0.1, 0.2, 1.8);

    scarFold.scar = clamp(scarFold.scar + 0.32 + influence.energy * 0.82, 0, 2.2);
    scarFold.lean = clamp(scarFold.lean + (eventIndex % 2 ? -0.035 : 0.045), -0.3, 0.3);
    underside = clamp(underside + 0.22 + influence.energy * 0.42, 0, 2.2);
    lastPulse = { ...clonePulse(event, event.source), ...influence };
  });

  folds.forEach((fold) => { fold.points = foldPoints(fold); });
  return {
    folds,
    foldPaths: folds.map((fold) => polygonPath(fold.points)),
    underside,
    lastPulse
  };
}

function frameFrom(stage, memory, interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map((event) => clonePulse(event, event.source));
  const result = replay(boundedMemory);
  return {
    grammar: 'pressure-register',
    stage,
    memory: boundedMemory,
    pulses: boundedMemory,
    folds: result.folds,
    foldPaths: result.foldPaths,
    underside: result.underside,
    lastPulse: result.lastPulse,
    buckledCount: result.folds.filter((fold) => fold.buckle > 0.01).length,
    liftedCount: result.folds.filter((fold) => fold.lift > 0.01).length,
    scarredCount: result.folds.filter((fold) => fold.scar > 0.01).length,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory);
}

export function geometrySignature(frame) {
  return JSON.stringify({
    underside: rounded(frame.underside),
    folds: frame.folds.map((fold) => ({
      id: fold.id,
      x: rounded(fold.x),
      y: rounded(fold.y),
      width: rounded(fold.width),
      height: rounded(fold.height),
      lean: rounded(fold.lean),
      buckle: rounded(fold.buckle),
      lift: rounded(fold.lift),
      scar: rounded(fold.scar),
      points: fold.points
    }))
  });
}

export function applyPulse(frame, pulse, source = 'pointer-pulse') {
  const normalized = normalizePulse(pulse);
  if (normalized.duration < MIN_PRESS_MS) return { ...frame, interaction: 'pulse-refused-weak' };
  if (normalized.duration > MAX_PRESS_MS) return { ...frame, interaction: 'pulse-refused-overheld' };
  const previous = frame.memory.at(-1);
  if (previous && pulseKey(previous) === pulseKey(normalized)) return { ...frame, interaction: 'pulse-refused-repeat' };
  return frameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, { ...normalized, source }], 'pulse-committed');
}

export function liftLatestPulse(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'pulse-lift-refused' };
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'pulse-lifted');
}

export function releasePulses(frame) {
  return frameFrom(0, [], 'pulses-released');
}

function timelinePulse(index) {
  const events = [
    { point: { x: 0.22, y: 0.68 }, duration: 260 },
    { point: { x: 0.78, y: 0.31 }, duration: 420 },
    { point: { x: 0.18, y: 0.3 }, duration: 180 },
    { point: { x: 0.84, y: 0.62 }, duration: 510 }
  ];
  return { ...events[index % events.length], source: 'timeline' };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % 3 === 0) memory = [...memory, timelinePulse(stage / 3 - 1)].slice(-MEMORY_LIMIT);
    timeline.push(frameFrom(stage, memory, stage === 0 ? 'baseline' : 'timeline'));
  }
  return timeline;
}

export function frameForMemory(memory) {
  return frameFrom(memory.length, memory);
}

export { pulseKey };
