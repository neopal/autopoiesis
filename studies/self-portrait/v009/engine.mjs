export const SEED = 0x53505639;
export const STAGES = 15;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 54;

const TAU = Math.PI * 2;
const CONTOUR_POINTS = 64;
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
const copySeam = (seam) => ({ ...seam, point: copyPoint(seam.point) });

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
    const breath = Math.sin(stage * 0.2 + angle * 2.2) * 0.015;
    const asymmetry = Math.cos(angle * 3.4 - stage * 0.15) * 0.017;
    const grain = (random() - 0.5) * 0.009;
    const shoulder = Math.max(0, Math.cos(angle + Math.PI / 2));
    const radius = 0.244 + breath + asymmetry + grain;
    points.push({
      x: clamp(center.x + Math.cos(angle) * radius * (1 + shoulder * 0.11), 0.07, 0.93),
      y: clamp(center.y + Math.sin(angle) * radius * (1.2 - Math.max(0, Math.sin(angle)) * 0.12), 0.07, 0.93)
    });
  }
  return { center, points };
}

function makeAperture(stage, center) {
  return {
    x: clamp(center.x + Math.sin(stage * 0.31) * 0.014, 0.33, 0.67),
    y: clamp(center.y + Math.cos(stage * 0.27) * 0.016, 0.3, 0.7),
    rx: 0.064 + Math.sin(stage * 0.2) * 0.007,
    ry: 0.11 + Math.cos(stage * 0.24) * 0.009,
    rotation: Math.sin(stage * 0.18) * 0.08,
    pupilX: center.x + Math.sin(stage * 0.22) * 0.006,
    pupilY: center.y + Math.cos(stage * 0.33) * 0.006
  };
}

function makeSeamedAperture(stage, memory, aperture) {
  let x = aperture.x;
  let y = aperture.y;
  let pupilX = aperture.pupilX;
  let pupilY = aperture.pupilY;
  let tension = 0;
  let rotation = aperture.rotation;

  memory.forEach((seam, index) => {
    const age = 0.82 + index * 0.12;
    const side = seam.point.x >= 0.5 ? -1 : 1;
    const pressure = Math.abs(seam.weight) * age;
    x += (0.5 - seam.point.x) * 0.075 * pressure;
    y += (seam.point.y - 0.5) * 0.035 * pressure;
    pupilX += (0.5 - seam.point.x) * 0.12 * pressure;
    pupilY += (seam.point.y - 0.5) * 0.06 * pressure;
    rotation += side * 0.028 * pressure;
    tension += pressure;
  });

  return {
    x: clamp(x, 0.25, 0.75),
    y: clamp(y, 0.25, 0.75),
    rx: aperture.rx * (1 + tension * 0.025),
    ry: aperture.ry * (1 - tension * 0.018),
    rotation,
    pupilX: clamp(pupilX, 0.12, 0.88),
    pupilY: clamp(pupilY, 0.12, 0.88)
  };
}

function deformContour(point, seam, entry, exit, stage, pointIndex, seamIndex) {
  const entryDx = point.x - entry.x;
  const entryDy = point.y - entry.y;
  const exitDx = point.x - exit.x;
  const exitDy = point.y - exit.y;
  const entryLocal = Math.exp(-(entryDx * entryDx + entryDy * entryDy) / 0.014);
  const exitLocal = Math.exp(-(exitDx * exitDx + exitDy * exitDy) / 0.014);
  const outward = seam.point.x >= 0.5 ? 1 : -1;
  const twist = Math.sin(pointIndex * 0.62 + seam.phase + stage * 0.12 + seamIndex) * 0.0045;
  const entryTug = seam.weight * entryLocal * (0.022 + Math.abs(entry.y - 0.5) * 0.03);
  const exitTug = seam.weight * exitLocal * (0.025 + Math.abs(exit.y - 0.5) * 0.028);

  return {
    x: clamp(point.x + outward * (entryTug - exitTug) + twist * (entryLocal + exitLocal), 0.045, 0.955),
    y: clamp(point.y + (entryTug + exitTug) * (seam.point.y - 0.5) * 0.8 + twist * (entryLocal - exitLocal), 0.045, 0.955)
  };
}

function routeThrough(entry, crossing, exit, count = 21) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    if (t <= 0.5) {
      const local = t * 2;
      const eased = local * local * (3 - 2 * local);
      return {
        x: entry.x + (crossing.x - entry.x) * eased,
        y: entry.y + (crossing.y - entry.y) * eased
      };
    }
    const local = (t - 0.5) * 2;
    const eased = local * local * (3 - 2 * local);
    return {
      x: crossing.x + (exit.x - crossing.x) * eased,
      y: crossing.y + (exit.y - crossing.y) * eased
    };
  });
}

