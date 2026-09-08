export const MASTER_SEED = 0x6d757469;

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

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function copyPoints(points) {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

/**
 * v004 changes the handwriting rule from a second branch to a lost beat.
 * A remembered refusal opens a gap in later routes, then displaces their
 * re-entry. omitScarId rebuilds the field without one refusal.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const routeCount = 13;
  const pointCount = 15;

  return Array.from({ length: routeCount }, (_, index) => {
    const band = Math.floor(index / 7);
    const lane = index % 7;
    const phase = random() * Math.PI * 2;
    const laneY = 0.16 + lane * 0.105 + band * 0.012;
    const points = [];

    for (let step = 0; step < pointCount; step += 1) {
      const x = 0.052 + step * 0.064;
      const slowWave = Math.sin(step * 0.68 + phase + stage * 0.23) * 0.018;
      const tremor = (random() - 0.5) * 0.022;
      const pressure = Math.sin((index + 1) * 0.8 + stage * 0.37) * 0.009;
      points.push({ x, y: laneY + slowWave + tremor + pressure });
    }

    const draftPoints = copyPoints(points);
    const pressurePoint = points[6];
    const pressures = memory
      .map((refusal) => ({ refusal, distance: distance(pressurePoint, refusal) }))
      .filter(({ distance: gap }) => gap < 0.24)
      .sort((a, b) => a.distance - b.distance);
    const nearest = pressures[0] ?? null;
    const pressure = pressures.reduce((sum, entry) => sum + (1 - entry.distance / 0.24) * 0.15, 0);
    const pause = clamp(pressure);
    const direction = nearest && pressurePoint.y >= nearest.refusal.y ? 1 : -1;
    const memoryPhase = pressures.reduce((sum, entry) => sum + entry.refusal.stage * 0.17 + entry.refusal.route * 0.09, 0);
    const gapStart = pause > 0.035 ? 5 + ((index + stage) % 3) : -1;
    const gapEnd = gapStart >= 0 ? gapStart + 1 : -1;

    if (gapStart >= 0) {
      for (let step = gapStart; step < pointCount; step += 1) {
        const progress = (step - gapStart) / (pointCount - gapStart - 1);
        const reentry = smooth(progress);
        const lateral = direction * (0.022 + pause * 0.085) * reentry;
        const late = Math.sin(step * 1.45 + phase + memoryPhase) * 0.014 * pause;
        points[step].x += (0.018 + pause * 0.04) * reentry;
        points[step].y += lateral + late;
      }
    }

    const forcedFailure = stage === 0
      ? index % 4 === 0
      : (index + stage * 3) % 11 === 0;
    const failed = Boolean(forcedFailure || pause > 0.19);
    const failureSegment = failed ? 4 + ((index + stage) % 3) : -1;
    const refusalPoint = failureSegment >= 0 ? points[failureSegment] : null;
    const refusal = refusalPoint ? {
      id: `stage-${stage}-route-${index}`,
      stage,
      route: index,
      x: refusalPoint.x,
      y: refusalPoint.y,
      force: Number(Math.max(pause, 0.3).toFixed(4))
    } : null;
    const reentryPoints = gapStart >= 0 ? points.slice(gapEnd).map((point) => ({ ...point })) : [];

    return {
      id: `stage-${stage}-route-${index}`,
      points,
      draftPoints,
      pause: Number(pause.toFixed(4)),
      gapStart,
      gapEnd,
      reentryPoints,
      failed,
      failureSegment,
      refusal,
      scar: refusal,
      weight: 0.55 + random() * 1.1,
      phase
    };
  });
}

export function buildStage(targetStage, options = {}) {
  const finalStage = Math.max(0, Math.floor(targetStage));
  const omitScarId = options.omitScarId ?? null;
  let memory = [];
  let routes = [];
  const history = [];

  for (let stage = 0; stage <= finalStage; stage += 1) {
    const activeMemory = memory.filter((refusal) => refusal.id !== omitScarId);
    routes = makeRoutes(stage, activeMemory);
    const newScars = routes
      .filter((route) => route.refusal)
      .map((route) => ({ ...route.refusal }));
    memory = [...memory, ...newScars].slice(-72);
    history.push({ stage, routes, newScars, memory: [...memory] });
  }

  return { routes, memory, history, omittedScarId: omitScarId };
}
