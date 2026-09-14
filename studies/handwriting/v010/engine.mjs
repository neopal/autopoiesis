export const MASTER_SEED = 0x57563130;
export const STAGES = 14;
export const MEMORY_WINDOW = 6;
const ROUTE_COUNT = 20;
const POINT_COUNT = 42;
const LANE_COUNT = 15;
const LANE_GAP = 0.05;
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

function normalizeHinge(entry, index = 0) {
  const rawX = Number(entry?.x);
  const rawY = Number(entry?.y);
  const x = Number(clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92).toFixed(4));
  const y = Number(clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.11, 0.83).toFixed(4));
  return {
    id: String(entry?.id ?? `hinge-${index}`),
    source: String(entry?.source ?? 'timeline-hinge'),
    stage: Math.max(0, Math.floor(Number(entry?.stage) || 0)),
    x,
    y,
    point: { x, y },
    force: Number(clamp(Number(entry?.force) || 0.84, 0.3, 1).toFixed(4)),
    phase: Number((Number(entry?.phase) || 0).toFixed(6))
  };
}

function closestRoutePoint(points, event) {
  return points.reduce((best, point, index) => {
    const dx = (point.x - event.x) * 0.9;
    const dy = point.y - event.y;
    const distance = Math.hypot(dx, dy);
    return distance < best.distance ? { distance, index } : best;
  }, { distance: Infinity, index: 0 });
}

function makeStageHinge(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const lane = 3 + ((stage * 4) % 9);
  return normalizeHinge({
    id: `stage-${stage}-hinge`,
    stage,
    x: 0.17 + ((stage * 31) % 66) / 100,
    y: 0.11 + lane * LANE_GAP + (stage % 3 - 1) * 0.007,
    force: 0.82,
    phase: stage * 0.73 + lane * 0.41
  });
}

function eventInfluence(points, event, lane, targetLane) {
  const closest = closestRoutePoint(points, event);
  const laneDistance = Math.abs(lane - targetLane);
  const band = laneDistance <= 2 ? 1 - laneDistance * 0.24 : 0;
  return {
    ...closest,
    value: clamp((0.24 - closest.distance) / 0.19) * band * event.force
  };
}

function measureFold(points, hingeIndex) {
  const before = points[Math.max(0, hingeIndex - 1)];
  const hinge = points[hingeIndex];
  const after = points[Math.min(points.length - 1, hingeIndex + 1)];
  const incoming = { x: hinge.x - before.x, y: hinge.y - before.y };
  const outgoing = { x: after.x - hinge.x, y: after.y - hinge.y };
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
  const dot = incoming.x * outgoing.x + incoming.y * outgoing.y;
  return Number(Math.abs(Math.atan2(cross, dot)).toFixed(4));
}

