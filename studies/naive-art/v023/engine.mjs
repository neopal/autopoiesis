export const SEED = 0x4e413233;
export const STAGES = 20;
export const MEMORY_WINDOW = 4;
export const PRIMITIVE_BUDGET = 28;
export const BAND_COUNT = 12;

export const ANCHORS = [
  { x: 0.16, y: 0.70 },
  { x: 0.12, y: 0.34 },
  { x: 0.30, y: 0.16 },
  { x: 0.56, y: 0.20 },
  { x: 0.83, y: 0.13 },
  { x: 0.90, y: 0.40 },
  { x: 0.74, y: 0.67 },
  { x: 0.49, y: 0.83 },
  { x: 0.24, y: 0.83 },
  { x: 0.34, y: 0.54 },
  { x: 0.58, y: 0.48 },
  { x: 0.70, y: 0.31 }
];

const DEFAULT_BANDS = [3, 8, 5, 10, 1, 7, 4, 9, 2, 6, 0, 11];
const PALETTE = ['#e35d4f', '#e4ae43', '#4e8781', '#647ca6', '#9d718d', '#d58b57', '#303b56'];

function clampStage(stage) {
  return Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0)));
}

function cloneEvent(event) {
  return { ...event };
}

function normalizeMemory(memory) {
  return (Array.isArray(memory) ? memory : []).slice(-MEMORY_WINDOW).map(cloneEvent);
}

function anchor(index) {
  return ANCHORS[((index % ANCHORS.length) + ANCHORS.length) % ANCHORS.length];
}

function buildStroke(index, fromIndex, toIndex, event) {
  const from = anchor(fromIndex);
  const to = anchor(toIndex);
  const bend = 0.055 + ((index * 7) % 5) * 0.009;
  const sign = index % 2 === 0 ? 1 : -1;
  const points = [];
  for (let step = 0; step <= 14; step += 1) {
    const t = step / 14;
    const envelope = Math.sin(Math.PI * t);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const nx = -dy;
    const ny = dx;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const wave = Math.sin((index + 1.7) * Math.PI * t + index * 0.41) * bend * envelope;
    const grain = Math.cos((index + 3) * Math.PI * t) * 0.008 * envelope;
    points.push({
      x: from.x + dx * t + (nx / length) * (wave + grain) * sign,
      y: from.y + dy * t + (ny / length) * (wave + grain) * sign
    });
  }
  return {
    id: `band-${String(index).padStart(2, '0')}`,
    points,
    width: 0.030 + (index % 4) * 0.004,
    tone: PALETTE[index % PALETTE.length],
    fromIndex,
    toIndex,
    expectedFromIndex: index % ANCHORS.length,
    expectedToIndex: (index + 1) % ANCHORS.length,
    slip: event ? { ...event } : null
  };
}

function baseTrace() {
  return {
    grammar: 'intended route → wrong landing → future route reuse',
    nextRule: 'follow-seeded-route',
    wrongLandingCount: 0,
    intendedGapCount: 0,
    pointerOnlyChanges: 0,
    routeLength: 0,
    changedFutureBands: 0
  };
}

export function buildScene(memory = []) {
  const boundedMemory = normalizeMemory(memory);
  const eventByBand = new Map(boundedMemory.map((event) => [event.bandIndex, event]));
  const strokes = [];
  const trace = baseTrace();
  let currentIndex = 0;

  for (let index = 0; index < BAND_COUNT; index += 1) {
    const expectedFromIndex = index % ANCHORS.length;
    const expectedToIndex = (index + 1) % ANCHORS.length;
    const event = eventByBand.get(index) ?? null;
    const toIndex = event?.wrongLanding ?? expectedToIndex;
    const stroke = buildStroke(index, currentIndex, toIndex, event);
    strokes.push(stroke);
    trace.routeLength += Math.hypot(anchor(toIndex).x - anchor(currentIndex).x, anchor(toIndex).y - anchor(currentIndex).y);
    if (event) {
      trace.wrongLandingCount += 1;
      trace.intendedGapCount += 1;
      trace.nextRule = 'reuse-wrong-landing';
    }
    if (currentIndex !== expectedFromIndex) trace.changedFutureBands += 1;
    currentIndex = toIndex;
  }
  trace.routeLength = Number(trace.routeLength.toFixed(6));
  return {
    strokes,
    trace,
    anchors: ANCHORS.map((point) => ({ ...point })),
    voids: boundedMemory.map((event) => ({
      x: anchor(event.intendedLanding).x,
      y: anchor(event.intendedLanding).y,
      radius: 0.038 + event.sequence * 0.004
    }))
  };
}

