export const GRID_SIZE = 11;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503037;

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(5));

function seeded(index) {
  const value = Math.sin((index + 1) * 13.731 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function cellIndex(row, col) {
  return Math.max(0, Math.min(CELL_COUNT - 1, row * GRID_SIZE + col));
}

function createCell(index) {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  const distance = Math.hypot(col - 5, row - 5) / 7.78;
  const signal = seeded(index + 31);
  const mass = rounded(Math.max(0.12, 0.86 - distance * 0.3 + (signal - 0.5) * 0.18));
  return {
    index,
    row,
    col,
    mass,
    offset: rounded((seeded(index + 101) - 0.5) * 0.08),
    scale: rounded(0.86 + seeded(index + 151) * 0.22),
    cut: rounded(0.04 + seeded(index + 201) * 0.16),
    tone: seeded(index + 251) > 0.68 ? 'signal' : 'ink',
    state: 'quiet'
  };
}

export function buildBoard() {
  return {
    composition: 'latent-negative',
    revision: 0,
    cells: Array.from({ length: CELL_COUNT }, (_, index) => createCell(index)),
    latent: Array.from({ length: CELL_COUNT }, () => 0),
    memory: [],
    snapshots: [],
    lastOffer: null,
    interaction: 'quiet'
  };
}

export function geometrySignature(board) {
  return JSON.stringify({
    composition: board.composition,
    revision: board.revision,
    cells: board.cells.map((cell) => [
      cell.index,
      cell.mass,
      cell.offset,
      cell.scale,
      cell.cut,
      cell.tone,
      cell.state
    ])
  });
}

export function offerWitness(board, { row = 5, col = 5, pressure = 0.5 } = {}) {
  const next = clone(board);
  const safeRow = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(Number(row) || 0)));
  const safeCol = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(Number(col) || 0)));
  const safePressure = Math.max(0, Math.min(1, Number(pressure) || 0));
  const index = cellIndex(safeRow, safeCol);
  next.lastOffer = {
    row: safeRow,
    col: safeCol,
    index,
    pressure: rounded(safePressure)
  };
  next.latent[index] = rounded(Math.min(1, next.latent[index] + safePressure * 0.22));
  next.interaction = 'witnessed';
  return next;
}

function ensureRemote(candidate, forbidden) {
  let index = candidate % CELL_COUNT;
  while (forbidden.has(index)) index = (index + 1) % CELL_COUNT;
  return index;
}

function mutateCell(cell, role, revision) {
  const next = { ...cell, state: 'quiet' };
  if (role === 'developed') {
    next.mass = rounded(Math.min(1.45, cell.mass + 0.28 + revision * 0.012));
    next.scale = rounded(Math.min(1.42, cell.scale + 0.18));
    next.cut = rounded(Math.max(0.015, cell.cut - 0.025));
    next.state = 'developed';
  } else if (role === 'erased') {
    next.mass = rounded(Math.max(0.025, cell.mass * 0.36));
    next.scale = rounded(Math.max(0.52, cell.scale - 0.17));
    next.cut = rounded(Math.min(0.38, cell.cut + 0.1));
    next.state = 'erased';
  } else if (role === 'registered') {
    next.offset = rounded(cell.offset + (cell.row % 2 ? -0.14 : 0.14));
    next.scale = rounded(Math.min(1.32, cell.scale + 0.06));
    next.tone = cell.tone === 'signal' ? 'ink' : 'signal';
    next.state = 'registered';
  }
  return next;
}

export function developNegative(board) {
  if (!board.lastOffer) return { accepted: false, board: clone(board), event: null };
  const next = clone(board);
  const witnessIndex = board.lastOffer.index;
  const revision = board.revision + 1;
  const forbidden = new Set([witnessIndex]);
  const developedIndex = ensureRemote(witnessIndex + 17 + revision * 19, forbidden);
  forbidden.add(developedIndex);
  const erasedIndex = ensureRemote(witnessIndex + 43 + revision * 11, forbidden);
  forbidden.add(erasedIndex);
  const registeredIndex = ensureRemote(witnessIndex + 71 + revision * 7, forbidden);
  const event = {
    kind: 'negative-development',
    witnessIndex,
    developedIndex,
    erasedIndex,
    registeredIndex,
    pressure: board.lastOffer.pressure,
    revision
  };
  next.revision = revision;
  next.cells = board.cells.map((cell) => {
    if (cell.index === developedIndex) return mutateCell(cell, 'developed', revision);
    if (cell.index === erasedIndex) return mutateCell(cell, 'erased', revision);
    if (cell.index === registeredIndex) return mutateCell(cell, 'registered', revision);
    return { ...cell, state: 'quiet' };
  });
  next.snapshots = [...board.snapshots, clone(board)].slice(-MEMORY_LIMIT);
  next.memory = [...board.memory, event].slice(-MEMORY_LIMIT);
  next.latent = board.latent.map((value, index) => rounded(value * 0.72 + (index === developedIndex ? 0.06 : 0)));
  next.interaction = 'developed';
  return { accepted: true, board: next, event };
}

export function liftLatest(board) {
  if (!board.snapshots.length) return { ...clone(board), interaction: 'lifted' };
  return { ...clone(board.snapshots.at(-1)), interaction: 'lifted' };
}

export function releaseNegative() {
  return buildBoard();
}

export function buildTimeline() {
  let board = buildBoard();
  const timeline = [board];
  const offers = [
    { row: 2, col: 8, pressure: 0.84 },
    { row: 7, col: 1, pressure: 0.58 },
    { row: 4, col: 4, pressure: 0.76 },
    { row: 9, col: 6, pressure: 0.91 }
  ];
  offers.forEach((offer) => {
    board = developNegative(offerWitness(board, offer)).board;
    timeline.push(board);
  });
  return timeline;
}
