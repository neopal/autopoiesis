export const SEED = 0x42525538;
export const STAGES = 12;
export const STROKE_COUNT = 9;
export const POINT_COUNT = 62;
export const MEMORY_LIMIT = 7;
export const PRIMITIVE_BUDGET = 37;

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

function copyMembrane(membrane) {
  return { ...membrane, point: copyPoint(membrane.point) };
}

function automaticMembrane(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 5 + 2) % STROKE_COUNT;
  return {
    id: `auto-membrane-${stage}`,
    stage,
    source: 'autonomous-exchange',
    point: {
      x: clamp(0.13 + stage * 0.068 + (random() - 0.5) * 0.04, 0.1, 0.87),
      y: clamp(0.095 + lane * 0.1 + (random() - 0.5) * 0.03, 0.08, 0.92)
    },
    radius: 0.035 + random() * 0.017,
    amount: 0.16 + random() * 0.06,
    delay: 0.062 + random() * 0.032,
    porosity: 0.35 + random() * 0.16,
    side: stage % 2 === 0 ? 1 : -1,
    lane,
    exchange: true
  };
}

function relevanceFor(membrane, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - membrane.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.245);
  const neighborWeight = clamp(1 - Math.abs(strokeIndex - membrane.lane) / 3.1);
  return laneWeight * (0.46 + neighborWeight * 0.54);
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.065 + strokeIndex * 0.1;
  const phase = random() * Math.PI * 2;
  const points = [];
  let transferDelta = 0;
  let exchangeMass = 0;
  let transferCount = 0;
  let routeShift = 0;
  let wetting = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.034 + progress * 0.932;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.28 + strokeIndex * 0.22) + stage * 0.16) * (0.014 + random() * 0.011)
      + Math.sin(progress * Math.PI * 3.4 + strokeIndex * 0.53) * 0.0064;
    let localTransfer = 0;
    let localExchange = 0;
    let localWet = 0;

    for (const membrane of memory) {
      const relevance = relevanceFor(membrane, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - membrane.point.x;
      const arrive = smoothstep((distance + membrane.radius * 1.35) / (membrane.radius * 1.7));
      const leave = smoothstep((distance - membrane.delay) / (membrane.radius * 3.2));
      const pore = arrive * (1 - leave);
      const released = smoothstep((distance - membrane.radius * 0.2 - membrane.delay) / (membrane.radius * 3.8));
      const laneOffset = strokeIndex - membrane.lane;
      const laneSign = laneOffset === 0 ? -0.28 : Math.sign(laneOffset);
      const signedTransfer = membrane.side * laneSign * relevance * membrane.amount
        * (pore * 0.38 + released * membrane.porosity);
      const lateralRoute = membrane.side * relevance * (0.078 * pore + signedTransfer * 0.82);
      const wetPulse = Math.exp(-Math.pow((distance - membrane.radius * 1.35 - membrane.delay) / (membrane.radius * 1.8), 2))
        * membrane.amount * relevance;

      y += lateralRoute;
      localTransfer += signedTransfer;
      localExchange += Math.abs(signedTransfer) + wetPulse * 0.35;
      localWet += wetPulse;
      if (Math.abs(signedTransfer) > 0.003) transferCount += 1;
    }

    const boundedTransfer = clamp(localTransfer, -0.3, 0.3);
    const boundedExchange = clamp(localExchange, 0, 0.42);
    const boundedWet = clamp(localWet, 0, 0.28);
    transferDelta += boundedTransfer / POINT_COUNT;
    exchangeMass += boundedExchange / POINT_COUNT;
    routeShift += (boundedTransfer * (0.35 + progress)) / POINT_COUNT;
    wetting += boundedWet / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.035, 0.965),
      transfer: boundedTransfer,
      exchange: boundedExchange,
      wet: boundedWet,
      width: clamp(1 + boundedExchange * 1.8 + Math.abs(boundedTransfer) * 0.8, 1, 1.62)
    });
  }

  const baseWeight = 0.0058 + random() * 0.0041;
  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    points,
    baseY,
    weight: baseWeight * clamp(1 + exchangeMass * 1.8, 0.82, 1.3),
    opacity: 0.54 + random() * 0.23,
    transferDelta,
    exchangeMass,
    transferCount,
    routeShift: points.at(-1).y - points[0].y + routeShift,
    wetting
  };
}

function makeDeltas(memory, stage) {
  return memory.map((membrane, index) => ({
    id: membrane.id,
    point: copyPoint(membrane.point),
    radius: membrane.radius * (1 + Math.min(index, 6) * 0.055),
    amount: membrane.amount,
    delay: membrane.delay,
    porosity: membrane.porosity,
    side: membrane.side,
    age: Math.max(0, stage - membrane.stage),
    source: membrane.source,
    exchange: membrane.exchange === true
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copyMembrane).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    deltas: makeDeltas(inherited, safeStage),
    currentMembrane: automaticMembrane(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentMembrane].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyRemoval(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.07, 0.93),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.1, 0.9)
  };
  const membrane = {
    id: `visitor-membrane-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-membrane',
    point: bounded,
    radius: 0.058,
    amount: 0.225,
    delay: 0.082,
    porosity: 0.47,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.round((bounded.y - 0.065) / 0.1),
    exchange: true
  };
  const next = buildFrame(frame.stage, [...frame.memory, membrane]);
  return { ...next, interaction: 'visitor-membrane' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'membrane-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'membrane-lifted' };
}
