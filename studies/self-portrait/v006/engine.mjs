export const SEED = 0x53505636;
export const STAGES = 12;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 42;

const TAU = Math.PI * 2;
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
const copyFold = (fold) => ({ ...fold, point: copyPoint(fold.point) });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function baseContour(stage) {
  const random = rng(SEED + stage * 7919);
  const center = {
    x: 0.5 + (random() - 0.5) * 0.016,
    y: 0.5 + (random() - 0.5) * 0.018
  };
  const points = [];
  const count = 48;

  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index / count * TAU;
    const breath = Math.sin(stage * 0.24 + angle * 2.15) * 0.016;
    const asymmetry = Math.cos(angle * 3.1 - stage * 0.17) * 0.019;
    const grain = (random() - 0.5) * 0.008;
    const shoulder = Math.max(0, Math.cos(angle + Math.PI / 2));
    const radius = 0.242 + breath + asymmetry + grain;
    points.push({
      x: clamp(center.x + Math.cos(angle) * radius * (1 + shoulder * 0.12), 0.07, 0.93),
      y: clamp(center.y + Math.sin(angle) * radius * (1.2 - Math.max(0, Math.sin(angle)) * 0.12), 0.07, 0.93)
    });
  }
  return { center, points };
}

function makeAperture(stage, center) {
  return {
    x: clamp(center.x + Math.sin(stage * 0.37) * 0.014, 0.32, 0.68),
    y: clamp(center.y + Math.cos(stage * 0.29) * 0.016, 0.3, 0.7),
    rx: 0.061 + Math.sin(stage * 0.22) * 0.008,
    ry: 0.118 + Math.cos(stage * 0.27) * 0.01,
    rotation: Math.sin(stage * 0.21) * 0.07
  };
}

function makeCreases(stage, memory, center) {
  let pivot = { x: center.x, y: center.y };
  let angle = Math.sin(stage * 0.25) * 0.08 - 0.14;
  let depth = 0.038;
  let span = 0.16;
  let pressure = 0;

  memory.forEach((fold, index) => {
    const age = 0.74 + index * 0.16;
    const signed = (fold.side || 1) * fold.weight * age;
    pivot.x += (fold.point.x - 0.5) * 0.32 * age;
    pivot.y += (fold.point.y - 0.5) * 0.24 * age;
    angle += signed * 0.16 + Math.sin(fold.phase + stage * 0.09) * 0.018;
    depth += Math.abs(fold.weight) * (0.026 + age * 0.006);
    span += 0.016 * age;
    pressure += Math.abs(signed);
  });

  const weight = memory.reduce((sum, fold, index) => sum + 0.74 + index * 0.16, 0);
  if (weight) {
    pivot.x = clamp(pivot.x / (1 + weight * 0.32), 0.32, 0.68);
    pivot.y = clamp(pivot.y / (1 + weight * 0.24), 0.3, 0.7);
  }

  return memory.map((fold, index) => ({
    id: `crease-${fold.id}`,
    source: fold.source,
    point: copyPoint(fold.point),
    pivot: {
      x: clamp(pivot.x + (fold.point.x - 0.5) * 0.06 + (index - memory.length / 2) * 0.008, 0.24, 0.76),
      y: clamp(pivot.y + (fold.point.y - 0.5) * 0.05, 0.24, 0.76)
    },
    angle: angle + index * 0.07,
    depth: clamp(depth + index * 0.008, 0.04, 0.22),
    span: clamp(span + index * 0.012, 0.14, 0.3),
    pressure,
    phase: fold.phase + stage * 0.13,
    side: fold.side || 1
  }));
}

function foldPoint(point, crease, stage, pointIndex) {
  const dx = point.x - crease.pivot.x;
  const dy = point.y - crease.pivot.y;
  const tangent = { x: Math.cos(crease.angle), y: Math.sin(crease.angle) };
  const normal = { x: -tangent.y, y: tangent.x };
  const along = dx * tangent.x + dy * tangent.y;
  const across = dx * normal.x + dy * normal.y;
  const proximity = Math.exp(-Math.pow(Math.abs(along) / Math.max(crease.span, 0.08), 2) - Math.pow(Math.abs(across) / 0.34, 2));
  const downstream = clamp((point.y - crease.pivot.y + 0.16) / 0.56, 0.08, 1);
  const foldProgress = proximity * downstream;
  const creaseDepth = crease.depth * (0.62 + downstream * 0.76) * foldProgress;
  const shimmer = Math.sin(pointIndex * 0.61 + crease.phase + stage * 0.11) * creaseDepth * 0.16;
  const reverseTangent = (crease.side || 1) * Math.sin(along / Math.max(crease.span, 0.08) * Math.PI) * creaseDepth * 0.34;

  return {
    x: clamp(point.x + normal.x * (creaseDepth + shimmer) + tangent.x * reverseTangent, 0.05, 0.95),
    y: clamp(point.y + normal.y * (creaseDepth + shimmer) + tangent.y * reverseTangent, 0.05, 0.95)
  };
}

