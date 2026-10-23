export const RIB_COUNT = 17;
export const APERTURE_COUNT = 7;
export const FAULT_COUNT = 5;
export const VENT_COUNT = 5;
export const MEMORY_LIMIT = 4;
export const STAGES = 13;
export const ROUTE_RADIUS = 0.14;

const SEED = 0x42523636;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const FAULTS = [
  { x: 0.19, y: 0.28 },
  { x: 0.40, y: 0.17 },
  { x: 0.66, y: 0.22 },
  { x: 0.81, y: 0.49 },
  { x: 0.27, y: 0.72 }
];

const VENTS = [
  { x: 0.75, y: 0.72 },
  { x: 0.54, y: 0.84 },
  { x: 0.15, y: 0.60 },
  { x: 0.85, y: 0.29 },
  { x: 0.47, y: 0.52 }
];

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0, 1)),
    y: round(clamp(Number(point.y) || 0, 0, 1))
  };
}

function normalizeEvent(event = {}) {
  return {
    kind: 'remote-eclipse',
    faultIndex: Math.abs(Number(event.faultIndex) || 0) % FAULT_COUNT,
    ventIndex: Math.abs(Number(event.ventIndex) || 0) % VENT_COUNT,
    source: event.source || 'unknown',
    route: event.route || 'fault-vent-exit',
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED)
  };
}

function normalizePending(pending = {}) {
  const phase = ['idle', 'fault', 'vent'].includes(pending.phase) ? pending.phase : 'idle';
  return {
    phase,
    faultIndex: Number.isInteger(pending.faultIndex) ? pending.faultIndex : -1,
    ventIndex: Number.isInteger(pending.ventIndex) ? pending.ventIndex : -1
  };
}

function baselineRib(index) {
  const progress = index / (RIB_COUNT - 1);
  return {
    id: index,
    x: round(0.10 + progress * 0.80 + (seeded(index, 1) - 0.5) * 0.018),
    y: round(0.50 + Math.sin(progress * Math.PI * 1.35) * 0.075 + (seeded(index, 2) - 0.5) * 0.045),
    width: round(0.060 + seeded(index, 3) * 0.032),
    height: round(0.28 + seeded(index, 4) * 0.16 + Math.sin(progress * Math.PI) * 0.06),
    tilt: round((seeded(index, 5) - 0.5) * 0.42 + Math.sin(progress * Math.PI * 2) * 0.08),
    z: round(0.12 + seeded(index, 6) * 0.07),
    cut: 0,
    shed: 0,
    underside: 0
  };
}

function baseRibs() {
  return Array.from({ length: RIB_COUNT }, (_, index) => baselineRib(index));
}

function baseAperture(index) {
  const progress = index / (APERTURE_COUNT - 1);
  return {
    id: index,
    x: round(0.17 + progress * 0.66 + (seeded(index, 7) - 0.5) * 0.07),
    y: round(0.37 + Math.sin(progress * Math.PI * 1.8 + 0.4) * 0.22 + (seeded(index, 8) - 0.5) * 0.08),
    rx: round(0.025 + seeded(index, 9) * 0.018),
    ry: round(0.045 + seeded(index, 10) * 0.032),
    depth: 0,
    rim: 0,
    angle: round((seeded(index, 11) - 0.5) * 1.6)
  };
}

function baseApertures() {
  return Array.from({ length: APERTURE_COUNT }, (_, index) => baseAperture(index));
}

function pickRemote(field, salt, excluded) {
  const blocked = new Set(excluded);
  const candidates = Array.from({ length: RIB_COUNT }, (_, index) => index).filter((index) => !blocked.has(index));
  return candidates[(field + salt * 37) % candidates.length];
}

