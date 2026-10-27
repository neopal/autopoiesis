const SEED = '0x4e413337';
const STAMP_COUNT = 13;
const MEMORY_WINDOW = 4;
const MIN_PRESSURE = 0.22;
const MAX_PRESSURE = 0.92;
const REQUIRED_ANCHORS = 3;

const BASE_STAMPS = [
  [0.17, 0.23, 0.18, -18, 0.64, 0.11, 0.12],
  [0.31, 0.17, 0.15, 22, 0.53, -0.08, 0.19],
  [0.48, 0.22, 0.21, -7, 0.71, 0.07, 0.24],
  [0.68, 0.16, 0.16, 13, 0.48, 0.15, 0.31],
  [0.82, 0.28, 0.19, -26, 0.61, -0.12, 0.38],
  [0.22, 0.43, 0.22, 31, 0.57, 0.09, 0.44],
  [0.41, 0.40, 0.16, -14, 0.46, -0.11, 0.51],
  [0.62, 0.46, 0.23, 17, 0.69, 0.13, 0.59],
  [0.81, 0.43, 0.15, -9, 0.51, -0.06, 0.66],
  [0.16, 0.70, 0.20, -22, 0.62, 0.06, 0.73],
  [0.36, 0.76, 0.15, 14, 0.49, -0.14, 0.81],
  [0.57, 0.69, 0.21, -11, 0.67, 0.10, 0.89],
  [0.79, 0.76, 0.18, 24, 0.55, -0.09, 0.97]
].map(([x, y, scale, rotation, ink, tilt, depth], id) => ({
  id,
  x,
  y,
  scale,
  rotation,
  ink,
  tilt,
  depth,
  role: 'quiet'
}));

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const validIndex = (value) => Number.isInteger(value) && value >= 0 && value < STAMP_COUNT;

function validAnchors(value) {
  return Array.isArray(value)
    && value.length === REQUIRED_ANCHORS
    && value.every(validIndex)
    && new Set(value).size === REQUIRED_ANCHORS;
}

function stampSignature(stamp) {
  return [
    stamp.id,
    stamp.role,
    round(stamp.x),
    round(stamp.y),
    round(stamp.scale),
    round(stamp.rotation),
    round(stamp.ink),
    round(stamp.tilt),
    round(stamp.depth)
  ].join(':');
}

function materialiseStamps(memory) {
  const stamps = BASE_STAMPS.map((stamp) => ({ ...stamp }));
  for (const event of memory.slice(-MEMORY_WINDOW)) applyChord(stamps, event);
  const changedStampCount = stamps.reduce((count, stamp, index) => (
    count + (stampSignature(stamp) === stampSignature(BASE_STAMPS[index]) ? 0 : 1)
  ), 0);
  return {
    stamps,
    trace: {
      changedStampCount,
      memoryCount: memory.length,
      lastFalseImprint: memory.at(-1)?.falseImprint ?? null,
      lastVacancy: memory.at(-1)?.vacancy ?? null,
      lastRidge: memory.at(-1)?.ridge ?? null
    }
  };
}

function applyChord(stamps, event) {
  const pressure = clamp(event.pressure, MIN_PRESSURE, MAX_PRESSURE);
  const anchors = event.anchors;
  const falseImprint = stamps[event.falseImprint];
  const vacancy = stamps[event.vacancy];
  const ridge = stamps[event.ridge];

  for (const [order, index] of anchors.entries()) {
    const source = stamps[index];
    source.role = 'misread-source';
    source.ink = clamp(source.ink - pressure * (0.08 + order * 0.018), 0.2, 0.9);
    source.rotation += (order % 2 ? -1 : 1) * pressure * (4 + event.memoryIndex);
    source.tilt += (order - 1) * pressure * 0.04;
  }

  falseImprint.role = 'false-imprint';
  falseImprint.x = clamp(falseImprint.x + pressure * (0.018 + event.memoryIndex * 0.004), 0.08, 0.92);
  falseImprint.y = clamp(falseImprint.y - pressure * (0.024 + event.memoryIndex * 0.006), 0.1, 0.9);
  falseImprint.scale = clamp(falseImprint.scale + pressure * (0.12 + event.memoryIndex * 0.015), 0.12, 0.36);
  falseImprint.rotation += pressure * (19 + event.memoryIndex * 5);
  falseImprint.ink = clamp(falseImprint.ink + pressure * 0.14, 0.32, 0.98);
  falseImprint.tilt += pressure * 0.12;

  vacancy.role = 'vacancy';
  vacancy.scale = clamp(vacancy.scale - pressure * 0.08, 0.07, 0.3);
  vacancy.ink = clamp(vacancy.ink - pressure * 0.26, 0.08, 0.82);
  vacancy.rotation -= pressure * (12 + event.memoryIndex * 3);
  vacancy.tilt -= pressure * 0.15;
  vacancy.depth += pressure * 0.09;

  ridge.role = 'pressure-ridge';
  ridge.x = clamp(ridge.x - pressure * 0.02, 0.08, 0.92);
  ridge.y = clamp(ridge.y + pressure * (0.018 + event.memoryIndex * 0.004), 0.1, 0.9);
  ridge.scale = clamp(ridge.scale + pressure * 0.06, 0.1, 0.32);
  ridge.rotation += pressure * (8 + event.memoryIndex * 2);
  ridge.ink = clamp(ridge.ink + pressure * 0.08, 0.25, 0.96);
  ridge.depth += pressure * 0.04;
}

