export const SEED = 0x42525543;
export const STAGES = 15;
export const MEMORY_LIMIT = 4;
export const STATION_COUNT = 7;
export const PRIMITIVE_BUDGET = 28;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const wrapStation = (value) => ((Math.round(Number(value) || 0) % STATION_COUNT) + STATION_COUNT) % STATION_COUNT;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const copyEvent = (event) => ({ ...event });
const copyStation = (station) => ({ ...station });

function baseStations(stage) {
  const random = rng(SEED + stage * 17011);
  return Array.from({ length: STATION_COUNT }, (_, index) => {
    const amount = index / (STATION_COUNT - 1);
    const wave = Math.sin(amount * Math.PI * 1.45 + stage * 0.07) * 0.026;
    return {
      id: index,
      x: clamp(0.12 + amount * 0.76 + (random() - 0.5) * 0.018, 0.08, 0.92),
      y: clamp(0.5 + wave + (random() - 0.5) * 0.018, 0.18, 0.82),
      width: 0.15 + random() * 0.025,
      height: 0.18 + random() * 0.032,
      tilt: (random() - 0.5) * 0.3,
      mass: 0.48 + random() * 0.42,
      grain: 0.22 + random() * 0.68,
      notch: 0,
      aversion: 0,
      seam: 0,
      hue: [13, 31, 184, 204, 337, 48, 266][index]
    };
  });
}

function makeEvent(frame, station, source = 'visitor-departure') {
  const selected = wrapStation(station);
  const load = clamp(0.48 + frame.memory.length * 0.1, 0.48, 0.92);
  return {
    id: `${source}-${frame.stage}-${frame.memory.length}-${selected}`,
    stage: frame.stage,
    source,
    kind: 'witness-departure',
    station: selected,
    load,
    rule: 'witness-turns-paint'
  };
}

function applyEvent(stations, event, eventIndex) {
  const selected = wrapStation(event.station);
  const load = clamp(Number(event.load) || 0.5);
  return stations.map((station, index) => {
    const distance = index - selected;
    const downstream = distance > 0 ? clamp(1 - distance / (STATION_COUNT - selected + 0.4), 0, 1) : 0;
    const upstream = distance < 0 ? clamp(1 - Math.abs(distance) / (selected + 1.4), 0, 1) : 0;
    const local = index === selected ? 1 : 0;
    const turn = local * (0.22 + load * 0.18) + downstream * load * 0.055;
    const inheritedSeam = Math.sin((index + 1) * 1.7 + eventIndex * 0.8) * downstream * load * 0.018;
    return {
      ...station,
      x: clamp(station.x - local * load * 0.018 + downstream * load * 0.026, 0.06, 0.94),
      y: clamp(station.y - local * load * 0.055 + downstream * inheritedSeam - upstream * load * 0.012, 0.12, 0.88),
      width: clamp(station.width * (1 - local * load * 0.08 + downstream * load * 0.045), 0.08, 0.23),
      height: clamp(station.height * (1 + local * load * 0.13 + downstream * load * 0.028), 0.1, 0.29),
      tilt: station.tilt - local * (0.38 + load * 0.28) + downstream * load * 0.17 + upstream * load * 0.025,
      mass: clamp(station.mass - local * load * 0.12 + downstream * load * 0.11, 0.16, 1),
      notch: clamp(station.notch + local * (0.24 + load * 0.12), 0, 0.72),
      aversion: clamp(station.aversion + local * (0.3 + load * 0.12), 0, 0.9),
      seam: clamp(station.seam + downstream * load * 0.34 + local * load * 0.12, 0, 1)
    };
  });
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let stations = baseStations(safeStage);
  inherited.forEach((event, index) => {
    stations = applyEvent(stations, event, index);
  });
  return {
    stage: safeStage,
    memory: inherited,
    stations,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'svg-witness-turning-ribbon'
  };
}

function automaticWitness(stage, frame) {
  const random = rng(SEED + stage * 4217);
  return makeEvent(frame, Math.floor(random() * STATION_COUNT), 'autonomous-witness');
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1) memory = [...memory, automaticWitness(stage, frame)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyWitnessDeparture(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const station = wrapStation(input.station);
  const previous = baseline.memory.at(-1);
  if (previous && previous.station === station) {
    return { ...baseline, interaction: 'witness-refused' };
  }
  const event = makeEvent(baseline, station, input.source || 'visitor-departure');
  return {
    ...buildFrame(baseline.stage, [...baseline.memory, event]),
    interaction: 'witness-departed',
    restoreMemory: baseline.memory.map(copyEvent)
  };
}

export function liftLatestWitness(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'witness-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'witness-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'witness-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.stations.map(({ id, x, y, width, height, tilt, mass, notch, aversion, seam }) => ({
    id,
    x: Number(x.toFixed(7)),
    y: Number(y.toFixed(7)),
    width: Number(width.toFixed(7)),
    height: Number(height.toFixed(7)),
    tilt: Number(tilt.toFixed(7)),
    mass: Number(mass.toFixed(7)),
    notch: Number(notch.toFixed(7)),
    aversion: Number(aversion.toFixed(7)),
    seam: Number(seam.toFixed(7))
  })));
}

export function stationPoints(station, index = 0) {
  const points = [];
  const count = 10;
  const seedPhase = index * 0.73 + station.grain * 2.1;
  for (let pointIndex = 0; pointIndex < count; pointIndex += 1) {
    const angle = (pointIndex / count) * Math.PI * 2;
    const notchWindow = Math.exp(-Math.pow((angle + Math.PI * 0.68) / 0.48, 2));
    const notch = station.notch * notchWindow;
    const radial = 1 - notch * 0.48;
    const ripple = 1 + Math.sin(seedPhase + pointIndex * 1.7) * station.grain * 0.07;
    const localX = Math.cos(angle) * station.width * radial * ripple;
    const localY = Math.sin(angle) * station.height * radial * ripple;
    const cos = Math.cos(station.tilt);
    const sin = Math.sin(station.tilt);
    points.push({
      x: clamp(station.x + localX * cos - localY * sin, 0.01, 0.99),
      y: clamp(station.y + localX * sin + localY * cos, 0.01, 0.99)
    });
  }
  return points;
}
