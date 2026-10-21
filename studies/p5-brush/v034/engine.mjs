export const POOL_COUNT = 13;
export const MEMORY_LIMIT = 4;
export const QUORUM_SIZE = 5;
export const OBSERVATION_RADIUS = 0.14;
export const STAGES = 13;

const SEED = 0x42525534;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 991 + salt * 313) >>> 0) / 4294967296;

const BASE_LAYOUT = [
  { x: 0.17, y: 0.22, rx: 0.12, ry: 0.15, tilt: -0.32 },
  { x: 0.36, y: 0.15, rx: 0.14, ry: 0.11, tilt: 0.12 },
  { x: 0.59, y: 0.18, rx: 0.14, ry: 0.12, tilt: -0.18 },
  { x: 0.79, y: 0.28, rx: 0.12, ry: 0.15, tilt: 0.34 },
  { x: 0.84, y: 0.48, rx: 0.14, ry: 0.13, tilt: -0.08 },
  { x: 0.66, y: 0.47, rx: 0.13, ry: 0.11, tilt: 0.24 },
  { x: 0.48, y: 0.38, rx: 0.16, ry: 0.14, tilt: -0.28 },
  { x: 0.29, y: 0.41, rx: 0.14, ry: 0.12, tilt: 0.16 },
  { x: 0.14, y: 0.56, rx: 0.12, ry: 0.15, tilt: -0.18 },
  { x: 0.24, y: 0.75, rx: 0.14, ry: 0.12, tilt: 0.30 },
  { x: 0.46, y: 0.79, rx: 0.16, ry: 0.12, tilt: -0.12 },
  { x: 0.67, y: 0.70, rx: 0.14, ry: 0.14, tilt: 0.20 },
  { x: 0.85, y: 0.82, rx: 0.11, ry: 0.13, tilt: -0.28 }
];

const RIBBON_ROUTES = [
  [0, 1, 2, 5, 4, 3],
  [8, 7, 6, 5, 11, 12],
  [9, 7, 6, 10, 11],
  [0, 8, 9, 10, 12]
];

const CONTROL_CENSUSES = [
  [0, 3, 6, 9, 11],
  [1, 4, 7, 10, 12],
  [2, 5, 8, 9, 12],
  [0, 2, 6, 10, 11]
];

function baselinePool(index) {
  const base = BASE_LAYOUT[index];
  return {
    id: index,
    cx: round(clamp(base.x + (seeded(index, 1) - 0.5) * 0.018, 0.06, 0.94)),
    cy: round(clamp(base.y + (seeded(index, 2) - 0.5) * 0.018, 0.08, 0.92)),
    rx: round(base.rx * (0.94 + seeded(index, 3) * 0.12)),
    ry: round(base.ry * (0.94 + seeded(index, 4) * 0.12)),
    tilt: round(base.tilt + (seeded(index, 5) - 0.5) * 0.10),
    dry: 0,
    ridge: 0,
    counter: 0,
    offsetX: 0,
    offsetY: 0,
    state: 'quiet',
    tone: index % 6
  };
}

function poolPoints(pool) {
  const points = [];
  const count = 11;
  const wobble = seeded(pool.id, 23);
  const angle = pool.tilt + pool.counter * 0.15 - pool.ridge * 0.08;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scaleX = pool.rx * (1 - pool.dry * 0.36 + pool.ridge * 0.16);
  const scaleY = pool.ry * (1 - pool.dry * 0.18 + pool.ridge * 0.24);
  for (let i = 0; i < count; i += 1) {
    const theta = (Math.PI * 2 * i) / count;
    const variation = 0.80 + seeded(pool.id + i, 31) * 0.34;
    const notch = pool.dry > 0.01 && i === (pool.id + 3) % count ? 0.42 : 1;
    const localX = Math.cos(theta) * scaleX * variation * notch;
    const localY = Math.sin(theta) * scaleY * variation;
    const shear = pool.counter * (localY * 0.18 + 0.012) - pool.ridge * (localY * 0.08);
    points.push({
      x: round(clamp(pool.cx + pool.offsetX + localX * cos - localY * sin + shear, 0.025, 0.975)),
      y: round(clamp(pool.cy + pool.offsetY + localX * sin + localY * cos, 0.035, 0.965))
    });
  }
  return points;
}

