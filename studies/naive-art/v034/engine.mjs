const SEED = '0x4e413334';
const FACET_COUNT = 9;
const MEMORY_WINDOW = 4;
const MIN_DWELL = 420;

const BASE_FACETS = [
  { x: -0.55, y: -0.46, z: 0.02, width: 0.32, depth: 0.28, height: 0.22, tilt: -0.18, twist: 0.12, relief: 0.18, notch: 0.12 },
  { x: -0.16, y: -0.51, z: 0.05, width: 0.34, depth: 0.3, height: 0.28, tilt: 0.12, twist: -0.2, relief: 0.34, notch: 0.26 },
  { x: 0.28, y: -0.46, z: -0.02, width: 0.3, depth: 0.26, height: 0.18, tilt: -0.08, twist: 0.22, relief: 0.26, notch: 0.18 },
  { x: 0.55, y: -0.12, z: 0.04, width: 0.3, depth: 0.34, height: 0.3, tilt: 0.2, twist: -0.1, relief: 0.42, notch: 0.3 },
  { x: 0.18, y: -0.06, z: 0.08, width: 0.36, depth: 0.33, height: 0.34, tilt: -0.16, twist: 0.08, relief: 0.52, notch: 0.14 },
  { x: -0.24, y: -0.04, z: -0.01, width: 0.31, depth: 0.3, height: 0.24, tilt: 0.1, twist: -0.18, relief: 0.3, notch: 0.34 },
  { x: -0.54, y: 0.28, z: 0.01, width: 0.34, depth: 0.28, height: 0.2, tilt: -0.22, twist: 0.16, relief: 0.24, notch: 0.22 },
  { x: -0.12, y: 0.31, z: 0.03, width: 0.38, depth: 0.3, height: 0.32, tilt: 0.06, twist: -0.12, relief: 0.48, notch: 0.16 },
  { x: 0.38, y: 0.3, z: -0.03, width: 0.34, depth: 0.27, height: 0.26, tilt: 0.18, twist: 0.18, relief: 0.38, notch: 0.28 }
];

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const asInt = (value, fallback = -1) => Number.isInteger(Number(value)) ? Math.trunc(Number(value)) : fallback;
const boundedFacet = (value, fallback = -1) => clamp(asInt(value, fallback), 0, FACET_COUNT - 1);

function makeFacets() {
  return BASE_FACETS.map((base, id) => ({
    id,
    kind: 'relief-facet',
    state: 'quiet',
    ...base,
    x: round(base.x),
    y: round(base.y),
    z: round(base.z),
    width: round(base.width),
    depth: round(base.depth),
    height: round(base.height),
    tilt: round(base.tilt),
    twist: round(base.twist),
    relief: round(base.relief),
    notch: round(base.notch)
  }));
}

function countsFor(memory) {
  const counts = Array.from({ length: FACET_COUNT }, () => 0);
  memory.forEach((event) => { counts[event.lookedAt] += 1; });
  return counts;
}

function nextDistinct(start, excluded) {
  let value = ((start % FACET_COUNT) + FACET_COUNT) % FACET_COUNT;
  while (excluded.includes(value)) value = (value + 1) % FACET_COUNT;
  return value;
}

function leastObserved(counts, excluded, start) {
  const allowed = Array.from({ length: FACET_COUNT }, (_, id) => id).filter((id) => !excluded.includes(id));
  const minimum = Math.min(...allowed.map((id) => counts[id]));
  return allowed.find((id) => counts[id] === minimum && ((id - start + FACET_COUNT) % FACET_COUNT) >= 0 && id >= 0) ?? allowed[0];
}

function targetsFor(lookedAt, memory) {
  const counts = countsFor(memory);
  const falseCopy = leastObserved(counts, [lookedAt], (memory.length * 2 + 1) % FACET_COUNT);
  const missing = nextDistinct(falseCopy + 3 + memory.length, [lookedAt, falseCopy]);
  const ridge = nextDistinct(missing + 2, [lookedAt, falseCopy, missing]);
  return { falseCopy, missing, ridge };
}