function railsFor(thread, width) {
  return thread.map((point, index) => {
    const before = thread[Math.max(0, index - 1)];
    const after = thread[Math.min(thread.length - 1, index + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.max(Math.hypot(dx, dy), 0.0001);
    const normal = { x: -dy / length, y: dx / length };
    return {
      left: { x: clamp(point.x + normal.x * width, 0.03, 0.97), y: clamp(point.y + normal.y * width, 0.03, 0.97) },
      right: { x: clamp(point.x - normal.x * width, 0.03, 0.97), y: clamp(point.y - normal.y * width, 0.03, 0.97) }
    };
  });
}

function makeSeamRoutes(stage, memory, counterContour) {
  return memory.map((seam, seamIndex) => {
    const entryIndex = ((seam.index % counterContour.length) + counterContour.length) % counterContour.length;
    const exitIndex = (entryIndex + 18 + Math.floor(seam.point.y * 9) + seamIndex * 3) % counterContour.length;
    const entry = copyPoint(counterContour[entryIndex]);
    const exit = copyPoint(counterContour[exitIndex]);
    const crossing = {
      x: clamp(0.5 + (seam.point.x - 0.5) * 0.42 + Math.sin(seam.phase) * 0.025, 0.18, 0.82),
      y: clamp(0.5 + (seam.point.y - 0.5) * 0.42 + Math.cos(seam.phase) * 0.02, 0.2, 0.8)
    };
    const thread = routeThrough(entry, crossing, exit, 21);
    const rails = railsFor(thread, 0.0065 + Math.abs(seam.weight) * 0.0015);
    const separation = rails.reduce((maximum, pair, index) => {
      const other = thread[index];
      return Math.max(maximum, Math.max(distance(pair.left, other), distance(pair.right, other)));
    }, 0);

    return {
      id: `seam-route-${seam.id}`,
      source: seam.source,
      entryIndex,
      exitIndex,
      entry,
      crossing,
      exit,
      thread,
      leftRail: rails.map((pair) => pair.left),
      rightRail: rails.map((pair) => pair.right),
      separation,
      pressure: seam.weight,
      side: seam.point.x >= 0.5 ? 1 : -1
    };
  });
}

function candidateSeam(stage, contour) {
  const random = rng(SEED + stage * 12347 + 97);
  const index = (stage * 11 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `seam-${stage}`,
    source: 'renderer-seam',
    stage,
    index,
    point: {
      x: clamp(0.5 + (boundary.x - 0.5) * 0.58, 0.18, 0.82),
      y: clamp(0.5 + (boundary.y - 0.5) * 0.56, 0.2, 0.8)
    },
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait kept a seam where its decision crossed the body'
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copySeam).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const counterAperture = makeSeamedAperture(safe, inherited, aperture);
  const entryIndexes = inherited.map((seam, seamIndex) => ((seam.index % CONTOUR_POINTS) + CONTOUR_POINTS + seamIndex * 3) % CONTOUR_POINTS);
  const exitIndexes = inherited.map((seam, seamIndex) => (entryIndexes[seamIndex] + 18 + Math.floor(seam.point.y * 9) + seamIndex * 3) % CONTOUR_POINTS);
  const counterContour = geometry.points.map((point, pointIndex) => inherited.reduce(
    (current, seam, seamIndex) => deformContour(current, seam, geometry.points[entryIndexes[seamIndex]], geometry.points[exitIndexes[seamIndex]], safe, pointIndex, seamIndex),
    copyPoint(point)
  ));
  const seamRoutes = makeSeamRoutes(safe, inherited, counterContour);
  const seam = candidateSeam(safe, geometry.points);

  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    counterAperture,
    counterContour,
    seamRoutes,
    seam,
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
    if (frame.decided) memory = [...memory, frame.seam].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applySeam(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.72, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.44, 0.16, 0.84)
  };
  const seam = {
    id: `visitor-seam-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-seam',
    stage: frame.stage,
    index: Math.round((bounded.x * 0.65 + bounded.y * 0.35) * (CONTOUR_POINTS - 1)),
    point: bounded,
    weight: 1.3,
    phase: 0.61,
    reason: 'the visitor threaded a decision through the portrait'
  };
  const nextMemory = [...frame.memory, seam].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-seam',
    restoreMemory: frame.memory.map(copySeam)
  };
}

export function deleteLatestSeam(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'seam-returned' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'seam-returned' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'seam-returned' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.counterContour ?? []),
    ...(frame.seamRoutes ?? []).flatMap((route) => [
      ...(route.thread ?? []),
      ...(route.leftRail ?? []),
      ...(route.rightRail ?? [])
    ])
  ];
  const shapes = [frame.aperture, frame.counterAperture].flatMap((shape) => Object.values(shape ?? {}));
  const routeMeta = (frame.seamRoutes ?? []).flatMap((route) => [
    route.entryIndex, route.exitIndex, route.side, route.pressure, route.crossing?.x, route.crossing?.y
  ]);
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...shapes.map((value) => Number(value).toFixed(6)),
    ...routeMeta.map((value) => Number(value).toFixed(6))
  ].join('|');
}
