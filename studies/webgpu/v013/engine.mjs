export const SEED = 0x5747503d;
export const STAGES = 18;
export const AGENT_COUNT = 576;
export const MEMORY_LIMIT = 6;

const COLUMNS = 24;
const ROWS = AGENT_COUNT / COLUMNS;
const AUTO_LOOKS = [
  { stage: 2, point: { x: 0.16, y: 0.67 } },
  { stage: 5, point: { x: 0.34, y: 0.27 } },
  { stage: 8, point: { x: 0.51, y: 0.72 } },
  { stage: 11, point: { x: 0.68, y: 0.38 } },
  { stage: 14, point: { x: 0.82, y: 0.63 } },
  { stage: 16, point: { x: 0.88, y: 0.2 } }
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, amount) => a + (b - a) * clamp(amount);
const mixAngle = (a, b, amount) => {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * clamp(amount);
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

function copyLook(record) {
  return {
    ...record,
    point: { x: Number(record.point.x), y: Number(record.point.y) },
    sourceStage: Number(record.sourceStage),
    radius: Number(record.radius),
    phase: Number(record.phase),
    affectedAgents: Number(record.affectedAgents || 0),
    attentiveAgents: Number(record.attentiveAgents || 0),
    reciprocalAgents: Number(record.reciprocalAgents || 0),
    answeringAgents: Number(record.answeringAgents || 0),
    attentionLoad: Number(record.attentionLoad || 0),
    replyLoad: Number(record.replyLoad || 0),
    answerLoad: Number(record.answerLoad || 0)
  };
}

function boundedPoint(point) {
  return {
    x: clamp(Number(point?.x) || 0.5, 0.08, 0.92),
    y: clamp(Number(point?.y) || 0.5, 0.08, 0.92)
  };
}

function lookFor(point, stage, source, serial = 0) {
  const safePoint = boundedPoint(point);
  return {
    id: `${source}-${stage}-${serial}`,
    point: safePoint,
    radius: 0.086 + (serial % 3) * 0.014,
    phase: 0.29 + stage * 0.17 + serial * 0.43,
    sourceStage: stage,
    source,
    affectedAgents: 0,
    attentiveAgents: 0,
    reciprocalAgents: 0,
    answeringAgents: 0,
    attentionLoad: 0,
    replyLoad: 0,
    answerLoad: 0
  };
}

function normalizeMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map(copyLook);
}

function buildAgent(index, stage, memory) {
  const random = rng(SEED + index * 977 + stage * 7919);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const u = column / (COLUMNS - 1);
  const v = row / (ROWS - 1);
  const phase = random() * Math.PI * 2;
  const origin = {
    x: 0.055 + u * 0.89 + (random() - 0.5) * 0.013,
    y: 0.07 + v * 0.86 + (random() - 0.5) * 0.013
  };
  let x = origin.x + Math.sin(stage * 0.11 + row * 0.24 + phase) * 0.005;
  let y = origin.y + Math.cos(u * 6.1 + row * 0.27 + stage * 0.09 + phase) * 0.005;
  let angle = -0.2 + Math.sin(row * 0.37 + u * 2.2 + phase) * 0.46;
  let scale = 0.76 + random() * 0.2;
  let attention = 0;
  let reply = 0;
  let answer = 0;
  let orientationShift = 0;
  const attentionInfluences = [];
  const replyInfluences = [];
  const answerInfluences = [];
  const influences = [];

  memory.forEach((record, memoryIndex) => {
    const dx = record.point.x - x;
    const dy = record.point.y - y;
    const d = Math.hypot(dx, dy);
    const envelope = Math.exp(-(d * d) / (2 * record.radius * record.radius));
    const ringDistance = Math.abs(d - record.radius * 1.72);
    const reciprocalRing = Math.exp(-(ringDistance * ringDistance) / (2 * (record.radius * 0.42) ** 2));
    const age = clamp((stage - record.sourceStage + 3) / (STAGES + 1));
    const pulse = 0.72 + 0.28 * Math.sin(record.phase + stage * 0.16 + memoryIndex * 0.31) ** 2;
    const attentionInfluence = envelope * (0.68 + age * 0.32) * pulse;
    const replyInfluence = reciprocalRing * (0.58 + envelope * 0.42) * pulse;
    const answerInfluence = smoothstep(0.1, 0.62, envelope) * (0.34 + reciprocalRing * 0.66) * (0.68 + age * 0.32);
    const toward = Math.atan2(dy, dx);
    const outward = Math.atan2(y - record.point.y, x - record.point.x);
    const side = ((row + memoryIndex + Math.floor(record.phase * 5)) % 2 ? 1 : -1);

    influences.push(Math.max(attentionInfluence, replyInfluence, answerInfluence));
    attentionInfluences.push(attentionInfluence);
    replyInfluences.push(replyInfluence);
    answerInfluences.push(answerInfluence);
    attention += attentionInfluence;
    reply += replyInfluence;
    answer += answerInfluence;

    // Changed rule: a remembered look is a social event. Nearby marks face
    // the visitor, the surrounding ring answers back, and the next ring
    // rotates into a shared decision instead of following a route.
    angle = mixAngle(angle, toward, attentionInfluence * 0.7);
    angle = mixAngle(angle, outward + side * 0.92, replyInfluence * 0.62);
    angle = mixAngle(angle, outward - side * 0.48, answerInfluence * 0.34);
    x += dx * attentionInfluence * (0.05 + memoryIndex * 0.008);
    y += dy * attentionInfluence * (0.05 + memoryIndex * 0.008);
    x += Math.cos(outward + side * Math.PI / 2) * replyInfluence * 0.009;
    y += Math.sin(outward + side * Math.PI / 2) * replyInfluence * 0.009;
    x += Math.cos(record.phase + index * 0.019) * answerInfluence * 0.006;
    y += Math.sin(record.phase + index * 0.019) * answerInfluence * 0.006;
    scale += answerInfluence * 0.18 + replyInfluence * 0.08;
    orientationShift += attentionInfluence * 0.8 + replyInfluence * 0.58 + answerInfluence * 0.32;
  });

  x = clamp(x, 0.025, 0.975);
  y = clamp(y, 0.025, 0.975);
  return {
    id: index,
    x,
    y,
    originX: origin.x,
    originY: origin.y,
    displacement: distance(origin, { x, y }),
    angle,
    baseAngle: -0.2 + Math.sin(row * 0.37 + u * 2.2 + phase) * 0.46,
    orientationShift,
    attention,
    reply,
    answer,
    scale: Math.min(1.9, scale),
    column,
    row,
    layer: row % 3 === 0 ? 'signal' : row % 3 === 1 ? 'body' : 'dust',
    phase,
    influences,
    attentionInfluences,
    replyInfluences,
    answerInfluences
  };
}

