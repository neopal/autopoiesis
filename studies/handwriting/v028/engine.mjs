const MEMORY_LIMIT = 4;
const GLYPH_COUNT = 12;
const COUNTER_TOKENS = ['a', 'e', 'i', 'o', 'u', 'y'];

const BASE_GLYPHS = [
  { id: 0, openGlyph: 'O', closedGlyph: 'I', x: 0.20, y: 0.25, size: 0.34, rotation: -18, weight: 800, tone: 'warm' },
  { id: 1, openGlyph: 'A', closedGlyph: 'V', x: 0.43, y: 0.16, size: 0.27, rotation: 8, weight: 720, tone: 'cool' },
  { id: 2, openGlyph: 'P', closedGlyph: 'F', x: 0.69, y: 0.24, size: 0.36, rotation: 14, weight: 820, tone: 'bone' },
  { id: 3, openGlyph: 'R', closedGlyph: 'K', x: 0.84, y: 0.42, size: 0.29, rotation: -7, weight: 690, tone: 'warm', initial: 'closed' },
  { id: 4, openGlyph: 'B', closedGlyph: 'E', x: 0.68, y: 0.55, size: 0.31, rotation: 19, weight: 780, tone: 'cool' },
  { id: 5, openGlyph: 'D', closedGlyph: 'L', x: 0.42, y: 0.62, size: 0.38, rotation: -10, weight: 840, tone: 'bone', initial: 'closed' },
  { id: 6, openGlyph: 'G', closedGlyph: 'C', x: 0.18, y: 0.57, size: 0.3, rotation: -24, weight: 740, tone: 'warm' },
  { id: 7, openGlyph: 'Q', closedGlyph: 'O', x: 0.35, y: 0.39, size: 0.25, rotation: 27, weight: 650, tone: 'cool', initial: 'closed' },
  { id: 8, openGlyph: 'C', closedGlyph: 'I', x: 0.54, y: 0.34, size: 0.24, rotation: -29, weight: 640, tone: 'bone' },
  { id: 9, openGlyph: 'S', closedGlyph: 'Z', x: 0.56, y: 0.78, size: 0.28, rotation: 12, weight: 760, tone: 'warm', initial: 'closed' },
  { id: 10, openGlyph: 'E', closedGlyph: 'F', x: 0.80, y: 0.78, size: 0.22, rotation: -14, weight: 680, tone: 'cool', initial: 'closed' },
  { id: 11, openGlyph: 'U', closedGlyph: 'V', x: 0.13, y: 0.80, size: 0.26, rotation: 17, weight: 710, tone: 'bone' }
];

function clampIndex(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(GLYPH_COUNT - 1, Math.round(number)));
}

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function cloneGlyph(glyph) {
  return { ...glyph };
}

function chooseRelay(sourceIndex, targetIndex, sequence) {
  let relay = (sourceIndex * 5 + targetIndex * 3 + sequence * 2 + 1) % GLYPH_COUNT;
  if (relay === sourceIndex || relay === targetIndex) relay = (relay + 1) % GLYPH_COUNT;
  return relay;
}

function normalizeEvent(event, fallbackSequence = 1) {
  const sourceIndex = clampIndex(event?.sourceIndex);
  let targetIndex = clampIndex(event?.targetIndex);
  if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % GLYPH_COUNT;
  const sequence = Math.max(1, Math.floor(Number(event?.sequence) || fallbackSequence));
  const relayCandidate = clampIndex(event?.relayIndex);
  const relayIndex = relayCandidate === sourceIndex || relayCandidate === targetIndex
    ? chooseRelay(sourceIndex, targetIndex, sequence)
    : relayCandidate;
  return {
    sourceIndex,
    targetIndex,
    relayIndex,
    sequence,
    token: String(event?.token || COUNTER_TOKENS[(sequence - 1) % COUNTER_TOKENS.length]).slice(0, 1)
  };
}

function baseGlyphs() {
  return BASE_GLYPHS.map((glyph) => {
    const counter = glyph.initial === 'closed' ? 'closed' : 'open';
    return {
      ...cloneGlyph(glyph),
      text: counter === 'closed' ? glyph.closedGlyph : glyph.openGlyph,
      counter,
      phase: 0,
      custody: ''
    };
  });
}

