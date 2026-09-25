export const SEED = 0x57473136;
export const STAGES = 17;
export const STRANDS = 4;
export const POINTS = 21;
export const NODE_COUNT = STRANDS * POINTS;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 42;

const AUTO_GESTURES = [
  { start: { x: 0.12, y: 0.21 }, end: { x: 0.76, y: 0.74 } },
  { start: { x: 0.39, y: 0.68 }, end: { x: 0.91, y: 0.28 } },
  { start: { x: 0.68, y: 0.22 }, end: { x: 0.18, y: 0.79 } },
  { start: { x: 0.88, y: 0.64 }, end: { x: 0.43, y: 0.34 } }
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const clampPoint = (point = {}) => ({
  x: clamp(Number.isFinite(Number(point.x)) ? Number(point.x) : 0.5, 0.06, 0.94),
  y: clamp(Number.isFinite(Number(point.y)) ? Number(point.y) : 0.5, 0.08, 0.92)
});
const hash = (value) => {
  const x = Math.sin(value * 12.9898 + SEED * 0.00001) * 43758.5453;
  return x - Math.floor(x);
};
const nodeId = (strand, point) => strand * POINTS + point;
const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const copyPoint = (point) => ({ x: point.x, y: point.y });
const copyEdge = (edge) => [edge[0], edge[1]];

const baseNodes = () => {
  const nodes = [];
  for (let strand = 0; strand < STRANDS; strand += 1) {
    for (let point = 0; point < POINTS; point += 1) {
      const t = point / (POINTS - 1);
      const phase = strand * Math.PI * 0.5;
      const angle = phase + t * Math.PI * 4.2;
      const radius = 0.205 + 0.032 * Math.sin(t * Math.PI * 2.0 + strand) + (hash(strand * 71 + point * 13) - 0.5) * 0.018;
      nodes.push({
        id: nodeId(strand, point),
        strand,
        point,
        x: Math.cos(angle) * radius,
        y: (t - 0.5) * 1.28,
        z: Math.sin(angle) * radius,
        baseX: Math.cos(angle) * radius,
        baseY: (t - 0.5) * 1.28,
        baseZ: Math.sin(angle) * radius,
        phase,
        tension: 0,
        graft: 0
      });
    }
  }
  return nodes;
};

const baseEdges = () => {
  const edges = [];
  for (let strand = 0; strand < STRANDS; strand += 1) {
    for (let point = 0; point < POINTS - 1; point += 1) {
      edges.push([nodeId(strand, point), nodeId(strand, point + 1), 'base', -1]);
    }
  }
  for (let point = 2; point < POINTS - 1; point += 4) {
    for (let strand = 0; strand < STRANDS; strand += 1) {
      const next = (strand + 1) % STRANDS;
      edges.push([nodeId(strand, point), nodeId(next, point), 'brace', -1]);
    }
  }
  return edges;
};

export const isMeaningfulGesture = (gesture = {}) => {
  const start = clampPoint(gesture.start);
  const end = clampPoint(gesture.end);
  return Math.hypot(end.x - start.x, end.y - start.y) >= 0.16;
};

const normalizeGesture = (gesture, serial = 0, source = 'visitor-drag') => {
  const start = clampPoint(gesture?.start);
  const end = clampPoint(gesture?.end);
  let sourceStrand = Math.min(STRANDS - 1, Math.floor(start.x * STRANDS));
  let targetStrand = Math.min(STRANDS - 1, Math.floor(end.x * STRANDS));
  if (targetStrand === sourceStrand) targetStrand = (targetStrand + 1) % STRANDS;
  const sourcePoint = 1 + Math.min(POINTS - 3, Math.floor(start.y * (POINTS - 2)));
  const targetPoint = 1 + Math.min(POINTS - 3, Math.floor(end.y * (POINTS - 2)));
  const sourceA = nodeId(sourceStrand, sourcePoint);
  const sourceB = nodeId(sourceStrand, sourcePoint + 1);
  const targetA = nodeId(targetStrand, targetPoint);
  const targetB = nodeId(targetStrand, targetPoint + 1);
  return {
    id: `${source}-${serial}`,
    source,
    mode: 'topological-knot',
    start,
    end,
    sourceStrand,
    targetStrand,
    sourcePoint,
    targetPoint,
    cutEdges: [[sourceA, sourceB], [targetA, targetB]],
    bridgeEdges: [[sourceA, targetA], [sourceB, targetB]]
  };
};

const copyEvent = (event, index) => normalizeGesture({ start: event.start, end: event.end }, index, event.source || 'replayed-drag');

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map(copyEvent);

const applyEventToNodes = (nodes, event, index) => {
  const ids = [...event.cutEdges[0], ...event.cutEdges[1]];
  const target = nodes[event.targetPoint + event.targetStrand * POINTS];
  const source = nodes[event.sourcePoint + event.sourceStrand * POINTS];
  const dx = (target.x - source.x) * 0.18;
  const dy = (target.y - source.y) * 0.08;
  const dz = (target.z - source.z) * 0.18;
  for (const id of ids) {
    const node = nodes[id];
    const sign = id % 2 === 0 ? 1 : -1;
    node.x += dx * sign;
    node.y += dy * sign;
    node.z += dz * sign;
    node.tension += 0.36 + index * 0.08;
    node.graft += 1;
  }
};

const buildGraph = (memory) => {
  const removed = new Map();
  const bridges = [];
  const nodes = baseNodes();
  memory.forEach((event, index) => {
    event.cutEdges.forEach((edge) => removed.set(edgeKey(edge[0], edge[1]), { edge: copyEdge(edge), eventIndex: index }));
    event.bridgeEdges.forEach((edge) => bridges.push({ edge: copyEdge(edge), type: 'bridge', eventIndex: index }));
    applyEventToNodes(nodes, event, index);
  });
  const edges = baseEdges()
    .filter((edge) => !removed.has(edgeKey(edge[0], edge[1])))
    .map((edge) => ({ edge: [edge[0], edge[1]], type: edge[2], eventIndex: edge[3] }))
    .concat(bridges);
  const signature = JSON.stringify(edges.map((entry) => [entry.edge[0], entry.edge[1], entry.type, entry.eventIndex]));
  return {
    nodes,
    edges,
    removedEdges: [...removed.values()].map((entry) => entry.edge),
    bridgeEdges: bridges.map((entry) => entry.edge),
    signature,
    baseEdgeCount: baseEdges().length,
    edgeCount: edges.length,
    spliceCount: memory.length
  };
};

export const buildFrame = (stage = 0, memory = []) => {
  const normalizedMemory = normalizeMemory(memory);
  const graph = buildGraph(normalizedMemory);
  return {
    stage: clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1),
    memory: normalizedMemory,
    graph,
    archive: normalizedMemory.map((event, index) => ({
      index,
      id: event.id,
      sourceStrand: event.sourceStrand,
      targetStrand: event.targetStrand,
      removedEdges: event.cutEdges.map(copyEdge),
      bridgeEdges: event.bridgeEdges.map(copyEdge)
    }))
  };
};

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const memory = AUTO_GESTURES.filter((_, index) => stage >= (index + 1) * 3)
    .map((gesture, index) => normalizeGesture(gesture, index, 'auto-knot'));
  return buildFrame(stage, memory);
});

export const applyKnot = (frame, gesture) => {
  if (!isMeaningfulGesture(gesture)) return frame;
  const event = normalizeGesture(gesture, frame.memory.length, 'visitor-drag');
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event]);
};

export const liftLatestKnot = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1));
export const releaseKnots = () => buildFrame(0, []);
export const defaultGesture = () => ({ start: copyPoint(AUTO_GESTURES[0].start), end: copyPoint(AUTO_GESTURES[0].end) });
export const geometrySignature = (frame) => JSON.stringify({ nodes: frame.graph.nodes.map((node) => [Number(node.x.toFixed(6)), Number(node.y.toFixed(6)), Number(node.z.toFixed(6)), Number(node.tension.toFixed(6))]), edges: frame.graph.signature });
