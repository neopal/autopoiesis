export const SEED = 0x53564735;
export const STAGES = 9;
export const PRIMITIVE_BUDGET = 14;

const BASE_CONTOUR = [
  { x: 0.10, y: 0.49 },
  { x: 0.18, y: 0.39 },
  { x: 0.31, y: 0.33 },
  { x: 0.46, y: 0.31 },
  { x: 0.62, y: 0.28 },
  { x: 0.77, y: 0.34 },
  { x: 0.88, y: 0.45 },
  { x: 0.78, y: 0.53 },
  { x: 0.70, y: 0.67 },
  { x: 0.57, y: 0.63 },
  { x: 0.46, y: 0.70 },
  { x: 0.34, y: 0.65 },
  { x: 0.27, y: 0.54 },
  { x: 0.17, y: 0.62 }
];

const ROUTES = [
  { id: 'fore-leg', anchorIndex: 9, foot: { x: 0.58, y: 0.88 }, side: 1 },
  { id: 'middle-leg', anchorIndex: 10, foot: { x: 0.40, y: 0.90 }, side: -1 },
  { id: 'rear-leg', anchorIndex: 11, foot: { x: 0.20, y: 0.85 }, side: 1 }
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

function copyHinge(hinge) {
  return {
    ...hinge,
    pivot: copyPoint(hinge.pivot),
    point: copyPoint(hinge.point),
    influencedRoutes: [...hinge.influencedRoutes]
  };
}

function contourFor(stage) {
  const random = rng(SEED + stage * 7919);
  return BASE_CONTOUR.map((point, index) => ({
    x: clamp(point.x + Math.sin(stage * 0.71) * 0.013 + (random() - 0.5) * 0.012),
    y: clamp(point.y + Math.cos(stage * 0.53 + index * 0.8) * 0.013 + (random() - 0.5) * 0.009)
  }));
}

function nearestIndex(point, points) {
  return points.reduce((best, candidate, index) => (
    distance(point, candidate) < distance(point, points[best]) ? index : best
  ), 0);
}

function rotateAround(point, pivot, angle) {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: clamp(pivot.x + dx * cos - dy * sin, 0.04, 0.96),
    y: clamp(pivot.y + dx * sin + dy * cos, 0.12, 0.88)
  };
}

function makeHinge(points, stage, anchorIndex, source = 'auto-hinge', pointOverride = null) {
  const pivot = copyPoint(points[anchorIndex]);
  const point = pointOverride ? copyPoint(pointOverride) : pivot;
  const sign = (stage + anchorIndex) % 2 === 0 ? 1 : -1;
  const angle = sign * (0.18 + (anchorIndex % 3) * 0.035 + (stage % 2) * 0.02);
  return {
    point,
    pivot,
    anchorIndex,
    sourceStage: stage,
    source,
    angle,
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= anchorIndex).map((route) => route.id)
  };
}

function foldContour(draft, memory) {
  return memory.reduce((points, hinge) => points.map((point, index) => (
    index >= hinge.anchorIndex ? rotateAround(point, hinge.pivot, hinge.angle) : { ...point }
  )), draft.map(copyPoint));
}

function buildRoutes(points, memory, stage) {
  return ROUTES.map((route, routeIndex) => {
    const relevant = memory.filter((hinge) => hinge.anchorIndex <= route.anchorIndex);
    const latest = relevant.at(-1);
    const joint = copyPoint(points[route.anchorIndex]);
    const directKnee = {
      x: joint.x + route.side * (0.035 + routeIndex * 0.011),
      y: joint.y + 0.11 + routeIndex * 0.017
    };
    const directFoot = copyPoint(route.foot);
    const fold = latest ? latest.angle : 0;
    const folded = relevant.length > 0;
    const knee = {
      x: clamp(directKnee.x + Math.sin(fold) * (0.10 + routeIndex * 0.012) + Math.cos(fold) * 0.018),
      y: clamp(directKnee.y - Math.abs(Math.sin(fold)) * (0.05 + routeIndex * 0.01), 0.12, 0.92)
    };
    const foot = {
      x: clamp(directFoot.x + Math.sin(fold) * (0.17 + routeIndex * 0.018), 0.06, 0.94),
      y: clamp(directFoot.y - Math.abs(Math.sin(fold)) * 0.028 + Math.cos(stage * 0.5 + routeIndex) * 0.006, 0.58, 0.94)
    };
    return {
      id: route.id,
      route: folded ? 'folded' : 'direct',
      joint,
      knee,
      foot,
      influencedBy: relevant.length,
      source: latest?.source ?? 'none'
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyHinge);
  const points = foldContour(draft, inherited);
  const hinge = inherited.at(-1) ?? null;
  const refusalAnchors = [3, 5, 4, 7, 6, 8, 5, 7, 4];
  const refusalIndex = refusalAnchors[stage % refusalAnchors.length];
  const refusal = stage === 0 || stage % 2 === 1
    ? makeHinge(points, stage, refusalIndex)
    : null;

  return {
    stage,
    draft,
    points,
    refusalIndex,
    refused: Boolean(refusal),
    refusal,
    hinge,
    memory: inherited,
    limbs: buildRoutes(points, inherited, stage),
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index)
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

export function deleteHinge(frame, hingeIndex = frame.memory.length - 1) {
  if (hingeIndex < 0 || hingeIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== hingeIndex);
  return buildFrame(frame.stage, memory);
}

export function applyHinge(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.04, 0.96),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.88)
  };
  const anchorIndex = nearestIndex(bounded, frame.points);
  const hinge = makeHinge(frame.points, frame.stage, anchorIndex, 'visitor-hinge', bounded);
  const next = buildFrame(frame.stage, [...frame.memory, hinge]);
  return { ...next, hinge, interaction: 'visitor-hinge' };
}
