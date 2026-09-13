export const SEED = 0x53564740;
export const STAGES = 13;
export const PRIMITIVE_BUDGET = 19;
export const MEMORY_LIMIT = 4;

const BASE_CONTOUR = [
  { x: 0.10, y: 0.50 },
  { x: 0.18, y: 0.39 },
  { x: 0.30, y: 0.33 },
  { x: 0.45, y: 0.30 },
  { x: 0.60, y: 0.28 },
  { x: 0.76, y: 0.33 },
  { x: 0.88, y: 0.44 },
  { x: 0.80, y: 0.54 },
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

function copyCounterweight(weight) {
  return {
    ...weight,
    point: copyPoint(weight.point),
    pivot: copyPoint(weight.pivot),
    balancePoint: copyPoint(weight.balancePoint),
    tangent: copyPoint(weight.tangent),
    normal: copyPoint(weight.normal),
    weightVector: copyPoint(weight.weightVector),
    spine: weight.spine.map(copyPoint),
    influencedRoutes: [...weight.influencedRoutes]
  };
}

function contourFor(stage) {
  const random = rng(SEED + stage * 7919);
  const breath = Math.sin(stage * 0.71) * 0.017;
  return BASE_CONTOUR.map((point, index) => ({
    x: clamp(point.x + breath + (random() - 0.5) * 0.013),
    y: clamp(point.y + Math.cos(stage * 0.57 + index * 0.74) * 0.014 + (random() - 0.5) * 0.010)
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

function makeCounterweight(points, stage, anchorIndex, source = 'auto-counterweight', pointOverride = null) {
  const pivot = copyPoint(points[anchorIndex]);
  const balanceIndex = Math.min(points.length - 1, anchorIndex + 2 + ((stage + anchorIndex) % 3));
  const balancePoint = copyPoint(points[balanceIndex]);
  const tangent = normalize({ x: balancePoint.x - pivot.x, y: balancePoint.y - pivot.y });
  const side = (stage + anchorIndex) % 2 === 0 ? 1 : -1;
  const normal = { x: -tangent.y, y: tangent.x };
  const leverage = 0.082 + ((stage + anchorIndex) % 4) * 0.014;
  const weightVector = {
    x: normal.x * side * leverage,
    y: normal.y * side * leverage
  };
  const midpoint = {
    x: (pivot.x + balancePoint.x) / 2,
    y: (pivot.y + balancePoint.y) / 2
  };
  const spine = [
    pivot,
    {
      x: midpoint.x + weightVector.x * 1.35 + side * 0.018,
      y: midpoint.y + weightVector.y * 1.35
    },
    {
      x: balancePoint.x + weightVector.x * 0.52 + side * 0.012,
      y: balancePoint.y + weightVector.y * 0.52
    }
  ];

  return {
    kind: 'counterweight',
    point: pointOverride ? copyPoint(pointOverride) : copyPoint(pivot),
    pivot,
    balancePoint,
    anchorIndex,
    balanceIndex,
    sourceStage: stage,
    source,
    side,
    tangent,
    normal,
    leverage,
    weightVector,
    spine,
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= anchorIndex).map((route) => route.id)
  };
}

function applyMemory(points, memory) {
  return points.map((point, index) => {
    const result = copyPoint(point);
    for (const weight of memory) {
      if (index < weight.anchorIndex) continue;
      const span = Math.max(1, weight.balanceIndex - weight.anchorIndex);
      const phase = clamp((index - weight.anchorIndex) / span);
      const loading = Math.sin(Math.PI * phase / 2);
      const downstream = index > weight.balanceIndex
        ? (index - weight.balanceIndex) / Math.max(1, points.length - 1 - weight.balanceIndex)
        : 0;
      const carried = index > weight.balanceIndex
        ? 1 - downstream * 0.62
        : loading;
      const counterTurn = index > weight.balanceIndex ? downstream * weight.leverage * 0.48 : 0;
      result.x += weight.weightVector.x * carried + weight.tangent.x * weight.side * counterTurn;
      result.y += weight.weightVector.y * carried + weight.tangent.y * weight.side * counterTurn;
    }
    return {
      x: clamp(result.x, 0.04, 0.96),
      y: clamp(result.y, 0.12, 0.88)
    };
  });
}

function buildRoutes(points, memory, stage) {
  return ROUTES.map((route, routeIndex) => {
    const relevant = memory.filter((weight) => weight.anchorIndex <= route.anchorIndex);
    const latest = relevant.at(-1);
    const load = relevant.reduce((sum, weight, index) => {
      const parity = (routeIndex + index) % 2 === 0 ? 1 : -1;
      return {
        x: sum.x + weight.weightVector.x * (1 + index * 0.21) + weight.tangent.x * parity * 0.026,
        y: sum.y + weight.weightVector.y * (1 + index * 0.21) + weight.tangent.y * parity * 0.026
      };
    }, { x: 0, y: 0 });
    const joint = copyPoint(points[route.anchorIndex]);
    const directKnee = {
      x: joint.x + route.side * (0.036 + routeIndex * 0.012),
      y: joint.y + 0.11 + routeIndex * 0.017
    };
    const directFoot = copyPoint(route.foot);
    const weighted = relevant.length > 0;
    const posture = weighted && (routeIndex + latest.balanceIndex) % 2 === 0 ? 'loaded' : weighted ? 'countered' : 'direct';
    const postureSign = posture === 'loaded' ? 1 : -1;
    const balancePull = latest
      ? {
        x: (latest.balancePoint.x - joint.x) * (0.18 + routeIndex * 0.035),
        y: (latest.balancePoint.y - joint.y) * 0.05
      }
      : { x: 0, y: 0 };
    const knee = {
      x: clamp(directKnee.x + load.x * (1.62 + routeIndex * 0.14) + load.y * postureSign * 0.24 + balancePull.x),
      y: clamp(directKnee.y + load.y * (1.46 + routeIndex * 0.14) + load.x * postureSign * 0.16 + balancePull.y, 0.12, 0.92)
    };
    const foot = {
      x: clamp(directFoot.x + load.x * (3.04 + routeIndex * 0.24) + load.y * postureSign * 0.38 + balancePull.x * 2.1, 0.06, 0.94),
      y: clamp(directFoot.y + load.y * (2.12 + routeIndex * 0.15) + load.x * postureSign * 0.22 + Math.cos(stage * 0.48 + routeIndex) * 0.006, 0.58, 0.94)
    };
    return {
      id: route.id,
      route: weighted ? 'weighted' : 'direct',
      posture,
      joint,
      knee,
      foot,
      influencedBy: relevant.length,
      source: latest?.source ?? 'none',
      balanceIndex: latest?.balanceIndex ?? null,
      spine: latest?.spine ?? null
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyCounterweight);
  const points = applyMemory(draft, inherited);
  const refusalAnchors = [4, 6, 8, 5, 7, 9, 6, 8, 7, 5, 6, 8, 7];
  const refusalIndex = refusalAnchors[stage % refusalAnchors.length];
  const refuses = stage === 0 || stage % 2 === 1;
  const refusal = refuses ? makeCounterweight(points, stage, refusalIndex) : null;
  const counterweight = inherited.at(-1) ?? null;
  const limbs = buildRoutes(points, inherited, stage);

  return {
    stage,
    draft,
    points,
    refusalIndex,
    refuses,
    refusal,
    counterweight,
    memory: inherited,
    limbs,
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    counterweightCount: inherited.length,
    loadedRoutes: limbs.filter((limb) => limb.posture === 'loaded').length,
    counteredRoutes: limbs.filter((limb) => limb.posture === 'countered').length
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

export function deleteCounterweight(frame, weightIndex = frame.memory.length - 1) {
  if (weightIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (weightIndex < 0 || weightIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== weightIndex);
  return buildFrame(frame.stage, memory);
}

export function applyCounterweight(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.16, 0.84)
  };
  const anchorIndex = nearestIndex(bounded, frame.points);
  const weight = makeCounterweight(frame.points, frame.stage, anchorIndex, 'visitor-counterweight', bounded);
  const priorMemory = frame.memory.map(copyCounterweight);
  const next = buildFrame(frame.stage, [...frame.memory, weight].slice(-MEMORY_LIMIT));
  return { ...next, counterweight: weight, priorMemory, interaction: 'visitor-counterweight' };
}
