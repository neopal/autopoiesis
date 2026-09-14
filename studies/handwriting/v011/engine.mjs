export const MASTER_SEED = 0x57563131;
export const STAGES = 16;
export const MEMORY_WINDOW = 7;
const ROUTE_COUNT = 22;
const POINT_COUNT = 48;
const LANE_COUNT = 16;
const LANE_GAP = 0.046;
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

function normalizeStutter(entry, index = 0) {
  const rawX = Number(entry?.x);
  const rawY = Number(entry?.y);
  const x = Number(clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92).toFixed(4));
  const y = Number(clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.105, 0.84).toFixed(4));
  return {
    id: String(entry?.id ?? `stutter-${index}`),
    source: String(entry?.source ?? 'timeline-stutter'),
    stage: Math.max(0, Math.floor(Number(entry?.stage) || 0)),
    x,
    y,
    point: { x, y },
    force: Number(clamp(Number(entry?.force) || 0.86, 0.3, 1).toFixed(4)),
    phase: Number((Number(entry?.phase) || 0).toFixed(6))
  };
}

function closestRoutePoint(points, event) {
  return points.reduce((best, point, index) => {
    const dx = (point.x - event.x) * 0.92;
    const dy = point.y - event.y;
    const distance = Math.hypot(dx, dy);
    return distance < best.distance ? { distance, index } : best;
  }, { distance: Infinity, index: 0 });
}

function makeStageStutter(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const lane = 3 + ((stage * 5) % 10);
  return normalizeStutter({
    id: `stage-${stage}-stutter`,
    stage,
    x: 0.17 + ((stage * 29) % 66) / 100,
    y: 0.105 + lane * LANE_GAP + (stage % 3 - 1) * 0.006,
    force: 0.84,
    phase: stage * 0.69 + lane * 0.43
  });
}

function eventInfluence(points, event, lane, targetLane) {
  const closest = closestRoutePoint(points, event);
  const laneDistance = Math.abs(lane - targetLane);
  const band = laneDistance <= 2 ? 1 - laneDistance * 0.22 : 0;
  return {
    ...closest,
    value: clamp((0.235 - closest.distance) / 0.18) * band * event.force
  };
}

function measureBacktrack(points, start, end) {
  let distance = 0;
  for (let index = Math.max(1, start); index <= end; index += 1) {
    distance += Math.max(0, points[index - 1].x - points[index].x);
  }
  return Number(distance.toFixed(4));
}

function measureRepeat(points, start, end) {
  const first = points[start];
  let closest = Infinity;
  for (let index = start + 1; index <= end; index += 1) {
    closest = Math.min(closest, Math.hypot(points[index].x - first.x, points[index].y - first.y));
  }
  return Number(Math.max(0, 0.05 - closest).toFixed(4));
}

