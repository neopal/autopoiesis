export const SEED = 0x48574923;
export const STAGES = 16;
export const MEMORY_LIMIT = 4;
export const TOKEN_COUNT = 16;
export const PRIMITIVE_BUDGET = 48;

const TAU = Math.PI * 2;
const PHRASE = ['THE', 'READER', 'MOVES', 'A', 'BREAK', 'THE', 'SENTENCE', 'KEEPS', 'THE', 'RETURN', 'IN', 'ANOTHER', 'PLACE', 'FOR', 'THE', 'UNREAD'];
const REWRITE_WORDS = ['LISTENS', 'ANSWERS', 'ARRIVES', 'REMAINS', 'RECALLS', 'WITHHOLDS'];
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

function copyToken(token) {
  return { ...token };
}

function copyReturn(entry) {
  return { ...entry, path: [...entry.path] };
}

function makeTokens(stage) {
  const random = rng(SEED + stage * 2143);
  return PHRASE.map((text, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const drift = (random() - 0.5) * 0.018;
    return {
      id: `word-${String(index).padStart(2, '0')}`,
      index,
      text,
      originalText: text,
      column,
      row,
      x: (column + 0.5) / 4 + drift,
      y: (row + 0.5) / 4 + (random() - 0.5) * 0.018,
      angle: (random() - 0.5) * 3.6,
      scale: 0.88 + random() * 0.18,
      role: 'quiet',
      replyTo: null,
      returnIndex: null
    };
  });
}

function chooseReplyIndex(anchorIndex, memory, tokenCount) {
  let candidate = (anchorIndex + 7 + memory.length * 3 + Math.floor(memory.reduce((sum, entry) => sum + entry.travel, 0))) % tokenCount;
  if (candidate === anchorIndex) candidate = (candidate + 1) % tokenCount;
  return candidate;
}

function pathData(path) {
  const safePath = Array.isArray(path)
    ? path.map((value) => clamp(Math.floor(Number(value) || 0), 0, TOKEN_COUNT - 1))
    : [];
  let travel = 0;
  let directionChanges = 0;
  let previousDirection = 0;
  for (let index = 1; index < safePath.length; index += 1) {
    const delta = safePath[index] - safePath[index - 1];
    travel += Math.abs(delta);
    const direction = Math.sign(delta);
    if (direction && previousDirection && direction !== previousDirection) directionChanges += 1;
    if (direction) previousDirection = direction;
  }
  return { safePath, travel, directionChanges };
}

function applyReturn(tokens, entry, entryIndex) {
  const next = tokens.map(copyToken);
  const anchor = next[entry.anchorIndex];
  const reply = next[entry.replyIndex];
  const anchorSlot = { column: anchor.column, row: anchor.row, x: anchor.x, y: anchor.y };
  const replySlot = { column: reply.column, row: reply.row, x: reply.x, y: reply.y };
  anchor.column = replySlot.column;
  anchor.row = replySlot.row;
  anchor.x = replySlot.x + (entryIndex % 2 ? -0.018 : 0.018);
  anchor.y = replySlot.y + 0.012;
  anchor.angle += 11 + entryIndex * 2;
  anchor.scale = clamp(anchor.scale * 1.08, 0.68, 1.3);
  anchor.role = 'turn';
  anchor.replyTo = entry.replyIndex;
  anchor.returnIndex = entryIndex;

  reply.column = anchorSlot.column;
  reply.row = anchorSlot.row;
  reply.x = anchorSlot.x + (entryIndex % 2 ? 0.022 : -0.022);
  reply.y = anchorSlot.y - 0.016;
  reply.angle -= 14 + entryIndex * 2;
  reply.scale = clamp(reply.scale * 1.12, 0.7, 1.34);
  reply.text = REWRITE_WORDS[(entry.replyIndex + entryIndex) % REWRITE_WORDS.length];
  reply.role = 'reply';
  reply.replyTo = entry.anchorIndex;
  reply.returnIndex = entryIndex;

  next.forEach((token, index) => {
    if (index === entry.anchorIndex || index === entry.replyIndex) return;
    const sameBand = token.column === anchorSlot.column || token.column === replySlot.column;
    if (!sameBand) return;
    const direction = index < entry.anchorIndex ? -1 : 1;
    token.y = clamp(token.y + direction * (0.008 + entryIndex * 0.002), 0.06, 0.94);
    token.angle += direction * 1.5;
    token.role = token.role === 'quiet' ? 'shifted' : token.role;
    token.returnIndex = entryIndex;
  });
  return next;
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0)));
  const inherited = Array.isArray(memory) ? memory.map(copyReturn).slice(-MEMORY_LIMIT) : [];
  let tokens = makeTokens(safeStage);
  inherited.forEach((entry, index) => {
    tokens = applyReturn(tokens, entry, index);
  });
  return {
    stage: safeStage,
    readingCursor: (safeStage * 2) % TOKEN_COUNT,
    memory: inherited,
    tokens,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'reading-fold',
    interaction: 'sequence',
    restoreMemory: null
  };
}

export function commitReadingReturn(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const { safePath, travel, directionChanges } = pathData(input.path);
  if (safePath.length < 2 || travel < 3 || directionChanges < 1) {
    return { ...baseline, readingPath: safePath, interaction: 'return-refused', refusal: 'no-reading-return' };
  }
  const anchorIndex = safePath[0];
  const replyIndex = chooseReplyIndex(anchorIndex, baseline.memory, baseline.tokens.length);
  const entry = {
    kind: 'reading-return',
    anchorIndex,
    replyIndex,
    path: safePath,
    travel,
    directionChanges,
    lineShift: (replyIndex - anchorIndex + baseline.tokens.length) % baseline.tokens.length
  };
  const next = buildFrame(baseline.stage, [...baseline.memory, entry]);
  return { ...next, readingPath: safePath, interaction: 'return-committed', restoreMemory: baseline.memory.map(copyReturn) };
}

export function liftLatestReturn(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'return-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'return-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'return-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    readingCursor: frame.readingCursor,
    memory: frame.memory,
    tokens: frame.tokens.map(({ id, text, column, row, x, y, angle, scale, role, replyTo, returnIndex }) => ({ id, text, column, row, x, y, angle, scale, role, replyTo, returnIndex }))
  });
}

export function buildTimeline(stageCount = STAGES) {
  const count = Math.min(STAGES, Math.max(1, Math.floor(Number(stageCount) || 1)));
  return Array.from({ length: count }, (_, stage) => buildFrame(stage, []));
}

export const PHRASE_WORDS = [...PHRASE];
