export const SEED = 0x42525533;
export const STAGES = 8;
export const STROKE_COUNT = 5;
export const POINT_COUNT = 36;
export const MEMORY_LIMIT = 6;
export const PRIMITIVE_BUDGET = 30;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyCut(cut) {
  return { ...cut, point: copyPoint(cut.point) };
}

function automaticCut(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = stage % STROKE_COUNT;
  const side = stage % 2 === 0 ? 1 : -1;
  return {
    id: `auto-cut-${stage}`,
    stage,
    source: 'autonomous-return',
    point: {
      x: clamp(0.27 + stage * 0.065 + (random() - 0.5) * 0.035, 0.16, 0.76),
      y: clamp(0.19 + lane * 0.145 + (random() - 0.5) * 0.028, 0.12, 0.86)
    },
    force: 0.076 + random() * 0.026,
    length: 0.14 + random() * 0.045,
    side,
    lane
  };
}

function relevanceFor(cut, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - cut.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.19);
  const ageWeight = 0.76 + Math.min(strokeIndex, 5) * 0.035;
  return laneWeight * ageWeight;
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.19 + strokeIndex * 0.145;
  const phase = random() * Math.PI * 2;
  const points = [];
  let channelCrossings = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.07 + progress * 0.86;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.65 + strokeIndex * 0.18) + stage * 0.23) * (0.021 + random() * 0.012)
      + Math.sin(progress * Math.PI * 3 + strokeIndex) * 0.009;

    for (const cut of memory) {
      const relevance = relevanceFor(cut, baseY, strokeIndex);
      if (relevance <= 0.02) continue;
      const distanceFromCut = x - cut.point.x;
      const approach = smoothstep((distanceFromCut + 0.035) / 0.07);
      const exit = smoothstep((distanceFromCut - cut.length * 0.4) / (cut.length * 0.95));
      const localEnvelope = Math.exp(-Math.pow(distanceFromCut / 0.065, 2));
      const bypass = cut.side * cut.force * relevance * localEnvelope;
      const wake = cut.side * cut.force * 0.38 * relevance * exit * (1 - exit * 0.62);
      y += bypass + wake;
      if (Math.abs(distanceFromCut) < 0.06 && relevance > 0.16) channelCrossings += 1;
      if (distanceFromCut > 0.02) {
        y += cut.side * cut.force * 0.18 * relevance * approach;
      }
    }

    points.push({ x, y: clamp(y, 0.08, 0.92) });
  }

  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    points,
    baseY,
    weight: 0.008 + random() * 0.006,
    opacity: 0.58 + random() * 0.22,
    channelCrossings
  };
}

function makeChannels(memory, stage) {
  return memory.map((cut, index) => ({
    id: cut.id,
    point: copyPoint(cut.point),
    side: cut.side,
    width: cut.force * (0.74 + Math.min(index, 4) * 0.06),
    exit: clamp(cut.point.x + cut.length * 0.46, 0.08, 0.91),
    reentry: clamp(cut.point.x + cut.length, 0.12, 0.96),
    age: Math.max(0, stage - cut.stage),
    source: cut.source
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copyCut).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    channels: makeChannels(inherited, safeStage),
    currentCut: automaticCut(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentCut].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyCut(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.10, 0.90)
  };
  const cut = {
    id: `visitor-cut-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-cut',
    point: bounded,
    force: 0.108,
    length: 0.18,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.round((bounded.y - 0.19) / 0.145)
  };
  const next = buildFrame(frame.stage, [...frame.memory, cut]);
  return { ...next, interaction: 'visitor-cut' };
}

export function removeLatestCut(frame) {
  if (!frame.memory.length) return buildFrame(frame.stage, []);
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'cut-lifted' };
}
