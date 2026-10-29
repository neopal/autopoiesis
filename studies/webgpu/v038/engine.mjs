export const SEED = 0x57475038;
export const GRID_COLS = 48;
export const GRID_ROWS = 24;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const CELL_COUNT = GRID_COLS * GRID_ROWS;
export const MIN_CONFIRMATION_MS = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.731 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizePoint = (point = {}, fallbackX = 0.5, fallbackY = 0.5) => ({
  x: clamp(finite(point.x, fallbackX), 0, 1),
  y: clamp(finite(point.y, fallbackY), 0, 1)
});

const pointIndex = (point) => {
  const col = integer(Math.floor(point.x * GRID_COLS), 0, GRID_COLS - 1);
  const row = integer(Math.floor(point.y * GRID_ROWS), 0, GRID_ROWS - 1);
  return row * GRID_COLS + col;
};

const cellDistance = (a, b) => {
  const ax = a % GRID_COLS;
  const ay = Math.floor(a / GRID_COLS);
  const bx = b % GRID_COLS;
  const by = Math.floor(b / GRID_COLS);
  return Math.abs(ax - bx) + Math.abs(ay - by);
};

const chooseReceiver = (sourceIndex, targetIndex, serial) => {
  let receiver = wrap(sourceIndex * 29 + targetIndex * 17 + (serial + 1) * 131 + 23, CELL_COUNT);
  if (cellDistance(sourceIndex, receiver) < 9) receiver = wrap(receiver + GRID_COLS * 7 + serial * 11, CELL_COUNT);
  if (receiver === sourceIndex) receiver = wrap(receiver + GRID_COLS * 5 + 3, CELL_COUNT);
  return receiver;
};

