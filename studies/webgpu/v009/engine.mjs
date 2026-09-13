export const SEED = 0x57475039;
export const STAGES = 17;
export const AGENT_COUNT = 480;
export const MEMORY_LIMIT = 6;

const COLUMNS = 30;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_COUNTERCURRENTS = [
  null,
  { x: 0.16, y: 0.23 },
  null,
  { x: 0.31, y: 0.69 },
  null,
  { x: 0.45, y: 0.36 },
  null,
  { x: 0.58, y: 0.57 },
  null,
  { x: 0.69, y: 0.43 },
  null,
  { x: 0.78, y: 0.61 },
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

function copyCountercurrent(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    route: {
      entry: { x: Number(record.route.entry.x), y: Number(record.route.entry.y) },
      turn: { x: Number(record.route.turn.x), y: Number(record.route.turn.y) },
      exit: { x: Number(record.route.exit.x), y: Number(record.route.exit.y) }
    },
    radius: Number(record.radius),
    phase: Number(record.phase),
    turnSign: Number(record.turnSign)
  };
}

function countercurrentFor(point, stage, source, serial = 0) {
  const turnSign = (stage + serial) % 2 === 0 ? 1 : -1;
  const entryX = Math.min(0.96, point.x + 0.14);
  const turnX = Math.min(entryX - 0.025, Math.max(0.08, point.x + 0.07));
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.06 + (serial % 3) * 0.014,
    phase: 0.27 + serial * 0.39 + stage * 0.081,
    turnSign,
    route: {
      entry: { x: entryX, y: clamp(point.y + turnSign * 0.11, 0.04, 0.96) },
      turn: { x: turnX, y: clamp(point.y - turnSign * 0.03, 0.04, 0.96) },
      exit: { x: Math.min(0.995, point.x + 0.38), y: clamp(point.y + turnSign * 0.012, 0.04, 0.96) }
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    counterflowAgents: 0,
    reverseAgents: 0,
    rejoinedAgents: 0,
    returnLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyCountercurrent);
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
  let x = origin.x + Math.sin(stage * 0.17 + row * 0.23 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 7.3 + row * 0.35 + stage * 0.14 + phase) * (0.01 + u * 0.014);
  let currentOffset = 0;
  let reverseOffset = 0;
  let rejoinOffset = 0;
  let archiveWeight = 0;
  const influences = [];
  const counterflowInfluences = [];
  const reverseInfluences = [];
  const rejoinInfluences = [];

  memory.forEach((record, memoryIndex) => {
    const runway = Math.max(0.18, Math.min(0.64, 1 - record.point.x + 0.1));
    const progress = clamp((x - record.point.x + 0.05) / runway);
    const downstream = smoothstep(0, 1, progress);
    const deltaY = y - record.point.y;
    const bandRadius = record.radius + downstream * 0.052;
    const band = Math.exp(-(deltaY * deltaY) / (2 * bandRadius * bandRadius));
    const influence = downstream * band;
    const entryWindow = smoothstep(0.035, 0.2, progress);
    const reverseWindow = smoothstep(0.17, 0.35, progress) * (1 - smoothstep(0.52, 0.68, progress));
    const rejoinWindow = smoothstep(0.47, 0.69, progress) * (1 - smoothstep(0.92, 1, progress));
    const counterflow = influence * entryWindow;
    const reverse = influence * reverseWindow;
    const rejoin = influence * rejoinWindow;
    const pairSign = (row + Math.floor(record.phase * 5) + memoryIndex) % 2 === 0 ? 1 : -1;
    const fingerprint = Math.sin(row * 0.77 + phase * 0.19 + record.phase);
    const packetSign = pairSign * (0.82 + fingerprint * 0.18);

    influences.push(influence);
    counterflowInfluences.push(counterflow);
    reverseInfluences.push(reverse);
    rejoinInfluences.push(rejoin);
    if (influence <= 0.0001) return;

    archiveWeight += influence * (0.42 + memoryIndex * 0.085);
    currentOffset += packetSign * counterflow * (0.2 + memoryIndex * 0.014);
    reverseOffset += reverse;
    rejoinOffset += rejoin;

    y += packetSign * counterflow * 0.18;
    y -= packetSign * rejoin * 0.14;

    // The changed rule: a packet spends a measurable interval moving left
    // against the field, then receives a downstream push back into the mass.
    x -= reverse * (0.15 + memoryIndex * 0.018);
    x += rejoin * (0.095 + memoryIndex * 0.012);
    y += Math.sin(column * 0.39 + record.phase) * counterflow * 0.028;
    y += Math.sin(column * 0.31 + row * 0.18 + record.phase * 1.8) * reverse * 0.07;
    if (rejoin > 0) {
      const settle = clamp(rejoin * (0.48 + memoryIndex * 0.04), 0, 0.78);
      y = record.point.y + (y - record.point.y) * (1 - settle);
    }
  });

  x = clamp(x, 0.025, 0.975);
  y = clamp(y, 0.04, 0.96);
  const displacement = distance(origin, { x, y });
  const lane = clamp(v + currentOffset * 0.34, 0, 1);

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    currentOffset,
    reverseOffset,
    rejoinOffset,
    lane,
    archiveWeight: Math.min(1, archiveWeight),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.7 + random() * 1.55,
    phase,
    influences,
    counterflowInfluences,
    reverseInfluences,
    rejoinInfluences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => ({
    ...record,
    affectedAgents: agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06).length,
    counterflowAgents: agents.filter((agent) => (agent.counterflowInfluences[index] ?? 0) > 0.035).length,
    reverseAgents: agents.filter((agent) => (agent.reverseInfluences[index] ?? 0) > 0.035).length,
    rejoinedAgents: agents.filter((agent) => (agent.rejoinInfluences[index] ?? 0) > 0.035).length,
    returnLoad: agents.reduce((sum, agent) => sum + (agent.reverseInfluences[index] ?? 0), 0)
  }));
}

