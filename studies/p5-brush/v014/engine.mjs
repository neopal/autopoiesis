export const SEED = 0x42525534;
export const STAGES = 18;
export const STROKE_COUNT = 18;
export const POINT_COUNT = 96;
export const MEMORY_LIMIT = 8;
export const PRIMITIVE_BUDGET = 64;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
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

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyMark = (mark) => ({ ...mark, point: copyPoint(mark.point) });

function automaticTideMark(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 7 + 4) % STROKE_COUNT;
  return {
    id: `auto-tide-mark-${stage}`,
    stage,
    source: 'autonomous-tide-mark',
    point: {
      x: clamp(0.14 + stage * 0.043 + (random() - 0.5) * 0.035, 0.09, 0.91),
      y: clamp(0.08 + lane * 0.05 + (random() - 0.5) * 0.02, 0.065, 0.935)
    },
    radius: 0.026 + random() * 0.01,
    reach: 0.15 + random() * 0.035,
    hold: 0.045 + random() * 0.018,
    crest: 0.06 + random() * 0.018,
    spill: 0.11 + random() * 0.035,
    shear: 0.048 + random() * 0.018,
    return: 0.24 + random() * 0.08,
    stain: 0.15 + random() * 0.06,
    side: stage % 2 === 0 ? 1 : -1,
    lane,
    rule: 'tide-mark'
  };
}

