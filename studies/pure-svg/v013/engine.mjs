export const SEED = 0x53564743;
export const STAGES = 12;
export const PRIMITIVE_BUDGET = 24;
export const MEMORY_LIMIT = 4;
export const NODE_COUNT = 24;

const CENTER = { x: 0.5, y: 0.48 };
const RINGS = [
  { count: 6, radius: 0.15, phase: 0.12 },
  { count: 8, radius: 0.27, phase: 0.38 },
  { count: 10, radius: 0.39, phase: 0.05 }
];
const AUTO_GAZES = [
  { x: 0.76, y: 0.30 },
  { x: 0.25, y: 0.66 },
  { x: 0.83, y: 0.65 },
  { x: 0.20, y: 0.34 },
  { x: 0.67, y: 0.22 },
  { x: 0.35, y: 0.76 }
];

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyNode(node) {
  return {
    ...node,
    x: Number(node.x),
    y: Number(node.y),
    size: Number(node.size),
    angle: Number(node.angle),
    visible: Boolean(node.visible)
  };
}

function copyGaze(gaze) {
  return {
    ...gaze,
    point: copyPoint(gaze.point),
    lookingIndices: [...gaze.lookingIndices],
    answeringIndices: [...gaze.answeringIndices]
  };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function baseNodes(stage) {
  const random = rng(SEED + stage * 7919);
  const nodes = [];
  let index = 0;
  for (const ring of RINGS) {
    for (let slot = 0; slot < ring.count; slot += 1) {
      const angle = ring.phase + (slot / ring.count) * Math.PI * 2 + stage * 0.018;
      const jitter = (random() - 0.5) * 0.016;
      const radius = ring.radius + jitter;
      nodes.push({
        id: `node-${String(index).padStart(2, '0')}`,
        x: clamp(CENTER.x + Math.cos(angle) * radius * 1.18 + (random() - 0.5) * 0.008, 0.07, 0.93),
        y: clamp(CENTER.y + Math.sin(angle) * radius * 0.78 + (random() - 0.5) * 0.008, 0.12, 0.86),
        size: 0.028 + (index % 3) * 0.006 + ring.radius * 0.018,
        angle: angle + Math.PI / 2,
        ring: ring.radius,
        visible: true,
        role: 'idle'
      });
      index += 1;
    }
  }
  return nodes;
}

function nearestIndex(point, nodes) {
  return nodes.reduce((best, node, index) => (
    distance(point, node) < distance(point, nodes[best]) ? index : best
  ), 0);
}

function neighboringIndices(focusIndex) {
  const ringStart = focusIndex < 6 ? 0 : focusIndex < 14 ? 6 : 14;
  const ringLength = focusIndex < 6 ? 6 : focusIndex < 14 ? 8 : 10;
  const slot = focusIndex - ringStart;
  return [
    focusIndex,
    ringStart + ((slot + 1) % ringLength),
    ringStart + ((slot - 1 + ringLength) % ringLength)
  ];
}

function makeGaze(nodes, stage, point, source = 'auto-gaze') {
  const focusIndex = nearestIndex(point, nodes);
  const lookingIndices = neighboringIndices(focusIndex);
  const answeringCandidates = nodes
    .map((node, index) => ({ index, score: distance(node, point) }))
    .filter(({ index }) => !lookingIndices.includes(index))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ index }) => index)
    .sort((a, b) => a - b);
  const vacancyIndex = (focusIndex + 7 + stage) % nodes.length;
  const answeringIndices = answeringCandidates.filter((index) => index !== vacancyIndex);
  return {
    kind: 'gaze',
    point: copyPoint(point),
    focusIndex,
    lookingIndices,
    answeringIndices,
    vacancyIndex,
    source,
    stage,
    vector: normalize({ x: point.x - nodes[focusIndex].x, y: point.y - nodes[focusIndex].y })
  };
}

function applyMemory(nodes, memory) {
  const result = nodes.map(copyNode);
  const vacant = new Set();
  for (const gaze of memory) vacant.add(gaze.vacancyIndex);

  for (const [gazeIndex, gaze] of memory.entries()) {
    const age = memory.length - gazeIndex;
    const strength = 0.72 + age * 0.06;
    for (const index of gaze.lookingIndices) {
      const node = result[index];
      if (!node.visible) continue;
      const targetAngle = angleTo(node, gaze.point);
      node.x = clamp(lerp(node.x, gaze.point.x, 0.055 * strength), 0.055, 0.945);
      node.y = clamp(lerp(node.y, gaze.point.y, 0.055 * strength), 0.11, 0.89);
      node.angle = lerp(node.angle, targetAngle, 0.24 * strength);
      node.size += 0.0035 * strength;
      node.role = 'looking';
    }
    for (const index of gaze.answeringIndices) {
      const node = result[index];
      if (!node.visible) continue;
      const away = normalize({ x: node.x - gaze.point.x, y: node.y - gaze.point.y });
      node.x = clamp(node.x + away.x * 0.008 * strength, 0.055, 0.945);
      node.y = clamp(node.y + away.y * 0.008 * strength, 0.11, 0.89);
      node.angle = lerp(node.angle, angleTo(gaze.point, node), 0.18 * strength);
      node.size = Math.max(0.024, node.size - 0.001 * strength);
      node.role = 'answering';
    }
    for (const node of result) {
      if (!node.visible || gaze.lookingIndices.includes(node.id)) continue;
      if (node.role === 'idle' && node.ring > 0.25) {
        node.angle += Math.sin(gazeIndex + node.x * 9) * 0.008 * strength;
      }
    }
  }

  for (const index of vacant) {
    if (result[index]) {
      result[index].visible = false;
      result[index].role = 'vacancy';
    }
  }
  return result;
}

export function buildFrame(stage, memory = []) {
  const draft = baseNodes(stage);
  const inherited = memory.map(copyGaze);
  const nodes = applyMemory(draft, inherited);
  return {
    stage,
    draft: draft.map(copyNode),
    nodes,
    points: nodes.map(({ x, y }) => ({ x, y })),
    gaze: inherited.at(-1) ?? null,
    memory: inherited,
    vacancies: nodes.filter((node) => !node.visible).length,
    looking: nodes.filter((node) => node.visible && node.role === 'looking').length,
    answering: nodes.filter((node) => node.visible && node.role === 'answering').length,
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage % 2 === 1) {
      const point = AUTO_GAZES[(stage - 1) / 2 % AUTO_GAZES.length];
      const gaze = makeGaze(frame.nodes, stage, point);
      memory = [...memory, gaze].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyGaze(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.16, 0.84)
  };
  const gaze = makeGaze(frame.nodes, frame.stage, bounded, 'visitor-gaze');
  const priorMemory = frame.memory.map(copyGaze);
  const next = buildFrame(frame.stage, [...frame.memory, gaze].slice(-MEMORY_LIMIT));
  return { ...next, gaze, priorMemory, interaction: 'visitor-gaze' };
}

export function deleteGaze(frame, gazeIndex = frame.memory.length - 1) {
  if (gazeIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (gazeIndex < 0 || gazeIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== gazeIndex);
  return buildFrame(frame.stage, memory);
}
