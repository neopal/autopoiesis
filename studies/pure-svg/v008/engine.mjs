export const SEED = 0x53564738;
export const STAGES = 12;
export const PRIMITIVE_BUDGET = 18;
export const MEMORY_LIMIT = 4;

const BASE_CONTOUR = [
  { x: 0.10, y: 0.50 },
  { x: 0.17, y: 0.40 },
  { x: 0.29, y: 0.33 },
  { x: 0.44, y: 0.31 },
  { x: 0.60, y: 0.27 },
  { x: 0.76, y: 0.33 },
  { x: 0.88, y: 0.44 },
  { x: 0.79, y: 0.53 },
  { x: 0.68, y: 0.48 },
  { x: 0.66, y: 0.63 },
  { x: 0.56, y: 0.69 },
  { x: 0.46, y: 0.62 },
  { x: 0.36, y: 0.71 },
  { x: 0.25, y: 0.66 },
  { x: 0.27, y: 0.54 },
  { x: 0.16, y: 0.63 }
];

const ROUTES = [
  { id: 'fore-leg', anchorIndex: 9, foot: { x: 0.70, y: 0.86 }, side: 1 },
  { id: 'middle-leg', anchorIndex: 11, foot: { x: 0.45, y: 0.90 }, side: -1 },
  { id: 'rear-leg', anchorIndex: 13, foot: { x: 0.21, y: 0.84 }, side: 1 }
];

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyRelay(relay) {
  return {
    ...relay,
    point: copyPoint(relay.point),
    pivot: copyPoint(relay.pivot),
    relayPoint: copyPoint(relay.relayPoint),
    handoffVector: copyPoint(relay.handoffVector),
    crossVector: copyPoint(relay.crossVector),
    influencedRoutes: [...relay.influencedRoutes]
  };
}

function contourFor(stage) {
  const random = rng(SEED + stage * 7919);
  const breath = Math.sin(stage * 0.77) * 0.018;
  return BASE_CONTOUR.map((point, index) => ({
    x: clamp(point.x + breath + (random() - 0.5) * 0.013),
    y: clamp(point.y + Math.cos(stage * 0.59 + index * 0.74) * 0.014 + (random() - 0.5) * 0.010)
  }));
}

function nearestIndex(point, points) {
  return points.reduce((best, candidate, index) => (
    distance(point, candidate) < distance(point, points[best]) ? index : best
  ), 0);
}

function makeRelay(points, stage, anchorIndex, source = 'auto-relay', pointOverride = null) {
  const pivot = copyPoint(points[anchorIndex]);
  const point = pointOverride ? copyPoint(pointOverride) : copyPoint(pivot);
  const relayIndex = Math.min(points.length - 1, anchorIndex + 2 + ((stage + anchorIndex) % 3));
  const relayPoint = copyPoint(points[relayIndex]);
  const direction = (stage + anchorIndex) % 2 === 0 ? 1 : -1;
  const handoffVector = {
    x: clamp((relayPoint.x - pivot.x) * 0.84 + direction * 0.028, -0.22, 0.22),
    y: clamp((relayPoint.y - pivot.y) * 0.66 - 0.018, -0.18, 0.18)
  };
  const crossVector = {
    x: clamp(-handoffVector.y * 0.72, -0.15, 0.15),
    y: clamp(handoffVector.x * 0.72, -0.15, 0.15)
  };
  return {
    point,
    pivot,
    anchorIndex,
    relayIndex,
    relayPoint,
    sourceStage: stage,
    source,
    handoffVector,
    crossVector,
    influencedRoutes: ROUTES.filter((route) => route.anchorIndex >= anchorIndex).map((route) => route.id)
  };
}

function applyMemory(points, memory) {
  return points.map((point, index) => {
    const result = copyPoint(point);
    for (const relay of memory) {
      if (index < relay.anchorIndex) continue;
      const span = Math.max(1, BASE_CONTOUR.length - 1 - relay.anchorIndex);
      const phase = clamp((index - relay.anchorIndex) / span);
      const envelope = Math.sin(Math.PI * phase);
      const carry = phase * phase;
      const parity = (index - relay.anchorIndex) % 2 === 0 ? 1 : -1;
      const amount = envelope * (0.88 + phase * 0.22) + carry * 0.34;
      result.x += relay.handoffVector.x * amount + relay.crossVector.x * parity * envelope * 0.46;
      result.y += relay.handoffVector.y * amount + relay.crossVector.y * parity * envelope * 0.46;
    }
    return {
      x: clamp(result.x, 0.04, 0.96),
      y: clamp(result.y, 0.12, 0.88)
    };
  });
}

