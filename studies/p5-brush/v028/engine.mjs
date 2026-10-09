const SEED = 0x42525548;
export const WOUND_COUNT = 9;
export const MEMORY_LIMIT = 4;
export const STAGES = 15;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fract = (value) => value - Math.floor(value);

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

function noise(index, salt = 0) {
  return fract(hash(SEED + index * 977 + salt * 313) / 4294967296);
}

function number(value) {
  return Number(value.toFixed(5));
}

function pointKey(point) {
  return `${number(point.x)}:${number(point.y)}`;
}

function gestureKey(gesture) {
  return `${gesture.points.map(pointKey).join('|')}@${number(gesture.pressure ?? 0.5)}`;
}

function cloneGesture(gesture) {
  return {
    points: gesture.points.map((point) => ({ x: number(point.x), y: number(point.y) })),
    pressure: number(gesture.pressure ?? 0.5),
    ...(gesture.kind ? { kind: gesture.kind } : {}),
    ...(gesture.source ? { source: gesture.source } : {})
  };
}

function baselineWound(index) {
  return {
    index,
    x: number(0.5 + (noise(index, 4) - 0.5) * 0.16),
    y: number(0.18 + index * 0.078 + (noise(index, 7) - 0.5) * 0.04),
    rx: number(0.052 + noise(index, 11) * 0.022),
    ry: number(0.022 + noise(index, 13) * 0.013),
    rotation: number((noise(index, 17) - 0.5) * 0.9),
    seal: 0,
    open: 0,
    pressure: 0
  };
}

function eventInfluence(event, eventIndex) {
  const points = event.points ?? [];
  const first = points[0] ?? { x: 0.5, y: 0.5 };
  const last = points.at(-1) ?? first;
  const travel = points.reduce((sum, point, index) => {
    const prior = points[index - 1] ?? point;
    return sum + Math.hypot(point.x - prior.x, point.y - prior.y);
  }, 0);
  const pressure = clamp(event.pressure ?? 0.5, 0.2, 1);
  const field = hash(Math.round((first.x * 97 + last.y * 193 + travel * 271 + pressure * 389) * 1000) + eventIndex * 1009 + SEED);
  const sealIndex = field % WOUND_COUNT;
  const offset = 2 + Math.floor(fract(field / 4294967296) * (WOUND_COUNT - 3));
  const openIndex = (sealIndex + offset) % WOUND_COUNT;
  return { sealIndex, openIndex, pressure, travel: clamp(travel, 0.02, 1.8) };
}

function materialField(memory) {
  const wounds = Array.from({ length: WOUND_COUNT }, (_, index) => baselineWound(index));
  memory.forEach((event, eventIndex) => {
    const influence = eventInfluence(event, eventIndex);
    const closure = 0.48 + influence.pressure * 0.42;
    const opening = 0.38 + influence.travel * 0.23 + influence.pressure * 0.18;
    wounds[influence.sealIndex].seal = clamp(wounds[influence.sealIndex].seal + closure, 0, 1);
    wounds[influence.sealIndex].pressure = influence.pressure;
    wounds[influence.openIndex].open = clamp(wounds[influence.openIndex].open + opening, 0, 1.15);
    wounds[influence.openIndex].pressure = Math.max(wounds[influence.openIndex].pressure, influence.pressure * 0.62);
    const relay = (influence.openIndex + 3 + eventIndex) % WOUND_COUNT;
    wounds[relay].y = number(wounds[relay].y + 0.006 * (eventIndex + 1) * (0.5 + influence.pressure));
  });
  wounds.forEach((wound) => { wound.points = woundPoints(wound); });
  return wounds;
}

function polarPoint(cx, cy, rx, ry, angle, index, salt, wobble = 0.06) {
  const modulation = 1 + (noise(index, salt) - 0.5) * wobble;
  return {
    x: clamp(cx + Math.cos(angle) * rx * modulation, 0.015, 0.985),
    y: clamp(cy + Math.sin(angle) * ry * modulation, 0.015, 0.985)
  };
}

function polygonPath(points) {
  return `${points.map((point, index) => `${index ? 'L' : 'M'} ${number(point.x * 1000)} ${number(point.y * 620)}`).join(' ')} Z`;
}

function outerPoints(index, wound) {
  const centerY = 0.12 + index * 0.086 + (index % 2 ? 0.012 : -0.006);
  const centerX = 0.5 + Math.sin(index * 1.31) * 0.035;
  const rx = 0.42 - index * 0.011;
  const ry = 0.105 - index * 0.0025;
  const count = 26;
  return Array.from({ length: count }, (_, pointIndex) => {
    const angle = (pointIndex / count) * TAU;
    const breathing = Math.sin(angle * 3 + index * 0.7) * 0.012;
    const memoryShift = (wound.open - wound.seal) * 0.025 * Math.sin(angle + index);
    return polarPoint(centerX + memoryShift, centerY + (wound.open - wound.seal) * 0.006, rx + breathing, ry, angle, index * 31 + pointIndex, 23 + pointIndex, 0.11);
  });
}

