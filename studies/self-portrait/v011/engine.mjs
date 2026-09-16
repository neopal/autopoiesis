export const SEED = 0x53505641;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 68;

const TAU = Math.PI * 2;
const CONTOUR_POINTS = 80;
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
const copyBraid = (braid) => ({ ...braid, point: copyPoint(braid.point) });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function baseContour(stage) {
  const random = rng(SEED + stage * 7919);
  const center = { x: 0.5 + (random() - 0.5) * 0.018, y: 0.5 + (random() - 0.5) * 0.018 };
  const points = [];
  for (let index = 0; index < CONTOUR_POINTS; index += 1) {
    const angle = -Math.PI / 2 + index / CONTOUR_POINTS * TAU;
    const breath = Math.sin(stage * 0.17 + angle * 2.3) * 0.014;
    const asymmetry = Math.cos(angle * 3.2 - stage * 0.19) * 0.018;
    const grain = (random() - 0.5) * 0.009;
    const jaw = Math.max(0, Math.sin(angle));
    const shoulder = Math.max(0, Math.cos(angle + Math.PI / 2));
    const radius = 0.244 + breath + asymmetry + grain - jaw * 0.014;
    points.push({
      x: clamp(center.x + Math.cos(angle) * radius * (1 + shoulder * 0.12), 0.07, 0.93),
      y: clamp(center.y + Math.sin(angle) * radius * (1.2 - jaw * 0.13), 0.07, 0.93)
    });
  }
  return { center, points };
}

function makeAperture(stage, center) {
  return {
    x: clamp(center.x + Math.sin(stage * 0.29) * 0.014, 0.33, 0.67),
    y: clamp(center.y + Math.cos(stage * 0.26) * 0.016, 0.3, 0.7),
    rx: 0.064 + Math.sin(stage * 0.21) * 0.007,
    ry: 0.11 + Math.cos(stage * 0.23) * 0.009,
    rotation: Math.sin(stage * 0.17) * 0.08,
    pupilX: center.x + Math.sin(stage * 0.22) * 0.006,
    pupilY: center.y + Math.cos(stage * 0.31) * 0.006
  };
}

function makeBraidedAperture(stage, memory, aperture) {
  let x = aperture.x;
  let y = aperture.y;
  let pupilX = aperture.pupilX;
  let pupilY = aperture.pupilY;
  let pressure = 0;
  let rotation = aperture.rotation;
  memory.forEach((braid, index) => {
    const age = 0.8 + index * 0.14;
    const horizontal = braid.point.x - 0.5;
    const vertical = braid.point.y - 0.5;
    x += horizontal * 0.06 * age;
    y += vertical * 0.038 * age;
    pupilX += horizontal * 0.14 * age;
    pupilY += vertical * 0.08 * age;
    rotation += (horizontal >= 0 ? -1 : 1) * 0.03 * age;
    pressure += Math.abs(braid.weight) * age;
  });
  return {
    x: clamp(x, 0.25, 0.75),
    y: clamp(y, 0.25, 0.75),
    rx: aperture.rx * (1 + pressure * 0.03),
    ry: aperture.ry * (1 - pressure * 0.024),
    rotation,
    pupilX: clamp(pupilX, 0.12, 0.88),
    pupilY: clamp(pupilY, 0.12, 0.88)
  };
}

function anchorIndexes(braid, braidIndex) {
  const root = ((braid.index % CONTOUR_POINTS) + CONTOUR_POINTS) % CONTOUR_POINTS;
  return {
    entryIndex: (root + 9 + braidIndex * 5) % CONTOUR_POINTS,
    exitIndex: (root + 31 + braidIndex * 7) % CONTOUR_POINTS,
    resolutionIndex: (Math.floor(CONTOUR_POINTS * 0.54) + Math.round((braid.point.x - 0.5) * 14) + braidIndex * 4) % CONTOUR_POINTS
  };
}

function deformContour(point, braid, entry, exit, resolution, stage, pointIndex, braidIndex) {
  const entryDx = point.x - entry.x;
  const entryDy = point.y - entry.y;
  const exitDx = point.x - exit.x;
  const exitDy = point.y - exit.y;
  const resolveDx = point.x - resolution.x;
  const resolveDy = point.y - resolution.y;
  const entryLocal = Math.exp(-(entryDx * entryDx + entryDy * entryDy) / 0.012);
  const exitLocal = Math.exp(-(exitDx * exitDx + exitDy * exitDy) / 0.012);
  const resolveLocal = Math.exp(-(resolveDx * resolveDx + resolveDy * resolveDy) / 0.018);
  const side = braid.point.x >= 0.5 ? 1 : -1;
  const pressure = braid.weight * (0.78 + Math.max(0, point.y - 0.35) * 0.72);
  const shimmer = Math.sin(pointIndex * 0.59 + braid.phase + stage * 0.13 + braidIndex) * 0.0052;
  return {
    x: clamp(point.x + side * (pressure * entryLocal * 0.052 - pressure * exitLocal * 0.042) + pressure * resolveLocal * 0.018 + shimmer * (entryLocal + exitLocal), 0.045, 0.955),
    y: clamp(point.y + pressure * (entryLocal - exitLocal) * 0.032 + pressure * resolveLocal * 0.026 + shimmer * (entryLocal - exitLocal), 0.045, 0.955)
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

function routeCurve(start, control, end, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y
    };
  });
}

