export const SEED = 0x53505635;
export const STAGES = 11;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 38;

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
const copyDecision = (decision) => ({ ...decision, point: copyPoint(decision.point) });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function baseContour(stage) {
  const random = rng(SEED + stage * 7919);
  const center = {
    x: 0.5 + (random() - 0.5) * 0.014,
    y: 0.5 + (random() - 0.5) * 0.018
  };
  const points = [];
  const count = 42;

  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index / count * TAU;
    const breath = Math.sin(stage * 0.27 + angle * 2.3) * 0.014;
    const cheek = Math.cos(angle * 3.2 - stage * 0.19) * 0.018;
    const grain = (random() - 0.5) * 0.008;
    const shoulder = Math.max(0, Math.cos(angle + Math.PI / 2));
    const radius = 0.242 + breath + cheek + grain;
    points.push({
      x: clamp(center.x + Math.cos(angle) * radius * (1 + shoulder * 0.1), 0.09, 0.91),
      y: clamp(center.y + Math.sin(angle) * radius * (1.2 - Math.max(0, Math.sin(angle)) * 0.1), 0.08, 0.92)
    });
  }
  return { center, points };
}

function makeAperture(stage, center) {
  return {
    x: clamp(center.x + Math.sin(stage * 0.41) * 0.012, 0.33, 0.67),
    y: clamp(center.y + Math.cos(stage * 0.32) * 0.014, 0.3, 0.7),
    rx: 0.062 + Math.sin(stage * 0.23) * 0.008,
    ry: 0.12 + Math.cos(stage * 0.28) * 0.01,
    rotation: Math.sin(stage * 0.19) * 0.06
  };
}

function makeRegistration(stage, memory, center) {
  const registration = {
    pivot: { x: center.x, y: center.y },
    angle: Math.sin(stage * 0.29) * 0.012,
    offset: { x: 0.006 * Math.sin(stage * 0.37), y: 0.004 * Math.cos(stage * 0.31) },
    slip: 0.006,
    pressure: 0
  };

  if (!memory.length) return registration;

  let pivotWeight = 0;
  memory.forEach((decision, index) => {
    const age = 0.72 + index * 0.16;
    const signed = (decision.side || 1) * decision.weight * age;
    const local = 0.68 + clamp(decision.point.y, 0, 1) * 0.34;
    registration.angle += signed * 0.062 * local;
    registration.offset.x += signed * 0.016 + (decision.point.x - 0.5) * 0.018 * age;
    registration.offset.y += (decision.point.y - 0.5) * 0.012 * age;
    registration.slip += Math.abs(decision.weight) * 0.012 * age;
    registration.pressure += Math.abs(signed);
    registration.pivot.x += decision.point.x * age;
    registration.pivot.y += decision.point.y * age;
    pivotWeight += age;
  });

  registration.pivot.x = clamp(registration.pivot.x / (1 + pivotWeight), 0.29, 0.71);
  registration.pivot.y = clamp(registration.pivot.y / (1 + pivotWeight), 0.3, 0.7);
  registration.angle = clamp(registration.angle, -0.42, 0.42);
  registration.offset.x = clamp(registration.offset.x, -0.18, 0.18);
  registration.offset.y = clamp(registration.offset.y, -0.12, 0.12);
  registration.slip = clamp(registration.slip, 0.006, 0.13);
  return registration;
}

function transformPlate(point, registration, stage, index) {
  const dx = point.x - registration.pivot.x;
  const dy = point.y - registration.pivot.y;
  const downstream = clamp((point.y - registration.pivot.y + 0.26) / 0.62, 0.08, 1);
  const angle = registration.angle * (0.34 + downstream * 0.96);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const ripple = Math.sin(index * 0.47 + stage * 0.19) * registration.slip * downstream * 0.16;
  return {
    x: clamp(registration.pivot.x + dx * cos - dy * sin + registration.offset.x * downstream + ripple, 0.06, 0.94),
    y: clamp(registration.pivot.y + dx * sin + dy * cos + registration.offset.y * downstream, 0.06, 0.94)
  };
}

