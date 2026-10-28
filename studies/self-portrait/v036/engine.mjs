export const PLATE_COUNT = 9;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503036;

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(5));

function seeded(index) {
  const value = Math.sin((index + 1) * 19.731 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

export function buildFrame() {
  return {
    composition: 'resistance-cast',
    revision: 0,
    plates: Array.from({ length: PLATE_COUNT }, (_, index) => ({
      index,
      x: rounded((seeded(index + 2) - 0.5) * 0.24),
      y: rounded(-0.62 + index * 0.155 + (seeded(index + 9) - 0.5) * 0.025),
      width: rounded(0.46 + seeded(index + 16) * 0.3),
      height: rounded(0.105 + seeded(index + 23) * 0.06),
      tilt: rounded((seeded(index + 30) - 0.5) * 0.16),
      notch: rounded(0.08 + seeded(index + 37) * 0.09),
      split: rounded(0.04 + seeded(index + 44) * 0.07),
      bridge: rounded(0.1 + seeded(index + 51) * 0.08),
      depth: rounded(0.3 + seeded(index + 58) * 0.5),
      state: 'quiet'
    })),
    resistance: Array.from({ length: PLATE_COUNT }, () => 0),
    memory: [],
    snapshots: [],
    lastProbe: null,
    interaction: 'quiet'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    revision: frame.revision,
    plates: frame.plates.map((plate) => [
      plate.index,
      plate.x,
      plate.y,
      plate.width,
      plate.height,
      plate.tilt,
      plate.notch,
      plate.split,
      plate.bridge,
      plate.depth,
      plate.state
    ])
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function plateForPoint(point) {
  return clamp(Math.floor((clamp(point.y, -0.7, 0.7) + 0.7) / 1.4 * PLATE_COUNT), 0, PLATE_COUNT - 1);
}

export function probeMaterial(frame, { start = { x: -0.5, y: 0 }, end = { x: 0.5, y: 0 }, pressure = 0.5 } = {}) {
  const next = clone(frame);
  const safePressure = clamp(Number(pressure) || 0, 0, 1);
  const steps = 12;
  for (let step = 0; step <= steps; step += 1) {
    const amount = step / steps;
    const point = {
      x: start.x + (end.x - start.x) * amount,
      y: start.y + (end.y - start.y) * amount
    };
    const index = plateForPoint(point);
    next.resistance[index] = rounded(next.resistance[index] + safePressure * (0.018 + (1 - Math.abs(point.x)) * 0.012));
  }
  next.lastProbe = {
    originIndex: plateForPoint(start),
    terminalIndex: plateForPoint(end),
    start: { x: rounded(start.x), y: rounded(start.y) },
    end: { x: rounded(end.x), y: rounded(end.y) },
    pressure: rounded(safePressure)
  };
  next.interaction = 'probing';
  return next;
}

function pickHighest(values, excluded = []) {
  const blocked = new Set(excluded);
  let selected = -1;
  let score = -Infinity;
  values.forEach((value, index) => {
    if (blocked.has(index)) return;
    if (value > score) {
      score = value;
      selected = index;
    }
  });
  return selected === -1 ? 0 : selected;
}

function pickLowest(values, excluded = []) {
  const blocked = new Set(excluded);
  let selected = -1;
  let score = Infinity;
  values.forEach((value, index) => {
    if (blocked.has(index)) return;
    if (value < score) {
      score = value;
      selected = index;
    }
  });
  return selected === -1 ? 0 : selected;
}

function mutatePlate(plate, role, revision) {
  const next = { ...plate, state: 'quiet' };
  if (role === 'hardened') {
    next.width = rounded(Math.min(0.96, plate.width + 0.12 + revision * 0.008));
    next.height = rounded(Math.min(0.24, plate.height + 0.035));
    next.depth = rounded(Math.min(0.98, plate.depth + 0.18));
    next.notch = rounded(Math.max(0.03, plate.notch - 0.025));
    next.state = 'hardened';
  } else if (role === 'fractured') {
    next.width = rounded(Math.max(0.28, plate.width - 0.07));
    next.height = rounded(Math.max(0.065, plate.height - 0.018));
    next.notch = rounded(Math.min(0.42, plate.notch + 0.18 + revision * 0.01));
    next.split = rounded(Math.min(0.34, plate.split + 0.15));
    next.tilt = rounded(plate.tilt + (plate.index % 2 ? -0.11 : 0.11));
    next.state = 'fractured';
  } else if (role === 'binder') {
    next.bridge = rounded(Math.min(0.48, plate.bridge + 0.2));
    next.tilt = rounded(plate.tilt + (plate.index % 2 ? 0.08 : -0.08));
    next.x = rounded(plate.x + (plate.index % 2 ? -0.06 : 0.06));
    next.depth = rounded(Math.min(0.96, plate.depth + 0.1));
    next.state = 'binder';
  }
  return next;
}

export function castMaterial(frame) {
  const next = clone(frame);
  const originIndex = frame.lastProbe?.originIndex ?? 0;
  const hardenedIndex = pickHighest(frame.resistance, [originIndex]);
  const fracturedIndex = pickLowest(frame.resistance, [originIndex, hardenedIndex]);
  let binderIndex = (hardenedIndex + fracturedIndex + frame.revision + 4) % PLATE_COUNT;
  while ([originIndex, hardenedIndex, fracturedIndex].includes(binderIndex)) binderIndex = (binderIndex + 1) % PLATE_COUNT;
  const event = {
    kind: 'pressure-cast',
    originIndex,
    terminalIndex: frame.lastProbe?.terminalIndex ?? originIndex,
    hardenedIndex,
    fracturedIndex,
    binderIndex,
    pressure: frame.lastProbe?.pressure ?? 0,
    revision: frame.revision + 1
  };
  next.revision = event.revision;
  next.plates = frame.plates.map((plate) => {
    if (plate.index === hardenedIndex) return mutatePlate(plate, 'hardened', next.revision);
    if (plate.index === fracturedIndex) return mutatePlate(plate, 'fractured', next.revision);
    if (plate.index === binderIndex) return mutatePlate(plate, 'binder', next.revision);
    return { ...plate, state: 'quiet' };
  });
  next.snapshots = [...frame.snapshots, clone(frame)].slice(-MEMORY_LIMIT);
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.resistance = frame.resistance.map((value, index) => rounded(value * 0.74 + (index === hardenedIndex ? 0.04 : 0)));
  next.interaction = 'cast';
  return { accepted: true, frame: next, event };
}

export function liftLatest(frame) {
  if (!frame.snapshots.length) return { ...clone(frame), interaction: 'lifted' };
  return { ...clone(frame.snapshots.at(-1)), interaction: 'lifted' };
}

export function releaseMaterial() {
  return buildFrame();
}

export function buildTimeline() {
  let frame = buildFrame();
  const frames = [frame];
  const probes = [
    [{ x: -0.7, y: -0.5 }, { x: 0.6, y: 0.42 }, 0.78],
    [{ x: 0.58, y: -0.28 }, { x: -0.62, y: 0.28 }, 0.66],
    [{ x: -0.54, y: 0.02 }, { x: 0.58, y: 0.12 }, 0.88],
    [{ x: 0.46, y: 0.5 }, { x: -0.48, y: -0.42 }, 0.72]
  ];
  for (const [start, end, pressure] of probes) {
    frame = castMaterial(probeMaterial(frame, { start, end, pressure })).frame;
    frames.push(frame);
  }
  return frames;
}
