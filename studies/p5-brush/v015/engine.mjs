export const SEED = 0x42525535;
export const STAGES = 19;
export const STROKE_COUNT = 19;
export const POINT_COUNT = 104;
export const MEMORY_LIMIT = 8;
export const PRIMITIVE_BUDGET = 68;

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

function automaticBasinMark(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 7 + 5) % STROKE_COUNT;
  return {
    id: `auto-basin-mark-${stage}`,
    stage,
    source: 'autonomous-basin-mark',
    point: {
      x: clamp(0.13 + stage * 0.045 + (random() - 0.5) * 0.04, 0.09, 0.91),
      y: clamp(0.08 + lane * 0.046 + (random() - 0.5) * 0.02, 0.065, 0.935)
    },
    radius: 0.026 + random() * 0.01,
    reach: 0.14 + random() * 0.035,
    bowl: 0.047 + random() * 0.015,
    floor: 0.052 + random() * 0.016,
    depth: 0.065 + random() * 0.018,
    lip: 0.092 + random() * 0.026,
    lipHeight: 0.052 + random() * 0.016,
    aftershock: 0.25 + random() * 0.08,
    recoil: 0.044 + random() * 0.014,
    side: stage % 2 === 0 ? 1 : -1,
    lane,
    rule: 'basin-mark'
  };
}

function relevanceFor(mark, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - mark.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.24);
  const neighbourWeight = clamp(1 - Math.abs(strokeIndex - mark.lane) / 5.8);
  return laneWeight * (0.2 + neighbourWeight * 0.8);
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.057 + strokeIndex * 0.049;
  const phase = random() * Math.PI * 2;
  const points = [];
  let basinMass = 0;
  let floorMass = 0;
  let lipMass = 0;
  let aftershockMass = 0;
  let downstreamShift = 0;
  let maxBasin = 0;
  let maxFloor = 0;
  let maxLip = 0;
  let maxAftershock = 0;
  let floorPlateau = 0;
  let lipTail = 0;
  let aftershockTail = 0;
  let wetLoad = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.02 + progress * 0.96;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.7 + strokeIndex * 0.09) + stage * 0.075) * (0.008 + random() * 0.006)
      + Math.sin(progress * Math.PI * 4.1 + strokeIndex * 0.21) * 0.0034;
    let localBasin = 0;
    let localFloor = 0;
    let localLip = 0;
    let localAftershock = 0;
    let localWet = 0;

    for (const mark of memory) {
      const relevance = relevanceFor(mark, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - mark.point.x;
      const approach = smoothstep((distance + mark.reach) / mark.reach)
        * (1 - smoothstep((distance + mark.radius * 0.45) / (mark.reach * 0.72)));
      const basin = gaussian(distance + mark.radius * 0.1, mark.bowl + mark.radius * 0.24);
      const basinShoulder = gaussian(distance + mark.radius * 0.52, mark.bowl * 1.5);
      const floor = gaussian(distance - mark.radius * 0.18, mark.floor)
        * smoothstep((distance + mark.radius * 0.16) / (mark.floor * 2.1));
      const lip = smoothstep((distance - mark.radius * 0.2) / mark.lip)
        * Math.exp(-Math.max(0, distance - mark.radius * 0.2) / (mark.lip * 1.35));
      const aftershock = smoothstep((distance - mark.lip * 0.55) / (mark.lip * 0.9))
        * Math.exp(-Math.max(0, distance - mark.lip * 0.55) / mark.aftershock);
      const laneOffset = strokeIndex - mark.lane;
      const laneSign = laneOffset === 0 ? (strokeIndex % 2 === 0 ? -1 : 1) : Math.sign(laneOffset);
      const signed = mark.side * laneSign;
      const approachRoute = (mark.point.y - baseY) * relevance * 0.18 * approach;
      const basinRoute = signed * relevance * mark.depth * (basin * 0.72 + basinShoulder * 0.18);
      const floorRoute = signed * relevance * mark.depth * 0.88 * floor;
      const lipRoute = -signed * relevance * mark.lipHeight * lip;
      const aftershockRoute = signed * relevance * mark.recoil * aftershock;
      const releaseRoute = (mark.point.y - baseY) * relevance * 0.07 * aftershock;

      y += approachRoute + basinRoute + floorRoute + lipRoute + aftershockRoute + releaseRoute;
      localBasin += basin * relevance;
      localFloor += floor * relevance;
      localLip += lip * relevance;
      localAftershock += aftershock * relevance;
      localWet += Math.abs(approachRoute) * 0.22
        + Math.abs(basinRoute) * 0.76
        + Math.abs(floorRoute) * 0.88
        + Math.abs(lipRoute) * 0.74
        + Math.abs(aftershockRoute) * 0.92;
    }

    const boundedBasin = clamp(localBasin, 0, 1.8);
    const boundedFloor = clamp(localFloor, 0, 1.8);
    const boundedLip = clamp(localLip, 0, 1.8);
    const boundedAftershock = clamp(localAftershock, 0, 1.8);
    const boundedWet = clamp(localWet, 0, 0.56);
    basinMass += boundedBasin / POINT_COUNT;
    floorMass += boundedFloor / POINT_COUNT;
    lipMass += boundedLip / POINT_COUNT;
    aftershockMass += boundedAftershock / POINT_COUNT;
    if (boundedFloor > 0.16) floorPlateau += 1 / POINT_COUNT;
    if (x > 0.55) downstreamShift += (boundedLip * 0.42 + boundedAftershock * 0.58) / POINT_COUNT;
    maxBasin = Math.max(maxBasin, boundedBasin);
    maxFloor = Math.max(maxFloor, boundedFloor);
    maxLip = Math.max(maxLip, boundedLip);
    maxAftershock = Math.max(maxAftershock, boundedAftershock);
    if (memory.some((mark) => x > mark.point.x + mark.radius)) {
      lipTail += boundedLip / POINT_COUNT;
      aftershockTail += boundedAftershock / POINT_COUNT;
    }
    wetLoad += boundedWet / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.02, 0.98),
      basin: boundedBasin,
      floor: boundedFloor,
      lip: boundedLip,
      aftershock: boundedAftershock,
      width: clamp(1 + boundedBasin * 0.34 + boundedFloor * 0.56 + boundedLip * 0.42 + boundedAftershock * 0.28, 0.84, 2.3),
      wet: clamp(0.055 + boundedWet * 1.42, 0.03, 0.84)
    });
  }

  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    index: strokeIndex,
    points,
    baseY,
    weight: (0.0035 + random() * 0.0025) * clamp(1 + basinMass * 1.45 + floorMass * 0.9, 0.82, 1.46),
    opacity: 0.49 + random() * 0.26,
    basinMass,
    floorMass,
    lipMass,
    aftershockMass,
    downstreamShift,
    maxBasin,
    maxFloor,
    maxLip,
    maxAftershock,
    floorPlateau,
    lipTail,
    aftershockTail,
    wetLoad
  };
}

