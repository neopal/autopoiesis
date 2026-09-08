export const SEED = 0x53505633;
export const STAGES = 9;
export const MEMORY_LIMIT = 3;
export const PRIMITIVE_BUDGET = 40;

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
const copyAbsence = (absence) => ({ ...absence, point: copyPoint(absence.point) });

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
  const count = 32;

  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index / count * TAU;
    const breathing = Math.sin(stage * 0.31 + angle * 2.2) * 0.018;
    const asymmetry = Math.cos(angle * 3 - stage * 0.22) * 0.022;
    const noise = (random() - 0.5) * 0.009;
    const radius = 0.245 + breathing + asymmetry + noise;
    const vertical = 1.18 + Math.max(0, Math.sin(angle)) * 0.13;
    points.push({
      x: center.x + Math.cos(angle) * radius * (1 + Math.max(0, -Math.sin(angle)) * 0.1),
      y: center.y + Math.sin(angle) * radius * vertical
    });
  }
  return { center, points };
}

function absenceInfluence(point, absence, stage, index) {
  const dx = point.x - absence.point.x;
  const dy = point.y - absence.point.y;
  const distance = Math.max(Math.hypot(dx, dy), 0.018);
  const local = Math.max(0, 1 - distance / 0.55);
  const side = absence.side || 1;
  const phase = stage * 0.36 + index * 0.29 + absence.phase;
  const outward = 0.025 * local * absence.weight;
  return {
    x: (dx / distance) * outward + side * local * absence.weight * 0.009,
    y: (dy / distance) * outward * 0.42 + Math.sin(phase) * local * absence.weight * 0.006
  };
}

function makeContour(stage, memory) {
  const { center, points: draft } = baseContour(stage);
  const contour = draft.map((point, index) => {
    const adjusted = memory.reduce((current, absence) => {
      const effect = absenceInfluence(current, absence, stage, index);
      return { x: current.x + effect.x, y: current.y + effect.y };
    }, copyPoint(point));
    const weightedSide = memory.reduce((sum, absence) => sum + absence.side * absence.weight, 0);
    const axisPull = weightedSide * 0.0025 * (index % 3 === 0 ? 1 : -0.35);
    return {
      x: clamp(adjusted.x + axisPull, 0.08, 0.92),
      y: clamp(adjusted.y + Math.sin(index * 0.61 + stage) * memory.length * 0.0014, 0.1, 0.9)
    };
  });
  return { center, draft, contour };
}

function makeAperture(stage, memory, center) {
  const inherited = memory.reduce((result, absence, index) => {
    const age = 0.72 + index * 0.11;
    result.x += (absence.point.x - 0.5) * 0.13 * age + absence.side * 0.012 * age;
    result.y += (absence.point.y - 0.5) * 0.08 * age;
    result.rx += 0.006 * age;
    result.ry += 0.009 * age;
    result.rotation += absence.side * 0.045 * age;
    return result;
  }, { x: 0, y: 0, rx: 0, ry: 0, rotation: 0 });

  const x = clamp(center.x + Math.sin(stage * 0.53) * 0.018 + inherited.x, 0.27, 0.73);
  const y = clamp(center.y + Math.cos(stage * 0.41) * 0.02 + inherited.y, 0.24, 0.76);
  return {
    x,
    y,
    rx: clamp(0.065 + Math.sin(stage * 0.29) * 0.009 + inherited.rx, 0.052, 0.11),
    ry: clamp(0.125 + Math.cos(stage * 0.24) * 0.012 + inherited.ry, 0.09, 0.17),
    rotation: inherited.rotation + Math.sin(stage * 0.37) * 0.08,
    opening: clamp(0.52 + memory.length * 0.07 + Math.abs(inherited.x) * 0.5, 0.42, 0.82)
  };
}

function buildAxis(stage, memory, center) {
  const signed = memory.reduce((sum, absence, index) => sum + absence.side * absence.weight * (0.68 + index * 0.16), 0);
  const tilt = signed * 0.12 + Math.sin(stage * 0.72) * 0.018;
  const wobble = clamp(Math.abs(signed) * 0.055, 0, 0.13);
  return {
    x: center.x + signed * 0.015,
    y: center.y,
    tilt,
    wobble,
    start: {
      x: center.x - Math.sin(tilt) * 0.31 + signed * 0.006,
      y: center.y + Math.cos(tilt) * 0.31
    },
    end: {
      x: center.x + Math.sin(tilt) * 0.31 + signed * 0.012,
      y: center.y - Math.cos(tilt) * 0.31
    }
  };
}

function candidateAbsence(stage, contour) {
  const random = rng(SEED + stage * 12347 + 17);
  const index = (stage * 7 + Math.floor(random() * contour.length)) % contour.length;
  const boundary = contour[index];
  return {
    id: `absence-${stage}`,
    source: 'renderer-refusal',
    stage,
    index,
    point: {
      x: clamp(0.5 + (boundary.x - 0.5) * 0.48, 0.18, 0.82),
      y: clamp(0.5 + (boundary.y - 0.5) * 0.48, 0.24, 0.76)
    },
    side: boundary.x >= 0.5 ? 1 : -1,
    weight: 1,
    phase: random() * TAU,
    reason: 'the portrait withheld this interior'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyAbsence).slice(-MEMORY_LIMIT) : [];
  const geometry = makeContour(safe, inherited);
  const aperture = makeAperture(safe, inherited, geometry.center);
  const axis = buildAxis(safe, inherited, geometry.center);
  const absence = candidateAbsence(safe, geometry.contour);
  return {
    stage: safe,
    draft: geometry.draft,
    contour: geometry.contour,
    center: geometry.center,
    aperture,
    axis,
    absence,
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
    if (frame.refused) memory = [...memory, frame.absence].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyAbsence(frame, point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.68, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.46, 0.16, 0.84)
  };
  const absence = {
    id: `visitor-absence-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-absence',
    stage: frame.stage,
    index: Math.round(bounded.x * 31),
    point: bounded,
    side: bounded.x >= 0.5 ? 1 : -1,
    weight: 1.3,
    phase: 0.37,
    reason: 'the visitor withheld an interior'
  };
  const nextMemory = [...frame.memory, absence].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-absence',
    restoreMemory: frame.memory.map(copyAbsence)
  };
}

export function deleteLatestAbsence(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'absence-lifted' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'absence-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'absence-lifted' };
}

export function geometrySignature(frame) {
  return [
    ...frame.contour.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    ...Object.values(frame.aperture).map((value) => Number(value).toFixed(6)),
    frame.axis.x.toFixed(6),
    frame.axis.tilt.toFixed(6),
    frame.axis.wobble.toFixed(6)
  ].join('|');
}
