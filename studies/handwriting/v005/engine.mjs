export const MASTER_SEED = 0x6d757469;

const ROUTE_COUNT = 12;
const POINT_COUNT = 18;
const MEMORY_WINDOW = 48;
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

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closestRoutePoint(points, refusal) {
  return points.reduce((best, point, index) => {
    const gap = distance(point, refusal);
    return gap < best.gap ? { gap, index, point } : best;
  }, { gap: Infinity, index: 0, point: points[0] });
}

function nearestMemory(points, memory, currentStage = null) {
  const candidates = memory
    .map((refusal) => {
      const closest = closestRoutePoint(points, refusal);
      const priority = closest.gap / (0.55 + (refusal.force ?? 0.35) * 0.45);
      return { refusal, ...closest, priority };
    })
    .filter((entry) => entry.gap < 0.28);
  const current = candidates.filter((entry) => entry.refusal.stage === currentStage);
  return (current.length ? current : candidates)
    .sort((a, b) => a.priority - b.priority || b.refusal.stage - a.refusal.stage)[0] ?? null;
}

/**
 * v005 changes the handwriting rule from a lost beat to a borrowed baseline.
 * A remembered refusal pulls nearby later routes toward its local height and
 * phase. The re-entry is therefore shared by neighbouring routes, not just
 * marked on one route. The memory array is an explicit input for exact replay.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);

  return Array.from({ length: ROUTE_COUNT }, (_, index) => {
    const band = Math.floor(index / 6);
    const lane = index % 6;
    const phase = random() * Math.PI * 2;
    const laneY = 0.13 + lane * 0.085 + band * 0.015;
    const points = [];

    for (let step = 0; step < POINT_COUNT; step += 1) {
      const x = 0.055 + step * 0.052;
      const wave = Math.sin(step * 0.66 + phase + stage * 0.21) * 0.015;
      const tremor = (random() - 0.5) * 0.018;
      const pressure = Math.sin((index + 2) * 0.73 + stage * 0.31) * 0.008;
      points.push({ x, y: laneY + wave + tremor + pressure });
    }

    const draftPoints = copyPoints(points);
    const nearest = nearestMemory(points, memory, stage);
    const influence = nearest ? clamp((1 - nearest.gap / 0.24) * 0.92) : 0;
    const borrowed = influence > 0.06;
    const borrowStart = borrowed ? Math.max(5, Math.min(POINT_COUNT - 4, nearest.index - 2)) : -1;
    const rejoinStep = borrowed ? borrowStart + 3 : -1;
    const refusalPhase = nearest?.refusal.phase ?? 0;
    const baseline = nearest ? nearest.refusal.y + Math.sin(refusalPhase + index * 0.42) * 0.012 : laneY;

    if (borrowed) {
      for (let step = borrowStart; step < POINT_COUNT; step += 1) {
        const progress = smooth((step - borrowStart) / Math.max(1, POINT_COUNT - 1 - borrowStart));
        const phaseShare = Math.sin(step * 0.72 + refusalPhase) * 0.013 * influence * progress;
        const convergence = (baseline - points[step].y) * (0.46 + influence * 0.44) * progress;
        points[step].y += convergence + phaseShare;
        points[step].x += 0.018 * influence * progress;
      }
    }

    const forcedRefusal = (index + stage * 4) % 9 === 0;
    const refusalIndex = 5 + ((index + stage) % 3);
    const refusalPoint = forcedRefusal ? points[refusalIndex] : null;
    const refusal = refusalPoint ? {
      id: `stage-${stage}-route-${index}`,
      stage,
      route: index,
      x: refusalPoint.x,
      y: refusalPoint.y,
      force: Number(Math.max(influence, 0.35).toFixed(4)),
      phase: Number((phase + index * 0.31).toFixed(6))
    } : null;

    return {
      id: `stage-${stage}-route-${index}`,
      points,
      draftPoints,
      borrowed,
      borrowStart,
      rejoinStep,
      borrowStrength: Number(influence.toFixed(4)),
      borrowSource: nearest?.refusal.id ?? null,
      failed: Boolean(refusal),
      refusal,
      weight: Number((0.55 + random() * 1.05).toFixed(4)),
      phase: Number(phase.toFixed(6))
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.floor(targetStage));
  const stableMemory = memory.map((refusal) => ({ ...refusal }));
  const routes = makeRoutes(stage, stableMemory);
  return {
    stage,
    routes,
    memory: stableMemory,
    newRefusals: routes.filter((route) => route.refusal).map((route) => ({ ...route.refusal }))
  };
}

export function buildTimeline(finalStage = 8) {
  let memory = [];
  const frames = [];

  for (let stage = 0; stage <= Math.max(0, Math.floor(finalStage)); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newRefusals].slice(-MEMORY_WINDOW);
  }

  return frames;
}

export function applyRefusal(frame, position) {
  const refusal = {
    id: `visitor-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    route: -1,
    x: Number(clamp(Number(position?.x) || 0.5, 0.06, 0.94).toFixed(4)),
    y: Number(clamp(Number(position?.y) || 0.5, 0.08, 0.86).toFixed(4)),
    force: 1,
    phase: Number(((Number(position?.x) || 0.5) * 17.3 + (Number(position?.y) || 0.5) * 11.7).toFixed(6))
  };
  return buildFrame(frame.stage, [...frame.memory, refusal]);
}

export function removeLatestRefusal(frame) {
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export const constants = {
  routeCount: ROUTE_COUNT,
  pointCount: POINT_COUNT,
  memoryWindow: MEMORY_WINDOW
};