function makeState(memory, interaction = 'idle', pending = null, previousMemory = null) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'pressure-misprint',
    surface: 'p5js-raster-print',
    stage: boundedMemory.length,
    memory: boundedMemory,
    pending: pending ? { anchors: [...pending.anchors] } : null,
    previousMemory,
    scene: materialiseStamps(boundedMemory),
    interaction
  };
}

export function buildFrame() {
  return makeState([]);
}

export function chordIsValid(input = {}) {
  return validAnchors(input.anchors)
    && Number.isFinite(Number(input.pressure))
    && Number(input.pressure) >= MIN_PRESSURE
    && Number(input.pressure) <= MAX_PRESSURE;
}

export function beginChord(state, input = {}) {
  if (!Array.isArray(input.anchors) || input.anchors.length < REQUIRED_ANCHORS) {
    return makeState(state.memory, 'chord-refused-incomplete');
  }
  if (!validAnchors(input.anchors)) return makeState(state.memory, 'chord-refused-invalid');
  return makeState(state.memory, 'chord-armed', { anchors: input.anchors }, state.previousMemory);
}

function eventFor(input, memoryIndex) {
  const anchors = [...input.anchors];
  const selected = new Set(anchors);
  const candidates = (offset) => (anchors.reduce((sum, value) => sum + value, 0) + offset + memoryIndex * 3) % STAMP_COUNT;
  let falseImprint = candidates(0);
  while (selected.has(falseImprint)) falseImprint = (falseImprint + 1) % STAMP_COUNT;
  selected.add(falseImprint);
  let vacancy = candidates(5);
  while (selected.has(vacancy)) vacancy = (vacancy + 2) % STAMP_COUNT;
  selected.add(vacancy);
  let ridge = candidates(9);
  while (selected.has(ridge)) ridge = (ridge + 3) % STAMP_COUNT;
  return {
    kind: 'pressure-misprint-chord',
    anchors,
    falseImprint,
    vacancy,
    ridge,
    pressure: round(Number(input.pressure)),
    memoryIndex
  };
}

export function commitChord(state, input = {}) {
  const requested = {
    anchors: input.anchors ?? state.pending?.anchors,
    pressure: input.pressure
  };
  if (!Array.isArray(requested.anchors) || requested.anchors.length < REQUIRED_ANCHORS) {
    return makeState(state.memory, 'chord-refused-incomplete', state.pending, state.previousMemory);
  }
  if (!validAnchors(requested.anchors)) {
    return makeState(state.memory, 'chord-refused-invalid', state.pending, state.previousMemory);
  }
  if (!Number.isFinite(Number(requested.pressure)) || Number(requested.pressure) < MIN_PRESSURE) {
    return makeState(state.memory, 'chord-refused-light', state.pending, state.previousMemory);
  }
  if (Number(requested.pressure) > MAX_PRESSURE) {
    return makeState(state.memory, 'chord-refused-heavy', state.pending, state.previousMemory);
  }
  const event = eventFor(requested, state.memory.length);
  return makeState([...state.memory, event], 'chord-committed', null, state.memory);
}

export function liftLatestChord(state) {
  if (!state.memory.length) return makeState([], 'chord-lifted');
  const previousMemory = state.previousMemory ?? state.memory.slice(0, -1);
  return makeState(previousMemory, 'chord-lifted');
}

export function releaseMemory() {
  return makeState([], 'memory-released');
}

export function geometrySignature(state) {
  return state.scene.stamps.map(stampSignature).join('|');
}

export function buildTimeline() {
  return [
    { anchors: [1, 4, 8], pressure: 0.58 },
    { anchors: [2, 6, 10], pressure: 0.42 },
    { anchors: [0, 5, 9], pressure: 0.67 },
    { anchors: [3, 7, 12], pressure: 0.51 }
  ];
}

export {
  SEED,
  STAMP_COUNT,
  MEMORY_WINDOW,
  MIN_PRESSURE,
  MAX_PRESSURE,
  REQUIRED_ANCHORS
};
