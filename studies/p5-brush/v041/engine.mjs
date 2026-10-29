export const MEMORY_LIMIT = 4;
export const STAGES = 9;
export const SURFACE_COLS = 24;
export const SURFACE_ROWS = 16;

const SEED = 0x42523431;
const MIN_ZONE_DISTANCE = 0.26;
const OFFER_RADIUS = 0.16;
const DEPARTURE_RADIUS = 0.17;
const ZONE_BASE = [
  [0.18, 0.32, 0.82, -0.42],
  [0.42, 0.18, 0.66, 0.34],
  [0.76, 0.27, 0.9, 0.52],
  [0.82, 0.61, 0.72, -0.27],
  [0.56, 0.76, 0.88, 0.22],
  [0.25, 0.78, 0.7, -0.38],
  [0.48, 0.48, 0.96, 0.1]
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(5));
const clampIndex = (value, count) => ((Math.floor(Number(value) || 0) % count) + count) % count;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0.02, 0.98)),
    y: round(clamp(Number(point.y) || 0, 0.02, 0.98))
  };
}

function normalizeEvent(event = {}) {
  return {
    source: event.source || 'unknown',
    type: 'remote-backface',
    offerZone: clampIndex(event.offerZone, ZONE_BASE.length),
    departureZone: clampIndex(event.departureZone, ZONE_BASE.length),
    answerZone: clampIndex(event.answerZone, ZONE_BASE.length),
    start: normalizePoint(event.start),
    exit: normalizePoint(event.exit),
    pressure: Number.isFinite(event.pressure) ? round(clamp(event.pressure, 0.42, 1.15)) : 0.78,
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + Number(event.answerZone || 0) * 83)
  };
}

function zonePoint(id) {
  const [x, y] = ZONE_BASE[clampIndex(id, ZONE_BASE.length)];
  return { x, y };
}

function chooseAnswer(offerZone, departureZone) {
  for (let offset = 2; offset < ZONE_BASE.length + 2; offset += 1) {
    const candidate = (offerZone + departureZone + offset) % ZONE_BASE.length;
    if (candidate !== offerZone && candidate !== departureZone) return candidate;
  }
  return (offerZone + 1) % ZONE_BASE.length;
}

function baseZones(memory) {
  return ZONE_BASE.map(([x, y, mass, angle], id) => ({
    id,
    x,
    y,
    mass,
    angle,
    backface: 0,
    witness: 0,
    seam: 0,
    turned: 0,
    memory: memory.filter((event) => event.offerZone === id || event.departureZone === id).length
  }));
}

function baseSurface() {
  const surface = [];
  for (let row = 0; row < SURFACE_ROWS; row += 1) {
    const y = row / (SURFACE_ROWS - 1);
    for (let column = 0; column < SURFACE_COLS; column += 1) {
      const x = column / (SURFACE_COLS - 1);
      const ridge = Math.exp(-Math.pow((y - (0.33 + x * 0.26)), 2) / 0.015);
      const fold = Math.exp(-Math.pow((x - 0.68 + Math.sin(y * 5.2) * 0.05), 2) / 0.025);
      const quiet = Math.sin(x * 5.8 + y * 2.1) * 0.008 + Math.cos(y * 7.1 - x * 2.6) * 0.006;
      surface.push({
        x: round(x),
        y: round(y),
        z: round(0.048 + ridge * 0.052 + fold * 0.028 + quiet),
        backface: 0,
        seam: 0,
        grain: round(0.15 + seeded(row * SURFACE_COLS + column, 7) * 0.65)
      });
    }
  }
  return surface;
}

function applyWave(surface, event) {
  const answer = zonePoint(event.answerZone);
  const offer = zonePoint(event.offerZone);
  const departure = zonePoint(event.departureZone);
  const dx = departure.x - offer.x;
  const dy = departure.y - offer.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  return surface.map((sample) => {
    const radial = Math.hypot(sample.x - answer.x, sample.y - answer.y);
    const response = Math.exp(-(radial * radial) / 0.028) * event.pressure * 0.115;
    const lineDistance = Math.abs((sample.x - offer.x) * nx + (sample.y - offer.y) * ny);
    const relay = Math.exp(-(lineDistance * lineDistance) / 0.02) * 0.018 * (1 - Math.min(1, radial * 1.4));
    const face = response + relay;
    const seam = Math.exp(-(radial * radial) / 0.018) * event.pressure;
    return {
      ...sample,
      z: round(sample.z + face),
      backface: round(sample.backface + response),
      seam: round(sample.seam + seam)
    };
  });
}

