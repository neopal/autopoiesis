export const MASTER_SEED = 0x57563132;
export const STAGES = 17;
export const MEMORY_WINDOW = 6;

const ROUTE_COUNT = 24;
const POINT_COUNT = 56;
const LANE_COUNT = 18;
const BASE_Y = 0.11;
const LANE_GAP = 0.040;
const X_START = 0.03;
const X_STEP = 0.0171;

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

function normalizeChorus(entry, index = 0) {
  const rawX = Number(entry?.x);
  const rawY = Number(entry?.y);
  const x = Number(clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.07, 0.93).toFixed(4));
  const y = Number(clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.105, 0.805).toFixed(4));
  return {
    id: String(entry?.id ?? `chorus-${index}`),
    source: String(entry?.source ?? 'timeline-chorus'),
    stage: Math.max(0, Math.floor(Number(entry?.stage) || 0)),
    x,
    y,
    point: { x, y },
    force: Number(clamp(Number(entry?.force) || 0.92, 0.34, 1).toFixed(4)),
    phase: Number((Number(entry?.phase) || 0).toFixed(6))
  };
}

function closestRoutePoint(points, event) {
  return points.reduce((best, point, index) => {
    const dx = (point.x - event.x) * 0.86;
    const dy = point.y - event.y;
    const distance = Math.hypot(dx, dy);
    return distance < best.distance ? { distance, index } : best;
  }, { distance: Infinity, index: 0 });
}

function eventInfluence(points, event, lane, targetLane) {
  const closest = closestRoutePoint(points, event);
  const laneDistance = Math.abs(lane - targetLane);
  const family = laneDistance <= 3 ? 1 - laneDistance * 0.19 : 0;
  return {
    ...closest,
    value: clamp((0.26 - closest.distance) / 0.17) * family * event.force
  };
}

function makeStageChorus(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const lane = 2 + ((stage * 7) % 13);
  return normalizeChorus({
    id: `stage-${stage}-chorus`,
    stage,
    x: 0.16 + ((stage * 31) % 68) / 100,
    y: BASE_Y + lane * LANE_GAP + (stage % 3 - 1) * 0.005,
    force: 0.88,
    phase: stage * 0.73 + lane * 0.37
  });
}

function phraseWindow(event, closestIndex) {
  const eventIndex = Math.round((event.x - X_START) / X_STEP);
  const anchor = Math.max(closestIndex, eventIndex);
  const approachStart = Math.max(5, Math.min(POINT_COUNT - 25, anchor - 8));
  const chorusStart = approachStart + 8;
  const chorusEnd = chorusStart + 6;
  const fanEnd = Math.min(POINT_COUNT - 3, chorusEnd + 14);
  return { approachStart, chorusStart, chorusEnd, fanEnd };
}

