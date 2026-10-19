const SEED = '0x4e413330';
const MEMORY_WINDOW = 4;
const ZONE_COUNT = 7;
const MIN_DWELL = 560;
const BOUNDARY_COUNT = 18;
const SEAM_COUNT = 5;

const BASE_BOUNDARY = [
  [0.16, 0.26], [0.22, 0.16], [0.34, 0.19], [0.43, 0.13], [0.55, 0.18], [0.68, 0.14],
  [0.80, 0.24], [0.86, 0.35], [0.82, 0.47], [0.88, 0.59], [0.78, 0.70], [0.66, 0.76],
  [0.54, 0.84], [0.42, 0.77], [0.30, 0.83], [0.19, 0.72], [0.13, 0.57], [0.18, 0.41]
];

const SEAM_STARTS = [0.18, 0.30, 0.43, 0.56, 0.68];
const round = (value) => Math.round(value * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

function zoneIndex(value, fallback = 0) {
  return clamp(integer(value, fallback), 0, ZONE_COUNT - 1);
}

function makeBoundary() {
  return BASE_BOUNDARY.map(([x, y], id) => ({ id, x, y }));
}

function makeSeams() {
  return SEAM_STARTS.map((start, seamIndex) => ({
    id: seamIndex,
    points: Array.from({ length: 7 }, (_, pointIndex) => ({
      x: start + pointIndex * 0.055,
      y: 0.26 + seamIndex * 0.095 + Math.sin((pointIndex + seamIndex) * 0.8) * 0.018,
      bend: 0
    })),
    load: 0
  }));
}

function centerForZone(zone) {
  return (zone * 2 + 1) % BOUNDARY_COUNT;
}

function remoteForZone(zone, memoryIndex) {
  return (zone + 3 + memoryIndex) % ZONE_COUNT;
}

function applyPressure(surface, event) {
  const localCenter = centerForZone(event.zone);
  const remoteZone = event.remoteZone;
  const remoteCenter = centerForZone(remoteZone);
  const force = event.force;

  surface.boundary.forEach((point, index) => {
    const localDistance = Math.min(Math.abs(index - localCenter), BOUNDARY_COUNT - Math.abs(index - localCenter));
    const remoteDistance = Math.min(Math.abs(index - remoteCenter), BOUNDARY_COUNT - Math.abs(index - remoteCenter));
    const localWeight = Math.max(0, 1 - localDistance / 3.4);
    const remoteWeight = Math.max(0, 1 - remoteDistance / 3.0);
    const inwardX = point.x - 0.5;
    const inwardY = point.y - 0.5;
    const inwardLength = Math.max(0.001, Math.hypot(inwardX, inwardY));
    point.x -= (inwardX / inwardLength) * force * localWeight;
    point.y -= (inwardY / inwardLength) * force * localWeight;
    point.x += (0.5 - point.x) * force * remoteWeight * 0.25;
    point.y += (0.5 - point.y) * force * remoteWeight * 0.25;
    point.x += Math.sin((index + event.memoryIndex) * 0.71) * force * localWeight * 0.18;
    point.y += Math.cos((index + event.zone) * 0.63) * force * remoteWeight * 0.16;
  });

  surface.seams.forEach((seam, seamIndex) => {
    const localPull = Math.max(0, 1 - Math.abs(seamIndex - event.zone) / 3.5);
    const remotePush = Math.max(0, 1 - Math.abs(seamIndex - (remoteZone % SEAM_COUNT)) / 2.8);
    seam.load = round(seam.load + force * (localPull + remotePush * 0.7));
    seam.points.forEach((point, pointIndex) => {
      const wave = Math.sin((pointIndex + 1) * 0.9 + event.memoryIndex * 0.8);
      point.bend = round(point.bend + force * (localPull * wave * 0.45 + remotePush * 0.32));
      point.y = round(point.y + point.bend * 0.022);
      point.x = round(point.x + point.bend * (pointIndex - 3) * 0.006);
    });
  });
}

function buildSurface(memory) {
  const surface = {
    closed: true,
    boundary: makeBoundary(),
    seams: makeSeams(),
    remoteZone: null,
    changedBoundaryIds: []
  };
  memory.slice(-MEMORY_WINDOW).forEach((event) => applyPressure(surface, event));
  surface.remoteZone = memory.length ? memory.at(-1).remoteZone : null;
  surface.changedBoundaryIds = surface.boundary
    .filter((point, index) => {
      const [x, y] = BASE_BOUNDARY[index];
      return Math.abs(point.x - x) > 0.0001 || Math.abs(point.y - y) > 0.0001;
    })
    .map((point) => point.id);
  return surface;
}

function makeState(stage, memory, activeZone = 0, interaction = 'idle') {
  const bounded = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'pressure-slab',
    stage: clamp(integer(stage), 0, MEMORY_WINDOW),
    activeZone: zoneIndex(activeZone),
    memory: bounded,
    surface: buildSurface(bounded),
    interaction
  };
}

export function buildFrame(stage = 0, memory = [], activeZone = 0) {
  return makeState(stage, memory, activeZone, 'idle');
}

export function pressureIsValid(pressure = {}) {
  return integer(pressure.zone, -1) >= 0
    && integer(pressure.zone, -1) < ZONE_COUNT
    && Number(pressure.dwell) >= MIN_DWELL
    && Number(pressure.intensity) >= 0.2
    && Number(pressure.intensity) <= 1.25;
}

export function commitPressure(state, pressure = {}) {
  const zone = zoneIndex(pressure.zone, state.activeZone);
  if (!pressureIsValid({ ...pressure, zone })) {
    return makeState(state.stage, state.memory, zone, 'pressure-refused-light');
  }
  const memoryIndex = state.memory.length;
  const intensity = clamp(Number(pressure.intensity), 0.2, 1.25);
  const event = {
    kind: 'material-load',
    zone,
    remoteZone: remoteForZone(zone, memoryIndex),
    dwell: Math.min(2600, Math.round(Number(pressure.dwell))),
    intensity: round(intensity),
    force: round(0.026 + intensity * 0.026 + (memoryIndex % 3) * 0.006),
    memoryIndex
  };
  return makeState(state.stage + 1, [...state.memory, event], zone, 'pressure-committed');
}

export function liftLatestPressure(state) {
  if (!state.memory.length) return makeState(state.stage, [], state.activeZone, 'pressure-lifted');
  return makeState(Math.max(0, state.stage - 1), state.memory.slice(0, -1), state.activeZone, 'pressure-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], state.activeZone, 'memory-released');
}

export function geometrySignature(state) {
  const boundary = state.surface.boundary.map((point) => `${point.id}:${round(point.x)}:${round(point.y)}`).join('|');
  const seams = state.surface.seams.map((seam) => `${seam.id}:${round(seam.load)}:${seam.points.map((point) => `${round(point.x)},${round(point.y)},${round(point.bend)}`).join(';')}`).join('|');
  return `${boundary}||${seams}`;
}

export function buildTimeline() {
  return [
    { zone: 1, dwell: 840, intensity: 0.86 },
    { zone: 5, dwell: 920, intensity: 0.72 },
    { zone: 2, dwell: 680, intensity: 0.96 },
    { zone: 6, dwell: 1100, intensity: 0.64 }
  ];
}

export { SEED, MEMORY_WINDOW, ZONE_COUNT, MIN_DWELL, BOUNDARY_COUNT, SEAM_COUNT };
