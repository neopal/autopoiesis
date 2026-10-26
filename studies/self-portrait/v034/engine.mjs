export const SEED = 0x503034;
export const MEMORY_LIMIT = 4;
export const SIGNAL_COUNT = 4;
export const RIB_COUNT = 10;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(5));

function seeded(index, stage = 0) {
  const value = Math.sin((index + 1) * 13.719 + (stage + 1) * 29.113 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function baseRib(index, stage) {
  const lane = index % 5;
  const side = index < RIB_COUNT / 2 ? -1 : 1;
  return {
    index,
    lane,
    side,
    y: rounded(-0.82 + lane * 0.4 + (seeded(index, stage) - 0.5) * 0.12),
    span: rounded(0.34 + seeded(index + 17, stage) * 0.42),
    thickness: rounded(0.06 + seeded(index + 31, stage) * 0.12),
    bend: rounded((seeded(index + 43, stage) - 0.5) * 0.46),
    notch: rounded(0.08 + seeded(index + 59, stage) * 0.2),
    shear: rounded((seeded(index + 71, stage) - 0.5) * 0.26),
    depth: rounded(0.18 + seeded(index + 83, stage) * 0.5),
    split: rounded(0.18 + seeded(index + 97, stage) * 0.34),
    state: 'quiet'
  };
}

export function buildFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, 7);
  return {
    composition: 'forecast-loom',
    stage: safeStage,
    revision: 0,
    loom: { tilt: 0.04, tension: 0.2, aperture: 0.18, offset: 0 },
    ribs: Array.from({ length: RIB_COUNT }, (_, index) => baseRib(index, safeStage)),
    forecast: null,
    confidence: 0,
    memory: [],
    snapshots: [],
    interaction: 'waiting'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    revision: frame.revision,
    loom: Object.values(frame.loom).map(rounded),
    ribs: frame.ribs.map((rib) => [
      rib.index,
      rounded(rib.y),
      rounded(rib.span),
      rounded(rib.thickness),
      rounded(rib.bend),
      rounded(rib.notch),
      rounded(rib.shear),
      rounded(rib.depth),
      rounded(rib.split),
      rib.state
    ])
  });
}

export function decisionSignature(frame) {
  return JSON.stringify({
    forecast: frame.forecast,
    confidence: rounded(frame.confidence),
    memory: frame.memory,
    interaction: frame.interaction
  });
}

function safeSignal(value) {
  const candidate = integer(value, -1);
  return candidate >= 0 && candidate < SIGNAL_COUNT ? candidate : null;
}

function nextForecast(signal, forecast, revision) {
  return (signal * 3 + forecast + revision * 2 + 1) % SIGNAL_COUNT;
}

function remoteIndex(signal, revision, offset) {
  return (signal * 2 + revision * 3 + offset) % RIB_COUNT;
}

function mutateRib(rib, role, signal, revision, errorIndex, receiverIndex) {
  const next = { ...rib };
  const direction = signal === 0 ? -1 : signal === 2 ? 1 : signal === 1 ? 0.55 : -0.55;
  const distance = Math.abs(rib.index - receiverIndex);
  const ripple = Math.sin((rib.index + 1) * 0.9 + revision * 1.7 + signal) * 0.012;
  next.bend = rounded(clamp(rib.bend + direction * 0.018 + ripple, -0.72, 0.72));
  next.shear = rounded(clamp(rib.shear + direction * 0.012 + (rib.index % 2 ? -0.006 : 0.006), -0.42, 0.42));
  next.depth = rounded(clamp(rib.depth + 0.012 + (distance < 4 ? 0.008 : 0), 0.08, 0.92));
  next.state = 'quiet';

  if (role === 'confirmed') {
    next.span = rounded(clamp(rib.span + 0.13 + revision * 0.012, 0.22, 0.96));
    next.thickness = rounded(clamp(rib.thickness + 0.055, 0.04, 0.28));
    next.notch = rounded(clamp(rib.notch - 0.035, 0.03, 0.36));
    next.split = rounded(clamp(rib.split + 0.11, 0.08, 0.8));
    next.state = 'confirmed';
  } else if (role === 'error') {
    next.span = rounded(clamp(rib.span - 0.09, 0.18, 0.86));
    next.thickness = rounded(clamp(rib.thickness + 0.025, 0.04, 0.28));
    next.notch = rounded(clamp(rib.notch + 0.095, 0.04, 0.42));
    next.split = rounded(clamp(rib.split + 0.18, 0.08, 0.86));
    next.bend = rounded(clamp(next.bend - direction * 0.08, -0.72, 0.72));
    next.state = 'error';
  } else if (role === 'counterfactual') {
    next.y = rounded(clamp(rib.y + (rib.side < 0 ? -0.08 : 0.08), -0.94, 0.94));
    next.span = rounded(clamp(rib.span + 0.06, 0.2, 0.94));
    next.thickness = rounded(clamp(rib.thickness - 0.025, 0.035, 0.24));
    next.shear = rounded(clamp(next.shear + (rib.side < 0 ? 0.11 : -0.11), -0.42, 0.42));
    next.split = rounded(clamp(next.split - 0.07, 0.06, 0.8));
    next.state = 'counterfactual';
  } else if (role === 'witness') {
    next.notch = rounded(clamp(rib.notch + 0.035, 0.04, 0.42));
    next.thickness = rounded(clamp(rib.thickness - 0.012, 0.035, 0.24));
    next.state = 'witness';
  }
  if (rib.index === errorIndex && role === 'quiet') next.state = 'error';
  return next;
}

