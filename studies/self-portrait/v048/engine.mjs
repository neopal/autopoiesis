export const STATION_COUNT = 7;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503048;

const MODES = ['quiet', 'tilt', 'hollow', 'return'];
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(6));
const stationValue = (value) => Math.trunc(Number(value));

const BASE_STATIONS = [
  [0.19, 0.24, -0.22],
  [0.49, 0.13, 0.12],
  [0.79, 0.27, 0.28],
  [0.88, 0.63, -0.16],
  [0.65, 0.84, -0.3],
  [0.32, 0.87, 0.18],
  [0.12, 0.59, 0.08]
];

function buildStations(document) {
  return BASE_STATIONS.map(([x, y, lean], index) => ({
    index,
    x: round(x + Math.sin(index * 1.7 + document.phase * TAU) * document.stationDrift),
    y: round(y + Math.cos(index * 1.13 + document.phase * TAU) * document.stationDrift * 0.7),
    lean: round(lean + Math.sin(index * 1.41 + document.tilt) * document.stationLean),
    width: round(0.018 + (index % 3) * 0.004),
    phase: round((index * 0.17 + document.phase) % 1)
  }));
}

function buildBody(document, event = null) {
  return Array.from({ length: 40 }, (_, index) => {
    const angle = (index / 40) * TAU;
    const wave = Math.sin(angle * 3 + document.phase * TAU) * document.roughness;
    const secondary = Math.cos(angle * 5 - document.tilt) * document.edge;
    const radialX = 0.31 + wave + secondary;
    const radialY = 0.255 + Math.cos(angle * 2 + document.bias) * document.roughness * 0.75;
    const shear = Math.sin(angle * 2 + document.tilt) * document.shear;
    return {
      x: round(0.5 + Math.cos(angle + document.tilt * 0.18) * radialX + shear),
      y: round(0.52 + Math.sin(angle + document.tilt * 0.11) * radialY + Math.cos(angle * 3 + document.phase) * document.shear * 0.6),
      weight: round(0.8 + (index % 4) * 0.12)
    };
  });
}

function buildCuts(document, event = null) {
  const cutCount = document.revision ? Math.min(4, document.revision + 1) : 1;
  return Array.from({ length: cutCount }, (_, index) => {
    const angle = (index / cutCount) * TAU + document.bias;
    const radius = 0.07 + index * 0.016 + document.aperture * 0.04;
    const length = 0.1 + document.aperture * 0.14;
    return {
      x: round(0.5 + Math.cos(angle) * (0.09 + index * 0.018)),
      y: round(0.52 + Math.sin(angle) * (0.08 + index * 0.014)),
      angle: round(angle),
      radius: round(radius),
      length: round(length),
      width: round(0.018 + document.revision * 0.003)
    };
  });
}

function quietDocument() {
  return {
    revision: 0,
    mode: 'quiet',
    phase: 0.08,
    tilt: 0.12,
    bias: -0.25,
    aperture: 0.22,
    roughness: 0.038,
    edge: 0.018,
    shear: 0.014,
    stationDrift: 0,
    stationLean: 0.08
  };
}

export function buildField() {
  const document = quietDocument();
  return {
    composition: 'departure-portrait',
    renderer: 'canvas-raster',
    document,
    body: buildBody(document),
    cuts: buildCuts(document),
    stations: buildStations(document),
    pending: [],
    memory: [],
    snapshots: [],
    interaction: 'quiet body'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    document: field.document,
    body: field.body,
    cuts: field.cuts,
    stations: field.stations
  });
}

export function departureSignature(event) {
  return JSON.stringify({
    route: event.route,
    destination: event.destination,
    departureCode: event.departureCode,
    revision: event.revision
  });
}

export function recordNotice(field, station) {
  const next = structuredClone(field);
  const index = stationValue(station);
  if (!Number.isInteger(index) || index < 0 || index >= STATION_COUNT) return next;
  if (!next.pending.some((notice) => notice.station === index)) {
    next.pending = [...next.pending, { station: index }].slice(-STATION_COUNT);
  }
  const count = next.pending.length;
  next.interaction = `presence noticed / ${count} threshold${count === 1 ? '' : 's'}`;
  return next;
}

function eventFrom(field, destination) {
  const route = field.pending.map(({ station }) => station);
  const routeCode = route.join('>');
  const destinationIndex = stationValue(destination);
  const polarity = route.reduce((sum, station, index) => sum + (station + 1) * (index % 2 ? -1 : 1), 0) + destinationIndex;
  const departureCode = `${routeCode}|${destinationIndex}|${polarity}`;
  return {
    kind: 'departure-rewrite',
    relation: 'presence-leaves-a-witness',
    route,
    destination: destinationIndex,
    departureCode,
    polarity,
    revision: field.document.revision + 1
  };
}

function rewriteDocument(previous, event) {
  const routeWeight = event.route.reduce((sum, station, index) => sum + (station + 1) * (index + 2), 0);
  const direction = event.polarity >= 0 ? 1 : -1;
  return {
    revision: event.revision,
    mode: MODES[(Math.abs(event.polarity) + event.revision) % (MODES.length - 1) + 1],
    phase: round((previous.phase + routeWeight * 0.013 + event.destination * 0.037) % 1),
    tilt: round(previous.tilt + direction * (0.18 + event.route.length * 0.025)),
    bias: round(previous.bias + (event.destination - event.route[0]) * 0.06),
    aperture: round(clamp(previous.aperture + 0.035 + event.route.length * 0.009, 0.22, 0.52)),
    roughness: round(clamp(previous.roughness + 0.006 + Math.abs(event.polarity) * 0.001, 0.038, 0.082)),
    edge: round(clamp(previous.edge + 0.004, 0.018, 0.05)),
    shear: round(clamp(previous.shear + direction * 0.007, -0.06, 0.06)),
    stationDrift: round(clamp(previous.stationDrift + 0.008, 0, 0.035)),
    stationLean: round(clamp(previous.stationLean + direction * 0.045, -0.32, 0.32))
  };
}

export function commitDeparture(field, destination) {
  const next = structuredClone(field);
  const destinationIndex = stationValue(destination);
  if (next.pending.length < 3 || !Number.isInteger(destinationIndex) || destinationIndex < 0 || destinationIndex >= STATION_COUNT) {
    next.interaction = 'refused / departure incomplete';
    return { accepted: false, field: next, event: null };
  }

  const event = eventFrom(field, destinationIndex);
  next.snapshots = [...next.snapshots, structuredClone(field)].slice(-MEMORY_LIMIT);
  next.document = rewriteDocument(field.document, event);
  next.body = buildBody(next.document, event);
  next.cuts = buildCuts(next.document, event);
  next.stations = buildStations(next.document);
  next.memory = [...next.memory, event].slice(-MEMORY_LIMIT);
  next.pending = [];
  next.interaction = `departed / witness ${destinationIndex + 1}`;
  return { accepted: true, field: next, event };
}

export function liftLatest(field) {
  if (!field.snapshots.length) return { ...structuredClone(field), interaction: 'lifted / exact' };
  return { ...structuredClone(field.snapshots.at(-1)), interaction: 'lifted / exact' };
}

export function releaseField() {
  return buildField();
}

export function buildTimeline() {
  const routes = [
    [[0, 2, 5], 5],
    [[1, 4, 6], 2],
    [[6, 3, 1], 4],
    [[2, 5, 0], 3]
  ];
  let field = buildField();
  const timeline = [field];
  for (const [route, destination] of routes) {
    field = route.reduce(recordNotice, field);
    field = commitDeparture(field, destination).field;
    timeline.push(field);
  }
  return timeline;
}
