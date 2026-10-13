export const SEED = 0x534f5256;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const MARK_COUNT = 15;
export const PRIMITIVE_BUDGET = 45;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));

const LAYOUT = [
  [-0.76, -0.66], [-0.22, -0.77], [0.34, -0.7], [0.78, -0.54],
  [-0.88, -0.14], [-0.38, -0.23], [0.12, -0.1], [0.62, -0.2], [0.91, 0.08],
  [-0.73, 0.38], [-0.18, 0.47], [0.34, 0.4], [0.78, 0.52],
  [-0.42, 0.77], [0.2, 0.76]
];

const GLYPHS = ['bar', 'split', 'hook', 'hinge', 'fork'];

function seeded(index, stage = 0) {
  const value = Math.sin((index + 1) * 12.9898 + (stage + 1) * 78.233 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function baseMark(index, stage) {
  return {
    index,
    x: LAYOUT[index][0] + (seeded(index, stage) - 0.5) * 0.045,
    y: LAYOUT[index][1] + (seeded(index + 21, stage) - 0.5) * 0.04,
    width: 0.17 + seeded(index + 42, stage) * 0.065,
    height: 0.16 + seeded(index + 63, stage) * 0.08,
    tilt: (seeded(index + 84, stage) - 0.5) * 0.24,
    scale: 0.9 + seeded(index + 105, stage) * 0.16,
    skew: (seeded(index + 126, stage) - 0.5) * 0.18,
    cut: 0,
    bridge: 0,
    debt: 0,
    glyph: GLYPHS[(index + stage) % GLYPHS.length],
    state: 'quiet'
  };
}

function baseFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, STAGES - 1);
  return {
    composition: 'semantic-witness-field',
    stage: safeStage,
    marks: Array.from({ length: MARK_COUNT }, (_, index) => baseMark(index, safeStage)),
    exposure: Array.from({ length: MARK_COUNT }, () => 0),
    memory: [],
    elections: [],
    pendingIndex: null,
    interaction: 'sequence',
    fieldBias: { x: 0, y: 0 }
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    fieldBias: [Number(frame.fieldBias.x.toFixed(5)), Number(frame.fieldBias.y.toFixed(5))],
    marks: frame.marks.map((mark) => [
      mark.index,
      Number(mark.x.toFixed(5)),
      Number(mark.y.toFixed(5)),
      Number(mark.width.toFixed(5)),
      Number(mark.height.toFixed(5)),
      Number(mark.tilt.toFixed(5)),
      Number(mark.scale.toFixed(5)),
      Number(mark.skew.toFixed(5)),
      Number(mark.cut.toFixed(5)),
      Number(mark.bridge.toFixed(5)),
      Number(mark.debt.toFixed(5)),
      mark.glyph,
      mark.state
    ])
  });
}

function validIndex(value) {
  return clamp(integer(value), 0, MARK_COUNT - 1);
}

export function armWitness(frame, index = 0) {
  const next = clone(frame);
  const selected = validIndex(index);
  next.pendingIndex = selected;
  next.exposure[selected] += 1;
  next.interaction = 'witness-armed';
  return next;
}

function chooseAbsence(frame, witnessIndex) {
  return frame.marks
    .map((mark) => ({
      index: mark.index,
      score: frame.exposure[mark.index] + mark.debt * 1.9 + (mark.state === 'absent' ? 0.82 : 0) + Math.abs(mark.x * frame.fieldBias.x + mark.y * frame.fieldBias.y) * 0.24
    }))
    .filter((entry) => entry.index !== witnessIndex)
    .sort((a, b) => a.score - b.score || a.index - b.index)[0]?.index ?? ((witnessIndex + 1) % MARK_COUNT);
}

function chooseReply(frame, witnessIndex, absenceIndex) {
  const candidates = frame.marks
    .map((mark) => ({ index: mark.index, score: frame.exposure[mark.index] + mark.bridge * 0.4 + mark.debt * 0.12 }))
    .filter((entry) => entry.index !== absenceIndex && entry.index !== witnessIndex)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]?.index ?? ((absenceIndex + 3) % MARK_COUNT);
}

function chooseCounter(witnessIndex, absenceIndex, replyIndex, memoryLength) {
  let counter = (absenceIndex + 5 + memoryLength * 2 + witnessIndex) % MARK_COUNT;
  if (counter === witnessIndex || counter === absenceIndex || counter === replyIndex) counter = (counter + 4) % MARK_COUNT;
  if (counter === witnessIndex || counter === absenceIndex || counter === replyIndex) counter = (counter + 3) % MARK_COUNT;
  return counter;
}

