export const SEED = 0x5747503a;
export const STAGES = 18;
export const AGENT_COUNT = 480;
export const MEMORY_LIMIT = 7;

const COLUMNS = 30;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_SWITCHES = [
  null,
  { x: 0.14, y: 0.24 },
  null,
  { x: 0.28, y: 0.68 },
  null,
  { x: 0.42, y: 0.35 },
  null,
  { x: 0.55, y: 0.58 },
  null,
  { x: 0.66, y: 0.43 },
  null,
  { x: 0.75, y: 0.64 },
  { x: 0.82, y: 0.3 },
  null,
  null,
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

function copySwitch(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    route: {
      entry: { x: Number(record.route.entry.x), y: Number(record.route.entry.y) },
      cross: { x: Number(record.route.cross.x), y: Number(record.route.cross.y) },
      settle: { x: Number(record.route.settle.x), y: Number(record.route.settle.y) }
    },
    radius: Number(record.radius),
    phase: Number(record.phase),
    turn: Number(record.turn),
    laneDelta: Number(record.laneDelta)
  };
}

function switchFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  const entryX = Math.min(0.94, point.x + 0.1);
  const crossX = Math.min(0.975, point.x + 0.29);
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.058 + (serial % 3) * 0.014,
    phase: 0.24 + serial * 0.37 + stage * 0.073,
    turn,
    laneDelta: turn * (0.045 + (serial % 4) * 0.009),
    route: {
      entry: { x: entryX, y: clamp(point.y + turn * 0.075, 0.04, 0.96) },
      cross: { x: crossX, y: clamp(point.y - turn * 0.14, 0.04, 0.96) },
      settle: { x: Math.min(0.995, point.x + 0.56), y: clamp(point.y + turn * 0.035, 0.04, 0.96) }
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    crossingAgents: 0,
    switchedAgents: 0,
    settledAgents: 0,
    crossLoad: 0,
    settleLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copySwitch);
}

function buildAgent(index, stage, memory) {
  const random = rng(SEED + index * 977 + stage * 7919);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const u = column / (COLUMNS - 1);
  const v = row / (ROWS - 1);
  const phase = random() * Math.PI * 2;
  const origin = {
    x: 0.05 + u * 0.9 + (random() - 0.5) * 0.012,
    y: 0.1 + v * 0.8 + (random() - 0.5) * 0.014
  };
  let x = origin.x + Math.sin(stage * 0.18 + row * 0.23 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 7.3 + row * 0.35 + stage * 0.14 + phase) * (0.01 + u * 0.014);
  let entryOffset = 0;
  let crossOffset = 0;
  let settleOffset = 0;
  let handoffOffset = 0;
  let archiveWeight = 0;
  const influences = [];
  const entryInfluences = [];
  const crossInfluences = [];
  const settleInfluences = [];

  memory.forEach((record, memoryIndex) => {
    const runway = Math.max(0.18, Math.min(0.66, 1 - record.point.x + 0.11));
    const progress = clamp((x - record.point.x + 0.045) / runway);
    const downstream = smoothstep(0, 1, progress);
    const deltaY = y - record.point.y;
    const bandRadius = record.radius + downstream * 0.05;
    const band = Math.exp(-(deltaY * deltaY) / (2 * bandRadius * bandRadius));
    const influence = downstream * band;
    const entryWindow = smoothstep(0.025, 0.16, progress) * (1 - smoothstep(0.88, 1, progress));
    const crossWindow = smoothstep(0.16, 0.3, progress) * (1 - smoothstep(0.54, 0.7, progress));
    const settleWindow = smoothstep(0.47, 0.63, progress) * (1 - smoothstep(0.84, 0.98, progress));
    const entry = influence * entryWindow;
    const cross = influence * crossWindow;
    const settle = influence * settleWindow;
    const laneSign = (row + Math.floor(record.phase * 7) + memoryIndex) % 2 === 0 ? 1 : -1;
    const fingerprint = Math.sin(row * 0.77 + phase * 0.19 + record.phase);

    influences.push(influence);
    entryInfluences.push(entry);
    crossInfluences.push(cross);
    settleInfluences.push(settle);
    if (influence <= 0.0001) return;

    archiveWeight += influence * (0.4 + memoryIndex * 0.085);
    entryOffset += laneSign * entry * (0.07 + memoryIndex * 0.009);
    crossOffset += laneSign * cross * (0.18 + memoryIndex * 0.017);
    settleOffset += laneSign * settle * (0.13 + memoryIndex * 0.012);
    handoffOffset += laneSign * (cross * 0.058 + settle * (0.12 + record.laneDelta * 0.3));

    // The changed rule: two cohorts exchange lanes through a finite crossing,
    // then keep the exchanged order as the field settles downstream.
    y += laneSign * entry * 0.052;
    y += laneSign * cross * (0.19 + memoryIndex * 0.014);
    y += laneSign * settle * (0.11 + memoryIndex * 0.012);
    y += Math.sin(column * 0.39 + record.phase) * cross * 0.031;
    y += fingerprint * settle * 0.036;
    x += influence * record.turn * 0.026;
    if (settle > 0) {
      const settleBias = clamp(settle * (0.2 + memoryIndex * 0.035), 0, 0.52);
      y = record.point.y + (y - record.point.y) * (1 - settleBias);
    }
  });

  x = clamp(x, 0.025, 0.975);
  y = clamp(y, 0.04, 0.96);
  const displacement = distance(origin, { x, y });
  const lane = clamp(v + handoffOffset * 0.44, 0, 1);

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    entryOffset,
    crossOffset,
    settleOffset,
    handoffOffset,
    lane,
    archiveWeight: Math.min(1, archiveWeight),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.7 + random() * 1.55,
    phase,
    influences,
    entryInfluences,
    crossInfluences,
    settleInfluences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => ({
    ...record,
    affectedAgents: agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06).length,
    crossingAgents: agents.filter((agent) => (agent.crossInfluences[index] ?? 0) > 0.035).length,
    switchedAgents: agents.filter((agent) => Math.abs(agent.handoffOffset) > 0.025 && (agent.crossInfluences[index] ?? 0) > 0.02).length,
    settledAgents: agents.filter((agent) => (agent.settleInfluences[index] ?? 0) > 0.035).length,
    crossLoad: agents.reduce((sum, agent) => sum + (agent.crossInfluences[index] ?? 0), 0),
    settleLoad: agents.reduce((sum, agent) => sum + (agent.settleInfluences[index] ?? 0), 0)
  }));
}

