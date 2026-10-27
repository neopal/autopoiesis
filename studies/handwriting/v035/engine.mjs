export const SEED = '0x48574935';
export const BLOCK_COUNT = 12;
export const MEMORY_WINDOW = 4;
export const MODE = 'pressure-casting-rack';

const TOKENS = ['P', 'R', 'E', 'S', 'S', 'U', 'R', 'E', 'O', 'T', 'H', 'E'];
const INITIAL_LAYOUT = [
  { x: -0.72, y: -0.52, depth: 0.12, rotation: -0.18, scale: 0.86, tier: 0 },
  { x: -0.26, y: -0.68, depth: 0.34, rotation: 0.12, scale: 1.08, tier: 1 },
  { x: 0.28, y: -0.58, depth: 0.04, rotation: -0.1, scale: 0.92, tier: 0 },
  { x: 0.74, y: -0.38, depth: 0.48, rotation: 0.22, scale: 1.2, tier: 2 },
  { x: -0.58, y: -0.04, depth: 0.58, rotation: 0.08, scale: 1.18, tier: 2 },
  { x: -0.06, y: -0.12, depth: 0.2, rotation: -0.16, scale: 0.78, tier: 0 },
  { x: 0.42, y: -0.02, depth: 0.7, rotation: 0.18, scale: 0.98, tier: 2 },
  { x: 0.82, y: 0.12, depth: 0.3, rotation: -0.08, scale: 0.74, tier: 1 },
  { x: -0.8, y: 0.44, depth: 0.42, rotation: 0.14, scale: 0.9, tier: 1 },
  { x: -0.28, y: 0.58, depth: 0.08, rotation: -0.2, scale: 1.02, tier: 0 },
  { x: 0.3, y: 0.5, depth: 0.64, rotation: 0.1, scale: 1.14, tier: 2 },
  { x: 0.74, y: 0.68, depth: 0.24, rotation: -0.15, scale: 0.82, tier: 1 }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(value * 10000) / 10000;

function baseBlocks() {
  return INITIAL_LAYOUT.map((layout, id) => ({
    id,
    token: TOKENS[id],
    ...layout,
    skew: 0,
    aperture: 0.74,
    extrusion: 0.16,
    role: 'mold',
    pressure: 0,
    cast: 0
  }));
}

function baselineFrame() {
  return {
    mode: MODE,
    blocks: baseBlocks(),
    history: [],
    memory: [],
    active: null,
    pressureMs: 0,
    changedBlockIds: [],
    lastEvent: 'quiet'
  };
}

function chooseReceiver(source, eventIndex) {
  return (source * 5 + 5 + eventIndex * 3) % BLOCK_COUNT;
}

function chooseEcho(source, receiver, eventIndex) {
  const candidate = (receiver + 4 + eventIndex * 2) % BLOCK_COUNT;
  return candidate === source ? (candidate + 1) % BLOCK_COUNT : candidate;
}

function chooseCounterform(source, receiver, echo, eventIndex) {
  let candidate = (source + 7 + eventIndex * 2) % BLOCK_COUNT;
  if (candidate === receiver || candidate === echo) candidate = (candidate + 2) % BLOCK_COUNT;
  return candidate === source ? (candidate + 1) % BLOCK_COUNT : candidate;
}

function forceFrom(elapsed) {
  return clamp((Math.max(0, elapsed) - 220) / 1180, 0, 1);
}

function applyCast(frame, event) {
  const blocks = clone(frame.blocks);
  const eventIndex = frame.history.length;
  const source = event.source;
  const elapsed = Math.max(0, Number(event.elapsed ?? event.pressureMs ?? 420));
  const force = forceFrom(elapsed);
  const receiver = event.receiver ?? chooseReceiver(source, eventIndex);
  const echo = event.echo ?? chooseEcho(source, receiver, eventIndex);
  const counterform = event.counterform ?? chooseCounterform(source, receiver, echo, eventIndex);
  const sourceBlock = blocks[source];
  const receiverBlock = blocks[receiver];
  const echoBlock = blocks[echo];
  const counterformBlock = blocks[counterform];
  const direction = eventIndex % 2 === 0 ? 1 : -1;

  receiverBlock.depth = round(clamp(receiverBlock.depth + direction * (0.2 + force * 0.28), -0.2, 1.2));
  receiverBlock.x = round(clamp(receiverBlock.x + direction * (0.025 + force * 0.07), -0.9, 0.9));
  receiverBlock.y = round(clamp(receiverBlock.y - (0.018 + force * 0.045), -0.84, 0.84));
  receiverBlock.rotation = round(receiverBlock.rotation + direction * (0.12 + force * 0.22));
  receiverBlock.scale = round(receiverBlock.scale * (1.02 + force * 0.13));
  receiverBlock.aperture = round(clamp(receiverBlock.aperture - 0.08 - force * 0.12, 0.28, 0.92));
  receiverBlock.extrusion = round(receiverBlock.extrusion + 0.05 + force * 0.2);
  receiverBlock.pressure = round(force);
  receiverBlock.cast = eventIndex + 1;
  receiverBlock.role = 'receiver';

  echoBlock.depth = round(clamp(echoBlock.depth - direction * (0.08 + force * 0.09), -0.2, 1.2));
  echoBlock.x = round(clamp(echoBlock.x - direction * 0.035, -0.9, 0.9));
  echoBlock.rotation = round(echoBlock.rotation - direction * (0.08 + force * 0.06));
  echoBlock.aperture = round(clamp(echoBlock.aperture + 0.06 + force * 0.08, 0.28, 0.98));
  echoBlock.role = 'echo';
  echoBlock.cast = eventIndex + 1;

  counterformBlock.depth = round(clamp(counterformBlock.depth + 0.12 + force * 0.14, -0.2, 1.2));
  counterformBlock.scale = round(counterformBlock.scale * (0.96 - force * 0.08));
  counterformBlock.skew = round(counterformBlock.skew + direction * (0.08 + force * 0.1));
  counterformBlock.aperture = round(clamp(counterformBlock.aperture - 0.04, 0.25, 0.92));
  counterformBlock.role = 'counterform';
  counterformBlock.cast = eventIndex + 1;

  const history = [...frame.history, {
    source,
    receiver,
    echo,
    counterform,
    elapsed,
    force: round(force),
    eventIndex
  }];
  const changedBlockIds = [source, receiver, echo, counterform].sort((a, b) => a - b);
  sourceBlock.role = 'mold';

  return {
    ...frame,
    blocks,
    history,
    memory: history.slice(-MEMORY_WINDOW),
    active: null,
    pressureMs: 0,
    changedBlockIds,
    lastEvent: 'cast'
  };
}

export function buildFrame(events = []) {
  let frame = baselineFrame();
  for (const event of events) {
    const source = typeof event === 'number' ? event : event.source;
    frame = applyCast(frame, typeof event === 'number' ? { source, elapsed: 760 } : event);
  }
  return frame;
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.blocks.map(({ id, x, y, depth, rotation, scale, skew, aperture, extrusion, role, pressure, cast }) => ({ id, x, y, depth, rotation, scale, skew, aperture, extrusion, role, pressure, cast })));
}

export function beginPressure(frame, source, pressureMs = 0) {
  if (!Number.isInteger(source) || source < 0 || source >= BLOCK_COUNT) return { ...frame, lastEvent: 'refused' };
  return {
    ...frame,
    active: source,
    pressureMs: Math.max(0, Number(pressureMs) || 0),
    lastEvent: 'charging'
  };
}

export function releasePressure(frame, elapsed = frame.pressureMs) {
  if (!Number.isInteger(frame.active)) return { ...frame, lastEvent: 'refused' };
  return applyCast({ ...frame, active: null }, { source: frame.active, elapsed });
}

export function cast(frame, source = 3, elapsed = 760) {
  return releasePressure(beginPressure(frame, source, elapsed), elapsed);
}

export function liftLatest(frame) {
  if (!frame.history.length) return { ...frame, lastEvent: 'refused' };
  return { ...buildFrame(frame.history.slice(0, -1)), lastEvent: 'lifted' };
}

export function release() {
  return baselineFrame();
}

export function geometryChanged(a, b) {
  return geometrySignature(a) !== geometrySignature(b);
}