function commit(frame) {
  const next = clone(frame);
  const witnessIndex = validIndex(frame.pendingIndex ?? 0);
  const absenceIndex = chooseAbsence(frame, witnessIndex);
  const replyIndex = chooseReply(frame, witnessIndex, absenceIndex);
  const counterIndex = chooseCounter(witnessIndex, absenceIndex, replyIndex, frame.memory.length);
  const witnessMark = next.marks[witnessIndex];
  const absence = next.marks[absenceIndex];
  const reply = next.marks[replyIndex];
  const counter = next.marks[counterIndex];
  const exposureBefore = frame.exposure.slice();
  const pressure = clamp(0.22 + frame.exposure[witnessIndex] * 0.08 + frame.memory.length * 0.045, 0.22, 0.78);

  absence.cut = clamp(absence.cut + 0.32 + pressure * 0.42, 0, 0.96);
  absence.scale = clamp(absence.scale * (0.88 - pressure * 0.04), 0.64, 1.14);
  absence.height = clamp(absence.height * (0.84 - pressure * 0.04), 0.08, 0.32);
  absence.tilt += 0.16 + pressure * 0.12;
  absence.skew -= 0.12 + pressure * 0.08;
  absence.debt += 0.6 + pressure;
  absence.glyph = GLYPHS[(GLYPHS.indexOf(absence.glyph) + 2) % GLYPHS.length];
  absence.state = 'absent';

  reply.bridge = clamp(reply.bridge + 0.34 + pressure * 0.28, 0, 1.2);
  reply.width = clamp(reply.width + 0.032 + pressure * 0.02, 0.13, 0.34);
  reply.scale = clamp(reply.scale + 0.08 + pressure * 0.06, 0.8, 1.38);
  reply.tilt -= 0.18 + pressure * 0.08;
  reply.skew += 0.16;
  reply.glyph = GLYPHS[(GLYPHS.indexOf(reply.glyph) + 1) % GLYPHS.length];
  reply.state = 'reply';

  counter.cut = clamp(counter.cut + 0.12 + pressure * 0.18, 0, 0.62);
  counter.bridge = clamp(counter.bridge + 0.18 + pressure * 0.14, 0, 0.72);
  counter.x += Math.sin(counter.index + frame.memory.length * 0.8) * (0.018 + pressure * 0.018);
  counter.y -= 0.018 + pressure * 0.022;
  counter.tilt += 0.12;
  counter.state = 'counter';

  witnessMark.debt += 0.08;
  witnessMark.state = 'witnessed';
  next.exposure[witnessIndex] += 1;
  next.fieldBias = {
    x: clamp(frame.fieldBias.x * 0.68 + (reply.x - absence.x) * 0.22, -1, 1),
    y: clamp(frame.fieldBias.y * 0.68 + (reply.y - absence.y) * 0.22, -1, 1)
  };
  const event = {
    id: `visitor-witness-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'visitor-witness',
    kind: 'absence-election',
    witnessIndex,
    absenceIndex,
    replyIndex,
    counterIndex,
    pressure: Number(pressure.toFixed(6)),
    exposureBefore,
    exposureAfter: next.exposure.slice(),
    reason: 'situated attention is not answered locally; the portrait elects an unseen mark to become absent and distributes the reply'
  };
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.elections = [...frame.elections, event].slice(-MEMORY_LIMIT);
  next.pendingIndex = null;
  next.interaction = 'absence-election';
  event.signature = geometrySignature(next);
  return next;
}

export function commitWitness(frame) {
  if (frame.pendingIndex === null || frame.pendingIndex === undefined) {
    const refused = clone(frame);
    refused.interaction = 'witness-refused';
    return refused;
  }
  return commit(frame);
}

export function buildFrame(stage = 0, memory = []) {
  let frame = baseFrame(stage);
  for (const event of clone(memory).slice(-MEMORY_LIMIT)) {
    frame.exposure = Array.isArray(event.exposureBefore) ? event.exposureBefore.slice() : frame.exposure;
    frame.pendingIndex = validIndex(event.witnessIndex);
    frame = commitWitness(frame);
  }
  frame.interaction = 'sequence';
  frame.pendingIndex = null;
  return frame;
}

export function liftLatestWitness(frame) {
  if (!frame.memory.length) {
    const untouched = clone(frame);
    untouched.pendingIndex = null;
    untouched.interaction = 'witness-lifted';
    return untouched;
  }
  const restored = buildFrame(frame.stage, frame.memory.slice(0, -1));
  restored.interaction = 'witness-lifted';
  return restored;
}

export function releaseAttention(stage = 0) {
  const released = buildFrame(stage, []);
  released.interaction = 'attention-released';
  return released;
}

const CUES = [2, 9, 5, 12];

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[3, 0], [7, 1], [11, 2], [15, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = commitWitness(armWitness(frame, CUES[eventStages.get(stage)]));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(frame);
  }
  return timeline;
}
