export const SEED = 0x57475033;
export const STAGES = 11;
export const AGENT_COUNT = 432;
export const MEMORY_LIMIT = 4;

const COLUMNS = 24;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_VACANCIES = [
  null,
  { x: 0.25, y: 0.35 },
  null,
  { x: 0.42, y: 0.64 },
  null,
  { x: 0.58, y: 0.39 },
  null,
  { x: 0.74, y: 0.45 },
  null,
  { x: 0.84, y: 0.31 },
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

function copyVacancy(vacancy) {
  return {
    ...vacancy,
    point: { x: Number(vacancy.point.x), y: Number(vacancy.point.y) },
    phase: Number(vacancy.phase),
    radius: Number(vacancy.radius),
    weave: { x: Number(vacancy.weave.x), y: Number(vacancy.weave.y) }
  };
}

function vacancyFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.082 + (serial % 3) * 0.015,
    phase: (0.48 + serial * 0.23 + stage * 0.065) * turn,
    weave: {
      x: turn * (0.026 + (serial % 2) * 0.014),
      y: (point.y < 0.5 ? 1 : -1) * (0.045 + (stage % 3) * 0.012)
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    orderLoad: 0
  };
}

function normalizeVacancies(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyVacancy);
}

function buildAgent(index, stage, memory) {
  const random = rng(SEED + index * 977 + stage * 7919);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const u = column / (COLUMNS - 1);
  const v = row / (ROWS - 1);
  const phase = random() * Math.PI * 2;
  const origin = {
    x: 0.075 + u * 0.85 + (random() - 0.5) * 0.012,
    y: 0.13 + v * 0.74 + (random() - 0.5) * 0.014
  };
  let x = origin.x + Math.sin(stage * 0.31 + row * 0.22 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 8.2 + row * 0.27 + stage * 0.2 + phase) * (0.013 + u * 0.01);
  let queueDebt = 0;
  let orderShift = 0;
  const influences = [];

  for (const vacancy of memory) {
    const downstream = clamp((x - vacancy.point.x + 0.1) / 0.3);
    const deltaY = y - vacancy.point.y;
    const radius = vacancy.radius + downstream * 0.052;
    const proximity = Math.exp(-(deltaY * deltaY) / (2 * radius * radius));
    const influence = downstream * proximity;
    influences.push(influence);
    if (influence <= 0.0001) continue;

    const lane = deltaY >= 0 ? 1 : -1;
    const queue = influence * (0.19 + memory.indexOf(vacancy) * 0.03);
    const beat = stage * 0.37 + row * 0.16 + phase + vacancy.phase;
    const pocket = Math.sin(beat) * queue * 0.09;
    queueDebt += queue;
    orderShift += lane * queue * (0.82 + Math.sin(beat * 0.7) * 0.12);
    x += pocket + vacancy.weave.x * influence * 0.85;
    y += lane * queue * 1.25 + vacancy.weave.y * influence * 0.85;
  }

  x = clamp(x, 0.03, 0.97);
  y = clamp(y, 0.06, 0.94);
  const displacement = distance(origin, { x, y });
  const slot = clamp(v + orderShift * 0.58, 0, 1);

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    queueDebt,
    orderShift,
    slot,
    archiveWeight: Math.min(1, influences.reduce((sum, value) => sum + value, 0)),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.8 + random() * 1.5,
    phase,
    influences
  };
}

function resolveVacancies(memory, agents) {
  return memory.map((vacancy, index) => {
    const affected = agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06);
    return {
      ...vacancy,
      affectedAgents: affected.length,
      orderLoad: affected.reduce((sum, agent) => sum + Math.abs(agent.orderShift), 0)
    };
  });
}

function archiveFor(memory) {
  return memory.map((vacancy, index) => ({
    index,
    id: vacancy.id,
    point: { ...vacancy.point },
    radius: vacancy.radius,
    phase: vacancy.phase,
    source: vacancy.source,
    sourceStage: vacancy.sourceStage,
    affectedAgents: vacancy.affectedAgents,
    orderLoad: vacancy.orderLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeVacancies(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveVacancies(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const orderShear = agents.reduce((sum, agent) => sum + Math.abs(agent.orderShift) * (1 + agent.archiveWeight), 0);

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      queuedAgents: agents.filter((agent) => agent.queueDebt > 0.04).length,
      orderShear,
      vacancyLoad: agents.reduce((sum, agent) => sum + agent.queueDebt, 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const autoPoint = AUTO_VACANCIES[stage];
    if (autoPoint) memory = [...memory, vacancyFor(autoPoint, stage, 'autonomous-vacancy', stage)].slice(-MEMORY_LIMIT);
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
  const vacancy = vacancyFor(bounded, frame.stage, 'visitor-vacancy', frame.memory.length);
  const memory = [...frame.memory, vacancy].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-vacancy' };
}

export function deleteCapture(frame, captureIndex = frame.memory.length - 1) {
  if (captureIndex < 0 || captureIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== captureIndex);
  return { ...buildFrame(frame.stage, memory), interaction: 'vacancy-lifted' };
}
