export const SEED = 0x53564739;
export const STAGES = 12;
export const PRIMITIVE_BUDGET = 18;
export const MEMORY_LIMIT = 4;

const BASE_CONTOUR = [
  { x: 0.10, y: 0.50 },
  { x: 0.18, y: 0.39 },
  { x: 0.30, y: 0.33 },
  { x: 0.44, y: 0.31 },
  { x: 0.59, y: 0.27 },
  { x: 0.75, y: 0.32 },
  { x: 0.88, y: 0.43 },
  { x: 0.81, y: 0.54 },
  { x: 0.69, y: 0.49 },
  { x: 0.66, y: 0.63 },
  { x: 0.56, y: 0.70 },
  { x: 0.45, y: 0.62 },
  { x: 0.35, y: 0.72 },
  { x: 0.24, y: 0.66 },
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

function copyFold(fold) {
  return {
    ...fold,
    point: copyPoint(fold.point),
    pivot: copyPoint(fold.pivot),
    seam: copyPoint(fold.seam),
    tangent: copyPoint(fold.tangent),
    foldVector: copyPoint(fold.foldVector),
    opening: fold.opening.map(copyPoint),
    influencedRoutes: [...fold.influencedRoutes]
  };
}

function contourFor(stage) {
  const random = rng(SEED + stage * 7919);
  const breath = Math.sin(stage * 0.77) * 0.017;
  return BASE_CONTOUR.map((point, index) => ({
    x: clamp(point.x + breath + (random() - 0.5) * 0.013),
    y: clamp(point.y + Math.cos(stage * 0.59 + index * 0.74) * 0.014 + (random() - 0.5) * 0.010)
  }));
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function nearestIndex(point, points) {
  return points.reduce((best, candidate, index) => (
    distance(point, candidate) < distance(point, points[best]) ? index : best
  ), 0);
}

function makeFold(points, stage, anchorIndex, source = 'auto-fold', pointOverride = null) {
  const pivot = copyPoint(points[anchorIndex]);
  const seamIndex = Math.min(points.length - 1, anchorIndex + 3 + ((stage + anchorIndex) % 3));
  const seam = copyPoint(points[seamIndex]);
  const tangent = normalize({ x: seam.x - pivot.x, y: seam.y - pivot.y });
  const side = (stage + anchorIndex) % 2 === 0 ? 1 : -1;
  const normal = { x: -tangent.y, y: tangent.x };
  const pocketDepth = clamp(0.072 + ((stage + anchorIndex) % 4) * 0.013, 0.06, 0.12);
  const pocketWidth = clamp(0.052 + ((stage * 3 + anchorIndex) % 3) * 0.012, 0.05, 0.09);
  const foldVector = {
    x: normal.x * side * pocketDepth,
    y: normal.y * side * pocketDepth
  };
  const pocketCenter = {
    x: (pivot.x + seam.x) / 2 + foldVector.x,
    y: (pivot.y + seam.y) / 2 + foldVector.y
  };
  const opening = [
    {
      x: pivot.x + tangent.x * 0.18 + foldVector.x * 0.42,
      y: pivot.y + tangent.y * 0.18 + foldVector.y * 0.42
    },
    {
      x: pocketCenter.x - tangent.x * pocketWidth,
      y: pocketCenter.y - tangent.y * pocketWidth
    },
    {
      x: pocketCenter.x + normal.x * side * pocketDepth * 0.42 + tangent.x * pocketWidth,
      y: pocketCenter.y + normal.y * side * pocketDepth * 0.42 + tangent.y * pocketWidth
    },
    {
      x: seam.x - tangent.x * 0.16 + foldVector.x * 0.36,
      y: seam.y - tangent.y * 0.16 + foldVector.y * 0.36
    }
  ].map((point) => ({ x: clamp(point.x, 0.06, 0.94), y: clamp(point.y, 0.14, 0.86) }));

  return {
    kind: 'pocket',
    point: pointOverride ? copyPoint(pointOverride) : copyPoint(pivot),
    pivot,
    seam,
    anchorIndex,
    seamIndex,
    sourceStage: stage,
    source,
    side,
    tangent,
    foldVector,
    pocketCenter,
    pocketDepth,
    pocketWidth,
    opening,
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= anchorIndex).map((route) => route.id)
  };
}

function applyMemory(points, memory) {
  return points.map((point, index) => {
    const result = copyPoint(point);
    for (const fold of memory) {
      if (index < fold.anchorIndex) continue;
      const span = Math.max(1, fold.seamIndex - fold.anchorIndex);
      const phase = clamp((index - fold.anchorIndex) / span);
      const pocketEnvelope = index <= fold.seamIndex ? Math.sin(Math.PI * phase) : 0;
      const downstreamCarry = index > fold.seamIndex ? (index - fold.seamIndex) / Math.max(1, points.length - 1 - fold.seamIndex) : 0;
      const amount = pocketEnvelope * (0.88 + phase * 0.24) + downstreamCarry * 0.38;
      const alternating = (index - fold.anchorIndex) % 2 === 0 ? 1 : -1;
      result.x += fold.foldVector.x * amount + fold.tangent.x * alternating * pocketEnvelope * fold.pocketWidth * 0.22;
      result.y += fold.foldVector.y * amount + fold.tangent.y * alternating * pocketEnvelope * fold.pocketWidth * 0.22;
    }
    return {
      x: clamp(result.x, 0.04, 0.96),
      y: clamp(result.y, 0.12, 0.88)
    };
  });
}

function buildRoutes(points, memory, stage) {
  return ROUTES.map((route, routeIndex) => {
    const relevant = memory.filter((fold) => fold.anchorIndex <= route.anchorIndex);
    const latest = relevant.at(-1);
    const foldVector = relevant.reduce((sum, fold, index) => {
      const parity = (routeIndex + index) % 2 === 0 ? 1 : -1;
      return {
        x: sum.x + fold.foldVector.x * (1 + index * 0.22) + fold.tangent.x * parity * fold.pocketWidth * 0.38,
        y: sum.y + fold.foldVector.y * (1 + index * 0.22) + fold.tangent.y * parity * fold.pocketWidth * 0.38
      };
    }, { x: 0, y: 0 });
    const joint = copyPoint(points[route.anchorIndex]);
    const directKnee = {
      x: joint.x + route.side * (0.036 + routeIndex * 0.012),
      y: joint.y + 0.11 + routeIndex * 0.017
    };
    const directFoot = copyPoint(route.foot);
    const folded = relevant.length > 0;
    const gaitSide = folded && (routeIndex + latest.seamIndex) % 2 === 0 ? 'inside' : folded ? 'outside' : null;
    const inward = gaitSide === 'inside' ? 1 : -1;
    const seamPull = latest
      ? {
        x: (latest.seam.x - joint.x) * (0.19 + routeIndex * 0.04),
        y: (latest.seam.y - joint.y) * 0.05
      }
      : { x: 0, y: 0 };
    const knee = {
      x: clamp(directKnee.x + foldVector.x * (1.65 + routeIndex * 0.18) + foldVector.y * inward * 0.28 + seamPull.x),
      y: clamp(directKnee.y + foldVector.y * (1.4 + routeIndex * 0.16) + foldVector.x * inward * 0.18 + seamPull.y, 0.12, 0.92)
    };
    const foot = {
      x: clamp(directFoot.x + foldVector.x * (3.1 + routeIndex * 0.25) + foldVector.y * inward * 0.46 + seamPull.x * 2.2, 0.06, 0.94),
      y: clamp(directFoot.y + foldVector.y * (2.05 + routeIndex * 0.16) + foldVector.x * inward * 0.24 + Math.cos(stage * 0.48 + routeIndex) * 0.006, 0.58, 0.94)
    };
    return {
      id: route.id,
      route: folded ? 'folded' : 'direct',
      gaitSide,
      joint,
      knee,
      foot,
      influencedBy: relevant.length,
      source: latest?.source ?? 'none',
      seamIndex: latest?.seamIndex ?? null,
      pocketCenter: latest?.pocketCenter ?? null
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyFold);
  const points = applyMemory(draft, inherited);
  const refusalAnchors = [4, 6, 8, 5, 7, 9, 6, 8, 7, 5, 6, 8];
  const refusalIndex = refusalAnchors[stage % refusalAnchors.length];
  const refuses = stage === 0 || stage % 2 === 1;
  const refusal = refuses ? makeFold(points, stage, refusalIndex) : null;
  const fold = inherited.at(-1) ?? null;
  const limbs = buildRoutes(points, inherited, stage);

  return {
    stage,
    draft,
    points,
    refusalIndex,
    refuses,
    refusal,
    fold,
    memory: inherited,
    limbs,
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    foldCount: inherited.length,
    insideRoutes: limbs.filter((limb) => limb.gaitSide === 'inside').length
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

export function deleteFold(frame, foldIndex = frame.memory.length - 1) {
  if (foldIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (foldIndex < 0 || foldIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== foldIndex);
  return buildFrame(frame.stage, memory);
}

export function applyFold(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.16, 0.84)
  };
  const anchorIndex = nearestIndex(bounded, frame.points);
  const fold = makeFold(frame.points, frame.stage, anchorIndex, 'visitor-fold', bounded);
  const priorMemory = frame.memory.map(copyFold);
  const next = buildFrame(frame.stage, [...frame.memory, fold].slice(-MEMORY_LIMIT));
  return { ...next, fold, priorMemory, interaction: 'visitor-fold' };
}
