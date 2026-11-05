export const MEMORY_LIMIT = 4;
export const BAND_COUNT = 9;
export const BLOOM_COUNT = 8;
export const STAGES = MEMORY_LIMIT + 1;

const SEED = 0x42523438;
const round = (value) => Number(value.toFixed(5));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function baseBands() {
  return Array.from({ length: BAND_COUNT }, (_, index) => {
    const points = Array.from({ length: 7 }, (_, step) => ({
      x: round(0.08 + step * 0.14 + (seeded(index + step, 11) - 0.5) * 0.05),
      y: round(0.18 + index * 0.075 + Math.sin(step * 0.92 + index * 0.71) * 0.045 + (seeded(index + step, 13) - 0.5) * 0.04)
    }));
    return {
      id: index,
      path: points,
      weight: round(0.42 + seeded(index, 17) * 0.58),
      spread: round(0.06 + seeded(index, 19) * 0.055),
      tone: index % 3,
      opacity: round(0.44 + seeded(index, 23) * 0.32)
    };
  });
}

function baseGates() {
  return [
    { id: 0, x: 0.18, y: 0.61, radius: 0.085 },
    { id: 1, x: 0.48, y: 0.35, radius: 0.082 },
    { id: 2, x: 0.77, y: 0.63, radius: 0.08 }
  ];
}

function baseBlooms() {
  return Array.from({ length: BLOOM_COUNT }, (_, index) => ({
    id: index,
    x: round(0.13 + (index % 4) * 0.245 + (seeded(index, 29) - 0.5) * 0.045),
    y: round(0.23 + Math.floor(index / 4) * 0.48 + (seeded(index, 31) - 0.5) * 0.08),
    rx: round(0.065 + seeded(index, 37) * 0.045),
    ry: round(0.075 + seeded(index, 41) * 0.05),
    tilt: round((seeded(index, 43) - 0.5) * 0.45),
    fold: round(0.18 + seeded(index, 47) * 0.62),
    edge: round(0.2 + seeded(index, 53) * 0.7),
    bloomCount: 0,
    seed: round(seeded(index, 59))
  }));
}

function baseBody() {
  return {
    bands: baseBands(),
    gates: baseGates(),
    blooms: baseBlooms(),
    grains: Array.from({ length: 34 }, (_, index) => ({
      x: round(seeded(index, 61)),
      y: round(seeded(index, 67)),
      length: round(0.008 + seeded(index, 71) * 0.022),
      angle: round(seeded(index, 73) * Math.PI)
    }))
  };
}

const normalizePoint = (point = {}) => ({
  x: round(Math.min(0.98, Math.max(0.02, Number(point.x) || 0.5))),
  y: round(Math.min(0.96, Math.max(0.04, Number(point.y) || 0.5)))
});

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function buildBody(memory) {
  const body = baseBody();
  for (const [eventIndex, event] of memory.entries()) {
    const bloom = body.blooms[event.receiverBloom];
    const polarity = eventIndex % 2 ? -1 : 1;
    bloom.rx = round(Math.min(0.19, bloom.rx + event.intensity * 0.034));
    bloom.ry = round(Math.min(0.22, bloom.ry + event.intensity * 0.027));
    bloom.tilt = round(bloom.tilt + polarity * event.intensity * 0.12);
    bloom.fold = round(Math.min(1.5, bloom.fold + event.intensity * 0.31));
    bloom.edge = round(Math.min(1.5, bloom.edge + event.intensity * 0.22));
    bloom.bloomCount += 1;
  }
  return body;
}

function buildFrameFrom(stage, memory, interaction = 'quiet', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT);
  return {
    grammar: 'remote-regrowth-wash',
    renderer: 'deterministic p5.js 1.11.3 Canvas 2D remote-regrowth wash',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body: buildBody(boundedMemory),
    event: boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null,
    pending: {
      active: false,
      order: [],
      points: [],
      lastPoint: null,
      wrongOrder: false,
      ...pending
    },
    state: { regrowthCount: boundedMemory.length },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.body);
}

export function gatePoint(frame, gateIndex) {
  const gate = frame.body.gates[((Math.floor(Number(gateIndex)) % frame.body.gates.length) + frame.body.gates.length) % frame.body.gates.length];
  return { x: gate.x, y: gate.y };
}

function makeEvent(frame, order = [0, 1, 2], source = 'visitor-stroke') {
  return {
    type: 'remote-regrowth',
    source,
    gateOrder: order,
    receiverBloom: (frame.memory.length * 2 + 2) % BLOOM_COUNT,
    intensity: round(Math.min(1, 0.62 + frame.memory.length * 0.08))
  };
}

export function beginStroke(frame, point) {
  const normalized = normalizePoint(point);
  const firstGate = frame.body.gates[0];
  if (distance(normalized, firstGate) > firstGate.radius * 1.55) {
    return buildFrameFrom(frame.stage, frame.memory, 'stroke-refused-start', { lastPoint: normalized });
  }
  return buildFrameFrom(frame.stage, frame.memory, 'stroke-started', {
    active: true,
    order: [0],
    points: [normalized],
    lastPoint: normalized,
    wrongOrder: false
  });
}

export function moveStroke(frame, point) {
  if (!frame.pending.active) return frame;
  const normalized = normalizePoint(point);
  const nextGate = frame.body.gates[frame.pending.order.length];
  const wrongOrder = frame.pending.wrongOrder || (
    nextGate && frame.body.gates.slice(frame.pending.order.length + 1).some((gate) => distance(normalized, gate) <= gate.radius * 1.55)
  );
  const order = [...frame.pending.order];
  if (nextGate && distance(normalized, nextGate) <= nextGate.radius * 1.55 && !wrongOrder) order.push(nextGate.id);
  return buildFrameFrom(frame.stage, frame.memory, 'stroke-tracing', {
    active: true,
    order,
    points: [...frame.pending.points.slice(-18), normalized],
    lastPoint: normalized,
    wrongOrder
  });
}

function commitFromPending(frame, pending, source = 'visitor-stroke') {
  const event = makeEvent(frame, pending.order, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'stroke-committed');
}

export function finishStroke(frame, point, source = 'visitor-stroke') {
  if (!frame.pending.active) return buildFrameFrom(frame.stage, frame.memory, 'stroke-refused-incomplete', frame.pending);
  const normalized = normalizePoint(point);
  const finalGate = frame.body.gates[2];
  const escaped = distance(normalized, finalGate) > finalGate.radius * 1.18 && normalized.x > finalGate.x;
  if (frame.pending.wrongOrder) return buildFrameFrom(frame.stage, frame.memory, 'stroke-refused-order', { ...frame.pending, active: false, lastPoint: normalized });
  if (frame.pending.order.length < 3 || !escaped) return buildFrameFrom(frame.stage, frame.memory, 'stroke-refused-incomplete', { ...frame.pending, active: false, lastPoint: normalized });
  return commitFromPending(frame, frame.pending, source);
}

export function applyStroke(frame, source = 'control-stroke') {
  return commitFromPending(frame, { order: [0, 1, 2] }, source);
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused', frame.pending);
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const timeline = [buildFrame()];
  for (let index = 1; index < stageCount; index += 1) {
    timeline.push(applyStroke(timeline.at(-1), 'timeline-stroke'));
  }
  return timeline;
}
