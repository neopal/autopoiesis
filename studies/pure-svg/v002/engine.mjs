export const SEED = 0x53434732;
export const STAGES = 9;
export const PRIMITIVE_BUDGET = 18;

const BASE_CONTOUR = [
  { x: 0.13, y: 0.54 },
  { x: 0.23, y: 0.43 },
  { x: 0.39, y: 0.34 },
  { x: 0.54, y: 0.35 },
  { x: 0.64, y: 0.29 },
  { x: 0.78, y: 0.30 },
  { x: 0.88, y: 0.39 },
  { x: 0.79, y: 0.49 },
  { x: 0.69, y: 0.49 },
  { x: 0.68, y: 0.68 },
  { x: 0.59, y: 0.64 },
  { x: 0.49, y: 0.57 },
  { x: 0.41, y: 0.70 },
  { x: 0.31, y: 0.65 },
  { x: 0.30, y: 0.53 },
  { x: 0.20, y: 0.63 }
];

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyScar(scar) {
  return {
    ...scar,
    point: copyPoint(scar.point),
    bend: copyPoint(scar.bend),
    influencedIndices: [...scar.influencedIndices]
  };
}

function contourFor(stage) {
  const random = rng(SEED + stage * 104729);
  const lean = Math.sin(stage * 1.17) * 0.028;
  return BASE_CONTOUR.map((point, index) => {
    const jitter = (random() - 0.5) * 0.018;
    const bodyWeight = index > 7 ? 0.72 : 1;
    return {
      x: clamp(point.x + lean * bodyWeight + jitter),
      y: clamp(point.y + Math.cos(stage * 0.63 + index) * 0.012 + jitter * 0.6)
    };
  });
}

function nearestIndex(point, points) {
  return points.reduce((best, candidate, index) => (
    distance(point, candidate) < distance(point, points[best]) ? index : best
  ), 0);
}

function makeScar(points, stage, anchorIndex, source = 'auto-cut', pointOverride = null) {
  const point = pointOverride ? copyPoint(pointOverride) : copyPoint(points[anchorIndex]);
  const turn = (stage + anchorIndex) % 2 === 0 ? 1 : -1;
  const bend = {
    x: turn * (0.074 + (anchorIndex % 3) * 0.009),
    y: 0.046 + (stage % 3) * 0.009
  };
  return {
    point,
    anchorIndex,
    sourceStage: stage,
    source,
    bend,
    influencedIndices: points.map((_, index) => index).filter((index) => index >= anchorIndex)
  };
}

function applyMemory(points, memory, stage) {
  return points.map((point, index) => {
    const result = { ...point };
    for (const scar of memory) {
      const gap = Math.abs(index - scar.anchorIndex);
      const falloff = Math.max(0, 1 - gap / 8);
      const downstream = index >= scar.anchorIndex ? 1 : 0.18;
      const age = clamp((stage - scar.sourceStage + 1) / 3, 0.35, 1);
      const influence = falloff * downstream * age;
      result.x += scar.bend.x * influence;
      result.y += scar.bend.y * influence;

      const local = Math.max(0, 1 - distance(point, scar.point) / 0.34);
      result.x += (scar.point.x - point.x) * local * 0.035 * downstream;
      result.y += (scar.point.y - point.y) * local * 0.035 * downstream;
    }
    return { x: clamp(result.x, 0.04, 0.96), y: clamp(result.y, 0.12, 0.86) };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyScar);
  const points = applyMemory(draft, inherited, stage);
  const cutIndex = (stage * 5 + Math.floor((SEED + stage) % 11)) % points.length;
  const failed = stage === 0 || stage % 2 === 1;
  const scar = failed ? makeScar(points, stage, cutIndex) : null;

  return {
    stage,
    draft,
    points,
    cutIndex,
    failed,
    scar,
    memory: inherited,
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    memoryInfluence: inherited.reduce((sum, entry) => sum + Math.hypot(entry.bend.x, entry.bend.y), 0)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.scar) memory = [...memory, frame.scar].slice(-4);
    return frame;
  });
}

export function deleteScar(frame, scarIndex = frame.memory.length - 1) {
  if (scarIndex < 0 || scarIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== scarIndex);
  return buildFrame(frame.stage, memory);
}

export function applyCut(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.04, 0.96),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.86)
  };
  const anchorIndex = nearestIndex(bounded, frame.points);
  const scar = makeScar(frame.points, frame.stage, anchorIndex, 'visitor-cut', bounded);
  const next = buildFrame(frame.stage, [...frame.memory, scar]);
  return { ...next, scar, interaction: 'visitor-cut' };
}
