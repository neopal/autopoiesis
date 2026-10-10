export const TONGUE_COUNT = 11;
export const MEMORY_LIMIT = 4;
export const STAGES = 13;
export const MIN_DWELL_MS = 640;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rounded = (value) => Number(value.toFixed(5));
const fract = (value) => value - Math.floor(value);

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

function seeded(index, salt = 0) {
  return fract(hash(0x42525549 + index * 991 + salt * 313) / 4294967296);
}

function number(value) {
  return rounded(Number.isFinite(value) ? value : 0);
}

function normalizePoint(point) {
  return {
    x: number(clamp(Number(point?.x) || 0.5, 0.04, 0.96)),
    y: number(clamp(Number(point?.y) || 0.5, 0.06, 0.94))
  };
}

function normalizeDwell(dwell) {
  const point = normalizePoint(dwell?.point);
  const duration = Math.round(clamp(Number(dwell?.duration) || 0, 0, 5000));
  return { point, duration };
}

function dwellKey(dwell) {
  const normalized = normalizeDwell(dwell);
  return `${normalized.point.x}:${normalized.point.y}@${normalized.duration}`;
}

function cloneDwell(dwell, source = dwell?.source || 'unknown') {
  const normalized = normalizeDwell(dwell);
  return {
    kind: 'stillness-event',
    point: normalized.point,
    duration: normalized.duration,
    source
  };
}

function baselineTongue(index) {
  const angle = -Math.PI * 0.52 + index * TAU / TONGUE_COUNT + (seeded(index, 2) - 0.5) * 0.12;
  return {
    id: index,
    angle: number(angle),
    length: number(0.28 + seeded(index, 4) * 0.14),
    width: number(0.07 + seeded(index, 5) * 0.035),
    x: number(0.5 + (seeded(index, 6) - 0.5) * 0.035),
    y: number(0.52 + (seeded(index, 7) - 0.5) * 0.04),
    swell: 0,
    settle: 0,
    drift: 0,
    pigment: number(0.4 + seeded(index, 8) * 0.55),
    points: []
  };
}

function eventInfluence(event, eventIndex) {
  const normalized = normalizeDwell(event);
  const field = hash(Math.round((normalized.point.x * 211 + normalized.point.y * 379 + normalized.duration * 0.017) * 1000) + eventIndex * 1013 + 0x42525549);
  const swellIndex = field % TONGUE_COUNT;
  const separation = 3 + Math.floor(fract(field / 4294967296) * (TONGUE_COUNT - 4));
  const settleIndex = (swellIndex + separation) % TONGUE_COUNT;
  const driftIndex = (settleIndex + 3 + eventIndex) % TONGUE_COUNT;
  const energy = clamp((normalized.duration - MIN_DWELL_MS) / 1800, 0.08, 1);
  return {
    swellIndex,
    settleIndex,
    driftIndex,
    energy,
    duration: normalized.duration,
    point: normalized.point
  };
}

function tonguePoints(tongue) {
  const inner = 0.055 + tongue.settle * 0.018;
  const outer = clamp(tongue.length + tongue.swell * 0.08 - tongue.settle * 0.055, 0.16, 0.58);
  const halfWidth = clamp(tongue.width * (1 + tongue.swell * 0.44 - tongue.settle * 0.25), 0.025, 0.115);
  const points = [];
  const steps = 11;
  const centerX = clamp(tongue.x + Math.cos(tongue.angle) * tongue.drift * 0.022, 0.08, 0.92);
  const centerY = clamp(tongue.y + Math.sin(tongue.angle) * tongue.drift * 0.022, 0.1, 0.9);
  for (let side = -1; side <= 1; side += 2) {
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const radius = inner + (outer - inner) * t;
      const taper = (1 - t) * 0.74 + t * 0.5;
      const ripple = Math.sin(t * 4.7 + tongue.id * 0.9) * 0.012 * (0.35 + t);
      const angle = tongue.angle + side * (halfWidth * taper + ripple);
      const grain = 1 + (seeded(tongue.id * 31 + step, 17 + side) - 0.5) * 0.14;
      points.push({
        x: number(clamp(centerX + Math.cos(angle) * radius * grain, 0.02, 0.98)),
        y: number(clamp(centerY + Math.sin(angle) * radius * grain, 0.03, 0.97))
      });
    }
  }
  return points;
}

function polygonPath(points) {
  return `${points.map((point, index) => `${index ? 'L' : 'M'} ${number(point.x * 1000)} ${number(point.y * 620)}`).join(' ')} Z`;
}

