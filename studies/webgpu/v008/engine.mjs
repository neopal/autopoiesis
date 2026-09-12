export const SEED = 0x57475038;
export const STAGES = 16;
export const AGENT_COUNT = 480;
export const MEMORY_LIMIT = 5;

const COLUMNS = 30;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_ECHOS = [
  null,
  { x: 0.17, y: 0.24 },
  null,
  { x: 0.32, y: 0.7 },
  null,
  { x: 0.47, y: 0.36 },
  null,
  { x: 0.6, y: 0.57 },
  null,
  { x: 0.73, y: 0.43 },
  null,
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

function copyEcho(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    route: {
      split: { x: Number(record.route.split.x), y: Number(record.route.split.y) },
      relay: { x: Number(record.route.relay.x), y: Number(record.route.relay.y) },
      echo: { x: Number(record.route.echo.x), y: Number(record.route.echo.y) }
    },
    radius: Number(record.radius),
    phase: Number(record.phase),
    turn: Number(record.turn)
  };
}

function echoFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.062 + (serial % 3) * 0.013,
    phase: 0.31 + serial * 0.43 + stage * 0.079,
    turn,
    route: {
      split: { x: Math.min(0.97, point.x + 0.16), y: clamp(point.y + turn * 0.12, 0.04, 0.96) },
      relay: { x: Math.min(0.99, point.x + 0.34), y: clamp(point.y - turn * 0.018, 0.04, 0.96) },
      echo: { x: Math.min(0.995, point.x + 0.57), y: clamp(point.y + turn * 0.008, 0.04, 0.96) }
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    relayAgents: 0,
    laggedAgents: 0,
    echoAgents: 0,
    echoLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyEcho);
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
  let x = origin.x + Math.sin(stage * 0.19 + row * 0.23 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 7.3 + row * 0.35 + stage * 0.14 + phase) * (0.01 + u * 0.014);
  let splitOffset = 0;
  let relayOffset = 0;
  let echoOffset = 0;
  let archiveWeight = 0;
  const influences = [];
  const relayInfluences = [];
  const lagInfluences = [];
  const echoInfluences = [];

  memory.forEach((record, memoryIndex) => {
    const runway = Math.max(0.17, Math.min(0.62, 1 - record.point.x + 0.12));
    const progress = clamp((x - record.point.x + 0.045) / runway);
    const downstream = smoothstep(0, 1, progress);
    const deltaY = y - record.point.y;
    const bandRadius = record.radius + downstream * 0.045;
    const band = Math.exp(-(deltaY * deltaY) / (2 * bandRadius * bandRadius));
    const influence = downstream * band;
    const opening = smoothstep(0.03, 0.18, progress);
    const relayWindow = opening * (1 - smoothstep(0.42, 0.63, progress));
    const lagWindow = smoothstep(0.34, 0.55, progress) * (1 - smoothstep(0.79, 0.94, progress));
    const echoWindow = smoothstep(0.51, 0.7, progress) * (1 - smoothstep(0.86, 1.0, progress));
    const pairSign = (row + Math.floor(record.phase * 5) + memoryIndex) % 2 === 0 ? 1 : -1;
    const fingerprint = Math.sin(row * 0.77 + phase * 0.19 + record.phase);
    const relaySign = (column + row + memoryIndex) % 2 === 0 ? 1 : -1;
    const localRelay = influence * relayWindow;
    const lag = influence * lagWindow;
    const echo = influence * echoWindow;

    influences.push(influence);
    relayInfluences.push(localRelay);
    lagInfluences.push(lag);
    echoInfluences.push(echo);
    if (influence <= 0.0001) return;

    archiveWeight += influence * (0.4 + memoryIndex * 0.09);
    splitOffset += pairSign * localRelay * (0.19 + memoryIndex * 0.014);
    relayOffset += relaySign * localRelay * (0.2 + fingerprint * 0.04);
    echoOffset += pairSign * echo * (0.52 + memoryIndex * 0.06);

    x += influence * record.turn * 0.043 * (0.62 + memoryIndex * 0.055);
    y += pairSign * localRelay * 0.18;
    y -= pairSign * lag * 0.145;
    y += relaySign * localRelay * 0.048;
    y += Math.sin(column * 0.39 + record.phase) * localRelay * 0.024;
    y += Math.sin(column * 0.33 + row * 0.18 + record.phase * 1.7) * echo * 0.052;
    y += pairSign * echo * 0.065;
    if (echo > 0) {
      x += echo * record.turn * 0.022;
      y += Math.sin(stage * 0.28 + column * 0.21 + record.phase) * echo * 0.035;
    }
  });

  x = clamp(x, 0.025, 0.975);
  y = clamp(y, 0.04, 0.96);
  const displacement = distance(origin, { x, y });
  const lane = clamp(v + splitOffset * 0.34, 0, 1);

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    splitOffset,
    relayOffset,
    echoOffset,
    lane,
    archiveWeight: Math.min(1, archiveWeight),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.7 + random() * 1.55,
    phase,
    influences,
    relayInfluences,
    lagInfluences,
    echoInfluences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => ({
    ...record,
    affectedAgents: agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06).length,
    relayAgents: agents.filter((agent) => (agent.relayInfluences[index] ?? 0) > 0.035).length,
    laggedAgents: agents.filter((agent) => (agent.lagInfluences[index] ?? 0) > 0.035).length,
    echoAgents: agents.filter((agent) => (agent.echoInfluences[index] ?? 0) > 0.035).length,
    echoLoad: agents.reduce((sum, agent) => sum + (agent.echoInfluences[index] ?? 0), 0)
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
      relay: { ...record.route.relay },
      echo: { ...record.route.echo }
    },
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    relayAgents: record.relayAgents,
    laggedAgents: record.laggedAgents,
    echoAgents: record.echoAgents,
    echoLoad: record.echoLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const relayAgents = agents.filter((agent) => Math.abs(agent.relayOffset) > 0.025);
  const laggedAgents = agents.filter((agent) => agent.lagInfluences.some((value) => value > 0.035));
  const echoAgents = agents.filter((agent) => Math.abs(agent.echoOffset) > 0.025);

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      relayAgents: relayAgents.length,
      laggedAgents: laggedAgents.length,
      echoAgents: echoAgents.length,
      routeSeparation: agents.reduce((sum, agent) => sum + Math.abs(agent.splitOffset) * (1 + agent.archiveWeight), 0),
      echoStrength: agents.reduce((sum, agent) => sum + Math.abs(agent.echoOffset), 0) / AGENT_COUNT,
      echoLoad: agents.reduce((sum, agent) => sum + agent.echoOffset * agent.echoOffset, 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const point = AUTO_ECHOS[stage];
    if (point) memory = [...memory, echoFor(point, stage, 'autonomous-echo', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyEcho(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const record = echoFor(bounded, frame.stage, 'visitor-echo', frame.memory.length);
  const memory = [...frame.memory, record].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-echo' };
}

export function deleteEcho(frame, index = frame.memory.length - 1) {
  if (index < 0 || index >= frame.memory.length) return { ...buildFrame(frame.stage, frame.memory), interaction: 'echo-lifted' };
  const memory = frame.memory.filter((_, memoryIndex) => memoryIndex !== index);
  return { ...buildFrame(frame.stage, memory), interaction: 'echo-lifted' };
}
