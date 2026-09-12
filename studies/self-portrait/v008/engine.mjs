export const SEED = 0x53505638;
export const STAGES = 14;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 50;

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
const copyBlind = (blind) => ({ ...blind, point: copyPoint(blind.point) });

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
  const count = 56;

  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index / count * TAU;
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

function makeBlindAperture(stage, memory, aperture) {
  let x = aperture.x;
  let y = aperture.y;
  let pupilX = aperture.pupilX;
  let pupilY = aperture.pupilY;
  let pressure = 0;

  memory.forEach((blind, index) => {
    const age = 0.78 + index * 0.15;
    const awayX = 0.5 - blind.point.x;
    const awayY = blind.point.y - 0.5;
    x += awayX * 0.1 * age;
    y += awayY * 0.04 * age;
    pupilX += awayX * 0.15 * age;
    pupilY += awayY * 0.075 * age;
    pressure += Math.abs(blind.weight) * age;
  });

  return {
    x: clamp(x, 0.25, 0.75),
    y: clamp(y, 0.25, 0.75),
    rx: aperture.rx * (1 + pressure * 0.035),
    ry: aperture.ry * (1 - pressure * 0.025),
    rotation: aperture.rotation + memory.reduce((sum, blind) => sum + (0.5 - blind.point.x) * 0.1, 0),
    pupilX: clamp(pupilX, 0.12, 0.88),
    pupilY: clamp(pupilY, 0.12, 0.88)
  };
}

function deformContour(point, blind, stage, pointIndex, blindIndex) {
  const dx = point.x - blind.point.x;
  const dy = point.y - blind.point.y;
  const local = Math.exp(-Math.pow(dx / 0.15, 2) - Math.pow(dy / 0.2, 2));
  const downstream = clamp((point.y - blind.point.y + 0.2) / 0.62, 0.08, 1);
  const outward = blind.point.x >= 0.5 ? -1 : 1;
  const pressure = blind.weight * (0.58 + downstream * 0.8) * local;
  const ripple = Math.sin(pointIndex * 0.62 + blind.phase + stage * 0.12) * 0.0045 * local;
  const lift = Math.cos(pointIndex * 0.25 + blindIndex * 1.4 + stage * 0.09) * 0.004 * pressure;

  return {
    x: clamp(point.x + outward * pressure * 0.062 + ripple, 0.045, 0.955),
    y: clamp(point.y + lift + (blind.point.y - 0.5) * pressure * 0.058, 0.045, 0.955)
  };
}

function routePoints(start, end, bendX, bendY, count = 12) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const arc = Math.sin(t * Math.PI);
    return {
      x: clamp(start.x + (end.x - start.x) * t + bendX * arc, 0.04, 0.96),
      y: clamp(start.y + (end.y - start.y) * t + bendY * arc, 0.04, 0.96)
    };
  });
}

function makeBlindRoutes(stage, memory, counterContour) {
  return memory.map((blind, blindIndex) => {
    const anchorIndex = ((blind.index % counterContour.length) + counterContour.length) % counterContour.length;
    const entry = counterContour[(anchorIndex + counterContour.length - 5) % counterContour.length];
    const exit = counterContour[(anchorIndex + 9) % counterContour.length];
    const direction = blind.point.x >= 0.5 ? -1 : 1;
    const center = {
      x: clamp(blind.point.x + direction * 0.018, 0.08, 0.92),
      y: clamp(blind.point.y, 0.14, 0.86)
    };
    const aperture = {
      rx: 0.035 + Math.abs(blind.weight) * 0.008,
      ry: 0.06 + Math.abs(blind.weight) * 0.011
    };
    const upperLip = routePoints(entry, exit, direction * 0.012, -aperture.ry * 1.45, 13);
    const lowerLip = routePoints(entry, exit, direction * -0.012, aperture.ry * 1.45, 13);
    const returnTarget = {
      x: clamp(0.5 + (exit.x - 0.5) * 0.42 + direction * 0.08, 0.08, 0.92),
      y: clamp(0.5 + (exit.y - 0.5) * 0.4, 0.1, 0.9)
    };
    const returnRoute = routePoints(center, returnTarget, -direction * 0.055, (blind.point.y - 0.5) * 0.08, 16);
    const separation = upperLip.reduce((maximum, point, index) => {
      const other = lowerLip[index];
      return Math.max(maximum, Math.hypot(point.x - other.x, point.y - other.y));
    }, 0);

    return {
      id: `blind-route-${blind.id}`,
      source: blind.source,
      anchorIndex,
      rejoinIndex: anchorIndex + 14,
      separation,
      center,
      aperture,
      upperLip,
      lowerLip,
      returnRoute,
      pressure: blind.weight,
      side: direction
    };
  });
}

function candidateBlindSpot(stage, contour) {
  const random = rng(SEED + stage * 12347 + 97);
  const index = (stage * 11 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `blind-${stage}`,
    source: 'renderer-blind-spot',
    stage,
    index,
    point: {
      x: clamp(0.5 + (boundary.x - 0.5) * 0.58, 0.18, 0.82),
      y: clamp(0.5 + (boundary.y - 0.5) * 0.56, 0.2, 0.8)
    },
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait kept a blind spot where its decision should have been'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyBlind).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const counterAperture = makeBlindAperture(safe, inherited, aperture);
  const counterContour = geometry.points.map((point, pointIndex) => inherited.reduce(
    (current, blind, blindIndex) => deformContour(current, blind, safe, pointIndex, blindIndex),
    copyPoint(point)
  ));
  const blindRoutes = makeBlindRoutes(safe, inherited, counterContour);
  const blindSpot = candidateBlindSpot(safe, geometry.points);

  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    counterAperture,
    counterContour,
    blindRoutes,
    blindSpot,
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
    if (frame.decided) memory = [...memory, frame.blindSpot].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyBlindSpot(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.72, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.44, 0.16, 0.84)
  };
  const blind = {
    id: `visitor-blind-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-blind-spot',
    stage: frame.stage,
    index: Math.round(bounded.x * 55),
    point: bounded,
    weight: 1.3,
    phase: 0.61,
    reason: 'the visitor gave the portrait a blind spot around its decision'
  };
  const nextMemory = [...frame.memory, blind].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-blind-spot',
    restoreMemory: frame.memory.map(copyBlind)
  };
}

export function deleteLatestBlindSpot(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'blind-spot-returned' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'blind-spot-returned' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'blind-spot-returned' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.counterContour ?? []),
    ...(frame.blindRoutes ?? []).flatMap((route) => [
      ...(route.upperLip ?? []),
      ...(route.lowerLip ?? []),
      ...(route.returnRoute ?? [])
    ])
  ];
  const shapes = [frame.aperture, frame.counterAperture].flatMap((shape) => Object.values(shape ?? {}));
  const routeMeta = (frame.blindRoutes ?? []).flatMap((route) => [
    route.anchorIndex, route.side, route.pressure, route.center?.x, route.center?.y
  ]);
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...shapes.map((value) => Number(value).toFixed(6)),
    ...routeMeta.map((value) => Number(value).toFixed(6))
  ].join('|');
}
