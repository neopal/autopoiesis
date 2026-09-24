export const SEED = 0x53504631;
export const STAGES = 14;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 63;

const TAU = Math.PI * 2;
const POINT_COUNT = 72;
const SECTOR_COUNT = 24;
const FIBER_COUNT = 13;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyPoints = (points = []) => points.map(copyPoint);
const copyEvent = (event) => ({ ...event, point: copyPoint(event.point) });
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function boundedPoint(point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  return {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.72, 0.14, 0.86),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.34, 0.16, 0.84)
  };
}

function boundedPressure(value) {
  const raw = Number(value);
  return clamp(Number.isFinite(raw) && raw > 0 ? raw : 0.82, 0.35, 1);
}

function makeOutline(stage) {
  const random = rng(SEED + stage * 7919);
  const center = {
    x: 0.5 + (random() - 0.5) * 0.012,
    y: 0.51 + (random() - 0.5) * 0.014
  };
  return Array.from({ length: POINT_COUNT }, (_, index) => {
    const angle = -Math.PI / 2 + index / POINT_COUNT * TAU;
    const breath = Math.sin(stage * 0.21 + angle * 2.4) * 0.012;
    const asymmetry = Math.cos(angle * 3.2 - stage * 0.13) * 0.015;
    const grain = (random() - 0.5) * 0.008;
    const rx = 0.255 + breath + asymmetry + grain;
    const ry = 0.372 + Math.sin(angle * 2 + stage * 0.17) * 0.016 + grain * 0.5;
    return {
      x: clamp(center.x + Math.cos(angle) * rx, 0.06, 0.94),
      y: clamp(center.y + Math.sin(angle) * ry, 0.06, 0.94)
    };
  });
}

function makeAperture(stage) {
  const center = { x: 0.5 + Math.sin(stage * 0.27) * 0.012, y: 0.5 + Math.cos(stage * 0.19) * 0.018 };
  return Array.from({ length: 28 }, (_, index) => {
    const angle = index / 28 * TAU;
    const radiusX = 0.052 + Math.sin(stage * 0.2) * 0.006;
    const radiusY = 0.13 + Math.cos(stage * 0.17) * 0.009;
    return {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY
    };
  });
}

function makeFiber(stage, index) {
  const random = rng(SEED + stage * 179 + index * 991);
  const side = index % 2 === 0 ? -1 : 1;
  const baseX = 0.28 + (index % 7) * 0.036;
  const lean = (random() - 0.5) * 0.06;
  return Array.from({ length: 17 }, (_, step) => {
    const t = step / 16;
    return {
      x: clamp(baseX + Math.sin(t * Math.PI * (1.2 + index % 3) + stage * 0.11) * (0.035 + index * 0.001) + lean * t, 0.08, 0.92),
      y: clamp(0.18 + t * 0.64 + Math.sin(t * TAU + index * 0.47 + stage * 0.14) * 0.022 * side, 0.08, 0.92)
    };
  });
}

function makeGrain(stage) {
  const random = rng(SEED + stage * 31337);
  return Array.from({ length: 260 }, () => {
    const angle = random() * TAU;
    const radius = Math.sqrt(random());
    return {
      x: 0.5 + Math.cos(angle) * radius * 0.25,
      y: 0.51 + Math.sin(angle) * radius * 0.36,
      alpha: 0.08 + random() * 0.28,
      size: 0.00045 + random() * 0.0014
    };
  });
}

function baseMembrane(stage) {
  return {
    outline: makeOutline(stage),
    aperture: makeAperture(stage),
    fibers: Array.from({ length: FIBER_COUNT }, (_, index) => makeFiber(stage, index)),
    grain: makeGrain(stage),
    resistance: Array.from({ length: SECTOR_COUNT }, (_, index) => 0.18 + ((index * 17 + stage * 5) % 11) / 100)
  };
}