/**
 * v011 changes handwriting's rule from a finite hinge to a spatial stutter.
 * A remembered refusal makes a local family rehearse one short beat: routes
 * advance, double back, repeat the beat, then resume with a carried exit.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const activeStutters = memory.map(normalizeStutter).slice(-MEMORY_WINDOW);

  return Array.from({ length: ROUTE_COUNT }, (_, routeIndex) => {
    const lane = routeIndex % LANE_COUNT;
    const band = Math.floor(routeIndex / LANE_COUNT);
    const phase = random() * Math.PI * 2;
    const laneY = 0.105 + lane * LANE_GAP + band * 0.011;
    const draftPoints = [];

    for (let step = 0; step < POINT_COUNT; step += 1) {
      const x = 0.035 + step * 0.0208;
      const wave = Math.sin(step * 0.47 + phase + stage * 0.11) * 0.010;
      const syllable = Math.sin(step * 1.59 + phase * 0.53) * 0.0048;
      const tremor = (random() - 0.5) * 0.0075;
      draftPoints.push({ x, y: laneY + wave + syllable + tremor });
    }

    const points = copyPoints(draftPoints);
    const stutterHistory = [];
    let stutterStart = -1;
    let stutterEnd = -1;
    let stutterIndex = -1;
    let stutterSource = null;
    let stutterPoint = null;
    let backtrackDistance = 0;
    let repeatStrength = 0;
    let carriedOffset = 0;

    for (const event of activeStutters) {
      const targetLane = Math.max(1, Math.min(LANE_COUNT - 2, Math.round((event.y - 0.105) / LANE_GAP)));
      const influence = eventInfluence(points, event, lane, targetLane);
      if (influence.value <= 0.08) continue;

      const eventIndex = Math.round((event.x - 0.035) / 0.0208);
      const start = Math.max(6, Math.min(POINT_COUNT - 20, eventIndex - 5));
      const index = start + 2;
      const end = Math.min(POINT_COUNT - 4, start + 14);
      const side = lane === targetLane
        ? (Math.sin(event.phase) < 0 ? -1 : 1)
        : (lane < targetLane ? 1 : -1);
      const amplitude = (0.010 + influence.value * 0.020) * side;
      const carry = (0.004 + influence.value * 0.009) * side;
      const scale = 0.76 + influence.value * 0.24;
      const repeatOffsets = [0.015, 0.005, -0.022, -0.008, 0.011, 0.017, 0.013];
      const repeatLift = [0.004, 0.009, 0.003, -0.008, -0.006, 0.002, 0.006];

      for (let step = 0; step < POINT_COUNT; step += 1) {
        if (step < start) {
          const approach = smooth(clamp((step - (start - 6)) / 6));
          points[step].y += amplitude * 0.26 * approach;
        } else if (step <= index) {
          const progress = smooth(clamp((step - start) / (index - start)));
          points[step].x += repeatOffsets[step - start] * scale;
          points[step].y += amplitude * 0.32 + repeatLift[step - start] * side * scale;
          if (step === index) points[step].y += amplitude * 0.38;
        } else if (step <= end) {
          const repeatStep = step - index;
          const progress = smooth(clamp(repeatStep / (end - index)));
          const echo = Math.sin(progress * Math.PI) * 0.008 * side * influence.value;
          points[step].x += (0.013 * Math.sin((1 - progress) * Math.PI * 0.5) + carry * 0.7) * scale;
          points[step].y += amplitude * (0.7 - progress * 0.12) + echo;
        } else {
          const settle = smooth(clamp((step - end) / 12));
          points[step].x += carry * (1 - settle * 0.5);
          points[step].y += carry * 0.72 * (1 - settle * 0.12);
        }
      }

      const eventBacktrack = measureBacktrack(points, start, end);
      const eventRepeat = measureRepeat(points, start, end);
      const eventRecord = {
        id: event.id,
        start,
        end,
        index,
        advanceEnd: index - 1,
        backtrackStart: index,
        repeatEnd: Math.min(end, index + 4),
        resumeStart: end + 1,
        point: {
          x: Number(points[index].x.toFixed(4)),
          y: Number(points[index].y.toFixed(4))
        },
        strength: Number(influence.value.toFixed(4)),
        backtrackDistance: eventBacktrack,
        repeatStrength: eventRepeat,
        carriedOffset: Number(carry.toFixed(4))
      };
      stutterHistory.push(eventRecord);
      stutterStart = start;
      stutterEnd = end;
      stutterIndex = index;
      stutterSource = event.id;
      stutterPoint = eventRecord.point;
      backtrackDistance = eventBacktrack;
      repeatStrength = Math.max(repeatStrength, eventRepeat);
      carriedOffset = carry;
    }

    return {
      id: `route-${stage}-${routeIndex}`,
      points,
      draftPoints,
      lane,
      band,
      stutterStart,
      stutterEnd,
      stutterIndex,
      stutterSource,
      stutterPoint,
      stutterHistory,
      backtrackDistance,
      repeatStrength: Number(repeatStrength.toFixed(4)),
      carriedOffset: Number(carriedOffset.toFixed(4)),
      failed: stutterSource !== null,
      weight: Number((0.56 + random() * 0.94).toFixed(4)),
      phase: Number(phase.toFixed(6))
    };
  });
}

function summarizeStutters(routes, memory) {
  return memory.map((event, memoryIndex) => {
    const affected = routes.flatMap((route) => route.stutterHistory
      .filter((record) => record.id === event.id)
      .map((record) => ({ route, record })));
    return {
      ...event,
      memoryIndex,
      affectedRoutes: affected.length,
      stuttered: affected.some(({ record }) => record.backtrackDistance > 0.004),
      stutterStart: affected.length ? Math.min(...affected.map(({ record }) => record.start)) : -1,
      stutterEnd: affected.length ? Math.max(...affected.map(({ record }) => record.end)) : -1,
      backtrackDistance: affected.length ? Number(Math.max(...affected.map(({ record }) => record.backtrackDistance)).toFixed(4)) : 0
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const stableMemory = memory.map(normalizeStutter).slice(-MEMORY_WINDOW);
  const routes = makeRoutes(stage, stableMemory);
  const stageStutter = makeStageStutter(stage);
  return {
    stage,
    routes,
    memory: stableMemory,
    stutters: summarizeStutters(routes, stableMemory),
    newStutters: stageStutter ? [stageStutter] : []
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newStutters].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyStutter(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0.08, 0.92);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0.105, 0.84);
  const event = normalizeStutter({
    id: `visitor-stutter-${frame.stage}-${frame.memory.length}`,
    source: 'visitor-stutter',
    stage: frame.stage,
    x: safeX,
    y: safeY,
    force: 1,
    phase: safeX * 15.7 + safeY * 12.1
  });
  const next = buildFrame(frame.stage, [...frame.memory, event].slice(-MEMORY_WINDOW));
  next.previousMemory = frame.memory.map((entry) => ({ ...entry, point: { ...entry.point } }));
  return next;
}

export function deleteLatestStutter(frame) {
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