function applyObservation(facets, event) {
  const looked = facets[event.lookedAt];
  const copy = facets[event.falseCopy];
  const missing = facets[event.missing];
  const ridge = facets[event.ridge];
  const pressure = 0.1 + (event.dwell - MIN_DWELL) / 6000 + event.memoryIndex * 0.025;

  looked.state = 'observed';
  looked.height = round(Math.max(0.05, looked.height - pressure * 0.42));
  looked.tilt = round(looked.tilt + (looked.id % 2 ? -pressure : pressure));
  looked.notch = round(clamp(looked.notch + 0.11 + event.memoryIndex * 0.02, 0, 0.94));

  copy.state = 'false-copy';
  copy.height = round(Math.min(0.68, looked.height + 0.16 + event.memoryIndex * 0.018));
  copy.relief = round(looked.relief);
  copy.twist = round(looked.twist - 0.28 - pressure * 0.2);
  copy.notch = round(clamp(looked.notch * 0.72, 0.04, 0.92));
  copy.z = round(copy.z + 0.08);

  missing.state = 'missing';
  missing.height = 0.018;
  missing.relief = 0.02;
  missing.notch = round(clamp(missing.notch + 0.38 + event.memoryIndex * 0.03, 0, 0.98));
  missing.z = round(missing.z - 0.055);

  ridge.state = 'remembering';
  ridge.height = round(ridge.height + 0.055 + event.memoryIndex * 0.01);
  ridge.tilt = round(ridge.tilt + (ridge.id % 2 ? 0.1 : -0.1));
  ridge.relief = round(clamp(ridge.relief + 0.1, 0, 0.98));
}

function buildSurface(memory) {
  const facets = makeFacets();
  memory.slice(-MEMORY_WINDOW).forEach((event) => applyObservation(facets, event));
  return facets;
}

function makeState(stage, memory, interaction = 'idle', pending = [], previousMemory = null, previousStage = null) {
  const bounded = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'false-reconstruction',
    stage: clamp(asInt(stage, 0), 0, MEMORY_WINDOW),
    memory: bounded,
    pending: pending.slice(0, 1),
    previousMemory,
    previousStage,
    surface: 'single-relief-model',
    attention: countsFor(bounded),
    facets: buildSurface(bounded),
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return makeState(stage, memory, 'idle');
}

export function observationIsValid(observation = {}) {
  const facet = asInt(observation.facet);
  const dwell = Number(observation.dwell);
  return facet >= 0 && facet < FACET_COUNT && Number.isFinite(dwell) && dwell >= MIN_DWELL;
}

export function armFacet(state, input = {}) {
  const facet = asInt(input.facet);
  if (facet < 0 || facet >= FACET_COUNT || state.pending.length) {
    return makeState(state.stage, state.memory, 'facet-refused', []);
  }
  return makeState(state.stage, state.memory, 'facet-armed', [facet], state.previousMemory, state.previousStage);
}

export function commitObservation(state, input = {}) {
  const facet = asInt(input.facet ?? state.pending[0]);
  const dwell = Number(input.dwell);
  if (!observationIsValid({ facet, dwell })) {
    return makeState(state.stage, state.memory, 'observation-refused', state.pending, state.previousMemory, state.previousStage);
  }
  const targets = targetsFor(facet, state.memory);
  const event = {
    kind: 'false-reconstruction',
    lookedAt: facet,
    ...targets,
    dwell: Math.min(2600, Math.round(dwell)),
    memoryIndex: state.memory.length
  };
  return makeState(state.stage + 1, [...state.memory, event], 'observation-committed', [], state.memory, state.stage);
}

export function liftLatestObservation(state) {
  if (!state.memory.length) return makeState(state.stage, [], 'observation-lifted');
  const previousMemory = state.previousMemory ?? state.memory.slice(0, -1);
  const previousStage = state.previousStage ?? Math.max(0, state.stage - 1);
  return makeState(previousStage, previousMemory, 'observation-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], 'memory-released');
}

export function geometrySignature(value) {
  const facets = value.facets ?? value.surface?.facets ?? [];
  return facets.map((facet) => [
    facet.id, facet.state, round(facet.x), round(facet.y), round(facet.z),
    round(facet.width), round(facet.depth), round(facet.height), round(facet.tilt),
    round(facet.twist), round(facet.relief), round(facet.notch)
  ].join(':')).join('|');
}

export function buildTimeline() {
  return [4, 1, 7, 0];
}

export { SEED, FACET_COUNT, MEMORY_WINDOW, MIN_DWELL };
