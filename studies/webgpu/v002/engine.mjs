export const SEED = 0x57475032;
export const STAGES = 10;
export const AGENT_COUNT = 432;
export const MEMORY_LIMIT = 4;

const COLUMNS = 24;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_DEBTS = [
  null,
  { x: 0.27, y: 0.35 },
  null,
  { x: 0.43, y: 0.63 },
  null,
  { x: 0.59, y: 0.39 },
  null,
  { x: 0.75, y: 0.58 },
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

function copyCapture(capture) {
  return {
    ...capture,
    point: { x: Number(capture.point.x), y: Number(capture.point.y) },
    phase: Number(capture.phase),
    radius: Number(capture.radius),
    bend: { x: Number(capture.bend.x), y: Number(capture.bend.y) }
  };
}

function captureFor(point, stage, source, serial = 0) {
  const turn = (stage + serial) % 2 === 0 ? 1 : -1;
  return {
    id: `${source}-${stage}-${serial}`,
    point: { x: point.x, y: point.y },
    radius: 0.09 + (serial % 3) * 0.016,
    phase: (0.42 + serial * 0.19 + stage * 0.07) * turn,
    bend: {
      x: turn * (0.032 + (serial % 2) * 0.012),
      y: (point.y < 0.5 ? 1 : -1) * (0.052 + (stage % 3) * 0.009)
    },
    sourceStage: stage,
    source,
    affectedAgents: 0,
    debt: 0
  };
}

function normalizeDebts(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyCapture);
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
  let x = origin.x + Math.sin(stage * 0.35 + row * 0.22 + phase) * 0.008;
  let y = origin.y + Math.sin(u * 8.2 + row * 0.27 + stage * 0.2 + phase) * (0.013 + u * 0.01);
  let latencyDebt = 0;
  const influences = [];

  for (const debt of memory) {
    // A capture at the edge still catches the last bodies in the lane;
    // the small lead is the width of the crossing rather than free drift.
    const downstream = clamp((x - debt.point.x + 0.055) / 0.34);
    const deltaY = y - debt.point.y;
    const radius = debt.radius + downstream * 0.055;
    const proximity = Math.exp(-(deltaY * deltaY) / (2 * radius * radius));
    const influence = downstream * proximity;
    influences.push(influence);
    if (influence <= 0.0001) continue;

    const side = deltaY >= 0 ? 1 : -1;
    latencyDebt += influence * (0.15 + memory.indexOf(debt) * 0.025);
    const delayedBeat = stage * 0.38 + row * 0.13 + phase - latencyDebt * 5.1 + debt.phase;
    const arrivalOffset = Math.sin(delayedBeat) * 0.018 + latencyDebt * (side * 0.18 + 0.13);
    x += arrivalOffset * 0.13 + debt.bend.x * influence * 0.35;
    y += arrivalOffset * 0.52 + debt.bend.y * influence * 0.36;
  }

  x = clamp(x, 0.03, 0.97);
  y = clamp(y, 0.06, 0.94);
  const displacement = distance(origin, { x, y });
  const arrival = clamp(v + latencyDebt * 0.55, 0, 1);
  const arrivalShift = arrival - v;

  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement,
    latencyDebt,
    arrival,
    arrivalShift,
    archiveWeight: Math.min(1, influences.reduce((sum, value) => sum + value, 0)),
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    size: 0.8 + random() * 1.5,
    phase,
    influences
  };
}

function resolveDebts(memory, agents) {
  return memory.map((debt, index) => {
    const affected = agents.filter((agent) => (agent.influences[index] ?? 0) > 0.06);
    return {
      ...debt,
      affectedAgents: affected.length,
      debt: affected.reduce((sum, agent) => sum + agent.latencyDebt, 0)
    };
  });
}

function archiveFor(memory) {
  return memory.map((debt, index) => ({
    index,
    id: debt.id,
    point: { ...debt.point },
    radius: debt.radius,
    phase: debt.phase,
    source: debt.source,
    sourceStage: debt.sourceStage,
    affectedAgents: debt.affectedAgents,
    debt: debt.debt
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeDebts(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveDebts(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const arrivalShear = agents.reduce((sum, agent) => sum + Math.abs(agent.arrivalShift) * (1 + agent.archiveWeight), 0);

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      archivedAgents: agents.filter((agent) => agent.archiveWeight > 0.08).length,
      delayedAgents: agents.filter((agent) => agent.latencyDebt > 0.04).length,
      arrivalShear,
      debtLoad: agents.reduce((sum, agent) => sum + agent.latencyDebt, 0),
      density: agents.length / AGENT_COUNT
    }
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    const autoPoint = AUTO_DEBTS[stage];
    if (autoPoint) memory = [...memory, captureFor(autoPoint, stage, 'autonomous-debt', stage)].slice(-MEMORY_LIMIT);
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
  const debt = captureFor(bounded, frame.stage, 'visitor-debt', frame.memory.length);
  const memory = [...frame.memory, debt].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, memory), interaction: 'visitor-debt' };
}

export function deleteCapture(frame, captureIndex = frame.memory.length - 1) {
  if (captureIndex < 0 || captureIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== captureIndex);
  return { ...buildFrame(frame.stage, memory), interaction: 'debt-lifted' };
}
