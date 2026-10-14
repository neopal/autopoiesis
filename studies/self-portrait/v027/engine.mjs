export const SEED = 0x43504652;
export const STAGES = 15;
export const MEMORY_LIMIT = 4;
export const REGISTER_COUNT = 6;
export const PRIMITIVE_BUDGET = 78;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));

const REGISTER_LAYOUT = [
  [-0.63, -0.46, 0.38, 0.52, -0.12],
  [0.36, -0.54, 0.44, 0.46, 0.17],
  [-0.78, 0.12, 0.34, 0.62, 0.08],
  [0.57, 0.08, 0.42, 0.6, -0.1],
  [-0.28, 0.62, 0.56, 0.36, 0.2],
  [0.74, 0.58, 0.3, 0.44, -0.18]
];

function seeded(index, stage = 0, salt = 0) {
  const value = Math.sin((index + 1 + salt) * 12.9898 + (stage + 1) * 78.233 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function baseRegister(index, stage) {
  const [x, y, width, height, angle] = REGISTER_LAYOUT[index];
  return {
    index,
    x: x + (seeded(index, stage, 1) - 0.5) * 0.035,
    y: y + (seeded(index, stage, 2) - 0.5) * 0.035,
    width: width * (0.92 + seeded(index, stage, 3) * 0.16),
    height: height * (0.92 + seeded(index, stage, 4) * 0.14),
    angle: angle + (seeded(index, stage, 5) - 0.5) * 0.12,
    aperture: 0.16 + seeded(index, stage, 6) * 0.12,
    density: 0.45 + seeded(index, stage, 7) * 0.34,
    phase: seeded(index, stage, 8),
    signal: 0,
    scar: 0,
    veil: 0,
    state: 'quiet'
  };
}

function baseFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, STAGES - 1);
  return {
    composition: 'raster-counterportrait',
    stage: safeStage,
    registers: Array.from({ length: REGISTER_COUNT }, (_, index) => baseRegister(index, safeStage)),
    pendingRegisters: [],
    memory: [],
    commits: [],
    checksum: 0,
    interaction: 'sequence',
    counterweight: 0
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    checksum: frame.checksum,
    counterweight: Number(frame.counterweight.toFixed(5)),
    registers: frame.registers.map((register) => [
      register.index,
      Number(register.x.toFixed(5)),
      Number(register.y.toFixed(5)),
      Number(register.width.toFixed(5)),
      Number(register.height.toFixed(5)),
      Number(register.angle.toFixed(5)),
      Number(register.aperture.toFixed(5)),
      Number(register.density.toFixed(5)),
      Number(register.phase.toFixed(5)),
      Number(register.signal.toFixed(5)),
      Number(register.scar.toFixed(5)),
      Number(register.veil.toFixed(5)),
      register.state
    ])
  });
}

function validIndex(value) {
  return clamp(integer(value), 0, REGISTER_COUNT - 1);
}

export function selectRegister(frame, index = 0) {
  const next = clone(frame);
  const selected = validIndex(index);
  if (!next.pendingRegisters.length) {
    next.pendingRegisters = [selected];
    next.interaction = 'pair-started';
    return next;
  }
  if (next.pendingRegisters.includes(selected)) {
    next.interaction = 'pair-refused';
    return next;
  }
  next.pendingRegisters = [...next.pendingRegisters, selected].slice(-2);
  next.interaction = 'pair-armed';
  return next;
}

function chooseCounter(frame, pair) {
  const candidates = Array.from({ length: REGISTER_COUNT }, (_, index) => index).filter((index) => !pair.includes(index));
  const offset = (pair[0] * 7 + pair[1] * 11 + frame.memory.length * 5 + frame.stage * 3 + frame.checksum) % candidates.length;
  return candidates[offset];
}

function chooseResidue(pair, counterIndex, historyLength) {
  const candidates = Array.from({ length: REGISTER_COUNT }, (_, index) => index).filter((index) => !pair.includes(index) && index !== counterIndex);
  return candidates[(counterIndex + pair[0] + pair[1] + historyLength) % candidates.length];
}

