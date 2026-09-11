export const MASTER_SEED = 0x73747574;

const ROUTE_COUNT = 16;
const POINT_COUNT = 32;
const MEMORY_WINDOW = 6;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (value) => value * value * (3 - 2 * value);

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyPoints(points) {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function normalizeStutter(stutter, index = 0) {
  const x = Number(stutter?.x);
  const y = Number(stutter?.y);
  return {
    id: String(stutter?.id ?? `stutter-${index}`),
    stage: Math.max(0, Math.floor(Number(stutter?.stage) || 0)),
    x: Number(clamp(Number.isFinite(x) ? x : 0.5, 0.06, 0.94).toFixed(4)),
    y: Number(clamp(Number.isFinite(y) ? y : 0.5, 0.08, 0.86).toFixed(4)),
    force: Number(clamp(Number(stutter?.force) || 0.8, 0.3, 1).toFixed(4)),
    phase: Number((Number(stutter?.phase) || 0).toFixed(6))
  };
}

function closestRoutePoint(points, stutter) {
  return points.reduce((best, point, index) => {
    const dx = (point.x - stutter.x) * 0.82;
    const dy = point.y - stutter.y;
    const distance = Math.hypot(dx, dy);
    return distance < best.distance ? { distance, index } : best;
  }, { distance: Infinity, index: 0 });
}

function nearestStutter(points, stutters, stage) {
  return stutters
    .filter((stutter) => stutter.stage <= stage)
    .map((stutter) => {
      const closest = closestRoutePoint(points, stutter);
      const influence = clamp((0.24 - closest.distance) / 0.18) * stutter.force;
      return { stutter, ...closest, influence };
    })
    .filter((entry) => entry.influence > 0.05)
    .sort((a, b) => b.influence - a.influence || b.stutter.stage - a.stutter.stage)[0] ?? null;
}

function makeStageStutter(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const route = (stage * 5 + 1) % 12;
  const x = 0.18 + ((stage * 19) % 62) / 100;
  const y = 0.13 + route * 0.063 + ((stage % 3) - 1) * 0.007;
  return normalizeStutter({
    id: `stage-${stage}-stutter`,
    stage,
    x,
    y,
    force: 0.78,
    phase: stage * 0.73 + route * 0.31
  });
}

/**
 * v007 changes handwriting's rule from a shared counterform aperture to a
 * shared stutter. A remembered refusal makes nearby routes repeat one hook,
 * then continue with a common phase slip instead of disappearing.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const activeStutters = memory.map(normalizeStutter).slice(-MEMORY_WINDOW);

  return Array.from({ length: ROUTE_COUNT }, (_, routeIndex) => {
    const lane = routeIndex % 12;
    const band = Math.floor(routeIndex / 12);
    const phase = random() * Math.PI * 2;
    const laneY = 0.13 + lane * 0.063 + band * 0.018;
    const points = [];

    for (let step = 0; step < POINT_COUNT; step += 1) {
      const x = 0.045 + step * 0.0295;
      const wave = Math.sin(step * 0.58 + phase + stage * 0.17) * 0.014;
      const letter = Math.sin(step * 1.71 + phase * 0.63) * 0.0055;
      const tremor = (random() - 0.5) * 0.013;
      points.push({ x, y: laneY + wave + letter + tremor });
    }

    const draftPoints = copyPoints(points);
    const nearest = nearestStutter(points, activeStutters, stage);
    const influence = nearest?.influence ?? 0;
    let stutterStart = -1;
    let stutterEnd = -1;
    let repeatPeak = -1;
    let phaseSlip = 0;
    let sharedStutter = false;

    if (nearest) {
      stutterStart = Math.max(4, Math.min(POINT_COUNT - 10, nearest.index - 3));
      stutterEnd = Math.min(POINT_COUNT - 5, stutterStart + 7);
      repeatPeak = stutterStart + 3;
      sharedStutter = influence > 0.18;
      const hingeY = nearest.stutter.y + Math.sin(nearest.stutter.phase + band * 0.41) * 0.008;
      const direction = ((routeIndex + Math.round(nearest.stutter.y * 100)) % 2 ? 1 : -1);
      phaseSlip = direction * (0.021 + influence * 0.024);

      for (let step = 0; step < POINT_COUNT; step += 1) {
        if (step < stutterStart) {
          const approach = smooth(clamp((step - (stutterStart - 5)) / 5));
          points[step].y += (hingeY - points[step].y) * influence * approach * 0.72;
        } else if (step <= stutterEnd) {
          const beat = (step - stutterStart) / Math.max(1, stutterEnd - stutterStart);
          const envelope = Math.sin(beat * Math.PI);
          const doubledHook = Math.sin(beat * Math.PI * 2 + nearest.stutter.phase) * 0.024 * influence;
          points[step].x += envelope * 0.012 * influence;
          points[step].y += (hingeY - points[step].y) * influence * (0.34 + envelope * 0.38);
          points[step].y += doubledHook;
        } else {
          const after = smooth(clamp((step - stutterEnd) / 9));
          const repeatedCadence = Math.sin((step - stutterEnd) * 0.82 + nearest.stutter.phase) * 0.011 * influence;
          points[step].x += 0.01 * influence * (1 - after * 0.35);
          points[step].y += phaseSlip * (1 - after * 0.52) + repeatedCadence;
        }
      }
    }

    const automaticWitness = (routeIndex + stage * 2) % 13 === 0;
    const witnessIndex = 7 + ((routeIndex + stage) % 5);
    const refusal = automaticWitness ? {
      id: `route-${stage}-${routeIndex}`,
      stage,
      route: routeIndex,
      x: Number(points[witnessIndex].x.toFixed(4)),
      y: Number(points[witnessIndex].y.toFixed(4)),
      force: Number(Math.max(influence, 0.34).toFixed(4)),
      phase: Number((phase + routeIndex * 0.27).toFixed(6))
    } : null;

    return {
      id: `route-${stage}-${routeIndex}`,
      points,
      draftPoints,
      lane: routeIndex,
      stutterStart,
      stutterEnd,
      repeatPeak,
      stutterStrength: Number(influence.toFixed(4)),
      stutterSource: nearest && sharedStutter ? nearest.stutter.id : null,
      sharedStutter,
      phaseSlip: Number(phaseSlip.toFixed(6)),
      failed: Boolean(refusal),
      refusal,
      weight: Number((0.55 + random() * 1.05).toFixed(4)),
      phase: Number(phase.toFixed(6))
    };
  });
}

function summarizeStutters(routes, memory) {
  return memory.map((stutter) => {
    const affected = routes.filter((route) => route.stutterSource === stutter.id);
    if (!affected.length) return { ...stutter, affectedRoutes: 0, sharedStutter: false };
    return {
      ...stutter,
      affectedRoutes: affected.length,
      sharedStutter: affected.some((route) => route.sharedStutter),
      repeatStart: Math.min(...affected.map((route) => route.stutterStart)),
      repeatEnd: Math.max(...affected.map((route) => route.stutterEnd))
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.floor(Number(targetStage) || 0));
  const stableMemory = memory.map(normalizeStutter).slice(-MEMORY_WINDOW);
  const routes = makeRoutes(stage, stableMemory);
  const newStutters = makeStageStutter(stage) ? [makeStageStutter(stage)] : [];
  return {
    stage,
    routes,
    memory: stableMemory,
    stutters: summarizeStutters(routes, stableMemory),
    newStutters,
    newRefusals: routes.filter((route) => route.refusal).map((route) => ({ ...route.refusal }))
  };
}

export function buildTimeline(finalStage = 12) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.max(0, Math.floor(finalStage)); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newStutters, ...frame.newRefusals].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyStutter(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0.06, 0.94);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0.08, 0.86);
  const stutter = normalizeStutter({
    id: `visitor-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    x: safeX,
    y: safeY,
    force: 1,
    phase: safeX * 15.7 + safeY * 12.1
  });
  const next = buildFrame(frame.stage, [...frame.memory, stutter].slice(-MEMORY_WINDOW));
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function removeLatestStutter(frame) {
  const previousMemory = Array.isArray(frame.previousMemory)
    ? frame.previousMemory
    : frame.memory.slice(0, -1);
  return buildFrame(frame.stage, previousMemory);
}

export const constants = {
  routeCount: ROUTE_COUNT,
  pointCount: POINT_COUNT,
  memoryWindow: MEMORY_WINDOW
};
