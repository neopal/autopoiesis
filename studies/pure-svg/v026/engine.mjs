export const SEED = 0x53564726;
export const STAGES = 14;
export const FRAGMENT_COUNT = 17;
export const PRIMITIVE_BUDGET = FRAGMENT_COUNT;
export const MEMORY_LIMIT = 4;
export const DEPARTURE_THRESHOLD = 'attend-then-depart';

const BASE_CENTRES = [
  [176, 142], [318, 112], [476, 178], [648, 116], [824, 196],
  [128, 296], [294, 268], [456, 338], [634, 286], [842, 352],
  [188, 468], [356, 432], [532, 504], [716, 446], [888, 520],
  [462, 612], [672, 602]
];
const RADII = [34, 28, 38, 30, 42, 31, 46, 35, 29, 44, 36, 32, 47, 34, 39, 43, 30];
const SIDES = [6, 5, 7, 6, 8, 5, 7, 6, 5, 8, 6, 7, 5, 8, 6, 7, 5];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function safeFragment(index) {
  const numeric = Number.isFinite(Number(index)) ? Math.floor(Number(index)) : 0;
  return ((numeric % FRAGMENT_COUNT) + FRAGMENT_COUNT) % FRAGMENT_COUNT;
}

function boundedStage(stage) {
  return clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
}

function copyMemory(memory) {
  return memory.map((event) => ({ ...event }));
}

function pointSignature([x, y]) {
  return `${Number(x).toFixed(3)},${Number(y).toFixed(3)}`;
}

function pointsSignature(points) {
  return points.map(pointSignature).join('|');
}

function basePoints(index, stage) {
  const [cx, cy] = BASE_CENTRES[index];
  const sides = SIDES[index];
  const radius = RADII[index];
  const phase = index * 0.71 + boundedStage(stage) * 0.045;
  return Array.from({ length: sides }, (_, vertex) => {
    const angle = phase + (Math.PI * 2 * vertex) / sides;
    const wobble = 0.82 + (((index * 13 + vertex * 7 + boundedStage(stage)) % 9) / 30);
    return [
      Number((cx + Math.cos(angle) * radius * wobble).toFixed(3)),
      Number((cy + Math.sin(angle) * radius * wobble).toFixed(3))
    ];
  });
}

function transformPoints(points, cx, cy, scale, dx, dy, rotation) {
  return points.map(([x, y], vertex) => {
    const angle = Math.atan2(y - cy, x - cx) + rotation;
    const distance = Math.hypot(x - cx, y - cy) * scale;
    const micro = 1 + Math.sin(vertex * 1.7 + rotation * 9) * 0.025;
    return [
      Number((cx + Math.cos(angle) * distance * micro + dx).toFixed(3)),
      Number((cy + Math.sin(angle) * distance * micro + dy).toFixed(3))
    ];
  });
}

function tileRole(memory, index) {
  const latest = memory.at(-1);
  if (!latest) return 'quiet';
  if (latest.source === index) return 'withdrawn';
  if (latest.relay === index) return 'overheard';
  if (latest.echo === index) return 'echoed';
  return 'quiet';
}

function materializeTile(index, stage, memory) {
  const [cx, cy] = BASE_CENTRES[index];
  let scale = 1;
  let dx = 0;
  let dy = 0;
  let rotation = 0;

  for (const [memoryIndex, event] of memory.entries()) {
    const direction = memoryIndex % 2 === 0 ? 1 : -1;
    if (event.source === index) {
      scale *= 0.56;
      dx += direction * -13;
      dy += direction * 9;
      rotation += direction * 0.16;
    }
    if (event.relay === index) {
      scale *= 1.34;
      dx += direction * 17;
      dy += direction * -11;
      rotation -= direction * 0.11;
    }
    if (event.echo === index) {
      scale *= 0.79;
      dx += direction * 8;
      dy += direction * 12;
      rotation += direction * 0.08;
    }
  }

  const points = transformPoints(basePoints(index, stage), cx, cy, scale, dx, dy, rotation);
  return {
    index,
    centre: [Number((cx + dx).toFixed(3)), Number((cy + dy).toFixed(3))],
    points,
    pathSignature: pointsSignature(points),
    sides: points.length,
    role: tileRole(memory, index)
  };
}

function eventFor(stage, memory, source, origin = 'visitor-departure') {
  const safeSource = safeFragment(source);
  let relay = safeFragment(safeSource * 7 + boundedStage(stage) + memory.length * 5 + 3);
  while (relay === safeSource) relay = safeFragment(relay + 1);
  let echo = safeFragment(relay + safeSource + memory.length * 3 + 5);
  while (echo === safeSource || echo === relay) echo = safeFragment(echo + 1);
  return {
    kind: 'attention-absence',
    mode: 'remote-echo',
    gesture: DEPARTURE_THRESHOLD,
    origin,
    stage: boundedStage(stage),
    source: safeSource,
    relay,
    echo,
    force: Number((1 + ((boundedStage(stage) + memory.length) % 5) * 0.08).toFixed(4)),
    ordinal: memory.length
  };
}

export function buildFrame(stage, memory = [], armed = null) {
  const safeStage = boundedStage(stage);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const tiles = Array.from({ length: FRAGMENT_COUNT }, (_, index) => materializeTile(index, safeStage, inherited));
  const frame = {
    stage: safeStage,
    grammar: 'discrete-choir',
    tiles,
    memory: inherited,
    absenceCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET,
    armed: Number.isInteger(armed) ? safeFragment(armed) : null,
    interaction: 'quiet'
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    if (stage > 0 && stage % 3 === 0) {
      memory = [...memory, eventFor(stage, memory, (stage * 3) % FRAGMENT_COUNT, 'timeline-departure')].slice(-MEMORY_LIMIT);
    }
    return buildFrame(stage, memory);
  });
}

export function attendFragment(frame, requestedFragment) {
  return {
    ...frame,
    armed: safeFragment(requestedFragment),
    interaction: 'attend-only',
    signature: geometrySignature(frame)
  };
}

export function applyDeparture(frame, requestedSource) {
  const source = Number.isInteger(frame.armed) ? frame.armed : safeFragment(requestedSource);
  if (frame.memory.length >= MEMORY_LIMIT) {
    return {
      ...frame,
      departure: {
        gesture: DEPARTURE_THRESHOLD,
        mode: 'remote-echo',
        source,
        relay: null,
        echo: null,
        committed: false,
        origin: 'visitor-departure'
      },
      interaction: 'absence-memory-full',
      signature: geometrySignature(frame)
    };
  }
  const event = eventFor(frame.stage, frame.memory, source);
  const next = buildFrame(frame.stage, [...frame.memory, event], null);
  return {
    ...next,
    departure: { ...event, committed: true },
    priorMemory: copyMemory(frame.memory),
    interaction: 'remote-echo'
  };
}

export function liftLatestDeparture(frame) {
  return buildFrame(frame.stage, frame.memory.slice(0, -1), null);
}

export function releaseChoir() {
  return buildFrame(0, [], null);
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    tiles: frame.tiles.map((tile) => tile.pathSignature),
    memory: frame.memory
  });
}
