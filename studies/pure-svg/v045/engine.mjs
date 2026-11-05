const VIEWBOX = { width: 1000, height: 760 };

const TILE_LAYOUT = [
  { index: 0, x: 136, y: 176, width: 142, height: 132, rotation: -14, phase: 0.2 },
  { index: 1, x: 306, y: 118, width: 118, height: 152, rotation: 11, phase: 1.4 },
  { index: 2, x: 484, y: 166, width: 148, height: 112, rotation: -4, phase: 2.1 },
  { index: 3, x: 690, y: 112, width: 136, height: 150, rotation: 18, phase: 3.0 },
  { index: 4, x: 856, y: 226, width: 112, height: 136, rotation: 4, phase: 4.0 },
  { index: 5, x: 684, y: 304, width: 154, height: 126, rotation: -17, phase: 5.1 },
  { index: 6, x: 476, y: 320, width: 114, height: 172, rotation: 7, phase: 6.0 },
  { index: 7, x: 268, y: 314, width: 146, height: 120, rotation: -8, phase: 6.7 },
  { index: 8, x: 120, y: 406, width: 120, height: 146, rotation: 16, phase: 7.5 },
  { index: 9, x: 320, y: 526, width: 160, height: 116, rotation: 5, phase: 8.0 },
  { index: 10, x: 542, y: 534, width: 142, height: 126, rotation: -12, phase: 8.9 },
  { index: 11, x: 762, y: 500, width: 160, height: 114, rotation: 11, phase: 9.8 },
  { index: 12, x: 884, y: 594, width: 104, height: 108, rotation: -8, phase: 10.4 },
  { index: 13, x: 176, y: 620, width: 124, height: 100, rotation: -20, phase: 11.0 }
];

export const VIEWBOX_SIZE = VIEWBOX;
export const TILE_COUNT = TILE_LAYOUT.length;
export const MEMORY_WINDOW = 4;

const OUTER_TEMPLATE = [
  [-0.48, -0.22], [-0.18, -0.50], [0.30, -0.45], [0.50, -0.10],
  [0.40, 0.40], [0.08, 0.50], [-0.38, 0.36], [-0.54, 0.02]
];
const COUNTER_TEMPLATE = [
  [-0.15, -0.04], [-0.01, -0.22], [0.17, -0.07], [0.07, 0.05],
  [0.18, 0.18], [-0.03, 0.11], [-0.17, 0.20], [-0.09, 0.02]
];
const round = (value) => Math.round(value * 1000) / 1000;
const rotate = (x, y, radians) => ({
  x: round(x * Math.cos(radians) - y * Math.sin(radians)),
  y: round(x * Math.sin(radians) + y * Math.cos(radians))
});
const pointPath = (points) => `M ${points.map(({ x, y }) => `${x} ${y}`).join(' L ')} Z`;

function mapPoints(layout, template, mutation = null, inner = false) {
  const radians = ((layout.rotation + (mutation?.rotation ?? 0)) * Math.PI) / 180;
  const scale = inner
    ? (mutation ? 1.46 + mutation.depth * 0.004 : 0.78)
    : (mutation ? 1 + mutation.depth * 0.0018 : 1);
  const driftX = mutation && inner ? mutation.depth * 0.16 : 0;
  const driftY = mutation && inner ? -mutation.depth * 0.12 : 0;
  return template.map(([unitX, unitY], pointIndex) => {
    let x = unitX * layout.width * scale + driftX;
    let y = unitY * layout.height * scale + driftY;
    if (mutation && !inner && pointIndex === mutation.corner) {
      x += mutation.depth * 0.23;
      y += mutation.depth * 0.18;
    }
    if (mutation && !inner && pointIndex === (mutation.corner + 1) % template.length) {
      x += mutation.depth * 0.10;
      y -= mutation.depth * 0.12;
    }
    const transformed = rotate(x, y, radians);
    return { x: round(layout.x + transformed.x), y: round(layout.y + transformed.y) };
  });
}

function counterPath(layout, mutation) {
  return pointPath(mapPoints(layout, COUNTER_TEMPLATE, mutation, true));
}

function mutationFor(tileIndex, memory) {
  return memory.filter((event) => event.receiverTile === tileIndex).at(-1) ?? null;
}

