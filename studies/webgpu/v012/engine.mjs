export const SEED = 0x5747503c;
export const STAGES = 21;
export const AGENT_COUNT = 540;
export const MEMORY_LIMIT = 8;

const COLUMNS = 30;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_HINGES = [
  null,
  { x: 0.12, y: 0.64 },
  null,
  { x: 0.23, y: 0.31 },
  null,
  { x: 0.35, y: 0.56 },
  null,
  { x: 0.47, y: 0.36 },
  null,
  { x: 0.58, y: 0.69 },
  null,
  { x: 0.69, y: 0.43 },
  null,
  { x: 0.78, y: 0.59 },
  null,
  { x: 0.86, y: 0.29 },
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

function copyHinge(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    route: {
      entry: { x: Number(record.route.entry.x), y: Number(record.route.entry.y) },
      hinge: { x: Number(record.route.hinge.x), y: Number(record.route.hinge.y) },
      fold: { x: Number(record.route.fold.x), y: Number(record.route.fold.y) },
      fan: { x: Number(record.route.fan.x), y: Number(record.route.fan.y) },
      trace: { x: Number(record.route.trace.x), y: Number(record.route.trace.y) }
    },
    radius: Number(record.radius),
    phase: Number(record.phase),
    turn: Number(record.turn),
    fold: Number(record.fold),
    fan: Number(record.fan)
  };
}

function hingeFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.048 + (serial % 3) * 0.012,
    phase: 0.31 + serial * 0.41 + stage * 0.067,
    turn,
    fold: 0.34 + (serial % 3) * 0.028,
    fan: 0.42 + (serial % 4) * 0.022,
    route: {
      entry: { x: Math.min(0.955, point.x + 0.035), y: clamp(point.y + turn * 0.045, 0.04, 0.96) },
      hinge: { x: Math.min(0.975, point.x + 0.12), y: clamp(point.y - turn * 0.09, 0.04, 0.96) },
      fold: { x: Math.min(0.986, point.x + 0.24), y: clamp(point.y + turn * 0.14, 0.04, 0.96) },
      fan: { x: Math.min(0.993, point.x + 0.42), y: clamp(point.y - turn * 0.18, 0.04, 0.96) },
      trace: { x: Math.min(0.997, point.x + 0.6), y: clamp(point.y + turn * 0.07, 0.04, 0.96) }
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    convergedAgents: 0,
    foldedAgents: 0,
    fannedAgents: 0,
    tracedAgents: 0,
    convergenceLoad: 0,
    foldLoad: 0,
    fanLoad: 0,
    traceLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyHinge);
}

