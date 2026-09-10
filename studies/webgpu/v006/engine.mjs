export const SEED = 0x57475036;
export const STAGES = 14;
export const AGENT_COUNT = 480;
export const MEMORY_LIMIT = 5;

const COLUMNS = 30;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_DETOURS = [
  null,
  { x: 0.18, y: 0.24 },
  null,
  { x: 0.36, y: 0.67 },
  null,
  { x: 0.51, y: 0.35 },
  null,
  { x: 0.66, y: 0.58 },
  null,
  { x: 0.70, y: 0.49 },
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

function copyDetour(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    route: {
      split: { x: Number(record.route.split.x), y: Number(record.route.split.y) },
      rejoin: { x: Number(record.route.rejoin.x), y: Number(record.route.rejoin.y) }
    },
    radius: Number(record.radius),
    phase: Number(record.phase),
    turn: Number(record.turn)
  };
}

function detourFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.068 + (serial % 3) * 0.015,
    phase: 0.33 + serial * 0.41 + stage * 0.071,
    turn,
    route: {
      split: { x: Math.min(0.97, point.x + 0.18), y: clamp(point.y + turn * 0.12, 0.04, 0.96) },
      rejoin: { x: Math.min(0.995, point.x + 0.5), y: clamp(point.y - turn * 0.025, 0.04, 0.96) }
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    pairedAgents: 0,
    rejoinLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyDetour);
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
  let rejoinLoad = 0;
  let archiveWeight = 0;
  const influences = [];
  const detourSeparation = [];
  const rejoinInfluences = [];

  memory.forEach((record, memoryIndex) => {
    const progress = clamp((x - record.point.x + 0.045) / 0.62);
    const downstream = smoothstep(0, 1, progress);
    const deltaY = y - record.point.y;
    const bandRadius = record.radius + downstream * 0.052;
    const band = Math.exp(-(deltaY * deltaY) / (2 * bandRadius * bandRadius));
    const influence = downstream * band;
    const opening = smoothstep(0.04, 0.2, progress);
    const closing = 1 - smoothstep(0.63, 0.98, progress);
    const braidWindow = opening * closing;
    const pairSign = (row + Math.floor(record.phase * 5) + memoryIndex) % 2 === 0 ? 1 : -1;
    const fingerprint = Math.sin(row * 0.77 + phase * 0.19 + record.phase);
    const pairForce = pairSign * (0.82 + fingerprint * 0.18);
    const localSeparation = influence * braidWindow;
    const localRejoin = influence * smoothstep(0.56, 0.98, progress);

    influences.push(influence);
    detourSeparation.push(localSeparation);
    rejoinInfluences.push(localRejoin);
    if (influence <= 0.0001) return;

    archiveWeight += influence * (0.42 + memoryIndex * 0.08);
    splitOffset += pairForce * localSeparation * (0.16 + memoryIndex * 0.012);
    routeSkew += record.turn * localSeparation * (0.52 + fingerprint * 0.2);
    rejoinLoad += localRejoin;

    x += influence * record.turn * 0.048 * (0.65 + memoryIndex * 0.07);
    y += pairForce * localSeparation * 0.16;
    y -= pairForce * localRejoin * 0.13;
    y += Math.sin(column * 0.39 + record.phase) * localSeparation * 0.027;
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
    rejoinLoad,
    archiveWeight: Math.min(1, archiveWeight),
    lane,
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.7 + random() * 1.55,
    phase,
    influences,
    detourSeparation,
    rejoinInfluences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => {
    const affected = agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06);
    const paired = agents.filter((agent) => (agent.detourSeparation[index] ?? 0) > 0.035);
    return {
      ...record,
      affectedAgents: affected.length,
      pairedAgents: paired.length,
      rejoinLoad: agents.reduce((sum, agent) => sum + (agent.rejoinInfluences[index] ?? 0), 0)
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
    route: {
      split: { ...record.route.split },
      rejoin: { ...record.route.rejoin }
    },
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    pairedAgents: record.pairedAgents,
    rejoinLoad: record.rejoinLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const pairedAgents = agents.filter((agent) => Math.abs(agent.splitOffset) > 0.025);
  const rejoinedAgents = agents.filter((agent) => agent.rejoinLoad > 0.035);
  const routeSeparation = agents.reduce((sum, agent) => sum + Math.abs(agent.splitOffset) * (1 + agent.archiveWeight), 0);

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      braidedAgents: pairedAgents.length,
      rejoinedAgents: rejoinedAgents.length,
      routeSeparation,
      rejoinLoad: agents.reduce((sum, agent) => sum + agent.rejoinLoad, 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const autoPoint = AUTO_DETOURS[stage];
    if (autoPoint) memory = [...memory, detourFor(autoPoint, stage, 'autonomous-detour', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyDetour(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const record = detourFor(bounded, frame.stage, 'visitor-detour', frame.memory.length);
  const memory = [...frame.memory, record].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-detour' };
}

export function deleteDetour(frame, index = frame.memory.length - 1) {
  if (index < 0 || index >= frame.memory.length) return { ...buildFrame(frame.stage, frame.memory), interaction: 'detour-lifted' };
  const memory = frame.memory.filter((_, memoryIndex) => memoryIndex !== index);
  return { ...buildFrame(frame.stage, memory), interaction: 'detour-lifted' };
}
