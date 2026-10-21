export const SEED = 0x43504659;
export const STAGES = 15;
export const MEMORY_LIMIT = 4;
export const STATION_COUNT = 5;
export const PRIMITIVE_BUDGET = 35;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));

const STATION_LAYOUT = [
  { x: -0.54, y: -0.59, radialX: -0.22, radialY: -0.94, phase: 0.18 },
  { x: 0.50, y: -0.48, radialX: 0.74, radialY: -0.56, phase: 1.44 },
  { x: 0.73, y: 0.30, radialX: 0.94, radialY: 0.18, phase: 2.37 },
  { x: -0.02, y: 0.66, radialX: 0.18, radialY: 0.98, phase: 3.21 },
  { x: -0.71, y: 0.20, radialX: -0.92, radialY: 0.31, phase: 4.56 }
];

function seeded(index, stage = 0) {
  const value = Math.sin((index + 1) * 12.9898 + (stage + 1) * 78.233 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function baseStation(index, stage) {
  const layout = STATION_LAYOUT[index];
  return {
    index,
    x: layout.x + (seeded(index, stage) - 0.5) * 0.028,
    y: layout.y + (seeded(index + 11, stage) - 0.5) * 0.024,
    radialX: layout.radialX,
    radialY: layout.radialY,
    edge: 0,
    cut: 0,
    tilt: (seeded(index + 22, stage) - 0.5) * 0.12,
    phase: layout.phase,
    state: 'quiet'
  };
}

export function buildFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, STAGES - 1);
  return {
    composition: 'compound-delegation-shell',
    stage: safeStage,
    stations: Array.from({ length: STATION_COUNT }, (_, index) => baseStation(index, safeStage)),
    attention: Array.from({ length: STATION_COUNT }, () => 0),
    pendingStations: [],
    memory: [],
    commits: [],
    snapshots: [],
    interaction: 'waiting'
  };
}

function rounded(value) {
  return Number(value.toFixed(5));
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    stations: frame.stations.map((station) => [
      station.index,
      rounded(station.x),
      rounded(station.y),
      rounded(station.edge),
      rounded(station.cut),
      rounded(station.tilt),
      station.state
    ])
  });
}

function validIndex(value) {
  return clamp(integer(value), 0, STATION_COUNT - 1);
}

export function visitStation(frame, index = 0) {
  const next = clone(frame);
  const selected = validIndex(index);
  if (!next.pendingStations.includes(selected)) next.pendingStations.push(selected);
  next.attention[selected] += 1;
  next.interaction = next.pendingStations.length >= 3 ? 'quorum-armed' : 'attention-armed';
  return next;
}

function chooseDonor(frame) {
  return frame.pendingStations
    .map((index) => ({ index, score: frame.attention[index] + frame.stations[index].edge * 1.8 }))
    .sort((a, b) => b.score - a.score || ((a.index + frame.stage) % STATION_COUNT) - ((b.index + frame.stage) % STATION_COUNT))[0]?.index ?? 0;
}

function chooseReceiver(frame, donorIndex) {
  return frame.stations
    .map((station) => ({ index: station.index, score: frame.attention[station.index] + station.edge * 0.7 + station.cut * 0.3 }))
    .filter((entry) => entry.index !== donorIndex)
    .sort((a, b) => a.score - b.score || a.index - b.index)[0]?.index ?? ((donorIndex + 1) % STATION_COUNT);
}

function chooseCut(frame, donorIndex, receiverIndex) {
  const preferred = frame.pendingStations.find((index) => index !== donorIndex && index !== receiverIndex);
  if (preferred !== undefined) return preferred;
  return frame.stations
    .map((station) => station.index)
    .find((index) => index !== donorIndex && index !== receiverIndex) ?? 0;
}

export function commitQuorum(frame, options = {}) {
  const next = clone(frame);
  const observed = Array.isArray(options.indices)
    ? [...new Set(options.indices.map(validIndex))]
    : next.pendingStations.slice();
  if (observed.length < 3) {
    next.interaction = 'needs-quorum';
    return next;
  }

  next.pendingStations = observed.slice(0, STATION_COUNT);
  const donorIndex = chooseDonor(next);
  const receiverIndex = chooseReceiver(next, donorIndex);
  const cutIndex = chooseCut(next, donorIndex, receiverIndex);
  const snapshot = clone(frame);
  next.snapshots = [...frame.snapshots, snapshot].slice(-MEMORY_LIMIT);

  next.stations.forEach((station) => { station.state = 'quiet'; });
  const donor = next.stations[donorIndex];
  donor.edge = clamp(donor.edge - 0.28 - frame.memory.length * 0.035, -0.48, 0.66);
  donor.tilt += 0.12 + frame.memory.length * 0.018;
  donor.state = 'donor';

  const receiver = next.stations[receiverIndex];
  receiver.edge = clamp(receiver.edge + 0.34 + frame.memory.length * 0.04, -0.4, 0.9);
  receiver.tilt -= 0.17;
  receiver.state = 'receiver';

  const cut = next.stations[cutIndex];
  cut.cut = clamp(cut.cut + 0.32 + frame.memory.length * 0.045, 0, 0.9);
  cut.tilt += 0.2;
  cut.state = 'cut';

  const event = {
    source: 'visitor-quorum',
    kind: 'edge-delegation',
    roles: ['donor', 'receiver', 'cut'],
    donorIndex,
    receiverIndex,
    cutIndex,
    observed: observed.slice(0, 3),
    stage: next.stage
  };
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.commits = [...frame.commits, event].slice(-MEMORY_LIMIT);
  next.attention = frame.attention.map((value, index) => rounded(value + (observed.includes(index) ? 1 : 0)));
  next.stage = (frame.stage + 1) % STAGES;
  next.pendingStations = [];
  next.interaction = 'committed';
  return next;
}

export function liftLatest(frame) {
  if (!frame.snapshots.length) return clone(frame);
  const restored = clone(frame.snapshots.at(-1));
  restored.interaction = 'lifted';
  return restored;
}

export function releaseField(seed = 0) {
  return buildFrame(seed);
}
