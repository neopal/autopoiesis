const SEED = '0x4e413436';
export const THROAT_COUNT = 7;
export const MEMORY_LIMIT = 4;
export const ECHO_THRESHOLD_MS = 720;
const MOTION_LIMIT = 0.08;

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clone = (value) => JSON.parse(JSON.stringify(value));
const validThroat = (value) => Number.isInteger(value) && value >= 0 && value < THROAT_COUNT;

// Seven suspended throats make one asymmetrical vessel. They are resonant cuts in a body, not a population of agents.
const THROAT_LAYOUT = [
  [-0.48, -0.42, 0.18, 0.29, -24, 'north-fold'],
  [-0.12, -0.52, 0.21, 0.24, 8, 'high-slit'],
  [0.31, -0.39, 0.2, 0.27, 29, 'leaning-mouth'],
  [0.5, 0.02, 0.19, 0.22, 74, 'side-throat'],
  [0.2, 0.43, 0.24, 0.2, 154, 'low-mouth'],
  [-0.24, 0.48, 0.2, 0.25, 188, 'south-fold'],
  [-0.56, 0.08, 0.17, 0.22, 252, 'west-throat']
];

const SHELL = [
  { x: -0.72, y: -0.6, z: 0.02 },
  { x: -0.2, y: -0.79, z: 0.08 },
  { x: 0.36, y: -0.67, z: -0.03 },
  { x: 0.76, y: -0.2, z: 0.05 },
  { x: 0.67, y: 0.38, z: 0.02 },
  { x: 0.16, y: 0.72, z: -0.04 },
  { x: -0.46, y: 0.66, z: 0.06 },
  { x: -0.79, y: 0.19, z: -0.02 }
];

function baseThroat(index) {
  const [x, y, width, height, rotation, kind] = THROAT_LAYOUT[index];
  return {
    id: index,
    x,
    y,
    z: round(Math.sin(index * 1.73) * 0.12),
    width,
    height,
    rotation,
    kind,
    role: 'throat',
    echoDepth: 0,
    echoBias: 0
  };
}

const BASE_THROATS = Array.from({ length: THROAT_COUNT }, (_, index) => baseThroat(index));

function eventFor(gesture, memoryIndex) {
  const sourceThroat = gesture.throat;
  const targetThroat = (sourceThroat + 2 + memoryIndex * 2) % THROAT_COUNT;
  const bias = ['borrowed', 'overheard', 'returned', 'invented'][memoryIndex % 4];
  return {
    type: 'misheard-echo',
    sourceThroat,
    targetThroat: targetThroat === sourceThroat ? (targetThroat + 1) % THROAT_COUNT : targetThroat,
    heldMs: ECHO_THRESHOLD_MS,
    stillness: round(1 - clamp(gesture.motion ?? 0, 0, 1)),
    bias,
    memoryIndex,
    seed: sourceThroat * 41 + memoryIndex * 67 + 19
  };
}

function echoFor(event) {
  const source = BASE_THROATS[event.sourceThroat];
  const target = BASE_THROATS[event.targetThroat];
  const depth = 0.14 + event.memoryIndex * 0.035;
  const skew = ((event.seed % 9) - 4) * 0.012;
  const points = [
    { x: round(target.x - target.width * 0.44 + skew), y: round(target.y - target.height * 0.42) },
    { x: round(target.x + target.width * 0.39 + depth * 0.22), y: round(target.y - target.height * 0.19) },
    { x: round(target.x + target.width * 0.31), y: round(target.y + target.height * 0.48 + depth * 0.16) },
    { x: round(target.x - target.width * 0.35 - depth * 0.18), y: round(target.y + target.height * 0.37) }
  ];
  return {
    ...event,
    sourceKind: source.kind,
    points,
    depth: round(depth),
    skew: round(skew)
  };
}