/**
 * v012 changes handwriting's rule from a spatial stutter to a finite chorus.
 * A remembered refusal pulls a local family into one shared phrase, then lets
 * the lines fan back out with altered exits.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const activeChoruses = memory.map(normalizeChorus).slice(-MEMORY_WINDOW);

  return Array.from({ length: ROUTE_COUNT }, (_, routeIndex) => {
    const lane = routeIndex % LANE_COUNT;
    const band = Math.floor(routeIndex / LANE_COUNT);
    const phase = random() * Math.PI * 2;
    const laneY = BASE_Y + lane * LANE_GAP + band * 0.010;
    const draftPoints = [];

    for (let step = 0; step < POINT_COUNT; step += 1) {
      const x = X_START + step * X_STEP;
      const wave = Math.sin(step * 0.43 + phase + stage * 0.13) * 0.0105;
      const syllable = Math.sin(step * 1.67 + phase * 0.57) * 0.0047;
      const tremor = (random() - 0.5) * 0.007;
      draftPoints.push({ x, y: laneY + wave + syllable + tremor });
    }

    const points = copyPoints(draftPoints);
    const chorusHistory = [];

    for (const event of activeChoruses) {
      const targetLane = Math.max(0, Math.min(LANE_COUNT - 1, Math.round((event.y - BASE_Y) / LANE_GAP)));
      const influence = eventInfluence(points, event, lane, targetLane);
      if (influence.value <= 0.08) continue;

      const window = phraseWindow(event, influence.index);
      const laneDistance = lane - targetLane;
      const direction = Math.sin(event.phase + lane * 0.21) < 0 ? -1 : 1;
      const centerY = clamp(
        event.y + (event.y < 0.47 ? 0.036 : -0.036) + Math.sin(event.phase) * 0.004,
        0.14,
        0.78
      );
      const fanOffset = direction * (0.010 + influence.value * 0.018) * (1 + Math.min(3, Math.abs(laneDistance)) * 0.12);
      const draftAtChorus = draftPoints[window.chorusStart].y;
      const preChorusAtStart = points[window.chorusStart].y;

      for (let step = 0; step < POINT_COUNT; step += 1) {
        if (step < window.approachStart) continue;
        if (step < window.chorusStart) {
          const approach = smooth((step - window.approachStart) / (window.chorusStart - window.approachStart));
          points[step].y += (centerY - points[step].y) * (0.46 + influence.value * 0.38) * approach;
        } else if (step <= window.chorusEnd) {
          const phrase = (step - window.chorusStart) / Math.max(1, window.chorusEnd - window.chorusStart);
          const sharedPulse = Math.sin(phrase * Math.PI * 2 + event.phase) * 0.0028;
          const residual = laneDistance * 0.0017 * (1 - influence.value * 0.55);
          points[step].x += Math.sin(phrase * Math.PI) * 0.0045 * direction * influence.value;
          points[step].y = centerY + sharedPulse + residual;
        } else if (step <= window.fanEnd) {
          const fan = smooth((step - window.chorusEnd) / (window.fanEnd - window.chorusEnd));
          const baseline = draftPoints[step].y + fanOffset;
          points[step].y = centerY * (1 - fan) + baseline * fan;
          points[step].x += 0.004 * direction * influence.value * (1 - fan * 0.35);
        } else {
          const settle = smooth((step - window.fanEnd) / 10);
          points[step].y += fanOffset * (1 - settle * 0.55);
          points[step].x += 0.003 * direction * influence.value * (1 - settle * 0.5);
        }
      }

      const convergence = Math.abs(preChorusAtStart - points[window.chorusStart].y);
      const phraseHeight = Math.max(...points.slice(window.chorusStart, window.chorusEnd + 1).map((point) => point.y))
        - Math.min(...points.slice(window.chorusStart, window.chorusEnd + 1).map((point) => point.y));
      const fanOut = Math.abs(points[window.fanEnd].y - points[window.chorusEnd].y);
      chorusHistory.push({
        id: event.id,
        start: window.approachStart,
        chorusStart: window.chorusStart,
        chorusEnd: window.chorusEnd,
        fanEnd: window.fanEnd,
        sharedSpan: window.chorusEnd - window.chorusStart + 1,
        point: { x: Number(points[window.chorusStart].x.toFixed(4)), y: Number(points[window.chorusStart].y.toFixed(4)) },
        strength: Number(influence.value.toFixed(4)),
        laneDistance,
        convergence: Number(convergence.toFixed(4)),
        phraseHeight: Number(phraseHeight.toFixed(4)),
        fanOut: Number(fanOut.toFixed(4)),
        exitOffset: Number(fanOffset.toFixed(4))
      });
    }

    return {
      id: `route-${stage}-${routeIndex}`,
      points,
      draftPoints,
      lane,
      band,
      chorusHistory,
      chorused: chorusHistory.length > 0,
      weight: Number((0.56 + random() * 0.94).toFixed(4)),
      phase: Number(phase.toFixed(6))
    };
  });
}

function summarizeChoruses(routes, memory) {
  return memory.map((event, memoryIndex) => {
    const affected = routes.flatMap((route) => route.chorusHistory
      .filter((record) => record.id === event.id)
      .map((record) => ({ route, record })));
    return {
      ...event,
      memoryIndex,
      affectedRoutes: affected.length,
      chorused: affected.length > 0,
      chorusStart: affected.length ? Math.min(...affected.map(({ record }) => record.chorusStart)) : -1,
      chorusEnd: affected.length ? Math.max(...affected.map(({ record }) => record.chorusEnd)) : -1,
      maxConvergence: affected.length ? Number(Math.max(...affected.map(({ record }) => record.convergence)).toFixed(4)) : 0,
      maxFanOut: affected.length ? Number(Math.max(...affected.map(({ record }) => record.fanOut)).toFixed(4)) : 0
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const stableMemory = memory.map(normalizeChorus).slice(-MEMORY_WINDOW);
  const routes = makeRoutes(stage, stableMemory);
  const stageChorus = makeStageChorus(stage);
  return {
    stage,
    routes,
    memory: stableMemory,
    choruses: summarizeChoruses(routes, stableMemory),
    newChoruses: stageChorus ? [stageChorus] : []
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newChoruses].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyChorus(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0.07, 0.93);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0.105, 0.805);
  const event = normalizeChorus({
    id: `visitor-chorus-${frame.stage}-${frame.memory.length}`,
    source: 'visitor-chorus',
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

export function removeLatestChorus(frame) {
  const previousMemory = Array.isArray(frame.previousMemory)
    ? frame.previousMemory
    : frame.memory.slice(0, -1);
  return buildFrame(frame.stage, previousMemory);
}

export const constants = {
  routeCount: ROUTE_COUNT,
  pointCount: POINT_COUNT,
  laneCount: LANE_COUNT,
  memoryWindow: MEMORY_WINDOW,
  finalStage: STAGES - 1
};