function buildTile(layout, memory) {
  const mutation = mutationFor(layout.index, memory);
  const outerPath = pointPath(mapPoints(layout, OUTER_TEMPLATE, mutation, false));
  const counter = counterPath(layout, mutation);
  const fracturePath = mutation
    ? `M ${round(layout.x - layout.width * 0.38)} ${round(layout.y + mutation.depth * 0.14)} Q ${round(layout.x)} ${round(layout.y - layout.height * 0.48)} ${round(layout.x + layout.width * 0.42)} ${round(layout.y - mutation.depth * 0.12)}`
    : null;
  const state = mutation ? 'opened' : 'quiet';
  return {
    ...layout,
    state,
    mutation,
    outerPath,
    counterPath: counter,
    compoundPath: `${outerPath} ${counter}`,
    fracturePath,
    signature: `${layout.index}:${state}:${outerPath}:${counter}:${fracturePath ?? 'sealed'}`
  };
}

function normalizeMemory(memory) {
  return Array.isArray(memory) ? memory.slice(-MEMORY_WINDOW).map((event) => ({
    type: event.type,
    kind: event.kind,
    sourceTile: event.sourceTile,
    observerTile: event.observerTile,
    receiverTile: event.receiverTile,
    depth: event.depth,
    rotation: event.rotation,
    corner: event.corner
  })) : [];
}

export function geometrySignature(frame) {
  return frame.tiles.map((tile) => tile.signature).join('|');
}

export function buildFrame(memory = []) {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'counterfield-register',
    tiles: TILE_LAYOUT.map((layout) => buildTile(layout, normalizedMemory)),
    memory: normalizedMemory,
    pending: [],
    interaction: normalizedMemory.length ? 'settled' : 'quiet',
    event: null,
    state: { handoffCount: normalizedMemory.length }
  };
}

export function tileAtPoint(frame, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  let best = null;
  let bestScore = Infinity;
  for (const tile of frame.tiles) {
    const local = rotate(point.x - tile.x, point.y - tile.y, (-tile.rotation * Math.PI) / 180);
    const score = (local.x / (tile.width * 0.58)) ** 2 + (local.y / (tile.height * 0.58)) ** 2;
    if (score <= 1 && score < bestScore) {
      best = tile.index;
      bestScore = score;
    }
  }
  return best;
}

export function beginAttention(frame, tileIndex) {
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= TILE_COUNT) return frame;
  return { ...frame, pending: [tileIndex], interaction: 'attention-started', event: null };
}

export function handoffAttention(frame, tileIndex) {
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= TILE_COUNT) return frame;
  if (frame.pending.length !== 1) return frame;
  if (frame.pending[0] === tileIndex) return { ...frame, interaction: 'attention-refused-repeat', event: { type: 'attention-refused-repeat', tile: tileIndex } };
  return { ...frame, pending: [...frame.pending, tileIndex], interaction: 'attention-ready', event: null };
}

function receiverFor(sourceTile, observerTile, memoryLength) {
  let receiver = (sourceTile * 3 + observerTile * 5 + 7 + memoryLength * 2) % TILE_COUNT;
  while (receiver === sourceTile || receiver === observerTile) receiver = (receiver + 1) % TILE_COUNT;
  return receiver;
}

function depthFor(memoryLength) {
  return round(22 + memoryLength * 9);
}

export function commitAttention(frame) {
  if (!Array.isArray(frame.pending) || frame.pending.length !== 2) {
    return { ...frame, interaction: 'attention-refused-incomplete', event: { type: 'attention-refused', pending: [...(frame.pending ?? [])] } };
  }
  const [sourceTile, observerTile] = frame.pending;
  if (sourceTile === observerTile) {
    return { ...frame, interaction: 'attention-refused-repeat', event: { type: 'attention-refused-repeat', tile: sourceTile } };
  }
  const event = {
    type: 'remote-absence',
    kind: 'remote-absence',
    sourceTile,
    observerTile,
    receiverTile: receiverFor(sourceTile, observerTile, frame.memory.length),
    depth: depthFor(frame.memory.length),
    rotation: (sourceTile - observerTile) * 4.5,
    corner: (sourceTile + observerTile + frame.memory.length) % OUTER_TEMPLATE.length
  };
  const next = buildFrame([...frame.memory, event]);
  next.pending = [];
  next.interaction = 'attention-committed';
  next.event = event;
  return next;
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  for (const [source, observer] of [[0, 4], [1, 7], [3, 10], [5, 12]]) {
    let next = beginAttention(timeline.at(-1), source);
    next = handoffAttention(next, observer);
    timeline.push(commitAttention(next));
  }
  return timeline;
}

export function liftLatestAttention(frame) {
  if (!frame.memory.length) return frame;
  const lifted = buildFrame(frame.memory.slice(0, -1));
  lifted.interaction = 'attention-lifted';
  return lifted;
}

export function releaseRegister() {
  return buildFrame();
}