function eventInfluence(event, eventIndex) {
  const normalized = normalizeEvent(event);
  const field = hash(normalized.field + eventIndex * 1733 + normalized.faultIndex * 211 + normalized.ventIndex * 317);
  const faultRib = Math.round((normalized.faultIndex + 1) * (RIB_COUNT - 1) / (FAULT_COUNT + 1));
  const ventRib = Math.round((normalized.ventIndex + 1) * (RIB_COUNT - 1) / (VENT_COUNT + 1));
  const excluded = [faultRib, ventRib, normalized.faultIndex, normalized.ventIndex];
  const eclipseRib = pickRemote(field, 1, excluded);
  const shedRib = pickRemote(field, 2, [...excluded, eclipseRib]);
  const echoRib = pickRemote(field, 3, [...excluded, eclipseRib, shedRib]);
  return {
    ...normalized,
    field,
    faultRib,
    ventRib,
    eclipseRib,
    shedRib,
    echoRib,
    affected: [eclipseRib, shedRib, echoRib],
    apertureIndex: field % APERTURE_COUNT,
    energy: round(0.68 + ((field >>> 24) % 25) / 100)
  };
}

function weight(index, pivot, radius) {
  return clamp(1 - Math.abs(index - pivot) / radius, 0, 1);
}

function polygonPoints(rib, side) {
  const depth = side === 'front' ? 0 : rib.z * 0.34;
  const cos = Math.cos(rib.tilt);
  const sin = Math.sin(rib.tilt);
  const points = [
    [-rib.width, -rib.height * 0.42],
    [-rib.width * 0.72, -rib.height * 0.56],
    [rib.width * 0.25, -rib.height * 0.50],
    [rib.width, -rib.height * 0.18],
    [rib.width * 0.78, rib.height * 0.46],
    [rib.width * 0.08, rib.height * 0.58],
    [-rib.width * 0.82, rib.height * 0.45],
    [-rib.width * 1.06, rib.height * 0.02]
  ];
  return points.map(([px, py]) => ({
    x: round(clamp(rib.x + px * cos - py * sin, 0.02, 0.98)),
    y: round(clamp(rib.y + px * sin + py * cos + depth, 0.04, 0.96)),
    z: round(side === 'front' ? rib.z : 0)
  }));
}

function materializeRib(rib) {
  return { ...rib, front: polygonPoints(rib, 'front'), back: polygonPoints(rib, 'back') };
}

function applyEvent(ribs, apertures, event, eventIndex) {
  const influence = eventInfluence(event, eventIndex);
  const nextRibs = ribs.map((rib, index) => {
    const eclipse = weight(index, influence.eclipseRib, 3.4);
    const shed = weight(index, influence.shedRib, 2.5);
    const echo = weight(index, influence.echoRib, 2.1);
    const sign = eventIndex % 2 === 0 ? 1 : -1;
    return {
      ...rib,
      z: round(rib.z + 0.055 * eclipse * influence.energy - 0.018 * echo),
      height: round(clamp(rib.height + sign * 0.07 * eclipse - 0.045 * shed, 0.16, 0.58)),
      width: round(clamp(rib.width + 0.018 * shed - 0.013 * eclipse, 0.035, 0.15)),
      tilt: round(rib.tilt + sign * 0.21 * eclipse + 0.08 * echo),
      cut: round(clamp(rib.cut + eclipse * influence.energy, 0, 1.7)),
      shed: round(clamp(rib.shed + shed * influence.energy, 0, 1.7)),
      underside: round(clamp(rib.underside + echo * 0.8, 0, 1.7))
    };
  });
  const nextApertures = apertures.map((aperture, index) => {
    const local = index === influence.apertureIndex ? 1 : weight(index, influence.apertureIndex, 2.4) * 0.32;
    return {
      ...aperture,
      depth: round(clamp(aperture.depth + local * influence.energy, 0, 1.8)),
      rim: round(clamp(aperture.rim + local * 0.75, 0, 1.8)),
      rx: round(clamp(aperture.rx + local * 0.012, 0.018, 0.09)),
      ry: round(clamp(aperture.ry + local * 0.018, 0.025, 0.13)),
      angle: round(aperture.angle + (index === influence.apertureIndex ? 0.24 * (eventIndex % 2 ? -1 : 1) : 0))
    };
  });
  return { ribs: nextRibs, apertures: nextApertures, influence };
}

