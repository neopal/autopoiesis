export const SEED = 0x53504638;
export const STAGES = 15;
export const MEMORY_LIMIT = 4;
export const STRAND_COUNT = 17;
export const PRESSURE_THRESHOLD = 0.62;
export const PRIMITIVE_BUDGET = 68;

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

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function safeIndex(value, fallback) {
  const index = Number(value);
  return Number.isInteger(index) ? Math.max(0, Math.min(STRAND_COUNT - 1, index)) : fallback;
}

function boundedForce(value) {
  const force = Number(value);
  return clamp(Number.isFinite(force) ? force : 0.82, PRESSURE_THRESHOLD, 1);
}

function makeStrand(stage, index, random) {
  const progress = index / (STRAND_COUNT - 1);
  const length = 0.5 + Math.sin(index * 0.77 + stage * 0.21) * 0.08 + random() * 0.045;
  const center = 0.5 + Math.sin(index * 0.92 + stage * 0.18) * 0.055;
  const x = clamp(center - length * 0.5, 0.06, 0.94 - length);
  const leftSpan = length * (0.47 + Math.sin(index * 1.13) * 0.035);
  return {
    id: `strand-${String(index + 1).padStart(2, '0')}`,
    x,
    y: 0.15 + progress * 0.7 + Math.sin(index * 0.63 + stage * 0.2) * 0.012,
    length,
    thickness: 0.012 + (index % 4) * 0.002 + random() * 0.002,
    angle: (Math.sin(index * 0.82 + stage * 0.14) * 0.12) + (random() - 0.5) * 0.035,
    leftSpan,
    rightSpan: length - leftSpan,
    gap: 0,
    resistance: 0.08 + random() * 0.08,
    tone: (index * 0.071 + stage * 0.018) % 1,
    status: 'stable'
  };
}

function makeBase(stage) {
  const random = rng(SEED + stage * 7919);
  const strands = Array.from({ length: STRAND_COUNT }, (_, index) => makeStrand(stage, index, random));
  return {
    stage,
    strands,
    memory: [],
    cuts: [],
    replies: [],
    pressureField: strands.map((strand) => strand.resistance),
    armedStrand: null,
    interaction: 'sequence'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    strands: frame.strands.map((strand) => [
      Number(strand.x.toFixed(5)), Number(strand.y.toFixed(5)), Number(strand.length.toFixed(5)),
      Number(strand.thickness.toFixed(5)), Number(strand.angle.toFixed(5)), Number(strand.leftSpan.toFixed(5)),
      Number(strand.rightSpan.toFixed(5)), Number(strand.gap.toFixed(5)), Number(strand.resistance.toFixed(5)), strand.status
    ])
  });
}

function refreshDerived(frame) {
  frame.cuts = frame.memory.filter((event) => event.kind === 'material-cut');
  frame.replies = frame.memory.map((event) => ({ from: event.strandIndex, to: event.replyStrand, stage: event.stage }));
  frame.pressureField = frame.strands.map((strand) => strand.resistance);
  frame.signature = geometrySignature(frame);
  return frame;
}

function chooseReply(frame, strandIndex, repetition) {
  const candidates = frame.strands
    .map((strand, index) => ({ index, score: strand.resistance + Math.abs(index - strandIndex) * 0.009 }))
    .filter(({ index }) => index !== strandIndex)
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const previous = frame.memory.at(-1)?.replyStrand;
  const start = (repetition * 3 + frame.memory.length * 2) % candidates.length;
  const candidate = candidates[start]?.index ?? ((strandIndex + 6) % STRAND_COUNT);
  if (candidate !== previous) return candidate;
  return candidates[(start + 1) % candidates.length]?.index ?? ((candidate + 5) % STRAND_COUNT);
}

