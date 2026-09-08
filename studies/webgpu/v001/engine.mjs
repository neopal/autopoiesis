export const SEED = 0x57475031;
export const STAGES = 9;
export const AGENT_COUNT = 384;
export const MEMORY_LIMIT = 4;

const COLUMNS = 24;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_CAPTURES = [
  null,
  { x: 0.31, y: 0.34 },
  null,
  { x: 0.48, y: 0.66 },
  null,
  { x: 0.64, y: 0.39 },
  null,
  { x: 0.76, y: 0.58 },
  null
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function copyCapture(capture) {
  return {
    ...capture,
    point: { x: Number(capture.point.x), y: Number(capture.point.y) },
    bend: { x: Number(capture.bend.x), y: Number(capture.bend.y) }
  };
}

function captureFor(point, stage, source, serial = 0) {
  const upper = point.y < 0.5;
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.105 + (serial % 3) * 0.014,
    bend: {
      x: turn * (0.075 + (serial % 2) * 0.018),
      y: (upper ? 1 : -1) * (0.11 + (stage % 3) * 0.012)
    },
    sourceStage: stage,
    source,
    affectedAgents: 0
  };
}

function normalizeCaptures(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyCapture);
}

function buildAgent(index, stage, memory) {
  const random = rng(SEED + index * 977 + stage * 7919);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const u = column / (COLUMNS - 1);
  const v = row / (ROWS - 1);
  const phase = random() * Math.PI * 2;
  const origin = {
    x: 0.085 + u * 0.83 + (random() - 0.5) * 0.012,
    y: 0.16 + v * 0.68 + (random() - 0.5) * 0.014
  };
  let x = origin.x + Math.sin(stage * 0.42 + row * 0.27 + phase) * 0.009;
  let y = origin.y + Math.sin(u * 8.5 + row * 0.32 + stage * 0.24 + phase) * (0.014 + u * 0.012);
  const influences = [];

  for (const capture of memory) {
    const downstream = clamp((x - capture.point.x) / 0.31);
    const deltaY = y - capture.point.y;
    const radius = capture.radius + downstream * 0.045;
    const proximity = Math.exp(-(deltaY * deltaY) / (2 * radius * radius));
    const influence = downstream * proximity;
    if (influence <= 0.0001) {
      influences.push(0);
      continue;
    }

    const side = deltaY >= 0 ? 1 : -1;
    x += capture.bend.x * influence * 0.62;
    y += (capture.bend.y + side * 0.038) * influence;
    influences.push(influence);
  }

  x = clamp(x, 0.035, 0.965);
  y = clamp(y, 0.07, 0.93);
  const displacement = distance(origin, { x, y });
  const archiveWeight = Math.min(1, influences.reduce((sum, value) => sum + value, 0));

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    archiveWeight,
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.85 + random() * 1.45,
    phase,
    influences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((capture, index) => ({
    ...capture,
    affectedAgents: agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06).length
  }));
}

function archiveFor(memory) {
  return memory.map((capture, index) => ({
    index,
    id: capture.id,
    point: { ...capture.point },
    radius: capture.radius,
    bend: { ...capture.bend },
    source: capture.source,
    sourceStage: capture.sourceStage,
    affectedAgents: capture.affectedAgents
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeCaptures(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      laneBreaks: resolvedMemory.length,
      density: agents.length / 384
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const autoPoint = AUTO_CAPTURES[stage];
    if (autoPoint) memory = [...memory, captureFor(autoPoint, stage, 'autonomous-capture', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyCapture(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const capture = captureFor(bounded, frame.stage, 'visitor-capture', frame.memory.length);
  const memory = [...frame.memory, capture].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-capture' };
}

export function deleteCapture(frame, captureIndex = frame.memory.length - 1) {
  if (captureIndex < 0 || captureIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== captureIndex);
  return { ...buildFrame(frame.stage, memory), interaction: 'capture-deleted' };
}