function archiveFor(memory) {
  return memory.map((record, index) => ({
    index,
    id: record.id,
    point: { ...record.point },
    radius: record.radius,
    phase: record.phase,
    turn: record.turn,
    laneDelta: record.laneDelta,
    route: {
      entry: { ...record.route.entry },
      cross: { ...record.route.cross },
      settle: { ...record.route.settle }
    },
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    crossingAgents: record.crossingAgents,
    switchedAgents: record.switchedAgents,
    settledAgents: record.settledAgents,
    crossLoad: record.crossLoad,
    settleLoad: record.settleLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const crossingAgents = agents.filter((agent) => agent.crossInfluences.some((value) => value > 0.035));
  const switchedAgents = agents.filter((agent) => Math.abs(agent.handoffOffset) > 0.025);
  const settledAgents = agents.filter((agent) => agent.settleInfluences.some((value) => value > 0.035));

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      crossingAgents: crossingAgents.length,
      switchedAgents: switchedAgents.length,
      settledAgents: settledAgents.length,
      routeSeparation: agents.reduce((sum, agent) => sum + Math.abs(agent.crossOffset) * (1 + agent.archiveWeight), 0),
      switchStrength: agents.reduce((sum, agent) => sum + Math.abs(agent.crossOffset) + Math.abs(agent.settleOffset) * 0.72, 0) / AGENT_COUNT,
      laneExchange: agents.reduce((sum, agent) => sum + Math.abs(agent.handoffOffset), 0) / AGENT_COUNT,
      settleLoad: agents.reduce((sum, agent) => sum + Math.abs(agent.settleOffset), 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const point = AUTO_SWITCHES[stage];
    if (point) memory = [...memory, switchFor(point, stage, 'autonomous-switch', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applySwitch(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const record = switchFor(bounded, frame.stage, 'visitor-switch', frame.memory.length);
  const memory = [...frame.memory, record].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-switch' };
}

export function deleteSwitch(frame, index = frame.memory.length - 1) {
  if (index < 0 || index >= frame.memory.length) return { ...buildFrame(frame.stage, frame.memory), interaction: 'switch-lifted' };
  const memory = frame.memory.filter((_, memoryIndex) => memoryIndex !== index);
  return { ...buildFrame(frame.stage, memory), interaction: 'switch-lifted' };
}
