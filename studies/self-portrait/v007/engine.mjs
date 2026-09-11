export const SEED = 0x53505637;
export const STAGES = 13;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 46;

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
const copyGaze = (gaze) => ({ ...gaze, point: copyPoint(gaze.point) });

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
  const count = 52;

  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index / count * TAU;
    const breath = Math.sin(stage * 0.22 + angle * 2.1) * 0.015;
    const asymmetry = Math.cos(angle * 3.7 - stage * 0.16) * 0.017;
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

function makeGazeAperture(stage, memory, aperture) {
  let x = aperture.x;
  let y = aperture.y;
  let pupilX = aperture.pupilX;
  let pupilY = aperture.pupilY;
  let pressure = 0;

  memory.forEach((gaze, index) => {
    const age = 0.78 + index * 0.15;
    const awayX = 0.5 - gaze.point.x;
    const awayY = gaze.point.y - 0.5;
    x += awayX * 0.12 * age;
    y += awayY * 0.045 * age;
    pupilX += awayX * 0.19 * age;
    pupilY += awayY * 0.09 * age;
    pressure += Math.abs(gaze.weight) * age;
  });

  return {
    x: clamp(x, 0.25, 0.75),
    y: clamp(y, 0.25, 0.75),
    rx: aperture.rx * (1 + pressure * 0.045),
    ry: aperture.ry * (1 + pressure * 0.06),
    rotation: aperture.rotation + memory.reduce((sum, gaze) => sum + (0.5 - gaze.point.x) * 0.12, 0),
    pupilX: clamp(pupilX, 0.12, 0.88),
    pupilY: clamp(pupilY, 0.12, 0.88)
  };
}

function deformContour(point, gaze, stage, pointIndex, gazeIndex) {
  const dx = point.x - gaze.point.x;
  const dy = point.y - gaze.point.y;
  const local = Math.exp(-Math.pow(dx / 0.17, 2) - Math.pow(dy / 0.22, 2));
  const downstream = clamp((point.y - gaze.point.y + 0.18) / 0.58, 0.08, 1);
  const away = gaze.point.x >= 0.5 ? -1 : 1;
  const pressure = gaze.weight * (0.56 + downstream * 0.76) * local;
  const wave = Math.sin(pointIndex * 0.58 + gaze.phase + stage * 0.13) * 0.005 * local;
  const vertical = Math.cos(pointIndex * 0.24 + gazeIndex * 1.7 + stage * 0.08) * 0.004 * pressure;

  return {
    x: clamp(point.x + away * pressure * 0.06 + wave, 0.045, 0.955),
    y: clamp(point.y + vertical + (gaze.point.y - 0.5) * pressure * 0.06, 0.045, 0.955)
  };
}

function makeGazeRoutes(stage, memory, aperture, counterAperture, contour) {
  return memory.map((gaze, gazeIndex) => {
    const targetIndex = Math.round(gaze.point.x * (contour.length - 1) + gazeIndex * 5) % contour.length;
    const target = contour[targetIndex];
    const start = { x: counterAperture.x, y: counterAperture.y };
    const targetPoint = {
      x: clamp(0.5 + (target.x - 0.5) * 0.82 + (0.5 - gaze.point.x) * 0.14, 0.08, 0.92),
      y: clamp(0.5 + (target.y - 0.5) * 0.78 + (gaze.point.y - 0.5) * 0.1, 0.08, 0.92)
    };
    const away = gaze.point.x >= 0.5 ? -1 : 1;
    const curve = away * (0.04 + Math.abs(gaze.point.x - 0.5) * 0.1);
    const points = [];

    for (let pointIndex = 0; pointIndex < 16; pointIndex += 1) {
      const t = pointIndex / 15;
      const arc = Math.sin(t * Math.PI);
      const drift = Math.sin(stage * 0.17 + pointIndex * 0.68 + gaze.phase) * 0.003;
      points.push({
        x: clamp(start.x + (targetPoint.x - start.x) * t + curve * arc + drift, 0.06, 0.94),
        y: clamp(start.y + (targetPoint.y - start.y) * t + (gaze.point.y - 0.5) * 0.04 * arc + drift * 0.5, 0.06, 0.94)
      });
    }

    return {
      id: `gaze-route-${gaze.id}`,
      source: gaze.source,
      targetIndex,
      points,
      side: away,
      pressure: gaze.weight
    };
  });
}

function candidateCounterGaze(stage, contour) {
  const random = rng(SEED + stage * 12347 + 71);
  const index = (stage * 9 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `gaze-${stage}`,
    source: 'renderer-counter-gaze',
    stage,
    index,
    point: {
      x: clamp(0.5 + (boundary.x - 0.5) * 0.56, 0.18, 0.82),
      y: clamp(0.5 + (boundary.y - 0.5) * 0.54, 0.2, 0.8)
    },
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait looked away from the decision it had just made'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyGaze).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const counterAperture = makeGazeAperture(safe, inherited, aperture);
  const counterContour = geometry.points.map((point, pointIndex) => inherited.reduce(
    (current, gaze, gazeIndex) => deformContour(current, gaze, safe, pointIndex, gazeIndex),
    copyPoint(point)
  ));
  const gazeRoutes = makeGazeRoutes(safe, inherited, aperture, counterAperture, counterContour);
  const gaze = candidateCounterGaze(safe, geometry.points);

  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    counterAperture,
    counterContour,
    gazeRoutes,
    gaze,
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
    if (frame.decided) memory = [...memory, frame.gaze].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyCounterGaze(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.72, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.44, 0.16, 0.84)
  };
  const gaze = {
    id: `visitor-gaze-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-counter-gaze',
    stage: frame.stage,
    index: Math.round(bounded.x * 51),
    point: bounded,
    weight: 1.25,
    phase: 0.43,
    reason: 'the visitor made the portrait look away from a chosen decision'
  };
  const nextMemory = [...frame.memory, gaze].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-counter-gaze',
    restoreMemory: frame.memory.map(copyGaze)
  };
}

export function deleteLatestCounterGaze(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'gaze-returned' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'gaze-returned' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'gaze-returned' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.counterContour ?? []),
    ...(frame.gazeRoutes ?? []).flatMap((route) => route.points ?? [])
  ];
  const shapes = [frame.aperture, frame.counterAperture].flatMap((shape) => Object.values(shape ?? {}));
  const routeMeta = (frame.gazeRoutes ?? []).flatMap((route) => [route.targetIndex, route.side, route.pressure]);
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...shapes.map((value) => Number(value).toFixed(6)),
    ...routeMeta.map((value) => Number(value).toFixed(6))
  ].join('|');
}
