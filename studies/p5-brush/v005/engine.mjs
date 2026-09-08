export const SEED = 0x42525535;
export const STAGES = 10;
export const STROKE_COUNT = 7;
export const POINT_COUNT = 48;
export const MEMORY_LIMIT = 5;
export const PRIMITIVE_BUDGET = 34;

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

function copyRemoval(removal) {
  return { ...removal, point: copyPoint(removal.point) };
}

function automaticRemoval(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 3 + 1) % STROKE_COUNT;
  return {
    id: `auto-removal-${stage}`,
    stage,
    source: 'autonomous-return',
    point: {
      x: clamp(0.2 + stage * 0.071 + (random() - 0.5) * 0.04, 0.15, 0.82),
      y: clamp(0.14 + lane * 0.112 + (random() - 0.5) * 0.032, 0.11, 0.89)
    },
    radius: 0.046 + random() * 0.019,
    force: 0.085 + random() * 0.028,
    spread: 0.067 + random() * 0.018,
    exchange: 0.074 + random() * 0.035,
    side: stage % 2 === 0 ? 1 : -1,
    lane
  };
}

function relevanceFor(removal, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - removal.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.16);
  const ageWeight = 0.76 + Math.min(strokeIndex, 6) * 0.04;
  return laneWeight * ageWeight;
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.13 + strokeIndex * 0.115;
  const phase = random() * Math.PI * 2;
  const points = [];
  let pigmentDelta = 0;
  let splitCount = 0;
  let widthFactor = 1;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.045 + progress * 0.91;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.55 + strokeIndex * 0.19) + stage * 0.21) * (0.017 + random() * 0.013)
      + Math.sin(progress * Math.PI * 3.4 + strokeIndex * 0.64) * 0.007;
    let split = 0;
    let localPigmentDelta = 0;
    let localWidth = 1;

    for (const delta of memory) {
      const relevance = relevanceFor(delta, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - delta.point.x;
      const mouth = Math.exp(-Math.pow(distance / (delta.radius * 1.02), 2));
      const fork = Math.exp(-Math.pow(distance / (delta.radius * 1.72), 2)) * relevance;
      const returnPhase = smoothstep((distance - delta.radius * 0.18) / (delta.radius * 2.6));
      const entryPhase = smoothstep((distance + delta.radius * 1.7) / (delta.radius * 1.85));
      const returnBias = delta.side * delta.force * returnPhase * relevance;
      const mouthPull = (delta.point.y - y) * mouth * delta.force * 1.35 * relevance;
      const exchanged = delta.exchange * relevance * (returnPhase - fork * 0.42);

      y += mouthPull + returnBias + delta.side * delta.force * 0.2 * fork;
      split += delta.spread * fork * (0.34 + entryPhase * 0.66);
      localPigmentDelta += exchanged;
      localWidth += -Math.abs(exchanged) * 0.9 + fork * 0.12;
      if (fork > 0.18) splitCount += 1;
    }

    const boundedSplit = clamp(split, 0, 0.125);
    const boundedPigmentDelta = clamp(localPigmentDelta, -0.4, 0.4);
    pigmentDelta += boundedPigmentDelta / POINT_COUNT;
    widthFactor += localWidth / POINT_COUNT - 1 / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.06, 0.94),
      split: boundedSplit,
      pigment: clamp(1 - Math.abs(boundedPigmentDelta) * 0.8, 0.38, 1),
      upperPigment: clamp(0.76 + boundedPigmentDelta * 1.7, 0.3, 1),
      lowerPigment: clamp(0.76 - boundedPigmentDelta * 1.7, 0.3, 1),
      width: clamp(1 - Math.abs(boundedPigmentDelta) * 0.25, 0.55, 1)
    });
  }

  const baseWeight = 0.0068 + random() * 0.0044;
  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    points,
    baseY,
    weight: baseWeight * clamp(widthFactor, 0.68, 1.08),
    opacity: 0.58 + random() * 0.2,
    pigmentDelta,
    splitCount,
    routeShift: points.at(-1).y - points[0].y
  };
}

function makeDeltas(memory, stage) {
  return memory.map((removal, index) => ({
    id: removal.id,
    point: copyPoint(removal.point),
    radius: removal.radius * (1 + Math.min(index, 4) * 0.06),
    spread: removal.spread,
    exchange: removal.exchange,
    side: removal.side,
    age: Math.max(0, stage - removal.stage),
    source: removal.source
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copyRemoval).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    deltas: makeDeltas(inherited, safeStage),
    currentRemoval: automaticRemoval(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentRemoval].slice(-MEMORY_LIMIT);
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
  const removal = {
    id: `visitor-removal-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-removal',
    point: bounded,
    radius: 0.06,
    force: 0.14,
    spread: 0.092,
    exchange: 0.12,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.round((bounded.y - 0.13) / 0.115)
  };
  const next = buildFrame(frame.stage, [...frame.memory, removal]);
  return { ...next, interaction: 'visitor-removal' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return buildFrame(frame.stage, []);
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'removal-lifted' };
}
