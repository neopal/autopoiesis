export const SEED = 0x42525539;
export const STAGES = 16;
export const MEMORY_LIMIT = 5;
export const RUNG_COUNT = 11;
export const PRIMITIVE_BUDGET = 58;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const copyRung = (rung) => ({ ...rung });
const copyEvent = (event) => ({ ...event });

function baseRungs(stage) {
  const random = rng(SEED + stage * 9127);
  return Array.from({ length: RUNG_COUNT }, (_, index) => ({
    index,
    x: 0.13 + index * 0.058,
    y: 0.2 + (random() - 0.5) * 0.018,
    width: 0.038 + random() * 0.024,
    height: 0.22 + random() * 0.23,
    depth: 0.035 + random() * 0.07,
    load: 0.46 + random() * 0.5,
    grain: 0.16 + random() * 0.7,
    lean: (random() - 0.5) * 0.2,
    hue: [14, 29, 193, 344][index % 4]
  }));
}

function normalizeDirection(direction) {
  return Number(direction) < 0 ? -1 : 1;
}

function chooseRung(rungs, stage, memoryLength, direction) {
  const rank = (stage + memoryLength * 3) % Math.max(rungs.length, 1);
  const chosen = direction > 0 ? rank : rungs.length - 1 - rank;
  return rungs[Math.max(0, Math.min(rungs.length - 1, chosen))];
}

function makeEvent(frame, rung, direction, source = 'visitor-wheel') {
  return {
    id: `${source}-turn-${frame.stage}-${rung.index}-${frame.memory.length}`,
    stage: frame.stage,
    source,
    kind: 'ordinal-removal',
    rungIndex: rung.index,
    direction,
    mass: clamp(rung.load * 0.72 + rung.depth * 1.6, 0.25, 0.98),
    rule: 'ordinal-gap-counterweight'
  };
}

function applyEvent(rungs, missingRungs, counterweights, event) {
  const removed = rungs.find((rung) => rung.index === event.rungIndex);
  if (!removed) return { rungs, missingRungs, counterweights };
  const remaining = rungs
    .filter((rung) => rung.index !== event.rungIndex)
    .map((rung) => ({
      ...rung,
      y: rung.y + (rung.index > event.rungIndex ? event.mass * 0.034 : 0),
      height: clamp(rung.height - (rung.index > event.rungIndex ? event.mass * 0.012 : 0), 0.11, 0.55),
      lean: rung.lean + (rung.index > event.rungIndex ? event.direction * event.mass * 0.035 : 0),
      load: clamp(rung.load + (rung.index > event.rungIndex ? event.mass * 0.04 : 0), 0.2, 1)
    }));
  const missing = {
    rungIndex: removed.index,
    anchorX: removed.x,
    anchorY: removed.y,
    width: removed.width,
    height: removed.height,
    mass: event.mass,
    direction: event.direction,
    hue: removed.hue
  };
  const counterweight = {
    rungIndex: removed.index,
    anchorX: 0.82 + counterweights.length * 0.026,
    anchorY: 0.22 + counterweights.length * 0.12,
    width: 0.055 + event.mass * 0.025,
    height: 0.055 + event.mass * 0.08,
    mass: event.mass,
    lean: event.direction * (0.04 + event.mass * 0.08),
    hue: removed.hue
  };
  return {
    rungs: remaining,
    missingRungs: [...missingRungs, missing].slice(-MEMORY_LIMIT),
    counterweights: [...counterweights, counterweight].slice(-MEMORY_LIMIT)
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let rungs = baseRungs(safeStage);
  let missingRungs = [];
  let counterweights = [];
  inherited.forEach((event) => {
    const applied = applyEvent(rungs, missingRungs, counterweights, event);
    rungs = applied.rungs;
    missingRungs = applied.missingRungs;
    counterweights = applied.counterweights;
  });
  return {
    stage: safeStage,
    memory: inherited,
    rungs,
    missingRungs,
    counterweights,
    gapLoad: missingRungs.reduce((total, missing) => total + missing.mass, 0),
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'ordinal-pigment-register'
  };
}

function automaticTurn(stage, frame) {
  const available = frame.rungs;
  const rung = chooseRung(available, stage, frame.memory.length, stage % 2 ? -1 : 1);
  return makeEvent(frame, rung, stage % 2 ? -1 : 1, 'autonomous-wheel');
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1 && frame.rungs.length) {
      memory = [...memory, automaticTurn(stage, frame)].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function registerTurn(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  if (!baseline.rungs.length) return { ...baseline, interaction: 'register-full' };
  const direction = normalizeDirection(input.direction);
  const rung = chooseRung(baseline.rungs, baseline.stage, baseline.memory.length, direction);
  const turn = makeEvent(baseline, rung, direction);
  return {
    ...buildFrame(baseline.stage, [...baseline.memory, turn]),
    interaction: 'visitor-wheel-turn',
    restoreMemory: baseline.memory.map(copyEvent)
  };
}

export function liftLatestTurn(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'turn-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'turn-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'turn-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    rungs: frame.rungs.map((rung) => [rung.index, rung.x, rung.y, rung.width, rung.height, rung.load, rung.lean]),
    missingRungs: frame.missingRungs,
    counterweights: frame.counterweights,
    gapLoad: frame.gapLoad
  });
}
