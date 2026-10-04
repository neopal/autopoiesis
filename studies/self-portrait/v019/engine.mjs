export const SEED = 0x53504639;
export const STAGES = 14;
export const MEMORY_LIMIT = 4;
export const CLAUSE_COUNT = 9;
export const PRIMITIVE_BUDGET = 36;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function safeStage(value) {
  return clamp(Math.floor(Number(value) || 0), 0, STAGES - 1);
}

function safeIndex(value, fallback = 0) {
  const index = Number(value);
  return Number.isInteger(index) ? Math.max(0, Math.min(CLAUSE_COUNT - 1, index)) : fallback;
}

const LOCI = [
  [0.22, 0.25], [0.45, 0.20], [0.68, 0.27],
  [0.17, 0.46], [0.43, 0.41], [0.70, 0.47],
  [0.29, 0.67], [0.53, 0.61], [0.77, 0.68]
];

function makeClause(stage, index, random) {
  const [x, y] = LOCI[index];
  return {
    id: `clause-${String(index + 1).padStart(2, '0')}`,
    x: x + Math.sin(stage * 0.14 + index * 0.7) * 0.008,
    y: y + Math.cos(stage * 0.17 + index * 0.63) * 0.007,
    angle: (Math.sin(index * 1.17 + stage * 0.21) * 0.16) + (random() - 0.5) * 0.04,
    scale: 0.88 + random() * 0.12,
    split: 0,
    weld: 0,
    notch: 0,
    tension: 0,
    tone: (0.02 + index * 0.078 + random() * 0.018) % 1,
    status: 'quiet'
  };
}

function makeBase(stage) {
  const random = rng(SEED + stage * 9973);
  const clauses = Array.from({ length: CLAUSE_COUNT }, (_, index) => makeClause(stage, index, random));
  return {
    stage,
    clauses,
    memory: [],
    replies: [],
    armedClause: null,
    interaction: 'sequence'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    clauses: frame.clauses.map((clause) => [
      Number(clause.x.toFixed(5)), Number(clause.y.toFixed(5)), Number(clause.angle.toFixed(5)),
      Number(clause.scale.toFixed(5)), Number(clause.split.toFixed(5)), Number(clause.weld.toFixed(5)),
      Number(clause.notch.toFixed(5)), Number(clause.tension.toFixed(5)), clause.status
    ])
  });
}

function refreshDerived(frame) {
  frame.replies = frame.memory.map((event) => ({ from: event.clauseIndex, to: event.replyIndex, stage: event.stage }));
  frame.signature = geometrySignature(frame);
  return frame;
}

function chooseReply(frame, clauseIndex, repetition) {
  const candidates = frame.clauses
    .map((clause, index) => ({ index, score: clause.weld + clause.tension * 0.3 + Math.abs(index - clauseIndex) * 0.012 }))
    .filter(({ index }) => index !== clauseIndex)
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const previous = frame.memory.at(-1)?.replyIndex;
  const start = (repetition * 2 + frame.memory.length + 2) % candidates.length;
  const candidate = candidates[start]?.index ?? ((clauseIndex + 4) % CLAUSE_COUNT);
  if (candidate !== previous) return candidate;
  return candidates[(start + 1) % candidates.length]?.index ?? ((candidate + 3) % CLAUSE_COUNT);
}

