const WORD_LAYOUT = [
  { word: 'LISTEN', x: 11, y: 16, step: 8.6, tilt: -4 },
  { word: 'TO', x: 28, y: 46, step: 11.5, tilt: 3 },
  { word: 'THE', x: 42, y: 14, step: 8.5, tilt: -2 },
  { word: 'MISSING', x: 58, y: 11, step: 7.2, tilt: 2 },
  { word: 'LETTER', x: 82, y: 43, step: 7.2, tilt: -3 }
];

export const DEFAULT_PHONEMES = ['E', 'I', 'O', 'A'];
const MEMORY_WINDOW = 4;

function makeGlyphs() {
  return WORD_LAYOUT.flatMap((layout, wordIndex) => [...layout.word].map((char, glyphIndex) => ({
    id: `${wordIndex}-${glyphIndex}`,
    char,
    word: layout.word,
    wordIndex,
    glyphIndex,
    sourceSlot: `${wordIndex}:${glyphIndex}`,
    slot: `${wordIndex}:${glyphIndex}`,
    sourceX: layout.x,
    sourceY: layout.y + glyphIndex * layout.step,
    x: layout.x,
    y: layout.y + glyphIndex * layout.step,
    rotation: layout.tilt + ((glyphIndex % 2) ? 1.4 : -0.8),
    reply: false,
    vacant: false,
    replyRank: -1
  })));
}

function normalizePhoneme(phoneme) {
  return String(phoneme || '').trim().slice(0, 1).toUpperCase();
}

export function buildState(memory = []) {
  const normalizedMemory = memory.map(normalizePhoneme).filter(Boolean).slice(-MEMORY_WINDOW);
  const addressed = new Set(normalizedMemory);
  const glyphs = makeGlyphs();
  let replyRank = 0;

  for (const glyph of glyphs) {
    if (!addressed.has(glyph.char)) continue;
    glyph.reply = true;
    glyph.vacant = true;
    glyph.replyRank = replyRank;
    glyph.slot = `reply:${replyRank}`;
    glyph.x = 50 + ((replyRank % 3) - 1) * 3.2;
    glyph.y = 19 + Math.floor(replyRank / 3) * 7.4;
    glyph.rotation = ((replyRank % 2) ? 3 : -3) + (glyph.wordIndex % 2 ? 1 : -1);
    replyRank += 1;
  }

  const sourceHoles = glyphs
    .filter((glyph) => glyph.reply)
    .map((glyph) => ({
      id: glyph.id,
      sourceSlot: glyph.sourceSlot,
      x: glyph.sourceX,
      y: glyph.sourceY,
      char: glyph.char
    }));

  return {
    stage: normalizedMemory.length,
    memory: normalizedMemory,
    activePhoneme: normalizedMemory.at(-1) || null,
    glyphs,
    sourceHoles,
    replyCount: sourceHoles.length,
    vacancyCount: sourceHoles.length,
    memoryWindow: MEMORY_WINDOW,
    addressedPhonemes: [...addressed]
  };
}

export function buildInitialState() {
  return buildState([]);
}

export function applyAddress(state, phoneme) {
  const normalized = normalizePhoneme(phoneme);
  if (!normalized || state.memory.length >= MEMORY_WINDOW) return state;
  return buildState([...state.memory, normalized]);
}

export function removeLatestAddress(state) {
  if (!state.memory.length) return state;
  return buildState(state.memory.slice(0, -1));
}

export function buildTimeline(finalStage = DEFAULT_PHONEMES.length) {
  const timeline = [buildInitialState()];
  for (const phoneme of DEFAULT_PHONEMES.slice(0, finalStage)) {
    timeline.push(applyAddress(timeline.at(-1), phoneme));
  }
  return timeline;
}

export function signature(state) {
  return JSON.stringify({
    stage: state.stage,
    memory: state.memory,
    glyphs: state.glyphs.map(({ id, slot, x, y, rotation, reply }) => ({ id, slot, x, y, rotation, reply }))
  });
}

export const MEMORY_WINDOW_SIZE = MEMORY_WINDOW;
export const GLYPH_COUNT = makeGlyphs().length;