function buildZones(memory) {
  const zones = baseZones(memory);
  for (const event of memory) {
    for (const zone of zones) {
      const separation = distance(zone, zonePoint(event.answerZone));
      const field = clamp(1 - separation / 1.12, 0, 1);
      zone.backface = round(zone.backface + 0.012 + field * 0.026 + (zone.id === event.answerZone ? event.pressure * 0.18 : 0));
      zone.witness = round(zone.witness + (zone.id === event.offerZone ? 0.1 : 0));
      zone.seam = round(zone.seam + field * event.pressure * 0.08);
      zone.turned = round(zone.turned + (zone.id === event.answerZone ? event.pressure * 0.24 : field * 0.025));
    }
  }
  return zones;
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  let surface = baseSurface();
  for (const event of boundedMemory) surface = applyWave(surface, event);
  const zones = buildZones(boundedMemory);
  const event = boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null;

  return {
    grammar: 'backface-membrane',
    renderer: 'deterministic p5.js WEBGL relief membrane',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    surface,
    zones,
    event,
    pending: {
      start: pending.start ? normalizePoint(pending.start) : null,
      exit: pending.exit ? normalizePoint(pending.exit) : null,
      offerZone: Number.isInteger(pending.offerZone) ? pending.offerZone : null,
      departureZone: Number.isInteger(pending.departureZone) ? pending.departureZone : null
    },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

function nearestZone(point) {
  const normalized = normalizePoint(point);
  return ZONE_BASE.reduce((best, [x, y], id) => {
    const score = distance(normalized, { x, y });
    return score < best.score ? { id, score } : best;
  }, { id: null, score: Infinity });
}

export function previewWitness(frame, start, exit) {
  const normalizedStart = normalizePoint(start);
  const normalizedExit = normalizePoint(exit);
  const offer = nearestZone(normalizedStart);
  const departure = nearestZone(normalizedExit);
  return buildFrameFrom(frame.stage, frame.memory, 'attention-preview', {
    start: normalizedStart,
    exit: normalizedExit,
    offerZone: offer.score <= OFFER_RADIUS ? offer.id : null,
    departureZone: departure.score <= DEPARTURE_RADIUS ? departure.id : null
  });
}

export function commitWitness(frame, start, exit, source = 'visitor-reciprocal-visit') {
  const normalizedStart = normalizePoint(start);
  const normalizedExit = normalizePoint(exit);
  const offer = nearestZone(normalizedStart);
  const departure = nearestZone(normalizedExit);
  if (offer.score > OFFER_RADIUS || departure.score > DEPARTURE_RADIUS) {
    return buildFrameFrom(frame.stage, frame.memory, 'attention-refused-miss', { start: normalizedStart, exit: normalizedExit });
  }
  if (offer.id === departure.id || distance(zonePoint(offer.id), zonePoint(departure.id)) < MIN_ZONE_DISTANCE) {
    return buildFrameFrom(frame.stage, frame.memory, 'attention-refused-near', {
      start: normalizedStart,
      exit: normalizedExit,
      offerZone: offer.id,
      departureZone: departure.id
    });
  }
  return applyWitness(frame, offer.id, departure.id, source, normalizedStart, normalizedExit);
}

export function applyWitness(frame, offerZone, departureZone, source = 'control-witness', start = null, exit = null) {
  const offer = clampIndex(offerZone, ZONE_BASE.length);
  const departure = clampIndex(departureZone, ZONE_BASE.length);
  if (offer === departure) return buildFrameFrom(frame.stage, frame.memory, 'attention-refused-near');
  const answer = chooseAnswer(offer, departure);
  const origin = start || zonePoint(offer);
  const destination = exit || zonePoint(departure);
  const pressure = clamp(0.62 + distance(origin, destination) * 0.42 + seeded(frame.memory.length, answer) * 0.16, 0.42, 1.15);
  const event = {
    source,
    type: 'remote-backface',
    offerZone: offer,
    departureZone: departure,
    answerZone: answer,
    start: origin,
    exit: destination,
    pressure,
    field: hash(SEED + frame.memory.length * 7919 + answer * 83)
  };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'backface-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const targets = [[0, 3], [2, 6], [5, 1], [4, 0]];
  let frame = buildFrame(0, []);
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    if (stage % 2 === 0) frame = applyWitness(frame, ...targets[(stage / 2) - 1], 'timeline-witness');
    else frame = buildFrameFrom(stage, frame.memory, 'timeline');
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    surface: frame.surface.map(({ x, y, z, backface, seam }) => ({ x, y, z, backface, seam })),
    zones: frame.zones.map(({ id, backface, witness, seam, turned, memory }) => ({ id, backface, witness, seam, turned, memory }))
  });
}
