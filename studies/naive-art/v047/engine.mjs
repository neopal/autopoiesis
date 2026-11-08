const SEED = '0x4e413437';
export const SLOT_COUNT = 9;
export const MEMORY_LIMIT = 4;
export const TRAVEL_THRESHOLD = 0.68;
export const PRESSURE_THRESHOLD = 0.45;

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const validSlot = (value) => Number.isInteger(value) && value >= 0 && value < SLOT_COUNT;

const SLOT_LAYOUT = [
  [-0.82, -0.08, 0.13, 0.22, -8],
  [-0.62, 0.05, 0.16, 0.19, 12],
  [-0.42, -0.04, 0.14, 0.25, -15],
  [-0.21, 0.08, 0.17, 0.2, 7],
  [0, -0.02, 0.15, 0.24, -5],
  [0.21, 0.06, 0.16, 0.2, 11],
  [0.42, -0.05, 0.14, 0.24, -12],
  [0.63, 0.04, 0.17, 0.19, 8],
  [0.83, -0.06, 0.13, 0.22, -10]
];

function baseSlot(index) {
  const [x, y, width, height, rotation] = SLOT_LAYOUT[index];
  return {
    id: index,
    x,
    y,
    width,
    height,
    rotation,
    phase: round((index * 17) % 29 / 29),
    role: 'proof-slot',
    misprintDepth: 0
  };
}

const BASE_SLOTS = Array.from({ length: SLOT_COUNT }, (_, index) => baseSlot(index));

function materialise(memory) {
  const slots = BASE_SLOTS.map((slot) => ({ ...slot }));
  const misprints = memory.slice(-MEMORY_LIMIT).map((event) => ({ ...event }));
  for (const misprint of misprints) {
    const slot = slots[misprint.targetSlot];
    const depth = 0.018 + misprint.memoryIndex * 0.012;
    slot.x = round(slot.x + depth + misprint.pressure * 0.012);
    slot.y = round(slot.y - depth * 1.6);
    slot.width = round(slot.width * (1 + misprint.pressure * 0.16));
    slot.height = round(slot.height * (1 - misprint.travel * 0.11));
    slot.rotation = round(slot.rotation + (misprint.memoryIndex % 2 ? -7 : 9));
    slot.phase = round((slot.phase + misprint.travel * 0.31) % 1);
    slot.role = 'misprinted-slot';
    slot.misprintDepth = round(slot.misprintDepth + depth);
  }
  return {
    slots,
    misprints,
    slotCount: SLOT_COUNT,
    trace: {
      memoryCount: memory.length,
      lastSourceSlot: memory.at(-1)?.sourceSlot ?? null,
      lastTargetSlot: memory.at(-1)?.targetSlot ?? null
    }
  };
}

function stateFrom(memory, interaction = 'idle', pending = null) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT);
  return {
    seed: SEED,
    grammar: 'misprint-ledger',
    surface: 'p5-canvas-proof-strip',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    memoryLimit: MEMORY_LIMIT,
    pending: pending ? clone(pending) : { active: false, sourceSlot: null, travel: 0, pressure: 0 },
    interaction,
    event: interaction === 'correction-committed' ? clone(boundedMemory.at(-1)) : null,
    body: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }

export function geometrySignature(state) {
  return JSON.stringify({ slots: state.body.slots, misprints: state.body.misprints });
}

export function beginCorrection(state, sourceSlot) {
  if (!validSlot(sourceSlot)) return stateFrom(state.memory, 'correction-refused-target');
  return stateFrom(state.memory, 'correction-started', {
    active: true,
    sourceSlot,
    travel: 0,
    pressure: 0
  });
}

export function tickCorrection(state, travel, pressure = 0) {
  if (!state.pending?.active) return stateFrom(state.memory, 'correction-refused-idle');
  const nextTravel = Math.max(state.pending.travel || 0, Math.max(0, Number(travel) || 0));
  const nextPressure = Math.max(state.pending.pressure || 0, Math.max(0, Number(pressure) || 0));
  return stateFrom(state.memory, 'correction-travelling', {
    ...state.pending,
    travel: round(nextTravel),
    pressure: round(nextPressure)
  });
}

function eventFor(pending, memoryIndex) {
  const targetSlot = (pending.sourceSlot + 3 + memoryIndex * 2) % SLOT_COUNT;
  return {
    type: 'misprint',
    sourceSlot: pending.sourceSlot,
    targetSlot: targetSlot === pending.sourceSlot ? (targetSlot + 1) % SLOT_COUNT : targetSlot,
    travel: round(pending.travel),
    pressure: round(pending.pressure),
    memoryIndex,
    offset: round((pending.pressure - 0.5) * 0.2)
  };
}

export function releaseCorrection(state) {
  if (!state.pending?.active) return stateFrom(state.memory, 'correction-refused-idle');
  if (state.pending.travel < TRAVEL_THRESHOLD) return stateFrom(state.memory, 'correction-refused-short');
  if (state.pending.pressure < PRESSURE_THRESHOLD) return stateFrom(state.memory, 'correction-refused-pressure');
  return stateFrom([...state.memory, eventFor(state.pending, state.memory.length)], 'correction-committed');
}

export function liftLatest(state) {
  return stateFrom(state.memory.slice(0, -1), 'correction-lifted');
}

export function releaseMemory() {
  return stateFrom([], 'memory-released');
}

export function buildTimeline() {
  const sources = [0, 2, 4, 6];
  const frames = [buildFrame()];
  for (const sourceSlot of sources) {
    let frame = beginCorrection(frames.at(-1), sourceSlot);
    frame = tickCorrection(frame, TRAVEL_THRESHOLD, PRESSURE_THRESHOLD);
    frames.push(releaseCorrection(frame));
  }
  return frames;
}

export { SEED };