function relevanceFor(mark, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - mark.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.23);
  const neighbourWeight = clamp(1 - Math.abs(strokeIndex - mark.lane) / 5.5);
  return laneWeight * (0.22 + neighbourWeight * 0.78);
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.075 + strokeIndex * 0.05;
  const phase = random() * Math.PI * 2;
  const points = [];
  let poolMass = 0;
  let spillMass = 0;
  let delayMass = 0;
  let tideMass = 0;
  let downstreamShift = 0;
  let maxPool = 0;
  let maxSpill = 0;
  let maxDelay = 0;
  let poolPeak = 0;
  let spillTail = 0;
  let delayTail = 0;
  let wetLoad = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.02 + progress * 0.96;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.8 + strokeIndex * 0.095) + stage * 0.071) * (0.008 + random() * 0.006)
      + Math.sin(progress * Math.PI * 4.7 + strokeIndex * 0.23) * 0.003;
    let localPool = 0;
    let localSpill = 0;
    let localDelay = 0;
    let localTide = 0;
    let localWet = 0;

    for (const mark of memory) {
      const relevance = relevanceFor(mark, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - mark.point.x;
      const approach = smoothstep((distance + mark.reach) / mark.reach)
        * (1 - smoothstep((distance + mark.radius * 0.52) / (mark.reach * 0.72)));
      const pool = gaussian(distance, mark.hold + mark.radius * 0.34);
      const poolShoulder = gaussian(distance + mark.radius * 0.55, mark.hold * 1.4);
      const spill = smoothstep((distance - mark.radius * 0.3) / mark.spill)
        * Math.exp(-Math.max(0, distance - mark.radius * 0.3) / (mark.spill * 1.2));
      const delayed = smoothstep((distance - mark.hold * 0.4) / (mark.spill * 0.92))
        * Math.exp(-Math.max(0, distance - mark.hold * 0.4) / mark.return);
      const laneOffset = strokeIndex - mark.lane;
      const laneSign = laneOffset === 0 ? (strokeIndex % 2 === 0 ? -1 : 1) : Math.sign(laneOffset);
      const signed = mark.side * laneSign;
      const approachRoute = (mark.point.y - baseY) * relevance * 0.22 * approach;
      const poolRoute = signed * relevance * mark.crest * (pool * 0.72 - poolShoulder * 0.34);
      const spillRoute = signed * relevance * mark.spill * spill * (0.44 + clamp((distance - mark.radius) / mark.spill) * 0.56);
      const delayRoute = -signed * relevance * mark.shear * delayed;
      const releaseRoute = (mark.point.y - baseY) * relevance * 0.08 * delayed;

      y += approachRoute + poolRoute + spillRoute + delayRoute + releaseRoute;
      localPool += pool * relevance;
      localSpill += spill * relevance;
      localDelay += delayed * relevance;
      localTide = Math.max(localTide, (pool * 0.86 + spill * 0.32) * relevance);
      localWet += Math.abs(approachRoute) * 0.22 + Math.abs(poolRoute) * 0.72 + Math.abs(spillRoute) * 0.58 + Math.abs(delayRoute) * 0.84;
    }

    const boundedPool = clamp(localPool, 0, 1.8);
    const boundedSpill = clamp(localSpill, 0, 1.8);
    const boundedDelay = clamp(localDelay, 0, 1.8);
    const boundedTide = clamp(localTide, 0, 1);
    const boundedWet = clamp(localWet, 0, 0.52);
    poolMass += boundedPool / POINT_COUNT;
    spillMass += boundedSpill / POINT_COUNT;
    delayMass += boundedDelay / POINT_COUNT;
    tideMass += boundedTide / POINT_COUNT;
    if (x > 0.55) downstreamShift += (boundedSpill * 0.42 + boundedDelay * 0.58) / POINT_COUNT;
    maxPool = Math.max(maxPool, boundedPool);
    maxSpill = Math.max(maxSpill, boundedSpill);
    maxDelay = Math.max(maxDelay, boundedDelay);
    poolPeak = Math.max(poolPeak, boundedPool);
    if (memory.some((mark) => x > mark.point.x + mark.radius)) {
      spillTail += boundedSpill / POINT_COUNT;
      delayTail += boundedDelay / POINT_COUNT;
    }
    wetLoad += boundedWet / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.025, 0.975),
      pool: boundedPool,
      spill: boundedSpill,
      delay: boundedDelay,
      tide: boundedTide,
      width: clamp(1 + boundedPool * 0.34 + boundedSpill * 0.54 + boundedDelay * 0.32, 0.84, 2.2),
      wet: clamp(0.055 + boundedWet * 1.4, 0.03, 0.82)
    });
  }

  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    index: strokeIndex,
    points,
    baseY,
    weight: (0.0038 + random() * 0.0025) * clamp(1 + poolMass * 1.5 + spillMass * 0.8, 0.82, 1.42),
    opacity: 0.5 + random() * 0.25,
    poolMass,
    spillMass,
    delayMass,
    tideMass,
    downstreamShift,
    maxPool,
    maxSpill,
    maxDelay,
    poolPeak,
    spillTail,
    delayTail,
    wetLoad
  };
}

function makeDeltas(memory, stage) {
  return memory.map((mark, index) => ({
    id: mark.id,
    point: copyPoint(mark.point),
    radius: mark.radius * (1 + Math.min(index, 7) * 0.045),
    reach: mark.reach,
    hold: mark.hold,
    crest: mark.crest,
    spill: mark.spill,
    shear: mark.shear,
    age: Math.max(0, stage - mark.stage),
    source: mark.source,
    rule: 'tide-mark'
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copyMark).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    deltas: makeDeltas(inherited, safeStage),
    currentTideMark: automaticTideMark(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentTideMark].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyTideMark(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const mark = {
    id: `visitor-tide-mark-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-tide-mark',
    point: bounded,
    radius: 0.044,
    reach: 0.18,
    hold: 0.068,
    crest: 0.082,
    spill: 0.14,
    shear: 0.064,
    return: 0.3,
    stain: 0.23,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.max(0, Math.min(STROKE_COUNT - 1, Math.round((bounded.y - 0.075) / 0.05))),
    rule: 'tide-mark'
  };
  const next = buildFrame(frame.stage, [...frame.memory, mark]);
  return { ...next, interaction: 'visitor-tide-mark' };
}

export function removeLatestTideMark(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'tide-mark-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'tide-mark-lifted' };
}
