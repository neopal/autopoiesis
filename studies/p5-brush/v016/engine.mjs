export const SEED = 0x42525536;
export const STAGES = 17;
export const GRID_COLUMNS = 16;
export const GRID_ROWS = 11;
export const MEMORY_LIMIT = 6;
export const PRIMITIVE_BUDGET = 72;

const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const gaussian = (distance, spread) => Math.exp(-((distance / Math.max(spread, 0.0001)) ** 2));

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
const copyCut = (cut) => ({
  ...cut,
  path: cut.path.map(copyPoint),
  normal: copyPoint(cut.normal)
});

function pathLength(path) {
  return path.slice(1).reduce((sum, point, index) => {
    const previous = path[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function pathTangent(path, index) {
  const previous = path[Math.max(0, index - 1)];
  const next = path[Math.min(path.length - 1, index + 1)];
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function pointSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared);
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return { distance: Math.hypot(point.x - x, point.y - y), t, point: { x, y } };
}

function nearestOnPath(point, path) {
  let best = { distance: Infinity, t: 0, point: copyPoint(path[0]), segment: 0 };
  let total = 0;
  const lengths = path.slice(1).map((next, index) => {
    const previous = path[index];
    const length = Math.hypot(next.x - previous.x, next.y - previous.y);
    total += length;
    return length;
  });
  let travelled = 0;
  path.slice(1).forEach((end, index) => {
    const start = path[index];
    const candidate = pointSegmentDistance(point, start, end);
    if (candidate.distance < best.distance) {
      const segmentLength = lengths[index] || 1;
      best = {
        distance: candidate.distance,
        t: total ? (travelled + candidate.t * segmentLength) / total : 0,
        point: candidate.point,
        segment: index
      };
    }
    travelled += lengths[index] || 0;
  });
  return best;
}

function samplePath(path, count, offset = 0) {
  if (path.length === 1) return Array.from({ length: count }, () => copyPoint(path[0]));
  const lengths = path.slice(1).map((next, index) => Math.hypot(next.x - path[index].x, next.y - path[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  return Array.from({ length: count }, (_, index) => {
    const progress = clamp((index / Math.max(1, count - 1) + offset) % 1);
    let target = progress * total;
    let segment = 0;
    while (segment < lengths.length - 1 && target > lengths[segment]) {
      target -= lengths[segment];
      segment += 1;
    }
    const local = target / (lengths[segment] || 1);
    return {
      x: lerp(path[segment].x, path[segment + 1].x, local),
      y: lerp(path[segment].y, path[segment + 1].y, local)
    };
  });
}

function normalizePath(rawPath) {
  const source = Array.isArray(rawPath) && rawPath.length >= 2
    ? rawPath
    : [{ x: 0.2, y: 0.34 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.66 }];
  const deduped = source.map((point) => ({
    x: clamp(Number.isFinite(Number(point?.x)) ? Number(point.x) : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(Number(point?.y)) ? Number(point.y) : 0.5, 0.08, 0.92)
  })).filter((point, index, points) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  return deduped.length >= 2 ? deduped : [{ x: 0.2, y: 0.34 }, { x: 0.8, y: 0.66 }];
}

function makeCut(stage, path, pressure, source, index) {
  const normalized = normalizePath(path);
  const boundedPressure = clamp(Number.isFinite(Number(pressure)) ? Number(pressure) : 0.62, 0.12, 1);
  const length = pathLength(normalized);
  const tangent = pathTangent(normalized, Math.floor(normalized.length / 2));
  const normalLength = Math.hypot(tangent.x, tangent.y) || 1;
  return {
    id: `${source}-cut-${stage}-${index}`,
    stage,
    source,
    kind: 'material-cut',
    path: normalized,
    pressure: boundedPressure,
    width: clamp(0.024 + boundedPressure * 0.035 + length * 0.032, 0.032, 0.105),
    depth: 0.26 + boundedPressure * 0.48,
    normal: { x: -tangent.y / normalLength, y: tangent.x / normalLength },
    grainTurn: (boundedPressure - 0.5) * 1.7,
    rule: 'pressure-cut-displacement'
  };
}

function automaticCut(stage) {
  const random = rng(SEED + stage * 7919);
  const bend = (random() - 0.5) * 0.18;
  const y = 0.21 + ((stage * 0.17) % 0.58);
  return makeCut(stage, [
    { x: 0.11, y: clamp(y - 0.15 + bend, 0.12, 0.88) },
    { x: 0.35, y: clamp(y + bend * 0.4, 0.12, 0.88) },
    { x: 0.61, y: clamp(y - bend * 0.9, 0.12, 0.88) },
    { x: 0.9, y: clamp(y + 0.13 - bend, 0.12, 0.88) }
  ], 0.4 + random() * 0.42, 'autonomous-material', stage);
}

function makeBaseCell(stage, row, column) {
  const random = rng(SEED + stage * 104729 + row * 977 + column * 131);
  const x = 0.08 + column * 0.056 + (row % 2 ? 0.006 : 0);
  const y = 0.12 + row * 0.075;
  return {
    id: `cell-${row}-${column}`,
    row,
    column,
    x: clamp(x + (random() - 0.5) * 0.012, 0.035, 0.965),
    y: clamp(y + (random() - 0.5) * 0.012, 0.06, 0.94),
    width: 0.044 + random() * 0.009,
    height: 0.053 + random() * 0.011,
    angle: (random() - 0.5) * 0.22,
    lift: 0.008 + random() * 0.012,
    grain: 0.17 + random() * 0.2,
    pigment: 0.28 + random() * 0.42,
    edge: 0.12 + random() * 0.16,
    opacity: 0.46 + random() * 0.25
  };
}

function applyCutToCell(cell, cut, cellIndex) {
  const nearest = nearestOnPath({ x: cell.x, y: cell.y }, cut.path);
  const influence = smoothstep(1 - nearest.distance / (cut.width * 2.35));
  if (influence <= 0.001) return cell;
  const tangent = pathTangent(cut.path, nearest.segment);
  const side = Math.sign((cell.x - nearest.point.x) * tangent.y - (cell.y - nearest.point.y) * tangent.x) || (cellIndex % 2 ? 1 : -1);
  const age = 0.82 + Math.min(5, cellIndex % 7) * 0.035;
  const pressure = influence * cut.pressure * age;
  const ridge = Math.exp(-(((nearest.distance - cut.width * 0.98) / (cut.width * 0.8)) ** 2)) * cut.pressure;
  return {
    ...cell,
    angle: cell.angle + side * pressure * (0.52 + Math.abs(cut.grainTurn) * 0.18),
    lift: clamp(cell.lift + pressure * 0.66 + ridge * 0.2, 0, 0.92),
    grain: clamp(cell.grain + pressure * 0.34 + ridge * 0.28, 0, 1),
    pigment: clamp(cell.pigment + side * pressure * 0.12 + ridge * 0.18, 0.06, 1),
    edge: clamp(cell.edge + pressure * 0.48 + ridge * 0.33, 0, 1),
    opacity: clamp(cell.opacity + pressure * 0.16, 0.3, 1),
    cutLoad: clamp((cell.cutLoad ?? 0) + pressure, 0, 2),
    side,
    cutT: nearest.t
  };
}

function buildScar(cut) {
  if (!cut) return { points: [] };
  return { points: samplePath(cut.path, 28) };
}

function buildRidge(cut) {
  if (!cut) return { points: [] };
  const points = samplePath(cut.path, 28);
  return {
    points: points.map((point, index) => {
      const tangent = pathTangent(points, index);
      const side = index % 2 ? 1 : -1;
      return {
        x: clamp(point.x + (-tangent.y) * cut.width * (0.92 + side * 0.12), 0.03, 0.97),
        y: clamp(point.y + tangent.x * cut.width * (0.92 + side * 0.12), 0.04, 0.96)
      };
    })
  };
}

function buildCells(stage, memory) {
  let cells = Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, index) => {
    const row = Math.floor(index / GRID_COLUMNS);
    const column = index % GRID_COLUMNS;
    return makeBaseCell(stage, row, column);
  });
  memory.forEach((cut) => {
    cells = cells.map((cell, index) => applyCutToCell(cell, cut, index));
  });
  return cells;
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyCut).slice(-MEMORY_LIMIT) : [];
  const cells = buildCells(safeStage, inherited);
  const currentCut = inherited.at(-1) ?? null;
  const baselineLoad = cells.reduce((sum, cell) => sum + cell.lift + cell.grain * 0.08, 0);
  const materialLoad = cells.reduce((sum, cell) => sum + cell.lift + cell.grain * 0.08 + (cell.cutLoad ?? 0) * 0.14, 0);
  return {
    stage: safeStage,
    memory: inherited,
    cells,
    cut: currentCut,
    scar: buildScar(currentCut),
    displacedRidge: buildRidge(currentCut),
    materialLoad,
    baselineLoad,
    plate: {
      x: 0.06,
      y: 0.08,
      width: 0.88,
      height: 0.84,
      corner: 0.028
    },
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const cut = automaticCut(stage);
    memory = [...memory, cut].slice(-MEMORY_LIMIT);
    return { ...frame, currentCut: cut };
  });
}

export function registerCut(frame, gesture = {}) {
  const cut = makeCut(
    frame.stage,
    gesture.path,
    gesture.pressure,
    'visitor-pressure',
    frame.memory.length + 1
  );
  const nextMemory = [...frame.memory, cut].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-pressure-cut',
    restoreMemory: frame.memory.map(copyCut)
  };
}

export function liftLatestCut(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'cut-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'cut-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'cut-lifted' };
}

export function geometrySignature(frame) {
  const cells = (frame.cells ?? []).flatMap((cell) => [
    cell.x, cell.y, cell.angle, cell.lift, cell.grain, cell.pigment, cell.edge, cell.cutLoad ?? 0
  ]);
  const cut = (frame.memory ?? []).flatMap((entry) => [
    entry.width, entry.depth, entry.pressure, ...entry.path.flatMap((point) => [point.x, point.y])
  ]);
  const scars = [
    ...(frame.scar?.points ?? []),
    ...(frame.displacedRidge?.points ?? [])
  ].flatMap((point) => [point.x, point.y]);
  return [...cells, ...cut, ...scars].map((value) => Number(value).toFixed(6)).join('|');
}