function resolveMemory(memory, agents) {
  return memory.map((record, index) => ({
    ...record,
    affectedAgents: agents.filter((agent) => (agent.influences[index] ?? 0) > 0.08).length,
    attentiveAgents: agents.filter((agent) => (agent.attentionInfluences[index] ?? 0) > 0.16).length,
    reciprocalAgents: agents.filter((agent) => (agent.replyInfluences[index] ?? 0) > 0.12).length,
    answeringAgents: agents.filter((agent) => (agent.answerInfluences[index] ?? 0) > 0.12).length,
    attentionLoad: agents.reduce((sum, agent) => sum + (agent.attentionInfluences[index] ?? 0), 0),
    replyLoad: agents.reduce((sum, agent) => sum + (agent.replyInfluences[index] ?? 0), 0),
    answerLoad: agents.reduce((sum, agent) => sum + (agent.answerInfluences[index] ?? 0), 0)
  }));
}

function archiveFor(memory) {
  return memory.map((record, index) => ({
    index,
    id: record.id,
    point: { ...record.point },
    radius: record.radius,
    phase: record.phase,
    source: record.source,
    sourceStage: record.sourceStage,
    affectedAgents: record.affectedAgents,
    attentiveAgents: record.attentiveAgents,
    reciprocalAgents: record.reciprocalAgents,
    answeringAgents: record.answeringAgents,
    attentionLoad: record.attentionLoad,
    replyLoad: record.replyLoad,
    answerLoad: record.answerLoad
  }));
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(Number(stage) || 0));
  const inherited = normalizeMemory(memory);
  const agents = Array.from({ length: AGENT_COUNT }, (_, index) => buildAgent(index, safeStage, inherited));
  const resolvedMemory = resolveMemory(inherited, agents);
  const archive = archiveFor(resolvedMemory);
  const totalDisplacement = agents.reduce((sum, agent) => sum + agent.displacement, 0);
  const totalOrientationShift = agents.reduce((sum, agent) => sum + agent.orientationShift, 0);
  const attentiveAgents = agents.filter((agent) => agent.attentionInfluences.some((value) => value > 0.16)).length;
  const reciprocalAgents = agents.filter((agent) => agent.replyInfluences.some((value) => value > 0.12)).length;
  const answeringAgents = agents.filter((agent) => agent.answerInfluences.some((value) => value > 0.12)).length;

  return {
    stage: safeStage,
    agents,
    memory: resolvedMemory,
    archive,
    totalDisplacement,
    aggregate: {
      attentiveAgents,
      reciprocalAgents,
      answeringAgents,
      totalOrientationShift,
      attentionLoad: resolvedMemory.reduce((sum, record) => sum + record.attentionLoad, 0),
      replyLoad: resolvedMemory.reduce((sum, record) => sum + record.replyLoad, 0),
      answerLoad: resolvedMemory.reduce((sum, record) => sum + record.answerLoad, 0)
    }
  };
}

function memoryAtStage(stage) {
  return AUTO_LOOKS.filter((record) => record.stage <= stage)
    .map((record, index) => lookFor(record.point, record.stage, 'auto-look', index));
}

export function buildTimeline(limit = STAGES) {
  return Array.from({ length: limit }, (_, stage) => buildFrame(stage, memoryAtStage(stage)));
}

export function applyLook(frame, point) {
  const nextMemory = [...frame.memory, lookFor(point, frame.stage, 'visitor-look', frame.memory.length)];
  return buildFrame(frame.stage, nextMemory);
}

export function deleteLook(frame) {
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseLooks(frame) {
  return buildFrame(0, []);
}