function woundPoints(wound) {
  const closure = wound.seal * 0.7;
  const expansion = wound.open * 0.82;
  const rx = wound.rx * clamp(1 - closure + expansion, 0.22, 2.1);
  const ry = wound.ry * clamp(1 - closure * 0.88 + expansion * 1.06, 0.18, 2.2);
  const count = 14;
  return Array.from({ length: count }, (_, pointIndex) => {
    const angle = wound.rotation + (pointIndex / count) * TAU;
    const tooth = 1 + Math.sin(angle * 4 + wound.index) * 0.1;
    return polarPoint(wound.x, wound.y, rx * tooth, ry * tooth, angle, wound.index * 41 + pointIndex, 29 + pointIndex, 0.15);
  });
}

function compoundPath(index, wound) {
  const outer = polygonPath(outerPoints(index, wound));
  const hole = polygonPath(woundPoints(wound));
  return `${outer} ${hole}`;
}

export function buildFrame(stage, memory) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(cloneGesture);
  const wounds = materialField(boundedMemory);
  const paths = wounds.map((wound, index) => compoundPath(index, wound));
  const sealedCount = wounds.filter((wound) => wound.seal > 0.01).length;
  const openedCount = wounds.filter((wound) => wound.open > 0.01).length;
  return {
    grammar: 'mending-reservoir',
    stage,
    memory: boundedMemory,
    wounds,
    paths,
    reservoirPath: polygonPath([
      { x: 0.07, y: 0.08 }, { x: 0.93, y: 0.08 }, { x: 0.96, y: 0.89 },
      { x: 0.73, y: 0.94 }, { x: 0.5, y: 0.9 }, { x: 0.22, y: 0.95 }, { x: 0.05, y: 0.86 }
    ]),
    sealedCount,
    openedCount,
    interaction: 'idle',
    lastMend: boundedMemory.at(-1) ?? null,
    signature: ''
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({ paths: frame.paths, wounds: frame.wounds.map((wound) => [number(wound.seal), number(wound.open), number(wound.y)]) });
}

function withSignature(frame) {
  return { ...frame, signature: geometrySignature(frame) };
}

export function applyMend(frame, gesture, source = 'pointer-mend') {
  const nextGesture = cloneGesture(gesture);
  nextGesture.kind = 'paint-mend';
  nextGesture.source = source;
  const prior = frame.memory.at(-1);
  if (prior && gestureKey(prior) === gestureKey(nextGesture)) {
    return withSignature({ ...frame, interaction: 'mend-refused', lastMend: prior });
  }
  const memory = [...frame.memory, nextGesture].slice(-MEMORY_LIMIT);
  const next = buildFrame(Math.min(STAGES - 1, frame.stage + 1), memory);
  return withSignature({ ...next, interaction: 'mend-committed', lastMend: { ...nextGesture, source } });
}

export function liftLatestMend(frame) {
  if (!frame.memory.length) return withSignature({ ...frame, interaction: 'mend-lift-refused' });
  const memory = frame.memory.slice(0, -1);
  return withSignature({ ...buildFrame(Math.max(0, frame.stage - 1), memory), interaction: 'mend-lifted' });
}

export function releaseMends(frame) {
  return withSignature({ ...buildFrame(0, []), interaction: 'mends-released' });
}

function timelineGesture(index) {
  const direction = index % 2 ? -1 : 1;
  return {
    points: [
      { x: number(0.17 + (index % 5) * 0.13), y: number(0.76 - (index % 3) * 0.11) },
      { x: number(0.5 + direction * 0.17), y: number(0.48 + (index % 4) * 0.06) },
      { x: number(0.82 - (index % 4) * 0.12), y: number(0.28 + (index % 5) * 0.08) }
    ],
    pressure: number(0.35 + (index % 6) * 0.1)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let frame = withSignature(buildFrame(0, []));
  for (let stage = 1; stage < stageCount; stage += 1) {
    frame = applyMend(frame, timelineGesture(stage - 1), 'timeline');
  }
  return Array.from({ length: stageCount }, (_, index) => {
    let replay = withSignature(buildFrame(0, []));
    for (let eventIndex = 0; eventIndex < index; eventIndex += 1) replay = applyMend(replay, timelineGesture(eventIndex), 'timeline');
    return replay;
  });
}

export function frameForMemory(memory) {
  return withSignature(buildFrame(memory.length, memory));
}

export { gestureKey };
