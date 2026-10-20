const SEED = '0x4e413331';
const TILE_COUNT = 7;
const MEMORY_WINDOW = 4;
const MIN_PAIR_DWELL = 420;
const MIN_PAIR_DISTANCE = 0.08;
const MAX_PAIR_DISTANCE = 0.82;

const BASE_TILES = [
  { x: -0.58, y: -0.18, z: -0.04, rotX: -0.16, rotY: 0.28, rotZ: -0.08, scale: 0.84, notch: 0.38, fold: 0.18, mark: 'arc' },
  { x: -0.24, y: -0.47, z: 0.08, rotX: 0.22, rotY: -0.18, rotZ: 0.11, scale: 0.72, notch: 0.25, fold: -0.12, mark: 'slash' },
  { x: 0.18, y: -0.37, z: -0.02, rotX: -0.11, rotY: -0.24, rotZ: -0.13, scale: 0.92, notch: 0.56, fold: 0.08, mark: 'loop' },
  { x: 0.56, y: -0.13, z: 0.06, rotX: 0.18, rotY: 0.24, rotZ: 0.07, scale: 0.78, notch: 0.31, fold: 0.2, mark: 'cross' },
  { x: 0.36, y: 0.29, z: 0.02, rotX: -0.2, rotY: 0.14, rotZ: 0.16, scale: 0.88, notch: 0.48, fold: -0.16, mark: 'dot' },
  { x: 0.02, y: 0.46, z: -0.03, rotX: 0.13, rotY: -0.22, rotZ: -0.06, scale: 0.76, notch: 0.22, fold: 0.11, mark: 'step' },
  { x: -0.46, y: 0.28, z: 0.04, rotX: 0.08, rotY: 0.17, rotZ: 0.1, scale: 0.81, notch: 0.62, fold: -0.06, mark: 'hook' }
];

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const boundedTile = (value, fallback = 0) => clamp(int(value, fallback), 0, TILE_COUNT - 1);

function makeTiles() {
  return BASE_TILES.map((base, id) => ({
    id,
    kind: 'paper-witness',
    state: 'quiet',
    ...base
  }));
}

function remoteFor(first, second, memoryIndex) {
  let remote = (first * 2 + second + 3 + memoryIndex) % TILE_COUNT;
  while (remote === first || remote === second) remote = (remote + 1) % TILE_COUNT;
  return remote;
}

function applyAttention(tiles, event) {
  const first = tiles[event.first];
  const second = tiles[event.second];
  const remote = tiles[event.remote];
  const memoryIndex = event.memoryIndex;
  const turn = 0.12 + event.dwell / 6000 + memoryIndex * 0.025;

  first.state = 'averted';
  first.rotY = round(first.rotY - turn * (first.id % 2 ? 1 : -1));
  first.rotX = round(first.rotX + turn * 0.7);
  first.rotZ = round(first.rotZ - turn * 0.35);
  first.fold = round(first.fold - 0.18 - memoryIndex * 0.02);
  first.z = round(first.z - 0.04);

  second.state = 'counterfeit';
  second.mark = first.mark;
  second.rotY = round(second.rotY + turn * 1.1);
  second.rotX = round(second.rotX - turn * 0.55);
  second.rotZ = round(second.rotZ + turn * 0.45);
  second.scale = round(second.scale * (1.03 + memoryIndex * 0.012));
  second.fold = round(second.fold + 0.22);

  remote.state = 'vacant-witness';
  remote.notch = round(clamp(remote.notch + 0.22 + memoryIndex * 0.03, 0, 1));
  remote.rotZ = round(remote.rotZ + (memoryIndex % 2 ? -1 : 1) * (0.2 + turn * 0.4));
  remote.x = round(remote.x + (remote.x < 0 ? -1 : 1) * 0.025);
  remote.y = round(remote.y + (remote.y < 0 ? -1 : 1) * 0.02);
  remote.z = round(remote.z + 0.07);
}

function buildSurface(memory) {
  const tiles = makeTiles();
  memory.slice(-MEMORY_WINDOW).forEach((event) => applyAttention(tiles, event));
  return { tiles };
}

function makeState(stage, memory, interaction = 'idle', previousMemory = null, previousStage = null) {
  const bounded = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'counterfeit-orbit',
    stage: clamp(int(stage), 0, MEMORY_WINDOW),
    memory: bounded,
    previousMemory,
    previousStage,
    surface: 'reciprocal-witness-field',
    tiles: buildSurface(bounded).tiles,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return makeState(stage, memory, 'idle');
}

export function attentionIsValid(attention = {}) {
  const first = int(attention.first, -1);
  const second = int(attention.second, -1);
  const dwell = Number(attention.dwell);
  const distance = Number(attention.distance);
  return first >= 0 && first < TILE_COUNT
    && second >= 0 && second < TILE_COUNT
    && first !== second
    && dwell >= MIN_PAIR_DWELL
    && distance >= MIN_PAIR_DISTANCE
    && distance <= MAX_PAIR_DISTANCE;
}

export function commitAttention(state, attention = {}) {
  const first = boundedTile(attention.first, state.memory.at(-1)?.second ?? 0);
  const second = boundedTile(attention.second, (first + 1) % TILE_COUNT);
  const candidate = { ...attention, first, second };
  if (!attentionIsValid(candidate)) return makeState(state.stage, state.memory, 'attention-refused');
  const event = {
    kind: 'reciprocal-misread',
    first,
    second,
    sourceMark: state.tiles[first].mark,
    copiedMark: state.tiles[first].mark,
    remote: remoteFor(first, second, state.memory.length),
    dwell: Math.min(2600, Math.round(Number(attention.dwell))),
    distance: round(Number(attention.distance)),
    memoryIndex: state.memory.length
  };
  return makeState(state.stage + 1, [...state.memory, event], 'attention-committed', state.memory, state.stage);
}

export function liftLatestAttention(state) {
  if (!state.memory.length) return makeState(state.stage, [], 'attention-lifted');
  const previousMemory = state.previousMemory ?? state.memory.slice(0, -1);
  const previousStage = state.previousStage ?? Math.max(0, state.stage - 1);
  return makeState(previousStage, previousMemory, 'attention-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], 'memory-released');
}

export function geometrySignature(value) {
  const tiles = value.tiles ?? value.surface?.tiles ?? [];
  return tiles.map((tile) => [
    tile.id, tile.state, tile.mark, round(tile.x), round(tile.y), round(tile.z),
    round(tile.rotX), round(tile.rotY), round(tile.rotZ), round(tile.scale),
    round(tile.notch), round(tile.fold)
  ].join(':')).join('|');
}

export function buildTimeline() {
  return [
    { first: 0, second: 3, dwell: 680, distance: 0.42 },
    { first: 4, second: 6, dwell: 740, distance: 0.31 },
    { first: 2, second: 5, dwell: 520, distance: 0.49 },
    { first: 1, second: 4, dwell: 860, distance: 0.28 }
  ];
}

export {
  SEED,
  TILE_COUNT,
  MEMORY_WINDOW,
  MIN_PAIR_DWELL,
  MIN_PAIR_DISTANCE,
  MAX_PAIR_DISTANCE
};