function normalizeObservation(observation = {}) {
  return {
    x: round(clamp(Number(observation.x) || 0.5, 0.01, 0.99)),
    y: round(clamp(Number(observation.y) || 0.5, 0.02, 0.98)),
    poolIndex: Number.isInteger(observation.poolIndex) ? observation.poolIndex : null
  };
}

function normalizeEvent(event = {}) {
  return {
    kind: 'attention-census',
    observed: (event.observed || []).slice(0, QUORUM_SIZE).map((value) => Number(value)),
    source: event.source || 'unknown'
  };
}

function nearestPool(frame, observation) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  frame.pools.forEach((pool, index) => {
    const distance = Math.hypot(pool.cx - observation.x, pool.cy - observation.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestDistance <= OBSERVATION_RADIUS ? bestIndex : -1;
}

function influenceFor(event, eventIndex) {
  const observed = event.observed;
  const observedSet = new Set(observed);
  const untouched = Array.from({ length: POOL_COUNT }, (_, index) => index).filter((index) => !observedSet.has(index));
  const signal = observed.reduce((sum, index, order) => sum + index * (191 + order * 37), 0);
  const field = hash(signal + eventIndex * 1223 + SEED);
  const pick = (salt, excluded = []) => {
    const candidates = untouched.filter((index) => !excluded.includes(index));
    return candidates[(field + salt * 17) % candidates.length];
  };
  const dryIndex = pick(1);
  const ridgeIndex = pick(2, [dryIndex]);
  const counterIndex = pick(3, [dryIndex, ridgeIndex]);
  const witnessIndex = observed[0];
  const energy = round(clamp(0.62 + ((field % 37) / 100), 0.62, 0.98));
  return {
    kind: 'attention-census',
    committed: true,
    observed: observed.slice(),
    witnessIndex,
    dryIndex,
    ridgeIndex,
    counterIndex,
    affected: [dryIndex, ridgeIndex, counterIndex],
    energy
  };
}

function buildRibbons(pools, memory) {
  return RIBBON_ROUTES.map((route, ribbonIndex) => {
    const points = route.map((poolIndex, pointIndex) => {
      const pool = pools[poolIndex];
      const drift = Math.sin((pointIndex + 1) * 1.7 + ribbonIndex * 0.8) * 0.008;
      return {
        x: round(clamp(pool.cx + drift + pool.counter * 0.008, 0.02, 0.98)),
        y: round(clamp(pool.cy + pool.offsetY * 0.55 - drift + pool.ridge * 0.006, 0.03, 0.97)),
        width: round(0.018 + pool.rx * 0.14 + pool.ridge * 0.012 - pool.dry * 0.008)
      };
    });
    const memoryWeight = memory.reduce((sum, event, index) => sum + event.observed.length * (index + 1), 0);
    return { id: ribbonIndex, points, width: round(0.014 + ribbonIndex * 0.004 + memoryWeight * 0.0004) };
  });
}

function buildFrameFrom(stage, memory, pending = [], interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  const pools = Array.from({ length: POOL_COUNT }, (_, index) => baselinePool(index));
  let lastEvent = null;

  boundedMemory.forEach((event, eventIndex) => {
    const influence = influenceFor(event, eventIndex);
    const dry = pools[influence.dryIndex];
    dry.dry = round(dry.dry + 0.78 * influence.energy);
    dry.offsetX = round(dry.offsetX - 0.016 * influence.energy);
    dry.offsetY = round(dry.offsetY + 0.010 * influence.energy);
    dry.state = 'dried';

    const ridge = pools[influence.ridgeIndex];
    ridge.ridge = round(ridge.ridge + 0.74 * influence.energy);
    ridge.offsetX = round(ridge.offsetX + 0.019 * influence.energy);
    ridge.offsetY = round(ridge.offsetY - 0.014 * influence.energy);
    ridge.state = 'ridged';

    const counter = pools[influence.counterIndex];
    counter.counter = round(counter.counter + 0.68 * influence.energy);
    counter.offsetX = round(counter.offsetX + 0.015 * (eventIndex % 2 ? -1 : 1));
    counter.offsetY = round(counter.offsetY + 0.018 * influence.energy);
    counter.state = 'counterflow';

    lastEvent = { ...influence, source: event.source };
  });

  pools.forEach((pool) => {
    pool.points = poolPoints(pool);
    pool.pathSignature = pointSignature(pool.points);
  });

  return {
    grammar: 'unlooked-pigment',
    stage,
    memory: boundedMemory,
    pending: pending.map(normalizeObservation),
    pools,
    ribbons: buildRibbons(pools, boundedMemory),
    event: lastEvent,
    lastEvent,
    driedCount: pools.filter((pool) => pool.dry > 0).length,
    ridgedCount: pools.filter((pool) => pool.ridge > 0).length,
    counterflowCount: pools.filter((pool) => pool.counter > 0).length,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory, []);
}

export function applyObservation(frame, observation, source = 'visitor-attention') {
  const normalized = normalizeObservation(observation);
  const poolIndex = nearestPool(frame, normalized);
  if (poolIndex < 0) return { ...frame, interaction: 'attention-refused-empty' };
  if (!frame.pending.length && frame.lastEvent?.observed?.[0] === poolIndex) {
    return { ...frame, interaction: 'attention-refused-repeat' };
  }
  if (frame.pending.some((entry) => entry.poolIndex === poolIndex)) {
    return { ...frame, interaction: 'attention-refused-repeat' };
  }
  const pending = [...frame.pending, { ...normalized, poolIndex }];
  if (pending.length < QUORUM_SIZE) return buildFrameFrom(frame.stage, frame.memory, pending, 'attention-held');
  const event = { observed: pending.map((entry) => entry.poolIndex), source };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], [], 'attention-committed');
}