function normalizeEvent(event = {}, frame) {
  const fallback = (frame.stage * 2 + frame.memory.length * 3 + 1) % CLAUSE_COUNT;
  const clauseIndex = safeIndex(event.clauseIndex, fallback);
  const repetition = frame.memory.filter((item) => item.clauseIndex === clauseIndex).length;
  return {
    id: event.id ?? `visitor-attention-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'visitor-attention',
    kind: 'syntax-reply',
    clauseIndex,
    replyIndex: safeIndex(event.replyIndex, chooseReply(frame, clauseIndex, repetition)),
    resistanceBefore: frame.clauses[clauseIndex]?.split ?? 0,
    reason: 'attention splits the addressed clause and makes a distant clause weld the reply'
  };
}

function applyAttention(frame, event) {
  const next = clone(frame);
  const selected = next.clauses[event.clauseIndex];
  const reply = next.clauses[event.replyIndex];
  const pressure = 0.2 + event.resistanceBefore * 0.22 + (frame.memory.length * 0.025);

  selected.split = clamp(selected.split + pressure, 0, 0.82);
  selected.notch = clamp(selected.notch + 0.16 + event.resistanceBefore * 0.12, 0, 0.7);
  selected.x = clamp(selected.x - 0.012 - event.resistanceBefore * 0.006, 0.08, 0.82);
  selected.angle += (event.clauseIndex % 2 ? -1 : 1) * (0.08 + pressure * 0.12);
  selected.scale = clamp(selected.scale * (0.95 - event.resistanceBefore * 0.02), 0.72, 1.12);
  selected.tension = clamp(selected.tension + 0.2, 0, 1.5);
  selected.status = 'split';

  reply.weld = clamp(reply.weld + 0.25 + pressure * 0.3, 0, 0.95);
  reply.notch = clamp(reply.notch * 0.72, 0, 0.7);
  reply.angle += (event.replyIndex % 2 ? 1 : -1) * (0.1 + pressure * 0.08);
  reply.scale = clamp(reply.scale + 0.06 + pressure * 0.04, 0.7, 1.2);
  reply.tension = clamp(reply.tension + 0.12, 0, 1.5);
  reply.status = 'replying';

  next.clauses.forEach((clause, index) => {
    if (index === event.clauseIndex || index === event.replyIndex) return;
    const distance = Math.abs(index - event.clauseIndex);
    const influence = Math.max(0, 1 - distance / 5);
    clause.tension = clamp(clause.tension + influence * 0.045, 0, 1.5);
    clause.angle += (index < event.clauseIndex ? -1 : 1) * influence * 0.012;
    clause.y += (index % 2 ? 1 : -1) * influence * 0.004;
  });

  next.interaction = 'attention-committed';
  return refreshDerived(next);
}

export function buildFrame(stage = 0, memory = []) {
  let frame = makeBase(safeStage(stage));
  for (const rawEvent of memory.slice(-MEMORY_LIMIT)) {
    const event = normalizeEvent(rawEvent, frame);
    frame = applyAttention(frame, { ...event, ...rawEvent });
    frame.memory = [...frame.memory, { ...event, ...rawEvent, resistanceAfter: frame.clauses[event.clauseIndex].split, signature: frame.signature }].slice(-MEMORY_LIMIT);
    frame = refreshDerived(frame);
  }
  frame.stage = safeStage(stage);
  return refreshDerived(frame);
}

export function armClause(frame, index = null) {
  const next = clone(frame);
  next.armedClause = index == null ? (frame.stage * 2 + frame.memory.length + 1) % CLAUSE_COUNT : safeIndex(index, 0);
  next.interaction = 'attention-armed';
  return refreshDerived(next);
}

export function commitAttention(frame, input = {}) {
  const armed = armClause(frame, input.clauseIndex ?? frame.armedClause);
  const event = normalizeEvent({ ...input, clauseIndex: input.clauseIndex ?? armed.armedClause }, armed);
  const changed = applyAttention(armed, event);
  changed.memory = [...frame.memory, { ...event, resistanceAfter: changed.clauses[event.clauseIndex].split, signature: changed.signature }].slice(-MEMORY_LIMIT);
  return refreshDerived(changed);
}

export function liftLatestAttention(frame) {
  if (!frame.memory.length) return refreshDerived(clone(frame));
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseAttention(stage = 0) {
  return buildFrame(stage, []);
}

export function defaultCue(index = 0) {
  const cues = [
    { clauseIndex: 1 },
    { clauseIndex: 6 },
    { clauseIndex: 3 },
    { clauseIndex: 8 }
  ];
  return { ...cues[index % cues.length] };
}

export function pathForClause(clause, index) {
  const width = 118 * clause.scale;
  const height = 164 * clause.scale;
  const split = clause.split * 42;
  const notch = clause.notch * 30;
  const weld = clause.weld * 34;
  const wobble = Math.sin(index * 1.7) * 6;
  return [
    `M ${-width * 0.48} ${-height * 0.34}`,
    `C ${-width * 0.15 + wobble} ${-height * 0.52}, ${width * 0.34} ${-height * 0.48}, ${width * 0.46} ${-height * 0.16}`,
    `C ${width * 0.57} ${height * 0.04}, ${width * 0.2 + weld} ${height * 0.16}, ${width * 0.3} ${height * 0.42}`,
    `L ${width * 0.1} ${height * 0.48}`,
    `L ${width * 0.02 + split} ${height * 0.12}`,
    `L ${-width * 0.12 + notch} ${height * 0.05}`,
    `L ${-width * 0.34} ${height * 0.44}`,
    `C ${-width * 0.58} ${height * 0.25}, ${-width * 0.64} ${-height * 0.03}, ${-width * 0.48} ${-height * 0.34} Z`
  ].join(' ');
}

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[2, 0], [5, 1], [8, 2], [11, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = commitAttention(frame, defaultCue(eventStages.get(stage)));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(refreshDerived(frame));
  }
  return timeline;
}