function applyReply(glyphs, event, eventIndex) {
  const source = glyphs[event.sourceIndex];
  const target = glyphs[event.targetIndex];
  const relay = glyphs[event.relayIndex];
  const force = eventIndex + 1;

  source.text = source.closedGlyph;
  source.counter = 'closed';
  source.x = round(source.x - 0.014 * force);
  source.y = round(source.y + 0.01 * force);
  source.rotation = round(source.rotation + 4.2 + eventIndex * 0.7);
  source.size = round(source.size * (1 - 0.025 * force));
  source.custody += event.token;
  source.phase = round(source.phase + 0.35 * force);

  target.text = target.openGlyph;
  target.counter = 'open';
  target.x = round(target.x + 0.019 * force);
  target.y = round(target.y - 0.013 * force);
  target.rotation = round(target.rotation - 5.1 - eventIndex * 0.55);
  target.size = round(target.size * (1 + 0.022 * force));
  target.custody += event.token.toUpperCase();
  target.phase = round(target.phase - 0.28 * force);

  relay.x = round(relay.x + (relay.id < target.id ? 1 : -1) * 0.012 * force);
  relay.y = round(relay.y + (eventIndex % 2 ? 1 : -1) * 0.018 * force);
  relay.rotation = round(relay.rotation + (relay.id % 2 ? -1 : 1) * (2.6 + eventIndex * 0.4));
  relay.phase = round(relay.phase + 0.17 * force);
  relay.custody += event.token.toLowerCase();

  glyphs.forEach((glyph, index) => {
    if (index === event.sourceIndex || index === event.targetIndex || index === event.relayIndex) return;
    const distance = Math.min(Math.abs(index - event.sourceIndex), GLYPH_COUNT - Math.abs(index - event.sourceIndex));
    if (distance <= 2) {
      glyph.x = round(glyph.x + (index < event.sourceIndex ? -1 : 1) * 0.004 * force);
      glyph.rotation = round(glyph.rotation + (index % 2 ? 0.45 : -0.45) * force);
    }
  });
}

function frameFromMemory(stage, memory, replyCount = memory.length, lastEvent = 'quiet', armedSource = null) {
  const safeMemory = Array.isArray(memory)
    ? memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index + 1))
    : [];
  const glyphs = baseGlyphs();
  safeMemory.forEach((event, index) => applyReply(glyphs, event, index));
  return {
    composition: 'counter-field',
    stage: Math.max(0, Number(stage) || 0),
    glyphs,
    memory: safeMemory,
    material: {
      lastEvent,
      replyCount: Math.max(0, Math.floor(Number(replyCount) || 0)),
      custody: safeMemory.map((event) => event.token).join('').slice(-MEMORY_LIMIT),
      closedCount: glyphs.filter((glyph) => glyph.counter === 'closed').length,
      openCount: glyphs.filter((glyph) => glyph.counter === 'open').length,
      armedSource: armedSource === null ? null : clampIndex(armedSource)
    }
  };
}

function buildFrame(stage = 0, memory = []) {
  return frameFromMemory(stage, memory, Array.isArray(memory) ? memory.length : 0);
}

function armCounter(frame, { source = 0 } = {}) {
  const safeFrame = frame || buildFrame();
  return frameFromMemory(safeFrame.stage, safeFrame.memory, safeFrame.material.replyCount, 'armed', clampIndex(source));
}

function commitReply(frame, { target = 0 } = {}) {
  const safeFrame = frame || buildFrame();
  const sourceIndex = safeFrame.material.armedSource;
  const targetIndex = clampIndex(target);
  if (sourceIndex === null || targetIndex === sourceIndex) {
    return frameFromMemory(safeFrame.stage, safeFrame.memory, safeFrame.material.replyCount, 'refused', sourceIndex);
  }
  const sequence = safeFrame.material.replyCount + 1;
  const event = normalizeEvent({
    sourceIndex,
    targetIndex,
    relayIndex: chooseRelay(sourceIndex, targetIndex, sequence),
    sequence,
    token: COUNTER_TOKENS[(sequence - 1) % COUNTER_TOKENS.length]
  }, sequence);
  return frameFromMemory(safeFrame.stage + 1, [...safeFrame.memory, event], sequence, 'replied');
}

function liftLatestReply(frame) {
  const safeFrame = frame || buildFrame();
  if (safeFrame.memory.length === 0) return safeFrame;
  return frameFromMemory(
    safeFrame.stage,
    safeFrame.memory.slice(0, -1),
    Math.max(0, safeFrame.material.replyCount - 1),
    'lifted'
  );
}

function geometrySignature(frame) {
  return JSON.stringify({
    glyphs: frame.glyphs.map(({ text, x, y, size, rotation, weight, counter, phase, custody }) => ({ text, x, y, size, rotation, weight, counter, phase, custody })),
    memory: frame.memory,
    custody: frame.material.custody
  });
}

export {
  GLYPH_COUNT,
  MEMORY_LIMIT,
  armCounter,
  buildFrame,
  commitReply,
  geometrySignature,
  liftLatestReply
};
