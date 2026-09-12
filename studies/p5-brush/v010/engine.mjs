export const SEED = 0x42525530;
export const STAGES = 14;
export const STROKE_COUNT = 12;
export const POINT_COUNT = 72;
export const MEMORY_LIMIT = 8;
export const PRIMITIVE_BUDGET = 49;

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

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyHinge = (hinge) => ({ ...hinge, point: copyPoint(hinge.point) });

function automaticHinge(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 5 + 2) % STROKE_COUNT;
  return {
    id: `auto-hinge-curl-${stage}`,
    stage,
    source: 'autonomous-hinge-curl',
    point: {
      x: clamp(0.13 + stage * 0.058 + (random() - 0.5) * 0.04, 0.09, 0.9),
      y: clamp(0.066 + lane * 0.078 + (random() - 0.5) * 0.022, 0.055, 0.945)
    },
    radius: 0.026 + random() * 0.012,
    curl: 0.11 + random() * 0.035,
    depth: 0.074 + random() * 0.032,
    tail: 0.17 + random() * 0.06,
    side: stage % 2 === 0 ? 1 : -1,
    lane,
    rule: 'hinge-curl'
  };
}

function relevanceFor(hinge, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - hinge.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.24);
  const neighborWeight = clamp(1 - Math.abs(strokeIndex - hinge.lane) / 4.3);
  return laneWeight * (0.34 + neighborWeight * 0.66);
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.066 + strokeIndex * 0.078;
  const phase = random() * Math.PI * 2;
  const points = [];
  let hingeAmplitude = 0;
  let curlMass = 0;
  let tailDrift = 0;
  let wetLoad = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.026 + progress * 0.948;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.3 + strokeIndex * 0.17) + stage * 0.12) * (0.011 + random() * 0.009)
      + Math.sin(progress * Math.PI * 4.5 + strokeIndex * 0.41) * 0.0045;
    let localHinge = 0;
    let localCurl = 0;
    let localTail = 0;
    let localWet = 0;

    for (const hinge of memory) {
      const relevance = relevanceFor(hinge, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - hinge.point.x;
      const enter = smoothstep((distance + hinge.radius * 1.65) / (hinge.radius * 1.85));
      const pivot = smoothstep((distance + hinge.radius * 0.1) / (hinge.radius * 1.65));
      const exit = smoothstep((distance - hinge.radius * 0.25) / (hinge.radius * 3.2));
      const curlWindow = pivot * (1 - exit);
      const after = smoothstep((distance - hinge.radius * 1.25) / (hinge.radius * 2.6));
      const tailWindow = after * Math.exp(-Math.max(0, distance) / hinge.tail);
      const laneOffset = strokeIndex - hinge.lane;
      const laneSign = laneOffset === 0 ? (strokeIndex % 2 === 0 ? -1 : 1) : Math.sign(laneOffset);
      const signed = hinge.side * laneSign;
      const pivotOffset = signed * relevance * hinge.depth * enter * (0.36 + 0.64 * curlWindow);
      const curlOffset = signed * relevance * hinge.depth * 0.92 * Math.sin(Math.PI * clamp((distance + hinge.radius) / Math.max(hinge.curl, 0.001))) * curlWindow;
      const tailOffset = -signed * relevance * hinge.depth * 0.62 * tailWindow;

      y += pivotOffset + curlOffset + tailOffset;
      localHinge += Math.abs(pivotOffset);
      localCurl += Math.abs(curlOffset);
      localTail += Math.abs(tailOffset);
      localWet += (Math.abs(curlOffset) * 0.9 + Math.abs(tailOffset) * 0.45);
    }

    const boundedHinge = clamp(localHinge, 0, 0.34);
    const boundedCurl = clamp(localCurl, 0, 0.42);
    const boundedTail = clamp(localTail, 0, 0.26);
    hingeAmplitude += boundedHinge / POINT_COUNT;
    curlMass += boundedCurl / POINT_COUNT;
    tailDrift += boundedTail / POINT_COUNT;
    wetLoad += clamp(localWet, 0, 0.3) / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.028, 0.972),
      hinge: boundedHinge,
      curl: boundedCurl,
      tail: boundedTail,
      width: clamp(1 + boundedHinge * 1.3 + boundedCurl * 2.1 + boundedTail * 1.2, 1, 1.82),
      wet: clamp(0.06 + wetLoad * 1.4, 0.06, 0.72)
    });
  }

  const exitIndex = Math.min(POINT_COUNT - 1, Math.floor(POINT_COUNT * 0.84));
  const hingeExitError = Math.abs(points[exitIndex].y - baseY);
  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    index: strokeIndex,
    points,
    baseY,
    weight: (0.0048 + random() * 0.003) * clamp(1 + curlMass * 2.1 + tailDrift, 0.86, 1.38),
    opacity: 0.5 + random() * 0.27,
    hingeAmplitude,
    curlMass,
    tailDrift,
    wetLoad,
    hingeExitError
  };
}

function makeDeltas(memory, stage) {
  return memory.map((hinge, index) => ({
    id: hinge.id,
    point: copyPoint(hinge.point),
    radius: hinge.radius * (1 + Math.min(index, 7) * 0.048),
    curl: hinge.curl,
    depth: hinge.depth,
    tail: hinge.tail,
    side: hinge.side,
    age: Math.max(0, stage - hinge.stage),
    source: hinge.source,
    rule: 'hinge-curl'
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copyHinge).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    deltas: makeDeltas(inherited, safeStage),
    currentHinge: automaticHinge(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentHinge].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyRemoval(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.055, 0.945),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.075, 0.925)
  };
  const hinge = {
    id: `visitor-hinge-curl-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-hinge-curl',
    point: bounded,
    radius: 0.043,
    curl: 0.142,
    depth: 0.102,
    tail: 0.21,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.round((bounded.y - 0.066) / 0.078),
    rule: 'hinge-curl'
  };
  const next = buildFrame(frame.stage, [...frame.memory, hinge]);
  return { ...next, interaction: 'visitor-hinge-curl' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'hinge-curl-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'hinge-curl-lifted' };
}
