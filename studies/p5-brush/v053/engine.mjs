export const SEED = 0x42523533;
export const NODE_COUNT = 32;
export const CROSSING_LIMIT = 4;

const TAU = Math.PI * 2;
const EDGES = {
  west: [-1, 0],
  east: [1, 0],
  north: [0, -1],
  south: [0, 1]
};
const EDGE_NAMES = Object.keys(EDGES);

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result ^= result + Math.imul(result ^ value >>> 7, 61 | result);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function edgePoint(edge) {
  const [x, y] = EDGES[edge];
  return { x: 0.5 + x * 0.52, y: 0.5 + y * 0.52 };
}

function baseNodes() {
  const random = createRng(SEED);
  const nodes = [];
  for (let index = 0; index < NODE_COUNT; index += 1) {
    const angle = -Math.PI * 0.08 + index / NODE_COUNT * TAU;
    const modulation = 1 + Math.sin(angle * 3 + 0.4) * 0.065 + Math.cos(angle * 5 - 0.7) * 0.035;
    const x = 0.5 + Math.cos(angle) * 0.36 * modulation + (random() - 0.5) * 0.006;
    const y = 0.5 + Math.sin(angle) * 0.31 * (1 + Math.cos(angle * 2) * 0.04) + (random() - 0.5) * 0.006;
    nodes.push({
      index,
      baseX: x,
      baseY: y,
      x,
      y,
      thickness: 0.018 + random() * 0.018,
      phase: random() * TAU
    });
  }
  return nodes;
}

const BASE_NODES = baseNodes();

function baseSeams() {
  const seams = [];
  for (let seamIndex = 0; seamIndex < 7; seamIndex += 1) {
    const points = [];
    for (let step = 0; step < 18; step += 1) {
      const u = step / 17;
      const x = 0.2 + u * 0.6;
      const y = 0.28 + seamIndex * 0.075 + Math.sin(u * Math.PI * 2.2 + seamIndex * 0.9) * 0.026;
      points.push({ x, y, baseX: x, baseY: y });
    }
    seams.push({ index: seamIndex, points });
  }
  return seams;
}

const BASE_SEAMS = baseSeams();

function normalizeEvent(event, order) {
  return {
    kind: 'pressure-crossing',
    entry: event.entry,
    exit: event.exit,
    order,
    pressure: Number(clamp(Number(event.pressure), 0, 1).toFixed(5)),
    settle: Number(clamp(Number(event.settle), 0, 1).toFixed(5)),
    arc: Number(clamp(Number(event.arc), -1, 1).toFixed(5))
  };
}

function validEvent(event) {
  return Boolean(
    event
    && EDGE_NAMES.includes(event.entry)
    && EDGE_NAMES.includes(event.exit)
    && event.entry !== event.exit
    && Number(event.pressure) >= 0.45
    && Number(event.settle) >= 0.62
    && Math.abs(Number(event.arc)) >= 0.08
  );
}

function warpPoint(point, event, order) {
  const entry = edgePoint(event.entry);
  const exit = edgePoint(event.exit);
  let tx = exit.x - entry.x;
  let ty = exit.y - entry.y;
  const length = Math.hypot(tx, ty) || 1;
  tx /= length;
  ty /= length;
  const nx = -ty;
  const ny = tx;
  const rx = point.x - 0.5;
  const ry = point.y - 0.5;
  const along = rx * tx + ry * ty;
  const across = rx * nx + ry * ny;
  const pressure = event.pressure;
  const settle = event.settle;
  const phase = (order + 1) * 0.83 + event.arc * 2.4;
  const broad = 0.009 + pressure * 0.026;
  const wave = Math.sin(across * 12 + phase) * broad;
  const bow = Math.sin(along * 9 - phase) * (0.008 + settle * 0.018);
  const twist = event.arc * (0.008 + pressure * 0.016) * (0.5 + Math.abs(across));
  return {
    ...point,
    x: point.x + tx * (wave + twist) + nx * bow,
    y: point.y + ty * (wave + twist) + ny * bow
  };
}

