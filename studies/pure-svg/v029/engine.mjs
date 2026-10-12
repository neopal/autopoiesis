const BASE_SEED = 0x53564729;
export const CELL_COUNT = 9;
export const MEMORY_WINDOW = 4;

const CELL_LAYOUT = [
  { x: 0.19, y: 0.36, w: 0.24, h: 0.26, angle: -18, phase: 0.09 },
  { x: 0.37, y: 0.21, w: 0.24, h: 0.27, angle: 8, phase: 0.24 },
  { x: 0.62, y: 0.2, w: 0.25, h: 0.27, angle: -9, phase: 0.41 },
  { x: 0.81, y: 0.37, w: 0.24, h: 0.28, angle: 17, phase: 0.58 },
  { x: 0.72, y: 0.65, w: 0.25, h: 0.28, angle: -3, phase: 0.7 },
  { x: 0.5, y: 0.78, w: 0.27, h: 0.22, angle: 12, phase: 0.83 },
  { x: 0.28, y: 0.72, w: 0.25, h: 0.25, angle: -11, phase: 0.96 },
  { x: 0.13, y: 0.56, w: 0.22, h: 0.27, angle: 21, phase: 0.17 },
  { x: 0.5, y: 0.49, w: 0.22, h: 0.2, angle: 4, phase: 0.53 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));

function baseCell(index) {
  const source = CELL_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    w: source.w,
    h: source.h,
    angle: source.angle,
    phase: source.phase,
    scale: 1,
    seam: 0.42 + (index % 3) * 0.06,
    bridge: 0,
    skew: 0,
    pathSignature: ''
  };
}

function polygonPath(points) {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ')} Z`;
}

function rotatePoint(x, y, angle) {
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine];
}

function worldPoint(cell, localX, localY) {
  const [x, y] = rotatePoint(localX, localY, cell.angle + cell.skew);
  return [cell.x * 1000 + x, cell.y * 680 + y];
}

function cellPath(cell) {
  const rx = cell.w * 500 * cell.scale;
  const ry = cell.h * 340 * cell.scale;
  const outer = [];
  const points = 10;
  for (let index = 0; index < points; index += 1) {
    const theta = (Math.PI * 2 * index) / points;
    const ripple = 1 + 0.09 * Math.sin(theta * 3 + cell.phase * 17) + 0.045 * Math.cos(theta * 5 - cell.phase * 9);
    const localX = Math.cos(theta) * rx * ripple + Math.sin(theta * 2 + cell.phase) * cell.bridge * 20;
    const localY = Math.sin(theta) * ry * ripple + Math.cos(theta * 3 - cell.phase) * cell.bridge * 15;
    outer.push(worldPoint(cell, localX, localY));
  }

  const cutWidth = Math.max(10, rx * (0.12 + cell.seam * 0.07));
  const cutHeight = Math.max(8, ry * (0.09 + cell.seam * 0.05));
  const cutAngle = cell.angle + 23 + cell.skew;
  const cut = [
    worldPoint(cell, -cutWidth, -cutHeight * 0.18),
    worldPoint(cell, -cutWidth * 0.14, -cutHeight),
    worldPoint(cell, cutWidth, -cutHeight * 0.18),
    worldPoint(cell, cutWidth * 0.16, cutHeight),
  ].map(([x, y]) => {
    const [rxp, ryp] = rotatePoint(x - cell.x * 1000, y - cell.y * 680, cutAngle - cell.angle - cell.skew);
    return [rxp + cell.x * 1000, ryp + cell.y * 680];
  });
  return `${polygonPath(outer)} ${polygonPath(cut)}`;
}

function cellSignature(cell) {
  return cellPath(cell);
}

function applyEvent(cells, event) {
  const source = cells[event.source];
  const target = cells[event.target];
  const relay = cells[event.relay];
  const direction = event.source < event.target ? 1 : -1;

  source.scale = clamp(source.scale * 0.86, 0.72, 1.24);
  source.seam = clamp(source.seam + 0.34, 0.28, 1.1);
  source.angle += direction * 5.8;
  source.skew += direction * 4.2;
  source.bridge += 0.6;

  target.scale = clamp(target.scale * 1.12, 0.78, 1.32);
  target.seam = clamp(target.seam - 0.22, 0.16, 0.98);
  target.angle -= direction * 7.2;
  target.skew -= direction * 3.5;
  target.bridge += 1.05;

  relay.scale = clamp(relay.scale * 0.94, 0.76, 1.24);
  relay.seam = clamp(relay.seam + 0.18, 0.22, 1.08);
  relay.angle += direction * 3.6;
  relay.skew += (event.index % 2 ? -1 : 1) * 5.5;
  relay.bridge += 0.45;
}

