export const SEED = 0x53505643;
export const STAGES = 18;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 78;

const TAU = Math.PI * 2;
const CONTOUR_POINTS = 96;
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
const copyAttention = (attention) => ({ ...attention, point: copyPoint(attention.point) });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function baseContour(stage) {
  const random = rng(SEED + stage * 7919);
  const center = { x: 0.5 + (random() - 0.5) * 0.018, y: 0.51 + (random() - 0.5) * 0.018 };
  const points = [];
  for (let index = 0; index < CONTOUR_POINTS; index += 1) {
    const angle = -Math.PI / 2 + index / CONTOUR_POINTS * TAU;
    const breath = Math.sin(stage * 0.17 + angle * 2.4) * 0.015;
    const asymmetry = Math.cos(angle * 3.3 - stage * 0.13) * 0.019;
    const grain = (random() - 0.5) * 0.009;
    const jaw = Math.max(0, Math.sin(angle));
    const cheek = Math.max(0, Math.cos(angle + Math.PI / 2));
    const radius = 0.248 + breath + asymmetry + grain - jaw * 0.016;
    points.push({
      x: clamp(center.x + Math.cos(angle) * radius * (1 + cheek * 0.14), 0.055, 0.945),
      y: clamp(center.y + Math.sin(angle) * radius * (1.2 - jaw * 0.13), 0.055, 0.945)
    });
  }
  return { center, points };
}

function makeAperture(stage, center) {
  return {
    x: clamp(center.x + Math.sin(stage * 0.29) * 0.014, 0.33, 0.67),
    y: clamp(center.y + Math.cos(stage * 0.23) * 0.016, 0.3, 0.7),
    rx: 0.064 + Math.sin(stage * 0.21) * 0.007,
    ry: 0.108 + Math.cos(stage * 0.19) * 0.009,
    rotation: Math.sin(stage * 0.16) * 0.08,
    pupilX: center.x + Math.sin(stage * 0.22) * 0.006,
    pupilY: center.y + Math.cos(stage * 0.27) * 0.006
  };
}

function makeAttentionAperture(stage, memory, aperture) {
  let x = aperture.x;
  let y = aperture.y;
  let pupilX = aperture.pupilX;
  let pupilY = aperture.pupilY;
  let rotation = aperture.rotation;
  let pressure = 0;
  memory.forEach((attention, index) => {
    const age = 0.82 + index * 0.14;
    const horizontal = attention.point.x - 0.5;
    const vertical = attention.point.y - 0.5;
    const direction = horizontal >= 0 ? 1 : -1;
    x += horizontal * 0.046 * age;
    y += vertical * 0.036 * age;
    pupilX += horizontal * 0.14 * age + direction * 0.007 * age;
    pupilY += vertical * 0.08 * age;
    rotation += direction * 0.031 * age;
    pressure += Math.abs(attention.weight) * age;
  });
  return {
    x: clamp(x, 0.25, 0.75),
    y: clamp(y, 0.25, 0.75),
    rx: aperture.rx * (1 + pressure * 0.035),
    ry: aperture.ry * (1 - pressure * 0.028),
    rotation,
    pupilX: clamp(pupilX, 0.14, 0.86),
    pupilY: clamp(pupilY, 0.14, 0.86)
  };
}

function anchorIndexes(attention, attentionIndex) {
  const root = ((attention.index % CONTOUR_POINTS) + CONTOUR_POINTS) % CONTOUR_POINTS;
  return {
    entryIndex: (root + 9 + attentionIndex * 11) % CONTOUR_POINTS,
    exitIndex: (root + 41 + attentionIndex * 13) % CONTOUR_POINTS,
    settleIndex: (Math.floor(CONTOUR_POINTS * 0.61) + Math.round((attention.point.x - 0.5) * 18) + attentionIndex * 7) % CONTOUR_POINTS
  };
}