function applyCommit(frame, pair) {
  const next = clone(frame);
  const previous = clone(frame);
  delete previous.undo;
  previous.pendingRegisters = [];
  previous.interaction = 'sequence';
  const [firstIndex, secondIndex] = pair;
  const counterIndex = chooseCounter(frame, pair);
  const residueIndex = chooseResidue(pair, counterIndex, frame.memory.length);
  const first = next.registers[firstIndex];
  const second = next.registers[secondIndex];
  const counter = next.registers[counterIndex];
  const residue = next.registers[residueIndex];
  const previousMemory = frame.memory.length;
  const pressure = clamp(0.24 + previousMemory * 0.08 + (first.signal + second.signal) * 0.045, 0.24, 0.76);
  const checksum = (firstIndex + 1) * 17 + (secondIndex + 1) * 31 + counterIndex * 13 + previousMemory * 19 + frame.stage * 7;

  next.registers.forEach((register) => {
    if (register.state !== 'quiet') register.state = 'trace';
  });

  for (const register of [first, second]) {
    register.state = 'selected';
    register.signal += 1;
    register.aperture = clamp(register.aperture + 0.08 + pressure * 0.12, 0.08, 0.72);
    register.density = clamp(register.density - 0.04 - pressure * 0.03, 0.16, 0.94);
    register.angle += register.index === firstIndex ? pressure * 0.07 : -pressure * 0.06;
    register.scar = clamp(register.scar + 0.12 + pressure * 0.08, 0, 0.8);
  }

  counter.state = 'counter';
  counter.signal += 1;
  counter.aperture = clamp(counter.aperture + 0.22 + pressure * 0.2, 0.08, 0.92);
  counter.density = clamp(counter.density + 0.12 + pressure * 0.11, 0.18, 1.1);
  counter.x += Math.sin(counter.index + frame.memory.length * 1.7) * (0.018 + pressure * 0.022);
  counter.y -= 0.014 + pressure * 0.028;
  counter.angle += 0.12 + pressure * 0.1;
  counter.scar = clamp(counter.scar + 0.2 + pressure * 0.12, 0, 0.95);

  residue.state = 'residue';
  residue.signal += 1;
  residue.veil = clamp(residue.veil + 0.23 + pressure * 0.16, 0, 0.92);
  residue.aperture = clamp(residue.aperture - 0.05, 0.06, 0.72);
  residue.width = clamp(residue.width * (0.94 - pressure * 0.04), 0.2, 0.72);
  residue.y += 0.012 + pressure * 0.014;
  residue.angle -= 0.08;

  next.counterweight = clamp(frame.counterweight * 0.62 + (counter.x - residue.x) * 0.25 + pressure * 0.15, -1, 1);
  next.checksum = checksum;
  const event = {
    id: `visitor-pair-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'visitor-pair',
    kind: 'counter-reading',
    pair: pair.slice(),
    counterIndex,
    residueIndex,
    pressure: Number(pressure.toFixed(6)),
    checksum,
    historyBefore: previousMemory,
    reason: 'two registers are offered; the portrait refuses to answer from either and exposes an unchosen counter-reading'
  };
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.commits = [...frame.commits, event].slice(-MEMORY_LIMIT);
  next.pendingRegisters = [];
  next.interaction = 'counter-reading';
  next.undo = previous;
  event.signature = geometrySignature(next);
  return next;
}

export function commitPair(frame) {
  if (frame.pendingRegisters.length !== 2) {
    const refused = clone(frame);
    refused.interaction = 'pair-refused';
    return refused;
  }
  return applyCommit(frame, frame.pendingRegisters);
}

export function buildFrame(stage = 0, memory = []) {
  let frame = baseFrame(stage);
  for (const event of clone(memory).slice(-MEMORY_LIMIT)) {
    const pair = Array.isArray(event.pair) ? event.pair.map(validIndex) : [0, 1];
    frame = commitPair(selectRegister(selectRegister(frame, pair[0]), pair[1]));
  }
  frame.interaction = 'sequence';
  frame.pendingRegisters = [];
  return frame;
}

export function liftLatest(frame) {
  if (!frame.memory.length) {
    const untouched = clone(frame);
    untouched.pendingRegisters = [];
    untouched.interaction = 'lifted-empty';
    return untouched;
  }
  if (frame.undo) {
    const restored = clone(frame.undo);
    restored.pendingRegisters = [];
    restored.interaction = 'lifted';
    return restored;
  }
  const restored = buildFrame(frame.stage, frame.memory.slice(0, -1));
  restored.interaction = 'lifted';
  return restored;
}

export function releaseRegisters(stage = 0) {
  const released = buildFrame(stage, []);
  released.interaction = 'released';
  return released;
}

const CUES = [[0, 3], [1, 4], [2, 5], [0, 4]];

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[2, 0], [5, 1], [8, 2], [11, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      const pair = CUES[eventStages.get(stage)];
      frame = commitPair(selectRegister(selectRegister(frame, pair[0]), pair[1]));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(frame);
  }
  return timeline;
}
