export const MASTER_SEED = 0x57563134;
export const STAGES = 17;
export const MEMORY_WINDOW = 6;

const ROUTE_COUNT = 24;
const POINT_COUNT = 64;
const LANE_COUNT = 18;
const BASE_Y = 0.115;
const LANE_GAP = 0.0375;
const X_START = 0.025;
const X_STEP = 0.0152;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (value) => value * value * (3 - 2 * value);
const lerp = (a, b, amount) => a + (b - a) * amount;

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

function normalizeReturn(entry, index = 0) {
  const rawX = Number(entry?.x);
  const rawY = Number(entry?.y);
  const x = Number(clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.07, 0.93).toFixed(4));
  const y = Number(clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.105, 0.805).toFixed(4));
  return {
    id: String(entry?.id ?? `return-${index}`),
    source: String(entry?.source ?? 'timeline-return'),
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
  const family = laneDistance <= 3 ? 1 - laneDistance * 0.17 : 0;
  return {
    ...closest,
    value: clamp((0.29 - closest.distance) / 0.18) * family * event.force
  };
}

function makeStageReturn(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const lane = 2 + ((stage * 7) % 13);
  return normalizeReturn({
    id: `stage-${stage}-return`,
    stage,
    x: 0.14 + ((stage * 29) % 70) / 100,
    y: BASE_Y + lane * LANE_GAP + (stage % 3 - 1) * 0.005,
    force: 0.9,
    phase: stage * 0.71 + lane * 0.39
  });
}

function returnWindow(event, closestIndex) {
  const eventIndex = Math.round((event.x - X_START) / X_STEP);
  const anchor = Math.max(closestIndex, eventIndex);
  const approachStart = Math.max(6, Math.min(POINT_COUNT - 43, anchor - 9));
  const phraseStart = approachStart + 8;
  const phraseEnd = phraseStart + 6;
  const relayStart = phraseEnd + 1;
  const relayEnd = Math.min(POINT_COUNT - 19, relayStart + 13);
  const replyStart = relayEnd + 2;
  const replyEnd = Math.min(POINT_COUNT - 10, replyStart + 10);
  const settleEnd = Math.min(POINT_COUNT - 3, replyEnd + 7);
  return { approachStart, phraseStart, phraseEnd, relayStart, relayEnd, replyStart, replyEnd, settleEnd };
}

function partnerRouteIndex(routeIndex, lane, targetLane) {
  const direction = lane <= targetLane ? 1 : -1;
  const candidate = routeIndex + direction;
  return Math.max(0, Math.min(ROUTE_COUNT - 1, candidate));
}

