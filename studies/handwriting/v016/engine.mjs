export const STAGES = 17;
export const MEMORY_WINDOW = 5;

const RESERVOIR_COUNT = 12;
const X_MIN = 0.08;
const X_MAX = 0.92;
const Y_MIN = 0.12;
const Y_MAX = 0.88;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function normalizePoint(value, xAxis) {
  const raw = Number(value);
  const safe = Number.isFinite(raw) ? raw : 0.5;
  return round(clamp(safe, xAxis ? X_MIN : Y_MIN, xAxis ? X_MAX : Y_MAX), 4);
}

function normalizePressure(entry, index = 0, stage = 0) {
  return {
    id: String(entry?.id ?? `pressure-${stage}-${index}`),
    source: String(entry?.source ?? 'timeline-pressure'),
    stage: Math.max(0, Math.floor(Number(entry?.stage) || stage)),
    startX: normalizePoint(entry?.startX, true),
    startY: normalizePoint(entry?.startY, false),
    endX: normalizePoint(entry?.endX, true),
    endY: normalizePoint(entry?.endY, false),
    force: round(clamp(Number(entry?.force) || 0.5, 0.18, 1), 4),
    phase: round(Number(entry?.phase) || 0, 6)
  };
}

function copyReservoir(reservoir) {
  return { ...reservoir };
}

