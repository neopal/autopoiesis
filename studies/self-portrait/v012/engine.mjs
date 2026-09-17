export const SEED = 0x53505642;
export const STAGES = 18;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 72;

const TAU = Math.PI * 2;
const CONTOUR_POINTS = 84;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyThreshold = (threshold) => ({ ...threshold, point: copyPoint(threshold.point) });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function baseContour(stage) {
  const random = rng(SEED + stage * 7919);
  const center = { x: 0.5 + (random() - 0.5) * 0.018, y: 0.51 + (random() - 0.5) * 0.018 };
  const points = [];
  for (let index = 0; index < CONTOUR_POINTS; index += 1) {
    const angle = -Math.PI / 2 + index / CONTOUR_POINTS * TAU;
    const breath = Math.sin(stage * 0.19 + angle * 2.2) * 0.014;
    const asymmetry = Math.cos(angle * 3.1 - stage * 0.16) * 0.018;
    const grain = (random() - 0.5) * 0.008;
    const jaw = Math.max(0, Math.sin(angle));
    const shoulder = Math.max(0, Math.cos(angle + Math.PI / 2));
    const radius = 0.246 + breath + asymmetry + grain - jaw * 0.015;
    points.push({
      x: clamp(center.x + Math.cos(angle) * radius * (1 + shoulder * 0.12), 0.07, 0.93),
      y: clamp(center.y + Math.sin(angle) * radius * (1.2 - jaw * 0.13), 0.07, 0.94)
    });
  }
  return { center, points };
}

function makeAperture(stage, center) {
  return {
    x: clamp(center.x + Math.sin(stage * 0.31) * 0.014, 0.33, 0.67),
    y: clamp(center.y + Math.cos(stage * 0.25) * 0.016, 0.3, 0.7),
    rx: 0.064 + Math.sin(stage * 0.23) * 0.007,
    ry: 0.108 + Math.cos(stage * 0.21) * 0.009,
    rotation: Math.sin(stage * 0.18) * 0.08,
    pupilX: center.x + Math.sin(stage * 0.24) * 0.006,
    pupilY: center.y + Math.cos(stage * 0.29) * 0.006
  };
}

function makeThresholdAperture(stage, memory, aperture) {
  let x = aperture.x;
  let y = aperture.y;
  let pupilX = aperture.pupilX;
  let pupilY = aperture.pupilY;
  let rotation = aperture.rotation;
  let pressure = 0;
  memory.forEach((threshold, index) => {
    const age = 0.82 + index * 0.13;
    const horizontal = threshold.point.x - 0.5;
    const vertical = threshold.point.y - 0.5;
    const direction = horizontal >= 0 ? 1 : -1;
    x += horizontal * 0.042 * age;
    y += vertical * 0.031 * age;
    pupilX += horizontal * 0.12 * age + direction * 0.006 * age;
    pupilY += vertical * 0.07 * age;
    rotation += direction * 0.026 * age;
    pressure += Math.abs(threshold.weight) * age;
  });
  return {
    x: clamp(x, 0.25, 0.75),
    y: clamp(y, 0.25, 0.75),
    rx: aperture.rx * (1 + pressure * 0.032),
    ry: aperture.ry * (1 - pressure * 0.026),
    rotation,
    pupilX: clamp(pupilX, 0.14, 0.86),
    pupilY: clamp(pupilY, 0.14, 0.86)
  };
}

function anchorIndexes(threshold, thresholdIndex) {
  const root = ((threshold.index % CONTOUR_POINTS) + CONTOUR_POINTS) % CONTOUR_POINTS;
  return {
    entryIndex: (root + 8 + thresholdIndex * 7) % CONTOUR_POINTS,
    exitIndex: (root + 36 + thresholdIndex * 9) % CONTOUR_POINTS,
    settleIndex: (Math.floor(CONTOUR_POINTS * 0.58) + Math.round((threshold.point.x - 0.5) * 16) + thresholdIndex * 5) % CONTOUR_POINTS
  };
}