export function registerSignal(frame, signal) {
  const nextSignal = safeSignal(signal);
  if (nextSignal === null) {
    const refused = clone(frame);
    refused.interaction = 'refused';
    return { accepted: false, frame: refused, reason: 'invalid-signal' };
  }

  if (frame.forecast === null) {
    const seededFrame = clone(frame);
    seededFrame.forecast = nextSignal;
    seededFrame.confidence = rounded(0.24 + nextSignal * 0.05);
    seededFrame.interaction = 'forecasting';
    return { accepted: false, frame: seededFrame, reason: 'forecast-seeded' };
  }

  const forecast = frame.forecast;
  const confirmed = forecast === nextSignal;
  const revision = frame.revision + 1;
  const receiverIndex = remoteIndex(forecast, revision, 4);
  const errorIndex = remoteIndex(nextSignal, revision, 7);
  const counterfactualIndex = (errorIndex + 3 + forecast) % RIB_COUNT;
  const witnessIndex = (receiverIndex + 2 + nextSignal) % RIB_COUNT;
  const next = clone(frame);
  const snapshot = clone(frame);
  next.snapshots = [...frame.snapshots, snapshot].slice(-MEMORY_LIMIT);
  next.revision = revision;
  next.stage = (frame.stage + 1) % 8;
  next.loom = {
    tilt: rounded(clamp(frame.loom.tilt + (confirmed ? 0.035 : -0.055) * (forecast % 2 ? -1 : 1), -0.48, 0.48)),
    tension: rounded(clamp(frame.loom.tension + (confirmed ? 0.075 : 0.11), 0.14, 0.86)),
    aperture: rounded(clamp(frame.loom.aperture + (confirmed ? 0.035 : 0.09), 0.1, 0.72)),
    offset: rounded(clamp(frame.loom.offset + (confirmed ? 0.025 : -0.045) * (nextSignal % 2 ? 1 : -1), -0.42, 0.42))
  };
  next.ribs = frame.ribs.map((rib) => {
    let role = 'quiet';
    if (confirmed && rib.index === receiverIndex) role = 'confirmed';
    else if (!confirmed && rib.index === errorIndex) role = 'error';
    else if (!confirmed && rib.index === counterfactualIndex) role = 'counterfactual';
    else if (rib.index === witnessIndex) role = 'witness';
    return mutateRib(rib, role, nextSignal, revision, errorIndex, receiverIndex);
  });
  next.forecast = nextForecast(nextSignal, forecast, revision);
  next.confidence = rounded(clamp(confirmed ? frame.confidence + 0.18 : frame.confidence * 0.42, 0.08, 0.96));
  const event = {
    kind: confirmed ? 'forecast-confirmed' : 'forecast-mismatch',
    signal: nextSignal,
    forecast,
    receiverIndex,
    errorIndex,
    counterfactualIndex,
    witnessIndex,
    revision,
    nextForecast: next.forecast
  };
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.interaction = confirmed ? 'confirmed' : 'mismatch';
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
  const firstSignals = [0, 1, 2, 3];
  for (const [index, signal] of firstSignals.entries()) {
    if (frame.forecast === null) frame = registerSignal(frame, signal).frame;
    const actual = index % 2 === 0 ? (frame.forecast + 2) % SIGNAL_COUNT : frame.forecast;
    frame = registerSignal(frame, actual).frame;
    frames.push(frame);
  }
  return frames;
}
