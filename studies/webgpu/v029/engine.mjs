export const SEED = 0x57473239;
export const STAGES = 9;
export const FIBER_COUNT = 18;
export const STRAND_COUNT = 3;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 54;
export const MIN_SPAN = 0.12;
export const MIN_DURATION = 90;
export const MAX_DURATION = 1400;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const int = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, max) => ((value % max) + max) % max;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizePosition = (value) => clamp(finite(value, 0), 0, 1);
const normalizeBand = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const candidate = Number(value);
  return Number.isFinite(candidate) ? int(candidate, 0, FIBER_COUNT - 1) : null;
};

const normalizeEvent = (raw = {}, serial = 0) => ({
  id: `compression-${serial}`,
  mode: 'redistributed-compression',
  startBand: normalizeBand(raw.startBand) ?? 0,
  endBand: normalizeBand(raw.endBand) ?? FIBER_COUNT - 1,
  knot: normalizeBand(raw.knot) ?? 5,
  counter: normalizeBand(raw.counter) ?? 11,
  silent: normalizeBand(raw.silent) ?? 15,
  force: round(clamp(finite(raw.force, 0.62), 0.32, 1)),
  span: round(clamp(finite(raw.span, 0.5), MIN_SPAN, 1)),
  serial
});

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const baseFibers = () => Array.from({ length: FIBER_COUNT }, (_, id) => {
  const strand = id % STRAND_COUNT;
  const step = Math.floor(id / STRAND_COUNT);
  return {
    id,
    strand,
    step,
    x: round(0.1 + step * 0.16 + (pseudo(id + 11) - 0.5) * 0.035),
    y: round(0.22 + strand * 0.27 + Math.sin(step * 0.82 + strand * 1.7) * 0.085 + (pseudo(id + 23) - 0.5) * 0.028),
    phase: round(pseudo(id + 37) * Math.PI * 2),
    width: round(0.024 + pseudo(id + 41) * 0.018),
    pressure: 0,
    slip: 0,
    gap: 0,
    wake: 0,
    shear: 0
  };
});

const attentionScores = (memory) => {
  const scores = Array.from({ length: FIBER_COUNT }, () => 0);
  memory.forEach((event, serial) => {
    scores[event.knot] += 3 + serial * 0.35;
    scores[event.counter] += 1.1;
    scores[event.silent] += 0.4;
    scores[event.startBand] += 0.2;
    scores[event.endBand] += 0.2;
  });
  return scores;
};

const chooseLeastLoaded = (memory, forbidden = []) => {
  const scores = attentionScores(memory);
  const blocked = new Set(forbidden);
  return Array.from({ length: FIBER_COUNT }, (_, id) => id)
    .filter((id) => !blocked.has(id))
    .sort((a, b) => scores[a] - scores[b] || pseudo(a + memory.length * 17) - pseudo(b + memory.length * 17))[0] ?? 0;
};

const chooseRoles = (memory, startBand, endBand) => {
  const knot = chooseLeastLoaded(memory, [startBand, endBand]);
  const counter = chooseLeastLoaded(memory, [startBand, endBand, knot]);
  const silent = chooseLeastLoaded(memory, [startBand, endBand, knot, counter]);
  return { knot, counter, silent };
};

