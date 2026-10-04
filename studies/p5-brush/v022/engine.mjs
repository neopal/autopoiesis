export const SEED = 0x42525542;
export const STAGES = 16;
export const MEMORY_LIMIT = 4;
export const FIELD_COLUMNS = 54;
export const FIELD_ROWS = 34;
export const PRIMITIVE_BUDGET = 96;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyEvent = (event) => ({ ...event, point: copyPoint(event.point) });
const copySample = (sample) => ({ ...sample });

function fieldCoordinates(column, row, random) {
  const x = column / (FIELD_COLUMNS - 1);
  const y = row / (FIELD_ROWS - 1);
  return {
    x: clamp(x + (random() - 0.5) * 0.014, 0, 1),
    y: clamp(y + (random() - 0.5) * 0.014, 0, 1)
  };
}

function basePigment(stage) {
  const random = rng(SEED + stage * 19073);
  const pigment = [];
  for (let row = 0; row < FIELD_ROWS; row += 1) {
    for (let column = 0; column < FIELD_COLUMNS; column += 1) {
      const { x, y } = fieldCoordinates(column, row, random);
      const warpX = x + Math.sin(y * 8.4 + stage * 0.19) * 0.08 + Math.cos(y * 20.0 - x * 4.0) * 0.025;
      const warpY = y + Math.cos(x * 7.1 - stage * 0.17) * 0.07 + Math.sin(x * 17.0 + y * 3.0) * 0.022;
      const swell = Math.sin(warpX * 12.2 + warpY * 4.4 + stage * 0.22) * 0.5 + 0.5;
      const eddy = Math.cos(warpY * 16.4 - warpX * 6.2 - stage * 0.14) * 0.5 + 0.5;
      const density = clamp(0.18 + swell * 0.42 + eddy * 0.25 + random() * 0.1);
      pigment.push({
        id: row * FIELD_COLUMNS + column,
        row,
        column,
        x,
        y,
        density,
        binder: clamp(0.22 + density * 0.52 + random() * 0.16),
        grain: 0.12 + random() * 0.88,
        hue: [12, 27, 46, 182, 198, 324][(row * 5 + column * 3) % 6],
        cusp: 0,
        shear: 0,
        heat: density * 0.42
      });
    }
  }
  return pigment;
}

function eventShape(event) {
  const strength = clamp(event.load);
  const radius = clamp(0.085 + strength * 0.12, 0.085, 0.22);
  const remote = {
    x: clamp(0.5 + (0.5 - event.point.x) * 0.7, 0.12, 0.88),
    y: clamp(0.5 + (0.5 - event.point.y) * 0.34, 0.16, 0.84)
  };
  return { strength, radius, remote };
}

function applyEvent(pigment, event, eventIndex) {
  const { strength, radius, remote } = eventShape(event);
  return pigment.map((sample) => {
    const dx = sample.x - event.point.x;
    const dy = sample.y - event.point.y;
    const distance = Math.hypot(dx, dy);
    const local = clamp(1 - distance / radius, 0, 1);
    const cusp = local * local * strength;
    const rdx = sample.x - remote.x;
    const rdy = sample.y - remote.y;
    const remoteDistance = Math.hypot(rdx, rdy);
    const reply = clamp(1 - remoteDistance / (radius * 1.35), 0, 1) * strength * 0.72;
    const flow = Math.sin((sample.x - event.point.x) * 19 + (sample.y + event.point.y) * 8 + eventIndex * 1.7);
    const shear = cusp * flow * 0.09 + reply * (sample.y < remote.y ? -0.06 : 0.06);
    return {
      ...sample,
      density: clamp(sample.density + cusp * (0.46 + sample.grain * 0.16) - reply * 0.18),
      binder: clamp(sample.binder + cusp * 0.56 + reply * 0.18),
      cusp: Math.max(sample.cusp, cusp),
      shear: sample.shear + shear,
      heat: clamp(sample.heat + cusp * 0.44 + reply * 0.21),
      x: clamp(sample.x + shear * 0.12, 0, 1),
      y: clamp(sample.y - shear * 0.08, 0, 1)
    };
  });
}

function normalizePoint(point) {
  return {
    x: clamp(Number(point?.x) || 0.5),
    y: clamp(Number(point?.y) || 0.5)
  };
}

function normalizeDuration(duration) {
  return clamp(Number(duration) || 0, 0, 4000);
}

function makeEvent(frame, point, duration, source = 'visitor-dwell') {
  const safePoint = normalizePoint(point);
  const safeDuration = normalizeDuration(duration);
  return {
    id: `${source}-${frame.stage}-${frame.memory.length}-${Math.round(safePoint.x * 1000)}-${Math.round(safePoint.y * 1000)}`,
    stage: frame.stage,
    source,
    kind: 'pressure-dwell',
    point: safePoint,
    duration: safeDuration,
    load: clamp(0.34 + safeDuration / 1500, 0.34, 1),
    rule: 'dwell-coagulation'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let pigment = basePigment(safeStage);
  inherited.forEach((event, index) => {
    pigment = applyEvent(pigment, event, index);
  });
  const coagulatedMass = pigment.reduce((total, sample) => total + sample.cusp * 0.75 + Math.max(0, sample.binder - 0.42) * 0.16, 0);
  const cuspCount = pigment.filter((sample) => sample.cusp > 0.12).length;
  return {
    stage: safeStage,
    memory: inherited,
    pigment,
    coagulatedMass,
    cuspCount,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'continuous-pigment-coagulation-field'
  };
}

function automaticDwell(stage, frame) {
  const random = rng(SEED + stage * 4311);
  const point = {
    x: 0.2 + random() * 0.6,
    y: 0.22 + random() * 0.56
  };
  const duration = 440 + random() * 880;
  return makeEvent(frame, point, duration, 'autonomous-dwell');
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1) memory = [...memory, automaticDwell(stage, frame)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyPressureDwell(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const duration = normalizeDuration(input.duration);
  if (duration < 360) return { ...baseline, interaction: 'pressure-refused' };
  const event = makeEvent(baseline, input.point, duration);
  return {
    ...buildFrame(baseline.stage, [...baseline.memory, event]),
    interaction: 'pressure-coagulated',
    restoreMemory: baseline.memory.map(copyEvent)
  };
}

export function liftLatestDwell(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'pressure-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'pressure-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'pressure-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    pigment: frame.pigment.map((sample) => [sample.id, sample.x, sample.y, sample.density, sample.binder, sample.cusp, sample.shear, sample.heat]),
    coagulatedMass: frame.coagulatedMass,
    cuspCount: frame.cuspCount
  });
}
