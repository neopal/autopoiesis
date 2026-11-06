const SEED = '0x4e413435';
export const CAVITY_COUNT = 6;
export const MEMORY_WINDOW = 4;

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clone = (value) => JSON.parse(JSON.stringify(value));
const validSite = (value) => Number.isInteger(value) && value >= 0 && value < CAVITY_COUNT;

// One continuous slab: its six apertures are not cards or agents, but chambers in a single wrong object.
const CAVITY_LAYOUT = [
  [-0.43, -0.47, 0.19, 0.14, -12, 'pinched'],
  [0.08, -0.5, 0.18, 0.2, 9, 'tall'],
  [0.47, -0.16, 0.2, 0.15, 24, 'side-cut'],
  [0.12, 0.28, 0.24, 0.16, -8, 'low'],
  [-0.36, 0.32, 0.2, 0.2, 14, 'deep'],
  [-0.57, -0.04, 0.16, 0.17, -25, 'narrow']
];

export const PRESSURE_SITES = CAVITY_LAYOUT.map(([x, y]) => ({ x, y }));

const SHELL = [
  { x: -0.78, y: -0.64 },
  { x: -0.2, y: -0.78 },
  { x: 0.45, y: -0.68 },
  { x: 0.78, y: -0.22 },
  { x: 0.69, y: 0.43 },
  { x: 0.17, y: 0.72 },
  { x: -0.47, y: 0.64 },
  { x: -0.8, y: 0.23 }
];

function baseCavity(index) {
  const [x, y, width, height, rotation, kind] = CAVITY_LAYOUT[index];
  return { id: index, x, y, width, height, rotation, kind, role: 'cavity' };
}

const BASE_CAVITIES = Array.from({ length: CAVITY_COUNT }, (_, index) => baseCavity(index));

export function cavitySignature(cavity) {
  return [
    cavity.id,
    round(cavity.x),
    round(cavity.y),
    round(cavity.width),
    round(cavity.height),
    round(cavity.rotation),
    cavity.kind,
    cavity.role
  ].join(':');
}

function membraneSignature(membrane) {
  return [
    membrane.id,
    membrane.sourceSite,
    membrane.targetSite,
    round(membrane.pressure),
    round(membrane.returnAngle),
    membrane.bias,
    membrane.points.map((point) => `${round(point.x)},${round(point.y)}`).join(';')
  ].join(':');
}

export function geometrySignature(state) {
  return [
    JSON.stringify(state.scene.shell.map((point) => ({ x: round(point.x), y: round(point.y) }))),
    ...state.scene.cavities.map(cavitySignature),
    ...state.scene.membranes.map(membraneSignature)
  ].join('|');
}

function eventFor(gesture, memoryIndex) {
  const first = gesture.samples[0];
  const last = gesture.samples.at(-1);
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const returnAngle = Math.atan2(dy, dx);
  const pressure = Math.max(...gesture.samples.map((sample) => sample.pressure));
  const bias = ['sealed', 'slipped', 'hollowed', 'borrowed'][memoryIndex % 4];
  const targetSite = (gesture.site + 2 + memoryIndex * 2) % CAVITY_COUNT;
  return {
    kind: 'false-membrane',
    sourceSite: gesture.site,
    targetSite: targetSite === gesture.site ? (targetSite + 1) % CAVITY_COUNT : targetSite,
    memoryIndex,
    pressure: round(pressure),
    returnAngle: round(returnAngle),
    bias,
    seed: gesture.site * 31 + memoryIndex * 53 + Math.round(pressure * 100)
  };
}

function membraneFor(event) {
  const cavity = BASE_CAVITIES[event.targetSite];
  const spread = 0.055 + event.pressure * 0.07 + (event.memoryIndex % 3) * 0.012;
  const twist = event.returnAngle * 0.12 + (event.seed % 7) * 0.08;
  const count = 7 + event.memoryIndex;
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * 2 * index / count + twist;
    const uneven = 1 + Math.sin((index + 1) * (event.seed + 7) * 0.11) * (0.12 + event.memoryIndex * 0.025);
    points.push({
      x: round(cavity.x + Math.cos(angle) * spread * (1.15 + event.memoryIndex * 0.06) * uneven),
      y: round(cavity.y + Math.sin(angle) * spread * 0.74 * uneven)
    });
  }
  return { ...event, points };
}

