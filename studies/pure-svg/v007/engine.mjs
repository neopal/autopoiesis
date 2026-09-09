export const SEED = 0x53564737;
export const STAGES = 11;
export const PRIMITIVE_BUDGET = 17;
export const MEMORY_LIMIT = 4;

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

function copyAfterimage(afterimage) {
  return {
    ...afterimage,
    point: copyPoint(afterimage.point),
    pivot: copyPoint(afterimage.pivot),
    echoPoint: copyPoint(afterimage.echoPoint),
    echoVector: copyPoint(afterimage.echoVector),
    influencedRoutes: [...afterimage.influencedRoutes]
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

function makeAfterimage(points, stage, anchorIndex, source = 'auto-afterimage', pointOverride = null) {
  const pivot = copyPoint(points[anchorIndex]);
  const point = pointOverride ? copyPoint(pointOverride) : copyPoint(pivot);
  const lag = 1 + ((stage + anchorIndex) % 3);
  const echoIndex = Math.max(0, anchorIndex - lag);
  const echoPoint = copyPoint(points[echoIndex]);
  const direction = (stage + anchorIndex) % 2 === 0 ? 1 : -1;
  const echoVector = {
    x: clamp((echoPoint.x - pivot.x) * 0.72 + direction * 0.018, -0.18, 0.18),
    y: clamp((echoPoint.y - pivot.y) * 0.58 - 0.012, -0.15, 0.15)
  };
  return {
    point,
    pivot,
    anchorIndex,
    sourceStage: stage,
    source,
    lag,
    echoIndex,
    echoPoint,
    echoVector,
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= anchorIndex).map((route) => route.id)
  };
}

function applyMemory(points, memory) {
  return points.map((point, index) => {
    const result = copyPoint(point);
    for (const afterimage of memory) {
      if (index < afterimage.anchorIndex) continue;
      const span = Math.max(1, BASE_CONTOUR.length - 1 - afterimage.anchorIndex);
      const phase = clamp((index - afterimage.anchorIndex) / span);
      const echoWave = Math.sin(Math.PI * phase) * (0.74 + phase * 0.34) + phase * phase * 0.18;
      const arrival = phase * (0.42 + phase * 0.58);
      result.x += afterimage.echoVector.x * (echoWave + arrival * 0.22);
      result.y += afterimage.echoVector.y * (echoWave + arrival * 0.22);
    }
    return {
      x: clamp(result.x, 0.04, 0.96),
      y: clamp(result.y, 0.12, 0.88)
    };
  });
}

function buildRoutes(points, memory, stage) {
  return ROUTES.map((route, routeIndex) => {
    const relevant = memory.filter((afterimage) => afterimage.anchorIndex <= route.anchorIndex);
    const echoVector = relevant.reduce((sum, afterimage, index) => ({
      x: sum.x + afterimage.echoVector.x * (1 + index * 0.2),
      y: sum.y + afterimage.echoVector.y * (1 + index * 0.2)
    }), { x: 0, y: 0 });
    const latest = relevant.at(-1);
    const joint = copyPoint(points[route.anchorIndex]);
    const directKnee = {
      x: joint.x + route.side * (0.036 + routeIndex * 0.012),
      y: joint.y + 0.11 + routeIndex * 0.017
    };
    const directFoot = copyPoint(route.foot);
    const echoed = relevant.length > 0;
    const delayedLanding = latest
      ? {
        x: (latest.echoPoint.x - joint.x) * (0.22 + routeIndex * 0.05),
        y: (latest.echoPoint.y - joint.y) * 0.06
      }
      : { x: 0, y: 0 };
    const knee = {
      x: clamp(directKnee.x + echoVector.x * 1.42 + delayedLanding.x),
      y: clamp(directKnee.y + echoVector.y * 1.18 + delayedLanding.y, 0.12, 0.92)
    };
    const foot = {
      x: clamp(directFoot.x + echoVector.x * 2.25 + delayedLanding.x * 2.1, 0.06, 0.94),
      y: clamp(directFoot.y + echoVector.y * 1.35 + Math.cos(stage * 0.48 + routeIndex) * 0.006, 0.58, 0.94)
    };
    return {
      id: route.id,
      route: echoed ? 'echoed' : 'direct',
      joint,
      knee,
      foot,
      influencedBy: relevant.length,
      source: latest?.source ?? 'none',
      lag: latest?.lag ?? null,
      echoPoint: latest?.echoPoint ?? null
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyAfterimage);
  const points = applyMemory(draft, inherited);
  const refusalAnchors = [4, 6, 8, 5, 7, 9, 6, 10, 8, 5, 7];
  const refusalIndex = refusalAnchors[stage % refusalAnchors.length];
  const refused = stage === 0 || stage % 2 === 1;
  const refusal = refused ? makeAfterimage(points, stage, refusalIndex) : null;
  const afterimage = inherited.at(-1) ?? null;

  return {
    stage,
    draft,
    points,
    refusalIndex,
    refused,
    refusal,
    afterimage,
    memory: inherited,
    limbs: buildRoutes(points, inherited, stage),
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    totalLag: inherited.reduce((sum, entry) => sum + entry.lag, 0)
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

export function deleteAfterimage(frame, afterimageIndex = frame.memory.length - 1) {
  if (afterimageIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (afterimageIndex < 0 || afterimageIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== afterimageIndex);
  return buildFrame(frame.stage, memory);
}

export function applyAfterimage(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.04, 0.96),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.88)
  };
  const anchorIndex = nearestIndex(bounded, frame.points);
  const afterimage = makeAfterimage(frame.points, frame.stage, anchorIndex, 'visitor-afterimage', bounded);
  const priorMemory = frame.memory.map(copyAfterimage);
  const next = buildFrame(frame.stage, [...frame.memory, afterimage].slice(-MEMORY_LIMIT));
  return { ...next, afterimage, priorMemory, interaction: 'visitor-afterimage' };
}
