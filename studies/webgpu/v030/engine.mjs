export const SEED = 0x57473330;
export const STAGES = 10;
export const WITNESS_COUNT = 12;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 46;
export const MIN_VISITS = 3;
export const MIN_DURATION = 120;
export const MAX_DURATION = 1600;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, max) => ((value % max) + max) % max;
const pseudo = (value) => {
  const raw = Math.sin(value * 17.173 + SEED * 0.00007) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizeWitness = (value) => integer(value, 0, WITNESS_COUNT - 1);
const normalizeMemoryEvent = (raw = {}, serial = 0) => ({
  id: `departure-${serial}`,
  mode: 'departure-exposure',
  entry: normalizeWitness(raw.entry),
  closed: normalizeWitness(raw.closed),
  open: normalizeWitness(raw.open),
  fold: normalizeWitness(raw.fold),
  visits: Math.max(MIN_VISITS, integer(raw.visits, MIN_VISITS, WITNESS_COUNT)),
  duration: round(clamp(finite(raw.duration, 480), MIN_DURATION, MAX_DURATION)),
  force: round(clamp(finite(raw.force, 0.68), 0.34, 1)),
  serial
});
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeMemoryEvent(event, index));

const basePlates = () => Array.from({ length: WITNESS_COUNT }, (_, id) => {
  const ring = id / WITNESS_COUNT * Math.PI * 2;
  const radius = 0.22 + pseudo(id + 7) * 0.18;
  return {
    id,
    x: round(0.5 + Math.cos(ring) * radius * 1.08),
    y: round(0.5 + Math.sin(ring) * radius * 0.68),
    width: round(0.14 + pseudo(id + 21) * 0.095),
    height: round(0.12 + pseudo(id + 42) * 0.12),
    rotation: round(ring * 0.52 + (pseudo(id + 63) - 0.5) * 0.65),
    open: 0.68,
    tilt: round((pseudo(id + 84) - 0.5) * 0.12),
    exposure: 0,
    shade: round(pseudo(id + 105))
  };
});

const attentionScores = (memory) => {
  const scores = Array.from({ length: WITNESS_COUNT }, () => 0);
  normalizeMemory(memory).forEach((event, serial) => {
    scores[event.entry] += 0.8;
    scores[event.closed] += 2.8 + serial * 0.25;
    scores[event.open] += 0.25;
    scores[event.fold] += 0.45;
  });
  return scores;
};

const chooseLeastLoaded = (memory, forbidden = []) => {
  const scores = attentionScores(memory);
  const blocked = new Set(forbidden.map(normalizeWitness));
  return Array.from({ length: WITNESS_COUNT }, (_, id) => id)
    .filter((id) => !blocked.has(id))
    .sort((a, b) => scores[a] - scores[b] || pseudo(a + memory.length * 31) - pseudo(b + memory.length * 31))[0] ?? 0;
};

const normalizeAttention = (attention = null) => {
  if (!attention) return null;
  const visits = Array.isArray(attention.visits)
    ? [...new Set(attention.visits.map(normalizeWitness))]
    : [];
  const counts = Array.isArray(attention.counts)
    ? attention.counts.map((value) => integer(value, 0, 99)).slice(0, WITNESS_COUNT)
    : Array.from({ length: WITNESS_COUNT }, () => 0);
  while (counts.length < WITNESS_COUNT) counts.push(0);
  return {
    visits,
    counts,
    startedAt: finite(attention.startedAt, 0),
    lastAt: finite(attention.lastAt, finite(attention.startedAt, 0))
  };
};

