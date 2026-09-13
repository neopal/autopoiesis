export const MASTER_SEED = 0x57563339;
export const STAGES = 13;
export const MEMORY_WINDOW = 5;
const ROUTE_COUNT = 18;
const POINT_COUNT = 40;
const LANE_COUNT = 14;
const LANE_GAP = 0.055;
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

function normalizeSwitch(entry, index = 0) {
  const x = Number(entry?.x);
  const y = Number(entry?.y);
  return {
    id: String(entry?.id ?? `switch-${index}`),
    source: String(entry?.source ?? 'timeline-switch'),
    stage: Math.max(0, Math.floor(Number(entry?.stage) || 0)),
    x: Number(clamp(Number.isFinite(x) ? x : 0.5, 0.08, 0.92).toFixed(4)),
    y: Number(clamp(Number.isFinite(y) ? y : 0.5, 0.12, 0.82).toFixed(4)),
    point: {
      x: Number(clamp(Number.isFinite(x) ? x : 0.5, 0.08, 0.92).toFixed(4)),
      y: Number(clamp(Number.isFinite(y) ? y : 0.5, 0.12, 0.82).toFixed(4))
    },
    force: Number(clamp(Number(entry?.force) || 0.85, 0.3, 1).toFixed(4)),
    phase: Number((Number(entry?.phase) || 0).toFixed(6))
  };
}

function closestRoutePoint(points, event) {
  return points.reduce((best, point, index) => {
    const dx = (point.x - event.x) * 0.88;
    const dy = point.y - event.y;
    const distance = Math.hypot(dx, dy);
    return distance < best.distance ? { distance, index } : best;
  }, { distance: Infinity, index: 0 });
}

function makeStageSwitch(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const lane = 2 + ((stage * 5) % 10);
  return normalizeSwitch({
    id: `stage-${stage}-switch`,
    stage,
    x: 0.18 + ((stage * 29) % 62) / 100,
    y: 0.12 + lane * LANE_GAP + (stage % 3 - 1) * 0.008,
    force: 0.82,
    phase: stage * 0.71 + lane * 0.37
  });
}

function switchInfluence(points, event) {
  const closest = closestRoutePoint(points, event);
  return {
    ...closest,
    value: clamp((0.25 - closest.distance) / 0.18) * event.force
  };
}