export function applyCensus(frame, points, source = 'deterministic-census') {
  let next = { ...frame, pending: [] };
  for (const point of points.slice(0, QUORUM_SIZE)) next = applyObservation(next, point, source);
  return next;
}

export function liftLatestAttention(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'attention-lift-refused' };
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), [], 'attention-lifted');
}

export function releaseAttention() {
  return buildFrameFrom(0, [], [], 'attention-released');
}

export function nextControlCensus(index = 0) {
  const frame = buildFrame(0, []);
  const poolIndices = CONTROL_CENSUSES[index % CONTROL_CENSUSES.length];
  return {
    poolIndices: poolIndices.slice(),
    points: poolIndices.map((poolIndex) => ({ x: frame.pools[poolIndex].cx, y: frame.pools[poolIndex].cy }))
  };
}

export function buildTimeline(stageCount = STAGES) {
  let frame = buildFrame(0, []);
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % QUORUM_SIZE === 0) {
      frame = applyCensus(frame, nextControlCensus(stage / QUORUM_SIZE - 1).points, 'timeline-census');
    }
    frame = { ...frame, stage, interaction: stage === 0 ? 'baseline' : 'timeline' };
    timeline.push(frame);
  }
  return timeline;
}

export function frameForMemory(memory) {
  return buildFrame(memory.length, memory);
}

export function geometrySignature(frame) {
  return JSON.stringify({
    pools: frame.pools.map((pool) => ({ id: pool.id, points: pool.points, state: pool.state })),
    ribbons: frame.ribbons
  });
}

const pointSignature = (points) => JSON.stringify(points);

export { nearestPool, poolPoints, pointSignature };
