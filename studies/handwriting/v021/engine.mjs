export const SEED = 0x48574921;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 96;

const PHRASE = 'THE SENTENCE LOOKS BACK';
const GLYPH_CHARS = [...PHRASE].filter((char) => char !== ' ');
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const TAU = Math.PI * 2;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyGlance(glance) {
  return { ...glance };
}

function copyGlyph(glyph) {
  return { ...glyph };
}

function project(glyph) {
  const orbitScale = 1 + glyph.depth * 0.08;
  return {
    ...glyph,
    x: 0.5 + Math.cos(glyph.theta) * glyph.orbit * orbitScale,
    y: 0.5 + Math.sin(glyph.theta) * glyph.orbit * 0.66 * orbitScale
  };
}

function makeGlyphs(stage) {
  const random = rng(SEED + stage * 1931);
  return GLYPH_CHARS.map((char, index) => {
    const orbit = index % 3;
    const countOnOrbit = Math.ceil(GLYPH_CHARS.length / 3);
    const slot = Math.floor(index / 3);
    const theta = -Math.PI / 2 + (slot / countOnOrbit) * TAU + orbit * 0.11 + (random() - 0.5) * 0.06;
    const depth = Math.sin(theta * 1.7 + orbit * 1.9 + stage * 0.06) * 0.8;
    return project({
      id: `${orbit}-${slot}`,
      char,
      orbit,
      slot,
      theta,
      orbitBase: 0.24 + orbit * 0.105,
      orbit: 0.24 + orbit * 0.105,
      depth,
      angle: theta + Math.PI / 2 + (random() - 0.5) * 0.08,
      scaleX: 0.88 + random() * 0.2,
      scaleY: 0.9 + random() * 0.18,
      weight: 0.24 + random() * 0.76,
      facing: 0,
      replyTo: null,
      role: 'quiet'
    });
  });
}

function applyGlance(glyphs, glance, glanceIndex) {
  const selected = glance.witnessIndex;
  const reply = glance.replyIndex;
  const direction = glance.direction >= 0 ? 1 : -1;
  const localLoad = glance.load * (1 + glanceIndex * 0.1);
  return glyphs.map((glyph, index) => {
    if (index === selected) {
      return project({
        ...glyph,
        theta: glyph.theta + direction * (0.055 + localLoad * 0.028),
        orbit: glyph.orbit + 0.014 + localLoad * 0.012,
        angle: glyph.angle + direction * (0.22 + localLoad * 0.16),
        scaleX: clamp(glyph.scaleX * (1 - localLoad * 0.045), 0.58, 1.24),
        scaleY: clamp(glyph.scaleY * (1 + localLoad * 0.08), 0.68, 1.42),
        facing: glyph.facing + direction * (0.44 + localLoad * 0.2),
        replyTo: reply,
        role: 'witness'
      });
    }
    if (index === reply) {
      return project({
        ...glyph,
        theta: glyph.theta - direction * (0.08 + localLoad * 0.034),
        orbit: glyph.orbit + 0.02 + localLoad * 0.016,
        angle: glyph.angle - direction * (0.3 + localLoad * 0.18),
        scaleX: clamp(glyph.scaleX * (1 + localLoad * 0.075), 0.58, 1.34),
        scaleY: clamp(glyph.scaleY * (1 - localLoad * 0.05), 0.66, 1.38),
        facing: glyph.facing - direction * (0.58 + localLoad * 0.22),
        replyTo: selected,
        role: 'reply'
      });
    }
    const between = Math.abs(index - selected) / Math.max(1, glyphs.length - 1);
    if (between < 0.28) {
      return project({
        ...glyph,
        theta: glyph.theta + direction * (0.012 + localLoad * 0.008) * (0.28 - between),
        angle: glyph.angle + direction * 0.035 * (0.28 - between),
        role: glyph.role === 'quiet' ? 'listening' : glyph.role
      });
    }
    return glyph;
  });
}

function baseFrame(stage) {
  return {
    stage,
    memory: [],
    glyphs: makeGlyphs(stage),
    armedIndex: null,
    attentionDebt: 0,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'orbital-sentence-listening-void'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyGlance).slice(-MEMORY_LIMIT) : [];
  let glyphs = makeGlyphs(safeStage);
  let attentionDebt = 0;
  inherited.forEach((glance, index) => {
    attentionDebt += glance.load * (0.72 + index * 0.12);
    glyphs = applyGlance(glyphs, glance, index);
  });
  return {
    stage: safeStage,
    memory: inherited,
    glyphs,
    armedIndex: null,
    attentionDebt,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'orbital-sentence-listening-void'
  };
}

export function armWitness(frame, witnessIndex) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const safeIndex = clamp(Math.floor(Number(witnessIndex) || 0), 0, baseline.glyphs.length - 1);
  return { ...baseline, armedIndex: safeIndex, interaction: 'witness-armed' };
}

function chooseReplyIndex(witnessIndex, memory, glyphCount) {
  const shift = 5 + memory.length * 4 + Math.floor(memory.reduce((sum, glance) => sum + glance.load, 0) * 3);
  let reply = (witnessIndex + shift) % glyphCount;
  if (reply === witnessIndex) reply = (reply + 1) % glyphCount;
  return reply;
}

export function commitWitness(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const witnessIndex = clamp(Math.floor(Number(input.witnessIndex ?? frame.armedIndex ?? 0) || 0), 0, baseline.glyphs.length - 1);
  const direction = Number(input.direction) >= 0 ? 1 : -1;
  const dwell = clamp(Number(input.dwell) || 0, 0, 4000);
  const replyIndex = chooseReplyIndex(witnessIndex, baseline.memory, baseline.glyphs.length);
  const glance = {
    kind: 'reciprocal-glance',
    witnessIndex,
    replyIndex,
    direction,
    dwell,
    load: clamp(0.42 + dwell / 1700 + baseline.attentionDebt * 0.08, 0.42, 1.55)
  };
  const next = buildFrame(baseline.stage, [...baseline.memory, glance]);
  return { ...next, interaction: 'witness-committed', restoreMemory: baseline.memory.map(copyGlance) };
}

export function liftLatestWitness(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'witness-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'witness-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'witness-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    attentionDebt: frame.attentionDebt,
    glyphs: frame.glyphs.map(({ id, char, orbit, slot, theta, orbitBase, depth, angle, scaleX, scaleY, facing, replyTo, role }) => ({ id, char, orbit, slot, theta, orbitBase, depth, angle, scaleX, scaleY, facing, replyTo, role }))
  });
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1) {
      const witnessIndex = (stage * 3 + 4) % GLYPH_CHARS.length;
      const next = commitWitness(frame, { witnessIndex, direction: stage % 2 ? -1 : 1, dwell: 420 + stage * 28 });
      memory = next.memory;
    }
    return frame;
  });
}

export const GLYPH_COUNT = GLYPH_CHARS.length;
export const WORDS = PHRASE.split(' ');
