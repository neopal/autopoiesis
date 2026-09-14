export const SEED = 0x42525532;
export const STAGES = 16;
export const STROKE_COUNT = 15;
export const POINT_COUNT = 80;
export const MEMORY_LIMIT = 8;
export const PRIMITIVE_BUDGET = 57;

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

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyWake = (wake) => ({ ...wake, point: copyPoint(wake.point) });

function automaticWake(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 7 + 4) % STROKE_COUNT;
  return {
    id: `auto-wake-braid-${stage}`,
    stage,
    source: 'autonomous-wake-braid',
    point: {
      x: clamp(0.11 + stage * 0.052 + (random() - 0.5) * 0.045, 0.08, 0.91),
      y: clamp(0.065 + lane * 0.061 + (random() - 0.5) * 0.026, 0.055, 0.945)
    },
    radius: 0.026 + random() * 0.012,
    reach: 0.15 + random() * 0.04,
    split: 0.105 + random() * 0.035,
    braid: 0.16 + random() * 0.065,
    settle: 0.2 + random() * 0.075,
    stain: 0.15 + random() * 0.07,
    side: stage % 2 === 0 ? 1 : -1,
    lane,
    rule: 'wake-braid'
  };
}

function relevanceFor(wake, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - wake.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.235);
  const neighborWeight = clamp(1 - Math.abs(strokeIndex - wake.lane) / 4.8);
  return laneWeight * (0.28 + neighborWeight * 0.72);
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.065 + strokeIndex * 0.061;
  const phase = random() * Math.PI * 2;
  const points = [];
  let bankMass = 0;
  let braidMass = 0;
  let settleMass = 0;
  let wetLoad = 0;
  let routeShift = 0;
  let maxSeparation = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.024 + progress * 0.952;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.55 + strokeIndex * 0.13) + stage * 0.095) * (0.010 + random() * 0.008)
      + Math.sin(progress * Math.PI * 4.8 + strokeIndex * 0.31) * 0.0038;
    let localBank = 0;
    let localBraid = 0;
    let localSettle = 0;
    let localWet = 0;

    for (const wake of memory) {
      const relevance = relevanceFor(wake, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - wake.point.x;
      const approach = smoothstep((distance + wake.reach) / (wake.reach * 0.86))
        * (1 - smoothstep((distance + wake.radius * 0.12) / (wake.reach * 0.68)));
      const bank = smoothstep((distance + wake.radius * 1.1) / (wake.radius * 1.55))
        * (1 - smoothstep((distance - wake.radius * 0.42) / (wake.radius * 1.35)));
      const fork = smoothstep((distance + wake.radius * 0.15) / (wake.radius * 1.55))
        * (1 - smoothstep((distance - wake.radius * 1.1) / (wake.braid * 1.55)));
      const settle = smoothstep((distance + wake.radius * 0.25) / (wake.settle * 0.75))
        * Math.exp(-Math.max(0, distance) / wake.settle);
      const laneOffset = strokeIndex - wake.lane;
      const laneSign = laneOffset === 0 ? (strokeIndex % 2 === 0 ? -1 : 1) : Math.sign(laneOffset);
      const signed = wake.side * laneSign;
      const bankTarget = wake.point.y + laneOffset * 0.0036 * wake.side;
      const bankRoute = (bankTarget - baseY) * relevance * 0.3 * approach;
      const branchRoute = signed * relevance * wake.split * (0.72 + 0.28 * Math.sin(Math.PI * clamp((distance + wake.radius) / Math.max(wake.braid, 0.001)))) * fork;
      const settleRoute = -signed * relevance * wake.split * 0.78 * settle;
      const braidedRoute = signed * relevance * wake.braid * Math.sin(Math.PI * clamp((distance - wake.radius * 0.1) / Math.max(wake.braid, 0.001))) * fork;

      y += bankRoute + branchRoute + braidedRoute + settleRoute;
      localBank += Math.abs(bankRoute);
      localBraid += Math.abs(branchRoute) + Math.abs(braidedRoute);
      localSettle += Math.abs(settleRoute);
      localWet += Math.abs(branchRoute) * 0.44 + Math.abs(braidedRoute) * 0.8 + Math.abs(settleRoute) * 0.55;
      maxSeparation = Math.max(maxSeparation, Math.abs(branchRoute + braidedRoute));
    }

    const boundedBank = clamp(localBank, 0, 0.32);
    const boundedBraid = clamp(localBraid, 0, 0.44);
    const boundedSettle = clamp(localSettle, 0, 0.34);
    const boundedWet = clamp(localWet, 0, 0.42);
    bankMass += boundedBank / POINT_COUNT;
    braidMass += boundedBraid / POINT_COUNT;
    settleMass += boundedSettle / POINT_COUNT;
    wetLoad += boundedWet / POINT_COUNT;
    routeShift += (boundedBank + boundedBraid * 0.82 + boundedSettle * 0.55) * (0.3 + progress) / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.028, 0.972),
      bank: boundedBank,
      braid: boundedBraid,
      settle: boundedSettle,
      width: clamp(1 + boundedBank * 1.45 + boundedBraid * 2.7 + boundedSettle * 1.65, 1, 1.94),
      wet: clamp(0.06 + boundedWet * 1.5, 0.06, 0.82)
    });
  }

  const forkIndex = Math.max(0, Math.min(POINT_COUNT - 1, Math.round((memory.at(-1)?.point.x ?? 0.5) * (POINT_COUNT - 1))));
  const nearest = memory.length ? memory.reduce((best, wake) => {
    const candidate = Math.round(wake.point.x * (POINT_COUNT - 1));
    return Math.abs(candidate - forkIndex) < Math.abs(best - forkIndex) ? candidate : best;
  }, forkIndex) : forkIndex;
  const splitSeparation = memory.length ? Math.abs(points[nearest].y - baseY) : 0;

  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    index: strokeIndex,
    points,
    baseY,
    weight: (0.0042 + random() * 0.003) * clamp(1 + braidMass * 2.25 + settleMass, 0.82, 1.46),
    opacity: 0.49 + random() * 0.3,
    bankMass,
    braidMass,
    settleMass,
    wetLoad,
    routeShift,
    splitSeparation: Math.max(splitSeparation, maxSeparation)
  };
}

function makeDeltas(memory, stage) {
  return memory.map((wake, index) => ({
    id: wake.id,
    point: copyPoint(wake.point),
    radius: wake.radius * (1 + Math.min(index, 7) * 0.05),
    reach: wake.reach,
    split: wake.split,
    braid: wake.braid,
    settle: wake.settle,
    side: wake.side,
    age: Math.max(0, stage - wake.stage),
    source: wake.source,
    rule: 'wake-braid'
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copyWake).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    deltas: makeDeltas(inherited, safeStage),
    currentWake: automaticWake(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentWake].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyRemoval(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const wake = {
    id: `visitor-wake-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-wake',
    point: bounded,
    radius: 0.046,
    reach: 0.17,
    split: 0.128,
    braid: 0.205,
    settle: 0.25,
    stain: 0.22,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.max(0, Math.min(STROKE_COUNT - 1, Math.round((bounded.y - 0.065) / 0.061))),
    rule: 'wake-braid'
  };
  const next = buildFrame(frame.stage, [...frame.memory, wake]);
  return { ...next, interaction: 'visitor-wake' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'wake-braid-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'wake-braid-lifted' };
}