function archiveFor(memory) {
  return memory.map((record, index) => ({
    index,
    id: record.id,
    point: { ...record.point },
    radius: record.radius,
    phase: record.phase,
    turnSign: record.turnSign,
    route: {
      entry: { ...record.route.entry },
      turn: { ...record.route.turn },
      exit: { ...record.route.exit }
    },
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    counterflowAgents: record.counterflowAgents,
    reverseAgents: record.reverseAgents,
    rejoinedAgents: record.rejoinedAgents,
    returnLoad: record.returnLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const counterflowAgents = agents.filter((agent) => Math.abs(agent.currentOffset) > 0.025);
  const reverseAgents = agents.filter((agent) => agent.reverseInfluences.some((value) => value > 0.035));
  const rejoinedAgents = agents.filter((agent) => agent.rejoinInfluences.some((value) => value > 0.035));

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      counterflowAgents: counterflowAgents.length,
      reverseAgents: reverseAgents.length,
      rejoinedAgents: rejoinedAgents.length,
      routeSeparation: agents.reduce((sum, agent) => sum + Math.abs(agent.currentOffset) * (1 + agent.archiveWeight), 0),
      countercurrentStrength: agents.reduce((sum, agent) => sum + Math.abs(agent.reverseOffset) + Math.abs(agent.rejoinOffset) * 0.7, 0) / AGENT_COUNT,
      returnLoad: agents.reduce((sum, agent) => sum + agent.reverseOffset, 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const point = AUTO_COUNTERCURRENTS[stage];
    if (point) memory = [...memory, countercurrentFor(point, stage, 'autonomous-countercurrent', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyCountercurrent(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const record = countercurrentFor(bounded, frame.stage, 'visitor-countercurrent', frame.memory.length);
  const memory = [...frame.memory, record].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-countercurrent' };
}

export function deleteCountercurrent(frame, index = frame.memory.length - 1) {
  if (index < 0 || index >= frame.memory.length) return { ...buildFrame(frame.stage, frame.memory), interaction: 'countercurrent-lifted' };
  const memory = frame.memory.filter((_, memoryIndex) => memoryIndex !== index);
  return { ...buildFrame(frame.stage, memory), interaction: 'countercurrent-lifted' };
}
