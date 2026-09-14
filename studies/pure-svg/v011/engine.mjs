export const SEED = 0x53564741;
export const STAGES = 15;
export const PRIMITIVE_BUDGET = 22;
export const MEMORY_LIMIT = 4;

const BASE_CONTOUR = [
  { x: 0.07, y: 0.50 },
  { x: 0.14, y: 0.39 },
  { x: 0.27, y: 0.29 },
  { x: 0.42, y: 0.25 },
  { x: 0.58, y: 0.25 },
  { x: 0.73, y: 0.30 },
  { x: 0.84, y: 0.25 },
  { x: 0.95, y: 0.33 },
  { x: 0.87, y: 0.44 },
  { x: 0.75, y: 0.48 },
  { x: 0.76, y: 0.60 },
  { x: 0.66, y: 0.66 },
  { x: 0.54, y: 0.70 },
  { x: 0.42, y: 0.68 },
  { x: 0.30, y: 0.73 },
  { x: 0.18, y: 0.67 },
  { x: 0.16, y: 0.58 },
  { x: 0.10, y: 0.58 }
];

const ROUTES = [
  { id: 'front-route', anchorIndex: 10, foot: { x: 0.79, y: 0.90 }, side: 1 },
  { id: 'middle-route', anchorIndex: 13, foot: { x: 0.48, y: 0.93 }, side: -1 },
  { id: 'rear-route', anchorIndex: 15, foot: { x: 0.17, y: 0.87 }, side: 1 }
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
    point: copyPoint(hinge.point),
    pivot: copyPoint(hinge.pivot),
    crease: copyPoint(hinge.crease),
    gate: copyPoint(hinge.gate),
    exit: copyPoint(hinge.exit),
    tangent: copyPoint(hinge.tangent),
    normal: copyPoint(hinge.normal),
    displacement: copyPoint(hinge.displacement),
    hingePath: hinge.hingePath.map(copyPoint),
    influencedRoutes: [...hinge.influencedRoutes]
  };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function rotate(point, pivot, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos
  };
}

function nearestIndex(point, points) {
  return points.reduce((best, candidate, index) => (
    distance(point, candidate) < distance(point, points[best]) ? index : best
  ), 0);
}

function contourFor(stage) {
  const random = rng(SEED + stage * 7919);
  const breath = Math.sin(stage * 0.53) * 0.012;
  return BASE_CONTOUR.map((point, index) => ({
    x: clamp(point.x + breath + (random() - 0.5) * 0.010),
    y: clamp(point.y + Math.cos(stage * 0.61 + index * 0.69) * 0.012 + (random() - 0.5) * 0.009)
  }));
}

function makeHinge(points, stage, pivotIndex, source = 'auto-refusal', pointOverride = null) {
  const safePivotIndex = Math.min(points.length - 5, Math.max(2, pivotIndex));
  const pivot = copyPoint(points[safePivotIndex]);
  const creaseIndex = Math.min(points.length - 3, safePivotIndex + 3 + ((stage + safePivotIndex) % 2));
  const exitIndex = Math.min(points.length - 1, creaseIndex + 2 + (stage % 2));
  const crease = copyPoint(points[creaseIndex]);
  const exit = copyPoint(points[exitIndex]);
  const tangent = normalize({ x: crease.x - pivot.x, y: crease.y - pivot.y });
  const normal = { x: -tangent.y, y: tangent.x };
  const side = (stage + safePivotIndex) % 2 === 0 ? 1 : -1;
  const foldAngle = side * (0.15 + ((stage + safePivotIndex) % 4) * 0.032);
  const openedGate = rotate(crease, pivot, foldAngle);
  const displacement = {
    x: (openedGate.x - crease.x) * 0.82 + tangent.x * side * 0.018,
    y: (openedGate.y - crease.y) * 0.82 + tangent.y * side * 0.018
  };
  const gate = {
    x: openedGate.x + normal.x * side * 0.026,
    y: openedGate.y + normal.y * side * 0.026
  };
  const openedExit = rotate(exit, pivot, foldAngle);
  const exitPoint = {
    x: openedExit.x + displacement.x * 0.72,
    y: openedExit.y + displacement.y * 0.72
  };

  return {
    kind: 'hinge',
    point: pointOverride ? copyPoint(pointOverride) : copyPoint(pivot),
    pivot,
    crease,
    gate,
    exit: exitPoint,
    pivotIndex: safePivotIndex,
    creaseIndex,
    exitIndex,
    sourceStage: stage,
    source,
    side,
    tangent,
    normal,
    foldAngle,
    displacement,
    hingePath: [pivot, gate, exitPoint],
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= safePivotIndex).map((route) => route.id)
  };
}

