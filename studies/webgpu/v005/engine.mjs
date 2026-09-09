export const SEED = 0x57475035;
export const STAGES = 13;
export const AGENT_COUNT = 480;
export const MEMORY_LIMIT = 5;

const COLUMNS = 30;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_INDEXES = [
  null,
  { x: 0.2, y: 0.28 },
  null,
  { x: 0.37, y: 0.63 },
  null,
  { x: 0.53, y: 0.38 },
  null,
  { x: 0.68, y: 0.57 },
  null,
  { x: 0.8, y: 0.3 },
  null,
  null,
  null
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

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

function copyIndex(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    radius: Number(record.radius),
    phase: Number(record.phase),
    turn: Number(record.turn)
  };
}

function indexFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.062 + (serial % 3) * 0.014,
    phase: 0.41 + serial * 0.27 + stage * 0.083,
    turn,
    sourceStage: stage,
    source,
    affectedAgents: 0,
    indexLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyIndex);
}

function buildAgent(index, stage, memory) {
  const random = rng(SEED + index * 977 + stage * 7919);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const u = column / (COLUMNS - 1);
  const v = row / (ROWS - 1);
  const phase = random() * Math.PI * 2;
  const origin = {
    x: 0.055 + u * 0.89 + (random() - 0.5) * 0.011,
    y: 0.11 + v * 0.78 + (random() - 0.5) * 0.013
  };
  let x = origin.x + Math.sin(stage * 0.24 + row * 0.21 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 7.8 + row * 0.31 + stage * 0.16 + phase) * (0.011 + u * 0.012);
  let indexDebt = 0;
  let rankShift = 0;
  let phaseSlip = 0;
  const influences = [];

  memory.forEach((record, memoryIndex) => {
    const downstream = smoothstep(0, 1, clamp((x - record.point.x + 0.08) / 0.3));
    const deltaY = y - record.point.y;
    const bandRadius = record.radius + downstream * 0.038;
    const band = Math.exp(-(deltaY * deltaY) / (2 * bandRadius * bandRadius));
    const influence = downstream * band;
    const fingerprint = Math.sin(row * 0.83 + phase * 0.17 + record.phase);
    const step = fingerprint * (0.58 + memoryIndex * 0.1);

    influences.push(influence);
    if (influence <= 0.0001) return;

    indexDebt += influence * (0.32 + memoryIndex * 0.05);
    rankShift += influence * step;
    phaseSlip += influence * (record.turn * 0.88 + step * 0.72);
    x += influence * (record.turn * 0.06 + step * 0.036);
    y += influence * (record.turn * 0.04 + step * 0.095);

    const tail = smoothstep(0.42, 1, downstream);
    y += tail * influence * Math.sin(column * 0.42 + record.phase) * 0.012;
  });

  x = clamp(x, 0.025, 0.975);
  y = clamp(y, 0.045, 0.955);
  const displacement = distance(origin, { x, y });
  const lane = clamp(v + rankShift * 0.2, 0, 1);

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    indexDebt,
    rankShift,
    phaseSlip,
    lane,
    archiveWeight: Math.min(1, influences.reduce((sum, value) => sum + value, 0)),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.75 + random() * 1.45,
    phase,
    influences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => {
    const affected = agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06);
    return {
      ...record,
      affectedAgents: affected.length,
      indexLoad: affected.reduce((sum, agent) => sum + Math.abs(agent.rankShift), 0)
    };
  });
}

function archiveFor(memory) {
  return memory.map((record, index) => ({
    index,
    id: record.id,
    point: { ...record.point },
    radius: record.radius,
    phase: record.phase,
    turn: record.turn,
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    indexLoad: record.indexLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const reindexed = agents.filter((agent) => agent.indexDebt > 0.04);
  const indexShear = agents.reduce((sum, agent) => sum + Math.abs(agent.rankShift) * (1 + agent.archiveWeight), 0);

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      reindexedAgents: reindexed.length,
      indexShear,
      phaseSlip: agents.reduce((sum, agent) => sum + Math.abs(agent.phaseSlip), 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const autoPoint = AUTO_INDEXES[stage];
    if (autoPoint) memory = [...memory, indexFor(autoPoint, stage, 'autonomous-index', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyIndex(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const record = indexFor(bounded, frame.stage, 'visitor-index', frame.memory.length);
  const memory = [...frame.memory, record].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-index' };
}

export function deleteIndex(frame, index = frame.memory.length - 1) {
  if (index < 0 || index >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, memoryIndex) => memoryIndex !== index);
  return { ...buildFrame(frame.stage, memory), interaction: 'index-lifted' };
}
