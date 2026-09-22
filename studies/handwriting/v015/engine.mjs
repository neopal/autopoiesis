export const MASTER_SEED = 0x57563135;
export const STAGES = 15;
export const MEMORY_WINDOW = 5;

const COLUMN_COUNT = 9;
const ROW_COUNT = 5;
const AGENT_COUNT = COLUMN_COUNT * ROW_COUNT;
const X_START = 0.10;
const X_STEP = 0.10;
const Y_START = 0.22;
const Y_STEP = 0.14;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const smooth = (value) => value * value * (3 - 2 * value);

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeAttention(entry, index = 0) {
  const rawX = Number(entry?.x);
  const rawY = Number(entry?.y);
  const x = Number(clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.07, 0.93).toFixed(4));
  const y = Number(clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.13, 0.87).toFixed(4));
  return {
    id: String(entry?.id ?? `attention-${index}`),
    source: String(entry?.source ?? 'timeline-attention'),
    stage: Math.max(0, Math.floor(Number(entry?.stage) || 0)),
    x,
    y,
    force: Number(clamp(Number(entry?.force) || 0.92, 0.34, 1).toFixed(4)),
    phase: Number((Number(entry?.phase) || 0).toFixed(6))
  };
}

function copyAgent(agent) {
  return {
    ...agent,
    attentionHistory: agent.attentionHistory.map((event) => ({ ...event }))
  };
}

function distanceToEvent(agent, event) {
  return Math.hypot((agent.baseX - event.x) * 0.96, (agent.baseY - event.y) * 0.92);
}

function makeBaseAgents(stage) {
  const random = rng(MASTER_SEED + stage * 104729);
  return Array.from({ length: AGENT_COUNT }, (_, index) => {
    const column = index % COLUMN_COUNT;
    const row = Math.floor(index / COLUMN_COUNT);
    const jitterX = (random() - 0.5) * 0.018;
    const jitterY = (random() - 0.5) * 0.022;
    const baseX = X_START + column * X_STEP + jitterX;
    const baseY = Y_START + row * Y_STEP + jitterY;
    const lean = (random() - 0.5) * 0.18;
    return {
      id: `mark-${stage}-${String(index).padStart(2, '0')}`,
      index,
      row,
      column,
      baseX: Number(baseX.toFixed(6)),
      baseY: Number(baseY.toFixed(6)),
      x: Number(baseX.toFixed(6)),
      y: Number(baseY.toFixed(6)),
      angle: Number(lean.toFixed(6)),
      baseAngle: Number(lean.toFixed(6)),
      aperture: Number((0.5 + random() * 0.36).toFixed(6)),
      scale: Number((0.78 + random() * 0.38).toFixed(6)),
      weight: Number((0.58 + random() * 0.72).toFixed(6)),
      role: 'waiting',
      visible: true,
      attentionHistory: []
    };
  });
}

function nearestAgent(agents, event) {
  return agents.reduce((best, agent) => {
    const distance = distanceToEvent(agent, event);
    return distance < best.distance ? { agent, distance } : best;
  }, { agent: agents[0], distance: Infinity }).agent;
}

