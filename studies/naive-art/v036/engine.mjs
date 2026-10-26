const SEED = '0x4e413336';
const FOLD_COUNT = 11;
const MEMORY_WINDOW = 4;
const MIN_TURN_DISTANCE = 0.24;
const MAX_TURN_DISTANCE = 0.86;

const BASE_FOLDS = [
  [0.10, 0.24, 0.34, 0.66, -10, 0.14, 0.22],
  [0.18, 0.31, 0.30, 0.70, 7, 0.18, 0.31],
  [0.27, 0.39, 0.36, 0.62, -5, 0.21, 0.46],
  [0.36, 0.28, 0.31, 0.74, 11, 0.17, 0.58],
  [0.45, 0.43, 0.38, 0.61, -8, 0.23, 0.69],
  [0.54, 0.34, 0.33, 0.72, 6, 0.19, 0.81],
  [0.63, 0.47, 0.37, 0.59, -12, 0.24, 0.93],
  [0.72, 0.30, 0.30, 0.73, 9, 0.16, 1.04],
  [0.80, 0.42, 0.35, 0.65, -6, 0.22, 1.15],
  [0.88, 0.27, 0.29, 0.70, 8, 0.18, 1.26],
  [0.94, 0.49, 0.32, 0.58, -10, 0.20, 1.37]
].map(([x, y, width, height, rotation, crease, depth], id) => ({
  id,
  x,
  y,
  width,
  height,
  rotation,
  crease,
  depth,
  role: 'quiet'
}));

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const validIndex = (value) => Number.isInteger(value) && value >= 0 && value < FOLD_COUNT;

function foldSignature(fold) {
  return [
    fold.id,
    fold.role,
    round(fold.x),
    round(fold.y),
    round(fold.width),
    round(fold.height),
    round(fold.rotation),
    round(fold.crease),
    round(fold.depth)
  ].join(':');
}

function materialiseFolds(memory) {
  const folds = BASE_FOLDS.map((fold) => ({ ...fold }));
  for (const event of memory.slice(-MEMORY_WINDOW)) applyTurn(folds, event);
  const changedFoldCount = folds.reduce((count, fold, index) => (
    count + (foldSignature(fold) === foldSignature(BASE_FOLDS[index]) ? 0 : 1)
  ), 0);
  return {
    folds,
    trace: {
      changedFoldCount,
      memoryCount: memory.length,
      lastFocus: memory.at(-1)?.focus ?? null,
      lastOpen: memory.at(-1)?.open ?? null,
      lastEcho: memory.at(-1)?.echo ?? null
    }
  };
}

function applyTurn(folds, event) {
  const focus = folds[event.focus];
  const open = folds[event.open];
  const echo = folds[event.echo];
  const pressure = clamp(0.12 + event.distance * 0.38 + event.memoryIndex * 0.025, 0.12, 0.48);
  const direction = event.direction;

  focus.role = 'shut';
  focus.height = clamp(focus.height - pressure * 0.25, 0.24, 0.9);
  focus.width = clamp(focus.width - pressure * 0.06, 0.18, 0.5);
  focus.rotation += direction * (0.14 + pressure * 0.22);
  focus.crease += pressure * 0.9;
  focus.depth -= 0.08;

  open.role = 'invented-open';
  open.x = clamp(open.x + direction * (0.02 + pressure * 0.03), 0.04, 0.96);
  open.y = clamp(open.y - direction * (0.06 + pressure * 0.06), 0.12, 0.86);
  open.width = clamp(open.width + pressure * 0.18, 0.2, 0.58);
  open.height = clamp(open.height + pressure * 0.23, 0.3, 0.94);
  open.rotation = focus.rotation - direction * (0.32 + event.memoryIndex * 0.04);
  open.crease = focus.crease * 0.52 + pressure * 0.48;
  open.depth += 0.17;

  echo.role = 'echo-fold';
  echo.x = clamp(echo.x - direction * pressure * 0.035, 0.04, 0.96);
  echo.y = clamp(echo.y + direction * pressure * 0.05, 0.12, 0.86);
  echo.width = clamp(echo.width + pressure * 0.06, 0.2, 0.52);
  echo.height = clamp(echo.height - pressure * 0.09, 0.28, 0.9);
  echo.rotation = focus.rotation * 0.56 + direction * 0.18;
  echo.crease = focus.crease * 0.62 + pressure * 0.22;
  echo.depth += 0.06;
}

function makeState(memory, interaction = 'idle', pending = [], previousMemory = null) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  const material = materialiseFolds(boundedMemory);
  return {
    seed: SEED,
    grammar: 'false-accordion',
    surface: 'browser-native-fold-page',
    stage: boundedMemory.length,
    memory: boundedMemory,
    pending: pending.length ? { ...pending } : null,
    previousMemory,
    scene: material,
    interaction
  };
}

export function buildFrame() {
  return makeState([]);
}

export function turnIsValid(input = {}) {
  return validIndex(input.focus)
    && (input.direction === 1 || input.direction === -1)
    && Number.isFinite(Number(input.distance))
    && Number(input.distance) >= MIN_TURN_DISTANCE
    && Number(input.distance) <= MAX_TURN_DISTANCE;
}

export function beginTurn(state, input = {}) {
  if (!validIndex(input.focus) || ![1, -1].includes(input.direction)) {
    return makeState(state.memory, 'turn-refused-invalid');
  }
  return makeState(state.memory, 'turn-armed', {
    focus: input.focus,
    direction: input.direction
  }, state.previousMemory);
}

function eventFor(input, memoryIndex) {
  const focus = input.focus;
  const direction = input.direction;
  const open = (focus + 4 + memoryIndex * 2 + (direction < 0 ? 1 : 0)) % FOLD_COUNT;
  let echo = (open + 3 + memoryIndex + (direction < 0 ? 2 : 0)) % FOLD_COUNT;
  while (echo === focus || echo === open) echo = (echo + 1) % FOLD_COUNT;
  return {
    kind: 'false-accordion-turn',
    focus,
    open,
    echo,
    direction,
    distance: round(Number(input.distance)),
    memoryIndex
  };
}

export function commitTurn(state, input = {}) {
  const requested = {
    focus: input.focus ?? state.pending?.focus,
    direction: input.direction ?? state.pending?.direction,
    distance: input.distance
  };
  if (!turnIsValid(requested)) return makeState(state.memory, 'turn-refused-shallow', state.pending ?? [], state.previousMemory);
  const event = eventFor(requested, state.memory.length);
  return makeState([...state.memory, event], 'turn-committed', [], state.memory);
}

export function liftLatestTurn(state) {
  if (!state.memory.length) return makeState([], 'turn-lifted');
  const previousMemory = state.previousMemory ?? state.memory.slice(0, -1);
  return makeState(previousMemory, 'turn-lifted');
}

export function releaseMemory() {
  return makeState([], 'memory-released');
}

export function geometrySignature(state) {
  return state.scene.folds.map(foldSignature).join('|');
}

export function buildTimeline() {
  return [
    { focus: 2, direction: 1, distance: 0.46 },
    { focus: 7, direction: -1, distance: 0.38 },
    { focus: 4, direction: 1, distance: 0.55 },
    { focus: 9, direction: -1, distance: 0.42 }
  ];
}

export { SEED, FOLD_COUNT, MEMORY_WINDOW, MIN_TURN_DISTANCE, MAX_TURN_DISTANCE };
