export const SEED = 0x435030;
export const STAGES = 13;
export const MEMORY_LIMIT = 4;
export const AGENT_COUNT = 15;
export const PRIMITIVE_BUDGET = 29;

const LABELS = [
  ['I KEEP', 'the unfinished edge'],
  ['I DOUBT', 'the obvious centre'],
  ['I RETURN', 'the borrowed light'],
  ['I HOLD', 'the second sentence'],
  ['I NOTICE', 'what moved first'],
  ['I DELAY', 'the clean answer'],
  ['I CARRY', 'a quiet remainder'],
  ['I TEST', 'the open seam'],
  ['I REFUSE', 'the easy mirror'],
  ['I SAVE', 'the wrong turn'],
  ['I ASK', 'the absent witness'],
  ['I LEAVE', 'a usable gap'],
  ['I REPEAT', 'only the doubt'],
  ['I TURN', 'toward the margin'],
  ['I REVISE', 'my own outline']
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));

function seeded(index, stage = 0) {
  const value = Math.sin((index + 1) * 17.173 + (stage + 1) * 41.917 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function baseAgent(index, stage) {
  const [lead, tail] = LABELS[index % LABELS.length];
  return {
    index,
    lead,
    tail,
    attention: 0,
    charge: Number((0.18 + seeded(index, stage) * 0.64).toFixed(5)),
    width: Number((0.52 + seeded(index + 21, stage) * 0.32).toFixed(5)),
    lean: Number(((seeded(index + 42, stage) - 0.5) * 0.08).toFixed(5)),
    state: 'quiet'
  };
}

export function buildFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, STAGES - 1);
  return {
    composition: 'decision-population',
    stage: safeStage,
    order: Array.from({ length: AGENT_COUNT }, (_, index) => index),
    agents: Array.from({ length: AGENT_COUNT }, (_, index) => baseAgent(index, safeStage)),
    memory: [],
    commits: [],
    snapshots: [],
    interaction: 'waiting'
  };
}

function rounded(value) {
  return Number(value.toFixed(5));
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    order: frame.order,
    agents: frame.agents.map((agent) => [
      agent.index,
      agent.attention,
      rounded(agent.charge),
      rounded(agent.width),
      rounded(agent.lean),
      agent.state
    ])
  });
}

function chooseSource(frame) {
  return frame.order
    .map((index, position) => ({
      index,
      position,
      score: frame.agents[index].attention * 4 + frame.agents[index].charge + position * 0.0001
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)[0]?.index ?? 0;
}

function chooseDestination(frame, sourceIndex) {
  const sourcePosition = frame.order.indexOf(sourceIndex);
  const destinationPosition = (sourcePosition + 6 + frame.stage) % AGENT_COUNT;
  const destinationIndex = frame.order[destinationPosition];
  return destinationIndex === sourceIndex ? frame.order[(destinationPosition + 1) % AGENT_COUNT] : destinationIndex;
}

export function pulse(frame, options = {}) {
  const next = clone(frame);
  const sourceIndex = Number.isInteger(options.sourceIndex) ? clamp(options.sourceIndex, 0, AGENT_COUNT - 1) : chooseSource(frame);
  const destinationIndex = chooseDestination(frame, sourceIndex);
  const sourcePosition = frame.order.indexOf(sourceIndex);
  const destinationPosition = frame.order.indexOf(destinationIndex);
  const nextOrder = frame.order.filter((index) => index !== sourceIndex);
  nextOrder.splice(destinationPosition, 0, sourceIndex);
  const snapshot = clone(frame);

  next.snapshots = [...frame.snapshots, snapshot].slice(-MEMORY_LIMIT);
  next.agents.forEach((agent, index) => {
    agent.state = 'quiet';
    agent.attention += index === sourceIndex ? 0 : index === destinationIndex ? 2 : 1;
    agent.charge = Number(clamp(agent.charge + (index === sourceIndex ? 0.16 : index === destinationIndex ? -0.09 : 0.018), 0.08, 0.96).toFixed(5));
    agent.width = Number(clamp(agent.width + (index === sourceIndex ? 0.12 : index === destinationIndex ? -0.08 : 0), 0.34, 0.96).toFixed(5));
    agent.lean = Number((agent.lean + (index === sourceIndex ? 0.045 : index === destinationIndex ? -0.035 : 0)).toFixed(5));
  });
  next.agents[sourceIndex].state = 'minority';
  next.agents[destinationIndex].state = 'displaced';
  const event = {
    source: options.source ?? 'visitor-pulse',
    kind: 'second-opinion',
    sourceIndex,
    destinationIndex,
    sourcePosition,
    destinationPosition,
    stage: next.stage,
    orderBefore: frame.order.slice(),
    orderAfter: nextOrder.slice()
  };
  next.order = nextOrder;
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.commits = [...frame.commits, event].slice(-MEMORY_LIMIT);
  next.stage = (frame.stage + 1) % STAGES;
  next.interaction = 'committed';
  return next;
}

export function liftLatest(frame) {
  if (!frame.snapshots.length) return clone(frame);
  const restored = clone(frame.snapshots.at(-1));
  restored.interaction = 'lifted';
  return restored;
}

export function releaseField(seed = 0) {
  return buildFrame(seed);
}

export function buildTimeline() {
  let frame = buildFrame(0);
  const frames = [frame];
  for (let index = 0; index < 4; index += 1) {
    frame = pulse(frame, { source: 'deterministic-timeline' });
    frames.push(frame);
  }
  return frames;
}