function buildAgent(index, stage, memory) {
  const random = rng(SEED + index * 977 + stage * 7919);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const u = column / (COLUMNS - 1);
  const v = row / (ROWS - 1);
  const phase = random() * Math.PI * 2;
  const origin = {
    x: 0.045 + u * 0.91 + (random() - 0.5) * 0.012,
    y: 0.085 + v * 0.83 + (random() - 0.5) * 0.014
  };
  let x = origin.x + Math.sin(stage * 0.15 + row * 0.21 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 7.1 + row * 0.33 + stage * 0.12 + phase) * (0.009 + u * 0.014);
  let convergenceOffset = 0;
  let foldOffset = 0;
  let fanOffset = 0;
  let traceOffset = 0;
  let archiveWeight = 0;
  const influences = [];
  const convergenceInfluences = [];
  const foldInfluences = [];
  const fanInfluences = [];
  const traceInfluences = [];

  memory.forEach((record, memoryIndex) => {
    const runway = Math.max(0.22, Math.min(0.72, 1 - record.point.x + 0.1));
    const progress = clamp((x - record.point.x + 0.04) / runway);
    const downstream = smoothstep(0, 1, progress);
    const deltaY = y - record.point.y;
    const bandRadius = record.radius + downstream * 0.05;
    const band = Math.exp(-(deltaY * deltaY) / (2 * bandRadius * bandRadius));
    const influence = downstream * band;
    const converge = influence * smoothstep(0.02, 0.13, progress) * (1 - smoothstep(0.29, 0.41, progress));
    const fold = influence * smoothstep(0.27, 0.39, progress) * (1 - smoothstep(0.48, 0.6, progress));
    const fan = influence * smoothstep(0.47, 0.59, progress) * (1 - smoothstep(0.71, 0.83, progress));
    const trace = influence * smoothstep(0.67, 0.78, progress) * (1 - smoothstep(0.9, 0.99, progress));
    const laneSign = (row + Math.floor(record.phase * 7) + memoryIndex) % 2 === 0 ? 1 : -1;
    const fingerprint = Math.sin(row * 0.73 + phase * 0.2 + record.phase);

    influences.push(influence);
    convergenceInfluences.push(converge);
    foldInfluences.push(fold);
    fanInfluences.push(fan);
    traceInfluences.push(trace);
    if (influence <= 0.0001) return;

    archiveWeight += influence * (0.34 + memoryIndex * 0.085);
    convergenceOffset += Math.abs(y - record.point.y) * converge;
    foldOffset += laneSign * fold * record.fold;
    fanOffset += laneSign * fan * record.fan;
    traceOffset += fingerprint * trace * 0.16;

    // Changed rule: a remembered absence converges a cohort, folds its local
    // order across a hinge, and fans it back out with a downstream trace.
    y += (record.point.y - y) * converge * 0.72;
    y += laneSign * fold * record.fold * 1.4;
    y += laneSign * fan * record.fan * 1.4;
    y += fingerprint * trace * 0.18;
    x += converge * 0.006;
    x -= fold * (0.05 + memoryIndex * 0.006);
    x += fan * (0.14 + memoryIndex * 0.01);
    x += trace * (0.18 + memoryIndex * 0.01);
  });

  x = clamp(x, 0.02, 0.99);
  y = clamp(y, 0.035, 0.965);
  const displacement = distance(origin, { x, y });
  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    convergenceOffset,
    foldOffset,
    fanOffset,
    traceOffset,
    lane: clamp(v + (foldOffset + fanOffset + traceOffset) * 0.38, 0, 1),
    archiveWeight: Math.min(1, archiveWeight),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.72 + random() * 1.5,
    phase,
    influences,
    convergenceInfluences,
    foldInfluences,
    fanInfluences,
    traceInfluences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => ({
    ...record,
    affectedAgents: agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06).length,
    convergedAgents: agents.filter((agent) => (agent.convergenceInfluences[index] ?? 0) > 0.035).length,
    foldedAgents: agents.filter((agent) => (agent.foldInfluences[index] ?? 0) > 0.035).length,
    fannedAgents: agents.filter((agent) => (agent.fanInfluences[index] ?? 0) > 0.035).length,
    tracedAgents: agents.filter((agent) => (agent.traceInfluences[index] ?? 0) > 0.025).length,
    convergenceLoad: agents.reduce((sum, agent) => sum + (agent.convergenceInfluences[index] ?? 0), 0),
    foldLoad: agents.reduce((sum, agent) => sum + (agent.foldInfluences[index] ?? 0), 0),
    fanLoad: agents.reduce((sum, agent) => sum + (agent.fanInfluences[index] ?? 0), 0),
    traceLoad: agents.reduce((sum, agent) => sum + (agent.traceInfluences[index] ?? 0), 0)
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
    fold: record.fold,
    fan: record.fan,
    route: {
      entry: { ...record.route.entry },
      hinge: { ...record.route.hinge },
      fold: { ...record.route.fold },
      fan: { ...record.route.fan },
      trace: { ...record.route.trace }
    },
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    convergedAgents: record.convergedAgents,
    foldedAgents: record.foldedAgents,
    fannedAgents: record.fannedAgents,
    tracedAgents: record.tracedAgents,
    convergenceLoad: record.convergenceLoad,
    foldLoad: record.foldLoad,
    fanLoad: record.fanLoad,
    traceLoad: record.traceLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const convergedAgents = agents.filter((agent) => agent.convergenceInfluences.some((value) => value > 0.035));
  const foldedAgents = agents.filter((agent) => agent.foldInfluences.some((value) => value > 0.035));
  const fannedAgents = agents.filter((agent) => agent.fanInfluences.some((value) => value > 0.035));
  const tracedAgents = agents.filter((agent) => agent.traceInfluences.some((value) => value > 0.025));

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      convergedAgents: convergedAgents.length,
      foldedAgents: foldedAgents.length,
      fannedAgents: fannedAgents.length,
      tracedAgents: tracedAgents.length,
      hingeStrength: agents.reduce((sum, agent) => sum + Math.abs(agent.foldOffset) + Math.abs(agent.fanOffset) + Math.abs(agent.traceOffset), 0) / AGENT_COUNT,
      convergenceLoad: agents.reduce((sum, agent) => sum + Math.abs(agent.convergenceOffset), 0),
      foldLoad: agents.reduce((sum, agent) => sum + Math.abs(agent.foldOffset), 0),
      fanLoad: agents.reduce((sum, agent) => sum + Math.abs(agent.fanOffset), 0),
      traceLoad: agents.reduce((sum, agent) => sum + Math.abs(agent.traceOffset), 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const point = AUTO_HINGES[stage];
    if (point) memory = [...memory, hingeFor(point, stage, 'autonomous-hinge', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyHinge(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const record = hingeFor(bounded, frame.stage, 'visitor-hinge', frame.memory.length);
  const memory = [...frame.memory, record].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-hinge' };
}

export function deleteHinge(frame, index = frame.memory.length - 1) {
  if (index < 0 || index >= frame.memory.length) return { ...buildFrame(frame.stage, frame.memory), interaction: 'hinge-lifted' };
  const memory = frame.memory.filter((_, memoryIndex) => memoryIndex !== index);
  return { ...buildFrame(frame.stage, memory), interaction: 'hinge-lifted' };
}
