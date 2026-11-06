export const SEED = 0x57473045;
export const COLS = 12;
export const ROWS = 6;
export const CELL_COUNT = COLS * ROWS;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const LOAD_THRESHOLD_MS = 640;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 19.173 + SEED * 0.000013) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizeIndex = (value, fallback = 0) => integer(value, fallback, 0, CELL_COUNT - 1);
const cellCoords = (index) => ({ col: index % COLS, row: Math.floor(index / COLS) });
const cloneCell = (cell) => ({ ...cell });
const cloneMemory = (memory) => memory.map((event) => ({ ...event }));

const baseCells = () => Array.from({ length: CELL_COUNT }, (_, index) => {
  const { col, row } = cellCoords(index);
  const edge = Math.min(col, COLS - 1 - col, row, ROWS - 1 - row);
  return {
    id: index,
    col,
    row,
    x: round((col - (COLS - 1) / 2) * 0.155),
    y: round((row - (ROWS - 1) / 2) * 0.19),
    height: round(0.18 + pseudo(index + 3) * 0.18 + edge * 0.012),
    layers: 2 + Math.floor(pseudo(index + 29) * 2),
    shear: round((pseudo(index + 53) - 0.5) * 0.05),
    ridge: round(0.12 + pseudo(index + 71) * 0.25),
    porosity: round(0.2 + pseudo(index + 89) * 0.35),
    phase: round(pseudo(index + 107) * Math.PI * 2),
    load: 0
  };
});

const normalizeEvent = (event = {}, serial = 0) => {
  const sourceIndex = normalizeIndex(event.sourceIndex, wrap(7 + serial * 11, CELL_COUNT));
  const dwellMs = integer(event.dwellMs, LOAD_THRESHOLD_MS + 120 + serial * 40, LOAD_THRESHOLD_MS, 3000);
  return {
    id: `sediment-load-${serial + 1}`,
    type: 'sediment-load',
    sourceIndex,
    dwellMs,
    loadBand: integer(event.loadBand, 1 + ((dwellMs - LOAD_THRESHOLD_MS) > 180 ? 1 : 0), 1, 3),
    direction: finite(event.direction, serial % 2 === 0 ? 1 : -1) < 0 ? -1 : 1,
    serial,
    reason: event.reason ?? 'charge-release'
  };
};
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : []).slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const applyLoad = (cells, event) => {
  const source = cellCoords(event.sourceIndex);
  const force = 0.11 + event.loadBand * 0.045 + event.serial * 0.012;
  return cells.map((cell) => {
    if (cell.id === event.sourceIndex) return cloneCell(cell);
    const distance = Math.hypot(cell.col - source.col, (cell.row - source.row) * 1.2);
    const wave = Math.exp(-distance * 0.42);
    const checker = ((cell.col + cell.row + event.serial) % 2 === 0 ? 1 : -1) * event.direction;
    const compaction = force * wave * checker;
    const shear = force * wave * (cell.col - source.col) * 0.035 * event.direction;
    const layerDelta = ((cell.col * 3 + cell.row + event.serial) % 4 === 0 ? 1 : 0) + (distance < 2.4 && event.loadBand === 3 ? 1 : 0);
    return {
      ...cell,
      height: round(clamp(cell.height + compaction, 0.08, 0.86)),
      layers: clamp(cell.layers + layerDelta, 2, 7),
      shear: round(clamp(cell.shear + shear, -0.28, 0.28)),
      ridge: round(clamp(cell.ridge + Math.abs(compaction) * 0.9 + wave * 0.015, 0.08, 0.92)),
      porosity: round(clamp(cell.porosity + (checker > 0 ? wave : -wave) * 0.045, 0.04, 0.9)),
      load: round(clamp(cell.load + wave * event.loadBand * 0.28, 0, 1))
    };
  });
};