function buildFrameFrom(stage, memory, pending = {}, interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  let ribs = baseRibs();
  let apertures = baseApertures();
  let event = null;
  boundedMemory.forEach((stored, index) => {
    const result = applyEvent(ribs, apertures, stored, index);
    ribs = result.ribs;
    apertures = result.apertures;
    event = { ...result.influence, source: stored.source, route: stored.route };
  });
  const materialized = ribs.map(materializeRib);
  return {
    grammar: 'eclipse-slab',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    faults: FAULTS.map(normalizePoint),
    vents: VENTS.map(normalizePoint),
    pending: normalizePending(pending),
    ribs: materialized,
    apertures,
    event,
    eclipseCount: apertures.filter((aperture) => aperture.depth > 0.04).length,
    shedCount: materialized.filter((rib) => rib.shed > 0.04).length,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function applyPress(frame, point, source = 'visitor-press') {
  if (frame.pending.phase !== 'idle') return buildFrameFrom(frame.stage, frame.memory, frame.pending, 'press-refused-busy');
  const normalized = normalizePoint(point);
  const faultIndex = frame.faults.findIndex((fault) => distance(fault, normalized) <= ROUTE_RADIUS);
  if (faultIndex < 0) return buildFrameFrom(frame.stage, frame.memory, {}, 'press-refused');
  return buildFrameFrom(frame.stage, frame.memory, { phase: 'fault', faultIndex, ventIndex: -1 }, 'fault-armed');
}

export function applyMove(frame, point, source = 'visitor-cross') {
  if (frame.pending.phase !== 'fault') return buildFrameFrom(frame.stage, frame.memory, frame.pending, 'cross-refused');
  const normalized = normalizePoint(point);
  const ventIndex = frame.vents.findIndex((vent) => distance(vent, normalized) <= ROUTE_RADIUS);
  if (ventIndex < 0) return buildFrameFrom(frame.stage, frame.memory, frame.pending, 'fault-armed');
  return buildFrameFrom(frame.stage, frame.memory, { ...frame.pending, phase: 'vent', ventIndex }, 'vent-crossed');
}

export function applyRelease(frame, point, source = 'visitor-exit') {
  if (frame.pending.phase !== 'vent') return buildFrameFrom(frame.stage, frame.memory, {}, 'release-refused');
  const normalized = normalizePoint(point);
  const local = frame.faults.some((fault) => distance(fault, normalized) <= ROUTE_RADIUS)
    || frame.vents.some((vent) => distance(vent, normalized) <= ROUTE_RADIUS);
  if (local) return buildFrameFrom(frame.stage, frame.memory, frame.pending, 'release-refused-local');
  const pending = frame.pending;
  const field = hash(SEED + frame.memory.length * 7919 + pending.faultIndex * 113 + pending.ventIndex * 127);
  const event = {
    faultIndex: pending.faultIndex,
    ventIndex: pending.ventIndex,
    source,
    route: 'fault-vent-exit',
    field
  };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], {}, 'eclipse-committed');
}

export function applyControlEclipse(frame, index = 0) {
  const faultIndex = index % FAULT_COUNT;
  const ventIndex = (index * 2 + 1) % VENT_COUNT;
  let next = applyPress(frame, frame.faults[faultIndex], 'control-eclipse');
  next = applyMove(next, next.vents[ventIndex], 'control-eclipse');
  return applyRelease(next, { x: 0.96, y: 0.92 }, 'control-eclipse');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, {}, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), {}, 'lifted');
}

export function releaseSlab() {
  return buildFrameFrom(0, [], {}, 'released');
}

export function buildTimeline(stageCount = STAGES) {
  let frame = buildFrame(0, []);
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % 3 === 0) frame = applyControlEclipse(frame, stage / 3 - 1);
    timeline.push({ ...frame, stage, interaction: stage === 0 ? 'baseline' : frame.interaction === 'eclipse-committed' ? 'timeline' : frame.interaction });
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    ribs: frame.ribs.map((rib) => ({ id: rib.id, x: rib.x, y: rib.y, width: rib.width, height: rib.height, tilt: rib.tilt, z: rib.z, cut: rib.cut, shed: rib.shed, underside: rib.underside, front: rib.front, back: rib.back })),
    apertures: frame.apertures
  });
}