function makeBraidRoutes(stage, memory, counterContour, counterAperture) {
  return memory.map((braid, braidIndex) => {
    const { entryIndex, exitIndex, resolutionIndex } = anchorIndexes(braid, braidIndex);
    const entry = copyPoint(counterContour[entryIndex]);
    const exit = copyPoint(counterContour[exitIndex]);
    const resolutionTarget = copyPoint(counterContour[resolutionIndex]);
    const side = braid.point.x >= 0.5 ? -1 : 1;
    const split = { x: clamp(0.5 + (braid.point.x - 0.5) * 0.18, 0.3, 0.7), y: clamp(0.46 + (braid.point.y - 0.5) * 0.24, 0.32, 0.63) };
    const merge = { x: clamp(0.5 + (braid.point.x - 0.5) * 0.12, 0.36, 0.64), y: clamp(0.73 + (braid.point.y - 0.5) * 0.1, 0.6, 0.84) };
    const left = { x: clamp(split.x - 0.14 - side * 0.014, 0.13, 0.87), y: split.y + 0.095 };
    const right = { x: clamp(split.x + 0.14 - side * 0.014, 0.13, 0.87), y: split.y + 0.095 };
    const crossingLeft = { x: clamp(split.x - 0.11, 0.15, 0.85), y: split.y + 0.19 };
    const crossingRight = { x: clamp(split.x + 0.11, 0.15, 0.85), y: split.y + 0.19 };
    const afterLeft = { x: clamp(split.x - 0.09, 0.16, 0.84), y: split.y + 0.27 };
    const afterRight = { x: clamp(split.x + 0.09, 0.16, 0.84), y: split.y + 0.27 };
    const trunk = routeCurve(counterAperture.pupilX === undefined ? entry : { x: counterAperture.pupilX, y: counterAperture.pupilY }, { x: split.x + side * 0.02, y: (counterAperture.pupilY + split.y) / 2 }, split, 13);
    const lanes = [
      sampleWaypoints([split, left, crossingRight, afterRight, merge], 25),
      sampleWaypoints([split, right, crossingLeft, afterLeft, merge], 25)
    ];
    const resolution = routeCurve(merge, { x: (merge.x + resolutionTarget.x) / 2 + side * 0.035, y: merge.y + 0.05 }, resolutionTarget, 13);
    const mid = Math.floor(lanes[0].length / 2);
    return {
      id: `braid-route-${braid.id}`,
      source: braid.source,
      entryIndex,
      exitIndex,
      resolutionIndex,
      entry,
      exit,
      resolutionTarget,
      split,
      merge,
      crossing: { kind: 'lane-exchange', index: mid, orderBefore: ['left', 'right'], orderAfter: ['right', 'left'], x: (lanes[0][mid].x + lanes[1][mid].x) / 2, y: lanes[0][mid].y },
      trunk,
      lanes,
      resolution,
      exchange: lanes[0][mid].x - lanes[1][mid].x,
      pressure: braid.weight
    };
  });
}

function candidateBraid(stage, contour) {
  const random = rng(SEED + stage * 12347 + 173);
  const index = (stage * 13 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `braid-${stage}`,
    source: 'renderer-braid',
    stage,
    index,
    point: { x: clamp(0.5 + (boundary.x - 0.5) * 0.62, 0.18, 0.82), y: clamp(0.5 + (boundary.y - 0.5) * 0.6, 0.2, 0.8) },
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait kept two possible routes and exchanged their lanes'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyBraid).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const counterAperture = makeBraidedAperture(safe, inherited, aperture);
  const indexes = inherited.map((braid, braidIndex) => anchorIndexes(braid, braidIndex));
  const counterContour = geometry.points.map((point, pointIndex) => inherited.reduce((current, braid, braidIndex) => {
    const anchors = indexes[braidIndex];
    return deformContour(current, braid, geometry.points[anchors.entryIndex], geometry.points[anchors.exitIndex], geometry.points[anchors.resolutionIndex], safe, pointIndex, braidIndex);
  }, copyPoint(point)));
  const braidRoutes = makeBraidRoutes(safe, inherited, counterContour, counterAperture);
  const braid = candidateBraid(safe, geometry.points);
  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    counterAperture,
    counterContour,
    braidRoutes,
    braid,
    decided: safe % 3 === 1,
    memory: inherited,
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const count = clamp(Math.floor(Number(stageCount) || 0), 0, STAGES);
  return Array.from({ length: count }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.decided) memory = [...memory, frame.braid].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyBraid(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.74, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.42, 0.16, 0.84)
  };
  const braid = {
    id: `visitor-braid-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-braid',
    stage: frame.stage,
    index: Math.round((bounded.x * 0.63 + bounded.y * 0.37) * (CONTOUR_POINTS - 1)),
    point: bounded,
    weight: 1.38,
    phase: 0.49,
    reason: 'the visitor made the portrait exchange two possible routes'
  };
  const nextMemory = [...frame.memory, braid].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, nextMemory), interaction: 'visitor-braid', restoreMemory: frame.memory.map(copyBraid) };
}

export function deleteLatestBraid(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'braid-returned' };
  if (!frame.memory.length) return { ...frame, interaction: 'braid-returned' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'braid-returned' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.counterContour ?? []),
    ...(frame.braidRoutes ?? []).flatMap((route) => [
      ...(route.trunk ?? []), ...(route.lanes ?? []).flat(), ...(route.resolution ?? [])
    ])
  ];
  const shapes = [frame.aperture, frame.counterAperture].flatMap((shape) => Object.values(shape ?? {}));
  const routeMeta = (frame.braidRoutes ?? []).flatMap((route) => [
    route.entryIndex, route.exitIndex, route.resolutionIndex, route.pressure,
    route.split?.x, route.split?.y, route.crossing?.x, route.crossing?.y,
    route.merge?.x, route.merge?.y, route.exchange
  ]);
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...shapes.map((value) => Number(value).toFixed(6)),
    ...routeMeta.map((value) => Number(value).toFixed(6))
  ].join('|');
}