function cloneMembrane(membrane) {
  return {
    outline: copyPoints(membrane.outline),
    aperture: copyPoints(membrane.aperture),
    fibers: membrane.fibers.map(copyPoints),
    grain: membrane.grain.map((grain) => ({ ...grain })),
    resistance: [...membrane.resistance]
  };
}

function sectorFor(point) {
  const angle = Math.atan2(point.y - 0.51, point.x - 0.5);
  return Math.floor(((angle + Math.PI) / TAU) * SECTOR_COUNT) % SECTOR_COUNT;
}

function localResistance(resistance, sector) {
  const sample = [-1, 0, 1].map((offset) => resistance[(sector + offset + SECTOR_COUNT) % SECTOR_COUNT]);
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function deformPoint(point, event, yieldAmount, stage, index) {
  const dx = point.x - event.point.x;
  const dy = point.y - event.point.y;
  const distance = Math.max(0.012, Math.hypot(dx, dy));
  const falloff = Math.exp(-(distance * distance) / (0.05 + yieldAmount * 0.016));
  const angle = Math.atan2(event.point.y - 0.51, event.point.x - 0.5);
  const radial = { x: Math.cos(angle), y: Math.sin(angle) };
  const tangent = { x: -radial.y, y: radial.x };
  const wobble = Math.sin(index * 0.57 + stage * 0.19 + event.phase) * 0.004 * falloff;
  return {
    x: clamp(point.x + radial.x * yieldAmount * 0.052 * falloff + tangent.x * wobble, 0.035, 0.965),
    y: clamp(point.y + radial.y * yieldAmount * 0.052 * falloff + tangent.y * wobble, 0.035, 0.965)
  };
}

function tearGeometry(event, yieldAmount, eventIndex) {
  const angle = Math.atan2(event.point.y - 0.51, event.point.x - 0.5) + Math.PI / 2;
  const tangent = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -tangent.y, y: tangent.x };
  const width = 0.022 + yieldAmount * 0.018;
  const length = 0.075 + yieldAmount * 0.07;
  const center = event.point;
  const along = (distance, side = 1) => ({
    x: center.x + normal.x * distance + tangent.x * side * width,
    y: center.y + normal.y * distance + tangent.y * side * width
  });
  const gap = [along(-length * 0.55, -1), along(-length * 0.1, -1), along(length * 0.62, -0.72), along(length * 0.7, 0.72), along(-length * 0.1, 1), along(-length * 0.55, 1)];
  const bankA = [along(-length * 0.58, -1.12), along(-length * 0.08, -1.1), along(length * 0.72, -0.8)];
  const bankB = [along(length * 0.72, 0.8), along(-length * 0.08, 1.1), along(-length * 0.58, 1.12)];
  const lift = 0.052 + yieldAmount * 0.05;
  const flap = [
    { x: gap[2].x + normal.x * lift, y: gap[2].y + normal.y * lift },
    { x: gap[3].x + normal.x * lift * 1.16, y: gap[3].y + normal.y * lift * 1.16 },
    { x: gap[3].x + tangent.x * width * 1.6 + normal.x * lift * 0.62, y: gap[3].y + tangent.y * width * 1.6 + normal.y * lift * 0.62 },
    { x: gap[2].x + tangent.x * width * 1.45 + normal.x * lift * 0.62, y: gap[2].y + tangent.y * width * 1.45 + normal.y * lift * 0.62 }
  ];
  return {
    kind: 'pressure-scar',
    id: `scar-${event.stage}-${eventIndex + 1}`,
    point: copyPoint(event.point),
    sector: event.sector,
    pressure: event.pressure,
    resistanceBefore: event.resistanceBefore,
    resistanceAfter: event.resistanceAfter,
    yield: yieldAmount,
    gap,
    bankA,
    bankB,
    flap,
    gapSignature: gap.map((point) => `${point.x.toFixed(5)},${point.y.toFixed(5)}`).join('|')
  };
}

