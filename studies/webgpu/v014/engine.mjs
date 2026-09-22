export const SEED = 0x57475040;
export const STAGES = 16;
export const COLUMNS = 24;
export const ROWS = 18;
export const NODE_COUNT = COLUMNS * ROWS;
export const MEMORY_LIMIT = 5;
export const PRIMITIVE_BUDGET = 68;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * clamp(amount);
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

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
const copyPath = (path) => path.map(copyPoint);

function normalizePath(rawPath) {
  const source = Array.isArray(rawPath) && rawPath.length >= 2
    ? rawPath
    : [{ x: 0.16, y: 0.25 }, { x: 0.5, y: 0.52 }, { x: 0.84, y: 0.72 }];
  const path = source.map((point) => ({
    x: clamp(Number.isFinite(Number(point?.x)) ? Number(point.x) : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(Number(point?.y)) ? Number(point.y) : 0.5, 0.08, 0.92)
  })).filter((point, index, points) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  return path.length >= 2 ? path : [{ x: 0.16, y: 0.25 }, { x: 0.84, y: 0.72 }];
}

function pathLength(path) {
  return path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - path[index].x, point.y - path[index].y), 0);
}

function pathTangent(path, index) {
  const previous = path[Math.max(0, index - 1)];
  const next = path[Math.min(path.length - 1, index + 1)];
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function nearestOnPath(point, path) {
  let best = { distance: Infinity, t: 0, point: copyPoint(path[0]), segment: 0 };
  let travelled = 0;
  const total = pathLength(path) || 1;
  path.slice(1).forEach((end, index) => {
    const start = path[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const local = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared);
    const candidate = { x: start.x + local * dx, y: start.y + local * dy };
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance < best.distance) {
      const segmentLength = Math.sqrt(lengthSquared);
      best = {
        distance,
        t: (travelled + local * segmentLength) / total,
        point: candidate,
        segment: index
      };
    }
    travelled += Math.sqrt(lengthSquared);
  });
  return best;
}

function boundsForPath(path) {
  return {
    minX: Math.min(...path.map((point) => clamp(point.x, 0.08, 0.92))),
    minY: Math.min(...path.map((point) => clamp(point.y, 0.08, 0.92))),
    maxX: Math.max(...path.map((point) => clamp(point.x, 0.08, 0.92))),
    maxY: Math.max(...path.map((point) => clamp(point.y, 0.08, 0.92)))
  };
}

function makePressure(stage, path, pressure, source, serial = 0) {
  const normalizedPath = normalizePath(path);
  const boundedPressure = clamp(Number.isFinite(Number(pressure)) ? Number(pressure) : 0.58, 0.12, 1);
  const tangent = pathTangent(normalizedPath, Math.floor(normalizedPath.length / 2));
  return {
    id: `${source}-${stage}-${serial}`,
    stage: Math.max(0, Math.floor(Number(stage) || 0)),
    source,
    kind: 'pressure-archive',
    path: normalizedPath,
    pointBounds: boundsForPath(normalizedPath),
    pressure: boundedPressure,
    width: clamp(0.03 + pathLength(normalizedPath) * 0.028 + boundedPressure * 0.028, 0.038, 0.095),
    normal: { x: -tangent.y, y: tangent.x },
    phase: 0.4 + stage * 0.37 + serial * 0.91,
    rule: 'crowd-to-pressure-surface'
  };
}

function automaticPressure(stage) {
  const random = rng(SEED + stage * 9176);
  const bend = (random() - 0.5) * 0.22;
  const y = 0.22 + ((stage * 0.19) % 0.52);
  return makePressure(stage, [
    { x: 0.12, y: clamp(y - 0.13 + bend, 0.1, 0.9) },
    { x: 0.32, y: clamp(y + bend * 0.55, 0.1, 0.9) },
    { x: 0.57, y: clamp(y - bend * 0.8, 0.1, 0.9) },
    { x: 0.88, y: clamp(y + 0.14 - bend, 0.1, 0.9) }
  ], 0.42 + random() * 0.4, 'autonomous-pressure', stage);
}

