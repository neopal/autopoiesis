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
 * The third handwriting rule: a scar does not merely push a line aside.
 * It fractures the line's cadence into a second, slightly asynchronous hand.
 * omitScarId is the one deliberate visitor intervention: lifting a refusal
 * recomputes the later field instead of hiding a marker.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const routeCount = 12;
  const stepCount = 11;

  return Array.from({ length: routeCount }, (_, index) => {
    const band = Math.floor(index / 6);
    const lane = index % 6;
    const phase = random() * Math.PI * 2;
    const laneY = 0.15 + lane * 0.13 + band * 0.019;
    const points = [];

    for (let step = 0; step < stepCount; step += 1) {
      const x = 0.045 + step * 0.091;
      const slowWave = Math.sin(step * 0.72 + phase + stage * 0.31) * 0.022;
      const tremor = (random() - 0.5) * 0.028;
      const stagger = Math.sin((index + 2) * 0.9 + stage) * 0.012;
      points.push({ x, y: laneY + slowWave + tremor + stagger });
    }

    const draftPoints = copyPoints(points);
    const pressurePoint = points[4];
    const pressures = memory
      .map((scar) => ({ scar, distance: distance(pressurePoint, scar) }))
      .filter(({ distance: gap }) => gap < 0.27)
      .sort((a, b) => a.distance - b.distance);
    const nearest = pressures[0] ?? null;
    const pressure = pressures.reduce((sum, entry) => sum + (1 - entry.distance / 0.27) * 0.17, 0);
    const memoryInfluence = clamp(pressure);
    const fracture = memoryInfluence > 0.035 ? memoryInfluence : 0;
    const direction = nearest && pressurePoint.y >= nearest.scar.y ? 1 : -1;
    const memoryPhase = pressures.reduce((sum, entry) => sum + entry.scar.stage * 0.19 + entry.scar.route * 0.11, 0);

    if (fracture > 0) {
      for (let step = 4; step < stepCount; step += 1) {
        const progress = (step - 4) / (stepCount - 4);
        const bend = smooth(progress) * direction * (0.028 + fracture * 0.085);
        const fractureWave = Math.sin(step * 1.62 + phase + memoryPhase) * 0.018 * fracture;
        const sideways = Math.cos(step * 0.83 + phase) * 0.009 * fracture * progress;
        points[step].y += bend + fractureWave;
        points[step].x += sideways;
      }
    }

    const branchPoints = fracture > 0
      ? points.map((point, step) => {
        if (step < 4) return { ...point };
        const progress = (step - 4) / (stepCount - 4);
        return {
          x: point.x + Math.cos(step * 1.23 + phase) * 0.013 * fracture * progress,
          y: point.y - direction * (0.022 + fracture * 0.045) * progress
        };
      })
      : null;

    const forcedFailure = stage === 0
      ? index % 4 === 0
      : (index + stage * 2) % 7 === 0;
    const failed = Boolean(forcedFailure || fracture > 0.19);
    const failureSegment = failed ? 3 + ((index + stage) % 3) : -1;
    const scarPoint = failed ? points[failureSegment] : null;
    const scar = scarPoint ? {
      id: `stage-${stage}-route-${index}`,
      stage,
      route: index,
      x: scarPoint.x,
      y: scarPoint.y,
      force: Number(Math.max(fracture, 0.28).toFixed(4))
    } : null;

    return {
      id: `stage-${stage}-route-${index}`,
      points,
      draftPoints,
      branchPoints,
      memoryInfluence: Number(memoryInfluence.toFixed(4)),
      fracture: Number(fracture.toFixed(4)),
      failed,
      failureSegment,
      scar,
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
    const activeMemory = memory.filter((scar) => scar.id !== omitScarId);
    routes = makeRoutes(stage, activeMemory);
    const newScars = routes
      .filter((route) => route.scar)
      .map((route) => ({ ...route.scar }));
    memory = [...memory, ...newScars].slice(-64);
    history.push({ stage, routes, newScars, memory: [...memory] });
  }

  return { routes, memory, history, omittedScarId: omitScarId };
}
