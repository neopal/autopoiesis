const SEED = '0x4e413530';
export const TOKEN_COUNT = 9;
export const ATTENTION_LIMIT = 3;
export const MEMORY_LIMIT = 4;

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

const BASE_TOKENS = [
  { id: 0, word: 'the', x: 13, y: 18, rotation: -7, scale: 0.95, weight: 500 },
  { id: 1, word: 'model', x: 37, y: 13, rotation: 5, scale: 1.24, weight: 700 },
  { id: 2, word: 'misreads', x: 69, y: 23, rotation: -9, scale: 0.92, weight: 600 },
  { id: 3, word: 'an', x: 18, y: 43, rotation: 8, scale: 0.78, weight: 500 },
  { id: 4, word: 'answer', x: 49, y: 42, rotation: -3, scale: 1.42, weight: 800 },
  { id: 5, word: 'from', x: 82, y: 48, rotation: 7, scale: 0.86, weight: 500 },
  { id: 6, word: 'the', x: 28, y: 73, rotation: -7, scale: 0.9, weight: 500 },
  { id: 7, word: 'empty', x: 57, y: 72, rotation: 4, scale: 1.16, weight: 650 },
  { id: 8, word: 'room', x: 80, y: 84, rotation: -6, scale: 1.04, weight: 600 }
];
const FALSE_WORDS = ['because', 'surely', 'still', 'nothing'];

function baseToken(index) {
  return { ...BASE_TOKENS[index], falseAnswer: false, sourceId: index };
}

function boundedMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map((event, index) => ({ ...event, memoryIndex: index }));
}

function validToken(index) {
  return Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < TOKEN_COUNT;
}

function findShadow(attended, memoryIndex, order) {
  const proposal = (attended[0] * 2 + attended[1] * 3 + attended[2] + memoryIndex * 4 + order) % TOKEN_COUNT;
  for (let offset = 0; offset < TOKEN_COUNT; offset += 1) {
    const candidate = (proposal + offset) % TOKEN_COUNT;
    if (!attended.includes(candidate)) return candidate;
  }
  return (proposal + 1) % TOKEN_COUNT;
}

function materialise(memory) {
  const tokens = BASE_TOKENS.map((_, index) => baseToken(index));
  const receipts = [];

  memory.forEach((event, memoryIndex) => {
    const order = event.attended.reduce((sum, tokenId, position) => sum + tokenId * (position + 2), 0);
    const drift = 2.6 + memoryIndex * 0.85;
    const shadowIndex = findShadow(event.attended, memoryIndex, order);
    const wordShift = (order + memoryIndex * 2) % TOKEN_COUNT;

    tokens.forEach((token, index) => {
      const angle = (order + index * 0.77) * 0.31;
      const opposition = event.attended.includes(index) ? 1.55 : 1;
      token.x = round(clamp(token.x + Math.cos(angle) * drift * opposition + (index - 4) * 0.12, 5, 95));
      token.y = round(clamp(token.y + Math.sin(angle * 1.21) * drift * opposition + (memoryIndex - 1.5) * 0.23, 6, 94));
      token.rotation = round(token.rotation + Math.sin(angle * 0.8) * (3.4 + memoryIndex * 0.6) + (event.attended.includes(index) ? -2.2 : 1.1));
      token.scale = round(clamp(token.scale * (1 + Math.sin(angle + memoryIndex) * 0.025 + (event.attended.includes(index) ? 0.035 : -0.008)), 0.62, 1.65));
      token.weight = Math.round(clamp(token.weight + (event.attended.includes(index) ? 35 : -12) + Math.cos(angle) * 8, 400, 900));
      token.word = BASE_TOKENS[(index + wordShift + memoryIndex) % TOKEN_COUNT].word;
      token.falseAnswer = false;
      token.sourceId = BASE_TOKENS[(index + wordShift + memoryIndex) % TOKEN_COUNT].id;
    });

    tokens[shadowIndex].word = FALSE_WORDS[memoryIndex % FALSE_WORDS.length];
    tokens[shadowIndex].falseAnswer = true;
    tokens[shadowIndex].sourceId = null;
    receipts.push({
      shadowIndex,
      attended: [...event.attended],
      word: tokens[shadowIndex].word,
      memoryIndex
    });
  });

  return { tokens, receipts };
}

function stateFrom(memory, pending = [], interaction = 'idle') {
  const bounded = boundedMemory(memory);
  return {
    seed: SEED,
    composition: 'misattributed-attention',
    renderer: 'dom',
    interaction,
    stage: bounded.length,
    pending: [...pending],
    memory: clone(bounded),
    memoryLimit: MEMORY_LIMIT,
    attentionLimit: ATTENTION_LIMIT,
    body: materialise(bounded)
  };
}

export function buildFrame() {
  return stateFrom([]);
}

export function fieldSignature(state) {
  return JSON.stringify({ tokens: state.body.tokens, receipts: state.body.receipts });
}

export function attend(state, tokenIndex) {
  const index = Number(tokenIndex);
  if (!validToken(index)) return { accepted: false, committed: false, reason: 'invalid-token', field: stateFrom(state.memory, state.pending, 'attention-refused-invalid') };
  if (state.pending.includes(index)) return { accepted: false, committed: false, reason: 'already-attended', field: stateFrom(state.memory, state.pending, 'attention-refused-repeat') };

  const nextPending = [...state.pending, index];
  if (nextPending.length < ATTENTION_LIMIT) {
    return { accepted: true, committed: false, field: stateFrom(state.memory, nextPending, 'attention-staged') };
  }

  if (state.memory.length >= MEMORY_LIMIT) {
    return { accepted: false, committed: false, reason: 'memory-full', field: stateFrom(state.memory, [], 'attention-refused-full') };
  }

  const event = {
    kind: 'misattributed-consensus',
    attended: nextPending,
    memoryIndex: state.memory.length
  };
  const field = stateFrom([...state.memory, event], [], 'misattributed-consensus');
  const receipt = field.body.receipts.at(-1);
  return {
    accepted: true,
    committed: true,
    event: { ...clone(event), shadowIndex: receipt.shadowIndex, falseWord: receipt.word },
    field
  };
}

export function liftLatest(state) {
  return stateFrom(state.memory.slice(0, -1), [], 'lifted / exact');
}

export function releaseMemory() {
  return stateFrom([], [], 'memory-released');
}

export function buildTimeline() {
  const trios = [
    [1, 4, 7],
    [2, 6, 0],
    [8, 3, 5],
    [4, 0, 6]
  ];
  const frames = [buildFrame()];
  for (const trio of trios) {
    let current = frames.at(-1);
    for (const index of trio) current = attend(current, index).field;
    frames.push(current);
  }
  return frames;
}

export { SEED };