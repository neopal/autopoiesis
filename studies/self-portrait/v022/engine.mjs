export const SEED = 0x53504642;
export const STAGES = 19;
export const MEMORY_LIMIT = 5;
export const NODE_COUNT = 18;
export const PRIMITIVE_BUDGET = 54;
export const CHOICES = ['left', 'right'];

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function makeNode(stage, index, random) {
  const column = index % 6;
  const row = Math.floor(index / 6);
  const center = column - 2.5;
  const vertical = row - 1;
  return {
    index,
    x: center * 0.145 + (random() - 0.5) * 0.035,
    y: vertical * 0.24 + Math.sin(index * 0.77 + stage * 0.16) * 0.055 + (random() - 0.5) * 0.045,
    width: 0.105 + random() * 0.06,
    height: 0.17 + random() * 0.09,
    angle: (random() - 0.5) * 0.22 + center * 0.035,
    notch: 0.18 + random() * 0.25,
    counter: 0,
    pressure: 0,
    state: 'quiet'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 7919);
  let frame = {
    composition: 'branching-self-portrait',
    stage: safeStage,
    nodes: Array.from({ length: NODE_COUNT }, (_, index) => makeNode(safeStage, index, random)),
    memory: [],
    cursor: 0,
    armedChoice: null,
    interaction: 'sequence'
  };
  for (const event of clone(memory).slice(-MEMORY_LIMIT)) frame = applyChoice(frame, event);
  frame.interaction = 'sequence';
  return frame;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    cursor: frame.cursor,
    nodes: frame.nodes.map((node) => [
      node.index,
      Number(node.x.toFixed(5)),
      Number(node.y.toFixed(5)),
      Number(node.width.toFixed(5)),
      Number(node.height.toFixed(5)),
      Number(node.angle.toFixed(5)),
      Number(node.notch.toFixed(5)),
      Number(node.counter.toFixed(5)),
      Number(node.pressure.toFixed(5)),
      node.state
    ])
  });
}

function safeChoice(choice, fallback = 'left') {
  return CHOICES.includes(choice) ? choice : fallback;
}

function safeIndex(value, fallback = 0) {
  const index = Number(value);
  if (Number.isInteger(index)) return ((index % NODE_COUNT) + NODE_COUNT) % NODE_COUNT;
  const safeFallback = Number(fallback);
  return Number.isInteger(safeFallback) ? ((safeFallback % NODE_COUNT) + NODE_COUNT) % NODE_COUNT : 0;
}

function activeNode(frame) {
  return safeIndex(frame.cursor, 0);
}

function replyFor(frame, nodeIndex, choice) {
  const rightBias = choice === 'right' ? 5 : 2;
  const previousReply = frame.memory.at(-1)?.replyIndex;
  let replyIndex = (nodeIndex + 7 + rightBias + frame.memory.length * 3) % NODE_COUNT;
  if (replyIndex === nodeIndex) replyIndex = (replyIndex + 4) % NODE_COUNT;
  if (replyIndex === previousReply) replyIndex = (replyIndex + 3) % NODE_COUNT;
  return replyIndex;
}

function applyChoice(frame, input = {}) {
  const next = clone(frame);
  const choice = safeChoice(input.choice, frame.armedChoice ?? (frame.memory.length % 2 ? 'right' : 'left'));
  const nodeIndex = safeIndex(input.nodeIndex, activeNode(frame));
  const rejectedIndex = safeIndex(input.rejectedIndex, (nodeIndex + (choice === 'left' ? 1 : -1)) % NODE_COUNT);
  const replyIndex = safeIndex(input.replyIndex, replyFor(frame, nodeIndex, choice));
  const source = next.nodes[nodeIndex];
  const rejected = next.nodes[rejectedIndex];
  const reply = next.nodes[replyIndex];
  const sign = choice === 'left' ? -1 : 1;
  const weight = 1 + frame.memory.length * 0.12;

  source.state = 'kept';
  source.width += 0.026 * weight;
  source.height += 0.018 * weight;
  source.angle += sign * 0.24;
  source.notch = clamp(source.notch - 0.09, 0.02, 1);
  source.pressure += 0.48 * weight;

  rejected.state = 'refused';
  rejected.width = Math.max(0.045, rejected.width - 0.035 * weight);
  rejected.height = Math.max(0.07, rejected.height - 0.025 * weight);
  rejected.angle -= sign * 0.31;
  rejected.notch = clamp(rejected.notch + 0.28, 0, 1);
  rejected.pressure += 0.16 * weight;

  reply.state = 'counter';
  reply.counter += 1 + frame.memory.length * 0.35;
  reply.angle += sign * (0.16 + frame.memory.length * 0.025);
  reply.x += sign * 0.035 * weight;
  reply.y -= 0.022 * weight;
  reply.notch = clamp(reply.notch + 0.12, 0, 1);

  const event = {
    id: input.id ?? `visitor-choice-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'visitor-choice',
    kind: 'self-rebuttal',
    choice,
    nodeIndex,
    rejectedIndex,
    replyIndex,
    reason: 'the portrait keeps the chosen branch and turns the refused branch into its next condition'
  };
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.cursor = (replyIndex + (choice === 'right' ? 4 : 3) + frame.memory.length) % NODE_COUNT;
  next.armedChoice = null;
  next.interaction = 'choice-committed';
  return next;
}

export function chooseBranch(frame, choice = 'left') {
  const safe = safeChoice(choice, frame.memory.length % 2 ? 'right' : 'left');
  return applyChoice(frame, { choice: safe });
}

export function armChoice(frame, choice = 'left') {
  const next = clone(frame);
  next.armedChoice = safeChoice(choice);
  next.interaction = 'choice-armed';
  return next;
}

export function liftLatestChoice(frame) {
  if (!frame.memory.length) return clone(frame);
  const restored = buildFrame(frame.stage, frame.memory.slice(0, -1));
  restored.interaction = 'choice-lifted';
  return restored;
}

export function releaseChoices(stage = 0) {
  const released = buildFrame(stage, []);
  released.interaction = 'choices-released';
  return released;
}

const CUES = ['left', 'right', 'right', 'left', 'right'];

export function defaultChoice(index = 0) {
  return CUES[index % CUES.length];
}

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[3, 'left'], [6, 'right'], [9, 'right'], [12, 'left'], [15, 'right']]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = chooseBranch(frame, eventStages.get(stage));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(frame);
  }
  return timeline;
}
