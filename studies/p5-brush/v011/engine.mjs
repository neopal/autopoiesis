export const SEED = 0x42525531;
export const STAGES = 15;
export const STROKE_COUNT = 14;
export const POINT_COUNT = 76;
export const MEMORY_LIMIT = 9;
export const PRIMITIVE_BUDGET = 53;

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
const copySiphon = (siphon) => ({ ...siphon, point: copyPoint(siphon.point) });

function automaticSiphon(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 5 + 3) % STROKE_COUNT;
  return {
    id: `auto-siphon-release-${stage}`,
    stage,
    source: 'autonomous-siphon-release',
    point: {
      x: clamp(0.13 + stage * 0.055 + (random() - 0.5) * 0.04, 0.09, 0.91),
      y: clamp(0.07 + lane * 0.067 + (random() - 0.5) * 0.024, 0.055, 0.945)
    },
    radius: 0.027 + random() * 0.012,
    reach: 0.14 + random() * 0.035,
    pull: 0.16 + random() * 0.04,
    depth: 0.085 + random() * 0.03,
    release: 0.19 + random() * 0.06,
    stain: 0.14 + random() * 0.065,
    side: stage % 2 === 0 ? 1 : -1,
    lane,
    rule: 'siphon-release'
  };
}

function relevanceFor(siphon, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - siphon.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.235);
  const neighborWeight = clamp(1 - Math.abs(strokeIndex - siphon.lane) / 4.6);
  return laneWeight * (0.3 + neighborWeight * 0.7);
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.07 + strokeIndex * 0.067;
  const phase = random() * Math.PI * 2;
  const points = [];
  let siphonMass = 0;
  let throatMass = 0;
  let releaseMass = 0;
  let wetLoad = 0;
  let routeShift = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.025 + progress * 0.95;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.35 + strokeIndex * 0.16) + stage * 0.11) * (0.010 + random() * 0.009)
      + Math.sin(progress * Math.PI * 4.2 + strokeIndex * 0.37) * 0.0042;
    let localSiphon = 0;
    let localThroat = 0;
    let localRelease = 0;
    let localWet = 0;

    for (const siphon of memory) {
      const relevance = relevanceFor(siphon, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - siphon.point.x;
      const intake = smoothstep((distance + siphon.reach) / (siphon.reach * 0.82))
        * (1 - smoothstep((distance + siphon.radius * 0.18) / (siphon.reach * 0.7)));
      const throat = smoothstep((distance + siphon.radius * 0.88) / (siphon.radius * 1.18))
        * (1 - smoothstep((distance - siphon.radius * 0.32) / (siphon.radius * 1.65)));
      const fan = smoothstep((distance - siphon.radius * 0.24) / (siphon.radius * 1.55))
        * Math.exp(-Math.max(0, distance) / siphon.release);
      const stain = Math.exp(-Math.pow(distance / Math.max(siphon.radius * 1.65, 0.001), 2));
      const laneOffset = strokeIndex - siphon.lane;
      const laneSign = laneOffset === 0 ? (strokeIndex % 2 === 0 ? -1 : 1) : Math.sign(laneOffset);
      const targetY = siphon.point.y + laneOffset * 0.0042 * siphon.side;
      const gatherRoute = (targetY - baseY) * relevance * siphon.pull * intake;
      const throatRoute = siphon.side * laneSign * relevance * siphon.depth * 0.68 * throat;
      const releaseRoute = siphon.side * laneSign * relevance * siphon.depth * 0.92 * fan;

      y += gatherRoute + throatRoute + releaseRoute;
      localSiphon += Math.abs(gatherRoute);
      localThroat += Math.abs(throatRoute);
      localRelease += Math.abs(releaseRoute);
      localWet += stain * siphon.stain + Math.abs(releaseRoute) * 0.58;
    }

    const boundedSiphon = clamp(localSiphon, 0, 0.34);
    const boundedThroat = clamp(localThroat, 0, 0.36);
    const boundedRelease = clamp(localRelease, 0, 0.38);
    siphonMass += (boundedSiphon + boundedThroat) / POINT_COUNT;
    throatMass += boundedThroat / POINT_COUNT;
    releaseMass += boundedRelease / POINT_COUNT;
    wetLoad += clamp(localWet, 0, 0.38) / POINT_COUNT;
    routeShift += (boundedSiphon + boundedRelease * 0.7) * (0.28 + progress) / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.03, 0.97),
      siphon: boundedSiphon,
      throat: boundedThroat,
      release: boundedRelease,
      width: clamp(1 + boundedSiphon * 1.6 + boundedThroat * 2.8 + boundedRelease * 1.7, 1, 1.86),
      wet: clamp(0.06 + wetLoad * 1.35, 0.06, 0.78)
    });
  }

  const throatIndex = Math.max(0, Math.min(POINT_COUNT - 1, Math.round((memory.at(-1)?.point.x ?? 0.5) * (POINT_COUNT - 1))));
  const nearest = memory.length ? memory.reduce((best, siphon) => {
    const candidate = Math.round(siphon.point.x * (POINT_COUNT - 1));
    return Math.abs(candidate - throatIndex) < Math.abs(best - throatIndex) ? candidate : best;
  }, throatIndex) : throatIndex;
  const reference = memory.length ? memory.at(-1).point.y : baseY;
  const throatConvergence = Math.abs(points[Math.max(0, Math.min(POINT_COUNT - 1, nearest))].y - reference);

  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    index: strokeIndex,
    points,
    baseY,
    weight: (0.0045 + random() * 0.003) * clamp(1 + siphonMass * 2.2 + releaseMass, 0.84, 1.4),
    opacity: 0.5 + random() * 0.28,
    siphonMass,
    throatMass,
    releaseMass,
    wetLoad,
    routeShift,
    throatConvergence
  };
}

function makeDeltas(memory, stage) {
  return memory.map((siphon, index) => ({
    id: siphon.id,
    point: copyPoint(siphon.point),
    radius: siphon.radius * (1 + Math.min(index, 8) * 0.045),
    reach: siphon.reach,
    pull: siphon.pull,
    depth: siphon.depth,
    release: siphon.release,
    stain: siphon.stain,
    side: siphon.side,
    age: Math.max(0, stage - siphon.stage),
    source: siphon.source,
    rule: 'siphon-release'
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copySiphon).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    deltas: makeDeltas(inherited, safeStage),
    currentSiphon: automaticSiphon(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentSiphon].slice(-MEMORY_LIMIT);
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
  const siphon = {
    id: `visitor-siphon-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-siphon',
    point: bounded,
    radius: 0.046,
    reach: 0.158,
    pull: 0.19,
    depth: 0.116,
    release: 0.235,
    stain: 0.205,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.max(0, Math.min(STROKE_COUNT - 1, Math.round((bounded.y - 0.07) / 0.067))),
    rule: 'siphon-release'
  };
  const next = buildFrame(frame.stage, [...frame.memory, siphon]);
  return { ...next, interaction: 'visitor-siphon' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'siphon-release-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'siphon-release-lifted' };
}