function transformAperture(aperture, registration, stage) {
  const point = transformPlate(aperture, registration, stage, 17);
  return {
    x: point.x,
    y: point.y,
    rx: aperture.rx * (1 + registration.pressure * 0.035),
    ry: aperture.ry * (1 + registration.pressure * 0.07),
    rotation: aperture.rotation + registration.angle * 0.86
  };
}

function makeContacts(contour, registeredContour, registration, stage) {
  const indices = [4, 11, 18, 25, 32, 39];
  return indices.map((index, routeIndex) => {
    const start = contour[index];
    const end = registeredContour[index];
    const bend = Math.sin(stage * 0.33 + routeIndex * 1.7) * (0.012 + registration.slip * 0.09);
    return Array.from({ length: 6 }, (_, pointIndex) => {
      const t = pointIndex / 5;
      return {
        x: clamp(start.x + (end.x - start.x) * t + Math.sin(t * Math.PI) * bend, 0.05, 0.95),
        y: clamp(start.y + (end.y - start.y) * t + Math.sin(t * Math.PI) * bend * 0.42, 0.05, 0.95)
      };
    });
  });
}

function candidateDecision(stage, contour) {
  const random = rng(SEED + stage * 12347 + 31);
  const index = (stage * 13 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `decision-${stage}`,
    source: 'renderer-decision',
    stage,
    index,
    point: {
      x: clamp(0.5 + (boundary.x - 0.5) * 0.5, 0.2, 0.8),
      y: clamp(0.5 + (boundary.y - 0.5) * 0.5, 0.24, 0.76)
    },
    side: boundary.x >= 0.5 ? 1 : -1,
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait exposed a second registration instead of one settled outline'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyDecision).slice(-MEMORY_LIMIT) : [];
  const geometry = baseContour(safe);
  const aperture = makeAperture(safe, geometry.center);
  const registration = makeRegistration(safe, inherited, geometry.center);
  const registeredContour = geometry.points.map((point, index) => transformPlate(point, registration, safe, index));
  const registeredAperture = transformAperture(aperture, registration, safe);
  const decision = candidateDecision(safe, geometry.points);

  return {
    stage: safe,
    contour: geometry.points,
    center: geometry.center,
    aperture,
    registration,
    registeredContour,
    registeredAperture,
    contacts: makeContacts(geometry.points, registeredContour, registration, safe),
    decision,
    decided: safe % 2 === 1,
    memory: inherited,
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const count = clamp(Math.floor(Number(stageCount) || 0), 0, STAGES);
  return Array.from({ length: count }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.decided) memory = [...memory, frame.decision].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyDecision(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.7, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.44, 0.16, 0.84)
  };
  const decision = {
    id: `visitor-decision-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-decision',
    stage: frame.stage,
    index: Math.round(bounded.x * 41),
    point: bounded,
    side: bounded.x >= 0.5 ? 1 : -1,
    weight: 1.28,
    phase: 0.41,
    reason: 'the visitor moved the portrait into a second registration'
  };
  const nextMemory = [...frame.memory, decision].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-decision',
    restoreMemory: frame.memory.map(copyDecision)
  };
}

export function deleteLatestDecision(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'decision-lifted' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'decision-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'decision-lifted' };
}

export function geometrySignature(frame) {
  const points = [
    ...(frame.contour ?? []),
    ...(frame.registeredContour ?? []),
    ...(frame.contacts ?? []).flat()
  ];
  return [
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...[frame.aperture, frame.registeredAperture].flatMap((shape) => Object.values(shape).map((value) => Number(value).toFixed(6))),
    frame.registration.angle.toFixed(6),
    frame.registration.offset.x.toFixed(6),
    frame.registration.offset.y.toFixed(6),
    frame.registration.slip.toFixed(6),
    frame.registration.pivot.x.toFixed(6),
    frame.registration.pivot.y.toFixed(6)
  ].join('|');
}
