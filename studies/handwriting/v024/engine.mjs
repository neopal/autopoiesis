export const SEED = 0x48574924;
export const STAGES = 16;
export const MEMORY_LIMIT = 4;
export const TOKEN_COUNT = 18;
export const PORT_COUNT = 9;
export const PRIMITIVE_BUDGET = 96;

const PHRASE = [
  'MATTER', 'LEARNS', 'THE', 'MARGIN', 'THE', 'NEXT', 'LETTER', 'BENDS', 'WHERE',
  'PRESSURE', 'REMAINS', 'A', 'WORD', 'IS', 'MADE', 'BY', 'WHAT', 'RESISTS'
];
const ANCHOR_WORDS = ['YIELDS', 'GATHERS', 'TURNS', 'HOLDS', 'KNOTS', 'PUSHES', 'WAITS', 'OPENS'];
const REPLY_WORDS = ['ANSWER', 'WEIGHT', 'AFTER', 'WITHIN', 'AGAIN', 'ELSEWHERE', 'THRESHOLD', 'TRACE'];
const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function safeStage(stage) {
  return Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0)));
}

function safePort(port) {
  return Math.max(0, Math.min(PORT_COUNT - 1, Math.floor(Number(port) || 0)));
}

function copyToken(token) {
  return { ...token };
}

function copyPressure(entry) {
  return { ...entry };
}

function makeTokens(stage) {
  const random = rng(SEED + stage * 4099);
  return PHRASE.map((text, index) => {
    const progress = index / (TOKEN_COUNT - 1);
    const curve = Math.sin(progress * TAU * 1.08 - 0.55);
    const counterCurve = Math.cos(progress * TAU * 1.74 + 0.8);
    return {
      id: `word-${String(index).padStart(2, '0')}`,
      index,
      text,
      originalText: text,
      x: clamp(0.5 + curve * 0.25 + (random() - 0.5) * 0.024, 0.08, 0.92),
      y: clamp(0.11 + progress * 0.78 + counterCurve * 0.018 + (random() - 0.5) * 0.012, 0.06, 0.94),
      angle: curve * 24 + (random() - 0.5) * 5,
      scale: 0.82 + random() * 0.24,
      weight: 0.72 + random() * 0.22,
      role: 'quiet',
      pressureIndex: null,
      replyTo: null,
      residue: 0
    };
  });
}

function makeMaterial() {
  return { resistance: 0, field: Array.from({ length: PORT_COUNT }, () => 0), pressureCount: 0 };
}

function chooseReplyIndex(anchorIndex, memoryLength, port, resistance) {
  let replyIndex = (anchorIndex + 5 + memoryLength * 4 + port * 2 + Math.floor(resistance * 3)) % TOKEN_COUNT;
  if (replyIndex === anchorIndex) replyIndex = (replyIndex + 1) % TOKEN_COUNT;
  return replyIndex;
}

function createPressure(frame, port) {
  const safe = safePort(port);
  const anchorIndex = (safe * 2 + frame.memory.length + Math.floor(frame.material.resistance * 2)) % TOKEN_COUNT;
  const replyIndex = chooseReplyIndex(anchorIndex, frame.memory.length, safe, frame.material.resistance);
  return {
    kind: 'pressure',
    port: safe,
    anchorIndex,
    replyIndex,
    force: Number((0.72 + safe * 0.045 + frame.memory.length * 0.09).toFixed(4)),
    resistanceBefore: Number(frame.material.resistance.toFixed(4))
  };
}

function applyPressure(tokens, material, entry, entryIndex) {
  const next = tokens.map(copyToken);
  const nextMaterial = {
    resistance: material.resistance,
    field: [...material.field],
    pressureCount: material.pressureCount
  };
  const anchor = next[entry.anchorIndex];
  const reply = next[entry.replyIndex];
  const localResidue = nextMaterial.field[entry.port];
  const intensity = 0.055 + entry.force * 0.026 + localResidue * 0.018;
  const direction = entry.port % 2 === 0 ? 1 : -1;

  next.forEach((token, index) => {
    const distance = index - entry.anchorIndex;
    const influence = Math.exp(-Math.abs(distance) / (2.6 + entryIndex * 0.22));
    const downstream = distance >= 0 ? 1 : -0.24;
    const grain = Math.sin((index + 1) * (entry.port + 2.17) + entryIndex * 1.8) * 0.012;
    token.x = clamp(token.x + direction * downstream * influence * intensity + grain * influence, 0.055, 0.945);
    token.y = clamp(token.y + Math.cos((index + entry.port) * 0.73) * influence * intensity * 0.42, 0.045, 0.955);
    token.angle += direction * downstream * influence * (8 + entry.force * 4) + grain * 24;
    token.scale = clamp(token.scale * (1 + influence * direction * 0.045), 0.64, 1.38);
    token.weight = clamp(token.weight + influence * 0.08 * direction, 0.42, 1.12);
    token.residue = Number((token.residue + influence * entry.force).toFixed(5));
    if (influence > 0.12) {
      token.role = token.role === 'quiet' ? (downstream > 0 ? 'bent' : 'settled') : token.role;
      token.pressureIndex = entryIndex;
    }
  });

  anchor.text = ANCHOR_WORDS[(entry.port + entryIndex + Math.floor(nextMaterial.resistance * 2)) % ANCHOR_WORDS.length];
  anchor.role = 'anchor';
  anchor.replyTo = entry.replyIndex;
  anchor.pressureIndex = entryIndex;
  anchor.weight = clamp(anchor.weight + 0.18, 0.55, 1.3);
  reply.text = REPLY_WORDS[(entry.replyIndex + entry.port + entryIndex + Math.floor(nextMaterial.resistance * 4)) % REPLY_WORDS.length];
  reply.role = 'reply';
  reply.replyTo = entry.anchorIndex;
  reply.pressureIndex = entryIndex;
  reply.weight = clamp(reply.weight + 0.14, 0.55, 1.3);

  nextMaterial.field[entry.port] = Number((localResidue + 0.68 + entryIndex * 0.11).toFixed(5));
  nextMaterial.field[(entry.port + 3 + entryIndex) % PORT_COUNT] = Number((nextMaterial.field[(entry.port + 3 + entryIndex) % PORT_COUNT] + 0.18).toFixed(5));
  nextMaterial.resistance = Number((nextMaterial.resistance + 0.64 + entry.force * 0.18).toFixed(5));
  nextMaterial.pressureCount += 1;
  return { tokens: next, material: nextMaterial };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyPressure).slice(-MEMORY_LIMIT) : [];
  let tokens = makeTokens(safe);
  let material = makeMaterial();
  inherited.forEach((entry, index) => {
    const applied = applyPressure(tokens, material, entry, index);
    tokens = applied.tokens;
    material = applied.material;
  });
  return {
    stage: safe,
    memory: inherited,
    tokens,
    material,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'material-sentence-field',
    interaction: 'sequence',
    restoreMemory: null
  };
}

export function commitPressure(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const entry = createPressure(baseline, input.port);
  const next = buildFrame(baseline.stage, [...baseline.memory, entry]);
  return { ...next, pressurePort: entry.port, interaction: 'pressure-committed', restoreMemory: baseline.memory.map(copyPressure) };
}

export function liftLatestPressure(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'pressure-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'pressure-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'pressure-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    material: frame.material,
    tokens: frame.tokens.map(({ id, text, x, y, angle, scale, weight, role, pressureIndex, replyTo, residue }) => ({ id, text, x, y, angle, scale, weight, role, pressureIndex, replyTo, residue }))
  });
}

export const PHRASE_WORDS = [...PHRASE];
