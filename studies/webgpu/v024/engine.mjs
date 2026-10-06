export const SEED = 0x57473234;
export const STAGES = 17;
export const LOOP_COUNT = 15;
export const LOOP_SEGMENTS = 28;
export const MEMORY_LIMIT = 4;
export const MIN_PAUSE_MS = 420;
export const PRIMITIVE_BUDGET = 72;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clampInt = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const wrap = (value, max) => ((value % max) + max) % max;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizePause = (raw = {}, serial = 0) => {
  const duration = clampInt(raw.duration, MIN_PAUSE_MS, 1200);
  return {
    id: `pause-${serial}`,
    mode: 'temporal-pause',
    source: raw.source || 'replayed-pause',
    ring: clampInt(raw.ring, 0, LOOP_COUNT - 1),
    duration,
    force: Number(clamp((duration - MIN_PAUSE_MS) / 780, 0.12, 1).toFixed(5)),
    serial
  };
};

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizePause(event, index));
const distanceOnSequence = (a, b) => Math.abs(a - b);

const baseLoops = () => Array.from({ length: LOOP_COUNT }, (_, index) => {
  const progress = index / (LOOP_COUNT - 1);
  const bend = Math.sin(progress * Math.PI * 2.25 + 0.35);
  return {
    id: index,
    x: Number((bend * 0.34 + (progress - 0.5) * 0.08).toFixed(5)),
    y: Number(((progress - 0.5) * 1.62).toFixed(5)),
    z: Number((Math.cos(progress * Math.PI * 2.05) * 0.22 - progress * 0.08).toFixed(5)),
    radiusX: Number((0.115 + pseudo(index + 31) * 0.042).toFixed(5)),
    radiusY: Number((0.075 + pseudo(index + 57) * 0.028).toFixed(5)),
    rotation: Number((bend * 0.34 - 0.18 + (pseudo(index + 82) - 0.5) * 0.22).toFixed(5)),
    opening: 0,
    delay: 0,
    lag: 0,
    phase: Number((pseudo(index + 113) * Math.PI * 2).toFixed(5)),
    weight: Number((0.35 + pseudo(index + 149) * 0.65).toFixed(5))
  };
});

const buildArchive = (memory) => {
  const loops = baseLoops();
  const routeHistory = [];
  let residue = 0;

  normalizeMemory(memory).forEach((event, serial) => {
    const target = wrap(event.ring + Math.floor(residue * 1.7) + serial, LOOP_COUNT);
    const pauseRatio = clamp((event.duration - MIN_PAUSE_MS) / 780, 0, 1);
    const amount = 0.22 + pauseRatio * 0.68;
    const direction = serial % 2 === 0 ? 1 : -1;

    loops.forEach((loop, index) => {
      const distance = distanceOnSequence(index, target);
      const influence = clamp(1 - distance / 5.2, 0, 1);
      const downstream = index >= target ? clamp(1 - (index - target) / (LOOP_COUNT - target + 1), 0, 1) : 0;
      if (influence <= 0 && downstream <= 0) return;
      loop.opening = Number(clamp(loop.opening + influence * amount * 0.72, 0, 0.82).toFixed(5));
      loop.rotation = Number((loop.rotation + direction * influence * (0.18 + amount * 0.22)).toFixed(5));
      loop.x = Number((loop.x + direction * influence * amount * 0.08).toFixed(5));
      loop.z = Number((loop.z + direction * influence * amount * 0.16 + downstream * amount * 0.11).toFixed(5));
      loop.delay = Number((loop.delay + downstream * (0.28 + amount * 0.72)).toFixed(5));
      loop.lag = Number((loop.lag + downstream * amount * (0.13 + serial * 0.035)).toFixed(5));
      loop.phase = Number((loop.phase + direction * downstream * amount * 0.18).toFixed(5));
    });

    routeHistory.push(`${event.ring}>${target}>${event.duration}`);
    residue = Number((residue + 0.38 + amount * 0.94 + target * 0.013).toFixed(5));
  });

  const route = routeHistory.join('|') || 'quiet';
  const signature = JSON.stringify({
    route,
    residue: Number(residue.toFixed(5)),
    loops: loops.map((loop) => [loop.id, loop.x, loop.y, loop.z, loop.rotation, loop.opening, loop.delay, loop.lag, loop.phase])
  });
  return { loops, route, residue, signature };
};

export const buildFrame = (stage = 0, memory = [], armed = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armed: armed ? { ring: clampInt(armed.ring, 0, LOOP_COUNT - 1), startedAt: finite(armed.startedAt, 0) } : null,
    lastAction,
    archive: buildArchive(normalizedMemory)
  };
};

const AUTO_PAUSES = [
  { ring: 3, duration: 760 },
  { ring: 11, duration: 530 },
  { ring: 6, duration: 1020 },
  { ring: 13, duration: 680 }
];

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const count = Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 4));
  const memory = AUTO_PAUSES.slice(0, count).map((pause, serial) => normalizePause(pause, serial));
  return buildFrame(stage, memory, null, stage === 0 ? 'quiet' : 'settled-preview');
});

export const armPause = (frame, ring, startedAt = 0) => ({
  ...frame,
  armed: { ring: clampInt(ring, 0, LOOP_COUNT - 1), startedAt: finite(startedAt, 0) },
  lastAction: 'pause-armed'
});

export const commitPause = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, lastAction: 'memory-limit' };
  const duration = finite(input.duration, 0);
  if (duration < MIN_PAUSE_MS) return { ...frame, lastAction: 'pause-too-short' };
  const event = normalizePause({
    ring: input.ring ?? frame.armed?.ring ?? 0,
    duration,
    source: 'visitor-pause'
  }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'pause-committed');
};

export const liftLatestPause = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'pause-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');
export const defaultPause = () => ({ ...AUTO_PAUSES[0] });
export const geometrySignature = (frame) => JSON.stringify({ archive: frame.archive.signature, loops: frame.archive.loops });
