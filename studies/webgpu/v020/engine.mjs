export const SEED = 0x57473230;
export const STAGES = 17;
export const SLICES = 9;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 42;

const AUTO_CUES = [
  { slice: 1, pressure: 0.48 },
  { slice: 6, pressure: 0.72 },
  { slice: 3, pressure: 0.96 },
  { slice: 8, pressure: 1.2 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampInt = (value, min, max) => Math.round(clamp(Number.isFinite(Number(value)) ? Number(value) : min, min, max));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const copy = (value) => JSON.parse(JSON.stringify(value));

const baseSlices = () => Array.from({ length: SLICES }, (_, id) => ({
  id,
  x: Number((-0.42 + id * 0.105).toFixed(5)),
  y: Number((0.18 + (id % 3) * 0.026).toFixed(5)),
  depth: Number((0.22 + id * 0.045).toFixed(5)),
  width: Number((0.22 + (id % 4) * 0.012).toFixed(5)),
  height: Number((0.34 + (id % 3) * 0.025).toFixed(5)),
  slant: Number(((id - 4) * 0.018).toFixed(5)),
  fold: 0,
  gap: 0,
  seal: 0,
  load: 0,
  phase: Number((id * 0.17).toFixed(5))
}));

const normalizeCue = (cue = {}) => ({
  slice: clampInt(cue.slice, 0, SLICES - 1),
  pressure: Number(clamp(finite(cue.pressure, 0.72), 0.2, 1.4).toFixed(4))
});

const normalizeEvent = (event = {}, serial = 0) => ({
  id: `pulse-${serial}`,
  source: event.source || 'replayed-pulse',
  mode: 'crease-pulse',
  cue: normalizeCue(event.cue || event),
  serial
});

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const buildSheet = (memory) => {
  const slices = baseSlices();
  const faults = [];
  const seals = [];
  const events = [];
  let binder = 0;

  memory.forEach((rawEvent, serial) => {
    const event = normalizeEvent(rawEvent, serial);
    const source = slices[event.cue.slice];
    const replyId = (source.id + 4 + serial * 2) % SLICES;
    const reply = slices[replyId];
    const resistance = 1 + binder * 0.16 + serial * 0.08;
    const effective = event.cue.pressure / resistance;
    const fold = 0.18 + effective * 0.2;
    const gap = 0.08 + effective * 0.16;
    const seal = 0.1 + effective * 0.18;
    const direction = serial % 2 === 0 ? 1 : -1;

    source.fold += direction * fold;
    source.gap = Math.min(0.66, source.gap + gap);
    source.load += effective;
    source.slant += direction * (0.018 + effective * 0.035);
    source.phase += 0.08 + effective * 0.04;
    reply.seal = Math.min(0.68, reply.seal + seal);
    reply.fold -= direction * (0.08 + effective * 0.11);
    reply.load += effective * 0.42;
    reply.slant -= direction * (0.012 + effective * 0.022);
    reply.phase -= 0.05 + effective * 0.02;

    slices.forEach((slice) => {
      if (slice.id !== source.id && slice.id !== reply.id) {
        const between = Math.abs(slice.id - source.id) / (SLICES - 1);
        slice.slant += direction * (0.002 + effective * 0.006) * (1 - between);
        slice.load += effective * 0.012;
      }
    });

    binder += event.cue.pressure * (0.24 + serial * 0.08);
    const fault = {
      slice: source.id,
      serial,
      gap: Number(source.gap.toFixed(5)),
      fold: Number(source.fold.toFixed(5)),
      load: Number(source.load.toFixed(5))
    };
    const sealed = {
      slice: reply.id,
      answeredFrom: source.id,
      serial,
      seal: Number(reply.seal.toFixed(5)),
      load: Number(reply.load.toFixed(5))
    };
    faults.push(fault);
    seals.push(sealed);
    events.push({ ...event, sourceSlice: source.id, replySlice: reply.id, fault, sealed, resistance: Number(resistance.toFixed(5)) });
  });

  const signature = JSON.stringify({
    binder: Number(binder.toFixed(5)),
    slices: slices.map((slice) => [
      slice.id,
      Number(slice.x.toFixed(5)),
      Number(slice.y.toFixed(5)),
      Number(slice.depth.toFixed(5)),
      Number(slice.width.toFixed(5)),
      Number(slice.height.toFixed(5)),
      Number(slice.slant.toFixed(5)),
      Number(slice.fold.toFixed(5)),
      Number(slice.gap.toFixed(5)),
      Number(slice.seal.toFixed(5)),
      Number(slice.load.toFixed(5)),
      Number(slice.phase.toFixed(5))
    ])
  });

  return {
    slices,
    faults,
    seals,
    events,
    binder: Number(binder.toFixed(5)),
    signature
  };
};

export const buildFrame = (stage = 0, memory = [], armedSlice = 0) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armedSlice: clampInt(armedSlice, 0, SLICES - 1),
    sheet: buildSheet(normalizedMemory),
    archive: normalizedMemory.map((event, index) => ({
      index,
      id: event.id,
      mode: event.mode,
      cue: copy(event.cue)
    }))
  };
};

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const memory = AUTO_CUES.slice(0, Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 4)))
    .map((cue, index) => ({ cue, source: 'auto-pulse', index }));
  return buildFrame(stage, memory, stage % SLICES);
});

export const armSlice = (frame, cue = defaultCue()) => ({
  ...frame,
  armedSlice: normalizeCue(cue).slice
});

export const pulseSheet = (frame, cue = defaultCue()) => {
  if (frame.memory.length >= MEMORY_LIMIT) return frame;
  const event = normalizeEvent({ cue, source: 'visitor-pulse' }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], event.cue.slice);
};

export const liftLatestPulse = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), frame.armedSlice);
export const releaseSheet = () => buildFrame(0, [], 0);
export const defaultCue = () => copy(AUTO_CUES[0]);
export const geometrySignature = (frame) => JSON.stringify({
  sheet: frame.sheet.signature,
  faults: frame.sheet.faults,
  seals: frame.sheet.seals
});
