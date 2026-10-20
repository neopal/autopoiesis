export const PLATE_COUNT = 9;
export const MEMORY_LIMIT = 4;
export const KNOCK_COUNT = 3;
export const MIN_TAP_MS = 35;
export const MAX_TAP_MS = 420;
export const MAX_TRAVEL = 0.055;
export const STAGES = 13;

const SEED = 0x42525533;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 991 + salt * 313) >>> 0) / 4294967296;

const BASE_LAYOUT = [
  { x: 0.27, y: 0.20, w: 0.27, h: 0.18, r: -0.20 },
  { x: 0.55, y: 0.18, w: 0.31, h: 0.20, r: 0.12 },
  { x: 0.78, y: 0.29, w: 0.24, h: 0.27, r: 0.26 },
  { x: 0.35, y: 0.38, w: 0.34, h: 0.23, r: -0.11 },
  { x: 0.63, y: 0.39, w: 0.31, h: 0.24, r: 0.17 },
  { x: 0.22, y: 0.59, w: 0.27, h: 0.29, r: -0.24 },
  { x: 0.49, y: 0.57, w: 0.31, h: 0.27, r: 0.10 },
  { x: 0.75, y: 0.64, w: 0.28, h: 0.25, r: -0.16 },
  { x: 0.45, y: 0.78, w: 0.43, h: 0.16, r: 0.05 }
];

const BASE_SEAM = [
  { x: 0.48, y: 0.08 },
  { x: 0.51, y: 0.21 },
  { x: 0.46, y: 0.34 },
  { x: 0.53, y: 0.48 },
  { x: 0.47, y: 0.61 },
  { x: 0.52, y: 0.75 },
  { x: 0.48, y: 0.91 }
];

const SLAB = [
  { x: 0.15, y: 0.13 }, { x: 0.42, y: 0.06 }, { x: 0.72, y: 0.11 },
  { x: 0.88, y: 0.29 }, { x: 0.84, y: 0.60 }, { x: 0.68, y: 0.83 },
  { x: 0.38, y: 0.92 }, { x: 0.13, y: 0.76 }, { x: 0.08, y: 0.39 }
];

function baselinePlate(index) {
  const base = BASE_LAYOUT[index];
  return {
    id: index,
    cx: round(base.x + (seeded(index, 1) - 0.5) * 0.018),
    cy: round(base.y + (seeded(index, 2) - 0.5) * 0.018),
    w: round(base.w * (0.96 + seeded(index, 3) * 0.08)),
    h: round(base.h * (0.95 + seeded(index, 4) * 0.10)),
    tilt: round(base.r + (seeded(index, 5) - 0.5) * 0.08),
    offsetX: 0,
    offsetY: 0,
    hinge: 0,
    counter: 0,
    void: 0,
    state: 'quiet',
    tone: index % 5
  };
}

function platePoints(plate) {
  const wobble = seeded(plate.id, 17);
  const local = [
    [-0.52, -0.26 - wobble * 0.04],
    [-0.10, -0.54],
    [0.43 + wobble * 0.06, -0.36],
    [0.55, 0.02 + plate.void * 0.08],
    [0.34, 0.47 + plate.counter * 0.10],
    [-0.18, 0.55 + plate.hinge * 0.08],
    [-0.54, 0.22]
  ];
  const scaleX = plate.w * (1 + plate.counter * 0.11 - plate.void * 0.08);
  const scaleY = plate.h * (1 + plate.hinge * 0.08 + plate.void * 0.04);
  const angle = plate.tilt + plate.hinge * 0.12 - plate.counter * 0.08;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return local.map(([lx, ly]) => {
    const x = lx * scaleX;
    const y = ly * scaleY;
    return {
      x: round(clamp(plate.cx + plate.offsetX + x * cos - y * sin, 0.04, 0.96)),
      y: round(clamp(plate.cy + plate.offsetY + x * sin + y * cos, 0.04, 0.96))
    };
  });
}

