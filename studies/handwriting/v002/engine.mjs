export const MASTER_SEED = 0x6d757469;

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function makeRoutes(stage, memory) {
  const random = rng(MASTER_SEED + stage * 104729);
  return Array.from({ length: 11 }, (_, index) => {
    const points = [];
    const drift = (random() - .5) * .12;
    for (let step = 0; step < 7; step += 1) {
      const x = .08 + step * .14;
      let y = .48 + drift + (random() - .5) * (.42 - Math.min(stage, 5) * .025);
      y += Math.sin((step + stage * .7 + index) * .72) * .055;
      points.push({ x, y });
    }
    const draftPoints = points.map((point) => ({ ...point }));
    const pressurePoint = memory.reduce((nearest, scar) => {
      const candidate = points[3];
      return !nearest || distance(candidate, scar) < distance(candidate, nearest) ? scar : nearest;
    }, null);
    const hit = pressurePoint && distance(points[3], pressurePoint) < .22;
    const memoryInfluence = hit ? Math.max(0, 1 - distance(points[3], pressurePoint) / .22) : 0;
    if (hit) {
      const direction = points[3].y >= pressurePoint.y ? .10 : -.10;
      points.forEach((point, step) => {
        if (step >= 2) point.y += direction * ((step - 1) / 5);
      });
    }
    const forcedFailure = stage === 0
      ? index % 5 === 0
      : memory.length > 0 && (index + stage) % 4 === 0;
    const failed = Boolean(hit || forcedFailure);
    const failureSegment = failed ? 2 + ((index + stage) % 3) : -1;
    return {
      points,
      draftPoints,
      memoryInfluence,
      failed,
      failureSegment,
      scar: failed ? points[failureSegment] : null,
      weight: .45 + random() * 1.15,
      phase: random() * Math.PI * 2
    };
  });
}

export function buildStage(targetStage) {
  let memory = [];
  let routes = [];
  for (let stage = 0; stage <= targetStage; stage += 1) {
    routes = makeRoutes(stage, memory);
    const newScars = routes.filter((route) => route.failed).map((route) => route.scar);
    memory = [...memory, ...newScars].slice(-9);
  }
  return { routes, memory };
}
