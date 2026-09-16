export const SEED = 0x5747503b;
export const STAGES = 19;
export const AGENT_COUNT = 480;
export const MEMORY_LIMIT = 8;

const COLUMNS = 30;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_DELAYS = [
  null,
  { x: 0.13, y: 0.66 },
  null,
  { x: 0.25, y: 0.28 },
  null,
  { x: 0.38, y: 0.57 },
  null,
  { x: 0.5, y: 0.34 },
  null,
  { x: 0.61, y: 0.69 },
  null,
  { x: 0.7, y: 0.43 },
  null,
  { x: 0.79, y: 0.6 },
  null,
  { x: 0.86, y: 0.3 },
  null,
  { x: 0.68, y: 0.72 },
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

function copyDelay(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    route: {
      entry: { x: Number(record.route.entry.x), y: Number(record.route.entry.y) },
      hold: { x: Number(record.route.hold.x), y: Number(record.route.hold.y) },
      release: { x: Number(record.route.release.x), y: Number(record.route.release.y) },
      echo: { x: Number(record.route.echo.x), y: Number(record.route.echo.y) }
    },
    radius: Number(record.radius),
    phase: Number(record.phase),
    turn: Number(record.turn),
    delay: Number(record.delay)
  };
}

function delayFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  const holdX = Math.min(0.94, point.x + 0.16);
  const releaseX = Math.min(0.97, point.x + 0.36);
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.05 + (serial % 3) * 0.014,
    phase: 0.23 + serial * 0.39 + stage * 0.071,
    turn,
    delay: 0.12 + (serial % 4) * 0.012,
    route: {
      entry: { x: Math.min(0.92, point.x + 0.045), y: clamp(point.y + turn * 0.055, 0.04, 0.96) },
      hold: { x: holdX, y: clamp(point.y - turn * 0.12, 0.04, 0.96) },
      release: { x: releaseX, y: clamp(point.y + turn * 0.16, 0.04, 0.96) },
      echo: { x: Math.min(0.995, point.x + 0.61), y: clamp(point.y - turn * 0.045, 0.04, 0.96) }
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    heldAgents: 0,
    releasedAgents: 0,
    deferredAgents: 0,
    holdLoad: 0,
    releaseLoad: 0,
    echoLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyDelay);
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
  let x = origin.x + Math.sin(stage * 0.16 + row * 0.21 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 7.1 + row * 0.33 + stage * 0.12 + phase) * (0.01 + u * 0.014);
  let arrivalLag = 0;
  let holdOffset = 0;
  let releaseOffset = 0;
  let echoOffset = 0;
  let archiveWeight = 0;
  const influences = [];
  const holdInfluences = [];
  const releaseInfluences = [];
  const echoInfluences = [];

  memory.forEach((record, memoryIndex) => {
    const runway = Math.max(0.2, Math.min(0.7, 1 - record.point.x + 0.12));
    const progress = clamp((x - record.point.x + 0.045) / runway);
    const downstream = smoothstep(0, 1, progress);
    const deltaY = y - record.point.y;
    const bandRadius = record.radius + downstream * 0.045;
    const band = Math.exp(-(deltaY * deltaY) / (2 * bandRadius * bandRadius));
    const influence = downstream * band;
    const entryWindow = smoothstep(0.02, 0.14, progress) * (1 - smoothstep(0.82, 0.98, progress));
    const holdWindow = smoothstep(0.14, 0.27, progress) * (1 - smoothstep(0.37, 0.49, progress));
    const releaseWindow = smoothstep(0.36, 0.5, progress) * (1 - smoothstep(0.57, 0.71, progress));
    const echoWindow = smoothstep(0.56, 0.7, progress) * (1 - smoothstep(0.82, 0.98, progress));
    const entry = influence * entryWindow;
    const hold = influence * holdWindow;
    const release = influence * releaseWindow;
    const echo = influence * echoWindow;
    const laneSign = (row + Math.floor(record.phase * 7) + memoryIndex) % 2 === 0 ? 1 : -1;
    const fingerprint = Math.sin(row * 0.73 + phase * 0.2 + record.phase);

    influences.push(influence);
    holdInfluences.push(hold);
    releaseInfluences.push(release);
    echoInfluences.push(echo);
    if (influence <= 0.0001) return;

    archiveWeight += influence * (0.38 + memoryIndex * 0.08);
    holdOffset += laneSign * hold * (0.11 + memoryIndex * 0.01);
    releaseOffset += laneSign * release * (0.18 + memoryIndex * 0.013);
    echoOffset += fingerprint * echo * 0.18;
    arrivalLag += hold * 0.2 - release * 0.1 - echo * 0.06;

    // Changed rule: a remembered absence holds a cohort in a finite pocket,
    // releases it downstream, and leaves a staggered echo instead of a lane swap.
    x += entry * 0.012;
    x -= hold * (0.13 + memoryIndex * 0.01);
    x += release * (0.18 + memoryIndex * 0.012);
    x += echo * (0.12 + memoryIndex * 0.008);
    y += laneSign * entry * 0.045;
    y += laneSign * hold * 0.14;
    y += laneSign * release * 0.19;
    y += fingerprint * echo * 0.1;
    if (release > 0) {
      const releaseBias = clamp(release * (0.14 + memoryIndex * 0.025), 0, 0.42);
      y = record.point.y + (y - record.point.y) * (1 - releaseBias);
    }
  });

  x = clamp(x, 0.025, 0.985);
  y = clamp(y, 0.04, 0.96);
  const displacement = distance(origin, { x, y });
  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    arrivalLag,
    holdOffset,
    releaseOffset,
    echoOffset,
    lane: clamp(v + (releaseOffset + echoOffset) * 0.4, 0, 1),
    archiveWeight: Math.min(1, archiveWeight),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.7 + random() * 1.55,
    phase,
    influences,
    holdInfluences,
    releaseInfluences,
    echoInfluences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => ({
    ...record,
    affectedAgents: agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06).length,
    heldAgents: agents.filter((agent) => (agent.holdInfluences[index] ?? 0) > 0.035).length,
    releasedAgents: agents.filter((agent) => (agent.releaseInfluences[index] ?? 0) > 0.035).length,
    deferredAgents: agents.filter((agent) => Math.abs(agent.arrivalLag) > 0.025 && (agent.echoInfluences[index] ?? 0) > 0.02).length,
    holdLoad: agents.reduce((sum, agent) => sum + (agent.holdInfluences[index] ?? 0), 0),
    releaseLoad: agents.reduce((sum, agent) => sum + (agent.releaseInfluences[index] ?? 0), 0),
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
    delay: record.delay,
    route: {
      entry: { ...record.route.entry },
      hold: { ...record.route.hold },
      release: { ...record.route.release },
      echo: { ...record.route.echo }
    },
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    heldAgents: record.heldAgents,
    releasedAgents: record.releasedAgents,
    deferredAgents: record.deferredAgents,
    holdLoad: record.holdLoad,
    releaseLoad: record.releaseLoad,
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
  const heldAgents = agents.filter((agent) => agent.holdInfluences.some((value) => value > 0.035));
  const releasedAgents = agents.filter((agent) => agent.releaseInfluences.some((value) => value > 0.035));
  const deferredAgents = agents.filter((agent) => Math.abs(agent.arrivalLag) > 0.025);

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      heldAgents: heldAgents.length,
      releasedAgents: releasedAgents.length,
      deferredAgents: deferredAgents.length,
      routeSeparation: agents.reduce((sum, agent) => sum + Math.abs(agent.holdOffset) + Math.abs(agent.releaseOffset), 0),
      delayStrength: agents.reduce((sum, agent) => sum + Math.abs(agent.arrivalLag) + Math.abs(agent.echoOffset) * 0.6 + Math.abs(agent.holdOffset) * 0.8 + Math.abs(agent.releaseOffset) * 0.6, 0) / AGENT_COUNT,
      holdLoad: agents.reduce((sum, agent) => sum + Math.abs(agent.holdOffset), 0),
      releaseLoad: agents.reduce((sum, agent) => sum + Math.abs(agent.releaseOffset), 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const point = AUTO_DELAYS[stage];
    if (point) memory = [...memory, delayFor(point, stage, 'autonomous-delay', stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyDelay(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.08, 0.92)
  };
  const record = delayFor(bounded, frame.stage, 'visitor-delay', frame.memory.length);
  const memory = [...frame.memory, record].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-delay' };
}

export function deleteDelay(frame, index = frame.memory.length - 1) {
  if (index < 0 || index >= frame.memory.length) return { ...buildFrame(frame.stage, frame.memory), interaction: 'delay-lifted' };
  const memory = frame.memory.filter((_, memoryIndex) => memoryIndex !== index);
  return { ...buildFrame(frame.stage, memory), interaction: 'delay-lifted' };
}
