export const SEED = 0x57473236;
export const STAGES = 13;
export const ROW_COUNT = 6;
export const SLOT_COUNT = 7;
export const SLOT_COUNT_TOTAL = ROW_COUNT * SLOT_COUNT;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 54;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clampInt = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const wrap = (value, max) => ((value % max) + max) % max;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};
const round = (value) => Number(value.toFixed(5));
const distanceOnRegister = (a, b) => Math.abs(a - b);

const normalizePair = (raw = {}, serial = 0) => ({
  id: `pair-${serial}`,
  mode: 'witness-pair',
  source: clampInt(raw.source, 0, SLOT_COUNT_TOTAL - 1),
  target: clampInt(raw.target, 0, SLOT_COUNT_TOTAL - 1),
  serial
});

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizePair(event, index));

const baseEntries = () => Array.from({ length: SLOT_COUNT_TOTAL }, (_, id) => {
  const row = Math.floor(id / SLOT_COUNT);
  const column = id % SLOT_COUNT;
  return {
    id,
    slot: id,
    row,
    column,
    x: round(-0.83 + column * 0.27 + (pseudo(id + 3) - 0.5) * 0.035),
    y: round(-0.58 + row * 0.225 + (pseudo(id + 17) - 0.5) * 0.035),
    width: round(0.16 + pseudo(id + 31) * 0.075),
    height: round(0.032 + pseudo(id + 47) * 0.022),
    weight: round(0.38 + pseudo(id + 61) * 0.55),
    angle: round((pseudo(id + 73) - 0.5) * 0.06),
    offsetX: 0,
    offsetY: 0,
    tilt: 0,
    excision: 0,
    reply: 0,
    bridge: 0,
    gapStart: 0.48,
    gapWidth: 0.025,
    segments: []
  };
});

const buildSegments = (entry) => {
  const start = clamp(entry.gapStart - entry.gapWidth * 0.5, 0.05, 0.9);
  const end = clamp(entry.gapStart + entry.gapWidth * 0.5, start + 0.01, 0.95);
  return [
    { start: 0, end: round(start) },
    { start: round(end), end: 1 }
  ].filter((segment) => segment.end - segment.start > 0.025);
};

const buildRegister = (memory) => {
  const entries = baseEntries();
  const routeHistory = [];
  let excisionTotal = 0;

  normalizeMemory(memory).forEach((event, serial) => {
    const source = event.source;
    const target = event.target;
    const separation = distanceOnRegister(source, target);
    const amount = 0.44 + separation / SLOT_COUNT_TOTAL * 0.38 + serial * 0.06;
    const direction = serial % 2 === 0 ? -1 : 1;
    const low = Math.min(source, target);
    const high = Math.max(source, target);

    entries.forEach((entry) => {
      const sourceWeight = entry.id === source ? 1 : 0;
      const targetWeight = entry.id === target ? 1 : 0;
      const between = entry.id > low && entry.id < high ? 1 : 0;
      const nearSource = clamp(1 - distanceOnRegister(entry.id, source) / 5.5, 0, 1);
      const nearTarget = clamp(1 - distanceOnRegister(entry.id, target) / 5.5, 0, 1);

      if (sourceWeight) {
        entry.excision = round(entry.excision + amount);
        entry.offsetX = round(entry.offsetX + direction * 0.025);
        entry.offsetY = round(entry.offsetY - 0.018 - serial * 0.004);
        entry.tilt = round(entry.tilt + direction * 0.12);
        entry.gapStart = round(clamp(entry.gapStart - 0.055 - serial * 0.008, 0.22, 0.76));
        entry.gapWidth = round(clamp(entry.gapWidth + 0.16 + amount * 0.08, 0.04, 0.52));
      }
      if (targetWeight) {
        entry.reply = round(entry.reply + amount * 0.86);
        entry.offsetX = round(entry.offsetX - direction * 0.034);
        entry.offsetY = round(entry.offsetY + 0.015 + serial * 0.005);
        entry.tilt = round(entry.tilt - direction * 0.1);
        entry.gapStart = round(clamp(entry.gapStart + 0.062 + serial * 0.009, 0.24, 0.8));
        entry.gapWidth = round(clamp(entry.gapWidth + 0.11 + amount * 0.055, 0.04, 0.45));
      }
      if (between) {
        const corridor = clamp(1 - distanceOnRegister(entry.id, low + separation * 0.5) / (separation * 0.62 + 1), 0, 1);
        entry.bridge = round(entry.bridge + corridor * amount * 0.28);
        entry.offsetY = round(entry.offsetY + direction * corridor * 0.018);
        entry.tilt = round(entry.tilt + direction * corridor * 0.035);
      }
      if (!sourceWeight && !targetWeight && !between) {
        entry.offsetX = round(entry.offsetX + (nearTarget - nearSource) * direction * 0.003 * amount);
      }
    });

    excisionTotal = round(excisionTotal + amount + amount * 0.86);
    routeHistory.push(`${source}>${target}>${round(amount)}`);
  });

  entries.forEach((entry) => {
    entry.gapStart = round(clamp(entry.gapStart + entry.reply * 0.018 - entry.bridge * 0.008, 0.16, 0.84));
    entry.gapWidth = round(clamp(entry.gapWidth + entry.excision * 0.045 + entry.reply * 0.025, 0.025, 0.58));
    entry.segments = buildSegments(entry);
  });

  const route = routeHistory.join('|') || 'quiet';
  const signature = JSON.stringify({
    route,
    entries: entries.map((entry) => [
      entry.id,
      entry.x,
      entry.y,
      entry.width,
      entry.height,
      entry.angle,
      entry.offsetX,
      entry.offsetY,
      entry.tilt,
      entry.excision,
      entry.reply,
      entry.bridge,
      entry.gapStart,
      entry.gapWidth,
      entry.segments
    ])
  });
  return { entries, route, excisionTotal, signature };
};

export const buildFrame = (stage = 0, memory = [], armed = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armed: armed ? { slot: clampInt(armed.slot, 0, SLOT_COUNT_TOTAL - 1), startedAt: finite(armed.startedAt, 0) } : null,
    lastAction,
    register: buildRegister(normalizedMemory)
  };
};

const AUTO_PAIRS = [
  { source: 4, target: 25 },
  { source: 31, target: 9 },
  { source: 14, target: 38 },
  { source: 2, target: 34 }
];

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const count = Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 3));
  const memory = AUTO_PAIRS.slice(0, count).map((pair, serial) => normalizePair(pair, serial));
  return buildFrame(stage, memory, null, stage === 0 ? 'quiet' : 'settled-preview');
});

export const armWitness = (frame, slot, startedAt = 0) => ({
  ...frame,
  armed: { slot: clampInt(slot, 0, SLOT_COUNT_TOTAL - 1), startedAt: finite(startedAt, 0) },
  lastAction: 'witness-armed'
});

export const commitPair = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, lastAction: 'memory-limit' };
  const source = clampInt(input.source ?? frame.armed?.slot ?? 0, 0, SLOT_COUNT_TOTAL - 1);
  const target = clampInt(input.target ?? wrap(source + 17, SLOT_COUNT_TOTAL), 0, SLOT_COUNT_TOTAL - 1);
  if (source === target) return { ...frame, lastAction: 'same-place-refused' };
  const event = normalizePair({ source, target }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'pair-committed');
};

export const liftLatestPair = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'pair-lifted');
export const releaseRegister = () => buildFrame(0, [], null, 'register-released');
export const defaultPair = () => ({ ...AUTO_PAIRS[0] });
export const geometrySignature = (frame) => JSON.stringify({ register: frame.register.signature, entries: frame.register.entries });
