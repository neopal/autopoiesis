export const SEED = 0x4e413230;
export const STAGES = 19;
export const PRIMITIVE_BUDGET = 42;
export const MEMORY_WINDOW = 4;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const PLATE_LAYOUT = [
  { id: 'stamp-star', x: 0.19, y: 0.32, w: 0.18, h: 0.24, color: '#d95c4f', motif: 'star' },
  { id: 'stamp-arch', x: 0.39, y: 0.24, w: 0.20, h: 0.30, color: '#e5aa47', motif: 'arch' },
  { id: 'stamp-kite', x: 0.61, y: 0.34, w: 0.17, h: 0.28, color: '#4f8c82', motif: 'kite' },
  { id: 'stamp-cup', x: 0.31, y: 0.65, w: 0.21, h: 0.24, color: '#8d78a9', motif: 'cup' },
  { id: 'stamp-bridge', x: 0.60, y: 0.66, w: 0.25, h: 0.19, color: '#54799a', motif: 'bridge' }
];

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return point ? { x: Number(point.x), y: Number(point.y) } : null;
}

function copyEvent(event) {
  return {
    ...event,
    start: copyPoint(event.start),
    end: copyPoint(event.end),
    sourceIndex: Number(event.sourceIndex),
    receiverIndex: Number(event.receiverIndex),
    force: Number(event.force),
    offset: Number(event.offset),
    tilt: Number(event.tilt),
    order: event.order === undefined ? undefined : Number(event.order)
  };
}

function copyPlate(plate) {
  return {
    ...plate,
    pressure: Number(plate.pressure),
    cavity: Number(plate.cavity),
    relief: Number(plate.relief),
    skew: Number(plate.skew),
    inkSpread: Number(plate.inkSpread),
    shift: { x: Number(plate.shift.x), y: Number(plate.shift.y) }
  };
}

function copyRegister(register) {
  return { ...register, gap: Number(register.gap), offset: Number(register.offset), seam: Number(register.seam), pressure: Number(register.pressure) };
}

function nearestPlate(point) {
  return PLATE_LAYOUT.reduce((closest, plate, index) => {
    const distance = Math.hypot(point.x - plate.x, point.y - plate.y);
    return distance < closest.distance ? { index, distance } : closest;
  }, { index: 0, distance: Infinity }).index;
}

function basePlates(random) {
  return PLATE_LAYOUT.map((plate, index) => ({
    ...plate,
    pressure: 0,
    cavity: 0,
    relief: 0,
    skew: (index % 2 ? -1 : 1) * (0.02 + random() * 0.06),
    inkSpread: 0.72 + random() * 0.20,
    shift: { x: (random() - 0.5) * 0.012, y: (random() - 0.5) * 0.012 }
  }));
}

function baseRegister(random) {
  return {
    axis: 0.48 + (random() - 0.5) * 0.03,
    gap: 0,
    offset: 0,
    seam: 0,
    pressure: 0,
    grammar: 'press → source cavity → distant relief → register misaligns'
  };
}

function eventForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const start = { x: 0.16 + random() * 0.68, y: 0.20 + random() * 0.52 };
  const end = { x: 0.18 + random() * 0.68, y: 0.22 + random() * 0.52 };
  const sourceIndex = nearestPlate(start);
  let receiverIndex = (sourceIndex + 2 + Math.floor(random() * 2)) % PLATE_LAYOUT.length;
  if (receiverIndex === sourceIndex) receiverIndex = (receiverIndex + 1) % PLATE_LAYOUT.length;
  return {
    stage,
    source: 'autonomous-pressure',
    start,
    end,
    sourceIndex,
    receiverIndex,
    force: 0.44 + random() * 0.40,
    offset: (random() - 0.5) * 0.9,
    tilt: (random() - 0.5) * 0.8,
    reason: 'the print kept the wrong pressure'
  };
}

