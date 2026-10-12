export const SEED = 0x57473237;
export const STAGES = 17;
export const BASIN_COUNT = 9;
export const CHANNEL_COUNT = 12;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 72;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clampInt = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, max) => ((value % max) + max) % max;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};

const CHANNELS = [
  [0, 1], [1, 2], [2, 5], [5, 8], [8, 7], [7, 6], [6, 3], [3, 0],
  [1, 4], [4, 7], [3, 4], [4, 5]
];

const normalizeTrace = (trace = [], fallback = 0) => {
  const values = Array.isArray(trace) ? trace : [];
  const unique = [...new Set(values.map((value) => clampInt(value, 0, BASIN_COUNT - 1)))];
  return unique.length ? unique : [clampInt(fallback, 0, BASIN_COUNT - 1)];
};

const normalizeWake = (raw = {}, serial = 0) => ({
  id: `wake-${serial}`,
  mode: 'collective-wake',
  source: clampInt(raw.source ?? raw.basin, 0, BASIN_COUNT - 1),
  trace: normalizeTrace(raw.trace, raw.source ?? raw.basin),
  travel: round(clamp(finite(raw.travel, 0), 0, 1)),
  elected: clampInt(raw.elected, 0, BASIN_COUNT - 1),
  relay: clampInt(raw.relay, 0, BASIN_COUNT - 1),
  serial
});

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeWake(event, index));

const baseBasins = () => Array.from({ length: BASIN_COUNT }, (_, id) => {
  const column = id % 3;
  const row = Math.floor(id / 3);
  return {
    id,
    x: round(-0.62 + column * 0.61 + (pseudo(id + 3) - 0.5) * 0.13),
    y: round(-0.56 + row * 0.55 + (pseudo(id + 17) - 0.5) * 0.15),
    z: round(-0.45 + pseudo(id + 31) * 0.9),
    radius: round(0.11 + pseudo(id + 47) * 0.07),
    depth: round(0.3 + pseudo(id + 61) * 0.7),
    phase: round(pseudo(id + 73) * Math.PI * 2),
    scale: 1,
    swell: 0,
    contraction: 0,
    relay: 0,
    driftX: 0,
    driftY: 0,
    opening: 0
  };
});

const baseChannels = () => CHANNELS.map(([from, to], id) => ({
  id,
  from,
  to,
  opening: 0,
  current: round(0.22 + pseudo(id + 89) * 0.46),
  bend: 0,
  lift: 0
}));

const attentionScores = (memory) => {
  const scores = Array.from({ length: BASIN_COUNT }, () => 0);
  memory.forEach((event) => event.trace.forEach((basin) => { scores[basin] += 1 + event.travel * 0.5; }));
  return scores;
};

const chooseElected = (memory, source) => {
  const scores = attentionScores(memory);
  return Array.from({ length: BASIN_COUNT }, (_, id) => id)
    .filter((id) => id !== source)
    .sort((a, b) => scores[a] - scores[b] || wrap(a - (source + 3), BASIN_COUNT) - wrap(b - (source + 3), BASIN_COUNT))[0] ?? wrap(source + 1, BASIN_COUNT);
};

const chooseRelay = (source, elected, serial) => {
  const candidate = wrap(elected + 3 + serial * 2, BASIN_COUNT);
  if (candidate !== source && candidate !== elected) return candidate;
  return wrap(candidate + 1, BASIN_COUNT);
};

const channelIndex = (from, to, serial) => {
  const direct = CHANNELS.findIndex(([a, b]) => (a === from && b === to) || (a === to && b === from));
  return direct >= 0 ? direct : wrap(from * 2 + to + serial, CHANNEL_COUNT);
};

