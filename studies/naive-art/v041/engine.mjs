const SEED = '0x4e413431';
const TOKEN_COUNT = 13;
const MEMORY_WINDOW = 4;
const MIN_SEPARATION = 0.24;

const WORDS = ['THE', 'MODEL', 'KEEPS', 'THE', 'WRONG', 'WORD', 'AFTER', 'THE', 'VOICE', 'HAS', 'LEFT', 'THE', 'ROOM'];
const MISHEARD = ['THEN', 'MODE', 'KNOT', 'THAT', 'WORN', 'WORLD', 'ALTER', 'THEM', 'CHOICE', 'WAS', 'LIFT', 'THEN', 'ROAM'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const validToken = (value) => Number.isInteger(value) && value >= 0 && value < TOKEN_COUNT;

const LAYOUT = [
  [0.16, 0.19, 0.115, -4, 0.02],
  [0.37, 0.16, 0.16, 3, -0.01],
  [0.73, 0.21, 0.13, -2, 0.035],
  [0.17, 0.36, 0.095, 5, -0.02],
  [0.48, 0.34, 0.18, -5, 0.015],
  [0.79, 0.38, 0.12, 4, -0.035],
  [0.18, 0.56, 0.14, 2, 0.01],
  [0.42, 0.56, 0.105, -4, -0.018],
  [0.68, 0.55, 0.17, 3, 0.028],
  [0.25, 0.72, 0.125, -6, -0.025],
  [0.54, 0.73, 0.11, 5, 0.018],
  [0.81, 0.71, 0.135, -3, -0.012],
  [0.43, 0.88, 0.1, 2, 0.03]
];

function baseToken(index) {
  const [x, y, size, rotate, drift] = LAYOUT[index];
  return {
    id: index,
    parts: [WORDS[index]],
    x,
    y,
    size,
    rotate,
    tracking: round(drift),
    weight: index % 4 === 1 ? 700 : index % 3 === 0 ? 500 : 400,
    tone: index % 5,
    role: 'quiet',
    echo: '',
    opacity: 1
  };
}

const BASE_TOKENS = Array.from({ length: TOKEN_COUNT }, (_, index) => baseToken(index));

function distanceBetween(a, b) {
  return Math.abs(a - b) / (TOKEN_COUNT - 1);
}

function tokenSignature(token) {
  return [
    token.id,
    token.parts.join('|'),
    round(token.x),
    round(token.y),
    round(token.size),
    round(token.rotate),
    round(token.tracking),
    token.weight,
    token.tone,
    token.role,
    token.echo,
    round(token.opacity)
  ].join(':');
}

function geometrySignature(state) {
  return state.scene.tokens.map(tokenSignature).join('|');
}

function chooseRemote(source, reply, memoryIndex, offset, used) {
  let candidate = (source * 5 + reply * 3 + memoryIndex * 7 + offset) % TOKEN_COUNT;
  for (let attempt = 0; attempt < TOKEN_COUNT; attempt += 1) {
    if (!used.has(candidate) && distanceBetween(candidate, source) >= 0.2 && distanceBetween(candidate, reply) >= 0.2) return candidate;
    candidate = (candidate + 3) % TOKEN_COUNT;
  }
  return Array.from({ length: TOKEN_COUNT }, (_, index) => index).find((index) => !used.has(index)) ?? 0;
}

function eventFor(source, reply, memoryIndex) {
  const used = new Set([source, reply]);
  const misheard = chooseRemote(source, reply, memoryIndex, 2, used);
  used.add(misheard);
  const split = chooseRemote(source, reply, memoryIndex, 6, used);
  used.add(split);
  const echo = chooseRemote(source, reply, memoryIndex, 10, used);
  return {
    kind: 'misheard-relation',
    source,
    reply,
    misheard,
    split,
    echo,
    distance: round(distanceBetween(source, reply)),
    memoryIndex
  };
}

function applyEvent(tokens, event) {
  const source = tokens[event.source];
  const reply = tokens[event.reply];
  const misheard = tokens[event.misheard];
  const split = tokens[event.split];
  const echo = tokens[event.echo];

  // The two witnessed words remain exact. The naive model spends their relation elsewhere.
  misheard.role = 'misheard';
  misheard.parts = [MISHEARD[(event.reply + event.memoryIndex) % MISHEARD.length]];
  misheard.x = round(clamp(misheard.x + 0.025 + event.memoryIndex * 0.012, 0.04, 0.9));
  misheard.y = round(clamp(misheard.y - 0.018 + event.memoryIndex * 0.008, 0.08, 0.92));
  misheard.size = round(clamp(misheard.size + 0.018, 0.075, 0.21));
  misheard.rotate = round(misheard.rotate + 8 + event.memoryIndex * 1.4);
  misheard.tracking = round(misheard.tracking + 0.045);
  misheard.tone = (source.tone + 2 + event.memoryIndex) % 5;

  split.role = 'split';
  split.parts = [WORDS[split.id], '·', MISHEARD[(source + event.memoryIndex + 3) % MISHEARD.length]];
  split.x = round(clamp(split.x - 0.018 - event.memoryIndex * 0.009, 0.04, 0.9));
  split.y = round(clamp(split.y + 0.024, 0.08, 0.94));
  split.size = round(clamp(split.size - 0.012, 0.07, 0.2));
  split.rotate = round(split.rotate - 11 - event.memoryIndex * 1.2);
  split.tracking = round(split.tracking - 0.025);
  split.tone = (reply.tone + 4 + event.memoryIndex) % 5;

  echo.role = 'echo';
  echo.echo = source.parts[0];
  echo.parts = [WORDS[echo.id]];
  echo.x = round(clamp(echo.x + (event.memoryIndex % 2 ? -0.034 : 0.034), 0.03, 0.92));
  echo.y = round(clamp(echo.y + 0.016, 0.08, 0.94));
  echo.size = round(clamp(echo.size + 0.006, 0.07, 0.2));
  echo.rotate = round(echo.rotate + (event.memoryIndex % 2 ? -5 : 5));
  echo.opacity = round(Math.max(0.58, echo.opacity - 0.06));
  echo.tone = (echo.tone + 1 + event.memoryIndex) % 5;
}

function materialise(memory) {
  const tokens = BASE_TOKENS.map((token) => ({ ...token, parts: [...token.parts] }));
  for (const event of memory.slice(-MEMORY_WINDOW)) applyEvent(tokens, event);
  const changedTokenCount = tokens.reduce((count, token, index) => count + (tokenSignature(token) === tokenSignature(BASE_TOKENS[index]) ? 0 : 1), 0);
  return {
    tokens,
    trace: {
      memoryCount: memory.length,
      changedTokenCount,
      lastSource: memory.at(-1)?.source ?? null,
      lastReply: memory.at(-1)?.reply ?? null,
      generation: memory.length
    },
    tokenCount: TOKEN_COUNT
  };
}

function stateFrom(memory, interaction = 'idle', pending = null) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'misheard-sentence',
    surface: 'browser-native-typographic-field',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    pending: pending ? { source: pending.source } : null,
    interaction,
    scene: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }
export { tokenSignature };
export { geometrySignature };

export function beginWitness(state, { token } = {}) {
  if (!validToken(token)) return stateFrom(state.memory, 'witness-refused-invalid', state.pending);
  return stateFrom(state.memory, 'witness-armed', { source: token });
}

export function commitWitness(state, { source, reply } = {}) {
  const selected = source ?? state.pending?.source;
  if (!validToken(selected) || !validToken(reply)) return stateFrom(state.memory, 'witness-refused-invalid', state.pending);
  if (selected === reply) return stateFrom(state.memory, 'witness-refused-self', state.pending ?? { source: selected });
  const distance = distanceBetween(selected, reply);
  if (distance < MIN_SEPARATION) return stateFrom(state.memory, 'witness-refused-near', state.pending ?? { source: selected });
  const event = eventFor(selected, reply, state.memory.length);
  return stateFrom([...state.memory, event], 'witness-committed');
}

export function liftLatestWitness(state) {
  if (!state.memory.length) return stateFrom([], 'witness-lifted');
  return stateFrom(state.memory.slice(0, -1), 'witness-lifted');
}

export function releaseMemory() { return stateFrom([], 'memory-released'); }

export function buildTimeline() {
  return [
    { source: 1, reply: 10 },
    { source: 7, reply: 2 },
    { source: 4, reply: 11 },
    { source: 9, reply: 0 }
  ];
}

export {
  BASE_TOKENS,
  MEMORY_WINDOW,
  MIN_SEPARATION,
  SEED,
  TOKEN_COUNT
};