function makeDeltas(memory, stage) {
  return memory.map((mark, index) => ({
    id: mark.id,
    point: copyPoint(mark.point),
    radius: mark.radius * (1 + Math.min(index, 7) * 0.045),
    reach: mark.reach,
    bowl: mark.bowl,
    floor: mark.floor,
    depth: mark.depth,
    lip: mark.lip,
    lipHeight: mark.lipHeight,
    aftershock: mark.aftershock,
    age: Math.max(0, stage - mark.stage),
    source: mark.source,
    rule: 'basin-mark'
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
    currentBasinMark: automaticBasinMark(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentBasinMark].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyBasinMark(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const mark = {
    id: `visitor-basin-mark-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-basin-mark',
    point: bounded,
    radius: 0.044,
    reach: 0.18,
    bowl: 0.068,
    floor: 0.078,
    depth: 0.092,
    lip: 0.13,
    lipHeight: 0.07,
    aftershock: 0.32,
    recoil: 0.058,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.max(0, Math.min(STROKE_COUNT - 1, Math.round((bounded.y - 0.057) / 0.049))),
    rule: 'basin-mark'
  };
  const next = buildFrame(frame.stage, [...frame.memory, mark]);
  return { ...next, interaction: 'visitor-basin-mark' };
}

export function removeLatestBasinMark(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'basin-mark-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'basin-mark-lifted' };
}
