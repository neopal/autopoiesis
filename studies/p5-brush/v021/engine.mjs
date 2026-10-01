export const SEED = 0x42525541;
export const STAGES = 15;
export const MEMORY_LIMIT = 3;
export const ROW_COUNT = 13;
export const COLUMN_COUNT = 21;
export const PRIMITIVE_BUDGET = 120;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyEvent = (event) => ({ ...event, path: event.path.map(copyPoint) });
const copyCell = (cell) => ({ ...cell });

function baseCells(stage) {
  const random = rng(SEED + stage * 12289);
  const cells = [];
  for (let row = 0; row < ROW_COUNT; row += 1) {
    for (let column = 0; column < COLUMN_COUNT; column += 1) {
      const u = column / (COLUMN_COUNT - 1);
      const v = row / (ROW_COUNT - 1);
      const wave = Math.sin(u * Math.PI * 2.2 + v * 2.4 + stage * 0.13) * 0.012;
      cells.push({
        id: row * COLUMN_COUNT + column,
        row,
        column,
        x: clamp(0.065 + u * 0.87 + (random() - 0.5) * 0.018, 0.035, 0.965),
        y: clamp(0.085 + v * 0.83 + wave + (random() - 0.5) * 0.018, 0.035, 0.965),
        sizeX: 0.026 + random() * 0.012,
        sizeY: 0.029 + random() * 0.014,
        mass: 0.38 + random() * 0.54,
        grain: 0.16 + random() * 0.78,
        tilt: (random() - 0.5) * 0.25,
        hue: [12, 29, 184, 204, 338, 47][(row * 3 + column) % 6],
        alive: true,
        bypass: 0,
        answerLoad: 0,
        scarIndex: -1
      });
    }
  }
  return cells;
}

function normalizePath(path) {
  if (!Array.isArray(path)) return [];
  return path
    .filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
    .map((point) => ({ x: clamp(Number(point.x)), y: clamp(Number(point.y)) }));
}

function pathLength(path) {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    length += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
  }
  return length;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const amount = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared);
  const nearest = { x: start.x + dx * amount, y: start.y + dy * amount };
  const cross = dx * (point.y - start.y) - dy * (point.x - start.x);
  return { distance: Math.hypot(point.x - nearest.x, point.y - nearest.y), side: cross < 0 ? -1 : 1 };
}

function nearestPath(point, path) {
  let nearest = { distance: Infinity, side: 1 };
  for (let index = 1; index < path.length; index += 1) {
    const candidate = distanceToSegment(point, path[index - 1], path[index]);
    if (candidate.distance < nearest.distance) nearest = candidate;
  }
  return nearest;
}

function pathCentroid(path) {
  const total = path.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / path.length, y: total.y / path.length };
}

function makeEvent(frame, path, source = 'visitor-rake') {
  const safePath = normalizePath(path);
  const length = pathLength(safePath);
  const start = safePath[0];
  const end = safePath.at(-1);
  const direction = end.x >= start.x ? 1 : -1;
  return {
    id: `${source}-${frame.stage}-${frame.memory.length}-${Math.round(start.x * 1000)}-${Math.round(end.y * 1000)}`,
    stage: frame.stage,
    source,
    kind: 'material-rake',
    path: safePath,
    width: clamp(0.038 + length * 0.018, 0.038, 0.07),
    load: clamp(0.42 + length * 0.72, 0.42, 0.96),
    direction,
    rule: 'rake-and-answer'
  };
}

function answerFor(event, memoryLength) {
  const centroid = pathCentroid(event.path);
  const endpoint = event.path.at(-1);
  const answer = {
    x: clamp(lerp(1 - centroid.x, endpoint.x, 0.18) + event.direction * 0.05, 0.12, 0.88),
    y: clamp(lerp(1 - centroid.y, endpoint.y, 0.12) - event.direction * 0.07, 0.12, 0.88),
    radius: clamp(0.12 + event.load * 0.07, 0.12, 0.2),
    load: event.load,
    index: memoryLength
  };
  return answer;
}