function applyEvent(agents, event) {
  const target = nearestAgent(agents, event);
  const distances = agents.map((agent) => ({ agent, distance: distanceToEvent(agent, event) }));
  const looking = [];
  const answering = [];
  const moved = [];

  for (const { agent, distance } of distances) {
    const directionX = event.x - agent.baseX;
    const directionY = event.y - agent.baseY;
    const length = Math.max(0.0001, Math.hypot(directionX, directionY));
    const nx = directionX / length;
    const ny = directionY / length;
    if (distance <= 0.25) {
      const influence = clamp((0.265 - distance) / 0.20) * event.force;
      agent.x = Number(lerp(agent.x, agent.baseX + nx * 0.034 * influence, 0.72).toFixed(6));
      agent.y = Number(lerp(agent.y, agent.baseY + ny * 0.034 * influence, 0.72).toFixed(6));
      agent.angle = Number((Math.atan2(directionY, directionX) + Math.sin(event.phase + agent.index * 0.31) * 0.08).toFixed(6));
      agent.aperture = Number(clamp(0.87 - influence * 0.18, 0.42, 0.94).toFixed(6));
      agent.role = 'looking';
      agent.attentionHistory.push({ id: event.id, phase: 'look', distance: Number(distance.toFixed(4)) });
      looking.push(agent.index);
      moved.push(agent.index);
    } else if (distance <= 0.48) {
      const influence = clamp((0.49 - distance) / 0.24) * event.force;
      const replyAngle = Math.atan2(directionY, directionX) + Math.PI + Math.sin(event.phase + agent.index * 0.23) * 0.16;
      agent.x = Number(lerp(agent.x, agent.baseX - nx * 0.028 * influence, 0.58).toFixed(6));
      agent.y = Number(lerp(agent.y, agent.baseY - ny * 0.028 * influence, 0.58).toFixed(6));
      agent.angle = Number(replyAngle.toFixed(6));
      agent.aperture = Number(clamp(0.22 + influence * 0.26, 0.18, 0.58).toFixed(6));
      agent.role = 'answering';
      agent.attentionHistory.push({ id: event.id, phase: 'answer', distance: Number(distance.toFixed(4)) });
      answering.push(agent.index);
      moved.push(agent.index);
    } else if (distance <= 0.54) {
      const influence = clamp((0.55 - distance) / 0.26) * event.force;
      const tangent = Math.sin(event.phase + agent.index * 0.19) < 0 ? -1 : 1;
      agent.x = Number(lerp(agent.x, agent.baseX + (-ny * tangent) * 0.014 * influence, 0.38).toFixed(6));
      agent.y = Number(lerp(agent.y, agent.baseY + (nx * tangent) * 0.014 * influence, 0.38).toFixed(6));
      agent.angle = Number((agent.baseAngle + tangent * 0.24 * influence).toFixed(6));
      agent.role = 'witness';
      agent.attentionHistory.push({ id: event.id, phase: 'witness', distance: Number(distance.toFixed(4)) });
      moved.push(agent.index);
    }
  }

  const outerCandidates = distances
    .filter(({ distance, agent }) => distance > 0.36 && distance <= 0.58 && agent.index !== target.index && agent.visible)
    .sort((a, b) => a.distance - b.distance || a.agent.index - b.agent.index);
  const vacancy = outerCandidates[Math.min(2, outerCandidates.length - 1)]?.agent ?? agents[(target.index + COLUMN_COUNT + 2) % AGENT_COUNT];
  vacancy.visible = false;
  vacancy.role = 'vacant';
  vacancy.aperture = 0;
  vacancy.attentionHistory.push({ id: event.id, phase: 'vacancy', distance: Number(distanceToEvent(vacancy, event).toFixed(4)) });

  return {
    looking,
    answering,
    moved,
    vacated: [vacancy.index],
    target: target.index
  };
}

function buildQuorumSummary(event, result) {
  return {
    id: event.id,
    x: event.x,
    y: event.y,
    lookingAgents: result.looking,
    answeringAgents: result.answering,
    movedAgents: result.moved,
    vacatedAgents: result.vacated,
    lookingCount: result.looking.length,
    answeringCount: result.answering.length,
    vacancyCount: result.vacated.length,
    topologyChanged: result.vacated.length > 0,
    targetAgent: result.target
  };
}

function makeStageAttention(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const column = (stage * 3) % COLUMN_COUNT;
  const row = (stage * 2) % ROW_COUNT;
  return normalizeAttention({
    id: `stage-${stage}-attention`,
    stage,
    x: X_START + column * X_STEP,
    y: Y_START + row * Y_STEP,
    force: 0.94,
    phase: stage * 0.73 + column * 0.41
  });
}

export function makeAgents(stage, memory = []) {
  const agents = makeBaseAgents(stage);
  const quorums = [];
  for (const event of memory.map(normalizeAttention).slice(-MEMORY_WINDOW)) {
    quorums.push(buildQuorumSummary(event, applyEvent(agents, event)));
  }
  return { agents, quorums };
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const stableMemory = memory.map(normalizeAttention).slice(-MEMORY_WINDOW);
  const { agents, quorums } = makeAgents(stage, stableMemory);
  return {
    stage,
    agents,
    memory: stableMemory,
    quorums,
    emptySlots: agents.filter((agent) => !agent.visible).map((agent) => agent.index),
    newAttentions: (() => {
      const next = makeStageAttention(stage);
      return next ? [next] : [];
    })()
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newAttentions].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyAttention(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const event = normalizeAttention({
    id: `visitor-attention-${frame.stage}-${frame.memory.length}`,
    source: 'visitor-attention',
    stage: frame.stage,
    x: clamp(Number.isFinite(x) ? x : 0.5, 0.07, 0.93),
    y: clamp(Number.isFinite(y) ? y : 0.5, 0.13, 0.87),
    force: 1,
    phase: (Number.isFinite(x) ? x : 0.5) * 13.7 + (Number.isFinite(y) ? y : 0.5) * 17.1
  });
  const next = buildFrame(frame.stage, [...frame.memory, event].slice(-MEMORY_WINDOW));
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function removeLatestAttention(frame) {
  const previousMemory = Array.isArray(frame.previousMemory)
    ? frame.previousMemory
    : frame.memory.slice(0, -1);
  return buildFrame(frame.stage, previousMemory);
}

export const constants = {
  agentCount: AGENT_COUNT,
  columnCount: COLUMN_COUNT,
  rowCount: ROW_COUNT,
  memoryWindow: MEMORY_WINDOW,
  finalStage: STAGES - 1
};