const buildField = (memory) => {
  const basins = baseBasins();
  const channels = baseChannels();
  const routeHistory = [];

  normalizeMemory(memory).forEach((event, serial) => {
    const source = event.source;
    const elected = event.elected;
    const relay = event.relay;
    const force = 0.42 + event.travel * 0.48 + serial * 0.075;
    const direction = serial % 2 === 0 ? -1 : 1;
    const sourceBasin = basins[source];
    const electedBasin = basins[elected];
    const relayBasin = basins[relay];

    sourceBasin.contraction = round(sourceBasin.contraction + force);
    sourceBasin.scale = round(sourceBasin.scale - force * 0.17);
    sourceBasin.driftX = round(sourceBasin.driftX + direction * 0.035);
    sourceBasin.driftY = round(sourceBasin.driftY - 0.018 - serial * 0.004);
    sourceBasin.opening = round(sourceBasin.opening + force * 0.25);

    electedBasin.swell = round(electedBasin.swell + force * 1.1);
    electedBasin.scale = round(electedBasin.scale + force * 0.2);
    electedBasin.driftX = round(electedBasin.driftX - direction * 0.028);
    electedBasin.driftY = round(electedBasin.driftY + 0.022 + serial * 0.004);
    electedBasin.opening = round(electedBasin.opening + force * 0.55);

    relayBasin.relay = round(relayBasin.relay + force * 0.86);
    relayBasin.scale = round(relayBasin.scale + force * 0.07);
    relayBasin.driftX = round(relayBasin.driftX + direction * 0.022);
    relayBasin.driftY = round(relayBasin.driftY + direction * 0.028);
    relayBasin.opening = round(relayBasin.opening + force * 0.2);

    const firstChannel = channelIndex(source, elected, serial);
    const secondChannel = channelIndex(elected, relay, serial + 2);
    [firstChannel, secondChannel].forEach((index, channelOrder) => {
      const channel = channels[index];
      channel.opening = round(channel.opening + force * (channelOrder ? 0.58 : 0.82));
      channel.current = round(channel.current + direction * force * 0.09);
      channel.bend = round(channel.bend + direction * (0.16 + force * 0.12));
      channel.lift = round(channel.lift + force * (channelOrder ? 0.1 : 0.16));
    });

    channels.forEach((channel) => {
      if (event.trace.includes(channel.from) || event.trace.includes(channel.to)) {
        channel.bend = round(channel.bend + direction * 0.018 * event.travel);
      }
    });
    routeHistory.push(`${source}>${elected}>${relay}>${round(force)}`);
  });

  const signature = JSON.stringify({
    route: routeHistory.join('|') || 'quiet',
    basins: basins.map((basin) => [basin.id, basin.x, basin.y, basin.z, basin.scale, basin.swell, basin.contraction, basin.relay, basin.driftX, basin.driftY, basin.opening]),
    channels: channels.map((channel) => [channel.from, channel.to, channel.opening, channel.current, channel.bend, channel.lift])
  });
  return { basins, channels, route: routeHistory.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], armed = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armed: armed ? {
      basin: clampInt(armed.basin, 0, BASIN_COUNT - 1),
      trace: normalizeTrace(armed.trace, armed.basin),
      travel: round(clamp(finite(armed.travel, 0), 0, 1)),
      startedAt: finite(armed.startedAt, 0)
    } : null,
    lastAction,
    field: buildField(normalizedMemory)
  };
};

const AUTO_WAKES = [
  { basin: 4, trace: [4, 5, 8], travel: 0.62 },
  { basin: 7, trace: [7, 3, 0], travel: 0.58 },
  { basin: 1, trace: [1, 4, 8], travel: 0.81 },
  { basin: 6, trace: [6, 5, 2], travel: 0.67 }
];

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const count = Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 4));
  const memory = [];
  for (let serial = 0; serial < count; serial += 1) {
    const raw = AUTO_WAKES[serial];
    const source = clampInt(raw.basin, 0, BASIN_COUNT - 1);
    const elected = chooseElected(memory, source);
    memory.push(normalizeWake({ ...raw, source, elected, relay: chooseRelay(source, elected, serial) }, serial));
  }
  return buildFrame(stage, memory, null, stage === 0 ? 'quiet' : 'settled-preview');
});

export const armWitness = (frame, witness = {}, startedAt = 0) => ({
  ...frame,
  armed: {
    basin: clampInt(witness.basin, 0, BASIN_COUNT - 1),
    trace: normalizeTrace(witness.trace, witness.basin),
    travel: round(clamp(finite(witness.travel, 0), 0, 1)),
    startedAt: finite(witness.startedAt, startedAt)
  },
  lastAction: 'witness-armed'
});

export const commitWake = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, lastAction: 'memory-limit' };
  const candidate = frame.armed ?? input;
  const source = clampInt(candidate.basin ?? candidate.source, 0, BASIN_COUNT - 1);
  const trace = normalizeTrace(candidate.trace, source);
  const travel = clamp(finite(candidate.travel, 0), 0, 1);
  if (trace.length < 3 || travel < 0.18) return { ...frame, lastAction: 'wake-refused-shallow' };
  const elected = chooseElected(frame.memory, source);
  const relay = chooseRelay(source, elected, frame.memory.length);
  const event = normalizeWake({ source, trace, travel, elected, relay }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'wake-committed');
};

export const liftLatestWake = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'wake-lifted');
export const releaseVolume = () => buildFrame(0, [], null, 'volume-released');
export const defaultWake = () => ({ ...AUTO_WAKES[0] });
export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, basins: frame.field.basins, channels: frame.field.channels });