/**
 * v010 changes handwriting's rule from a lane switch to a finite hinge.
 * A remembered refusal bends a local family around one angular seam, then
 * carries a small offset into the downstream sentence.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const activeHinges = memory.map(normalizeHinge).slice(-MEMORY_WINDOW);

  return Array.from({ length: ROUTE_COUNT }, (_, routeIndex) => {
    const lane = routeIndex % LANE_COUNT;
    const band = Math.floor(routeIndex / LANE_COUNT);
    const phase = random() * Math.PI * 2;
    const laneY = 0.11 + lane * LANE_GAP + band * 0.012;
    const draftPoints = [];

    for (let step = 0; step < POINT_COUNT; step += 1) {
      const x = 0.04 + step * 0.0224;
      const wave = Math.sin(step * 0.49 + phase + stage * 0.13) * 0.011;
      const letter = Math.sin(step * 1.67 + phase * 0.57) * 0.005;
      const tremor = (random() - 0.5) * 0.008;
      draftPoints.push({ x, y: laneY + wave + letter + tremor });
    }

    const points = copyPoints(draftPoints);
    const hingeHistory = [];
    let hingeStart = -1;
    let hingeEnd = -1;
    let hingeIndex = -1;
    let hingeSource = null;
    let hingePoint = null;
    let foldAngle = 0;
    let hingeStrength = 0;
    let carriedOffset = 0;

    for (const event of activeHinges) {
      const targetLane = Math.max(1, Math.min(LANE_COUNT - 2, Math.round((event.y - 0.11) / LANE_GAP)));
      const influence = eventInfluence(points, event, lane, targetLane);
      if (influence.value <= 0.08) continue;

      const start = Math.max(5, Math.min(POINT_COUNT - 17, Math.round((event.x - 0.04) / 0.0224) - 5));
      const end = Math.min(POINT_COUNT - 4, start + 15);
      const pivot = Math.max(start + 3, Math.min(end - 3, start + 8));
      const laneDelta = lane - targetLane;
      const side = laneDelta === 0
        ? (Math.sin(event.phase) < 0 ? -1 : 1)
        : (laneDelta < 0 ? 1 : -1);
      const amplitude = (0.012 + influence.value * 0.023) * side;
      const carry = amplitude * (0.38 + influence.value * 0.2);
      const pocketX = 0.004 + influence.value * 0.006;

      for (let step = 0; step < POINT_COUNT; step += 1) {
        if (step < start) {
          const approach = smooth(clamp((step - (start - 5)) / 5));
          points[step].y += carry * 0.38 * approach;
        } else if (step <= pivot) {
          const progress = smooth(clamp((step - start) / (pivot - start)));
          points[step].x += pocketX * Math.sin(progress * Math.PI * 0.5);
          points[step].y += carry * 0.38 + amplitude * progress;
        } else if (step <= end) {
          const progress = smooth(clamp((step - pivot) / (end - pivot)));
          points[step].x += pocketX * Math.sin((1 - progress) * Math.PI * 0.5);
          points[step].y += carry * 0.38 + amplitude * (1 - progress);
        } else {
          const settle = smooth(clamp((step - end) / 12));
          points[step].x += pocketX * (1 - settle * 0.45);
          points[step].y += carry * (1 - settle * 0.14);
        }
      }

      const eventFold = measureFold(points, pivot);
      const eventRecord = {
        id: event.id,
        start,
        end,
        pivot,
        point: {
          x: Number(points[pivot].x.toFixed(4)),
          y: Number(points[pivot].y.toFixed(4))
        },
        strength: Number(influence.value.toFixed(4)),
        foldAngle: eventFold,
        carriedOffset: Number(carry.toFixed(4))
      };
      hingeHistory.push(eventRecord);
      hingeStart = start;
      hingeEnd = end;
      hingeIndex = pivot;
      hingeSource = event.id;
      hingePoint = eventRecord.point;
      foldAngle = eventFold;
      hingeStrength = Math.max(hingeStrength, influence.value);
      carriedOffset = carry;
    }

    return {
      id: `route-${stage}-${routeIndex}`,
      points,
      draftPoints,
      lane,
      band,
      hingeStart,
      hingeEnd,
      hingeIndex,
      hingeSource,
      hingePoint,
      hingeHistory,
      foldAngle,
      hingeStrength: Number(hingeStrength.toFixed(4)),
      carriedOffset: Number(carriedOffset.toFixed(4)),
      failed: hingeSource !== null,
      weight: Number((0.58 + random() * 0.92).toFixed(4)),
      phase: Number(phase.toFixed(6))
    };
  });
}

function summarizeHinges(routes, memory) {
  return memory.map((event, memoryIndex) => {
    const affected = routes.flatMap((route) => route.hingeHistory
      .filter((record) => record.id === event.id)
      .map((record) => ({ route, record })));
    return {
      ...event,
      memoryIndex,
      affectedRoutes: affected.length,
      hinged: affected.some(({ record }) => record.foldAngle > 0.1),
      hingeStart: affected.length ? Math.min(...affected.map(({ record }) => record.start)) : -1,
      hingeEnd: affected.length ? Math.max(...affected.map(({ record }) => record.end)) : -1,
      foldAngle: affected.length ? Number(Math.max(...affected.map(({ record }) => record.foldAngle)).toFixed(4)) : 0
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const stableMemory = memory.map(normalizeHinge).slice(-MEMORY_WINDOW);
  const routes = makeRoutes(stage, stableMemory);
  const stageHinge = makeStageHinge(stage);
  return {
    stage,
    routes,
    memory: stableMemory,
    hinges: summarizeHinges(routes, stableMemory),
    newHinges: stageHinge ? [stageHinge] : []
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newHinges].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyHinge(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0.08, 0.92);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0.11, 0.83);
  const event = normalizeHinge({
    id: `visitor-hinge-${frame.stage}-${frame.memory.length}`,
    source: 'visitor-hinge',
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

export function deleteLatestHinge(frame) {
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