function applyMemory(points, memory) {
  return points.map((point, index) => {
    let result = copyPoint(point);
    for (const hinge of memory) {
      if (index < hinge.pivotIndex) continue;
      const span = Math.max(1, hinge.creaseIndex - hinge.pivotIndex);
      const phase = clamp((index - hinge.pivotIndex) / span);
      const eased = phase * phase * (3 - 2 * phase);
      result = rotate(result, hinge.pivot, hinge.foldAngle * eased);
      if (index > hinge.creaseIndex) {
        const downstream = (index - hinge.creaseIndex) / Math.max(1, points.length - 1 - hinge.creaseIndex);
        result.x += hinge.displacement.x * (0.82 - downstream * 0.22);
        result.y += hinge.displacement.y * (0.82 - downstream * 0.22);
        result.x += hinge.tangent.x * hinge.side * downstream * 0.026;
        result.y += hinge.tangent.y * hinge.side * downstream * 0.026;
      }
    }
    return {
      x: clamp(result.x, 0.035, 0.965),
      y: clamp(result.y, 0.12, 0.90)
    };
  });
}

function buildRoutes(points, memory, stage) {
  return ROUTES.map((route, routeIndex) => {
    const relevant = memory.filter((hinge) => hinge.pivotIndex <= route.anchorIndex);
    const latest = relevant.at(-1);
    const load = relevant.reduce((sum, hinge, index) => {
      const amount = 0.044 + index * 0.012;
      return {
        x: sum.x + hinge.normal.x * hinge.side * amount + hinge.tangent.x * (routeIndex - 1) * 0.016,
        y: sum.y + hinge.normal.y * hinge.side * amount + hinge.tangent.y * (routeIndex - 1) * 0.016
      };
    }, { x: 0, y: 0 });
    const joint = copyPoint(points[route.anchorIndex]);
    const folded = Boolean(latest && (routeIndex + latest.creaseIndex + stage) % 2 === 0);
    const posture = latest ? (folded ? 'folded' : 'braced') : 'direct';
    const postureSign = posture === 'folded' ? 1 : -1;
    const knee = {
      x: clamp(joint.x + route.side * (0.042 + routeIndex * 0.013) + load.x * 2.7 + postureSign * 0.012, 0.06, 0.94),
      y: clamp(joint.y + 0.12 + routeIndex * 0.020 + load.y * 2.5 + postureSign * 0.018, 0.18, 0.94)
    };
    const foot = {
      x: clamp(route.foot.x + load.x * 5.8 + load.y * postureSign * 0.52, 0.06, 0.94),
      y: clamp(route.foot.y + load.y * 4.4 + load.x * postureSign * 0.34, 0.64, 0.95)
    };
    return {
      id: route.id,
      route: relevant.length ? 'hinged' : 'direct',
      posture,
      joint,
      knee,
      foot,
      influencedBy: relevant.length,
      source: latest?.source ?? 'none',
      creaseIndex: latest?.creaseIndex ?? null,
      gate: latest?.gate ?? null
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyHinge);
  const points = applyMemory(draft, inherited);
  const refusalAnchors = [3, 5, 7, 6, 8, 9, 4, 7, 5, 8, 6, 9, 4, 7, 6];
  const pivotIndex = refusalAnchors[stage % refusalAnchors.length];
  const refuses = stage === 0 || stage % 2 === 1;
  const refusal = refuses ? makeHinge(points, stage, pivotIndex) : null;
  const routes = buildRoutes(points, inherited, stage);

  return {
    stage,
    draft,
    points,
    pivotIndex,
    refuses,
    refusal,
    hinge: inherited.at(-1) ?? null,
    memory: inherited,
    routes,
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    hingeCount: inherited.length,
    foldedRoutes: routes.filter((route) => route.posture === 'folded').length,
    bracedRoutes: routes.filter((route) => route.posture === 'braced').length
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

export function deleteHinge(frame, hingeIndex = frame.memory.length - 1) {
  if (hingeIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (hingeIndex < 0 || hingeIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== hingeIndex);
  return buildFrame(frame.stage, memory);
}

export function applyHinge(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.16, 0.84)
  };
  const pivotIndex = Math.min(frame.points.length - 5, nearestIndex(bounded, frame.points));
  const hinge = makeHinge(frame.points, frame.stage, pivotIndex, 'visitor-hinge', bounded);
  const priorMemory = frame.memory.map(copyHinge);
  const next = buildFrame(frame.stage, [...frame.memory, hinge].slice(-MEMORY_LIMIT));
  return { ...next, hinge, priorMemory, interaction: 'visitor-hinge' };
}
