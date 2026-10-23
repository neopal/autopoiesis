const SEED = '0x4e413333';
const GLYPH_COUNT = 12;
const TOKEN_COUNT = 6;
const WITNESS_LENGTH = 3;
const MEMORY_WINDOW = 4;

const BASE_GLYPHS = [
  { x: -0.92, y: 0.02, shape: 0, scale: 0.92, slant: -0.08, gap: 0.12, ink: 0.94 },
  { x: -0.76, y: -0.04, shape: 3, scale: 0.82, slant: 0.12, gap: 0.16, ink: 0.88 },
  { x: -0.59, y: 0.06, shape: 1, scale: 1.04, slant: -0.16, gap: 0.09, ink: 0.97 },
  { x: -0.42, y: -0.01, shape: 4, scale: 0.76, slant: 0.06, gap: 0.2, ink: 0.82 },
  { x: -0.25, y: 0.04, shape: 2, scale: 0.9, slant: -0.04, gap: 0.13, ink: 0.92 },
  { x: -0.08, y: -0.06, shape: 5, scale: 0.8, slant: 0.18, gap: 0.1, ink: 0.9 },
  { x: 0.09, y: 0.02, shape: 2, scale: 1.02, slant: -0.14, gap: 0.15, ink: 0.96 },
  { x: 0.26, y: 0.05, shape: 0, scale: 0.78, slant: 0.1, gap: 0.22, ink: 0.84 },
  { x: 0.43, y: -0.03, shape: 4, scale: 0.94, slant: -0.12, gap: 0.08, ink: 0.95 },
  { x: 0.6, y: 0.04, shape: 1, scale: 0.86, slant: 0.04, gap: 0.18, ink: 0.9 },
  { x: 0.77, y: -0.05, shape: 5, scale: 0.98, slant: -0.2, gap: 0.14, ink: 0.93 },
  { x: 0.93, y: 0.02, shape: 3, scale: 0.75, slant: 0.14, gap: 0.2, ink: 0.86 }
];

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const asInt = (value, fallback = -1) => Number.isInteger(Number(value)) ? Math.trunc(Number(value)) : fallback;

function makeGlyphs() {
  return BASE_GLYPHS.map((base, id) => ({
    id,
    kind: 'invented-glyph',
    state: 'quiet',
    ...base,
    x: round(base.x),
    y: round(base.y),
    shape: base.shape,
    scale: round(base.scale),
    slant: round(base.slant),
    gap: round(base.gap),
    ink: round(base.ink)
  }));
}

function nextOutside(values, start) {
  let value = ((start % GLYPH_COUNT) + GLYPH_COUNT) % GLYPH_COUNT;
  while (values.includes(value)) value = (value + 1) % GLYPH_COUNT;
  return value;
}

function targetsFor(witness, memoryIndex) {
  const source = nextOutside(witness, witness[0] * 2 + witness[1] + memoryIndex + 2);
  const echo = nextOutside([...witness, source], source + witness[2] + 3);
  const blank = nextOutside([...witness, source, echo], echo + witness[0] + 4);
  const anchor = nextOutside([...witness, source, echo, blank], blank + memoryIndex + 5);
  return { source, echo, blank, anchor };
}

function applyEvent(glyphs, event) {
  const baseSource = BASE_GLYPHS[event.source];
  const baseEcho = BASE_GLYPHS[event.echo];
  const source = glyphs[event.source];
  const echo = glyphs[event.echo];
  const blank = glyphs[event.blank];
  const anchor = glyphs[event.anchor];
  const pressure = event.memoryIndex * 0.025;

  source.state = 'misheard';
  source.shape = (baseSource.shape + 2 + event.witness[0]) % TOKEN_COUNT;
  source.y = round(baseSource.y + 0.12 + pressure);
  source.scale = round(baseSource.scale * (0.9 - event.memoryIndex * 0.02));
  source.slant = round(baseSource.slant - 0.26);
  source.gap = round(clamp(baseSource.gap + 0.12, 0.04, 0.6));
  source.ink = round(clamp(baseSource.ink - 0.2, 0.35, 1));

  echo.state = 'echo';
  echo.shape = baseSource.shape;
  echo.y = round(baseEcho.y - 0.11 - pressure);
  echo.scale = round(baseEcho.scale * 1.12);
  echo.slant = round(baseEcho.slant + 0.22);
  echo.gap = round(clamp(baseEcho.gap - 0.04, 0.03, 0.6));
  echo.ink = round(clamp(baseEcho.ink + 0.04, 0.35, 1));

  blank.state = 'blank';
  blank.shape = (baseEcho.shape + 5) % TOKEN_COUNT;
  blank.y = round(baseGlyphsY(event.blank) + 0.02);
  blank.scale = round(baseEcho.scale * 0.74);
  blank.slant = round(baseEcho.slant - 0.18);
  blank.gap = round(clamp(baseEcho.gap + 0.36 + event.memoryIndex * 0.03, 0.2, 0.95));
  blank.ink = 0;

  anchor.state = 'witness';
  anchor.y = round(anchor.y + (anchor.id % 2 ? -0.08 : 0.08));
  anchor.scale = round(clamp(anchor.scale * 0.92, 0.4, 1.2));
  anchor.slant = round(anchor.slant + (anchor.id % 2 ? 0.16 : -0.16));
}

