export const SEED = 0x57475034;
export const STAGES = 12;
export const AGENT_COUNT = 432;
export const MEMORY_LIMIT = 4;

const COLUMNS = 24;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_REHEARSALS = [
  null,
  { x: 0.22, y: 0.36 },
  null,
  { x: 0.39, y: 0.61 },
  null,
  { x: 0.54, y: 0.42 },
  null,
  { x: 0.68, y: 0.56 },
  null,
  { x: 0.78, y: 0.31 },
  null,
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

function copyRehearsal(rehearsal) {
  return {
    ...rehearsal,
    point: { x: Number(rehearsal.point.x), y: Number(rehearsal.point.y) },
    phase: Number(rehearsal.phase),
    radius: Number(rehearsal.radius),
    gesture: Number(rehearsal.gesture)
  };
}

function rehearsalFor(point, stage, source, serial = 0) {
  const direction = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.07 + (serial % 3) * 0.012,
    phase: 0.52 + serial * 0.31 + stage * 0.071,
    gesture: direction * (0.7 + (stage % 3) * 0.16),
    sourceStage: stage,
    source,
    echoAgents: 0,
    cohesion: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyRehearsal);
}

function buildAgent(index, stage, memory) {
  const random = rng(SEED + index * 977 + stage * 7919);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const u = column / (COLUMNS - 1);
  const v = row / (ROWS - 1);
  const phase = random() * Math.PI * 2;
  const origin = {
    x: 0.065 + u * 0.87 + (random() - 0.5) * 0.012,
    y: 0.12 + v * 0.76 + (random() - 0.5) * 0.014
  };
  let x = origin.x + Math.sin(stage * 0.27 + row * 0.19 + phase) * 0.009;
  let y = origin.y + Math.sin(u * 8.1 + row * 0.23 + stage * 0.17 + phase) * (0.012 + u * 0.011);
  let rehearsalWeight = 0;
  let echoPhase = 0;
  let echoCompression = 0;
  const influences = [];

  memory.forEach((rehearsal, memoryIndex) => {
    const downstream = clamp((x - rehearsal.point.x + 0.075) / 0.36);
    const entryDistance = y - rehearsal.point.y;
    const entryRadius = rehearsal.radius + downstream * 0.045;
    const entryProximity = Math.exp(-(entryDistance * entryDistance) / (2 * entryRadius * entryRadius));
    const entryInfluence = downstream * entryProximity;

    const echoX = rehearsal.point.x + 0.02 + (memoryIndex % 2) * 0.01;
    const echoY = rehearsal.point.y + rehearsal.gesture * 0.095;
    const echoDistance = y - echoY;
    const echoRadius = 0.055 + rehearsal.radius * 0.34 + (memoryIndex % 2) * 0.01;
    const echoProximity = Math.exp(-(echoDistance * echoDistance) / (2 * echoRadius * echoRadius));
    const echoInfluence = clamp((x - echoX + 0.04) / 0.34) * echoProximity;
    const fingerprint = Math.sin(row * 0.91 + rehearsal.phase + phase * 0.18);

    influences.push(echoInfluence);
    if (entryInfluence > 0.0001) {
      x += Math.sin(stage * 0.39 + row * 0.13 + rehearsal.phase) * entryInfluence * 0.012;
      y += rehearsal.gesture * entryInfluence * 0.018;
    }
    if (echoInfluence > 0.0001) {
      const compression = echoInfluence * (0.56 + memoryIndex * 0.055);
      const replay = fingerprint * (0.72 + 0.1 * Math.cos(rehearsal.phase));
      rehearsalWeight += compression;
      echoPhase += replay * echoInfluence;
      echoCompression += compression;
      // The archive is a copied neighbor rhythm: rows converge, then inherit the old turn.
      x += echoInfluence * (0.068 * replay + rehearsal.gesture * 0.02);
      y += echoInfluence * (1.0 * replay - echoDistance * 3.0);
    }
  });

  x = clamp(x, 0.025, 0.975);
  y = clamp(y, 0.055, 0.945);
  const displacement = distance(origin, { x, y });
  const slot = clamp(v + echoPhase * 0.22, 0, 1);

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    rehearsalWeight,
    echoPhase,
    echoCompression,
    slot,
    archiveWeight: Math.min(1, influences.reduce((sum, value) => sum + value, 0)),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.8 + random() * 1.5,
    phase,
    influences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((rehearsal, index) => {
    const echoAgents = agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06);
    const cohesion = echoAgents.length
      ? echoAgents.reduce((sum, agent) => sum + Math.min(1, agent.rehearsalWeight), 0) / echoAgents.length
      : 0;
    return {
      ...rehearsal,
      echoAgents: echoAgents.length,
      cohesion
    };
  });
}

function archiveFor(memory) {
  return memory.map((rehearsal, index) => ({
    index,
    id: rehearsal.id,
    point: { ...rehearsal.point },
    radius: rehearsal.radius,
    phase: rehearsal.phase,
    gesture: rehearsal.gesture,
    source: rehearsal.source,
    sourceStage: rehearsal.sourceStage,
    echoAgents: rehearsal.echoAgents,
    cohesion: rehearsal.cohesion
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const echoAgents = agents.filter((agent) => agent.rehearsalWeight > 0.06).length;
  const echoPopulation = agents.filter((agent) => agent.rehearsalWeight > 0.06);
  const rehearsalCohesion = echoPopulation.length
    ? echoPopulation.reduce((sum, agent) => sum + Math.min(1, agent.rehearsalWeight), 0) / echoPopulation.length
    : 0;

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      echoAgents,
      rehearsalCohesion,
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const autoPoint = AUTO_REHEARSALS[stage];
    if (autoPoint) memory = [...memory, rehearsalFor(autoPoint, stage, 'autonomous-rehearsal', stage)].slice(-MEMORY_LIMIT);
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
  const rehearsal = rehearsalFor(bounded, frame.stage, 'visitor-rehearsal', frame.memory.length);
  const memory = [...frame.memory, rehearsal].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-rehearsal' };
}

export function deleteCapture(frame, captureIndex = frame.memory.length - 1) {
  if (captureIndex < 0 || captureIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== captureIndex);
  return { ...buildFrame(frame.stage, memory), interaction: 'rehearsal-lifted' };
}
