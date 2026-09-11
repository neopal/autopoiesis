export const MASTER_SEED = 0x72656c38;

const ROUTE_COUNT = 16;
const POINT_COUNT = 36;
const MEMORY_WINDOW = 5;
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

function normalizeRelay(relay, index = 0) {
  const x = Number(relay?.x);
  const y = Number(relay?.y);
  return {
    id: String(relay?.id ?? `relay-${index}`),
    stage: Math.max(0, Math.floor(Number(relay?.stage) || 0)),
    x: Number(clamp(Number.isFinite(x) ? x : 0.5, 0.06, 0.94).toFixed(4)),
    y: Number(clamp(Number.isFinite(y) ? y : 0.5, 0.08, 0.86).toFixed(4)),
    force: Number(clamp(Number(relay?.force) || 0.8, 0.3, 1).toFixed(4)),
    phase: Number((Number(relay?.phase) || 0).toFixed(6))
  };
}

function closestRoutePoint(points, relay) {
  return points.reduce((best, point, index) => {
    const dx = (point.x - relay.x) * 0.82;
    const dy = point.y - relay.y;
    const distance = Math.hypot(dx, dy);
    return distance < best.distance ? { distance, index } : best;
  }, { distance: Infinity, index: 0 });
}

function nearestRelay(points, relays, stage) {
  return relays
    .filter((relay) => relay.stage <= stage)
    .map((relay) => {
      const closest = closestRoutePoint(points, relay);
      const influence = clamp((0.29 - closest.distance) / 0.2) * relay.force;
      return { relay, ...closest, influence };
    })
    .filter((entry) => entry.influence > 0.06)
    .sort((a, b) => b.influence - a.influence || b.relay.stage - a.relay.stage)[0] ?? null;
}

function makeStageRelay(stage) {
  if (stage === 0 || stage % 2 !== 0) return null;
  const lane = (stage * 3 + 2) % 12;
  return normalizeRelay({
    id: `stage-${stage}-relay`,
    stage,
    x: 0.16 + ((stage * 23) % 66) / 100,
    y: 0.12 + lane * 0.052 + ((stage % 3) - 1) * 0.008,
    force: 0.76,
    phase: stage * 0.61 + lane * 0.29
  });
}

/**
 * v008 changes handwriting's rule from a shared stutter to a relay.
 * A remembered refusal migrates from lane to lane: each route receives the
 * hook at a staggered point, then carries a changed cadence toward the next.
 */