function materialise(memory) {
  const throats = BASE_THROATS.map((throat) => ({ ...throat }));
  const echoes = memory.slice(-MEMORY_LIMIT).map(echoFor);
  for (const echo of echoes) {
    const throat = throats[echo.targetThroat];
    throat.x = round(throat.x + echo.skew + echo.depth * 0.24);
    throat.y = round(throat.y - echo.depth * 0.18);
    throat.z = round(throat.z + echo.depth);
    throat.width = round(throat.width * (1 - echo.depth * 0.3));
    throat.height = round(throat.height * (1 + echo.depth * 0.58));
    throat.rotation = round(throat.rotation + echo.skew * 180 + echo.memoryIndex * 3);
    throat.echoDepth = round(throat.echoDepth + echo.depth);
    throat.echoBias = echo.memoryIndex + 1;
    throat.role = 'echo-throat';
  }
  return {
    shell: SHELL.map((point) => ({ ...point })),
    throats,
    echoes,
    throatCount: THROAT_COUNT,
    trace: {
      memoryCount: memory.length,
      echoCount: echoes.length,
      lastSourceThroat: memory.at(-1)?.sourceThroat ?? null,
      lastTargetThroat: echoes.at(-1)?.targetThroat ?? null
    }
  };
}

function stateFrom(memory, interaction = 'idle', pending = null) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT);
  return {
    seed: SEED,
    grammar: 'stillness-echo-vessel',
    surface: 'p5-webgl-suspended-vessel',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    memoryLimit: MEMORY_LIMIT,
    pending: pending ? clone(pending) : { active: false, throat: null, elapsedMs: 0, motion: 0 },
    interaction,
    event: interaction === 'stillness-committed' ? clone(boundedMemory.at(-1)) : null,
    body: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }

export function geometrySignature(state) {
  return JSON.stringify({
    shell: state.body.shell,
    throats: state.body.throats,
    echoes: state.body.echoes
  });
}

export function beginStillness(state, throat) {
  if (!validThroat(throat)) return stateFrom(state.memory, 'stillness-refused-target');
  return stateFrom(state.memory, 'stillness-started', {
    active: true,
    throat,
    elapsedMs: 0,
    motion: 0
  });
}

export function tickStillness(state, elapsedMs, motion = 0) {
  if (!state.pending?.active) return stateFrom(state.memory, 'stillness-refused-idle');
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const movement = Math.max(Math.abs(Number(motion) || 0), state.pending.motion || 0);
  return stateFrom(state.memory, movement > MOTION_LIMIT ? 'stillness-moved' : 'stillness-held', {
    ...state.pending,
    elapsedMs: Math.min(ECHO_THRESHOLD_MS * 2, (state.pending.elapsedMs || 0) + elapsed),
    motion: round(movement)
  });
}

export function releaseStillness(state) {
  if (!state.pending?.active) return stateFrom(state.memory, 'stillness-refused-idle');
  if (state.pending.motion > MOTION_LIMIT) return stateFrom(state.memory, 'stillness-refused-motion');
  if (state.pending.elapsedMs < ECHO_THRESHOLD_MS) return stateFrom(state.memory, 'stillness-refused-short');
  const event = eventFor(state.pending, state.memory.length);
  return stateFrom([...state.memory, event], 'stillness-committed');
}

export function liftLatest(state) {
  return stateFrom(state.memory.slice(0, -1), 'stillness-lifted');
}

export function releaseMemory() { return stateFrom([], 'memory-released'); }

export function buildTimeline() {
  const gestures = [
    { throat: 0 },
    { throat: 2 },
    { throat: 4 },
    { throat: 6 }
  ];
  const frames = [buildFrame()];
  for (const gesture of gestures) {
    let frame = beginStillness(frames.at(-1), gesture.throat);
    frame = tickStillness(frame, ECHO_THRESHOLD_MS, 0);
    frames.push(releaseStillness(frame));
  }
  return frames;
}

export { SEED };