function applyEvent(cells, scars, answers, event) {
  const answer = answerFor(event, answers.length);
  const nextCells = cells.map((cell) => {
    const nearest = nearestPath(cell, event.path);
    const ratio = clamp(1 - nearest.distance / (event.width * 4.2));
    const cut = nearest.distance <= event.width * (0.72 + cell.mass * 0.22);
    const answerDistance = Math.hypot(cell.x - answer.x, cell.y - answer.y);
    const answerLoad = clamp(1 - answerDistance / answer.radius, 0, 1) * event.load;
    if (cut) {
      return { ...cell, alive: false, bypass: 0, answerLoad: 0, scarIndex: scars.length };
    }
    const bypass = ratio * event.load;
    const tangentPush = nearest.side * bypass * 0.026 * (0.65 + cell.grain * 0.6);
    return {
      ...cell,
      x: clamp(cell.x + tangentPush * event.direction, 0.025, 0.975),
      y: clamp(cell.y - tangentPush * (0.45 + cell.row / ROW_COUNT * 0.35), 0.025, 0.975),
      sizeX: clamp(cell.sizeX * (1 + bypass * 0.22), 0.018, 0.058),
      sizeY: clamp(cell.sizeY * (1 + bypass * 0.18 + answerLoad * 0.16), 0.018, 0.064),
      mass: clamp(cell.mass + answerLoad * 0.24 - bypass * 0.04, 0.12, 1),
      tilt: cell.tilt + nearest.side * bypass * 0.42 + answerLoad * 0.3,
      bypass: Math.max(cell.bypass, bypass),
      answerLoad: Math.max(cell.answerLoad, answerLoad),
      scarIndex: -1
    };
  });
  return {
    cells: nextCells,
    scars: [...scars, { path: event.path.map(copyPoint), width: event.width, load: event.load, direction: event.direction }].slice(-MEMORY_LIMIT),
    answers: [...answers, answer].slice(-MEMORY_LIMIT)
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let cells = baseCells(safeStage);
  let scars = [];
  let answers = [];
  inherited.forEach((event) => {
    const applied = applyEvent(cells, scars, answers, event);
    cells = applied.cells;
    scars = applied.scars;
    answers = applied.answers;
  });
  return {
    stage: safeStage,
    memory: inherited,
    cells,
    scars,
    answers,
    removedCount: cells.filter((cell) => !cell.alive).length,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'grain-lattice-rake-field'
  };
}

function automaticRake(stage, frame) {
  const random = rng(SEED + stage * 3331);
  const y = 0.26 + ((stage * 0.17) % 0.5);
  const bend = (random() - 0.5) * 0.24;
  return makeEvent(frame, [
    { x: 0.14, y: clamp(y + bend) },
    { x: 0.42, y: clamp(y - 0.14 + bend) },
    { x: 0.78, y: clamp(y + 0.12 - bend) }
  ], 'autonomous-rake');
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1) memory = [...memory, automaticRake(stage, frame)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function rakeField(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const path = normalizePath(input.path);
  if (path.length < 2 || pathLength(path) < 0.08) return { ...baseline, interaction: 'rake-refused' };
  const event = makeEvent(baseline, path);
  return {
    ...buildFrame(baseline.stage, [...baseline.memory, event]),
    interaction: 'visitor-rake',
    restoreMemory: baseline.memory.map(copyEvent)
  };
}

export function liftLatestRake(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'rake-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'rake-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'rake-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    cells: frame.cells.map((cell) => [cell.id, cell.alive, cell.x, cell.y, cell.sizeX, cell.sizeY, cell.mass, cell.tilt, cell.bypass, cell.answerLoad, cell.scarIndex]),
    scars: frame.scars,
    answers: frame.answers,
    removedCount: frame.removedCount
  });
}