function buildRoutes(points, memory, stage) {
  return ROUTES.map((route, routeIndex) => {
    const relevant = memory.filter((relay) => relay.anchorIndex <= route.anchorIndex);
    const latest = relevant.at(-1);
    const relayVector = relevant.reduce((sum, relay, index) => {
      const parity = (routeIndex + index) % 2 === 0 ? 1 : -1;
      return {
        x: sum.x + relay.handoffVector.x * (1 + index * 0.2) + relay.crossVector.x * parity * 0.52,
        y: sum.y + relay.handoffVector.y * (1 + index * 0.2) + relay.crossVector.y * parity * 0.52
      };
    }, { x: 0, y: 0 });
    const joint = copyPoint(points[route.anchorIndex]);
    const directKnee = {
      x: joint.x + route.side * (0.036 + routeIndex * 0.012),
      y: joint.y + 0.11 + routeIndex * 0.017
    };
    const directFoot = copyPoint(route.foot);
    const relayed = relevant.length > 0;
    const handoff = latest
      ? {
        x: (latest.relayPoint.x - joint.x) * (0.16 + routeIndex * 0.045),
        y: (latest.relayPoint.y - joint.y) * 0.05
      }
      : { x: 0, y: 0 };
    const parity = latest && (routeIndex + latest.relayIndex) % 2 === 0 ? 1 : -1;
    const knee = {
      x: clamp(directKnee.x + relayVector.x * 1.82 + relayVector.y * parity * 0.24 + handoff.x),
      y: clamp(directKnee.y + relayVector.y * 1.52 + relayVector.x * parity * 0.14 + handoff.y, 0.12, 0.92)
    };
    const foot = {
      x: clamp(directFoot.x + relayVector.x * 3.22 + relayVector.y * parity * 0.36 + handoff.x * 2.1, 0.06, 0.94),
      y: clamp(directFoot.y + relayVector.y * 1.95 + relayVector.x * parity * 0.2 + Math.cos(stage * 0.48 + routeIndex) * 0.006, 0.58, 0.94)
    };
    return {
      id: route.id,
      route: relayed ? 'relayed' : 'direct',
      relayOrder: relayed ? (parity > 0 ? 'lead' : 'return') : null,
      joint,
      knee,
      foot,
      influencedBy: relevant.length,
      source: latest?.source ?? 'none',
      relayIndex: latest?.relayIndex ?? null,
      relayPoint: latest?.relayPoint ?? null
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = contourFor(stage);
  const inherited = memory.map(copyRelay);
  const points = applyMemory(draft, inherited);
  const refusalAnchors = [4, 6, 8, 5, 7, 9, 6, 8, 7, 5, 6, 8];
  const refusalIndex = refusalAnchors[stage % refusalAnchors.length];
  const refused = stage === 0 || stage % 2 === 1;
  const refusal = refused ? makeRelay(points, stage, refusalIndex) : null;
  const relay = inherited.at(-1) ?? null;

  return {
    stage,
    draft,
    points,
    refusalIndex,
    refused,
    refusal,
    relay,
    memory: inherited,
    limbs: buildRoutes(points, inherited, stage),
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index),
    relayCount: inherited.length,
    alternatingRoutes: buildRoutes(points, inherited, stage).filter((limb) => limb.relayOrder === 'return').length
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.refusal) memory = [...memory, frame.refusal].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function deleteRelay(frame, relayIndex = frame.memory.length - 1) {
  if (relayIndex === frame.memory.length - 1 && Array.isArray(frame.priorMemory)) {
    return buildFrame(frame.stage, frame.priorMemory);
  }
  if (relayIndex < 0 || relayIndex >= frame.memory.length) return buildFrame(frame.stage, frame.memory);
  const memory = frame.memory.filter((_, index) => index !== relayIndex);
  return buildFrame(frame.stage, memory);
}

export function applyRelay(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.04, 0.96),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.88)
  };
  const anchorIndex = nearestIndex(bounded, frame.points);
  const relay = makeRelay(frame.points, frame.stage, anchorIndex, 'visitor-relay', bounded);
  const priorMemory = frame.memory.map(copyRelay);
  const next = buildFrame(frame.stage, [...frame.memory, relay].slice(-MEMORY_LIMIT));
  return { ...next, relay, priorMemory, interaction: 'visitor-relay' };
}
