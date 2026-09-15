export const SEED = 0x42525533;
export const STAGES = 17;
export const STROKE_COUNT = 16;
export const POINT_COUNT = 84;
export const MEMORY_LIMIT = 9;
export const PRIMITIVE_BUDGET = 61;

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
const copySeam = (seam) => ({ ...seam, point: copyPoint(seam.point) });

function automaticSeam(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 5 + 3) % STROKE_COUNT;
  return {
    id: `auto-dry-seam-${stage}`,
    stage,
    source: 'autonomous-dry-seam',
    point: {
      x: clamp(0.12 + stage * 0.048 + (random() - 0.5) * 0.04, 0.08, 0.91),
      y: clamp(0.07 + lane * 0.057 + (random() - 0.5) * 0.022, 0.055, 0.945)
    },
    radius: 0.025 + random() * 0.009,
    reach: 0.16 + random() * 0.035,
    gap: 0.037 + random() * 0.012,
    compress: 0.058 + random() * 0.02,
    offset: 0.044 + random() * 0.018,
    return: 0.24 + random() * 0.08,
    stain: 0.16 + random() * 0.065,
    side: stage % 2 === 0 ? 1 : -1,
    lane,
    rule: 'dry-seam'
  };
}

function relevanceFor(seam, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - seam.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.22);
  const neighbourWeight = clamp(1 - Math.abs(strokeIndex - seam.lane) / 5.2);
  return laneWeight * (0.24 + neighbourWeight * 0.76);
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.058 + strokeIndex * 0.057;
  const phase = random() * Math.PI * 2;
  const points = [];
  let approachMass = 0;
  let bridgeMass = 0;
  let returnMass = 0;
  let dryGap = 0;
  let wetLoad = 0;
  let routeShift = 0;
  let maxBank = 0;
  let maxReturnOffset = 0;
  let reentryShift = 0;
  let gapWidth = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.022 + progress * 0.956;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.7 + strokeIndex * 0.11) + stage * 0.087) * (0.009 + random() * 0.007)
      + Math.sin(progress * Math.PI * 5.1 + strokeIndex * 0.29) * 0.0034;
    let localApproach = 0;
    let localBridge = 0;
    let localReturn = 0;
    let localDry = 0;
    let localWet = 0;

    for (const seam of memory) {
      const relevance = relevanceFor(seam, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - seam.point.x;
      const approach = smoothstep((distance + seam.reach) / seam.reach)
        * (1 - smoothstep((distance + seam.radius * 0.72) / (seam.reach * 0.58)));
      const bridge = smoothstep((distance + seam.radius * 0.72) / (seam.radius * 1.35))
        * (1 - smoothstep((distance - seam.radius * 0.5) / (seam.radius * 1.25)));
      const returning = smoothstep((distance - seam.radius * 0.42) / (seam.return * 0.5))
        * Math.exp(-Math.max(0, distance - seam.radius * 0.42) / seam.return);
      const dry = smoothstep((distance + seam.gap * 0.48) / (seam.gap * 0.42))
        * (1 - smoothstep((distance - seam.gap * 0.48) / (seam.gap * 0.42)));
      const laneOffset = strokeIndex - seam.lane;
      const laneSign = laneOffset === 0 ? (strokeIndex % 2 === 0 ? -1 : 1) : Math.sign(laneOffset);
      const signed = seam.side * laneSign;
      const bankTarget = seam.point.y + laneOffset * 0.0032 * seam.side;
      const bankRoute = (bankTarget - baseY) * relevance * 0.26 * approach;
      const pinchRoute = signed * relevance * seam.compress * bridge;
      const returnRoute = -signed * relevance * seam.offset * returning;
      const releaseRoute = (seam.point.y - baseY) * relevance * 0.13 * returning;

      y += bankRoute + pinchRoute + returnRoute + releaseRoute;
      localApproach += Math.abs(bankRoute);
      localBridge += Math.abs(pinchRoute);
      localReturn += Math.abs(returnRoute) + Math.abs(releaseRoute);
      localDry = Math.max(localDry, dry * relevance);
      localWet += Math.abs(bankRoute) * 0.34 + Math.abs(pinchRoute) * 0.54 + Math.abs(returnRoute) * 0.76;
      maxBank = Math.max(maxBank, Math.abs(bankRoute));
      maxReturnOffset = Math.max(maxReturnOffset, Math.abs(returnRoute));
      reentryShift = Math.max(reentryShift, Math.abs(returnRoute + releaseRoute));
      gapWidth = Math.max(gapWidth, seam.gap * relevance);
    }

    const boundedApproach = clamp(localApproach, 0, 0.28);
    const boundedBridge = clamp(localBridge, 0, 0.34);
    const boundedReturn = clamp(localReturn, 0, 0.32);
    const boundedDry = clamp(localDry, 0, 0.96);
    const boundedWet = clamp(localWet, 0, 0.38) * (1 - boundedDry * 0.72);
    approachMass += boundedApproach / POINT_COUNT;
    bridgeMass += boundedBridge / POINT_COUNT;
    returnMass += boundedReturn / POINT_COUNT;
    dryGap += boundedDry / POINT_COUNT;
    wetLoad += boundedWet / POINT_COUNT;
    routeShift += (boundedApproach + boundedBridge * 0.9 + boundedReturn * 0.75) * (0.32 + progress) / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.026, 0.974),
      approach: boundedApproach,
      bridge: boundedBridge,
      return: boundedReturn,
      dry: boundedDry,
      width: clamp(1 + boundedApproach * 1.3 + boundedBridge * 2.2 + boundedReturn * 1.7, 0.86, 1.86),
      wet: clamp(0.055 + boundedWet * 1.55, 0.028, 0.76)
    });
  }

  const seamIndex = Math.max(0, Math.min(POINT_COUNT - 1, Math.round((memory.at(-1)?.point.x ?? 0.5) * (POINT_COUNT - 1))));
  const nearest = memory.length ? memory.reduce((best, seam) => {
    const candidate = Math.round(seam.point.x * (POINT_COUNT - 1));
    return Math.abs(candidate - seamIndex) < Math.abs(best - seamIndex) ? candidate : best;
  }, seamIndex) : seamIndex;
  const gapAtLatest = memory.length ? points[nearest].dry : 0;

  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    index: strokeIndex,
    points,
    baseY,
    weight: (0.004 + random() * 0.0028) * clamp(1 + bridgeMass * 1.8 + returnMass, 0.82, 1.4),
    opacity: 0.5 + random() * 0.27,
    approachMass,
    bridgeMass,
    returnMass,
    dryGap: Math.max(dryGap, gapAtLatest),
    wetLoad,
    routeShift,
    maxBank,
    maxReturnOffset,
    reentryShift,
    gapWidth
  };
}

function makeDeltas(memory, stage) {
  return memory.map((seam, index) => ({
    id: seam.id,
    point: copyPoint(seam.point),
    radius: seam.radius * (1 + Math.min(index, 8) * 0.045),
    reach: seam.reach,
    gap: seam.gap,
    compress: seam.compress,
    offset: seam.offset,
    return: seam.return,
    side: seam.side,
    age: Math.max(0, stage - seam.stage),
    source: seam.source,
    rule: 'dry-seam'
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
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const seam = {
    id: `visitor-dry-seam-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-dry-seam',
    point: bounded,
    radius: 0.046,
    reach: 0.18,
    gap: 0.062,
    compress: 0.076,
    offset: 0.061,
    return: 0.28,
    stain: 0.22,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.max(0, Math.min(STROKE_COUNT - 1, Math.round((bounded.y - 0.058) / 0.057))),
    rule: 'dry-seam'
  };
  const next = buildFrame(frame.stage, [...frame.memory, seam]);
  return { ...next, interaction: 'visitor-dry-seam' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'dry-seam-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'dry-seam-lifted' };
}