function deformContour(point, threshold, entry, exit, settle, stage, pointIndex, thresholdIndex) {
  const entryDx = point.x - entry.x;
  const entryDy = point.y - entry.y;
  const exitDx = point.x - exit.x;
  const exitDy = point.y - exit.y;
  const settleDx = point.x - settle.x;
  const settleDy = point.y - settle.y;
  const entryLocal = Math.exp(-(entryDx * entryDx + entryDy * entryDy) / 0.012);
  const exitLocal = Math.exp(-(exitDx * exitDx + exitDy * exitDy) / 0.012);
  const settleLocal = Math.exp(-(settleDx * settleDx + settleDy * settleDy) / 0.02);
  const side = threshold.point.x >= 0.5 ? 1 : -1;
  const pressure = threshold.weight * (0.74 + Math.max(0, point.y - 0.35) * 0.78);
  const tremor = Math.sin(pointIndex * 0.53 + threshold.phase + stage * 0.16 + thresholdIndex) * 0.0048;
  return {
    x: clamp(point.x + side * (pressure * entryLocal * 0.052 - pressure * exitLocal * 0.043) + pressure * settleLocal * 0.022 + tremor * (entryLocal + exitLocal), 0.045, 0.955),
    y: clamp(point.y + pressure * (entryLocal - exitLocal) * 0.034 + pressure * settleLocal * 0.026 + tremor * (entryLocal - exitLocal), 0.045, 0.955)
  };
}

function sampleWaypoints(waypoints, count) {
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return copyPoint(waypoints[0]);
    if (index === count - 1) return copyPoint(waypoints.at(-1));
    const scaled = index / (count - 1) * (waypoints.length - 1);
    const segment = Math.min(Math.floor(scaled), waypoints.length - 2);
    const local = scaled - segment;
    const p0 = waypoints[Math.max(0, segment - 1)];
    const p1 = waypoints[segment];
    const p2 = waypoints[segment + 1];
    const p3 = waypoints[Math.min(waypoints.length - 1, segment + 2)];
    const t2 = local * local;
    const t3 = t2 * local;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * local + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * local + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  });
}

function makeThresholdRoutes(stage, memory, counterContour, counterAperture) {
  return memory.map((threshold, thresholdIndex) => {
    const { entryIndex, exitIndex, settleIndex } = anchorIndexes(threshold, thresholdIndex);
    const entry = copyPoint(counterContour[entryIndex]);
    const exit = copyPoint(counterContour[exitIndex]);
    const settleTarget = copyPoint(counterContour[settleIndex]);
    const side = threshold.point.x >= 0.5 ? 1 : -1;
    const thresholdX = clamp(0.5 + Math.sin(threshold.phase + stage * 0.12) * 0.022, 0.42, 0.58);
    const thresholdY = clamp(0.46 + (threshold.point.y - 0.5) * 0.18 + thresholdIndex * 0.012, 0.36, 0.61);
    const before = { x: thresholdX - side * 0.105, y: thresholdY + 0.015 };
    const after = { x: thresholdX + side * 0.105, y: thresholdY + 0.13 };
    const approach = sampleWaypoints([
      entry,
      { x: (entry.x + counterAperture.pupilX) / 2, y: (entry.y + counterAperture.pupilY) / 2 },
      { x: thresholdX - side * 0.19, y: thresholdY - 0.04 },
      before
    ], 21);
    const boundary = sampleWaypoints([
      before,
      { x: thresholdX - side * 0.09, y: thresholdY + 0.04 },
      { x: thresholdX - side * 0.08, y: thresholdY + 0.1 },
      before
    ], 17);
    const crossing = sampleWaypoints([
      before,
      { x: thresholdX - side * 0.035, y: thresholdY + 0.062 },
      { x: thresholdX + side * 0.035, y: thresholdY + 0.085 },
      after
    ], 17);
    const interiorEnd = { x: clamp(0.5 - side * 0.045, 0.42, 0.58), y: thresholdY + 0.26 };
    const interior = sampleWaypoints([
      after,
      { x: 0.5 + side * 0.02, y: thresholdY + 0.17 },
      { x: 0.5 - side * 0.08, y: thresholdY + 0.22 },
      interiorEnd
    ], 17);
    const departureLift = { x: clamp(interiorEnd.x + side * 0.045, 0.2, 0.8), y: clamp(interiorEnd.y + 0.11, 0.2, 0.9) };
    const departure = sampleWaypoints([
      interiorEnd,
      departureLift,
      { x: (departureLift.x + exit.x) / 2 - side * 0.03, y: Math.max(departureLift.y + 0.025, (departureLift.y + exit.y) / 2) },
      exit
    ], 19);
    return {
      id: `threshold-route-${threshold.id}`,
      source: threshold.source,
      entryIndex,
      exitIndex,
      settleIndex,
      entry,
      exit,
      settleTarget,
      threshold: {
        kind: 'boundary-crossing',
        x: thresholdX,
        y: thresholdY,
        crossingDistance: Math.abs(after.x - before.x),
        side,
        orderBefore: side > 0 ? 'outside' : 'inside',
        orderAfter: side > 0 ? 'inside' : 'outside'
      },
      approach,
      boundary,
      crossing,
      interior,
      departure,
      pressure: threshold.weight
    };
  });
}

