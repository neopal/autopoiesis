export const SEED = 0x42525534;
export const STAGES = 9;
export const STROKE_COUNT = 6;
export const POINT_COUNT = 42;
export const MEMORY_LIMIT = 5;
export const PRIMITIVE_BUDGET = 32;

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
  const lane = (stage * 2 + 1) % STROKE_COUNT;
  return {
    id: `auto-removal-${stage}`,
    stage,
    source: 'autonomous-return',
    point: {
      x: clamp(0.22 + stage * 0.069 + (random() - 0.5) * 0.035, 0.16, 0.8),
      y: clamp(0.18 + lane * 0.13 + (random() - 0.5) * 0.032, 0.12, 0.86)
    },
    radius: 0.048 + random() * 0.017,
    force: 0.105 + random() * 0.03,
    drain: 0.46 + random() * 0.16,
    side: stage % 2 === 0 ? 1 : -1,
    lane
  };
}

function relevanceFor(removal, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - removal.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.175);
  const ageWeight = 0.82 + Math.min(strokeIndex, 5) * 0.035;
  return laneWeight * ageWeight;
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.16 + strokeIndex * 0.13;
  const phase = random() * Math.PI * 2;
  const points = [];
  let absorbedPigment = 0;
  let returnShift = 0;
  let basinCrossings = 0;
  let widthFactor = 1;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.055 + progress * 0.89;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.7 + strokeIndex * 0.21) + stage * 0.19) * (0.018 + random() * 0.014)
      + Math.sin(progress * Math.PI * 3.2 + strokeIndex * 0.7) * 0.008;
    let localDrain = 0;

    for (const basin of memory) {
      const relevance = relevanceFor(basin, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distanceFromBasin = x - basin.point.x;
      const mouth = Math.exp(-Math.pow(distanceFromBasin / (basin.radius * 1.34), 2));
      const approach = smoothstep((distanceFromBasin + basin.radius * 1.7) / (basin.radius * 1.9));
      const returnWake = smoothstep((distanceFromBasin - basin.radius * 0.35) / (basin.radius * 1.9));
      const pullToBasin = (basin.point.y - y) * mouth * basin.force * 1.7 * relevance;
      const crossCurrent = basin.side * basin.force * mouth * (0.58 + returnWake * 0.42) * relevance;
      const wake = basin.side * basin.force * 0.2 * returnWake * (1 - returnWake * 0.35) * relevance;

      y += pullToBasin + crossCurrent + wake;
      localDrain += basin.drain * mouth * (0.82 + returnWake * 0.18) * relevance;
      if (mouth > 0.2) basinCrossings += 1;
      if (distanceFromBasin > basin.radius * 0.55) {
        returnShift += crossCurrent * 0.05;
      }
    }

    const boundedDrain = clamp(localDrain, 0, 0.78);
    absorbedPigment += boundedDrain / POINT_COUNT;
    widthFactor += -boundedDrain * 0.22;
    points.push({
      x,
      y: clamp(y, 0.07, 0.93),
      pigment: 1 - boundedDrain,
      width: clamp(1 - boundedDrain * 0.45, 0.52, 1)
    });
  }

  const baseWeight = 0.007 + random() * 0.005;
  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    points,
    baseY,
    weight: baseWeight * clamp(widthFactor / POINT_COUNT, 0.68, 1),
    opacity: 0.58 + random() * 0.22,
    absorbedPigment,
    returnShift,
    basinCrossings
  };
}

function makeBasins(memory, stage) {
  return memory.map((removal, index) => ({
    id: removal.id,
    point: copyPoint(removal.point),
    radius: removal.radius * (1 + Math.min(index, 4) * 0.065),
    force: removal.force,
    drain: removal.drain,
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
    basins: makeBasins(inherited, safeStage),
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
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.11, 0.89)
  };
  const removal = {
    id: `visitor-removal-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-removal',
    point: bounded,
    radius: 0.062,
    force: 0.148,
    drain: 0.7,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.round((bounded.y - 0.16) / 0.13)
  };
  const next = buildFrame(frame.stage, [...frame.memory, removal]);
  return { ...next, interaction: 'visitor-removal' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return buildFrame(frame.stage, []);
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'removal-lifted' };
}
