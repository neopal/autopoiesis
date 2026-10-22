const BASE_SEED = 0x53564734;
export const TOKEN_COUNT = 9;
export const MEMORY_WINDOW = 4;
export const MIN_INTERVAL_MS = 180;
export const MAX_INTERVAL_MS = 840;

const TOKEN_LAYOUT = [
  { x: 0.14, y: 0.52, angle: -18, width: 0.085, height: 0.25, phase: 0.07 },
  { x: 0.24, y: 0.46, angle: 12, width: 0.073, height: 0.32, phase: 0.19 },
  { x: 0.34, y: 0.55, angle: -7, width: 0.098, height: 0.28, phase: 0.31 },
  { x: 0.44, y: 0.43, angle: 23, width: 0.068, height: 0.35, phase: 0.44 },
  { x: 0.54, y: 0.56, angle: -26, width: 0.088, height: 0.31, phase: 0.56 },
  { x: 0.64, y: 0.45, angle: 8, width: 0.076, height: 0.27, phase: 0.68 },
  { x: 0.73, y: 0.53, angle: -12, width: 0.103, height: 0.34, phase: 0.79 },
  { x: 0.83, y: 0.44, angle: 19, width: 0.07, height: 0.28, phase: 0.89 },
  { x: 0.91, y: 0.54, angle: -23, width: 0.057, height: 0.23, phase: 0.97 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));

function rotate(x, y, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine];
}

function pathFrom(points, close = true) {
  const path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  return close ? `${path} Z` : path;
}

function tokenPath(token) {
  const width = token.width * 1000;
  const height = token.height * 680;
  const bite = clamp(token.notch, 0, 0.8) * width;
  const fold = token.fold * height * 0.18;
  const local = [
    [-width * 0.52, -height * 0.38],
    [-width * 0.12, -height * 0.55 - fold],
    [width * 0.5, -height * 0.34],
    [width * 0.26 - bite, -height * 0.04],
    [width * 0.52, height * 0.28 + fold],
    [width * 0.07, height * 0.53],
    [-width * 0.56, height * 0.3],
    [-width * 0.31, height * 0.02 + bite * 0.16]
  ];
  const points = local.map(([x, y], index) => {
    const wave = Math.sin(token.phase * 19 + index * 1.7 + token.fold) * token.tension * 5;
    const [rx, ry] = rotate(x + wave, y - wave * 0.4, token.angle + token.tilt);
    return [(token.x * 1000) + rx + token.shift * 16, (token.y * 680) + ry + token.lift * 42];
  });
  return pathFrom(points);
}

function railPath(rail) {
  const start = 80 + rail.shift * 45;
  const end = 932 + rail.shift * 38;
  const baseline = 548 + rail.lift * 52;
  const bow = 38 + rail.tension * 26;
  const middle = 500 + rail.slash * 62;
  return `M ${start.toFixed(2)} ${(baseline + bow).toFixed(2)} C 260 ${(baseline - bow).toFixed(2)} ${middle.toFixed(2)} ${(baseline + bow * 0.6).toFixed(2)} ${end.toFixed(2)} ${(baseline - bow * 0.35).toFixed(2)}`;
}

function baseToken(index) {
  const source = TOKEN_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    angle: source.angle,
    width: source.width,
    height: source.height,
    phase: source.phase,
    tilt: 0,
    notch: 0,
    fold: 0,
    tension: 0,
    shift: 0,
    lift: 0,
    role: 'quiet',
    pathSignature: ''
  };
}

function baseRail() {
  return { shift: 0, lift: 0, tension: 0, slash: 0 };
}