export function makeRoutes(stage, memory = []) {
  const random = rng(MASTER_SEED + stage * 104729);
  const activeRelays = memory.map(normalizeRelay).slice(-MEMORY_WINDOW);

  return Array.from({ length: ROUTE_COUNT }, (_, routeIndex) => {
    const lane = routeIndex % 12;
    const band = Math.floor(routeIndex / 12);
    const phase = random() * Math.PI * 2;
    const laneY = 0.12 + lane * 0.052 + band * 0.014;
    const points = [];

    for (let step = 0; step < POINT_COUNT; step += 1) {
      const x = 0.038 + step * 0.027;
      const wave = Math.sin(step * 0.55 + phase + stage * 0.16) * 0.014;
      const letter = Math.sin(step * 1.63 + phase * 0.64) * 0.0055;
      const tremor = (random() - 0.5) * 0.012;
      points.push({ x, y: laneY + wave + letter + tremor });
    }

    const draftPoints = copyPoints(points);
    const nearest = nearestRelay(points, activeRelays, stage);
    let relayStart = -1;
    let relayEnd = -1;
    let handoffIndex = -1;
    let relayStrength = 0;
    let relaySource = null;
    let handoff = false;
    let afterCadence = 0;
    let laneDistance = 0;

    if (nearest) {
      const targetLane = Math.round((nearest.relay.y - 0.12) / 0.052);
      laneDistance = routeIndex - targetLane;
      relayStart = Math.max(4, Math.min(POINT_COUNT - 12, nearest.index + Math.round(laneDistance * 0.72)));
      relayEnd = Math.min(POINT_COUNT - 7, relayStart + 5);
      handoffIndex = Math.min(POINT_COUNT - 3, relayEnd + 2 + Math.abs(laneDistance) % 3);
      relayStrength = nearest.influence;
      handoff = relayStrength > 0.12;
      relaySource = handoff ? nearest.relay.id : null;
      const direction = ((routeIndex + Math.round(nearest.relay.y * 100)) % 2 ? 1 : -1);
      afterCadence = direction * (0.014 + relayStrength * 0.018) * (1 + Math.min(3, Math.abs(laneDistance)) * 0.11);
      const handoffY = nearest.relay.y + Math.sin(nearest.relay.phase + routeIndex * 0.31) * 0.009 + laneDistance * 0.004;

      for (let step = 0; step < POINT_COUNT; step += 1) {
        if (step < relayStart) {
          const approach = smooth(clamp((step - (relayStart - 6)) / 6));
          points[step].y += (handoffY - points[step].y) * relayStrength * approach * 0.42;
        } else if (step <= relayEnd) {
          const beat = (step - relayStart) / Math.max(1, relayEnd - relayStart);
          const envelope = Math.sin(beat * Math.PI);
          const passingHook = Math.sin(beat * Math.PI * 2 + nearest.relay.phase + laneDistance * 0.42) * 0.023 * relayStrength;
          points[step].x += envelope * (0.014 + laneDistance * 0.0007) * relayStrength;
          points[step].y += (handoffY - points[step].y) * relayStrength * (0.28 + envelope * 0.45);
          points[step].y += passingHook;
        } else {
          const after = smooth(clamp((step - relayEnd) / 10));
          const migration = Math.sin((step - relayEnd) * 0.77 + nearest.relay.phase) * 0.009 * relayStrength;
          points[step].x += 0.009 * relayStrength * (1 - after * 0.32) + Math.max(0, laneDistance) * 0.0005;
          points[step].y += afterCadence * (1 - after * 0.48) + migration;
        }
      }
    }

    const automaticWitness = (routeIndex + stage * 3) % 13 === 0;
    const witnessIndex = 8 + ((routeIndex + stage) % 6);
    const refusal = automaticWitness ? {
      id: `route-${stage}-${routeIndex}`,
      stage,
      route: routeIndex,
      x: Number(points[witnessIndex].x.toFixed(4)),
      y: Number(points[witnessIndex].y.toFixed(4)),
      force: Number(Math.max(relayStrength, 0.34).toFixed(4)),
      phase: Number((phase + routeIndex * 0.24).toFixed(6))
    } : null;

    return {
      id: `route-${stage}-${routeIndex}`,
      points,
      draftPoints,
      lane: routeIndex,
      relayStart,
      relayEnd,
      handoffIndex,
      relayStrength: Number(relayStrength.toFixed(4)),
      relaySource,
      handoff,
      laneDistance,
      afterCadence: Number(afterCadence.toFixed(6)),
      failed: Boolean(refusal),
      refusal,
      weight: Number((0.55 + random() * 1.05).toFixed(4)),
      phase: Number(phase.toFixed(6))
    };
  });
}

function summarizeRelays(routes, memory) {
  return memory.map((relay) => {
    const affected = routes.filter((route) => route.relaySource === relay.id);
    if (!affected.length) return { ...relay, affectedRoutes: 0, handoff: false };
    return {
      ...relay,
      affectedRoutes: affected.length,
      handoff: affected.some((route) => route.handoff),
      relayStart: Math.min(...affected.map((route) => route.relayStart)),
      relayEnd: Math.max(...affected.map((route) => route.relayEnd)),
      handoffIndex: Math.max(...affected.map((route) => route.handoffIndex))
    };
  });
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.floor(Number(targetStage) || 0));
  const stableMemory = memory.map(normalizeRelay).slice(-MEMORY_WINDOW);
  const routes = makeRoutes(stage, stableMemory);
  const newRelays = makeStageRelay(stage) ? [makeStageRelay(stage)] : [];
  return {
    stage,
    routes,
    memory: stableMemory,
    relays: summarizeRelays(routes, stableMemory),
    newRelays,
    newRefusals: routes.filter((route) => route.refusal).map((route) => ({ ...route.refusal }))
  };
}

export function buildTimeline(finalStage = 12) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.max(0, Math.floor(finalStage)); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newRelays, ...frame.newRefusals].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyRelay(frame, position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0.06, 0.94);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0.08, 0.86);
  const relay = normalizeRelay({
    id: `visitor-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    x: safeX,
    y: safeY,
    force: 1,
    phase: safeX * 15.7 + safeY * 12.1
  });
  const next = buildFrame(frame.stage, [...frame.memory, relay].slice(-MEMORY_WINDOW));
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function removeLatestRelay(frame) {
  const previousMemory = Array.isArray(frame.previousMemory)
    ? frame.previousMemory
    : frame.memory.slice(0, -1);
  return buildFrame(frame.stage, previousMemory);
}

export const constants = {
  routeCount: ROUTE_COUNT,
  pointCount: POINT_COUNT,
  memoryWindow: MEMORY_WINDOW
};