function materialise(memory) {
  const cavities = BASE_CAVITIES.map((cavity) => ({ ...cavity }));
  const membranes = memory.slice(-MEMORY_WINDOW).map(membraneFor);
  return {
    shell: SHELL.map((point) => ({ ...point })),
    cavities,
    membranes,
    trace: {
      memoryCount: memory.length,
      membraneCount: membranes.length,
      changedCavityCount: cavities.reduce((count, cavity, index) => count + (cavitySignature(cavity) === cavitySignature(BASE_CAVITIES[index]) ? 0 : 1), 0),
      lastSourceSite: memory.at(-1)?.sourceSite ?? null,
      lastTargetSite: membranes.at(-1)?.targetSite ?? null
    },
    cavityCount: CAVITY_COUNT
  };
}

function stateFrom(memory, interaction = 'idle', gesture = null, focus = 0) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'pressure-membrane-slab',
    surface: 'canvas-single-object',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    gesture: gesture ? clone(gesture) : null,
    focus,
    interaction,
    scene: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }

export function beginPressure(state, point) {
  const site = PRESSURE_SITES.findIndex((candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y) <= 0.11);
  if (site < 0) return stateFrom(state.memory, 'pressure-refused-outside', null, state.focus ?? 0);
  return stateFrom(state.memory, 'pressure-started', { site, samples: [] }, site);
}

export function pressureSample(state, sample) {
  if (!state.gesture) return stateFrom(state.memory, 'pressure-refused-idle', null, state.focus ?? 0);
  const pressure = clamp(Number(sample.pressure), 0, 1);
  const nextSample = { x: round(Number(sample.x)), y: round(Number(sample.y)), pressure: round(pressure) };
  const gesture = { ...state.gesture, samples: [...state.gesture.samples, nextSample] };
  return stateFrom(state.memory, 'pressure-sampled', gesture, state.focus ?? 0);
}

function pressureFailure(state) {
  if (!state.gesture) return 'pressure-refused-dwell';
  const maxPressure = state.gesture.samples.length
    ? Math.max(...state.gesture.samples.map((sample) => sample.pressure))
    : 0;
  if (maxPressure < 0.55) return 'pressure-refused-weak';
  if (state.gesture.samples.length < 2) return 'pressure-refused-one-way';
  const first = state.gesture.samples[0];
  const last = state.gesture.samples.at(-1);
  const site = PRESSURE_SITES[state.gesture.site];
  const firstVector = { x: first.x - site.x, y: first.y - site.y };
  const lastVector = { x: last.x - site.x, y: last.y - site.y };
  const dot = firstVector.x * lastVector.x + firstVector.y * lastVector.y;
  if (Math.hypot(firstVector.x, firstVector.y) < 0.025 || dot > -0.0004) return 'pressure-refused-one-way';
  return null;
}

export function releasePressure(state) {
  if (!state.gesture) return stateFrom(state.memory, 'pressure-refused-idle', null, state.focus ?? 0);
  const failure = pressureFailure(state);
  if (failure) return stateFrom(state.memory, failure, null, state.focus ?? 0);
  const event = eventFor(state.gesture, state.memory.length);
  return stateFrom([...state.memory, event], 'pressure-committed', null, state.focus ?? 0);
}

export function liftLatestPressure(state) {
  return stateFrom(state.memory.slice(0, -1), 'pressure-lifted', null, state.focus ?? 0);
}

export function releaseMemory() { return stateFrom([], 'memory-released'); }

export function buildTimeline() {
  return [
    { site: 0, samples: [{ x: -0.3, y: -0.47, pressure: 0.74 }, { x: -0.47, y: -0.42, pressure: 0.7 }] },
    { site: 2, samples: [{ x: 0.56, y: -0.16, pressure: 0.83 }, { x: 0.38, y: -0.12, pressure: 0.78 }] },
    { site: 4, samples: [{ x: -0.29, y: 0.25, pressure: 0.66 }, { x: -0.44, y: 0.37, pressure: 0.72 }] },
    { site: 1, samples: [{ x: 0.19, y: -0.52, pressure: 0.91 }, { x: -0.01, y: -0.44, pressure: 0.87 }] }
  ];
}

export { SEED };