/**
 * v014 changes handwriting's rule from a cadence relay to a delayed counterphrase.
 * A route carries a neighbour's cadence, then answers it later by reflecting the
 * borrowed deviation against its own draft. The memory array is explicit so the
 * whole field can be replayed exactly.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const activeReturns = memory.map(normalizeReturn).slice(-MEMORY_WINDOW);
  const drafts = Array.from({ length: ROUTE_COUNT }, (_, routeIndex) => {
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

    return { lane, band, phase: Number(phase.toFixed(6)), draftPoints, points: copyPoints(draftPoints) };
  });

  return drafts.map((draft, routeIndex) => {
    const { lane, band, phase, draftPoints } = draft;
    const points = copyPoints(draftPoints);
    const counterphraseHistory = [];

    for (const event of activeReturns) {
      const targetLane = Math.max(0, Math.min(LANE_COUNT - 1, Math.round((event.y - BASE_Y) / LANE_GAP)));
      const influence = eventInfluence(points, event, lane, targetLane);
      if (influence.value <= 0.08) continue;

      const window = returnWindow(event, influence.index);
      const laneDistance = lane - targetLane;
      const partnerIndex = partnerRouteIndex(routeIndex, lane, targetLane);
      const partnerDraft = drafts[partnerIndex].draftPoints;
      const direction = Math.sin(event.phase + lane * 0.23) < 0 ? -1 : 1;
      const centerY = clamp(
        event.y + (event.y < 0.46 ? 0.034 : -0.034) + Math.sin(event.phase) * 0.004,
        0.14,
        0.78
      );
      const exitOffset = direction * (0.009 + influence.value * 0.018) * (1 + Math.min(3, Math.abs(laneDistance)) * 0.14);
      const counterOffset = -direction * (0.006 + influence.value * 0.012);
      const beforePhrase = points[window.phraseStart].y;
      const beforeReply = points[window.replyStart].y;

      for (let step = window.approachStart; step < POINT_COUNT; step += 1) {
        if (step < window.phraseStart) {
          const approach = smooth((step - window.approachStart) / (window.phraseStart - window.approachStart));
          points[step].y = lerp(points[step].y, centerY, (0.48 + influence.value * 0.38) * approach);
        } else if (step <= window.phraseEnd) {
          const phrase = (step - window.phraseStart) / Math.max(1, window.phraseEnd - window.phraseStart);
          const sharedPulse = Math.sin(phrase * Math.PI * 2 + event.phase) * 0.0025;
          const residual = laneDistance * 0.00145 * (1 - influence.value * 0.58);
          points[step].x += Math.sin(phrase * Math.PI) * 0.0042 * direction * influence.value;
          points[step].y = centerY + sharedPulse + residual;
        } else if (step <= window.relayEnd) {
          const relay = smooth((step - window.relayStart) / (window.relayEnd - window.relayStart));
          const inherited = partnerDraft[step].y + Math.sin(event.phase + step * 0.77 + routeIndex * 0.21) * 0.0032 * influence.value;
          points[step].y = lerp(centerY + exitOffset * 0.2, inherited + exitOffset, relay * (0.76 + influence.value * 0.22));
          points[step].x += 0.0048 * direction * influence.value * relay;
        } else if (step <= window.replyEnd) {
          const reply = smooth((step - window.replyStart) / (window.replyEnd - window.replyStart));
          const borrowedDeviation = partnerDraft[step].y - draftPoints[step].y;
          const reflected = draftPoints[step].y - borrowedDeviation * (0.72 + influence.value * 0.28);
          const answer = reflected + counterOffset * reply;
          points[step].y = lerp(points[window.relayEnd].y, answer, reply);
          points[step].x += 0.0038 * -direction * influence.value * reply;
        } else if (step <= window.settleEnd) {
          const settle = smooth((step - window.replyEnd) / (window.settleEnd - window.replyEnd));
          const borrowedDeviation = partnerDraft[step].y - draftPoints[step].y;
          const reflected = draftPoints[step].y - borrowedDeviation * 0.36 + counterOffset;
          points[step].y = lerp(reflected, draftPoints[step].y + exitOffset, settle);
          points[step].x += 0.0038 * -direction * influence.value * (1 - settle * 0.55);
        } else {
          const tail = smooth((step - window.settleEnd) / 8);
          points[step].y += exitOffset * (1 - tail * 0.46);
          points[step].x += 0.003 * direction * influence.value * (1 - tail * 0.5);
        }
      }

      const phraseSlice = points.slice(window.phraseStart, window.phraseEnd + 1);
      const phraseHeight = Math.max(...phraseSlice.map((point) => point.y)) - Math.min(...phraseSlice.map((point) => point.y));
      const counterShift = Math.abs(points[window.replyEnd].y - draftPoints[window.replyEnd].y);
      const relaySeparation = Math.abs(points[window.relayEnd].y - points[window.phraseEnd].y);
      counterphraseHistory.push({
        id: event.id,
        approachStart: window.approachStart,
        phraseStart: window.phraseStart,
        phraseEnd: window.phraseEnd,
        relayStart: window.relayStart,
        relayEnd: window.relayEnd,
        replyStart: window.replyStart,
        replyEnd: window.replyEnd,
        settleEnd: window.settleEnd,
        handoffStep: window.relayStart,
        sharedSpan: window.phraseEnd - window.phraseStart + 1,
        replySpan: window.replyEnd - window.replyStart + 1,
        partnerRoute: partnerIndex,
        partnerLane: drafts[partnerIndex].lane,
        strength: Number(influence.value.toFixed(4)),
        convergence: Number(Math.abs(beforePhrase - points[window.phraseStart].y).toFixed(4)),
        counterShift: Number(counterShift.toFixed(4)),
        relaySeparation: Number(relaySeparation.toFixed(4)),
        phraseHeight: Number(phraseHeight.toFixed(4)),
        preReply: Number(beforeReply.toFixed(4)),
        exitOffset: Number(exitOffset.toFixed(4))
      });
    }

    return {
      id: `route-${stage}-${routeIndex}`,
      points,
      draftPoints,
      lane,
      band,
      counterphraseHistory,
      countered: counterphraseHistory.length > 0,
      weight: Number((0.56 + random() * 0.94).toFixed(4)),
      phase
    };
  });
}

function summarizeReturns(routes, memory) {
  return memory.map((event, memoryIndex) => {
    const affected = routes.flatMap((route) => route.counterphraseHistory
      .filter((record) => record.id === event.id)
      .map((record) => ({ route, record })));
    return {
      ...event,
      memoryIndex,
      affectedRoutes: affected.length,
      answered: affected.length > 0,
      phraseStart: affected.length ? Math.min(...affected.map(({ record }) => record.phraseStart)) : -1,
      phraseEnd: affected.length ? Math.max(...affected.map(({ record }) => record.phraseEnd)) : -1,
      relayStart: affected.length ? Math.min(...affected.map(({ record }) => record.relayStart)) : -1,
      relayEnd: affected.length ? Math.max(...affected.map(({ record }) => record.relayEnd)) : -1,
      replyStart: affected.length ? Math.min(...affected.map(({ record }) => record.replyStart)) : -1,
      replyEnd: affected.length ? Math.max(...affected.map(({ record }) => record.replyEnd)) : -1,
      maxCounterShift: affected.length ? Number(Math.max(...affected.map(({ record }) => record.counterShift)).toFixed(4)) : 0
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const stableMemory = memory.map(normalizeReturn).slice(-MEMORY_WINDOW);
  const routes = makeRoutes(stage, stableMemory);
  const stageReturn = makeStageReturn(stage);
  return {
    stage,
    routes,
    memory: stableMemory,
    returns: summarizeReturns(routes, stableMemory),
    newReturns: stageReturn ? [stageReturn] : []
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newReturns].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyReturn(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0.07, 0.93);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0.105, 0.805);
  const event = normalizeReturn({
    id: `visitor-return-${frame.stage}-${frame.memory.length}`,
    source: 'visitor-return',
    stage: frame.stage,
    x: safeX,
    y: safeY,
    force: 1,
    phase: safeX * 15.9 + safeY * 12.3
  });
  const next = buildFrame(frame.stage, [...frame.memory, event].slice(-MEMORY_WINDOW));
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function removeLatestReturn(frame) {
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