function rebuildBody(memory) {
  const nodes = BASE_NODES.map((node) => ({ ...node }));
  const seams = BASE_SEAMS.map((seam) => ({
    index: seam.index,
    points: seam.points.map((point) => ({ ...point }))
  }));

  memory.forEach((event, order) => {
    nodes.forEach((node, index) => {
      const warped = warpPoint(node, event, order);
      node.x = warped.x;
      node.y = warped.y;
      node.thickness = node.thickness + Math.sin(index * 0.73 + order) * 0.0008 + event.pressure * 0.0007;
    });
    seams.forEach((seam) => {
      seam.points = seam.points.map((point) => warpPoint(point, event, order));
    });
  });

  return { nodes, seams };
}

function frameFromMemory(memory, interaction = 'dry membrane') {
  const safeMemory = clone(memory);
  const body = rebuildBody(safeMemory);
  return {
    composition: 'tension-membrane',
    renderer: 'canvas-2d',
    seed: SEED,
    stage: safeMemory.length,
    interaction,
    memory: safeMemory,
    selectedEntry: 'west',
    selectedExit: 'east',
    body: {
      nodes: body.nodes,
      seams: body.seams,
      substrate: 'continuous skin',
      crossingCount: safeMemory.length
    }
  };
}

export function buildFrame() {
  return frameFromMemory([]);
}

export function geometrySignature(field) {
  return JSON.stringify({
    memory: field.memory.map(({ entry, exit, order, pressure, settle, arc }) => ({ entry, exit, order, pressure, settle, arc })),
    nodes: field.body.nodes.map((node) => ({
      index: node.index,
      x: Number(node.x.toFixed(7)),
      y: Number(node.y.toFixed(7)),
      thickness: Number(node.thickness.toFixed(7))
    })),
    seams: field.body.seams.map((seam) => seam.points.map((point) => ({
      x: Number(point.x.toFixed(7)),
      y: Number(point.y.toFixed(7))
    })))
  });
}

export function commitPass(field, event) {
  const current = clone(field);
  if (!validEvent(event)) {
    current.interaction = event?.entry === event?.exit
      ? 'refused / same edge'
      : Number(event?.settle) < 0.62
        ? 'refused / pressure did not settle'
        : Math.abs(Number(event?.arc)) < 0.08
          ? 'refused / passage was too short'
          : 'refused / incomplete passage';
    return { accepted: false, event: null, field: current };
  }
  if (current.memory.length >= CROSSING_LIMIT) {
    current.interaction = 'refused / membrane is dry';
    return { accepted: false, event: null, field: current };
  }

  const committed = normalizeEvent(event, current.memory.length);
  const memory = [...current.memory, committed];
  return {
    accepted: true,
    event: committed,
    field: frameFromMemory(memory, 'pass committed')
  };
}

export function liftLatest(field) {
  if (!field.memory.length) return frameFromMemory([], 'lift refused / membrane is quiet');
  return frameFromMemory(field.memory.slice(0, -1), 'lifted / exact');
}

export function releaseMembrane() {
  return frameFromMemory([], 'dry membrane');
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  const passes = [
    { entry: 'west', exit: 'east', pressure: 0.76, settle: 0.82, arc: 0.28 },
    { entry: 'north', exit: 'south', pressure: 0.64, settle: 0.78, arc: -0.22 },
    { entry: 'east', exit: 'west', pressure: 0.71, settle: 0.88, arc: 0.31 },
    { entry: 'south', exit: 'north', pressure: 0.83, settle: 0.74, arc: -0.18 }
  ];
  let frame = timeline[0];
  for (const pass of passes) {
    const result = commitPass(frame, pass);
    if (!result.accepted) throw new Error(`Unable to build v053 timeline at ${pass.entry}-${pass.exit}`);
    frame = result.field;
    timeline.push(frame);
  }
  return timeline;
}
