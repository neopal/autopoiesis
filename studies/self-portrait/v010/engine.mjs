export const SEED = 0x53505640;
export const STAGES = 16;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 62;

const TAU = Math.PI * 2;
const CONTOUR_POINTS = 72;
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
const copyFork = (fork) => ({ ...fork, point: copyPoint(fork.point) });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function baseContour(stage) {
  const random = rng(SEED + stage * 7919);
  const center = {
    x: 0.5 + (random() - 0.5) * 0.018,
    y: 0.5 + (random() - 0.5) * 0.018
  };
  const points = [];

  for (let index = 0; index < CONTOUR_POINTS; index += 1) {
    const angle = -Math.PI / 2 + index / CONTOUR_POINTS * TAU;
    const breath = Math.sin(stage * 0.18 + angle * 2.3) * 0.014;
    const asymmetry = Math.cos(angle * 3.1 - stage * 0.17) * 0.018;
    const grain = (random() - 0.5) * 0.009;
    const shoulder = Math.max(0, Math.cos(angle + Math.PI / 2));
    const jaw = Math.max(0, Math.sin(angle));
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

function makeForkedAperture(stage, memory, aperture) {
  let x = aperture.x;
  let y = aperture.y;
  let pupilX = aperture.pupilX;
  let pupilY = aperture.pupilY;
  let pressure = 0;
  let rotation = aperture.rotation;

  memory.forEach((fork, index) => {
    const age = 0.78 + index * 0.14;
    const horizontal = fork.point.x - 0.5;
    const vertical = fork.point.y - 0.5;
    x += horizontal * 0.055 * age;
    y += vertical * 0.035 * age;
    pupilX += horizontal * 0.12 * age;
    pupilY += vertical * 0.075 * age;
    rotation += (horizontal >= 0 ? -1 : 1) * 0.026 * age;
    pressure += Math.abs(fork.weight) * age;
  });

  return {
    x: clamp(x, 0.25, 0.75),
    y: clamp(y, 0.25, 0.75),
    rx: aperture.rx * (1 + pressure * 0.028),
    ry: aperture.ry * (1 - pressure * 0.022),
    rotation,
    pupilX: clamp(pupilX, 0.12, 0.88),
    pupilY: clamp(pupilY, 0.12, 0.88)
  };
}

function anchorIndexes(fork, forkIndex, length) {
  const root = ((fork.index % length) + length) % length;
  const leftAnchorIndex = (root + 11 + forkIndex * 5) % length;
  const rightAnchorIndex = (root + 35 + forkIndex * 7) % length;
  const resolutionIndex = (Math.floor(length * 0.5) + Math.round((fork.point.x - 0.5) * 12) + forkIndex * 3 + length) % length;
  return { leftAnchorIndex, rightAnchorIndex, resolutionIndex };
}

function deformContour(point, fork, leftAnchor, rightAnchor, resolution, stage, pointIndex, forkIndex) {
  const leftDx = point.x - leftAnchor.x;
  const leftDy = point.y - leftAnchor.y;
  const rightDx = point.x - rightAnchor.x;
  const rightDy = point.y - rightAnchor.y;
  const resolveDx = point.x - resolution.x;
  const resolveDy = point.y - resolution.y;
  const leftLocal = Math.exp(-(leftDx * leftDx + leftDy * leftDy) / 0.014);
  const rightLocal = Math.exp(-(rightDx * rightDx + rightDy * rightDy) / 0.014);
  const resolveLocal = Math.exp(-(resolveDx * resolveDx + resolveDy * resolveDy) / 0.024);
  const side = fork.point.x >= 0.5 ? -1 : 1;
  const pressure = fork.weight * (0.72 + Math.max(0, point.y - 0.35) * 0.6);
  const shimmer = Math.sin(pointIndex * 0.57 + fork.phase + stage * 0.11 + forkIndex) * 0.0048;
  const leftTug = pressure * leftLocal;
  const rightTug = pressure * rightLocal;
  const resolveTug = pressure * 0.38 * resolveLocal;

  return {
    x: clamp(point.x + side * (leftTug * 0.047 - rightTug * 0.035) - side * resolveTug * 0.028 + shimmer * (leftLocal + rightLocal), 0.045, 0.955),
    y: clamp(point.y + (leftTug - rightTug) * 0.026 + resolveTug * 0.034 + shimmer * (leftLocal - rightLocal), 0.045, 0.955)
  };
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

function routeVia(start, waypoint, end, count = 21) {
  const firstCount = Math.ceil(count / 2);
  const secondCount = count - firstCount + 1;
  const first = routeCurve(start, {
    x: (start.x + waypoint.x) / 2,
    y: (start.y + waypoint.y) / 2
  }, waypoint, firstCount);
  const second = routeCurve(waypoint, {
    x: (waypoint.x + end.x) / 2,
    y: (waypoint.y + end.y) / 2
  }, end, secondCount);
  return [...first, ...second.slice(1)];
}

function makeForkRoutes(stage, memory, counterContour, counterAperture) {
  return memory.map((fork, forkIndex) => {
    const { leftAnchorIndex, rightAnchorIndex, resolutionIndex } = anchorIndexes(fork, forkIndex, counterContour.length);
    const leftAnchor = copyPoint(counterContour[leftAnchorIndex]);
    const rightAnchor = copyPoint(counterContour[rightAnchorIndex]);
    const resolutionTarget = copyPoint(counterContour[resolutionIndex]);
    const side = fork.point.x >= 0.5 ? -1 : 1;
    const split = {
      x: clamp(0.5 + (fork.point.x - 0.5) * 0.18 + Math.sin(fork.phase) * 0.018, 0.28, 0.72),
      y: clamp(0.49 + (fork.point.y - 0.5) * 0.24, 0.34, 0.66)
    };
    const merge = {
      x: clamp(0.5 + (fork.point.x - 0.5) * 0.12, 0.35, 0.65),
      y: clamp(0.69 + (fork.point.y - 0.5) * 0.08, 0.58, 0.8)
    };
    const leftWaypoint = {
      x: clamp(split.x - 0.12 - side * 0.018, 0.12, 0.88),
      y: clamp(split.y + 0.08 + (fork.point.y - 0.5) * 0.06, 0.22, 0.78)
    };
    const rightWaypoint = {
      x: clamp(split.x + 0.12 - side * 0.018, 0.12, 0.88),
      y: clamp(split.y + 0.095 - (fork.point.y - 0.5) * 0.05, 0.22, 0.8)
    };
    const origin = { x: counterAperture.pupilX, y: counterAperture.pupilY };
    const trunk = routeCurve(origin, {
      x: split.x + side * 0.02,
      y: (origin.y + split.y) / 2
    }, split, 15);
    const branches = [
      routeVia(split, leftWaypoint, merge, 21),
      routeVia(split, rightWaypoint, merge, 21)
    ];
    const resolution = routeCurve(merge, {
      x: (merge.x + resolutionTarget.x) / 2 + side * 0.035,
      y: merge.y + 0.045
    }, resolutionTarget, 13);
    const branchSeparation = branches[0].reduce((maximum, point, index) => {
      const other = branches[1][index];
      return Math.max(maximum, Math.hypot(point.x - other.x, point.y - other.y));
    }, 0);

    return {
      id: `fork-route-${fork.id}`,
      source: fork.source,
      leftAnchorIndex,
      rightAnchorIndex,
      resolutionIndex,
      leftAnchor,
      rightAnchor,
      resolutionTarget,
      origin,
      split,
      merge,
      leftWaypoint,
      rightWaypoint,
      trunk,
      branches,
      resolution,
      branchSeparation,
      pressure: fork.weight,
      side
    };
  });
}

function candidateFork(stage, contour) {
  const random = rng(SEED + stage * 12347 + 131);
  const index = (stage * 13 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `fork-${stage}`,
    source: 'renderer-fork',
    stage,
    index,
    point: {
      x: clamp(0.5 + (boundary.x - 0.5) * 0.6, 0.18, 0.82),
      y: clamp(0.5 + (boundary.y - 0.5) * 0.58, 0.2, 0.8)
    },
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait kept two possible routes after its decision'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyFork).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const counterAperture = makeForkedAperture(safe, inherited, aperture);
  const counterContour = geometry.points.map((point, pointIndex) => inherited.reduce((current, fork, forkIndex) => {
    const indexes = anchorIndexes(fork, forkIndex, geometry.points.length);
    return deformContour(current, fork, geometry.points[indexes.leftAnchorIndex], geometry.points[indexes.rightAnchorIndex], geometry.points[indexes.resolutionIndex], safe, pointIndex, forkIndex);
  }, copyPoint(point)));
  const forkRoutes = makeForkRoutes(safe, inherited, counterContour, counterAperture);
  const fork = candidateFork(safe, geometry.points);

  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    counterAperture,
    counterContour,
    forkRoutes,
    fork,
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
    if (frame.decided) memory = [...memory, frame.fork].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyFork(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.72, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.44, 0.16, 0.84)
  };
  const fork = {
    id: `visitor-fork-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-fork',
    stage: frame.stage,
    index: Math.round((bounded.x * 0.65 + bounded.y * 0.35) * (CONTOUR_POINTS - 1)),
    point: bounded,
    weight: 1.34,
    phase: 0.49,
    reason: 'the visitor split the portrait into two possible routes'
  };
  const nextMemory = [...frame.memory, fork].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-fork',
    restoreMemory: frame.memory.map(copyFork)
  };
}

export function deleteLatestFork(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'fork-returned' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'fork-returned' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'fork-returned' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.counterContour ?? []),
    ...(frame.forkRoutes ?? []).flatMap((route) => [
      ...(route.trunk ?? []),
      ...(route.branches ?? []).flat(),
      ...(route.resolution ?? [])
    ])
  ];
  const shapes = [frame.aperture, frame.counterAperture].flatMap((shape) => Object.values(shape ?? {}));
  const routeMeta = (frame.forkRoutes ?? []).flatMap((route) => [
    route.leftAnchorIndex, route.rightAnchorIndex, route.resolutionIndex, route.pressure,
    route.split?.x, route.split?.y, route.merge?.x, route.merge?.y, route.branchSeparation
  ]);
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...shapes.map((value) => Number(value).toFixed(6)),
    ...routeMeta.map((value) => Number(value).toFixed(6))
  ].join('|');
}
