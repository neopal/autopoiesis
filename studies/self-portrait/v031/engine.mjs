export const SEED = 0x435031;
export const STAGES = 15;
export const MEMORY_LIMIT = 4;
export const BAND_COUNT = 13;
export const PRIMITIVE_BUDGET = 28;
export const MIN_PRESSURE_MS = 140;
export const MAX_PRESSURE_MS = 720;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));

function seeded(index, stage = 0) {
  const value = Math.sin((index + 1) * 23.173 + (stage + 1) * 47.917 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function rounded(value) {
  return Number(value.toFixed(5));
}

function baseBand(index, stage) {
  const center = index / (BAND_COUNT - 1);
  return {
    index,
    x: Number((0.12 + center * 0.76).toFixed(5)),
    y: Number((0.14 + seeded(index, stage) * 0.7).toFixed(5)),
    width: Number((0.045 + seeded(index + 13, stage) * 0.09).toFixed(5)),
    height: Number((0.22 + seeded(index + 26, stage) * 0.38).toFixed(5)),
    bend: Number(((seeded(index + 39, stage) - 0.5) * 0.34).toFixed(5)),
    gap: Number((0.04 + seeded(index + 52, stage) * 0.08).toFixed(5)),
    density: Number((0.24 + seeded(index + 65, stage) * 0.62).toFixed(5)),
    phase: Number((seeded(index + 78, stage) * Math.PI * 2).toFixed(5)),
    attention: 0,
    state: 'quiet'
  };
}

export function buildFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, STAGES - 1);
  return {
    composition: 'checksum-membrane',
    stage: safeStage,
    load: 0,
    bands: Array.from({ length: BAND_COUNT }, (_, index) => baseBand(index, safeStage)),
    memory: [],
    snapshots: [],
    interaction: 'waiting'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    load: rounded(frame.load),
    bands: frame.bands.map((band) => [
      band.index,
      rounded(band.x),
      rounded(band.y),
      rounded(band.width),
      rounded(band.height),
      rounded(band.bend),
      rounded(band.gap),
      rounded(band.density),
      rounded(band.phase),
      band.state
    ])
  });
}

function distinctRoleIndices(probeIndex, stage) {
  const shedIndex = (probeIndex + 2 + stage) % BAND_COUNT;
  const donorIndex = (shedIndex + 4 + stage) % BAND_COUNT;
  const relayIndex = (donorIndex + 5 + stage) % BAND_COUNT;
  return { shedIndex, donorIndex, relayIndex };
}

export function probe(frame, options = {}) {
  const duration = Number(options.duration);
  if (!Number.isFinite(duration) || duration < MIN_PRESSURE_MS || duration > MAX_PRESSURE_MS) {
    const refused = clone(frame);
    refused.interaction = 'refused';
    return { accepted: false, frame: refused, reason: 'outside-calibration-window' };
  }

  const next = clone(frame);
  const probeIndex = clamp(integer(options.targetIndex), 0, BAND_COUNT - 1);
  const { shedIndex, donorIndex, relayIndex } = distinctRoleIndices(probeIndex, frame.stage);
  const snapshot = clone(frame);
  const loadDelta = 0.1 + (duration / MAX_PRESSURE_MS) * 0.18;

  next.snapshots = [...frame.snapshots, snapshot].slice(-MEMORY_LIMIT);
  next.bands.forEach((band) => {
    band.state = 'quiet';
    band.attention += band.index === probeIndex ? 1 : 0;
    band.density = Number(clamp(band.density + (band.index === relayIndex ? 0.035 : 0), 0.08, 0.98).toFixed(5));
  });

  const shed = next.bands[shedIndex];
  shed.state = 'shed';
  shed.gap = Number(clamp(shed.gap + 0.075 + next.load * 0.02, 0.02, 0.34).toFixed(5));
  shed.height = Number(clamp(shed.height - 0.06, 0.12, 0.78).toFixed(5));
  shed.bend = Number(clamp(shed.bend - 0.035, -0.48, 0.48).toFixed(5));

  const donor = next.bands[donorIndex];
  donor.state = 'opened';
  donor.gap = Number(clamp(donor.gap - 0.026, 0.01, 0.34).toFixed(5));
  donor.height = Number(clamp(donor.height + 0.095, 0.12, 0.82).toFixed(5));
  donor.bend = Number(clamp(donor.bend + 0.06, -0.48, 0.48).toFixed(5));

  const relay = next.bands[relayIndex];
  relay.state = 'inherited';
  relay.width = Number(clamp(donor.width * 0.92, 0.035, 0.18).toFixed(5));
  relay.density = Number(clamp(donor.density + 0.08, 0.08, 0.98).toFixed(5));
  relay.phase = donor.phase;
  relay.bend = Number(clamp(donor.bend * -0.78, -0.48, 0.48).toFixed(5));

  const event = {
    kind: 'checksum-revision',
    duration,
    probeIndex,
    targetIndex: shedIndex,
    donorIndex,
    relayIndex,
    stage: next.stage,
    loadBefore: rounded(frame.load),
    loadAfter: rounded(clamp(frame.load + loadDelta, 0, 0.98))
  };
  next.load = rounded(clamp(frame.load + loadDelta, 0, 0.98));
  next.stage = (frame.stage + 1) % STAGES;
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.interaction = 'committed';
  return { accepted: true, frame: next, event };
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

export function buildTimeline() {
  let frame = buildFrame(0);
  const frames = [frame];
  const durations = [260, 420, 320, 500];
  const targets = [2, 8, 5, 10];
  for (let index = 0; index < MEMORY_LIMIT; index += 1) {
    frame = probe(frame, { duration: durations[index], targetIndex: targets[index] }).frame;
    frames.push(frame);
  }
  return frames;
}