function replay(memory) {
  const tongues = Array.from({ length: TONGUE_COUNT }, (_, index) => baselineTongue(index));
  let center = { x: 0.5, y: 0.52 };
  let lastEvent = null;

  memory.forEach((event, eventIndex) => {
    const influence = eventInfluence(event, eventIndex);
    const swell = 0.32 + influence.energy * 0.7;
    const settle = 0.22 + influence.energy * 0.56;
    const swellTongue = tongues[influence.swellIndex];
    const settleTongue = tongues[influence.settleIndex];
    const driftTongue = tongues[influence.driftIndex];

    swellTongue.swell = clamp(swellTongue.swell + swell, 0, 1.8);
    swellTongue.length = clamp(swellTongue.length + 0.03 + influence.energy * 0.08, 0.16, 0.58);
    swellTongue.width = clamp(swellTongue.width + 0.012 + influence.energy * 0.025, 0.025, 0.115);
    swellTongue.pigment = clamp(swellTongue.pigment + 0.1 + influence.energy * 0.12, 0.2, 1.5);

    settleTongue.settle = clamp(settleTongue.settle + settle, 0, 1.8);
    settleTongue.length = clamp(settleTongue.length - 0.018 - influence.energy * 0.045, 0.16, 0.58);
    settleTongue.width = clamp(settleTongue.width - 0.008 - influence.energy * 0.015, 0.025, 0.115);
    settleTongue.pigment = clamp(settleTongue.pigment - 0.06 - influence.energy * 0.06, 0.2, 1.5);

    driftTongue.drift = clamp(driftTongue.drift + 0.45 + influence.energy * 0.55, 0, 2.4);
    driftTongue.angle += (influence.point.x - 0.5) * 0.11 + (eventIndex % 2 ? -0.045 : 0.05);
    driftTongue.x = clamp(driftTongue.x + (influence.point.x - 0.5) * 0.018, 0.08, 0.92);
    driftTongue.y = clamp(driftTongue.y + (influence.point.y - 0.5) * 0.018, 0.1, 0.9);

    center.x = clamp(center.x + (influence.point.x - 0.5) * 0.012, 0.42, 0.58);
    center.y = clamp(center.y + (influence.point.y - 0.52) * 0.012, 0.44, 0.6);
    lastEvent = { ...cloneDwell(event, event.source), ...influence, swellIndex: influence.swellIndex, settleIndex: influence.settleIndex, driftIndex: influence.driftIndex };
  });

  tongues.forEach((tongue) => { tongue.points = tonguePoints(tongue); });
  const tonguePaths = tongues.map((tongue) => polygonPath(tongue.points));
  return { tongues, tonguePaths, center, lastEvent };
}

function frameFrom(stage, memory, interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map((event) => cloneDwell(event, event.source));
  const result = replay(boundedMemory);
  return {
    grammar: 'radial-sediment',
    stage,
    memory: boundedMemory,
    dwells: boundedMemory,
    tongues: result.tongues,
    tonguePaths: result.tonguePaths,
    center: result.center,
    lastDwell: result.lastEvent,
    swelledCount: result.tongues.filter((tongue) => tongue.swell > 0.01).length,
    settledCount: result.tongues.filter((tongue) => tongue.settle > 0.01).length,
    driftedCount: result.tongues.filter((tongue) => tongue.drift > 0.01).length,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory);
}

export function geometrySignature(frame) {
  return JSON.stringify({
    center: frame.center,
    tongues: frame.tongues.map((tongue) => ({
      id: tongue.id,
      angle: rounded(tongue.angle),
      length: rounded(tongue.length),
      width: rounded(tongue.width),
      x: rounded(tongue.x),
      y: rounded(tongue.y),
      swell: rounded(tongue.swell),
      settle: rounded(tongue.settle),
      drift: rounded(tongue.drift),
      points: tongue.points
    }))
  });
}

export function applyDwell(frame, dwell, source = 'pointer-dwell') {
  const normalized = normalizeDwell(dwell);
  if (normalized.duration < MIN_DWELL_MS) return { ...frame, interaction: 'dwell-refused-short' };
  const previous = frame.memory.at(-1);
  if (previous && dwellKey(previous) === dwellKey(normalized)) return { ...frame, interaction: 'dwell-refused' };
  return frameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, { ...normalized, source }], 'dwell-committed');
}

export function liftLatestDwell(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'dwell-lift-refused' };
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'dwell-lifted');
}

export function releaseDwells(frame) {
  return frameFrom(0, [], 'dwells-released');
}

function timelineDwell(index) {
  const events = [
    { point: { x: 0.22, y: 0.72 }, duration: 880 },
    { point: { x: 0.78, y: 0.38 }, duration: 1240 },
    { point: { x: 0.26, y: 0.27 }, duration: 760 },
    { point: { x: 0.72, y: 0.68 }, duration: 1600 }
  ];
  return { ...events[index % events.length], source: 'timeline' };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % 3 === 0) memory = [...memory, timelineDwell(stage / 3 - 1)].slice(-MEMORY_LIMIT);
    timeline.push(frameFrom(stage, memory, stage === 0 ? 'baseline' : 'timeline'));
  }
  return timeline;
}

export function frameForMemory(memory) {
  return frameFrom(memory.length, memory);
}

export { dwellKey };
