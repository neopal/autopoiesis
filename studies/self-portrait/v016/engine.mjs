export const SEED = 0x53504636;
export const STAGES = 15;
export const MEMORY_LIMIT = 5;
export const ATTENTION_THRESHOLD = 0.65;
export const PRIMITIVE_BUDGET = 72;

const TAU = Math.PI * 2;
const GRID_COLUMNS = 18;
const GRID_ROWS = 26;
const CELL_COUNT = GRID_COLUMNS * GRID_ROWS;
const SECTOR_COUNT = 24;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyPoints = (points = []) => points.map(copyPoint);
const copyCell = (cell) => ({ ...cell });
const copyCells = (cells = []) => cells.map(copyCell);
const copyEvent = (event) => ({
  ...event,
  point: copyPoint(event.point),
  sourceSignature: event.sourceSignature,
  receiverSignature: event.receiverSignature
});
const wrap = (value, limit) => ((value % limit) + limit) % limit;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function boundedPoint(point = {}) {
  const x = Number(point.x);
  const y = Number(point.y);
  return {
    x: clamp(Number.isFinite(x) ? x : 0.72, 0.12, 0.88),
    y: clamp(Number.isFinite(y) ? y : 0.34, 0.12, 0.88)
  };
}

function boundedDwell(value) {
  const raw = Number(value);
  return clamp(Number.isFinite(raw) ? raw : 0.86, ATTENTION_THRESHOLD, 1);
}

function baseCells(stage) {
  const random = rng(SEED + stage * 7919);
  const cells = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const nx = (column / (GRID_COLUMNS - 1) - 0.5) * 1.05;
      const ny = (row / (GRID_ROWS - 1) - 0.5) * 1.48;
      const wobbleX = (random() - 0.5) * 0.018;
      const wobbleY = (random() - 0.5) * 0.02;
      const eyeLeft = Math.exp(-(((nx + 0.19) ** 2) / 0.018 + ((ny + 0.23) ** 2) / 0.035));
      const eyeRight = Math.exp(-(((nx - 0.19) ** 2) / 0.018 + ((ny + 0.23) ** 2) / 0.035));
      const cheek = Math.exp(-((nx ** 2) / 0.22 + ((ny - 0.08) ** 2) / 0.32));
      const mouth = Math.exp(-((nx ** 2) / 0.07 + ((ny - 0.31) ** 2) / 0.025));
      const forehead = Math.exp(-((nx ** 2) / 0.28 + ((ny + 0.44) ** 2) / 0.18));
      const edge = clamp(1 - Math.max(0, Math.hypot(nx * 0.95, ny * 0.68) - 0.36) * 1.9, 0.04, 1);
      const signal = clamp(0.26 + forehead * 0.28 + cheek * 0.17 + (eyeLeft + eyeRight) * 0.21 + mouth * 0.14, 0.04, 1) * edge;
      const index = row * GRID_COLUMNS + column;
      cells.push({
        index,
        row,
        column,
        x: clamp(0.5 + nx * 0.74 + wobbleX, 0.06, 0.94),
        y: clamp(0.51 + ny * 0.62 + wobbleY, 0.05, 0.95),
        radius: 0.006 + signal * 0.015 + random() * 0.0022,
        opacity: clamp(0.13 + signal * 0.78, 0.035, 0.92),
        tone: clamp(0.18 + signal * 0.74 + (random() - 0.5) * 0.08, 0, 1),
        angle: (random() - 0.5) * 0.8,
        active: edge > 0.08
      });
    }
  }
  return cells;
}

function baseResistance(stage) {
  return Array.from({ length: SECTOR_COUNT }, (_, index) => 0.16 + ((index * 19 + stage * 7) % 13) / 100);
}

function cloneField(field) {
  return {
    cells: copyCells(field.cells),
    resistance: [...field.resistance]
  };
}

function sectorFor(point) {
  const angle = Math.atan2(point.y - 0.51, point.x - 0.5);
  return Math.floor(((angle + Math.PI) / TAU) * SECTOR_COUNT) % SECTOR_COUNT;
}