const pathSignature = (points) => points.map((point, index) => `${index ? 'L' : 'M'}${round(point.x * 1000)},${round(point.y * 700)}`).join(' ') + ' Z';
const pointSignature = (points) => JSON.stringify(points);

function normalizeTap(tap = {}) {
  return {
    x: round(clamp(Number(tap.x) || 0.5, 0.06, 0.94)),
    y: round(clamp(Number(tap.y) || 0.5, 0.08, 0.92)),
    dx: round(Number(tap.dx) || 0),
    dy: round(Number(tap.dy) || 0),
    duration: Math.round(clamp(Number(tap.duration) || 0, 0, 2000))
  };
}

function tapKey(tap) {
  const normalized = normalizeTap(tap);
  return `${normalized.x}:${normalized.y}:${normalized.duration}`;
}

function normalizeStrike(strike) {
  return {
    taps: (strike?.taps || []).slice(0, KNOCK_COUNT).map(normalizeTap),
    source: strike?.source || 'unknown'
  };
}

function influenceFor(taps, eventIndex) {
  const normalized = taps.map(normalizeTap);
  const signal = normalized.reduce((sum, tap, index) => sum + tap.x * (211 + index * 17) + tap.y * (379 + index * 23) + tap.duration * (0.031 + index * 0.009), 0);
  const field = hash(Math.round(signal * 1000) + eventIndex * 1223 + SEED);
  const entryIndex = field % PLATE_COUNT;
  const hingeIndex = (entryIndex + 2 + (field % 4)) % PLATE_COUNT;
  let counterIndex = (entryIndex + 5 + eventIndex) % PLATE_COUNT;
  if (counterIndex === hingeIndex || counterIndex === entryIndex) counterIndex = (counterIndex + 1) % PLATE_COUNT;
  let voidIndex = (entryIndex + 7 + ((field >>> 5) % 2)) % PLATE_COUNT;
  while (voidIndex === hingeIndex || voidIndex === counterIndex || voidIndex === entryIndex) voidIndex = (voidIndex + 1) % PLATE_COUNT;
  const rhythm = Math.abs(normalized[0].duration - normalized[1].duration) + Math.abs(normalized[1].duration - normalized[2].duration);
  const energy = round(clamp(0.55 + (rhythm / 500) + ((field % 31) / 100), 0.55, 1.25));
  return {
    kind: 'dry-seam-shift',
    committed: true,
    entryIndex,
    hingeIndex,
    counterIndex,
    voidIndex,
    affected: [hingeIndex, counterIndex, voidIndex],
    rhythm: round(rhythm),
    energy,
    taps: normalized
  };
}

function buildSeam(memory) {
  const seam = BASE_SEAM.map((point) => ({ ...point }));
  memory.forEach((strike, eventIndex) => {
    const influence = influenceFor(strike.taps, eventIndex);
    const bend = influence.energy * 0.010;
    const pivot = influence.hingeIndex % seam.length;
    seam[pivot].x += bend;
    seam[(pivot + 2) % seam.length].x -= bend * 0.8;
    seam[(influence.counterIndex + 1) % seam.length].y += bend * 1.2;
    seam[influence.voidIndex % seam.length].y -= bend * 0.7;
  });
  return seam.map((point) => ({ x: round(clamp(point.x, 0.12, 0.88)), y: round(clamp(point.y, 0.05, 0.95)) }));
}