/**
 * v009 changes handwriting's rule from a relay to a lane switch.
 * A remembered refusal makes adjacent routes cross once, exchange order,
 * and continue downstream in the other lane.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const activeSwitches = memory.map(normalizeSwitch).slice(-MEMORY_WINDOW);

  return Array.from({ length: ROUTE_COUNT }, (_, routeIndex) => {
    const lane = routeIndex % LANE_COUNT;
    const band = Math.floor(routeIndex / LANE_COUNT);
    const phase = random() * Math.PI * 2;
    const laneY = 0.12 + lane * LANE_GAP + band * 0.012;
    const points = [];

    for (let step = 0; step < POINT_COUNT; step += 1) {
      const x = 0.04 + step * 0.024;
      const wave = Math.sin(step * 0.52 + phase + stage * 0.15) * 0.012;
      const letter = Math.sin(step * 1.71 + phase * 0.61) * 0.005;
      const tremor = (random() - 0.5) * 0.009;
      points.push({ x, y: laneY + wave + letter + tremor });
    }

    const draftPoints = copyPoints(points);
    let switchStart = -1;
    let switchEnd = -1;
    let switchSource = null;
    let crossingPair = null;
    let reordered = false;
    let switchStrength = 0;
    let orderDelta = 0;
    let crossingIndex = -1;
    let orderBefore = 0;
    let orderAfter = 0;

    for (const event of activeSwitches) {
      const targetLane = Math.max(1, Math.min(LANE_COUNT - 2, Math.round((event.y - 0.12) / LANE_GAP)));
      if (lane !== targetLane && lane !== targetLane + 1) continue;
      const influence = switchInfluence(points, event);
      if (influence.value <= 0.08) continue;

      const start = Math.max(5, Math.min(POINT_COUNT - 17, influence.index - 4));
      const end = Math.min(POINT_COUNT - 4, start + 13);
      const direction = lane === targetLane ? 1 : -1;
      const targetOffset = direction * LANE_GAP * (0.86 + influence.value * 0.14);
      const otherLane = lane === targetLane ? targetLane + 1 : targetLane;

      for (let step = 0; step < POINT_COUNT; step += 1) {
        if (step < start) {
          const approach = smooth(clamp((step - (start - 6)) / 6));
          points[step].y += targetOffset * influence.value * approach * 0.22;
        } else if (step <= end) {
          const progress = smooth(clamp((step - start) / (end - start)));
          const crossing = Math.sin(progress * Math.PI) * 0.004 * Math.sin(event.phase + lane * 0.4);
          points[step].x += Math.sin(progress * Math.PI) * 0.012 * influence.value;
          points[step].y += targetOffset * influence.value * progress + crossing;
        } else {
          const settle = smooth(clamp((step - end) / 10));
          const carried = Math.sin((step - end) * 0.66 + event.phase + lane * 0.24) * 0.007 * influence.value;
          points[step].y += targetOffset * influence.value * (1 - settle * 0.12) + carried;
          points[step].x += 0.007 * influence.value * (1 - settle * 0.4);
        }
      }

      switchStart = start;
      switchEnd = end;
      switchSource = event.id;
      crossingPair = `${event.id}:${targetLane}-${otherLane}`;
      reordered = true;
      switchStrength = Math.max(switchStrength, influence.value);
      orderDelta = direction * Math.round((0.86 + influence.value * 0.14) * 100) / 100;
      crossingIndex = Math.max(start, Math.min(end, Math.round((event.x - 0.04) / 0.024)));
      orderBefore = direction === 1 ? -1 : 1;
      orderAfter = -orderBefore;
    }

    return {
      id: `route-${stage}-${routeIndex}`,
      points,
      draftPoints,
      lane,
      band,
      switchStart,
      switchEnd,
      switchSource,
      crossingPair,
      reordered,
      switchStrength: Number(switchStrength.toFixed(4)),
      orderDelta: Number(orderDelta.toFixed(4)),
      crossingIndex,
      orderBefore,
      orderAfter,
      failed: switchSource !== null,
      weight: Number((0.58 + random() * 0.92).toFixed(4)),
      phase: Number(phase.toFixed(6))
    };
  });
}

function summarizeSwitches(routes, memory) {
  return memory.map((event, memoryIndex) => {
    const affected = routes.filter((route) => route.switchSource === event.id);
    return {
      ...event,
      memoryIndex,
      affectedRoutes: affected.length,
      reordered: affected.some((route) => route.reordered),
      crossingPair: affected.find((route) => route.crossingPair)?.crossingPair ?? null,
      switchStart: affected.length ? Math.min(...affected.map((route) => route.switchStart)) : -1,
      switchEnd: affected.length ? Math.max(...affected.map((route) => route.switchEnd)) : -1
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const stableMemory = memory.map(normalizeSwitch).slice(-MEMORY_WINDOW);
  const routes = makeRoutes(stage, stableMemory);
  const stageSwitch = makeStageSwitch(stage);
  return {
    stage,
    routes,
    memory: stableMemory,
    switches: summarizeSwitches(routes, stableMemory),
    newSwitches: stageSwitch ? [stageSwitch] : []
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newSwitches].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applySwitch(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0.08, 0.92);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0.12, 0.82);
  const event = normalizeSwitch({
    id: `visitor-switch-${frame.stage}-${frame.memory.length}`,
    source: 'visitor-switch',
    stage: frame.stage,
    x: safeX,
    y: safeY,
    force: 1,
    phase: safeX * 15.7 + safeY * 12.1
  });
  const next = buildFrame(frame.stage, [...frame.memory, event].slice(-MEMORY_WINDOW));
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function deleteLatestSwitch(frame) {
  const previousMemory = Array.isArray(frame.previousMemory)
    ? frame.previousMemory
    : frame.memory.slice(0, -1);
  return buildFrame(frame.stage, previousMemory);
}

export const constants = {
  routeCount: ROUTE_COUNT,
  pointCount: POINT_COUNT,
  memoryWindow: MEMORY_WINDOW,
  laneCount: LANE_COUNT
};
