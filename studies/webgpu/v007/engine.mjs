export const SEED = 0x57475037;
export const STAGES = 15;
export const AGENT_COUNT = 480;
export const MEMORY_LIMIT = 5;

const COLUMNS = 30;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_CENSUSES = [
  null,
  { x: 0.18, y: 0.25 },
  null,
  { x: 0.35, y: 0.68 },
  null,
  { x: 0.5, y: 0.36 },
  null,
  { x: 0.64, y: 0.58 },
  null,
  { x: 0.74, y: 0.44 },
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

function copyCensus(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    route: {
      split: { x: Number(record.route.split.x), y: Number(record.route.split.y) },
      rejoin: { x: Number(record.route.rejoin.x), y: Number(record.route.rejoin.y) },
      wake: { x: Number(record.route.wake.x), y: Number(record.route.wake.y) }
    },
    radius: Number(record.radius),
    phase: Number(record.phase),
    turn: Number(record.turn)
  };
}

function censusFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.064 + (serial % 3) * 0.014,
    phase: 0.29 + serial * 0.37 + stage * 0.083,
    turn,
    route: {
      split: { x: Math.min(0.97, point.x + 0.17), y: clamp(point.y + turn * 0.12, 0.04, 0.96) },
      rejoin: { x: Math.min(0.99, point.x + 0.39), y: clamp(point.y - turn * 0.015, 0.04, 0.96) },
      wake: { x: Math.min(0.995, point.x + 0.58), y: clamp(point.y + turn * 0.006, 0.04, 0.96) }
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    pairedAgents: 0,
    rejoinedAgents: 0,
    wakeAgents: 0,
    wakeLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyCensus);
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
  let x = origin.x + Math.sin(stage * 0.21 + row * 0.23 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 7.3 + row * 0.35 + stage * 0.14 + phase) * (0.01 + u * 0.014);
  let splitOffset = 0;
  let routeSkew = 0;
  let wakeCompression = 0;
  let archiveWeight = 0;
  const influences = [];
  const pairInfluences = [];
  const rejoinInfluences = [];
  const wakeInfluences = [];

  memory.forEach((record, memoryIndex) => {
    const runway = Math.max(0.16, Math.min(0.62, 1 - record.point.x + 0.08));
    const progress = clamp((x - record.point.x + 0.045) / runway);
    const downstream = smoothstep(0, 1, progress);
    const deltaY = y - record.point.y;
    const bandRadius = record.radius + downstream * 0.048;
    const band = Math.exp(-(deltaY * deltaY) / (2 * bandRadius * bandRadius));
    const influence = downstream * band;
    const opening = smoothstep(0.035, 0.19, progress);
    const closing = 1 - smoothstep(0.58, 0.84, progress);
    const braidWindow = opening * closing;
    const rejoin = influence * smoothstep(0.42, 0.72, progress);
    const wake = influence * smoothstep(0.36, 0.78, progress);
    const pairSign = (row + Math.floor(record.phase * 5) + memoryIndex) % 2 === 0 ? 1 : -1;
    const fingerprint = Math.sin(row * 0.77 + phase * 0.19 + record.phase);
    const pairForce = pairSign * (0.82 + fingerprint * 0.18);
    const localSplit = influence * braidWindow;

    influences.push(influence);
    pairInfluences.push(localSplit);
    rejoinInfluences.push(rejoin);
    wakeInfluences.push(wake);
    if (influence <= 0.0001) return;

    archiveWeight += influence * (0.42 + memoryIndex * 0.08);
    splitOffset += pairForce * localSplit * (0.2 + memoryIndex * 0.016);
    routeSkew += record.turn * localSplit * (0.5 + fingerprint * 0.2);
    wakeCompression += wake * (0.72 + memoryIndex * 0.08);

    x += influence * record.turn * 0.055 * (0.64 + memoryIndex * 0.06);
    y += pairForce * localSplit * 0.2;
    y -= pairForce * rejoin * 0.16;
    y += Math.sin(column * 0.39 + record.phase) * localSplit * 0.026;
    if (wake > 0) {
      const collapse = clamp(wake * (0.56 + memoryIndex * 0.045), 0, 0.84);
      y = record.point.y + (y - record.point.y) * (1 - collapse);
      x += wake * record.turn * 0.018;
    }
  });

  x = clamp(x, 0.025, 0.975);
  y = clamp(y, 0.04, 0.96);
  const displacement = distance(origin, { x, y });
  const lane = clamp(v + splitOffset * 0.32, 0, 1);

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    splitOffset,
    routeSkew,
    wakeCompression,
    lane,
    archiveWeight: Math.min(1, archiveWeight),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.7 + random() * 1.55,
    phase,
    influences,
    pairInfluences,
    rejoinInfluences,
    wakeInfluences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => ({
    ...record,
    affectedAgents: agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06).length,
    pairedAgents: agents.filter((agent) => (agent.pairInfluences[index] ?? 0) > 0.035).length,
    rejoinedAgents: agents.filter((agent) => (agent.rejoinInfluences[index] ?? 0) > 0.035).length,
    wakeAgents: agents.filter((agent) => (agent.wakeInfluences[index] ?? 0) > 0.035).length,
    wakeLoad: agents.reduce((sum, agent) => sum + (agent.wakeInfluences[index] ?? 0), 0)
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
    route: {
      split: { ...record.route.split },
      rejoin: { ...record.route.rejoin },
      wake: { ...record.route.wake }
    },
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    pairedAgents: record.pairedAgents,
    rejoinedAgents: record.rejoinedAgents,
    wakeAgents: record.wakeAgents,
    wakeLoad: record.wakeLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const braidedAgents = agents.filter((agent) => Math.abs(agent.splitOffset) > 0.025);
  const rejoinedAgents = agents.filter((agent) => agent.rejoinInfluences.some((value) => value > 0.035));
  const wakeAgents = agents.filter((agent) => agent.wakeCompression > 0.035);

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      braidedAgents: braidedAgents.length,
      rejoinedAgents: rejoinedAgents.length,
      wakeAgents: wakeAgents.length,
      routeSeparation: agents.reduce((sum, agent) => sum + Math.abs(agent.splitOffset) * (1 + agent.archiveWeight), 0),
      wakeCompression: 1 + agents.reduce((sum, agent) => sum + agent.wakeCompression, 0) / AGENT_COUNT,
      wakeLoad: agents.reduce((sum, agent) => sum + agent.wakeCompression, 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const point = AUTO_CENSUSES[stage];
    if (point) memory = [...memory, censusFor(point, stage, 'autonomous-census', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyCensus(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const record = censusFor(bounded, frame.stage, 'visitor-census', frame.memory.length);
  const memory = [...frame.memory, record].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-census' };
}

export function deleteCensus(frame, index = frame.memory.length - 1) {
  if (index < 0 || index >= frame.memory.length) return { ...buildFrame(frame.stage, frame.memory), interaction: 'census-lifted' };
  const memory = frame.memory.filter((_, memoryIndex) => memoryIndex !== index);
  return { ...buildFrame(frame.stage, memory), interaction: 'census-lifted' };
}
