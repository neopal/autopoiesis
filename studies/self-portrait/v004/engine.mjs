export const SEED = 0x53505634;
export const STAGES = 10;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 44;

const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyRefusal = (refusal) => ({ ...refusal, point: copyPoint(refusal.point) });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function baseContour(stage) {
  const random = rng(SEED + stage * 7919);
  const center = {
    x: 0.5 + (random() - 0.5) * 0.018,
    y: 0.51 + (random() - 0.5) * 0.016
  };
  const points = [];
  const count = 36;

  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index / count * TAU;
    const breathing = Math.sin(stage * 0.29 + angle * 2.1) * 0.018;
    const asymmetry = Math.cos(angle * 3.4 - stage * 0.19) * 0.021;
    const shoulder = Math.max(0, Math.cos(angle + Math.PI / 2));
    const noise = (random() - 0.5) * 0.009;
    const radius = 0.245 + breathing + asymmetry + noise;
    points.push({
      x: center.x + Math.cos(angle) * radius * (1 + shoulder * 0.12),
      y: center.y + Math.sin(angle) * radius * (1.18 - Math.max(0, Math.sin(angle)) * 0.13)
    });
  }
  return { center, points };
}

function refusalInfluence(point, refusal, stage, index) {
  const dx = point.x - refusal.point.x;
  const dy = point.y - refusal.point.y;
  const distance = Math.max(Math.hypot(dx, dy), 0.018);
  const local = Math.max(0, 1 - distance / 0.58);
  const downstream = clamp((point.y - refusal.point.y + 0.12) / 0.5, 0, 1);
  const side = refusal.side || 1;
  const phase = stage * 0.31 + index * 0.23 + refusal.phase;
  const pressure = refusal.weight * local * (0.55 + downstream * 0.9);
  return {
    x: (dx / distance) * pressure * 0.018 + side * pressure * 0.012,
    y: (dy / distance) * pressure * 0.009 + Math.sin(phase) * pressure * 0.007
  };
}

function makeContour(stage, memory) {
  const { center, points: draft } = baseContour(stage);
  const contour = draft.map((point, index) => {
    const adjusted = memory.reduce((current, refusal) => {
      const effect = refusalInfluence(current, refusal, stage, index);
      return { x: current.x + effect.x, y: current.y + effect.y };
    }, copyPoint(point));
    const splitPressure = memory.reduce((sum, refusal) => sum + refusal.side * refusal.weight, 0);
    const axisPull = splitPressure * 0.0032 * (index % 4 === 0 ? 1 : -0.28);
    return {
      x: clamp(adjusted.x + axisPull, 0.07, 0.93),
      y: clamp(adjusted.y + Math.sin(index * 0.53 + stage) * memory.length * 0.0012, 0.08, 0.92)
    };
  });
  return { center, draft, contour };
}

function makeAperture(stage, memory, center) {
  const inherited = memory.reduce((result, refusal, index) => {
    const age = 0.72 + index * 0.1;
    result.x += (refusal.point.x - 0.5) * 0.1 * age + refusal.side * 0.01 * age;
    result.y += (refusal.point.y - 0.5) * 0.07 * age;
    result.rx += 0.005 * age;
    result.ry += 0.008 * age;
    result.rotation += refusal.side * 0.055 * age;
    return result;
  }, { x: 0, y: 0, rx: 0, ry: 0, rotation: 0 });

  return {
    x: clamp(center.x + Math.sin(stage * 0.51) * 0.016 + inherited.x, 0.27, 0.73),
    y: clamp(center.y + Math.cos(stage * 0.37) * 0.018 + inherited.y, 0.24, 0.76),
    rx: clamp(0.064 + Math.sin(stage * 0.27) * 0.009 + inherited.rx, 0.05, 0.11),
    ry: clamp(0.122 + Math.cos(stage * 0.23) * 0.012 + inherited.ry, 0.09, 0.17),
    rotation: inherited.rotation + Math.sin(stage * 0.33) * 0.08,
    opening: clamp(0.5 + memory.length * 0.065 + Math.abs(inherited.x) * 0.55, 0.4, 0.84)
  };
}

function buildAxis(stage, memory, center) {
  const signed = memory.reduce((sum, refusal, index) => sum + refusal.side * refusal.weight * (0.62 + index * 0.18), 0);
  const tilt = signed * 0.105 + Math.sin(stage * 0.65) * 0.018;
  const wobble = clamp(Math.abs(signed) * 0.06, 0, 0.15);
  return {
    x: center.x + signed * 0.017,
    y: center.y,
    tilt,
    wobble,
    start: {
      x: center.x - Math.sin(tilt) * 0.31 + signed * 0.005,
      y: center.y + Math.cos(tilt) * 0.31
    },
    end: {
      x: center.x + Math.sin(tilt) * 0.31 + signed * 0.013,
      y: center.y - Math.cos(tilt) * 0.31
    }
  };
}