function materialState(memory) {
  const cells = CELL_LAYOUT.map((_, index) => baseCell(index));
  for (const event of memory) applyEvent(cells, event);
  return cells;
}

function nearestCell(cells, point) {
  const x = clamp(Number(point?.x ?? 0.5), 0, 1);
  const y = clamp(Number(point?.y ?? 0.5), 0, 1);
  let winner = 0;
  let score = Infinity;
  for (const cell of cells) {
    const distance = (cell.x - x) ** 2 + (cell.y - y) ** 2;
    if (distance < score) {
      score = distance;
      winner = cell.id;
    }
  }
  return winner;
}

function chooseEvent(cells, point, memory, armedSource) {
  const source = armedSource ?? nearestCell(cells, point);
  let target = nearestCell(cells, point);
  if (target === source) {
    const offset = 2 + (Math.floor((Number(point?.x ?? 0.5) + Number(point?.y ?? 0.5)) * 10) + memory.length) % (CELL_COUNT - 2);
    target = wrap(source + offset, CELL_COUNT);
  }
  const direction = source < target ? 1 : -1;
  let relay = wrap(target + 2 + (memory.length % 3), CELL_COUNT);
  if (relay === source || relay === target) relay = wrap(relay + direction, CELL_COUNT);
  return {
    source,
    target,
    relay,
    index: memory.length,
    committed: true,
    type: 'seam-fused'
  };
}

function frameFrom(stage, memory, interaction, event, armedSource) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const cells = materialState(safeMemory);
  for (const cell of cells) cell.pathSignature = cellSignature(cell);
  const frame = {
    grammar: 'fused-seam',
    stage: clamp(Number(stage) || 0, 0, 12),
    memory: safeMemory,
    cells,
    centralVoid: clamp(0.22 - safeMemory.length * 0.009, 0.16, 0.24),
    interaction,
    event: event ?? { committed: false },
    armedSource: armedSource ?? null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null, null);
}

export function geometrySignature(frame) {
  return frame.cells.map((cell) => `${cell.id}:${cell.pathSignature ?? cellSignature(cell)}`).join('||');
}

export function armCell(frame, point) {
  const source = nearestCell(frame.cells, point);
  return frameFrom(frame.stage, frame.memory, 'first-place-armed', { committed: false, source }, source);
}

export function applyFusion(frame, point) {
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'fusion-memory-full', { committed: false, reason: 'memory-full' }, frame.armedSource);
  }
  const candidateCells = materialState(frame.memory);
  const candidateTarget = nearestCell(candidateCells, point);
  if (frame.armedSource !== null && frame.armedSource !== undefined && candidateTarget === frame.armedSource) {
    return frameFrom(frame.stage, frame.memory, 'fusion-refused-same-place', { committed: false, reason: 'same-place', source: frame.armedSource }, frame.armedSource);
  }
  const event = chooseEvent(candidateCells, point, frame.memory, frame.armedSource);
  const nextMemory = [...frame.memory, event];
  return frameFrom(frame.stage + 1, nextMemory, 'seam-fused', event, null);
}

export function liftLatestFusion(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false }, null);
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'fusion-lifted', { committed: false, lifted: true }, null);
}

export function releaseField() {
  return frameFrom(0, [], 'released', { committed: false, released: true }, null);
}

export function buildTimeline() {
  let frame = buildFrame(0, []);
  const pairs = [
    [{ x: 0.18, y: 0.34 }, { x: 0.82, y: 0.68 }],
    [{ x: 0.72, y: 0.3 }, { x: 0.22, y: 0.74 }],
    [{ x: 0.42, y: 0.18 }, { x: 0.8, y: 0.37 }],
    [{ x: 0.5, y: 0.49 }, { x: 0.13, y: 0.56 }]
  ];
  for (const [first, second] of pairs) frame = applyFusion(armCell(frame, first), second);
  return [buildFrame(0, []), ...frame.memory.map((_, index) => frameFrom(index + 1, frame.memory.slice(0, index + 1), 'seam-fused', frame.memory[index], null))];
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'fused-seam',
  rule: 'one place only arms; a second non-local place fuses the seam and re-forms a remote relay',
  memoryWindow: MEMORY_WINDOW
};
