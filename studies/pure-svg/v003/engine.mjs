export const SEED = 0x53564733;
export const STAGES = 10;
export const PRIMITIVE_BUDGET = 16;

const BASE_CONTOUR = [
  { x: 0.11, y: 0.56 },
  { x: 0.19, y: 0.43 },
  { x: 0.31, y: 0.35 },
  { x: 0.47, y: 0.32 },
  { x: 0.61, y: 0.27 },
  { x: 0.77, y: 0.32 },
  { x: 0.88, y: 0.42 },
  { x: 0.78, y: 0.49 },
  { x: 0.66, y: 0.48 },
  { x: 0.65, y: 0.61 },
  { x: 0.58, y: 0.68 },
  { x: 0.47, y: 0.61 },
  { x: 0.38, y: 0.70 },
  { x: 0.27, y: 0.66 },
  { x: 0.28, y: 0.53 },
  { x: 0.18, y: 0.65 }
];

const ROUTES = [
  { id: 'fore-leg', anchorIndex: 8, foot: { x: 0.73, y: 0.84 }, side: 1 },
  { id: 'hind-leg', anchorIndex: 10, foot: { x: 0.48, y: 0.86 }, side: -1 },
  { id: 'tail-leg', anchorIndex: 13, foot: { x: 0.22, y: 0.83 }, side: 1 }
];

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyRefusal(refusal) {
  return {
    ...refusal,
    point: copyPoint(refusal.point),
    bend: copyPoint(refusal.bend),
    influencedRoutes: [...refusal.influencedRoutes]
  };
}

function contourFor(stage) {
  const random = rng(SEED + stage * 7919);
  const breath = Math.sin(stage * 0.83) * 0.024;
  return BASE_CONTOUR.map((point, index) => {
    const jitter = (random() - 0.5) * 0.014;
    const weight = index >= 8 ? 0.82 : 1;
    return {
      x: clamp(point.x + breath * weight + jitter),
      y: clamp(point.y + Math.cos(stage * 0.59 + index * 0.7) * 0.014 + jitter * 0.55)
    };
  });
}

function nearestIndex(point, points) {
  return points.reduce((best, candidate, index) => (
    distance(point, candidate) < distance(point, points[best]) ? index : best
  ), 0);
}

function makeRefusal(points, stage, anchorIndex, source = 'auto-refusal', pointOverride = null) {
  const point = pointOverride ? copyPoint(pointOverride) : copyPoint(points[anchorIndex]);
  const direction = (stage + anchorIndex) % 2 === 0 ? 1 : -1;
  const bend = {
    x: direction * (0.075 + (anchorIndex % 3) * 0.011),
    y: direction * (0.031 + (stage % 3) * 0.008)
  };
  return {
    point,
    anchorIndex,
    sourceStage: stage,
    source,
    bend,
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= anchorIndex).map((route) => route.id)
  };
}

function applyMemory(points, memory, stage) {
  return points.map((point, index) => {
    const result = { ...point };
    for (const refusal of memory) {
      const gap = Math.abs(index - refusal.anchorIndex);
      const falloff = Math.max(0, 1 - gap / 7);
      const downstream = index >= refusal.anchorIndex ? 1 : 0.08;
      const age = clamp((stage - refusal.sourceStage + 2) / 4, 0.42, 1);
      const influence = falloff * downstream * age;
      result.x += refusal.bend.x * influence;
      result.y += refusal.bend.y * influence;
    }
    return { x: clamp(result.x, 0.04, 0.96), y: clamp(result.y, 0.12, 0.88) };
  });
}

function buildRoutes(points, memory, stage) {
  return ROUTES.map((route, routeIndex) => {
    const relevant = memory.filter((refusal) => refusal.anchorIndex <= route.anchorIndex);
    const pressure = relevant.reduce((sum, refusal, index) => ({
      x: sum.x + refusal.bend.x * (0.72 + index * 0.09),
      y: sum.y + refusal.bend.y * (0.72 + index * 0.09)
    }), { x: 0, y: 0 });
    const joint = copyPoint(points[route.anchorIndex]);
    const directKnee = {
      x: joint.x + route.side * (0.035 + routeIndex * 0.012),
      y: joint.y + 0.11 + routeIndex * 0.018
    };
    const directFoot = {
      x: route.foot.x,
      y: route.foot.y
    };
    const detour = relevant.length > 0;
    const knee = {
      x: clamp(directKnee.x + pressure.x * (detour ? 1.85 : 0)),
      y: clamp(directKnee.y + pressure.y * (detour ? 1.65 : 0), 0.12, 0.92)
    };
    const foot = {
      x: clamp(directFoot.x + pressure.x * (detour ? 2.4 : 0), 0.06, 0.94),
      y: clamp(directFoot.y + pressure.y * (detour ? 1.4 : 0), 0.58, 0.94)
    };
    return {
      id: route.id,
      route: detour ? 'detour' : 'direct',
      joint,
      knee,
      foot,
      influencedBy: relevant.length,
      source: relevant.at(-1)?.source ?? 'none'
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyRefusal);
  const points = applyMemory(draft, inherited, stage);
  const refusalAnchors = [4, 6, 8, 5, 7, 9, 6, 10, 8, 5];
  const refusalIndex = refusalAnchors[stage % refusalAnchors.length];
  const refused = stage === 0 || stage % 2 === 1;
  const refusal = refused ? makeRefusal(points, stage, refusalIndex) : null;

  return {
    stage,
    draft,
    points,
    refusalIndex,
    refused,
    refusal,
    memory: inherited,
    limbs: buildRoutes(points, inherited, stage),
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    topologyPressure: inherited.reduce((sum, entry) => sum + Math.hypot(entry.bend.x, entry.bend.y), 0)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.refusal) memory = [...memory, frame.refusal].slice(-5);
    return frame;
  });
}

export function deleteRefusal(frame, refusalIndex = frame.memory.length - 1) {
  if (refusalIndex < 0 || refusalIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== refusalIndex);
  return buildFrame(frame.stage, memory);
}

export function applyRefusal(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.04, 0.96),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.88)
  };
  const anchorIndex = nearestIndex(bounded, frame.points);
  const refusal = makeRefusal(frame.points, frame.stage, anchorIndex, 'visitor-refusal', bounded);
  const next = buildFrame(frame.stage, [...frame.memory, refusal]);
  return { ...next, refusal, interaction: 'visitor-refusal' };
}