function candidateThreshold(stage, contour) {
  const random = rng(SEED + stage * 12347 + 211);
  const index = (stage * 17 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `threshold-${stage}`,
    source: 'renderer-threshold',
    stage,
    index,
    point: { x: clamp(0.5 + (boundary.x - 0.5) * 0.62, 0.18, 0.82), y: clamp(0.5 + (boundary.y - 0.5) * 0.6, 0.2, 0.8) },
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait kept a boundary and crossed it'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyThreshold).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const counterAperture = makeThresholdAperture(safe, inherited, aperture);
  const indexes = inherited.map((threshold, thresholdIndex) => anchorIndexes(threshold, thresholdIndex));
  const counterContour = geometry.points.map((point, pointIndex) => inherited.reduce((current, threshold, thresholdIndex) => {
    const anchors = indexes[thresholdIndex];
    return deformContour(current, threshold, geometry.points[anchors.entryIndex], geometry.points[anchors.exitIndex], geometry.points[anchors.settleIndex], safe, pointIndex, thresholdIndex);
  }, copyPoint(point)));
  const thresholdRoutes = makeThresholdRoutes(safe, inherited, counterContour, counterAperture);
  const threshold = candidateThreshold(safe, geometry.points);
  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    counterAperture,
    counterContour,
    thresholdRoutes,
    threshold,
    decided: safe % 3 === 2,
    memory: inherited,
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const count = clamp(Math.floor(Number(stageCount) || 0), 0, STAGES);
  return Array.from({ length: count }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.decided) memory = [...memory, frame.threshold].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyThreshold(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.74, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.42, 0.16, 0.84)
  };
  const threshold = {
    id: `visitor-threshold-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-threshold',
    stage: frame.stage,
    index: Math.round((bounded.x * 0.63 + bounded.y * 0.37) * (CONTOUR_POINTS - 1)),
    point: bounded,
    weight: 1.42,
    phase: 0.37,
    reason: 'the visitor made the portrait cross its boundary'
  };
  const nextMemory = [...frame.memory, threshold].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, nextMemory), interaction: 'visitor-threshold', restoreMemory: frame.memory.map(copyThreshold) };
}

export function deleteLatestThreshold(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'threshold-returned' };
  if (!frame.memory.length) return { ...frame, interaction: 'threshold-returned' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'threshold-returned' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.counterContour ?? []),
    ...(frame.thresholdRoutes ?? []).flatMap((route) => [
      ...(route.approach ?? []), ...(route.boundary ?? []), ...(route.crossing ?? []), ...(route.interior ?? []), ...(route.departure ?? [])
    ])
  ];
  const shapes = [frame.aperture, frame.counterAperture].flatMap((shape) => Object.values(shape ?? {}));
  const routeMeta = (frame.thresholdRoutes ?? []).flatMap((route) => [
    route.entryIndex, route.exitIndex, route.settleIndex, route.pressure,
    route.threshold?.x, route.threshold?.y, route.threshold?.crossingDistance
  ]);
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...shapes.map((value) => Number(value).toFixed(6)),
    ...routeMeta.map((value) => Number(value).toFixed(6))
  ].join('|');
}
