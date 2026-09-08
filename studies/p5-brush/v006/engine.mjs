export const SEED = 0x42525536;
export const STAGES = 10;
export const STROKE_COUNT = 7;
export const POINT_COUNT = 54;
export const MEMORY_LIMIT = 6;
export const PRIMITIVE_BUDGET = 29;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copySeam(seam) {
  return { ...seam, point: copyPoint(seam.point) };
}

function automaticSeam(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 3 + 2) % STROKE_COUNT;
  return {
    id: `auto-seam-${stage}`,
    stage,
    source: 'autonomous-return',
    point: {
      x: clamp(0.17 + stage * 0.071 + (random() - 0.5) * 0.045, 0.12, 0.84),
      y: clamp(0.14 + lane * 0.113 + (random() - 0.5) * 0.034, 0.11, 0.89)
    },
    radius: 0.036 + random() * 0.018,
    turn: 0.16 + random() * 0.055,
    delay: 0.07 + random() * 0.028,
    pressure: 0.1 + random() * 0.04,
    side: stage % 2 === 0 ? 1 : -1,
    lane
  };
}

function relevanceFor(seam, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - seam.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.22);
  const ageWeight = 0.78 + Math.min(strokeIndex, 6) * 0.035;
  return laneWeight * ageWeight;
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.13 + strokeIndex * 0.115;
  const phase = random() * Math.PI * 2;
  const points = [];
  let returnShift = 0;
  let pressure = 0;
  let returnCount = 0;
  let widthFactor = 1;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.045 + progress * 0.91;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.42 + strokeIndex * 0.21) + stage * 0.19) * (0.016 + random() * 0.013)
      + Math.sin(progress * Math.PI * 3.1 + strokeIndex * 0.61) * 0.0065;
    let localReturnShift = 0;
    let localPressure = 0;

    for (const seam of memory) {
      const relevance = relevanceFor(seam, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - seam.point.x;
      const approach = smoothstep((distance + seam.radius * 1.65) / (seam.radius * 1.55));
      const returnPhase = smoothstep((distance - seam.radius * 0.35 - seam.delay) / (seam.radius * 3.15));
      const corridor = approach * (1 - returnPhase);
      const reentry = returnPhase;
      const turn = seam.side * seam.turn * relevance;
      const route = turn * (corridor + reentry * 0.5);
      const pooledPressure = Math.exp(-Math.pow((distance - seam.radius * 2.15 - seam.delay) / (seam.radius * 1.7), 2)) * seam.pressure * relevance;

      y += route;
      localReturnShift += route;
      localPressure += pooledPressure;
      if (corridor > 0.17 || reentry > 0.22) returnCount += 1;
    }

    const boundedPressure = clamp(localPressure, 0, 0.34);
    returnShift += localReturnShift / POINT_COUNT;
    pressure += boundedPressure / POINT_COUNT;
    widthFactor += boundedPressure * 0.72 / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.06, 0.94),
      return: clamp(localReturnShift, -0.26, 0.26),
      pressure: boundedPressure,
      width: clamp(1 + boundedPressure * 0.8, 1, 1.25)
    });
  }

  const baseWeight = 0.0064 + random() * 0.0046;
  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    points,
    baseY,
    weight: baseWeight * clamp(widthFactor, 0.84, 1.16),
    opacity: 0.58 + random() * 0.2,
    pressure,
    returnShift,
    returnCount,
    routeShift: points.at(-1).y - points[0].y
  };
}

function makeDeltas(memory, stage) {
  return memory.map((seam, index) => ({
    id: seam.id,
    point: copyPoint(seam.point),
    radius: seam.radius * (1 + Math.min(index, 5) * 0.055),
    turn: seam.turn,
    delay: seam.delay,
    side: seam.side,
    age: Math.max(0, stage - seam.stage),
    source: seam.source
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copySeam).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    deltas: makeDeltas(inherited, safeStage),
    currentSeam: automaticSeam(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentSeam].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyRemoval(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.07, 0.93),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.1, 0.9)
  };
  const seam = {
    id: `visitor-seam-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-seam',
    point: bounded,
    radius: 0.058,
    turn: 0.205,
    delay: 0.095,
    pressure: 0.145,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.round((bounded.y - 0.13) / 0.115)
  };
  const next = buildFrame(frame.stage, [...frame.memory, seam]);
  return { ...next, interaction: 'visitor-seam' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'seam-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'seam-lifted' };
}