const buildField = (memory) => {
  let cells = baseCells();
  const layers = [];
  normalizeMemory(memory).forEach((event) => {
    cells = applyLoad(cells, event);
    layers.push({ ...event });
  });
  const field = {
    kind: 'sediment-strata',
    cols: COLS,
    rows: ROWS,
    cells,
    layers,
    signature: ''
  };
  field.signature = JSON.stringify({ cells: field.cells, layers: field.layers });
  return field;
};

const frameFrom = (memory, lastAction = 'quiet', gesture = null, pending = null, event = null) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'sediment-strata',
    renderer: 'deterministic p5.js 1.11.3 WEBGL stratigraphic mass',
    stage: normalizedMemory.length,
    memory: normalizedMemory,
    field: buildField(normalizedMemory),
    gesture,
    pending,
    event,
    lastAction
  };
};

export const buildFrame = (memory = []) => frameFrom(memory);
export const geometrySignature = (frame) => frame?.field?.signature ?? '';

export const beginCharge = (frame, point = {}) => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'charge-refused-memory-limit');
  const sourceIndex = normalizeIndex(point.index, wrap(7 + frame.memory.length * 11, CELL_COUNT));
  const startedAt = finite(point.time, 0);
  const gesture = { sourceIndex, startedAt, updatedAt: startedAt, dwellMs: 0 };
  return frameFrom(frame.memory, 'charge-started', gesture, { sourceIndex, dwellMs: 0 });
};

export const updateCharge = (frame, point = {}) => {
  if (!frame?.gesture) return frame;
  const updatedAt = finite(point.time, frame.gesture.startedAt);
  const dwellMs = Math.max(0, updatedAt - frame.gesture.startedAt);
  const gesture = { ...frame.gesture, updatedAt, dwellMs };
  return frameFrom(frame.memory, dwellMs >= LOAD_THRESHOLD_MS ? 'charge-loaded' : 'charge-building', gesture, { sourceIndex: gesture.sourceIndex, dwellMs });
};

export const cancelCharge = (frame) => frameFrom(frame?.memory ?? [], 'charge-cancelled');

export const finishCharge = (frame, input = {}) => {
  if (!frame?.gesture) return frameFrom(frame?.memory ?? [], 'charge-refused-no-charge');
  const sourceIndex = normalizeIndex(input.index, frame.gesture.sourceIndex);
  const time = finite(input.time, frame.gesture.updatedAt);
  const dwellMs = integer(input.dwellMs, Math.max(0, time - frame.gesture.startedAt), 0, 3000);
  if (!input.confirmed || sourceIndex !== frame.gesture.sourceIndex || dwellMs < LOAD_THRESHOLD_MS) {
    return frameFrom(frame.memory, 'charge-refused-threshold', null, null, { type: 'charge-refused', dwellMs });
  }
  return commitCharge(frame, sourceIndex, dwellMs, input.direction, 'pointer-charge-release');
};

export const commitCharge = (frame, sourceIndex, dwellMs, direction = 1, reason = 'charge-release') => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'charge-refused-memory-limit');
  const event = normalizeEvent({ sourceIndex, dwellMs, direction, reason }, frame.memory.length);
  return frameFrom([...frame.memory, event], 'charge-committed', null, null, event);
};

export const defaultCharge = (frame) => ({
  index: wrap(7 + (frame?.memory?.length ?? 0) * 17, CELL_COUNT),
  dwellMs: LOAD_THRESHOLD_MS + 180 + (frame?.memory?.length ?? 0) * 40
});

export const liftLatestCharge = (frame) => frameFrom((frame?.memory ?? []).slice(0, -1), 'charge-lifted', null, null, { type: 'charge-lifted' });
export const releaseArchive = () => frameFrom([], 'archive-released');

export const buildTimeline = () => {
  const timeline = [buildFrame()];
  for (let serial = 0; serial < MEMORY_LIMIT; serial += 1) {
    const previous = timeline.at(-1);
    const choice = defaultCharge(previous);
    timeline.push(commitCharge(previous, choice.index, choice.dwellMs, serial % 2 === 0 ? 1 : -1, 'timeline'));
  }
  return timeline;
};
