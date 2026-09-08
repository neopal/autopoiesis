export const SEED = 0x53564736;
export const STAGES = 10;
export const PRIMITIVE_BUDGET = 16;
export const MEMORY_LIMIT = 5;

const BASE_CONTOUR = [
  { x: 0.10, y: 0.50 },
  { x: 0.17, y: 0.40 },
  { x: 0.29, y: 0.33 },
  { x: 0.44, y: 0.31 },
  { x: 0.60, y: 0.27 },
  { x: 0.76, y: 0.33 },
  { x: 0.88, y: 0.44 },
  { x: 0.79, y: 0.53 },
  { x: 0.68, y: 0.48 },
  { x: 0.66, y: 0.63 },
  { x: 0.56, y: 0.69 },
  { x: 0.46, y: 0.62 },
  { x: 0.36, y: 0.71 },
  { x: 0.25, y: 0.66 },
  { x: 0.27, y: 0.54 },
  { x: 0.16, y: 0.63 }
];

const ROUTES = [
  { id: 'fore-leg', anchorIndex: 9, foot: { x: 0.70, y: 0.86 }, side: 1 },
  { id: 'middle-leg', anchorIndex: 11, foot: { x: 0.45, y: 0.90 }, side: -1 },
  { id: 'rear-leg', anchorIndex: 13, foot: { x: 0.21, y: 0.84 }, side: 1 }
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

function copyCounterweight(counterweight) {
  return {
    ...counterweight,
    point: copyPoint(counterweight.point),
    pivot: copyPoint(counterweight.pivot),
    balancePoint: copyPoint(counterweight.balancePoint),
    vector: copyPoint(counterweight.vector),
    influencedRoutes: [...counterweight.influencedRoutes]
  };
}

function contourFor(stage) {
  const random = rng(SEED + stage * 7919);
  const breath = Math.sin(stage * 0.77) * 0.018;
  return BASE_CONTOUR.map((point, index) => ({
    x: clamp(point.x + breath + (random() - 0.5) * 0.013),
    y: clamp(point.y + Math.cos(stage * 0.59 + index * 0.74) * 0.014 + (random() - 0.5) * 0.010)
  }));
}

function nearestIndex(point, points) {
  return points.reduce((best, candidate, index) => (
    distance(point, candidate) < distance(point, points[best]) ? index : best
  ), 0);
}

function makeCounterweight(points, stage, anchorIndex, source = 'auto-counterweight', pointOverride = null) {
  const pivot = copyPoint(points[anchorIndex]);
  const point = pointOverride ? copyPoint(pointOverride) : copyPoint(pivot);
  const direction = (stage + anchorIndex) % 2 === 0 ? 1 : -1;
  const load = 0.19 + (anchorIndex % 3) * 0.026 + (stage % 2) * 0.015;
  const vector = {
    x: direction * (0.062 + (anchorIndex % 3) * 0.014),
    y: -0.034 - (stage % 3) * 0.009
  };
  const balancePoint = {
    x: clamp(point.x + vector.x * (2.55 + load), 0.12, 0.88),
    y: clamp(point.y + vector.y * 1.9 + 0.19, 0.22, 0.78)
  };
  return {
    point,
    pivot,
    anchorIndex,
    sourceStage: stage,
    source,
    load,
    vector,
    balancePoint,
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= anchorIndex).map((route) => route.id)
  };
}

function applyMemory(points, memory) {
  return points.map((point, index) => {
    const result = copyPoint(point);
    for (const counterweight of memory) {
      if (index < counterweight.anchorIndex) continue;
      const span = Math.max(1, BASE_CONTOUR.length - 1 - counterweight.anchorIndex);
      const phase = clamp((index - counterweight.anchorIndex) / span);
      const bow = Math.sin(Math.PI * phase);
      const carry = 0.34 + phase * 1.12;
      const release = phase * phase * 0.34;
      result.x += counterweight.vector.x * (bow * carry + release);
      result.y += counterweight.vector.y * (bow * (0.72 + phase * 0.54) + release * 0.7);
    }
    return {
      x: clamp(result.x, 0.04, 0.96),
      y: clamp(result.y, 0.12, 0.88)
    };
  });
}

function buildRoutes(points, memory, stage) {
  return ROUTES.map((route, routeIndex) => {
    const relevant = memory.filter((counterweight) => counterweight.anchorIndex <= route.anchorIndex);
    const loadVector = relevant.reduce((sum, counterweight, index) => ({
      x: sum.x + counterweight.vector.x * (1 + index * 0.18) * counterweight.load,
      y: sum.y + counterweight.vector.y * (1 + index * 0.18) * counterweight.load
    }), { x: 0, y: 0 });
    const latest = relevant.at(-1);
    const joint = copyPoint(points[route.anchorIndex]);
    const directKnee = {
      x: joint.x + route.side * (0.036 + routeIndex * 0.012),
      y: joint.y + 0.11 + routeIndex * 0.017
    };
    const directFoot = copyPoint(route.foot);
    const weighted = relevant.length > 0;
    const balancePull = latest
      ? {
        x: (latest.balancePoint.x - joint.x) * (0.19 + routeIndex * 0.045),
        y: (latest.balancePoint.y - joint.y) * 0.05
      }
      : { x: 0, y: 0 };
    const knee = {
      x: clamp(directKnee.x + loadVector.x * 8.6 + balancePull.x),
      y: clamp(directKnee.y + loadVector.y * 7.2 + balancePull.y, 0.12, 0.92)
    };
    const foot = {
      x: clamp(directFoot.x + loadVector.x * 14.5 + balancePull.x * 1.85, 0.06, 0.94),
      y: clamp(directFoot.y + loadVector.y * 8.4 + Math.cos(stage * 0.48 + routeIndex) * 0.006, 0.58, 0.94)
    };
    return {
      id: route.id,
      route: weighted ? 'weighted' : 'direct',
      joint,
      knee,
      foot,
      influencedBy: relevant.length,
      source: latest?.source ?? 'none',
      balancePoint: latest?.balancePoint ?? null
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyCounterweight);
  const points = applyMemory(draft, inherited);
  const refusalAnchors = [4, 6, 8, 5, 7, 9, 6, 10, 8, 5];
  const refusalIndex = refusalAnchors[stage % refusalAnchors.length];
  const refused = stage === 0 || stage % 2 === 1;
  const refusal = refused ? makeCounterweight(points, stage, refusalIndex) : null;
  const counterweight = inherited.at(-1) ?? null;

  return {
    stage,
    draft,
    points,
    refusalIndex,
    refused,
    refusal,
    counterweight,
    memory: inherited,
    limbs: buildRoutes(points, inherited, stage),
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    totalLoad: inherited.reduce((sum, entry) => sum + entry.load, 0)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.refusal) memory = [...memory, frame.refusal].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function deleteCounterweight(frame, counterweightIndex = frame.memory.length - 1) {
  if (counterweightIndex < 0 || counterweightIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== counterweightIndex);
  return buildFrame(frame.stage, memory);
}

export function applyCounterweight(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.04, 0.96),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.88)
  };
  const anchorIndex = nearestIndex(bounded, frame.points);
  const counterweight = makeCounterweight(frame.points, frame.stage, anchorIndex, 'visitor-counterweight', bounded);
  const next = buildFrame(frame.stage, [...frame.memory, counterweight]);
  return { ...next, counterweight, interaction: 'visitor-counterweight' };
}
