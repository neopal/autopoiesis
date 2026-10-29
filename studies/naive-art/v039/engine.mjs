const SEED = '0x4e413339';
const COLS = 26;
const ROWS = 18;
const CELL_COUNT = COLS * ROWS;
const MEMORY_WINDOW = 4;
const MIN_CONFIDENCE = 0.22;
const MAX_CONFIDENCE = 0.92;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(Number(value) * 10000) / 10000;
const validCell = (value) => Number.isInteger(value) && value >= 0 && value < CELL_COUNT;
const indexOf = (row, col) => row * COLS + col;
const rowOf = (cell) => Math.floor(cell / COLS);
const colOf = (cell) => cell % COLS;

function baseCell(index) {
  const row = rowOf(index);
  const col = colOf(index);
  const x = (col + 0.5) / COLS;
  const y = (row + 0.5) / ROWS;
  const diagonal = Math.exp(-Math.pow(y - (0.22 + x * 0.58), 2) / 0.035);
  const pocket = Math.exp(-Math.pow(x - 0.73, 2) / 0.04 - Math.pow(y - 0.28, 2) / 0.08);
  const low = Math.exp(-Math.pow(x - 0.18, 2) / 0.05 - Math.pow(y - 0.78, 2) / 0.04);
  const value = clamp(Math.round(0.6 + diagonal * 3.2 + pocket * 2.1 - low * 1.4 + ((row * 5 + col * 3) % 4) * 0.16), 0, 5);
  return {
    id: index,
    row,
    col,
    x: round(x),
    y: round(y),
    value,
    tone: (row * 7 + col * 11 + value) % 6,
    weight: round(0.58 + ((row * 13 + col * 17) % 9) * 0.035),
    offsetX: round((((row * 19 + col * 7) % 9) - 4) * 0.003),
    offsetY: round((((row * 5 + col * 23) % 7) - 3) * 0.003),
    notch: (row * 3 + col * 5) % 5 === 0 ? 1 : 0,
    phase: round(((row * 29 + col * 31) % 17) / 17),
    role: 'quiet'
  };
}

const BASE_CELLS = Array.from({ length: CELL_COUNT }, (_, index) => baseCell(index));
const clone = (value) => JSON.parse(JSON.stringify(value));

function distanceBetween(a, b) {
  return Math.hypot((colOf(a) - colOf(b)) / (COLS - 1), (rowOf(a) - rowOf(b)) / (ROWS - 1));
}

function remoteIndex(source, stage, offset, used = new Set()) {
  let candidate = (source + offset + stage * 47) % CELL_COUNT;
  for (let attempt = 0; attempt < CELL_COUNT; attempt += 1) {
    if (candidate !== source && !used.has(candidate) && distanceBetween(source, candidate) >= 0.24) return candidate;
    candidate = (candidate + 37) % CELL_COUNT;
  }
  return (source + 1) % CELL_COUNT;
}

function materialise(memory) {
  const cells = BASE_CELLS.map((cell) => ({ ...cell }));
  const trace = {
    memoryCount: memory.length,
    changedCellCount: 0,
    lastCell: memory.at(-1)?.cell ?? null,
    lastTarget: memory.at(-1)?.target ?? null,
    lastVoid: memory.at(-1)?.vacancy ?? null,
    generation: memory.length
  };

  for (const event of memory.slice(-MEMORY_WINDOW)) applyEvent(cells, event);
  trace.changedCellCount = cells.reduce((count, cell, index) => count + (cellSignature(cell) === cellSignature(BASE_CELLS[index]) ? 0 : 1), 0);
  return { cells, trace, cols: COLS, rows: ROWS };
}