function copyBridge(bridge) {
  return { ...bridge, points: bridge.points.map((point) => ({ ...point })) };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeBaseReservoirs(stage) {
  const random = rng(0x48574416 + stage * 65537);
  return Array.from({ length: RESERVOIR_COUNT }, (_, index) => {
    const t = index / (RESERVOIR_COUNT - 1);
    const x = 0.14 + t * 0.72;
    const y = 0.51 + Math.sin(t * Math.PI * 2.12 - 0.48) * 0.22;
    const tangentX = 0.72;
    const tangentY = Math.cos(t * Math.PI * 2.12 - 0.48) * 0.22 * Math.PI * 2.12 / 0.72;
    return {
      id: `reservoir-${index}`,
      index,
      x: round(x + (random() - 0.5) * 0.012),
      y: round(y + (random() - 0.5) * 0.014),
      angle: round(Math.atan2(tangentY, tangentX)),
      scale: round(0.86 + random() * 0.2),
      mouth: round(0.44 + random() * 0.16),
      load: round(0.26 + random() * 0.24),
      role: 'soft',
      sourceStage: stage
    };
  });
}

function makeBaseBridges(reservoirs) {
  return reservoirs.slice(0, -1).map((from, index) => {
    const to = reservoirs[index + 1];
    return {
      id: `spine-${index}`,
      from: from.index,
      to: to.index,
      kind: 'spine',
      points: [
        { x: from.x + 0.028, y: from.y },
        { x: lerp(from.x, to.x, 0.5), y: lerp(from.y, to.y, 0.5) - 0.02 * Math.sin(index) },
        { x: to.x - 0.028, y: to.y }
      ]
    };
  });
}

function nearestReservoir(reservoirs, point) {
  return reservoirs.reduce((best, reservoir) => {
    const currentDistance = distance(reservoir, point);
    return currentDistance < best.distance ? { reservoir, distance: currentDistance } : best;
  }, { reservoir: reservoirs[0], distance: Infinity }).reservoir;
}

function applyMaterialPressure(reservoirs, bridges, pressure, breaks, redirects) {
  const start = { x: pressure.startX, y: pressure.startY };
  const origin = nearestReservoir(reservoirs, start);
  const nextIndex = Math.min(RESERVOIR_COUNT - 1, origin.index + 1);
  const farIndex = Math.min(RESERVOIR_COUNT - 1, origin.index + 4);
  const next = reservoirs[nextIndex];
  const far = reservoirs[farIndex];
  const dx = pressure.endX - pressure.startX;
  const dy = pressure.endY - pressure.startY;
  const magnitude = Math.hypot(dx, dy);
  const nx = dx / Math.max(0.0001, magnitude);
  const ny = dy / Math.max(0.0001, magnitude);
  const force = pressure.force;

  origin.x = round(clamp(origin.x + nx * 0.028 * force, X_MIN, X_MAX));
  origin.y = round(clamp(origin.y + ny * 0.028 * force, Y_MIN, Y_MAX));
  origin.angle = round(origin.angle + Math.atan2(ny, nx) * 0.18 * force);
  origin.scale = round(origin.scale * (1 - 0.16 * force));
  origin.mouth = round(clamp(origin.mouth - 0.30 * force, 0.08, 0.9));
  origin.load = round(clamp(origin.load + 0.42 * force, 0, 1));
  origin.role = 'sealed';

  next.x = round(clamp(next.x + nx * 0.04 * force, X_MIN, X_MAX));
  next.y = round(clamp(next.y + ny * 0.04 * force + 0.02 * force, Y_MIN, Y_MAX));
  next.angle = round(next.angle - Math.atan2(ny, nx) * 0.22 * force);
  next.scale = round(next.scale * (1 + 0.18 * force));
  next.mouth = round(clamp(next.mouth + 0.24 * force, 0.1, 0.96));
  next.load = round(clamp(next.load + 0.28 * force, 0, 1));
  next.role = 'receiving';

  far.x = round(clamp(far.x - nx * 0.026 * force, X_MIN, X_MAX));
  far.y = round(clamp(far.y - ny * 0.026 * force - 0.018 * force, Y_MIN, Y_MAX));
  far.angle = round(far.angle + Math.atan2(ny, nx) * 0.14 * force);
  far.scale = round(far.scale * (1 + 0.10 * force));
  far.load = round(clamp(far.load + 0.18 * force, 0, 1));
  far.role = 'overflow';

  breaks.push({
    id: `break-${pressure.id}`,
    from: origin.index,
    to: next.index,
    amount: round(force)
  });
  redirects.push({
    id: `redirect-${pressure.id}`,
    from: origin.index,
    to: far.index,
    kind: 'overflow',
    force: round(force),
    points: [
      { x: origin.x + 0.018, y: origin.y - 0.012 },
      { x: lerp(origin.x, far.x, 0.46), y: lerp(origin.y, far.y, 0.46) - 0.14 * force },
      { x: far.x - 0.018, y: far.y + 0.012 }
    ]
  });

  for (const bridge of bridges) {
    if (bridge.from === origin.index && bridge.to === next.index) bridge.kind = 'broken';
  }
}

function makeStagePressure(stage) {
  if (stage <= 0) return null;
  const index = (stage * 3) % (RESERVOIR_COUNT - 3);
  const startX = 0.14 + (index / (RESERVOIR_COUNT - 1)) * 0.72;
  const startY = 0.51 + Math.sin((index / (RESERVOIR_COUNT - 1)) * Math.PI * 2.12 - 0.48) * 0.22;
  return normalizePressure({
    id: `stage-${stage}-pressure`,
    stage,
    startX,
    startY,
    endX: startX + (stage % 2 ? 0.34 : -0.27),
    endY: startY + (stage % 3 - 1) * 0.24,
    force: 0.78 + (stage % 4) * 0.05,
    phase: stage * 0.71
  }, 0, stage);
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const reservoirs = makeBaseReservoirs(stage);
  const bridges = makeBaseBridges(reservoirs);
  const stableMemory = memory.map((entry, index) => normalizePressure(entry, index, stage)).slice(-MEMORY_WINDOW);
  const breaks = [];
  const redirects = [];

  for (const pressure of stableMemory) {
    applyMaterialPressure(reservoirs, bridges, pressure, breaks, redirects);
  }

  const nextPressure = makeStagePressure(stage);
  return {
    stage,
    reservoirs,
    bridges: bridges.filter((bridge) => bridge.kind !== 'broken').map(copyBridge).concat(redirects.map(copyBridge)),
    breaks,
    redirects: redirects.map(copyBridge),
    memory: stableMemory,
    accepted: true,
    previousMemory: null,
    newPressures: nextPressure ? [nextPressure] : [],
    dryCount: reservoirs.filter((reservoir) => reservoir.role === 'sealed').length,
    openCount: reservoirs.filter((reservoir) => reservoir.mouth > 0.35).length
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newPressures].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyPressure(frame, gesture) {
  const startX = normalizePoint(gesture?.startX, true);
  const startY = normalizePoint(gesture?.startY, false);
  const endX = normalizePoint(gesture?.endX, true);
  const endY = normalizePoint(gesture?.endY, false);
  const length = Math.hypot(endX - startX, endY - startY);
  if (length < 0.06) {
    return { ...frame, accepted: false, rejected: 'short-pressure' };
  }

  const event = normalizePressure({
    id: `visitor-pressure-${frame.stage}-${frame.memory.length}`,
    source: 'visitor-pressure',
    stage: frame.stage,
    startX,
    startY,
    endX,
    endY,
    force: clamp(length / 0.64, 0.22, 1),
    phase: startX * 17.3 + endY * 11.7
  }, frame.memory.length, frame.stage);
  const next = buildFrame(frame.stage, [...frame.memory, event]);
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function removeLatestPressure(frame) {
  const previousMemory = Array.isArray(frame.previousMemory)
    ? frame.previousMemory
    : frame.memory.slice(0, -1);
  return buildFrame(frame.stage, previousMemory);
}

export const constants = {
  reservoirCount: RESERVOIR_COUNT,
  memoryWindow: MEMORY_WINDOW,
  finalStage: STAGES - 1,
  bounds: { xMin: X_MIN, xMax: X_MAX, yMin: Y_MIN, yMax: Y_MAX }
};
