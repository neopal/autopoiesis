export const SEED = 0x53505632;
export const STAGES = 8;
export const HINGE_RADIUS = 0.12;
export const PRIMITIVE_BUDGET = 36;

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
const copyHinge = (hinge) => ({ ...hinge, point: hinge.point ? copyPoint(hinge.point) : null });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function baseContour(stage) {
  const random = rng(SEED + stage * 7919);
  const center = { x: 0.5 + (random() - 0.5) * 0.018, y: 0.51 + (random() - 0.5) * 0.018 };
  const points = [];
  const count = 24;
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index / count * TAU;
    const ring = 0.235 + 0.025 * Math.sin(angle * 3 + stage * 0.31) + 0.012 * Math.cos(angle * 7 - stage * 0.2);
    const shoulder = Math.max(0, Math.cos(angle + Math.PI / 2));
    const radiusX = ring * (1 + shoulder * 0.14);
    const radiusY = ring * (1.15 - Math.max(0, Math.sin(angle)) * 0.16);
    points.push({
      x: center.x + Math.cos(angle) * radiusX + (random() - 0.5) * 0.01,
      y: center.y + Math.sin(angle) * radiusY + (random() - 0.5) * 0.01
    });
  }
  return { center, points };
}

function hingeInfluence(point, hinge, stage, index) {
  const dx = point.x - hinge.point.x;
  const dy = point.y - hinge.point.y;
  const distance = Math.max(Math.hypot(dx, dy), 0.015);
  const local = Math.max(0, 1 - distance / 0.34);
  const side = hinge.side || 1;
  const phase = stage * 0.43 + index * 0.17;
  return {
    x: side * local * hinge.weight * 0.052 + Math.sin(phase) * local * hinge.weight * 0.009,
    y: local * hinge.weight * 0.018 + Math.cos(phase) * local * hinge.weight * 0.006
  };
}

function makeContour(stage, memory) {
  const { center, points: draft } = baseContour(stage);
  const contour = draft.map((point, index) => {
    const adjusted = memory.reduce((current, hinge) => {
      const effect = hingeInfluence(current, hinge, stage, index);
      return { x: current.x + effect.x, y: current.y + effect.y };
    }, point);
    const wobble = memory.reduce((sum, hinge) => sum + hinge.weight, 0);
    const axisDrift = (index % 2 ? -1 : 1) * wobble * 0.004;
    return {
      x: adjusted.x + axisDrift,
      y: adjusted.y + Math.sin(index * 0.55 + stage) * wobble * 0.0018
    };
  });
  return { center, draft, contour };
}

function candidateHinge(stage, contour) {
  const random = rng(SEED + stage * 12347 + 11);
  const index = (stage * 5 + Math.floor(random() * contour.length)) % contour.length;
  const point = contour[index];
  return {
    id: `hinge-${stage}`,
    source: 'renderer-refusal',
    stage,
    index,
    point: copyPoint(point),
    side: point.x >= 0.5 ? 1 : -1,
    weight: 1,
    reason: 'the axis refused this side'
  };
}

function buildAxis(stage, memory, center) {
  const signed = memory.reduce((sum, hinge, index) => sum + hinge.side * hinge.weight * (0.72 + index * 0.07), 0);
  const wobble = clamp(Math.abs(signed) * 0.07, 0, 0.16);
  const tilt = signed * 0.18 + Math.sin(stage * 0.8) * 0.014;
  return {
    x: center.x + signed * 0.018,
    y: center.y,
    tilt,
    wobble,
    end: {
      x: center.x + Math.sin(tilt) * 0.34 + signed * 0.014,
      y: center.y - Math.cos(tilt) * 0.34
    }
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyHinge) : [];
  const geometry = makeContour(safe, inherited);
  const axis = buildAxis(safe, inherited, geometry.center);
  const hinge = candidateHinge(safe, geometry.contour);
  const refusalStart = Math.max(0, hinge.index - 1);
  return {
    stage: safe,
    draft: geometry.draft,
    contour: geometry.contour,
    center: geometry.center,
    axis,
    hinge,
    refusalStart,
    refusalLength: 3,
    refused: safe % 2 === 0,
    memory: inherited,
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  const timeline = [];
  let memory = [];
  const count = clamp(Math.floor(Number(stageCount) || 0), 0, STAGES);
  for (let stage = 0; stage < count; stage += 1) {
    const frame = buildFrame(stage, memory);
    timeline.push(frame);
    if (frame.refused) memory = [...memory, frame.hinge].slice(-4);
  }
  return timeline;
}

export function applyHinge(frame, point = {}) {
  const x = clamp(Number.isFinite(Number(point.x)) ? Number(point.x) : 0.68, 0.08, 0.92);
  const y = clamp(Number.isFinite(Number(point.y)) ? Number(point.y) : 0.46, 0.16, 0.84);
  const hinge = {
    id: `visitor-hinge-${frame.stage}-${frame.memory.length + 1}`,
    source: 'visitor-hinge',
    stage: frame.stage,
    index: Math.round(x * (frame.contour.length - 1)),
    point: { x, y },
    side: x >= 0.5 ? 1 : -1,
    weight: 1.35,
    reason: 'the visitor leaned the axis'
  };
  const nextMemory = [...frame.memory, hinge].slice(-4);
  return {
    ...buildFrame(frame.stage, nextMemory),
    interaction: 'visitor-hinge',
    restoreMemory: frame.memory.map(copyHinge)
  };
}

export function deleteLatestHinge(frame) {
  if (frame.restoreMemory) {
    return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'hinge-deleted' };
  }
  if (!frame.memory.length) return { ...frame, interaction: 'hinge-deleted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'hinge-deleted' };
}

export function geometrySignature(frame) {
  return [
    ...frame.contour.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`),
    frame.axis.x.toFixed(6),
    frame.axis.tilt.toFixed(6),
    frame.axis.wobble.toFixed(6)
  ].join('|');
}

export function layoutForViewport(width, height) {
  const narrow = width < 640;
  return {
    mode: narrow ? 'portrait' : 'landscape',
    viewBox: narrow ? '0 0 1000 1200' : '0 0 1200 820',
    width,
    height,
    artworkRatio: narrow ? 5 / 6 : 12 / 8.2
  };
}