function applyEvent(cells, event) {
  const source = cells[event.cell];
  const target = cells[event.target];
  const vacancy = cells[event.vacancy];
  const echo = cells[event.echo];
  const confidence = clamp(event.confidence, MIN_CONFIDENCE, MAX_CONFIDENCE);

  // The selected cell is deliberately not mutated: the error is an inference elsewhere.
  target.role = 'wrong-patch';
  target.value = (source.value + 2 + event.memoryIndex) % 6;
  target.tone = (source.tone + 3 + event.memoryIndex) % 6;
  target.weight = round(target.weight + 0.22 + confidence * 0.18);
  target.offsetX = round(target.offsetX + 0.018 + event.memoryIndex * 0.004);
  target.offsetY = round(target.offsetY - 0.014 - confidence * 0.018);
  target.notch = 1;
  target.phase = round((source.phase + 0.31 + event.memoryIndex * 0.07) % 1);

  vacancy.role = 'false-void';
  vacancy.value = 0;
  vacancy.tone = (vacancy.tone + 5) % 6;
  vacancy.weight = round(Math.max(0.18, vacancy.weight - 0.3 - confidence * 0.12));
  vacancy.offsetX = round(vacancy.offsetX - 0.02 - event.memoryIndex * 0.003);
  vacancy.offsetY = round(vacancy.offsetY + 0.016);
  vacancy.notch = 1;

  echo.role = 'remembering-edge';
  echo.value = Math.min(5, echo.value + 1 + (event.memoryIndex % 2));
  echo.tone = (echo.tone + 1) % 6;
  echo.weight = round(echo.weight + 0.1);
  echo.offsetX = round(echo.offsetX + (event.memoryIndex % 2 ? -0.012 : 0.012));
  echo.offsetY = round(echo.offsetY + 0.012);
  echo.notch = 1;

  // A small neighboring cell carries the cadence, making the mistake a local rule change rather than a marker.
  const neighbor = cells[indexOf(rowOf(event.target), Math.min(COLS - 1, colOf(event.target) + 1))];
  if (neighbor.id !== event.cell && neighbor.id !== event.vacancy && neighbor.id !== event.echo) {
    neighbor.role = 'miscount-ripple';
    neighbor.value = (neighbor.value + event.memoryIndex + 1) % 6;
    neighbor.weight = round(neighbor.weight + 0.08);
    neighbor.offsetY = round(neighbor.offsetY - 0.01);
  }
}

function stateFrom(memory, interaction = 'idle', pending = null) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'cellular-miscount',
    surface: 'low-resolution-inference-plate',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    pending: pending ? { cell: pending.cell } : null,
    interaction,
    scene: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }

export function cellSignature(cell) {
  return [
    cell.id,
    cell.row,
    cell.col,
    cell.x,
    cell.y,
    cell.value,
    cell.tone,
    cell.weight,
    cell.offsetX,
    cell.offsetY,
    cell.notch,
    cell.phase,
    cell.role
  ].join(':');
}

export function geometrySignature(state) {
  return state.scene.cells.map(cellSignature).join('|');
}

export function beginRead(state, { cell } = {}) {
  if (!validCell(cell)) return stateFrom(state.memory, 'read-refused-invalid');
  return stateFrom(state.memory, 'read-armed', { cell });
}

function eventFor(cell, confidence, memoryIndex) {
  const target = remoteIndex(cell, memoryIndex, 173);
  const used = new Set([cell, target]);
  const vacancy = remoteIndex(cell, memoryIndex, 61, used);
  used.add(vacancy);
  const echo = remoteIndex(cell, memoryIndex, 311, used);
  return {
    kind: 'cellular-miscount',
    cell,
    target,
    vacancy,
    echo,
    distance: round(distanceBetween(cell, target)),
    confidence: round(confidence),
    memoryIndex
  };
}

export function commitRead(state, { cell, confidence } = {}) {
  const selected = cell ?? state.pending?.cell;
  if (!validCell(selected)) return stateFrom(state.memory, 'read-refused-invalid', state.pending);
  const level = Number(confidence);
  if (!Number.isFinite(level) || level < MIN_CONFIDENCE) return stateFrom(state.memory, 'read-refused-light', state.pending);
  if (level > MAX_CONFIDENCE) return stateFrom(state.memory, 'read-refused-heavy', state.pending);
  const event = eventFor(selected, level, state.memory.length);
  return stateFrom([...state.memory, event], 'read-committed');
}

export function liftLatestRead(state) {
  if (!state.memory.length) return stateFrom([], 'read-lifted');
  return stateFrom(state.memory.slice(0, -1), 'read-lifted');
}

export function releaseMemory() { return stateFrom([], 'memory-released'); }

export function buildTimeline() {
  return [
    { cell: 74, confidence: 0.58 },
    { cell: 191, confidence: 0.42 },
    { cell: 330, confidence: 0.67 },
    { cell: 411, confidence: 0.51 }
  ];
}

export {
  CELL_COUNT,
  COLS,
  MAX_CONFIDENCE,
  MEMORY_WINDOW,
  MIN_CONFIDENCE,
  ROWS,
  SEED
};