function localResistance(resistance, sector) {
  return [-1, 0, 1].map((offset) => resistance[wrap(sector + offset, SECTOR_COUNT)])
    .reduce((sum, value) => sum + value, 0) / 3;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestCell(cells, point) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  cells.forEach((cell, index) => {
    if (!cell.active) return;
    const candidate = distance(cell, point);
    if (candidate < bestDistance) {
      bestDistance = candidate;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function receiverFor(cells, sourceIndex, eventIndex) {
  const source = cells[sourceIndex];
  let bestIndex = wrap(sourceIndex + 137 + eventIndex * 31, cells.length);
  let bestScore = -Infinity;
  cells.forEach((cell, index) => {
    if (!cell.active || index === sourceIndex) return;
    const separation = distance(source, cell);
    const edgePenalty = Math.abs(cell.x - 0.5) * 0.15;
    const candidate = separation - edgePenalty + ((index * 17 + eventIndex * 11) % 7) * 0.001;
    if (candidate > bestScore) {
      bestScore = candidate;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function nearbyCells(cells, centerIndex, radius) {
  const center = cells[centerIndex];
  return cells
    .map((cell, index) => ({ cell, index, distance: distance(center, cell) }))
    .filter((entry) => entry.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

function makeVoid(cells, sourceIndex, mass, eventIndex) {
  const source = cells[sourceIndex];
  const radius = 0.045 + mass * 0.035;
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = index / 10 * TAU;
    const ripple = 1 + Math.sin(index * 2.7 + eventIndex * 0.9) * 0.11;
    return {
      x: clamp(source.x + Math.cos(angle) * radius * ripple, 0.04, 0.96),
      y: clamp(source.y + Math.sin(angle) * radius * ripple * 1.28, 0.04, 0.96)
    };
  });
  return {
    kind: 'attention-void',
    sourceCell: sourceIndex,
    eventIndex,
    points,
    area: radius * radius * Math.PI,
    signature: points.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join('|')
  };
}

function makeTransfer(cells, sourceIndex, receiverIndex, mass, eventIndex) {
  const source = cells[sourceIndex];
  const receiver = cells[receiverIndex];
  const midpoint = { x: (source.x + receiver.x) / 2, y: (source.y + receiver.y) / 2 };
  const bend = { x: midpoint.x + (receiver.y - source.y) * 0.11, y: midpoint.y - (receiver.x - source.x) * 0.11 };
  return {
    kind: 'witness-transfer',
    sourceCell: sourceIndex,
    receiverCell: receiverIndex,
    mass,
    eventIndex,
    path: [copyPoint(source), bend, copyPoint(receiver)],
    signature: `${sourceIndex}:${receiverIndex}:${mass.toFixed(5)}:${eventIndex}`
  };
}

function applyAttention(field, event, eventIndex) {
  const next = cloneField(field);
  const point = event.point;
  const sourceCell = nearestCell(next.cells, point);
  const receiverCell = receiverFor(next.cells, sourceCell, eventIndex);
  const sector = sectorFor(point);
  const resistanceBefore = localResistance(next.resistance, sector);
  const transferMass = event.dwell * (0.68 + (1 - resistanceBefore) * 0.58);
  const resistanceAfter = clamp(resistanceBefore + event.dwell * 0.25, 0, 1);
  const source = next.cells[sourceCell];
  const receiver = next.cells[receiverCell];

  nearbyCells(next.cells, sourceCell, 0.13).forEach(({ cell, distance: localDistance }, index) => {
    const falloff = Math.exp(-((localDistance * localDistance) / (0.006 + transferMass * 0.015)));
    cell.x = clamp(cell.x + (cell.x - source.x) * falloff * 0.11, 0.03, 0.97);
    cell.y = clamp(cell.y + (cell.y - source.y) * falloff * 0.11, 0.03, 0.97);
    cell.radius = clamp(cell.radius * (1 - falloff * 0.055), 0.0015, 0.045);
    cell.opacity = clamp(cell.opacity - falloff * 0.07, 0.01, 1);
    cell.angle += (index % 2 ? 1 : -1) * falloff * 0.04;
  });

  source.radius = clamp(source.radius * (0.42 - resistanceBefore * 0.08), 0.0015, 0.045);
  source.opacity = clamp(source.opacity - 0.58 * transferMass, 0.02, 1);
  source.tone = clamp(source.tone * 0.62, 0, 1);
  source.x = clamp(source.x + (source.x - 0.5) * 0.035, 0.03, 0.97);
  source.y = clamp(source.y + (source.y - 0.51) * 0.035, 0.03, 0.97);

  receiver.radius = clamp(receiver.radius + 0.004 + transferMass * 0.010, 0.0015, 0.05);
  receiver.opacity = clamp(receiver.opacity + 0.12 + transferMass * 0.11, 0.02, 1);
  receiver.tone = clamp(receiver.tone + 0.18 + transferMass * 0.14, 0, 1);
  receiver.angle += 0.16 + eventIndex * 0.04;
  receiver.x = clamp(receiver.x + (source.x - receiver.x) * 0.018, 0.03, 0.97);
  receiver.y = clamp(receiver.y + (source.y - receiver.y) * 0.018, 0.03, 0.97);

  [-2, -1, 0, 1, 2].forEach((offset) => {
    const index = wrap(sector + offset, SECTOR_COUNT);
    next.resistance[index] = clamp(next.resistance[index] + event.dwell * (offset === 0 ? 0.48 : 0.14), 0, 1);
  });

  const voidShape = makeVoid(next.cells, sourceCell, transferMass, eventIndex);
  const transfer = makeTransfer(next.cells, sourceCell, receiverCell, transferMass, eventIndex);
  const enrichedEvent = {
    ...event,
    sourceCell,
    receiverCell,
    sector,
    resistanceBefore,
    resistanceAfter,
    transferMass,
    sourceSignature: `${source.x.toFixed(5)},${source.y.toFixed(5)},${source.radius.toFixed(5)},${source.opacity.toFixed(5)}`,
    receiverSignature: `${receiver.x.toFixed(5)},${receiver.y.toFixed(5)},${receiver.radius.toFixed(5)},${receiver.opacity.toFixed(5)}`,
    signature: `${sourceCell}:${receiverCell}:${source.opacity.toFixed(4)}:${receiver.radius.toFixed(4)}:${eventIndex}`
  };
  return { field: next, event: enrichedEvent, voidShape, transfer };
}

function makeAttention(stage, point, dwell, source, eventIndex) {
  return {
    id: `${source === 'visitor-attention' ? 'visitor' : 'renderer'}-attention-${stage}-${eventIndex + 1}`,
    stage,
    point: boundedPoint(point),
    dwell: boundedDwell(dwell),
    source,
    kind: 'witness-transfer',
    reason: source === 'visitor-attention' ? 'the visitor sustained attention on the raster portrait' : 'the portrait rehearsed a local witness decision'
  };
}

function candidateAttention(stage, memory) {
  const random = rng(SEED + stage * 12347 + 401);
  const angle = -1.1 + random() * 2.2;
  return makeAttention(stage, {
    x: 0.5 + Math.cos(angle) * (0.12 + random() * 0.22),
    y: 0.51 + Math.sin(angle) * (0.19 + random() * 0.22)
  }, 0.72 + random() * 0.24, 'renderer-attention', memory.length);
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let field = { cells: baseCells(safe), resistance: baseResistance(safe) };
  const attentions = [];
  const voids = [];
  const transfers = [];

  inherited.forEach((event, index) => {
    const applied = applyAttention(field, event, index);
    field = applied.field;
    attentions.push(applied.event);
    voids.push(applied.voidShape);
    transfers.push(applied.transfer);
  });

  return {
    stage: safe,
    cells: field.cells,
    resistance: field.resistance,
    memory: inherited,
    attentions,
    voids,
    transfers,
    primitiveBudget: PRIMITIVE_BUDGET,
    attention: candidateAttention(safe, inherited),
    decided: safe % 3 === 2
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const count = clamp(Math.floor(Number(stageCount) || 0), 0, STAGES);
  return Array.from({ length: count }, (_, stage) => {
    if (stage % 3 === 2 && memory.length < MEMORY_LIMIT) {
      memory = [...memory, candidateAttention(stage, memory.length)].slice(-MEMORY_LIMIT);
    }
    return buildFrame(stage, memory);
  });
}

export function registerAttention(frame, point = {}) {
  const event = makeAttention(frame.stage, point, point.dwell, 'visitor-attention', frame.memory.length);
  const nextMemory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, nextMemory), interaction: 'visitor-attention', restoreMemory: frame.memory.map(copyEvent) };
}

export function liftLatestAttention(frame) {
  const restoredMemory = frame.memory.slice(0, -1).map(copyEvent);
  return { ...buildFrame(frame.stage, restoredMemory), interaction: 'attention-lifted', restoreMemory: restoredMemory };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    cells: frame.cells,
    resistance: frame.resistance,
    voids: frame.voids,
    transfers: frame.transfers
  });
}