function applyEvent(tokens, rail, event) {
  tokens.forEach((token) => { token.role = 'quiet'; });
  const source = tokens[event.sourceToken];
  const counter = tokens[event.counterToken];
  const witness = tokens[event.witnessToken];
  const direction = event.direction;

  source.notch = clamp(source.notch + 0.24, 0, 0.9);
  source.width = clamp(source.width - 0.006, 0.035, 0.14);
  source.tilt += direction * (5 + event.index * 1.2);
  source.role = 'delayed';

  counter.shift += direction * 0.35;
  counter.lift += event.band === 'late' ? 0.34 : -0.24;
  counter.height = clamp(counter.height + direction * 0.018, 0.17, 0.45);
  counter.tension += 0.18;
  counter.role = 'echo';

  witness.angle -= direction * (8 + event.index);
  witness.fold += 0.42;
  witness.notch = clamp(witness.notch + 0.12, 0, 0.9);
  witness.role = 'witness';

  rail.shift += direction * 0.55;
  rail.lift += event.band === 'short' ? -0.24 : 0.18;
  rail.tension += 0.23;
  rail.slash += direction * 0.37;
}

function scoreState(memory) {
  const tokens = TOKEN_LAYOUT.map((_, index) => baseToken(index));
  const rail = baseRail();
  for (const event of memory) applyEvent(tokens, rail, event);
  return { tokens, rail };
}

function frameFrom(stage, memory, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const { tokens, rail } = scoreState(safeMemory);
  for (const token of tokens) token.pathSignature = tokenPath(token);
  return {
    grammar: 'delayed-score',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    tokens,
    rail,
    railPath: railPath(rail),
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
}

export function buildFrame(stage = 0, memory = []) {
  const frame = frameFrom(stage, memory, 'still', null);
  frame.signature = geometrySignature(frame);
  return frame;
}

export function geometrySignature(frame) {
  return `${frame.railPath}||${frame.tokens.map((token) => `${token.id}:${token.role}:${token.pathSignature || tokenPath(token)}`).join('||')}`;
}

export function advanceBeat(frame, rawOffer) {
  const interval = Number(rawOffer?.interval ?? 0);
  if (frame.memory.length >= MEMORY_WINDOW) {
    const full = frameFrom(frame.stage, frame.memory, 'score-memory-full', { committed: false, reason: 'memory-full' });
    full.signature = geometrySignature(full);
    return full;
  }
  if (interval < MIN_INTERVAL_MS) {
    const refused = frameFrom(frame.stage, frame.memory, 'beat-refused-stutter', { committed: false, reason: 'stutter', interval });
    refused.signature = geometrySignature(refused);
    return refused;
  }
  if (interval > MAX_INTERVAL_MS) {
    const refused = frameFrom(frame.stage, frame.memory, 'beat-refused-late', { committed: false, reason: 'late', interval });
    refused.signature = geometrySignature(refused);
    return refused;
  }
  const band = interval < 360 ? 'short' : interval < 600 ? 'middle' : 'late';
  const sourceToken = wrap(frame.memory.length * 2 + 1, TOKEN_COUNT);
  const counterToken = wrap(sourceToken + 3 + (band === 'late' ? 1 : 0), TOKEN_COUNT);
  const witnessToken = wrap(sourceToken + 5 + (frame.memory.length % 2), TOKEN_COUNT);
  const event = {
    committed: true,
    type: 'delayed-beat',
    index: frame.memory.length,
    interval,
    band,
    sourceToken,
    counterToken,
    witnessToken,
    direction: band === 'short' ? -1 : 1,
    resistance: Number((interval / MAX_INTERVAL_MS).toFixed(3))
  };
  const next = frameFrom(frame.stage + 1, [...frame.memory, event], 'beat-delayed', event);
  next.signature = geometrySignature(next);
  return next;
}

export function liftLatestBeat(frame) {
  const next = frame.memory.length
    ? frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'beat-lifted', { committed: false, lifted: true })
    : frameFrom(frame.stage, [], 'lift-empty', { committed: false });
  next.signature = geometrySignature(next);
  return next;
}

export function releaseScore() {
  const frame = frameFrom(0, [], 'released', { committed: false, released: true });
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline() {
  const intervals = [320, 540, 760, 420];
  let frame = buildFrame();
  const frames = [frame];
  for (const interval of intervals) {
    frame = advanceBeat(frame, { interval });
    frames.push(frame);
  }
  return frames;
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'delayed-score',
  rule: 'a second beat, not a spatial point, rewrites a temporal SVG score through three non-local token roles',
  memoryWindow: MEMORY_WINDOW
};
