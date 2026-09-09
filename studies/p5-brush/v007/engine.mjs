export const SEED = 0x42525537;
export const STAGES = 11;
export const STROKE_COUNT = 8;
export const POINT_COUNT = 56;
export const MEMORY_LIMIT = 6;
export const PRIMITIVE_BUDGET = 31;

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
  const lane = (stage * 3 + 1) % STROKE_COUNT;
  return {
    id: `auto-capillary-${stage}`,
    stage,
    source: 'autonomous-capillary',
    point: {
      x: clamp(0.14 + stage * 0.073 + (random() - 0.5) * 0.046, 0.1, 0.86),
      y: clamp(0.12 + lane * 0.108 + (random() - 0.5) * 0.034, 0.1, 0.9)
    },
    radius: 0.039 + random() * 0.018,
    pull: 0.18 + random() * 0.062,
    release: 0.14 + random() * 0.055,
    delay: 0.065 + random() * 0.034,
    stain: 0.1 + random() * 0.05,
    side: stage % 2 === 0 ? 1 : -1,
    lane
  };
}

function relevanceFor(seam, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - seam.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.235);
  const ageWeight = 0.82 + Math.min(strokeIndex, 7) * 0.032;
  return laneWeight * ageWeight;
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.095 + strokeIndex * 0.108;
  const phase = random() * Math.PI * 2;
  const points = [];
  let absorptionDelta = 0;
  let wakeShift = 0;
  let absorptionCount = 0;
  let releaseCount = 0;
  let density = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.042 + progress * 0.916;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.36 + strokeIndex * 0.24) + stage * 0.17) * (0.015 + random() * 0.012)
      + Math.sin(progress * Math.PI * 3.2 + strokeIndex * 0.58) * 0.0068;
    let localAbsorption = 0;
    let localWake = 0;
    let localStain = 0;

    for (const seam of memory) {
      const relevance = relevanceFor(seam, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - seam.point.x;
      const approach = smoothstep((distance + seam.radius * 1.6) / (seam.radius * 1.65));
      const release = smoothstep((distance - seam.radius * 0.05 - seam.delay) / (seam.radius * 2.8));
      const drawIn = approach * (1 - release);
      const wake = release * (0.66 + approach * 0.34);
      const route = seam.side * relevance * (seam.pull * drawIn - seam.release * wake * 0.78);
      const wetting = Math.exp(-Math.pow((distance - seam.radius * 0.12) / (seam.radius * 1.65), 2)) * seam.stain * relevance;

      y += route;
      localAbsorption += seam.pull * drawIn * relevance;
      localWake += seam.release * wake * relevance;
      localStain += wetting;
      if (drawIn > 0.18) absorptionCount += 1;
      if (wake > 0.2) releaseCount += 1;
    }

    const boundedAbsorption = clamp(localAbsorption, 0, 0.4);
    const boundedWake = clamp(localWake, 0, 0.28);
    const boundedStain = clamp(localStain, 0, 0.28);
    absorptionDelta += boundedAbsorption / POINT_COUNT;
    wakeShift += (boundedWake * (pointIndex / (POINT_COUNT - 1))) / POINT_COUNT;
    density += boundedStain / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.045, 0.955),
      absorption: boundedAbsorption,
      wake: boundedWake,
      stain: boundedStain,
      width: clamp(1 + boundedAbsorption * 0.7 + boundedStain * 1.5, 1, 1.48)
    });
  }

  const baseWeight = 0.006 + random() * 0.0045;
  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    points,
    baseY,
    weight: baseWeight * clamp(1 + absorptionDelta * 1.6 + density * 0.8, 0.84, 1.28),
    opacity: 0.56 + random() * 0.22,
    absorptionDelta,
    wakeShift,
    absorptionCount,
    releaseCount,
    density,
    routeShift: points.at(-1).y - points[0].y
  };
}

function makeDeltas(memory, stage) {
  return memory.map((seam, index) => ({
    id: seam.id,
    point: copyPoint(seam.point),
    radius: seam.radius * (1 + Math.min(index, 5) * 0.06),
    pull: seam.pull,
    release: seam.release,
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
    id: `visitor-capillary-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-capillary',
    point: bounded,
    radius: 0.06,
    pull: 0.232,
    release: 0.19,
    delay: 0.085,
    stain: 0.16,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.round((bounded.y - 0.095) / 0.108)
  };
  const next = buildFrame(frame.stage, [...frame.memory, seam]);
  return { ...next, interaction: 'visitor-capillary' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'capillary-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'capillary-lifted' };
}