export function buildFrame(stage = 0, memory = []) {
  const boundedMemory = normalizeMemory(memory);
  return {
    stage: clampStage(stage),
    stages: STAGES,
    memory: boundedMemory,
    primitiveCount: PRIMITIVE_BUDGET,
    scene: buildScene(boundedMemory),
    interaction: 'sequence'
  };
}

function chooseBand(scene, requested) {
  const occupied = new Set(scene?.trace ? [] : []);
  const active = scene?.strokes ?? [];
  for (const stroke of active) if (stroke.slip) occupied.add(stroke.slip.bandIndex);
  if (Number.isInteger(requested) && requested >= 0 && requested < BAND_COUNT && !occupied.has(requested)) return requested;
  return DEFAULT_BANDS.find((index) => !occupied.has(index)) ?? 0;
}

function eventFor(frame, requestedBand) {
  const bandIndex = chooseBand(frame.scene, requestedBand);
  const sequence = frame.memory.length;
  const intendedLanding = (bandIndex + 1) % ANCHORS.length;
  const currentLanding = frame.scene?.strokes?.[bandIndex]?.fromIndex ?? bandIndex;
  const nextIntendedLanding = (bandIndex + 2) % ANCHORS.length;
  let wrongLanding = (intendedLanding + 3 + sequence * 2) % ANCHORS.length;
  while (wrongLanding === intendedLanding || wrongLanding === bandIndex || wrongLanding === currentLanding || wrongLanding === nextIntendedLanding) {
    wrongLanding = (wrongLanding + 1) % ANCHORS.length;
  }
  return {
    source: 'double-tap-slip',
    sequence,
    bandIndex,
    intendedLanding,
    wrongLanding,
    reason: 'the next band reused a wrong landing'
  };
}

export function commitSlip(frame, { bandIndex = null } = {}) {
  const current = frame ?? buildFrame(0, []);
  const event = eventFor(current, bandIndex);
  const nextMemory = normalizeMemory([...current.memory, event]);
  return {
    ...buildFrame(Math.min(STAGES - 1, current.stage + 1), nextMemory),
    interaction: 'slip-committed'
  };
}

export function liftLatestSlip(frame) {
  const current = frame ?? buildFrame(0, []);
  if (!current.memory.length) return { ...current, interaction: 'slip-lifted' };
  return {
    ...buildFrame(Math.max(0, current.stage - 1), current.memory.slice(0, -1)),
    interaction: 'slip-lifted'
  };
}

export function releaseSlip() {
  return { ...buildFrame(0, []), interaction: 'released' };
}

export function geometrySignature(frame) {
  const scene = frame?.scene ?? buildScene([]);
  return JSON.stringify({
    strokes: scene.strokes.map((stroke) => ({
      id: stroke.id,
      fromIndex: stroke.fromIndex,
      toIndex: stroke.toIndex,
      points: stroke.points
    })),
    trace: scene.trace,
    voids: scene.voids
  });
}

export function buildTimeline() {
  const timeline = [];
  let frame = buildFrame(0, []);
  for (let stage = 0; stage < STAGES; stage += 1) {
    timeline.push({ ...frame, stage });
    if (stage < STAGES - 1) frame = commitSlip(frame);
  }
  return timeline;
}