function baseGlyphsY(index) {
  return BASE_GLYPHS[index]?.y ?? 0;
}

function buildSurface(memory) {
  const glyphs = makeGlyphs();
  const lineBreaks = [];
  memory.slice(-MEMORY_WINDOW).forEach((event, index) => {
    applyEvent(glyphs, event);
    lineBreaks.push({
      at: event.blank,
      x: round(BASE_GLYPHS[event.blank].x + 0.015 * index),
      width: round(0.055 + index * 0.012),
      lean: round(-0.18 + index * 0.07)
    });
  });
  return { glyphs, lineBreaks };
}

function makeState(stage, memory, interaction = 'idle', pending = [], previousMemory = null, previousStage = null) {
  const bounded = memory.slice(-MEMORY_WINDOW);
  const surface = buildSurface(bounded);
  return {
    seed: SEED,
    grammar: 'misheard-proof',
    stage: clamp(asInt(stage, 0), 0, MEMORY_WINDOW),
    memory: bounded,
    pending: pending.slice(0, WITNESS_LENGTH),
    previousMemory,
    previousStage,
    surface: 'single-proof-sheet',
    glyphs: surface.glyphs,
    lineBreaks: surface.lineBreaks,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return makeState(stage, memory, 'idle');
}

export function witnessIsValid(witness = []) {
  return Array.isArray(witness)
    && witness.length === WITNESS_LENGTH
    && witness.every((value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < TOKEN_COUNT)
    && new Set(witness.map(Number)).size === WITNESS_LENGTH;
}

export function armToken(state, input = {}) {
  const token = asInt(input.token);
  if (token < 0 || token >= TOKEN_COUNT || state.pending.length >= WITNESS_LENGTH) {
    return makeState(state.stage, state.memory, 'token-refused', state.pending, state.previousMemory, state.previousStage);
  }
  return makeState(state.stage, state.memory, 'token-armed', [...state.pending, token], state.previousMemory, state.previousStage);
}

export function commitWitness(state) {
  if (!witnessIsValid(state.pending)) {
    return makeState(state.stage, state.memory, 'witness-refused', state.pending, state.previousMemory, state.previousStage);
  }
  const witness = state.pending.map(Number);
  const targets = targetsFor(witness, state.memory.length);
  const event = {
    kind: 'misheard-proof',
    witness,
    ...targets,
    memoryIndex: state.memory.length
  };
  return makeState(state.stage + 1, [...state.memory, event], 'witness-committed', [], state.memory, state.stage);
}

export function liftLatestWitness(state) {
  if (!state.memory.length) return makeState(state.stage, [], 'witness-lifted');
  const previousMemory = state.previousMemory ?? state.memory.slice(0, -1);
  const previousStage = state.previousStage ?? Math.max(0, state.stage - 1);
  return makeState(previousStage, previousMemory, 'witness-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], 'memory-released');
}

export function geometrySignature(value) {
  const glyphs = value.glyphs ?? value.surface?.glyphs ?? [];
  const lineBreaks = value.lineBreaks ?? value.surface?.lineBreaks ?? [];
  return [
    glyphs.map((glyph) => [
      glyph.id, glyph.state, glyph.shape, round(glyph.x), round(glyph.y), round(glyph.scale),
      round(glyph.slant), round(glyph.gap), round(glyph.ink)
    ].join(':')).join('|'),
    lineBreaks.map((line) => [line.at, round(line.x), round(line.width), round(line.lean)].join(':')).join('|')
  ].join('||');
}

export function buildTimeline() {
  return [
    [1, 4, 2],
    [0, 3, 5],
    [2, 5, 1],
    [4, 0, 3]
  ];
}

export { SEED, GLYPH_COUNT, TOKEN_COUNT, WITNESS_LENGTH, MEMORY_WINDOW }; 