const buildField = (memory) => {
  const fibers = baseFibers();
  const route = [];

  normalizeMemory(memory).forEach((event, serial) => {
    const force = event.force + serial * 0.075;
    const direction = serial % 2 === 0 ? 1 : -1;
    const knot = fibers[event.knot];
    const counter = fibers[event.counter];
    const silent = fibers[event.silent];
    const bridge = fibers[wrap(event.knot + event.counter + serial + 2, FIBER_COUNT)];

    knot.pressure = round(knot.pressure + force);
    knot.slip = round(knot.slip + direction * force * 0.72);
    knot.shear = round(knot.shear + force * 0.52);
    knot.wake = round(knot.wake + force * 0.35);

    counter.pressure = round(counter.pressure + force * 0.58);
    counter.slip = round(counter.slip - direction * force * 0.9);
    counter.shear = round(counter.shear - force * 0.37);
    counter.wake = round(counter.wake + force * 0.28);

    silent.gap = round(Math.min(0.82, silent.gap + force * 0.72));
    silent.slip = round(silent.slip + direction * force * 0.2);
    silent.shear = round(silent.shear + force * 0.24);

    bridge.wake = round(bridge.wake + force * 0.14);
    bridge.slip = round(bridge.slip - direction * force * 0.18);
    route.push(`${event.startBand}>${event.endBand}>${event.knot}>${event.counter}>${event.silent}>${round(force)}`);
  });

  const signature = JSON.stringify({
    route: route.join('|') || 'quiet',
    fibers: fibers.map((fiber) => [fiber.id, fiber.pressure, fiber.slip, fiber.gap, fiber.wake, fiber.shear])
  });
  return { fibers, route: route.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], armed = null, lastAction = 'quiet') => ({
  stage: int(stage, 0, STAGES - 1),
  memory: normalizeMemory(memory),
  armed: armed && normalizePosition(armed.start) !== normalizePosition(armed.end) ? {
    start: normalizePosition(armed.start),
    end: normalizePosition(armed.end),
    startedAt: finite(armed.startedAt, 0),
    releasedAt: finite(armed.releasedAt, finite(armed.startedAt, 0))
  } : armed ? {
    start: normalizePosition(armed.start),
    end: normalizePosition(armed.end),
    startedAt: finite(armed.startedAt, 0),
    releasedAt: finite(armed.releasedAt, finite(armed.startedAt, 0))
  } : null,
  lastAction,
  field: buildField(memory)
});

const AUTO_CUTS = [
  [0.08, 0.67],
  [0.22, 0.9],
  [0.14, 0.48],
  [0.62, 0.18]
];

export const buildTimeline = (limit = STAGES) => {
  const timeline = [];
  let frame = buildFrame(0, [], null, 'quiet');
  timeline.push(frame);
  for (let stage = 1; stage < limit; stage += 1) {
    const count = Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 2));
    const memory = [];
    for (let serial = 0; serial < count; serial += 1) {
      const [start, end] = AUTO_CUTS[serial];
      const armed = armCut(buildFrame(stage - 1, memory), { start, end, startedAt: 10, releasedAt: 280 });
      frame = commitCompression(armed);
      memory.push(...frame.memory.slice(-1));
    }
    frame = buildFrame(stage, memory, null, count ? 'settled-preview' : 'quiet');
    timeline.push(frame);
  }
  return timeline;
};

export const armCut = (frame, cut = {}, startedAt = 0) => ({
  ...frame,
  armed: {
    start: normalizePosition(cut.start),
    end: normalizePosition(cut.end ?? cut.start),
    startedAt: finite(cut.startedAt, startedAt),
    releasedAt: finite(cut.releasedAt, finite(cut.startedAt, startedAt))
  },
  lastAction: 'cut-armed'
});

export const commitCompression = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, lastAction: 'memory-limit' };
  const candidate = frame.armed ?? input;
  if (!candidate || !Number.isFinite(Number(candidate.start)) || !Number.isFinite(Number(candidate.end))) {
    return { ...frame, lastAction: 'compression-refused-empty' };
  }
  const start = normalizePosition(candidate.start);
  const end = normalizePosition(candidate.end);
  const span = Math.abs(end - start);
  const duration = Math.abs(finite(candidate.releasedAt, 0) - finite(candidate.startedAt, 0));
  if (span < MIN_SPAN || duration < MIN_DURATION || duration > MAX_DURATION) {
    return { ...frame, armed: null, lastAction: 'compression-refused-short' };
  }
  const startBand = int(start * (FIBER_COUNT - 1), 0, FIBER_COUNT - 1);
  const endBand = int(end * (FIBER_COUNT - 1), 0, FIBER_COUNT - 1);
  if (startBand === endBand) return { ...frame, armed: null, lastAction: 'compression-refused-same-band' };
  const { knot, counter, silent } = chooseRoles(frame.memory, startBand, endBand);
  const event = normalizeEvent({ startBand, endBand, knot, counter, silent, force: 0.58 + (frame.memory.length % 2) * 0.09, span }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'compression-committed');
};

export const liftLatestCompression = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'compression-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');
export const defaultCut = () => ({ start: AUTO_CUTS[0][0], end: AUTO_CUTS[0][1] });
export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, fibers: frame.field.fibers });