const normalizeEvent = (event = {}, serial = 0) => {
  const source = normalizePoint(event.source, 0.18 + (serial % 3) * 0.26, 0.24 + (serial % 2) * 0.48);
  const target = normalizePoint(event.target, 0.72 - (serial % 3) * 0.2, 0.74 - (serial % 2) * 0.42);
  const sourceIndex = pointIndex(source);
  const targetIndex = pointIndex(target);
  const receiverIndex = chooseReceiver(sourceIndex, targetIndex, serial);
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  return {
    id: `signal-${serial + 1}`,
    mode: 'remote-consensus',
    source,
    target,
    sourceIndex,
    targetIndex,
    receiverIndex,
    polarity: dx + dy >= 0 ? 1 : -1,
    reach: round(clamp(Math.hypot(dx, dy), 0.1, 1.4)),
    confirmedAt: round(clamp(finite(event.confirmedAt, 240), MIN_CONFIRMATION_MS, 60000)),
    serial
  };
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const baseCells = () => Array.from({ length: CELL_COUNT }, (_, id) => {
  const col = id % GRID_COLS;
  const row = Math.floor(id / GRID_COLS);
  const x = col / (GRID_COLS - 1);
  const y = row / (GRID_ROWS - 1);
  const basin = Math.sin(x * Math.PI * 2.2 + y * 3.7) * 0.08 + Math.cos(y * Math.PI * 3.1 - x * 2.4) * 0.06;
  return {
    id,
    col,
    row,
    phase: round((pseudo(id + 7) + basin + 1) % 1),
    load: round(clamp(0.38 + pseudo(id + 19) * 0.25 + basin, 0.18, 0.82)),
    gap: round(0.07 + pseudo(id + 43) * 0.17 + Math.abs(basin) * 0.4),
    tilt: round((pseudo(id + 71) - 0.5) * 0.44),
    grain: round(pseudo(id + 89))
  };
});

const buildField = (memory) => {
  let cells = baseCells();
  const relays = [];

  normalizeMemory(memory).forEach((event, serial) => {
    const previous = cells.map((cell) => ({ ...cell }));
    const receiver = event.receiverIndex;
    const source = event.sourceIndex;
    const receiverCell = previous[receiver];
    const receiverCol = receiverCell.col;
    const receiverRow = receiverCell.row;
    const polarity = event.polarity;

    cells = previous.map((cell, index) => {
      const distance = Math.hypot(cell.col - receiverCol, cell.row - receiverRow);
      const influence = Math.exp(-(distance * distance) / (30 + serial * 4));
      const sourceDistance = cellDistance(index, source);
      const sourceQuiet = Math.exp(-(sourceDistance * sourceDistance) / 9);
      const diagonal = Math.sin((cell.col + cell.row) * 0.68 + serial * 1.7 + event.reach * 2.3) * influence;
      const relay = (cell.col * 7 + cell.row * 11 + receiver + serial * 5) % 13 === 0 ? influence * 0.13 : 0;
      const remoteLoad = polarity * influence * (0.34 + serial * 0.035);
      return {
        ...cell,
        load: round(clamp(cell.load + remoteLoad + diagonal * 0.08 - sourceQuiet * 0.015 * polarity, 0.05, 0.98)),
        phase: round((cell.phase + influence * (0.23 + serial * 0.04) + diagonal * 0.05 + 1) % 1),
        gap: round(clamp(cell.gap + influence * (0.15 + serial * 0.018) + relay - sourceQuiet * 0.008, 0.02, 0.92)),
        tilt: round(clamp(cell.tilt + polarity * influence * 0.19 + diagonal * 0.11, -0.92, 0.92))
      };
    });

    cells[source] = { ...cells[source], load: previous[source].load, phase: previous[source].phase };
    relays.push(`${source}>${receiver}:${polarity}:${event.reach.toFixed(3)}`);
  });

  const signature = JSON.stringify({
    relays: relays.join('|') || 'quiet',
    cells: cells.map((cell) => [cell.id, cell.load, cell.phase, cell.gap, cell.tilt])
  });
  return { kind: 'signal-lattice', cells, relays: relays.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], attention = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    attention: attention ? {
      source: normalizePoint(attention.source),
      current: normalizePoint(attention.current ?? attention.source),
      armedAt: finite(attention.armedAt, 0)
    } : null,
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const beginSignal = (frame, input = {}) => {
  const source = normalizePoint(input, 0.5, 0.5);
  return {
    ...frame,
    attention: { source, current: source, armedAt: finite(input.armedAt, 0) },
    lastAction: 'probe-armed'
  };
};

export const aimSignal = (frame, input = {}) => {
  if (!frame.attention) return frame;
  const current = normalizePoint(input, frame.attention.current.x, frame.attention.current.y);
  return { ...frame, attention: { ...frame.attention, current }, lastAction: 'probe-aimed' };
};

export const finishSignal = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, attention: null, lastAction: 'memory-limit' };
  if (!frame.attention) return { ...frame, lastAction: 'signal-refused-no-probe' };
  if (input.confirmed === false) return { ...frame, attention: null, lastAction: 'signal-refused-unconfirmed' };
  const target = normalizePoint(input, frame.attention.current.x, frame.attention.current.y);
  const event = {
    mode: 'remote-consensus',
    source: frame.attention.source,
    target,
    confirmedAt: finite(input.confirmedAt, 240)
  };
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'signal-committed');
};

export const liftLatestSignal = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'signal-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultSignal = (frame) => {
  const positions = [
    { source: { x: 0.15, y: 0.73 }, target: { x: 0.74, y: 0.24 } },
    { source: { x: 0.34, y: 0.22 }, target: { x: 0.79, y: 0.78 } },
    { source: { x: 0.63, y: 0.72 }, target: { x: 0.21, y: 0.35 } },
    { source: { x: 0.82, y: 0.34 }, target: { x: 0.42, y: 0.86 } }
  ];
  return positions[frame.memory.length % positions.length];
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    if (frame.memory.length < MEMORY_LIMIT) {
      const signal = defaultSignal(frame);
      frame = finishSignal(beginSignal(frame, signal.source), { ...signal.target, confirmedAt: 240, confirmed: true });
    }
    timeline.push(buildFrame(stage, frame.memory, null, frame.memory.length ? 'settled-archive' : 'quiet'));
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, cells: frame.field.cells });
export const cellPoints = () => baseCells().map((cell) => ({ id: cell.id, col: cell.col, row: cell.row }));
