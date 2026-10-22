export const SEED = 0x57473331;
export const STAGES = 9;
export const GRAIN_COUNT = 36;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 58;
export const MIN_DURATION = 180;
export const MAX_DURATION = 1200;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const round = (value) => Number(value.toFixed(5));
const pseudo = (value) => {
  const raw = Math.sin(value * 17.173 + SEED * 0.00007) * 43758.5453;
  return raw - Math.floor(raw);
};
const normalizeGrain = (value) => integer(value, 0, GRAIN_COUNT - 1);

const normalizeEvent = (raw = {}, serial = 0) => ({
  id: `pressure-${serial}`,
  mode: 'pressure-collapse',
  input: normalizeGrain(raw.input),
  gap: normalizeGrain(raw.gap),
  merge: normalizeGrain(raw.merge),
  echo: normalizeGrain(raw.echo),
  duration: round(clamp(finite(raw.duration, 420), MIN_DURATION, MAX_DURATION)),
  force: round(clamp(finite(raw.force, 0.72), 0.46, 1)),
  serial
});
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const baseGrains = () => Array.from({ length: GRAIN_COUNT }, (_, id) => {
  const theta = id * 2.3999632297;
  const radius = 0.12 + pseudo(id + 12) * 0.35;
  return {
    id,
    x: round(0.5 + Math.cos(theta) * radius * 1.05),
    y: round(0.5 + Math.sin(theta) * radius * 0.72),
    z: round(pseudo(id + 30)),
    size: round(0.72 + pseudo(id + 48) * 0.56),
    radius: 1,
    mass: 0.78,
    depthShift: 0,
    heat: 0,
    phase: round(pseudo(id + 66) * Math.PI * 2)
  };
});

const loadScores = (memory) => {
  const scores = Array.from({ length: GRAIN_COUNT }, () => 0);
  normalizeMemory(memory).forEach((event, serial) => {
    scores[event.input] += 0.8 + serial * 0.1;
    scores[event.gap] += 2.2;
    scores[event.merge] += 1.4;
    scores[event.echo] += 0.55;
  });
  return scores;
};
const chooseRemote = (memory, forbidden = []) => {
  const scores = loadScores(memory);
  const blocked = new Set(forbidden.map(normalizeGrain));
  return Array.from({ length: GRAIN_COUNT }, (_, id) => id)
    .filter((id) => !blocked.has(id))
    .sort((a, b) => scores[a] - scores[b] || pseudo(a + memory.length * 19) - pseudo(b + memory.length * 19))[0] ?? 0;
};
const normalizePressure = (pressure = null) => {
  if (!pressure) return null;
  return {
    grain: normalizeGrain(pressure.grain),
    startedAt: finite(pressure.startedAt, 0),
    lastAt: finite(pressure.lastAt, finite(pressure.startedAt, 0))
  };
};

const buildField = (memory) => {
  const grains = baseGrains();
  const route = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const force = event.force + serial * 0.05;
    const input = grains[event.input];
    const gap = grains[event.gap];
    const merge = grains[event.merge];
    const echo = grains[event.echo];

    input.mass = round(Math.max(0.28, input.mass - force * 0.14));
    input.heat = round(input.heat + force * 0.26);
    gap.mass = round(Math.max(0.18, gap.mass - force * 0.48));
    gap.radius = round(Math.max(0.72, gap.radius - force * 0.08));
    gap.heat = round(gap.heat + force * 0.14);
    merge.mass = round(Math.min(1.38, merge.mass + force * 0.24));
    merge.radius = round(Math.min(1.46, merge.radius + force * 0.28));
    merge.heat = round(merge.heat + force * 0.62);
    echo.depthShift = round(echo.depthShift + (serial % 2 ? -1 : 1) * force * 0.12);
    echo.size = round(Math.min(1.6, echo.size + force * 0.08));
    echo.heat = round(echo.heat + force * 0.18);
    grains[(event.merge + serial * 5 + 7) % GRAIN_COUNT].depthShift = round(grains[(event.merge + serial * 5 + 7) % GRAIN_COUNT].depthShift - force * 0.045);
    route.push(`${event.input}>${event.gap}>${event.merge}>${event.echo}>${round(force)}`);
  });
  const signature = JSON.stringify({
    route: route.join('|') || 'quiet',
    grains: grains.map((grain) => [grain.id, grain.x, grain.y, grain.z, grain.size, grain.radius, grain.mass, grain.depthShift, grain.heat])
  });
  return { grains, route: route.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], pressure = null, lastAction = 'quiet') => ({
  stage: integer(stage, 0, STAGES - 1),
  memory: normalizeMemory(memory),
  pressure: normalizePressure(pressure),
  lastAction,
  field: buildField(memory)
});

export const pressGrain = (frame, input = {}) => {
  const at = finite(input.at, 0);
  const pressure = normalizePressure({ grain: input.grain, startedAt: at, lastAt: at });
  return { ...frame, pressure, lastAction: 'pressure-held' };
};

export const releasePressure = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, pressure: null, lastAction: 'memory-limit' };
  const pressure = normalizePressure(frame.pressure);
  if (!pressure) return { ...frame, pressure: null, lastAction: 'pressure-refused-no-hold' };
  const releasedAt = finite(input.releasedAt, pressure.lastAt);
  const duration = releasedAt - pressure.startedAt;
  if (duration < MIN_DURATION || duration > MAX_DURATION) return { ...frame, pressure: null, lastAction: 'pressure-refused-duration' };
  const memory = frame.memory;
  const inputGrain = pressure.grain;
  const gap = chooseRemote(memory, [inputGrain]);
  const merge = chooseRemote(memory, [inputGrain, gap]);
  const echo = chooseRemote(memory, [inputGrain, gap, merge]);
  const event = normalizeEvent({ input: inputGrain, gap, merge, echo, duration, force: 0.62 + ((memory.length + inputGrain) % 3) * 0.08 }, memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...memory, event], null, 'pressure-released');
};

export const liftLatestPressure = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'pressure-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');
export const defaultPressure = () => ({ grain: 4, at: 0, releasedAt: 420 });

const AUTO_GRAINS = [4, 13, 23, 31];
export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  for (let stage = 1; stage < limit; stage += 1) {
    const count = Math.min(MEMORY_LIMIT, Math.ceil(stage / 2));
    let frame = buildFrame(stage - 1, timeline.at(-1).memory);
    for (let serial = 0; serial < count; serial += 1) {
      frame = releasePressure(pressGrain(frame, { grain: AUTO_GRAINS[serial], at: 0 }), { releasedAt: 420 });
    }
    timeline.push(buildFrame(stage, frame.memory, null, count ? 'settled-preview' : 'quiet'));
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, grains: frame.field.grains });