function makeForkedRoute(refusal, index, stage) {
  const side = refusal.side || 1;
  const age = 0.72 + index * 0.13;
  const split = {
    x: clamp(0.46 + (refusal.point.x - 0.5) * 0.08 + side * 0.012 + (index - 1.5) * 0.012, 0.34, 0.62),
    y: clamp(0.31 + index * 0.018 + (refusal.point.y - 0.5) * 0.08, 0.25, 0.43)
  };
  const rejoin = {
    x: clamp(0.55 + side * (0.04 + age * 0.018) + (index - 1.5) * 0.018, 0.34, 0.76),
    y: clamp(0.7 + index * 0.018 + (0.5 - refusal.point.y) * 0.06, 0.58, 0.86)
  };
  const phase = refusal.phase + stage * 0.11;
  const left = [];
  const right = [];
  for (let pointIndex = 0; pointIndex < 11; pointIndex += 1) {
    const t = pointIndex / 10;
    const baseX = split.x + (rejoin.x - split.x) * t + Math.sin(t * Math.PI) * side * (0.038 + index * 0.004);
    const baseY = split.y + (rejoin.y - split.y) * t;
    const separation = Math.sin(t * Math.PI) * (0.05 + 0.014 * age);
    const normalX = 1;
    const normalY = Math.sin(phase + t * 0.4) * 0.18;
    left.push({ x: clamp(baseX + normalX * separation, 0.12, 0.88), y: clamp(baseY + normalY * separation, 0.16, 0.88) });
    right.push({ x: clamp(baseX - normalX * separation, 0.12, 0.88), y: clamp(baseY - normalY * separation, 0.16, 0.88) });
  }
  return {
    id: `fork-${refusal.id}`,
    source: refusal.source,
    refusalId: refusal.id,
    split,
    rejoin,
    left,
    right,
    weight: refusal.weight,
    age
  };
}

function makeForkedRoutes(stage, memory) {
  return memory.map((refusal, index) => makeForkedRoute(refusal, index, stage));
}

function candidateRefusal(stage, contour) {
  const random = rng(SEED + stage * 12347 + 19);
  const index = (stage * 9 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `refusal-${stage}`,
    source: 'renderer-refusal',
    stage,
    index,
    point: {
      x: clamp(0.5 + (boundary.x - 0.5) * 0.45, 0.18, 0.82),
      y: clamp(0.5 + (boundary.y - 0.5) * 0.46, 0.23, 0.77)
    },
    side: boundary.x >= 0.5 ? 1 : -1,
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait withheld the place where its routes would meet'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyRefusal).slice(-MEMORY_LIMIT) : [];
  const geometry = makeContour(safe, inherited);
  const aperture = makeAperture(safe, inherited, geometry.center);
  const axis = buildAxis(safe, inherited, geometry.center);
  const refusal = candidateRefusal(safe, geometry.contour);
  return {
    stage: safe,
    draft: geometry.draft,
    contour: geometry.contour,
    center: geometry.center,
    aperture,
    axis,
    refusal,
    forkedRoutes: makeForkedRoutes(safe, inherited),
    refused: safe % 2 === 0,
    memory: inherited,
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const count = clamp(Math.floor(Number(stageCount) || 0), 0, STAGES);
  return Array.from({ length: count }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.refused) memory = [...memory, frame.refusal].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyRefusal(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.68, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.46, 0.16, 0.84)
  };
  const refusal = {
    id: `visitor-refusal-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-refusal',
    stage: frame.stage,
    index: Math.round(bounded.x * 35),
    point: bounded,
    side: bounded.x >= 0.5 ? 1 : -1,
    weight: 1.35,
    phase: 0.37,
    reason: 'the visitor withheld the place where routes would meet'
  };
  const nextMemory = [...frame.memory, refusal].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-refusal',
    restoreMemory: frame.memory.map(copyRefusal)
  };
}

export function deleteLatestRefusal(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'refusal-lifted' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'refusal-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'refusal-lifted' };
}

export function geometrySignature(frame) {
  const points = (frame.forkedRoutes ?? []).flatMap((route) => [...route.left, ...route.right]);
  return [
    ...frame.contour.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...Object.values(frame.aperture).map((value) => Number(value).toFixed(6)),
    frame.axis.x.toFixed(6),
    frame.axis.tilt.toFixed(6),
    frame.axis.wobble.toFixed(6),
    ...points.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`)
  ].join('|');
}
