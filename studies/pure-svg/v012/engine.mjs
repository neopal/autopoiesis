export const SEED = 0x53564742;
export const STAGES = 16;
export const PRIMITIVE_BUDGET = 24;
export const MEMORY_LIMIT = 4;

const BASE_CONTOUR = [
  { x: 0.07, y: 0.52 },
  { x: 0.13, y: 0.41 },
  { x: 0.25, y: 0.31 },
  { x: 0.40, y: 0.27 },
  { x: 0.56, y: 0.25 },
  { x: 0.71, y: 0.29 },
  { x: 0.84, y: 0.24 },
  { x: 0.95, y: 0.34 },
  { x: 0.88, y: 0.45 },
  { x: 0.76, y: 0.49 },
  { x: 0.77, y: 0.60 },
  { x: 0.69, y: 0.66 },
  { x: 0.58, y: 0.70 },
  { x: 0.47, y: 0.68 },
  { x: 0.36, y: 0.73 },
  { x: 0.24, y: 0.67 },
  { x: 0.17, y: 0.59 },
  { x: 0.12, y: 0.61 },
  { x: 0.09, y: 0.56 },
  { x: 0.07, y: 0.52 }
];

const ROUTES = [
  { id: 'fore-route', anchorIndex: 10, foot: { x: 0.80, y: 0.90 }, side: 1 },
  { id: 'middle-route', anchorIndex: 12, foot: { x: 0.49, y: 0.94 }, side: -1 },
  { id: 'rear-route', anchorIndex: 14, foot: { x: 0.18, y: 0.87 }, side: 1 }
];

const THRESHOLD_ANCHORS = [4, 6, 8, 7, 9, 10, 5, 8, 6, 9, 7, 10, 5, 8, 6, 9];

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

function copyThreshold(threshold) {
  return {
    ...threshold,
    point: copyPoint(threshold.point),
    pivot: copyPoint(threshold.pivot),
    thresholdPoint: copyPoint(threshold.thresholdPoint),
    exit: copyPoint(threshold.exit),
    center: copyPoint(threshold.center),
    tangent: copyPoint(threshold.tangent),
    normal: copyPoint(threshold.normal),
    displacement: copyPoint(threshold.displacement),
    aperture: threshold.aperture.map(copyPoint),
    crossings: threshold.crossings.map(copyPoint),
    thresholdPath: threshold.thresholdPath.map(copyPoint),
    influencedRoutes: [...threshold.influencedRoutes]
  };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(vector, amount) {
  return { x: vector.x * amount, y: vector.y * amount };
}

function nearestIndex(point, points) {
  return points.reduce((best, candidate, index) => (
    distance(point, candidate) < distance(point, points[best]) ? index : best
  ), 0);
}

function contourFor(stage) {
  const random = rng(SEED + stage * 7919);
  const breathing = Math.sin(stage * 0.47) * 0.014;
  return BASE_CONTOUR.map((point, index) => ({
    x: clamp(point.x + breathing + (random() - 0.5) * 0.012),
    y: clamp(point.y + Math.cos(stage * 0.61 + index * 0.67) * 0.013 + (random() - 0.5) * 0.010)
  }));
}

function makeThreshold(points, stage, anchorIndex, source = 'auto-threshold', pointOverride = null) {
  const safeAnchorIndex = Math.min(points.length - 7, Math.max(2, anchorIndex));
  const thresholdIndex = Math.min(points.length - 4, safeAnchorIndex + 3 + ((stage + safeAnchorIndex) % 2));
  const exitIndex = Math.min(points.length - 2, thresholdIndex + 2 + (stage % 2));
  const pivot = copyPoint(points[safeAnchorIndex]);
  const thresholdPoint = copyPoint(points[thresholdIndex]);
  const exit = copyPoint(points[exitIndex]);
  const tangent = normalize({ x: thresholdPoint.x - pivot.x, y: thresholdPoint.y - pivot.y });
  const normal = { x: -tangent.y, y: tangent.x };
  const side = (stage + safeAnchorIndex) % 2 === 0 ? 1 : -1;
  const gapWidth = clamp(0.042 + ((stage + safeAnchorIndex) % 4) * 0.009, 0.040, 0.075);
  const gapDepth = clamp(0.060 + ((stage * 3 + safeAnchorIndex) % 4) * 0.014, 0.058, 0.106);
  const displacement = add(
    scale(normal, side * gapDepth),
    scale(tangent, side * 0.025)
  );
  const center = add({
    x: (pivot.x + thresholdPoint.x) / 2,
    y: (pivot.y + thresholdPoint.y) / 2
  }, scale(displacement, 0.84));
  const apertureAcross = 0.026 + ((stage + safeAnchorIndex) % 2) * 0.006;
  const aperture = [
    add(add(center, scale(tangent, -gapWidth)), scale(normal, -side * apertureAcross)),
    add(add(center, scale(tangent, gapWidth)), scale(normal, -side * apertureAcross)),
    add(add(center, scale(tangent, gapWidth * 0.82)), scale(normal, side * apertureAcross)),
    add(add(center, scale(tangent, -gapWidth * 0.82)), scale(normal, side * apertureAcross))
  ].map((point) => ({ x: clamp(point.x, 0.05, 0.95), y: clamp(point.y, 0.14, 0.86) }));
  const thresholdPath = [
    pivot,
    add(pivot, add(scale(tangent, 0.15), scale(normal, side * gapDepth * 0.42))),
    add(center, scale(tangent, -gapWidth * 0.82)),
    add(center, scale(tangent, gapWidth * 0.82)),
    add(exit, displacement)
  ].map((point) => ({ x: clamp(point.x, 0.04, 0.96), y: clamp(point.y, 0.12, 0.90) }));
  const crossings = [
    add(center, scale(normal, -side * 0.010)),
    add(center, add(scale(tangent, 0.030), scale(normal, side * 0.016))),
    add(center, add(scale(tangent, -0.030), scale(normal, side * 0.012)))
  ].map((point) => ({ x: clamp(point.x, 0.06, 0.94), y: clamp(point.y, 0.16, 0.84) }));

  return {
    kind: 'threshold',
    point: pointOverride ? copyPoint(pointOverride) : copyPoint(center),
    pivot,
    thresholdPoint,
    exit,
    center,
    aperture,
    crossings,
    thresholdPath,
    anchorIndex: safeAnchorIndex,
    thresholdIndex,
    exitIndex,
    sourceStage: stage,
    source,
    side,
    tangent,
    normal,
    gapWidth,
    gapDepth,
    displacement,
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= safeAnchorIndex).map((route) => route.id)
  };
}