function buildFrameFrom(stage, memory, pending = [], interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeStrike);
  const plates = Array.from({ length: PLATE_COUNT }, (_, index) => baselinePlate(index));
  let lastEvent = null;

  boundedMemory.forEach((strike, eventIndex) => {
    const influence = influenceFor(strike.taps, eventIndex);
    const hinge = plates[influence.hingeIndex];
    const counter = plates[influence.counterIndex];
    const voidPlate = plates[influence.voidIndex];
    const energy = influence.energy;
    hinge.hinge = round(hinge.hinge + 0.72 * energy);
    hinge.offsetY = round(hinge.offsetY - 0.018 * energy);
    hinge.tilt = round(hinge.tilt + 0.08 * energy);
    hinge.state = 'hinge';
    counter.counter = round(counter.counter + 0.68 * energy);
    counter.offsetX = round(counter.offsetX + 0.024 * energy);
    counter.offsetY = round(counter.offsetY + 0.010 * (eventIndex % 2 ? -1 : 1));
    counter.tilt = round(counter.tilt - 0.10 * energy);
    counter.state = 'counterweight';
    voidPlate.void = round(voidPlate.void + 0.82 * energy);
    voidPlate.offsetX = round(voidPlate.offsetX - 0.016 * energy);
    voidPlate.offsetY = round(voidPlate.offsetY + 0.022 * energy);
    voidPlate.tilt = round(voidPlate.tilt + 0.06 * energy);
    voidPlate.state = 'dry-void';
    lastEvent = { ...influence, source: strike.source };
  });

  plates.forEach((plate) => {
    plate.points = platePoints(plate);
    plate.pathSignature = pathSignature(plate.points);
  });

  return {
    grammar: 'dry-seam-laminate',
    stage,
    memory: boundedMemory,
    commits: boundedMemory,
    pending: pending.map(normalizeTap),
    plates,
    slab: SLAB.map((point) => ({ ...point })),
    seam: buildSeam(boundedMemory),
    event: lastEvent,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory, []);
}

export function applyTap(frame, tap, source = 'visitor-knock') {
  const normalized = normalizeTap(tap);
  const travel = Math.hypot(normalized.dx, normalized.dy);
  if (travel > MAX_TRAVEL) return { ...frame, interaction: 'tap-refused-drag' };
  if (normalized.duration < MIN_TAP_MS) return { ...frame, interaction: 'tap-refused-weak' };
  if (normalized.duration > MAX_TAP_MS) return { ...frame, interaction: 'tap-refused-overheld' };
  const pending = [...frame.pending, normalized];
  if (pending.length < KNOCK_COUNT) return buildFrameFrom(frame.stage, frame.memory, pending, 'tap-armed');
  const strike = { taps: pending, source };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, strike], [], 'triplet-committed');
}

export function applyStrike(frame, taps, source = 'deterministic-triplet') {
  let next = { ...frame, pending: [] };
  for (const tap of taps.slice(0, KNOCK_COUNT)) next = applyTap(next, tap, source);
  return next;
}

export function liftLatestStrike(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'strike-lift-refused' };
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), [], 'strike-lifted');
}

export function releaseLaminate() {
  return buildFrameFrom(0, [], [], 'memory-released');
}

export function buildTimeline(stageCount = STAGES) {
  const events = [
    [{ x: 0.22, y: 0.24, duration: 120 }, { x: 0.55, y: 0.48, duration: 165 }, { x: 0.78, y: 0.73, duration: 220 }],
    [{ x: 0.76, y: 0.22, duration: 95 }, { x: 0.45, y: 0.56, duration: 205 }, { x: 0.26, y: 0.75, duration: 150 }],
    [{ x: 0.34, y: 0.74, duration: 180 }, { x: 0.72, y: 0.42, duration: 130 }, { x: 0.51, y: 0.18, duration: 240 }],
    [{ x: 0.66, y: 0.76, duration: 110 }, { x: 0.28, y: 0.38, duration: 190 }, { x: 0.81, y: 0.30, duration: 160 }]
  ];
  let frame = buildFrame(0, []);
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % 3 === 0) frame = applyStrike(frame, events[(stage / 3 - 1) % events.length], 'timeline');
    frame = { ...frame, stage, interaction: stage === 0 ? 'baseline' : 'timeline' };
    timeline.push(frame);
  }
  return timeline;
}

export function frameForMemory(memory) {
  return buildFrame(memory.length, memory);
}

export function geometrySignature(frame) {
  return JSON.stringify({
    plates: frame.plates.map((plate) => ({ id: plate.id, points: plate.points, state: plate.state })),
    seam: frame.seam
  });
}

export { pathSignature, pointSignature, tapKey };