function deformContour(point, attention, entry, exit, settle, stage, pointIndex, attentionIndex) {
  const entryDx = point.x - entry.x;
  const entryDy = point.y - entry.y;
  const exitDx = point.x - exit.x;
  const exitDy = point.y - exit.y;
  const settleDx = point.x - settle.x;
  const settleDy = point.y - settle.y;
  const entryLocal = Math.exp(-(entryDx * entryDx + entryDy * entryDy) / 0.034);
  const exitLocal = Math.exp(-(exitDx * exitDx + exitDy * exitDy) / 0.034);
  const settleLocal = Math.exp(-(settleDx * settleDx + settleDy * settleDy) / 0.055);
  const side = attention.point.x >= 0.5 ? 1 : -1;
  const pressure = attention.weight * (0.78 + Math.max(0, point.y - 0.32) * 0.82);
  const tremor = Math.sin(pointIndex * 0.49 + attention.phase + stage * 0.15 + attentionIndex) * 0.0054;
  return {
    x: clamp(point.x + side * (pressure * entryLocal * 0.065 - pressure * exitLocal * 0.052) + pressure * settleLocal * 0.031 + tremor * (entryLocal + exitLocal), 0.04, 0.96),
    y: clamp(point.y + pressure * (entryLocal - exitLocal) * 0.041 + pressure * settleLocal * 0.037 + tremor * (entryLocal - exitLocal), 0.04, 0.96)
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

function makeAttentionRoutes(stage, memory, counterContour, counterAperture) {
  return memory.map((attention, attentionIndex) => {
    const { entryIndex, exitIndex, settleIndex } = anchorIndexes(attention, attentionIndex);
    const entry = copyPoint(counterContour[entryIndex]);
    const exit = copyPoint(counterContour[exitIndex]);
    const settleTarget = copyPoint(counterContour[settleIndex]);
    const side = attention.point.x >= 0.5 ? 1 : -1;
    const hingeX = clamp(0.5 + Math.sin(attention.phase + stage * 0.1) * 0.026, 0.42, 0.58);
    const hingeY = clamp(0.43 + (attention.point.y - 0.5) * 0.2 + attentionIndex * 0.014, 0.33, 0.63);
    const before = { x: hingeX - side * 0.132, y: hingeY - 0.035 };
    const after = { x: hingeX + side * 0.132, y: hingeY + 0.09 };
    const approach = sampleWaypoints([
      entry,
      { x: (entry.x + counterAperture.pupilX) / 2, y: (entry.y + counterAperture.pupilY) / 2 },
      { x: hingeX - side * 0.22, y: hingeY - 0.064 },
      before
    ], 23);
    const compression = sampleWaypoints([
      before,
      { x: hingeX - side * 0.085, y: hingeY + 0.005 },
      { x: hingeX - side * 0.052, y: hingeY + 0.034 },
      { x: hingeX - side * 0.032, y: hingeY + 0.058 }
    ], 19);
    const fold = sampleWaypoints([
      { x: hingeX - side * 0.032, y: hingeY + 0.058 },
      { x: hingeX - side * 0.014, y: hingeY + 0.084 },
      { x: hingeX + side * 0.022, y: hingeY + 0.103 },
      after
    ], 19);
    const releaseEnd = { x: clamp(0.5 - side * 0.045, 0.42, 0.58), y: hingeY + 0.25 };
    const release = sampleWaypoints([
      after,
      { x: 0.5 + side * 0.028, y: hingeY + 0.15 },
      { x: 0.5 - side * 0.083, y: hingeY + 0.205 },
      releaseEnd
    ], 19);
    const departureLift = { x: clamp(releaseEnd.x + side * 0.054, 0.2, 0.8), y: clamp(releaseEnd.y + 0.11, 0.2, 0.9) };
    const departure = sampleWaypoints([
      releaseEnd,
      departureLift,
      { x: (departureLift.x + exit.x) / 2 - side * 0.035, y: Math.max(departureLift.y + 0.032, (departureLift.y + exit.y) / 2) },
      exit
    ], 21);
    return {
      id: `attention-route-${attention.id}`,
      source: attention.source,
      entryIndex,
      exitIndex,
      settleIndex,
      entry,
      exit,
      settleTarget,
      attention: {
        kind: 'attention-fold',
        hingeX,
        hingeY,
        foldDistance: Math.abs(after.x - before.x),
        side,
        orderBefore: side > 0 ? 'outer' : 'inner',
        orderAfter: side > 0 ? 'inner' : 'outer'
      },
      approach,
      compression,
      fold,
      release,
      departure,
      pressure: attention.weight
    };
  });
}

function candidateAttention(stage, contour) {
  const random = rng(SEED + stage * 12347 + 401);
  const index = (stage * 19 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `attention-${stage}`,
    source: 'renderer-attention',
    stage,
    index,
    point: { x: clamp(0.5 + (boundary.x - 0.5) * 0.68, 0.16, 0.84), y: clamp(0.5 + (boundary.y - 0.5) * 0.64, 0.18, 0.82) },
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait held its attention inward'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyAttention).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const counterAperture = makeAttentionAperture(safe, inherited, aperture);
  const indexes = inherited.map((attention, attentionIndex) => anchorIndexes(attention, attentionIndex));
  const counterContour = geometry.points.map((point, pointIndex) => inherited.reduce((current, attention, attentionIndex) => {
    const anchors = indexes[attentionIndex];
    return deformContour(current, attention, geometry.points[anchors.entryIndex], geometry.points[anchors.exitIndex], geometry.points[anchors.settleIndex], safe, pointIndex, attentionIndex);
  }, copyPoint(point)));
  const attentionRoutes = makeAttentionRoutes(safe, inherited, counterContour, counterAperture);
  const attention = candidateAttention(safe, geometry.points);
  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    counterAperture,
    counterContour,
    attentionRoutes,
    attention,
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
    if (frame.decided) memory = [...memory, frame.attention].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function registerAttention(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.74, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.42, 0.16, 0.84)
  };
  const attention = {
    id: `visitor-attention-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-attention',
    stage: frame.stage,
    index: Math.round((bounded.x * 0.61 + bounded.y * 0.39) * (CONTOUR_POINTS - 1)),
    point: bounded,
    weight: 1.48,
    phase: 0.43,
    reason: 'the visitor made the portrait turn inward'
  };
  const nextMemory = [...frame.memory, attention].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, nextMemory), interaction: 'visitor-attention', restoreMemory: frame.memory.map(copyAttention) };
}

export function liftLatestAttention(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'attention-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'attention-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'attention-lifted' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.counterContour ?? []),
    ...(frame.attentionRoutes ?? []).flatMap((route) => [
      ...(route.approach ?? []), ...(route.compression ?? []), ...(route.fold ?? []), ...(route.release ?? []), ...(route.departure ?? [])
    ])
  ];
  const shapes = [frame.aperture, frame.counterAperture].flatMap((shape) => Object.values(shape ?? {}));
  const routeMeta = (frame.attentionRoutes ?? []).flatMap((route) => [
    route.entryIndex, route.exitIndex, route.settleIndex, route.pressure,
    route.attention?.hingeX, route.attention?.hingeY, route.attention?.foldDistance
  ]);
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...shapes.map((value) => Number(value).toFixed(6)),
    ...routeMeta.map((value) => Number(value).toFixed(6))
  ].join('|');
}
