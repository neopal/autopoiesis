export const SEED = 0x42525539;
export const STAGES = 13;
export const STROKE_COUNT = 10;
export const POINT_COUNT = 68;
export const MEMORY_LIMIT = 8;
export const PRIMITIVE_BUDGET = 43;

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

function copyGate(gate) {
  return { ...gate, point: copyPoint(gate.point) };
}

function automaticGate(stage) {
  const random = rng(SEED + stage * 7919);
  const lane = (stage * 7 + 3) % STROKE_COUNT;
  return {
    id: `auto-braid-gate-${stage}`,
    stage,
    source: 'autonomous-braid-gate',
    point: {
      x: clamp(0.12 + stage * 0.066 + (random() - 0.5) * 0.04, 0.09, 0.89),
      y: clamp(0.085 + lane * 0.086 + (random() - 0.5) * 0.025, 0.07, 0.93)
    },
    radius: 0.034 + random() * 0.015,
    spread: 0.082 + random() * 0.026,
    settle: 0.092 + random() * 0.036,
    deposit: 0.16 + random() * 0.06,
    side: stage % 2 === 0 ? 1 : -1,
    lane,
    rule: 'split-settle'
  };
}

function relevanceFor(gate, baseY, strokeIndex) {
  const laneDistance = Math.abs(baseY - gate.point.y);
  const laneWeight = clamp(1 - laneDistance / 0.23);
  const neighborWeight = clamp(1 - Math.abs(strokeIndex - gate.lane) / 3.8);
  return laneWeight * (0.42 + neighborWeight * 0.58);
}

function makeStroke(stage, strokeIndex, memory) {
  const random = rng(SEED + stage * 104729 + strokeIndex * 977);
  const baseY = 0.075 + strokeIndex * 0.086;
  const phase = random() * Math.PI * 2;
  const points = [];
  let splitAmplitude = 0;
  let settleMass = 0;
  let depositMass = 0;
  let routeShift = 0;

  for (let pointIndex = 0; pointIndex < POINT_COUNT; pointIndex += 1) {
    const progress = pointIndex / (POINT_COUNT - 1);
    const x = 0.028 + progress * 0.944;
    let y = baseY
      + Math.sin(phase + progress * (Math.PI * 1.22 + strokeIndex * 0.2) + stage * 0.14) * (0.013 + random() * 0.011)
      + Math.sin(progress * Math.PI * 3.8 + strokeIndex * 0.49) * 0.006;
    let localSplit = 0;
    let localSettle = 0;
    let localDeposit = 0;

    for (const gate of memory) {
      const relevance = relevanceFor(gate, baseY, strokeIndex);
      if (relevance <= 0.025) continue;
      const distance = x - gate.point.x;
      const enter = smoothstep((distance + gate.radius * 1.45) / (gate.radius * 1.65));
      const leave = smoothstep((distance - gate.radius * 0.15) / (gate.radius * 2.45));
      const split = enter * (1 - leave);
      const settle = smoothstep((distance - gate.settle) / (gate.radius * 3.6));
      const depositPulse = Math.exp(-Math.pow((distance - gate.settle) / (gate.radius * 2.3), 2));
      const laneOffset = strokeIndex - gate.lane;
      const laneSign = laneOffset === 0 ? (strokeIndex % 2 === 0 ? -1 : 1) : Math.sign(laneOffset);
      const splitRoute = gate.side * laneSign * relevance * gate.spread * split;
      const settleRoute = -gate.side * laneSign * relevance * gate.spread * 0.92 * settle;
      const settlePull = (gate.point.y - baseY) * relevance * gate.deposit * 0.24 * depositPulse;

      y += splitRoute + settleRoute + settlePull;
      localSplit += Math.abs(splitRoute);
      localSettle += Math.abs(settleRoute) + Math.abs(settlePull);
      localDeposit += depositPulse * gate.deposit * relevance;
    }

    const boundedSplit = clamp(localSplit, 0, 0.32);
    const boundedSettle = clamp(localSettle, 0, 0.38);
    const boundedDeposit = clamp(localDeposit, 0, 0.34);
    splitAmplitude += boundedSplit / POINT_COUNT;
    settleMass += boundedSettle / POINT_COUNT;
    depositMass += boundedDeposit / POINT_COUNT;
    routeShift += (boundedSplit - boundedSettle) * (0.34 + progress) / POINT_COUNT;
    points.push({
      x,
      y: clamp(y, 0.035, 0.965),
      split: boundedSplit,
      settle: boundedSettle,
      deposit: boundedDeposit,
      width: clamp(1 + boundedSplit * 1.25 + boundedDeposit * 2.4, 1, 1.72)
    });
  }

  const rejoinIndex = Math.min(POINT_COUNT - 1, Math.floor(POINT_COUNT * 0.77));
  const rejoinError = Math.abs(points[rejoinIndex].y - baseY);
  const baseWeight = 0.0054 + random() * 0.0037;
  return {
    id: `stage-${stage}-stroke-${strokeIndex}`,
    index: strokeIndex,
    points,
    baseY,
    weight: baseWeight * clamp(1 + settleMass * 2 + depositMass * 0.9, 0.84, 1.34),
    opacity: 0.55 + random() * 0.24,
    splitAmplitude,
    settleMass,
    depositMass,
    routeShift,
    rejoinError
  };
}

function makeDeltas(memory, stage) {
  return memory.map((gate, index) => ({
    id: gate.id,
    point: copyPoint(gate.point),
    radius: gate.radius * (1 + Math.min(index, 7) * 0.055),
    spread: gate.spread,
    settle: gate.settle,
    deposit: gate.deposit,
    side: gate.side,
    age: Math.max(0, stage - gate.stage),
    source: gate.source,
    rule: 'split-settle'
  }));
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(stage)));
  const inherited = Array.isArray(memory) ? memory.map(copyGate).slice(-MEMORY_LIMIT) : [];
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  return {
    stage: safeStage,
    memory: inherited,
    strokes,
    deltas: makeDeltas(inherited, safeStage),
    currentGate: automaticGate(safeStage),
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.currentGate].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyRemoval(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.09, 0.91)
  };
  const gate = {
    id: `visitor-braid-gate-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    source: 'visitor-braid-gate',
    point: bounded,
    radius: 0.056,
    spread: 0.15,
    settle: 0.112,
    deposit: 0.225,
    side: frame.memory.length % 2 === 0 ? 1 : -1,
    lane: Math.round((bounded.y - 0.075) / 0.086),
    rule: 'split-settle'
  };
  const next = buildFrame(frame.stage, [...frame.memory, gate]);
  return { ...next, interaction: 'visitor-braid-gate' };
}

export function removeLatestRemoval(frame) {
  if (!frame.memory.length) return { ...buildFrame(frame.stage, []), interaction: 'braid-gate-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'braid-gate-lifted' };
}