function copyPressure(pressure) {
  return {
    ...pressure,
    path: copyPath(pressure.path),
    pointBounds: { ...pressure.pointBounds },
    normal: { ...pressure.normal }
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map((record, index) => makePressure(
    record.stage,
    record.path,
    record.pressure,
    record.source || 'replayed-pressure',
    index
  ));
}

function makeBaseNode(stage, row, column) {
  const random = rng(SEED + stage * 104729 + row * 977 + column * 131);
  const u = column / (COLUMNS - 1);
  const v = row / (ROWS - 1);
  return {
    id: row * COLUMNS + column,
    x: clamp(0.065 + u * 0.87 + (random() - 0.5) * 0.009, 0.02, 0.98),
    y: clamp(0.075 + v * 0.85 + (random() - 0.5) * 0.009, 0.02, 0.98),
    baseX: 0,
    baseY: 0,
    height: 0.04 + random() * 0.025,
    tilt: (random() - 0.5) * 0.18,
    grain: 0.18 + random() * 0.26,
    pressure: 0,
    fold: 0,
    phase: random() * Math.PI * 2,
    row,
    column
  };
}

function makeFaces() {
  const faces = [];
  for (let row = 0; row < ROWS - 1; row += 1) {
    for (let column = 0; column < COLUMNS - 1; column += 1) {
      const topLeft = row * COLUMNS + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + COLUMNS;
      const bottomRight = bottomLeft + 1;
      if ((row + column) % 2 === 0) {
        faces.push([topLeft, topRight, bottomRight], [topLeft, bottomRight, bottomLeft]);
      } else {
        faces.push([topLeft, topRight, bottomLeft], [topRight, bottomRight, bottomLeft]);
      }
    }
  }
  return faces;
}

function influenceFor(node, pressure) {
  const nearest = nearestOnPath({ x: node.x, y: node.y }, pressure.path);
  const influence = smoothstep(1 - nearest.distance / (pressure.width * 2.7));
  if (influence <= 0.001) return null;
  const tangent = pathTangent(pressure.path, nearest.segment);
  const side = Math.sign((node.x - nearest.point.x) * tangent.y - (node.y - nearest.point.y) * tangent.x) || (node.id % 2 ? 1 : -1);
  const age = 0.82 + Math.min(5, node.id % 7) * 0.04;
  const pulse = 0.82 + 0.18 * Math.sin(pressure.phase + node.phase) ** 2;
  return {
    influence: influence * pressure.pressure * age * pulse,
    nearest,
    tangent,
    side
  };
}

function applyPressureToNode(node, pressure, pressureIndex) {
  const effect = influenceFor(node, pressure);
  if (!effect) return node;
  const { influence, nearest, tangent, side } = effect;
  const normal = { x: -tangent.y, y: tangent.x };
  const age = 0.8 + pressureIndex * 0.07;
  const compression = influence * (0.008 + pressure.pressure * 0.008) * age;
  const lift = influence * (0.13 + pressure.pressure * 0.16) * (side > 0 ? 1.08 : 0.84);
  const crease = Math.exp(-(((nearest.distance - pressure.width * 0.92) / (pressure.width * 0.82)) ** 2)) * pressure.pressure;
  return {
    ...node,
    x: clamp(node.x + tangent.x * side * compression + normal.x * crease * 0.0035, 0.015, 0.985),
    y: clamp(node.y + tangent.y * side * compression + normal.y * crease * 0.0035, 0.015, 0.985),
    height: clamp(node.height + lift + crease * 0.06, 0, 0.96),
    tilt: node.tilt + side * influence * (0.34 + pressure.pressure * 0.24) + crease * 0.12,
    grain: clamp(node.grain + influence * 0.34 + crease * 0.22, 0, 1),
    pressure: clamp(node.pressure + influence, 0, 2.5),
    fold: clamp(node.fold + crease * 0.9 + influence * 0.14, 0, 2)
  };
}

function buildSurface(stage, memory) {
  let nodes = Array.from({ length: NODE_COUNT }, (_, index) => makeBaseNode(stage, Math.floor(index / COLUMNS), index % COLUMNS));
  nodes = nodes.map((node) => ({ ...node, baseX: node.x, baseY: node.y }));
  memory.forEach((pressure, pressureIndex) => {
    nodes = nodes.map((node) => applyPressureToNode(node, pressure, pressureIndex));
  });
  return {
    nodes,
    faces: makeFaces(),
    topology: 'pressure-surface',
    bands: memory.map((pressure) => ({
      path: copyPath(pressure.path),
      width: pressure.width,
      pressure: pressure.pressure,
      bounds: { ...pressure.pointBounds }
    }))
  };
}

function resolvePressure(pressure, nodes) {
  const affected = nodes.filter((node) => node.pressure > 0.08 && node.x >= pressure.pointBounds.minX - 0.14 && node.x <= pressure.pointBounds.maxX + 0.14 && node.y >= pressure.pointBounds.minY - 0.14 && node.y <= pressure.pointBounds.maxY + 0.14);
  return {
    ...copyPressure(pressure),
    affectedNodes: affected.length,
    compactedNodes: affected.filter((node) => node.height > 0.12).length,
    creasedNodes: affected.filter((node) => node.fold > 0.14).length,
    pressureLoad: affected.reduce((sum, node) => sum + node.pressure, 0),
    liftLoad: affected.reduce((sum, node) => sum + node.height, 0)
  };
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const normalizedMemory = normalizeMemory(memory);
  const surface = buildSurface(safeStage, normalizedMemory);
  const resolvedMemory = normalizedMemory.map((pressure) => resolvePressure(pressure, surface.nodes));
  const compactedNodes = surface.nodes.filter((node) => node.height > 0.12).length;
  const creasedNodes = surface.nodes.filter((node) => node.fold > 0.14).length;
  const archivedPressure = resolvedMemory.reduce((sum, pressure) => sum + pressure.pressureLoad, 0);
  return {
    stage: safeStage,
    surface,
    memory: resolvedMemory,
    archive: resolvedMemory.map((pressure, index) => ({ index, id: pressure.id, bounds: { ...pressure.pointBounds }, compactedNodes: pressure.compactedNodes, creasedNodes: pressure.creasedNodes })),
    aggregate: {
      compactedNodes,
      creasedNodes,
      archivedPressure,
      liftLoad: surface.nodes.reduce((sum, node) => sum + node.height, 0),
      nodeDisplacement: surface.nodes.reduce((sum, node) => sum + Math.hypot(node.x - node.baseX, node.y - node.baseY), 0)
    }
  };
}

function memoryAtStage(stage) {
  return [2, 5, 8, 11, 14]
    .filter((sourceStage) => sourceStage <= stage)
    .map((sourceStage, index) => automaticPressure(sourceStage, index));
}

export function buildTimeline(limit = STAGES) {
  return Array.from({ length: limit }, (_, stage) => buildFrame(stage, memoryAtStage(stage)));
}

export function applyPressure(frame, path, pressure = 0.62) {
  const nextMemory = [...frame.memory, makePressure(frame.stage, path, pressure, 'visitor-pressure', frame.memory.length)];
  return buildFrame(frame.stage, nextMemory);
}

export function liftLatestPressure(frame) {
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releasePressures() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  return JSON.stringify({ stage: frame.stage, memory: frame.memory, nodes: frame.surface.nodes, faces: frame.surface.faces });
}
