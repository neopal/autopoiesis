export const SEED = 0x5356474b;
export const STAGES = 19;
export const PRIMITIVE_BUDGET = 1;
export const MEMORY_LIMIT = 3;
export const STATION_COUNT = 7;

const AUTO_STATIONS = [1, 4, 2, 6, 3, 0, 5, 2];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyStation(station) {
  return { ...station };
}

function copyMemory(memory) {
  return memory.map((event) => ({ ...event }));
}

function pointSignature(point) {
  return `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
}

function ribbonPathSignature(points) {
  return points.map(pointSignature).join('|');
}

function boundedStage(stage) {
  return clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
}

function safeStation(index) {
  const numeric = Number.isFinite(Number(index)) ? Math.floor(Number(index)) : 0;
  return ((numeric % STATION_COUNT) + STATION_COUNT) % STATION_COUNT;
}

function baseStations(stage) {
  const random = rng(SEED + stage * 991);
  const template = [
    [0.11, 0.66, 0.067],
    [0.23, 0.39, 0.085],
    [0.37, 0.52, 0.098],
    [0.50, 0.28, 0.073],
    [0.64, 0.45, 0.092],
    [0.78, 0.34, 0.069],
    [0.90, 0.64, 0.081]
  ];
  return template.map(([x, y, width], index) => ({
    index,
    x: clamp(x + (random() - 0.5) * 0.008 + Math.sin(stage * 0.08 + index) * 0.003, 0.06, 0.94),
    y: clamp(y + (random() - 0.5) * 0.008 + Math.cos(stage * 0.07 + index * 1.4) * 0.003, 0.12, 0.86),
    width,
    pressure: 0,
    role: 'quiet'
  }));
}

function makeRibbon(stations) {
  const left = [];
  const right = [];
  for (let index = 0; index < stations.length; index += 1) {
    const current = stations[index];
    const before = stations[Math.max(0, index - 1)];
    const after = stations[Math.min(stations.length - 1, index + 1)];
    const tangentX = after.x - before.x;
    const tangentY = after.y - before.y;
    const length = Math.hypot(tangentX, tangentY) || 1;
    const normalX = -tangentY / length;
    const normalY = tangentX / length;
    left.push({ x: clamp(current.x + normalX * current.width), y: clamp(current.y + normalY * current.width) });
    right.push({ x: clamp(current.x - normalX * current.width), y: clamp(current.y - normalY * current.width) });
  }
  const points = [...left, ...right.reverse()];
  return {
    closed: true,
    fillRule: 'nonzero',
    points,
    pathSignature: ribbonPathSignature(points)
  };
}

function applyMemory(stations, memory) {
  const nextStations = stations.map(copyStation);
  const creases = [];
  for (const [memoryIndex, event] of memory.entries()) {
    const source = safeStation(event.station);
    const remote = (source + 3 + memoryIndex) % STATION_COUNT;
    const force = clamp(event.force ?? 0.78, 0.25, 1);
    const direction = memoryIndex % 2 === 0 ? 1 : -1;
    const sourceStation = nextStations[source];
    const remoteStation = nextStations[remote];
    sourceStation.y = clamp(sourceStation.y + direction * (0.055 + force * 0.025), 0.1, 0.9);
    sourceStation.x = clamp(sourceStation.x + (0.5 - sourceStation.x) * (0.045 + force * 0.035), 0.05, 0.95);
    sourceStation.width = clamp(sourceStation.width * (0.56 - memoryIndex * 0.035), 0.026, 0.12);
    sourceStation.pressure = Number((sourceStation.pressure + force).toFixed(4));
    sourceStation.role = 'crease';

    remoteStation.y = clamp(remoteStation.y - direction * (0.034 + force * 0.018), 0.1, 0.9);
    remoteStation.x = clamp(remoteStation.x + (remoteStation.x - 0.5) * (0.022 + memoryIndex * 0.012), 0.05, 0.95);
    remoteStation.width = clamp(remoteStation.width * (1.28 + force * 0.12), 0.026, 0.15);
    remoteStation.pressure = Number((remoteStation.pressure + force * 0.72).toFixed(4));
    remoteStation.role = 'binder';

    const between = (source + 1) % STATION_COUNT;
    nextStations[between].y = clamp(nextStations[between].y + direction * (0.014 + force * 0.008), 0.1, 0.9);
    nextStations[between].role = 'drawn';
    creases.push({ source, remote, force: Number(force.toFixed(4)), direction, memoryIndex });
  }
  return { stations: nextStations, creases };
}

function pressureEvent(stage, memory, source = 'auto-pressure', requestedStation = null, requestedForce = null) {
  const station = Number.isInteger(requestedStation) ? safeStation(requestedStation) : AUTO_STATIONS[(stage + memory.length) % AUTO_STATIONS.length];
  const force = requestedForce == null ? 0.78 + ((stage + memory.length) % 3) * 0.04 : clamp(requestedForce, 0.25, 1);
  return {
    kind: 'pressure',
    mode: 'material-crease',
    gesture: 'traveled-pressure',
    source,
    stage,
    station,
    force: Number(force.toFixed(4)),
    ordinal: memory.length
  };
}

export function buildFrame(stage, memory = []) {
  const safeStage = boundedStage(stage);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const { stations, creases } = applyMemory(baseStations(safeStage), inherited);
  const ribbon = makeRibbon(stations);
  const frame = {
    stage: safeStage,
    grammar: 'pressure-ribbon',
    stations,
    ribbon,
    creases,
    memory: inherited,
    pressureCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET,
    ruleCursor: inherited.at(-1)?.station ?? null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage > 0 && stage % 3 === 0) {
      memory = [...memory, pressureEvent(stage, memory, 'timeline-pressure')].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyPressure(frame, requestedStation = null, requestedForce = 0.82) {
  const event = pressureEvent(frame.stage, frame.memory, 'visitor-pressure', requestedStation, requestedForce);
  const nextMemory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  const next = buildFrame(frame.stage, nextMemory);
  return { ...next, pressure: event, priorMemory: copyMemory(frame.memory), interaction: 'material-crease' };
}

export function removeLatestPressure(frame) {
  if (Array.isArray(frame.priorMemory)) return buildFrame(frame.stage, frame.priorMemory);
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releasePressure() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  if (!frame?.ribbon) return '';
  const stations = frame.stations.map((station) => `${station.index}:${pointSignature(station)}:${station.width.toFixed(4)}:${station.role}`).join('|');
  const ribbon = frame.ribbon.points.map(pointSignature).join('|');
  const creases = frame.creases.map((crease) => `${crease.source}:${crease.remote}:${crease.force}:${crease.direction}`).join('|');
  return `${stations}::${ribbon}::${creases}`;
}
