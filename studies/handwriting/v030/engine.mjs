const MEMORY_LIMIT = 4;
const BASE_TEXT = 'THE READER OFFERS A LETTER; THE SENTENCE ANSWERS WITH A GAP.';
const OFFER_LETTERS = ['A', 'E', 'I', 'O', 'U', 'T', 'R', 'S'];

function normalizeLetter(value) {
  const letter = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : '';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function textForState(removedLetters) {
  const removed = new Set(removedLetters);
  return BASE_TEXT
    .split('')
    .map((character) => removed.has(character.toUpperCase()) ? '' : character)
    .join('');
}

function makeGlyphs(text, removedLetters) {
  const removed = new Set(removedLetters);
  let visibleIndex = 0;
  return BASE_TEXT.split('').map((original, index) => {
    const isLetter = /^[A-Z]$/.test(original);
    const isRemoved = isLetter && removed.has(original);
    const glyph = {
      index,
      original,
      char: isRemoved ? '' : original,
      removed: isRemoved,
      visibleIndex: isRemoved ? null : visibleIndex
    };
    if (!isRemoved) visibleIndex += 1;
    return glyph;
  });
}

function eventFromMemory(memory) {
  return memory.at(-1) ?? null;
}

function frameFromMemory(memory = [], overrides = {}) {
  const safeMemory = Array.isArray(memory) ? memory.slice(-MEMORY_LIMIT).map(clone) : [];
  const last = eventFromMemory(safeMemory);
  const refusedLetters = Array.isArray(last?.refusedLetters) ? [...last.refusedLetters] : [];
  const text = typeof last?.text === 'string' ? last.text : textForState(refusedLetters);
  const acceptedCount = Number.isInteger(last?.acceptedCount) ? last.acceptedCount : 0;
  return {
    composition: 'refusal-sheet',
    stage: safeMemory.length,
    glyphs: makeGlyphs(text, refusedLetters),
    memory: safeMemory,
    material: {
      text,
      refusedLetters,
      acceptedCount,
      refusedCount: Math.max(0, Number(overrides.refusedCount ?? 0)),
      removedCount: makeGlyphs(text, refusedLetters).filter((glyph) => glyph.removed).length,
      lastEvent: overrides.lastEvent ?? (last ? 'accepted' : 'quiet'),
      offeredLetter: overrides.offeredLetter ?? last?.letter ?? null
    }
  };
}

function buildFrame(memory = []) {
  return frameFromMemory(memory);
}

function offerLetter(frame, value) {
  const safeFrame = frame || buildFrame();
  const letter = normalizeLetter(value);
  const currentRemoved = safeFrame.material.refusedLetters || [];
  const canAccept = letter && BASE_TEXT.includes(letter) && !currentRemoved.includes(letter);
  if (!canAccept) {
    return frameFromMemory(safeFrame.memory, {
      lastEvent: 'refused',
      refusedCount: (safeFrame.material.refusedCount || 0) + 1,
      offeredLetter: letter || null
    });
  }

  const refusedLetters = [...currentRemoved, letter];
  const text = textForState(refusedLetters);
  const acceptedCount = (safeFrame.material.acceptedCount || 0) + 1;
  const event = {
    sequence: acceptedCount,
    letter,
    text,
    refusedLetters,
    acceptedCount,
    removedCount: BASE_TEXT.length - text.length,
    previousText: safeFrame.material.text,
    previousRefusedLetters: [...currentRemoved]
  };
  return frameFromMemory([...safeFrame.memory, event], {
    lastEvent: 'accepted',
    offeredLetter: letter
  });
}

function liftLatest(frame) {
  const safeFrame = frame || buildFrame();
  if (!safeFrame.memory.length) return safeFrame;
  return frameFromMemory(safeFrame.memory.slice(0, -1), { lastEvent: 'lifted' });
}

function releaseFrame() {
  return buildFrame();
}

function geometrySignature(frame) {
  return JSON.stringify({
    text: frame.material.text,
    glyphs: frame.glyphs.map(({ index, char, removed, visibleIndex }) => ({ index, char, removed, visibleIndex })),
    refusedLetters: frame.material.refusedLetters
  });
}

export {
  BASE_TEXT,
  MEMORY_LIMIT,
  OFFER_LETTERS,
  buildFrame,
  geometrySignature,
  liftLatest,
  offerLetter,
  releaseFrame
};
