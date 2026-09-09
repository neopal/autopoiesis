export const MASTER_SEED = 0x6d757469;

const ROUTE_COUNT = 15;
const POINT_COUNT = 28;
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

function normalizeGap(gap, index = 0) {
  const x = Number(gap?.x);
  const y = Number(gap?.y);
  return {
    id: String(gap?.id ?? `gap-${index}`),
    stage: Math.max(0, Math.floor(Number(gap?.stage) || 0)),
    x: Number(clamp(Number.isFinite(x) ? x : 0.5, 0.06, 0.94).toFixed(4)),
    y: Number(clamp(Number.isFinite(y) ? y : 0.5, 0.08, 0.86).toFixed(4)),
    force: Number(clamp(Number(gap?.force) || 0.8, 0.3, 1).toFixed(4)),
    phase: Number((Number(gap?.phase) || 0).toFixed(6))
  };
}

function closestRoutePoint(points, gap) {
  return points.reduce((best, point, index) => {
    const dx = (point.x - gap.x) * 0.82;
    const dy = point.y - gap.y;
    const distance = Math.hypot(dx, dy);
    return distance < best.distance ? { distance, index } : best;
  }, { distance: Infinity, index: 0 });
}

function nearestGap(points, gaps, stage) {
  return gaps
    .filter((gap) => gap.stage <= stage)
    .map((gap) => {
      const closest = closestRoutePoint(points, gap);
      const influence = clamp((0.255 - closest.distance) / 0.19) * gap.force;
      return { gap, ...closest, influence };
    })
    .filter((entry) => entry.influence > 0.05)
    .sort((a, b) => b.influence - a.influence || b.gap.stage - a.gap.stage)[0] ?? null;
}

function makeStageGap(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const route = (stage * 3 + 2) % 10;
  const x = 0.2 + ((stage * 17) % 58) / 100;
  const y = 0.135 + route * 0.071 + ((stage % 3) - 1) * 0.006;
  return normalizeGap({
    id: `stage-${stage}-gap`,
    stage,
    x,
    y,
    force: 0.78,
    phase: stage * 0.91 + route * 0.37
  });
}

/**
 * v006 changes handwriting's rule from a shared borrowed baseline to a
 * contagious counterform. A remembered refusal opens an aperture: nearby
 * routes converge on one mouth, disappear through the same interval, and
 * leave with a shared phase before slowly returning to their lanes.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const activeGaps = memory.map(normalizeGap).slice(-MEMORY_WINDOW);

  return Array.from({ length: ROUTE_COUNT }, (_, routeIndex) => {
    const lane = routeIndex % 10;
    const band = Math.floor(routeIndex / 10);
    const phase = random() * Math.PI * 2;
    const laneY = 0.135 + lane * 0.071 + band * 0.018;
    const points = [];

    for (let step = 0; step < POINT_COUNT; step += 1) {
      const x = 0.055 + step * 0.033;
      const wave = Math.sin(step * 0.58 + phase + stage * 0.17) * 0.014;
      const letter = Math.sin(step * 1.71 + phase * 0.63) * 0.0055;
      const tremor = (random() - 0.5) * 0.013;
      points.push({ x, y: laneY + wave + letter + tremor });
    }

    const draftPoints = copyPoints(points);
    const nearest = nearestGap(points, activeGaps, stage);
    const influence = nearest?.influence ?? 0;
    let gapStart = -1;
    let gapEnd = -1;
    let rejoinStep = -1;
    let exitShift = 0;
    let sharedGate = false;

    if (nearest) {
      gapStart = Math.max(4, Math.min(POINT_COUNT - 9, nearest.index - 3));
      gapEnd = Math.min(POINT_COUNT - 5, gapStart + 6);
      rejoinStep = gapEnd + 3;
      sharedGate = influence > 0.18;
      const gateY = nearest.gap.y + Math.sin(nearest.gap.phase + band * 0.41) * 0.008;
      const direction = ((routeIndex + Math.round(nearest.gap.y * 100)) % 2 ? 1 : -1);
      exitShift = direction * (0.024 + influence * 0.022);

      for (let step = 0; step < POINT_COUNT; step += 1) {
        if (step < gapStart) {
          const approach = smooth(clamp((step - (gapStart - 5)) / 5));
          points[step].y += (gateY - points[step].y) * influence * approach * 0.82;
        } else if (step <= gapEnd) {
          const portal = smooth((step - gapStart) / Math.max(1, gapEnd - gapStart));
          const throat = Math.sin(portal * Math.PI);
          points[step].x += throat * 0.017 * influence;
          points[step].y += (gateY - points[step].y) * influence * (0.45 + portal * 0.42);
          points[step].y += Math.sin(portal * Math.PI + nearest.gap.phase) * 0.009 * influence;
        } else {
          const after = smooth(clamp((step - gapEnd) / 9));
          const sharedWave = Math.sin((step - gapEnd) * 0.73 + nearest.gap.phase) * 0.011 * influence;
          points[step].x += 0.012 * influence * (1 - after * 0.42);
          points[step].y += exitShift * (1 - after * 0.5) + sharedWave;
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
      gapStart,
      gapEnd,
      rejoinStep,
      gapStrength: Number(influence.toFixed(4)),
      gapSource: nearest && sharedGate ? nearest.gap.id : null,
      sharedGate,
      exitShift: Number(exitShift.toFixed(6)),
      failed: Boolean(refusal),
      refusal,
      weight: Number((0.55 + random() * 1.05).toFixed(4)),
      phase: Number(phase.toFixed(6))
    };
  });
}

function summarizeApertures(routes, memory) {
  return memory.map((gap) => {
    const affected = routes.filter((route) => route.gapSource === gap.id);
    if (!affected.length) return { ...gap, affectedRoutes: 0, sharedGate: false };
    const starts = affected.map((route) => route.gapStart);
    return {
      ...gap,
      affectedRoutes: affected.length,
      sharedGate: affected.some((route) => route.sharedGate),
      gateStart: Math.min(...starts),
      gateEnd: Math.max(...affected.map((route) => route.gapEnd))
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.floor(Number(targetStage) || 0));
  const stableMemory = memory.map(normalizeGap).slice(-MEMORY_WINDOW);
  const routes = makeRoutes(stage, stableMemory);
  const newGaps = makeStageGap(stage) ? [makeStageGap(stage)] : [];
  return {
    stage,
    routes,
    memory: stableMemory,
    apertures: summarizeApertures(routes, stableMemory),
    newGaps,
    newRefusals: routes.filter((route) => route.refusal).map((route) => ({ ...route.refusal }))
  };
}

export function buildTimeline(finalStage = 10) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.max(0, Math.floor(finalStage)); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newGaps, ...frame.newRefusals].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyGap(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0.06, 0.94);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0.08, 0.86);
  const gap = normalizeGap({
    id: `visitor-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    x: safeX,
    y: safeY,
    force: 1,
    phase: safeX * 17.3 + safeY * 11.7
  });
  const next = buildFrame(frame.stage, [...frame.memory, gap].slice(-MEMORY_WINDOW));
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function removeLatestGap(frame) {
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