function transformAperture(aperture, creases, stage) {
  let point = copyPoint(aperture);
  creases.forEach((crease, index) => {
    point = foldPoint(point, crease, stage, 60 + index);
  });
  return {
    x: point.x,
    y: point.y,
    rx: aperture.rx * (1 + creases.length * 0.045),
    ry: aperture.ry * (1 + creases.reduce((sum, crease) => sum + crease.depth, 0) * 0.4),
    rotation: aperture.rotation + creases.reduce((sum, crease) => sum + crease.angle * 0.08, 0)
  };
}

function makeFoldRoute(crease, stage, index) {
  const points = [];
  const tangent = { x: Math.cos(crease.angle), y: Math.sin(crease.angle) };
  const normal = { x: -tangent.y, y: tangent.x };
  const routeSpan = crease.span * (0.86 + index * 0.05);
  for (let pointIndex = 0; pointIndex < 14; pointIndex += 1) {
    const t = pointIndex / 13;
    const along = (t - 0.5) * routeSpan * 2;
    const arc = Math.sin(t * Math.PI);
    const cross = (crease.side || 1) * arc * crease.depth * (0.76 + index * 0.08);
    const tremor = Math.sin(stage * 0.17 + pointIndex * 0.7 + crease.phase) * 0.0035;
    points.push({
      x: clamp(crease.pivot.x + tangent.x * along + normal.x * (cross + tremor), 0.08, 0.92),
      y: clamp(crease.pivot.y + tangent.y * along + normal.y * (cross + tremor), 0.08, 0.92)
    });
  }
  return {
    id: `fold-route-${crease.id}`,
    source: crease.source,
    creaseId: crease.id,
    points,
    depth: crease.depth,
    side: crease.side
  };
}

function candidateFold(stage, contour) {
  const random = rng(SEED + stage * 12347 + 53);
  const index = (stage * 11 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `fold-${stage}`,
    source: 'renderer-fold',
    stage,
    index,
    point: {
      x: clamp(0.5 + (boundary.x - 0.5) * 0.52, 0.2, 0.8),
      y: clamp(0.5 + (boundary.y - 0.5) * 0.5, 0.22, 0.78)
    },
    side: boundary.x >= 0.5 ? 1 : -1,
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait folded its later contour around a remembered decision'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyFold).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const folds = makeCreases(safe, inherited, geometry.center);
  const foldedContour = geometry.points.map((point, index) => folds.reduce(
    (current, crease) => foldPoint(current, crease, safe, index),
    copyPoint(point)
  ));
  const foldedAperture = transformAperture(aperture, folds, safe);
  const foldRoutes = folds.map((crease, index) => makeFoldRoute(crease, safe, index));
  const fold = candidateFold(safe, geometry.points);

  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    folds,
    foldedContour,
    foldedAperture,
    foldRoutes,
    fold,
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
    if (frame.decided) memory = [...memory, frame.fold].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyFold(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.7, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.44, 0.16, 0.84)
  };
  const fold = {
    id: `visitor-fold-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-fold',
    stage: frame.stage,
    index: Math.round(bounded.x * 47),
    point: bounded,
    side: bounded.x >= 0.5 ? 1 : -1,
    weight: 1.3,
    phase: 0.37,
    reason: 'the visitor folded the portrait around a chosen decision'
  };
  const nextMemory = [...frame.memory, fold].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-fold',
    restoreMemory: frame.memory.map(copyFold)
  };
}

export function deleteLatestFold(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'fold-lifted' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'fold-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'fold-lifted' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.foldedContour ?? []),
    ...(frame.foldRoutes ?? []).flatMap((route) => route.points ?? [])
  ];
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...[frame.aperture, frame.foldedAperture].flatMap((shape) => Object.values(shape).map((value) => Number(value).toFixed(6))),
    ...(frame.folds ?? []).flatMap((crease) => [crease.pivot.x, crease.pivot.y, crease.angle, crease.depth, crease.span].map((value) => Number(value).toFixed(6)))
  ].join('|');
}