function applyPressure(membrane, event, eventIndex) {
  const next = cloneMembrane(membrane);
  const sector = sectorFor(event.point);
  const resistanceBefore = localResistance(next.resistance, sector);
  const yieldAmount = event.pressure * (0.68 + (1 - resistanceBefore) * 0.58);
  const resistanceAfter = clamp(resistanceBefore + event.pressure * 0.24, 0, 1);
  event.sector = sector;
  event.resistanceBefore = resistanceBefore;
  event.resistanceAfter = resistanceAfter;
  event.phase = (event.stage * 0.73 + eventIndex * 1.17 + sector * 0.19) % TAU;

  next.outline = next.outline.map((point, index) => deformPoint(point, event, yieldAmount, event.stage, index));
  next.aperture = next.aperture.map((point, index) => deformPoint(point, { ...event, point: { x: 0.5 + (event.point.x - 0.5) * 0.35, y: 0.51 + (event.point.y - 0.51) * 0.25 } }, -yieldAmount * 0.22, event.stage, index));
  next.fibers = next.fibers.map((fiber, fiberIndex) => fiber.map((point, index) => deformPoint(point, event, yieldAmount * (0.24 + fiberIndex / FIBER_COUNT * 0.12), event.stage, index + fiberIndex * 7)));
  [-2, -1, 0, 1, 2].forEach((offset) => {
    const index = (sector + offset + SECTOR_COUNT) % SECTOR_COUNT;
    next.resistance[index] = clamp(next.resistance[index] + event.pressure * (offset === 0 ? 0.5 : 0.15), 0, 1);
  });

  return { membrane: next, scar: tearGeometry(event, yieldAmount, eventIndex) };
}

function makePressure(stage, point, pressure, source, eventIndex) {
  return {
    id: `${source === 'visitor-pressure' ? 'visitor' : 'renderer'}-pressure-${stage}-${eventIndex + 1}`,
    stage,
    point: boundedPoint(point),
    pressure: boundedPressure(pressure),
    source,
    kind: 'pressure-scar',
    reason: source === 'visitor-pressure' ? 'the visitor pressed the portrait membrane' : 'the portrait rehearsed a pressure decision'
  };
}

function candidatePressure(stage, membrane, memory) {
  const random = rng(SEED + stage * 12347 + 401);
  const angle = -1.1 + random() * 2.2;
  return makePressure(stage, {
    x: 0.5 + Math.cos(angle) * (0.13 + random() * 0.1),
    y: 0.51 + Math.sin(angle) * (0.18 + random() * 0.1)
  }, 0.58 + random() * 0.28, 'renderer-pressure', memory.length);
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let membrane = baseMembrane(safe);
  const scars = [];
  inherited.forEach((event, index) => {
    const applied = applyPressure(membrane, event, index);
    membrane = applied.membrane;
    scars.push(applied.scar);
  });
  const flaps = scars.map((scar) => scar.flap);
  return {
    stage: safe,
    membrane,
    memory: inherited,
    scars,
    flaps,
    primitiveBudget: PRIMITIVE_BUDGET,
    pressure: candidatePressure(safe, membrane, inherited),
    decided: safe % 3 === 2
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const count = clamp(Math.floor(Number(stageCount) || 0), 0, STAGES);
  return Array.from({ length: count }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.decided) memory = [...memory, frame.pressure].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function registerPressure(frame, point = {}) {
  const event = makePressure(frame.stage, point, point.pressure, 'visitor-pressure', frame.memory.length);
  const nextMemory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, nextMemory), interaction: 'visitor-pressure', restoreMemory: frame.memory.map(copyEvent) };
}

export function liftLatestPressure(frame) {
  const restoredMemory = frame.memory.slice(0, -1).map(copyEvent);
  return { ...buildFrame(frame.stage, restoredMemory), interaction: 'pressure-lifted', restoreMemory: restoredMemory };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    outline: frame.membrane.outline,
    aperture: frame.membrane.aperture,
    fibers: frame.membrane.fibers,
    resistance: frame.membrane.resistance,
    scars: frame.scars,
    flaps: frame.flaps
  });
}