const buildField = (memory) => {
  const plates = basePlates();
  const exposureRoute = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const force = event.force + serial * 0.06;
    const direction = serial % 2 === 0 ? 1 : -1;
    const closed = plates[event.closed];
    const open = plates[event.open];
    const fold = plates[event.fold];

    closed.open = round(Math.max(0.12, closed.open - force * 0.34));
    closed.exposure = round(closed.exposure + force * 0.56);
    closed.tilt = round(closed.tilt - direction * force * 0.18);
    open.open = round(Math.min(1, open.open + force * 0.27));
    open.exposure = round(open.exposure + force * 0.82);
    open.tilt = round(open.tilt + direction * force * 0.12);
    fold.tilt = round(fold.tilt + direction * force * 0.34);
    fold.exposure = round(fold.exposure + force * 0.24);

    plates[(event.open + 3 + serial) % WITNESS_COUNT].rotation = round(plates[(event.open + 3 + serial) % WITNESS_COUNT].rotation + direction * force * 0.06);
    exposureRoute.push(`${event.entry}>${event.closed}>${event.open}>${event.fold}>${round(force)}`);
  });
  const signature = JSON.stringify({
    route: exposureRoute.join('|') || 'quiet',
    plates: plates.map((plate) => [plate.id, plate.x, plate.y, plate.width, plate.height, plate.rotation, plate.open, plate.tilt, plate.exposure])
  });
  return { plates, route: exposureRoute.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], attention = null, lastAction = 'quiet') => ({
  stage: integer(stage, 0, STAGES - 1),
  memory: normalizeMemory(memory),
  attention: normalizeAttention(attention),
  lastAction,
  field: buildField(memory)
});

const AUTO_VISITS = [
  [1, 5, 9],
  [3, 8, 0],
  [6, 10, 2],
  [9, 1, 7]
];

export const armAttention = (frame, input = {}) => {
  const witness = normalizeWitness(input.witness);
  const current = normalizeAttention(frame.attention) ?? { visits: [], counts: Array.from({ length: WITNESS_COUNT }, () => 0), startedAt: finite(input.at, 0), lastAt: finite(input.at, 0) };
  const visits = current.visits.includes(witness) ? current.visits : [...current.visits, witness];
  const counts = [...current.counts];
  counts[witness] = Math.min(99, counts[witness] + 1);
  return {
    ...frame,
    attention: {
      visits,
      counts,
      startedAt: current.visits.length ? current.startedAt : finite(input.at, 0),
      lastAt: finite(input.at, current.lastAt)
    },
    lastAction: 'attention-observed'
  };
};

export const commitDeparture = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, attention: null, lastAction: 'memory-limit' };
  const attention = normalizeAttention(frame.attention);
  if (!attention || attention.visits.length < MIN_VISITS) return { ...frame, attention: null, lastAction: 'departure-refused-insufficient-witnesses' };
  const releasedAt = finite(input.releasedAt, attention.lastAt);
  const duration = releasedAt - attention.startedAt;
  if (duration < MIN_DURATION || duration > MAX_DURATION) return { ...frame, attention: null, lastAction: 'departure-refused-duration' };

  const entry = attention.visits[0];
  const closed = attention.visits.at(-1) === entry ? attention.visits[1] : attention.visits.at(-1);
  const open = chooseLeastLoaded(frame.memory, [entry, closed]);
  const fold = chooseLeastLoaded(frame.memory, [entry, closed, open]);
  const event = normalizeMemoryEvent({
    entry,
    closed,
    open,
    fold,
    visits: attention.visits.length,
    duration,
    force: 0.58 + ((frame.memory.length + attention.visits.length) % 3) * 0.07
  }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'departure-committed');
};

export const liftLatestDeparture = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'departure-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');
export const defaultWitnesses = () => AUTO_VISITS[0].map((witness, index) => ({ witness, at: index * 140 }));
export const buildTimeline = (limit = STAGES) => {
  const timeline = [];
  let frame = buildFrame(0, []);
  timeline.push(frame);
  for (let stage = 1; stage < limit; stage += 1) {
    const count = Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 2));
    let memory = [];
    for (let serial = 0; serial < count; serial += 1) {
      let observed = buildFrame(stage - 1, memory);
      for (const witness of AUTO_VISITS[serial]) observed = armAttention(observed, { witness, at: AUTO_VISITS[serial].indexOf(witness) * 140 });
      observed = commitDeparture(observed, { releasedAt: 520 });
      memory = observed.memory;
    }
    frame = buildFrame(stage, memory, null, count ? 'settled-preview' : 'quiet');
    timeline.push(frame);
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, plates: frame.field.plates });