function normalizeEvent(event = {}, frame) {
  const fallback = (frame.stage * 5 + frame.memory.length * 3 + 4) % STRAND_COUNT;
  const strandIndex = safeIndex(event.strandIndex, fallback);
  const repetition = frame.memory.filter((item) => item.strandIndex === strandIndex).length;
  return {
    id: event.id ?? `visitor-pressure-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'visitor-pressure',
    kind: 'material-cut',
    force: boundedForce(event.force),
    strandIndex,
    replyStrand: safeIndex(event.replyStrand, chooseReply(frame, strandIndex, repetition)),
    resistanceBefore: frame.strands[strandIndex]?.resistance ?? 0,
    reason: 'pressure opens a real cut and makes a distant strand carry the displaced load'
  };
}

function applyCut(frame, event) {
  const next = clone(frame);
  const cut = next.strands[event.strandIndex];
  const reply = next.strands[event.replyStrand];
  const resistance = cut.resistance;
  const cutDepth = 0.06 + event.force * 0.07 + resistance * 0.035;
  const usableLength = Math.max(0.24, cut.length - cutDepth);

  cut.gap = clamp(cut.gap + cutDepth, 0.045, 0.28);
  cut.leftSpan = usableLength * (0.45 + Math.sin(event.stage * 0.4 + event.strandIndex) * 0.05);
  cut.rightSpan = usableLength - cut.leftSpan;
  cut.x = clamp(cut.x - 0.012 - resistance * 0.009, 0.04, 0.96 - cut.length);
  cut.angle += (event.strandIndex % 2 ? -1 : 1) * (0.08 + event.force * 0.065);
  cut.thickness = clamp(cut.thickness * (0.88 - resistance * 0.03), 0.006, 0.028);
  cut.resistance = clamp(resistance + 0.33 + event.force * 0.28, 0.05, 2.4);
  cut.status = 'cut';

  reply.length = clamp(reply.length + 0.035 + event.force * 0.03, 0.42, 0.78);
  reply.rightSpan = clamp(reply.rightSpan + 0.022 + event.force * 0.018, 0.1, reply.length * 0.88);
  reply.leftSpan = Math.max(0.12, reply.length - reply.rightSpan);
  reply.thickness = clamp(reply.thickness + 0.006 + event.force * 0.006, 0.008, 0.036);
  reply.angle -= (event.replyStrand % 2 ? 1 : -1) * 0.045;
  reply.resistance = clamp(reply.resistance + 0.12, 0.04, 2.2);
  reply.status = 'answering';

  next.strands.forEach((strand, index) => {
    if (index === event.strandIndex || index === event.replyStrand) return;
    const distance = Math.abs(index - event.strandIndex);
    const influence = Math.max(0, 1 - distance / 7);
    strand.x = clamp(strand.x + (index < event.strandIndex ? -1 : 1) * influence * 0.011, 0.04, 0.94 - strand.length);
    strand.angle += (index % 2 ? 1 : -1) * influence * 0.009;
    strand.resistance = clamp(strand.resistance + influence * 0.018, 0.04, 2.2);
  });

  next.interaction = 'pressure-committed';
  return refreshDerived(next);
}

export function buildFrame(stage = 0, memory = []) {
  let frame = makeBase(safeStage(stage));
  for (const rawEvent of memory.slice(-MEMORY_LIMIT)) {
    const event = normalizeEvent(rawEvent, frame);
    frame = applyCut(frame, { ...event, ...rawEvent });
    frame.memory = [...frame.memory, { ...event, ...rawEvent, resistanceAfter: frame.strands[event.strandIndex].resistance, signature: frame.signature }].slice(-MEMORY_LIMIT);
    frame = refreshDerived(frame);
  }
  frame.stage = safeStage(stage);
  return refreshDerived(frame);
}

export function armPressure(frame, index = null) {
  const next = clone(frame);
  next.armedStrand = index == null ? (frame.stage * 5 + frame.memory.length * 3 + 4) % STRAND_COUNT : safeIndex(index, 0);
  next.interaction = 'pressure-armed';
  return refreshDerived(next);
}

export function registerPressure(frame, input = {}) {
  const armed = armPressure(frame, input.strandIndex);
  const event = normalizeEvent(input, armed);
  const changed = applyCut(armed, event);
  changed.memory = [...frame.memory, { ...event, resistanceAfter: changed.strands[event.strandIndex].resistance, signature: changed.signature }].slice(-MEMORY_LIMIT);
  return refreshDerived(changed);
}

export function liftLatestPressure(frame) {
  if (!frame.memory.length) return refreshDerived(clone(frame));
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releasePressures(stage = 0) {
  return buildFrame(stage, []);
}

export function defaultCue(index = 0) {
  const cues = [
    { strandIndex: 4, force: 0.82 },
    { strandIndex: 11, force: 0.76 },
    { strandIndex: 6, force: 0.9 },
    { strandIndex: 14, force: 0.8 }
  ];
  return { ...cues[index % cues.length] };
}

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[2, 0], [5, 1], [8, 2], [11, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = registerPressure(frame, defaultCue(eventStages.get(stage)));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(refreshDerived(frame));
  }
  return timeline;
}