function applyMemory(points, memory) {
  return points.map((point, index) => {
    let result = copyPoint(point);
    for (const threshold of memory) {
      if (index < threshold.anchorIndex) continue;
      const span = Math.max(1, threshold.thresholdIndex - threshold.anchorIndex);
      const phase = clamp((index - threshold.anchorIndex) / span);
      const eased = phase * phase * (3 - 2 * phase);
      const envelope = index <= threshold.thresholdIndex
        ? eased
        : Math.max(0.28, 1 - ((index - threshold.thresholdIndex) / Math.max(1, points.length - 1 - threshold.thresholdIndex)) * 0.60);
      result = add(result, scale(threshold.displacement, envelope));
      if (index > threshold.thresholdIndex) {
        const downstream = (index - threshold.thresholdIndex) / Math.max(1, points.length - 1 - threshold.thresholdIndex);
        result = add(result, scale(threshold.tangent, threshold.side * downstream * 0.034));
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
    const relevant = memory.filter((threshold) => threshold.anchorIndex <= route.anchorIndex);
    const latest = relevant.at(-1);
    const load = relevant.reduce((sum, threshold, index) => add(sum, scale(threshold.normal, threshold.side * (0.025 + index * 0.010))), { x: 0, y: 0 });
    const joint = copyPoint(points[route.anchorIndex]);
    const directKnee = {
      x: clamp(joint.x + route.side * (0.050 + routeIndex * 0.012), 0.06, 0.94),
      y: clamp(joint.y + 0.13 + routeIndex * 0.025, 0.20, 0.94)
    };
    const directPass = {
      x: (joint.x + route.foot.x) / 2,
      y: (joint.y + route.foot.y) / 2 - 0.015
    };
    const queue = latest
      ? {
        x: clamp(joint.x + latest.normal.x * latest.side * (0.055 + routeIndex * 0.014) + load.x * 1.8, 0.06, 0.94),
        y: clamp(joint.y + latest.normal.y * latest.side * (0.055 + routeIndex * 0.014) + load.y * 1.8, 0.18, 0.94)
      }
      : directKnee;
    const knee = latest
      ? {
        x: clamp(queue.x + latest.tangent.x * route.side * (0.055 + routeIndex * 0.018) + load.x * 2.6, 0.06, 0.94),
        y: clamp(queue.y + 0.10 + routeIndex * 0.022 + load.y * 2.4, 0.20, 0.94)
      }
      : directKnee;
    const pass = latest
      ? add(latest.crossings[routeIndex], scale(latest.normal, latest.side * (routeIndex - 1) * 0.016))
      : directPass;
    const foot = {
      x: clamp(route.foot.x + load.x * 4.8 + (latest ? latest.side * route.side * 0.018 : 0), 0.06, 0.94),
      y: clamp(route.foot.y + load.y * 4.2, 0.64, 0.95)
    };
    const posture = latest ? ['waiting', 'crossing', 'cleared'][routeIndex] : 'direct';
    return {
      id: route.id,
      route: latest ? 'thresholded' : 'direct',
      posture,
      joint,
      queue,
      knee,
      pass,
      foot,
      influencedBy: relevant.length,
      source: latest?.source ?? 'none',
      thresholdIndex: latest?.thresholdIndex ?? null,
      aperture: latest?.aperture ?? null
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyThreshold);
  const points = applyMemory(draft, inherited);
  const anchorIndex = THRESHOLD_ANCHORS[stage % THRESHOLD_ANCHORS.length];
  const refuses = stage === 0 || stage % 2 === 1;
  const refusal = refuses ? makeThreshold(points, stage, anchorIndex) : null;
  const routes = buildRoutes(points, inherited, stage);
  const threshold = inherited.at(-1) ?? null;

  return {
    stage,
    draft,
    points,
    anchorIndex,
    refuses,
    refusal,
    threshold,
    memory: inherited,
    routes,
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    thresholdCount: inherited.length,
    waitingRoutes: routes.filter((route) => route.posture === 'waiting').length,
    crossingRoutes: routes.filter((route) => route.posture === 'crossing').length,
    clearedRoutes: routes.filter((route) => route.posture === 'cleared').length
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

export function deleteThreshold(frame, thresholdIndex = frame.memory.length - 1) {
  if (thresholdIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (thresholdIndex < 0 || thresholdIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== thresholdIndex);
  return buildFrame(frame.stage, memory);
}

export function applyThreshold(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.16, 0.84)
  };
  const anchorIndex = Math.min(frame.points.length - 7, nearestIndex(bounded, frame.points));
  const threshold = makeThreshold(frame.points, frame.stage, anchorIndex, 'visitor-threshold', bounded);
  const priorMemory = frame.memory.map(copyThreshold);
  const next = buildFrame(frame.stage, [...frame.memory, threshold].slice(-MEMORY_LIMIT));
  return { ...next, threshold, priorMemory, interaction: 'visitor-threshold' };
}