function composeScene(events, random) {
  const plates = basePlates(random);
  const register = baseRegister(random);
  const pressRecords = [];

  for (const [order, event] of events.entries()) {
    const source = plates[event.sourceIndex];
    const receiver = plates[event.receiverIndex];
    const impulse = 0.10 + event.force * 0.12 + order * 0.014;

    source.pressure += impulse;
    source.cavity += impulse * 0.92;
    source.skew += event.tilt * 0.19;
    source.shift.x += event.offset * 0.014;
    source.shift.y -= impulse * 0.012;
    source.inkSpread -= impulse * 0.07;

    receiver.pressure += impulse * 0.62;
    receiver.relief += impulse * 0.88;
    receiver.skew -= event.tilt * 0.16;
    receiver.shift.x -= event.offset * 0.011;
    receiver.shift.y += impulse * 0.014;
    receiver.inkSpread += impulse * 0.04;

    register.gap += impulse * 0.32;
    register.offset += Math.abs(event.offset) * 0.045 + 0.016;
    register.seam += impulse * 0.24;
    register.pressure += impulse;

    pressRecords.push({ ...copyEvent(event), order, sourceKind: source.motif, receiverKind: receiver.motif });
  }

  return {
    plates,
    register,
    pressRecords,
    materialTrace: {
      pressCount: events.length,
      pointerOnlyChanges: 0,
      geometryChanges: events.length * 5,
      cavityCount: plates.filter((plate) => plate.cavity > 0.01).length,
      reliefCount: plates.filter((plate) => plate.relief > 0.01).length,
      registerChanges: register.gap > 0.01 ? 1 : 0,
      grammar: 'press → source cavity → distant relief → register misaligns'
    }
  };
}

export function geometrySignature(frame) {
  return [
    ...frame.scene.plates.map((plate) => [
      plate.id,
      Number(plate.pressure).toFixed(4),
      Number(plate.cavity).toFixed(4),
      Number(plate.relief).toFixed(4),
      Number(plate.skew).toFixed(4),
      Number(plate.inkSpread).toFixed(4),
      Number(plate.shift.x).toFixed(4),
      Number(plate.shift.y).toFixed(4)
    ].join('|')),
    Object.entries(frame.scene.register).map(([key, value]) => typeof value === 'number' ? `${key}:${Number(value).toFixed(4)}` : `${key}:${value}`).join('|')
  ].join('||');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_WINDOW) : [];
  return {
    stage: safeStage,
    memory: inherited,
    correction: eventForStage(safeStage),
    primitiveCount: PRIMITIVE_BUDGET,
    draft: { plates: PLATE_LAYOUT.map((plate) => ({ ...plate })) },
    scene: composeScene(inherited, random)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(Math.max(0, stageCount), STAGES) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.correction];
    return frame;
  });
}

function eventForVisitor(frame, direction) {
  const sign = Number(direction) < 0 ? -1 : 1;
  const random = rng(SEED + frame.stage * 97 + frame.memory.length * 131 + (sign < 0 ? 17 : 0));
  const baseIndex = Math.floor(random() * PLATE_LAYOUT.length);
  const sourceIndex = (baseIndex + (sign < 0 ? 1 : 0)) % PLATE_LAYOUT.length;
  let receiverIndex = (sourceIndex + (sign < 0 ? -2 : 2) + Math.floor(random() * 2) + PLATE_LAYOUT.length) % PLATE_LAYOUT.length;
  if (receiverIndex === sourceIndex) receiverIndex = (receiverIndex + (sign < 0 ? -1 : 1) + PLATE_LAYOUT.length) % PLATE_LAYOUT.length;
  return {
    stage: frame.stage,
    source: 'visitor-pressure',
    start: null,
    end: null,
    sourceIndex,
    receiverIndex,
    force: 0.56 + random() * 0.30,
    offset: (sign < 0 ? -1 : 1) * (0.24 + random() * 0.48),
    tilt: (sign < 0 ? -1 : 1) * (0.16 + random() * 0.36),
    direction: sign,
    reason: 'the print kept the wrong pressure'
  };
}

export function pressPlate(frame, { direction = 1 } = {}) {
  const event = eventForVisitor(frame, direction);
  return { ...buildFrame(frame.stage, [...frame.memory, event]), interaction: 'visitor-pressure' };
}

export function liftLatestPress(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'pressure-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'pressure-lifted' };
}

export function layoutForViewport(width, height) {
  return {
    mode: width < 640 ? 'portrait' : 'landscape',
    width,
    height,
    sheet: { x: 0.05, y: 0.06, w: 0.90, h: 0.88 }
  };
}
