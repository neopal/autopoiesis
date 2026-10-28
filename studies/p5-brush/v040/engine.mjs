export const MEMORY_LIMIT = 4;
export const STAGES = 13;
export const FRAGMENT_COUNT = 13;

const SEED = 0x42523430;
const BASE_POSITIONS = [
  [0.24, 0.16, 0.16, 0.11, -17, 0.82],
  [0.49, 0.11, 0.19, 0.13, 9, 0.74],
  [0.76, 0.18, 0.17, 0.12, 24, 0.91],
  [0.14, 0.37, 0.17, 0.12, 16, 0.66],
  [0.34, 0.30, 0.22, 0.14, -11, 0.88],
  [0.48, 0.42, 0.20, 0.15, 21, 0.79],
  [0.68, 0.32, 0.18, 0.12, -23, 0.69],
  [0.87, 0.46, 0.16, 0.13, 8, 0.94],
  [0.22, 0.58, 0.21, 0.14, -29, 0.77],
  [0.47, 0.63, 0.18, 0.13, 12, 0.85],
  [0.72, 0.59, 0.21, 0.16, -8, 0.71],
  [0.36, 0.80, 0.20, 0.12, 19, 0.89],
  [0.67, 0.79, 0.18, 0.13, -15, 0.68]
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(5));
const clampIndex = (value, count) => ((Math.floor(Number(value) || 0) % count) + count) % count;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function normalizePoint(point = {}) {
  return { x: round(clamp(Number(point.x) || 0, 0.02, 0.98)), y: round(clamp(Number(point.y) || 0, 0.02, 0.98)) };
}

function normalizeEvent(event = {}) {
  return {
    source: event.source || 'unknown',
    fragment: clampIndex(event.fragment, FRAGMENT_COUNT),
    start: normalizePoint(event.start),
    exit: normalizePoint(event.exit),
    pressure: Number.isFinite(event.pressure) ? round(clamp(event.pressure, 0.42, 1.1)) : 0.78,
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + Number(event.fragment || 0) * 83)
  };
}

function baseFragments() {
  return BASE_POSITIONS.map(([x, y, width, height, angle, mass], id) => ({
    id,
    x,
    y,
    width,
    height,
    angle,
    mass,
    tone: (id * 3 + 1) % 6,
    removed: false,
    settle: 0,
    slide: 0,
    dry: 0,
    notch: round(0.08 + seeded(id, 3) * 0.17)
  }));
}

function settledFragments(memory) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  const fragments = baseFragments();
  const removed = new Set(boundedMemory.map((event) => event.fragment));

  for (const fragment of fragments) {
    let settle = 0;
    let slide = 0;
    let tilt = 0;
    let dry = 0;
    for (let eventIndex = 0; eventIndex < boundedMemory.length; eventIndex += 1) {
      const event = boundedMemory[eventIndex];
      const source = BASE_POSITIONS[event.fragment];
      const vertical = fragment.y - source[1];
      const horizontal = fragment.x - source[0];
      const proximity = clamp(1 - Math.abs(horizontal) / 0.48, 0, 1);
      const localForce = (0.022 + event.pressure * 0.022) * proximity;
      if (fragment.id !== event.fragment && vertical > -0.04) {
        settle += localForce * (0.68 + fragment.mass * 0.32);
        slide += Math.sign(horizontal || (fragment.id % 2 ? 1 : -1)) * localForce * 0.34;
        tilt += Math.sign(horizontal || 1) * (eventIndex % 2 ? -1 : 1) * localForce * 38;
      } else if (fragment.id !== event.fragment) {
        tilt += (eventIndex % 2 ? -1 : 1) * proximity * event.pressure * 1.9;
      }
      dry += proximity * event.pressure * 0.16;
    }
    fragment.removed = removed.has(fragment.id);
    fragment.settle = round(clamp(settle, 0, 0.22));
    fragment.slide = round(clamp(slide, -0.12, 0.12));
    fragment.dry = round(clamp(dry, 0, 0.82));
    fragment.x = round(clamp(fragment.x + fragment.slide, 0.06, 0.94));
    fragment.y = round(clamp(fragment.y + fragment.settle, 0.06, 0.94));
    fragment.angle = round(fragment.angle + tilt);
    if (fragment.removed) {
      fragment.settle = 0;
      fragment.slide = 0;
      fragment.dry = round(clamp(fragment.dry + 0.26, 0, 1));
    }
  }
  return fragments;
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  const fragments = settledFragments(boundedMemory);
  const event = boundedMemory.length ? { ...boundedMemory.at(-1), type: 'lifted-absence', committed: true, index: boundedMemory.length - 1 } : null;
  return {
    grammar: 'settling-archive',
    renderer: 'deterministic p5.js Canvas 2D settling archive',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    fragments,
    removed: fragments.filter((fragment) => fragment.removed).map((fragment) => fragment.id),
    removedCount: fragments.filter((fragment) => fragment.removed).length,
    event,
    pending: {
      start: pending.start ? normalizePoint(pending.start) : null,
      exit: pending.exit ? normalizePoint(pending.exit) : null,
      fragment: Number.isInteger(pending.fragment) ? pending.fragment : null
    },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

function nearestAvailable(frame, point) {
  return frame.fragments.reduce((best, fragment) => {
    if (fragment.removed) return best;
    const score = distance(fragment, point);
    return score < best.score ? { id: fragment.id, score } : best;
  }, { id: null, score: Infinity });
}

export function previewLift(frame, start, exit) {
  const normalizedStart = normalizePoint(start);
  const normalizedExit = normalizePoint(exit);
  const nearest = nearestAvailable(frame, normalizedStart);
  return buildFrameFrom(frame.stage, frame.memory, 'lift-preview', {
    start: normalizedStart,
    exit: normalizedExit,
    fragment: nearest.score <= 0.15 ? nearest.id : null
  });
}

export function commitLift(frame, start, exit, source = 'visitor-upward-lift') {
  const normalizedStart = normalizePoint(start);
  const normalizedExit = normalizePoint(exit);
  const nearest = nearestAvailable(frame, normalizedStart);
  if (nearest.id === null || nearest.score > 0.15) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused-miss', { start: normalizedStart, exit: normalizedExit });
  if (normalizedStart.y - normalizedExit.y < 0.14) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused-direction', { start: normalizedStart, exit: normalizedExit, fragment: nearest.id });
  return applyLift(frame, nearest.id, source, normalizedStart, normalizedExit);
}

export function applyLift(frame, fragmentIndex, source = 'control-lift', start = null, exit = null) {
  const fragment = clampIndex(fragmentIndex, FRAGMENT_COUNT);
  if (frame.memory.some((event) => event.fragment === fragment)) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused-spent');
  const origin = start || { x: BASE_POSITIONS[fragment][0], y: BASE_POSITIONS[fragment][1] };
  const destination = exit || { x: origin.x, y: clamp(origin.y - 0.28, 0.02, 0.98) };
  const pressure = clamp(0.62 + (origin.y - destination.y) * 0.7 + BASE_POSITIONS[fragment][5] * 0.12, 0.42, 1.1);
  const event = { source, fragment, start: origin, exit: destination, pressure, field: hash(SEED + frame.memory.length * 7919 + fragment * 83) };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'absence-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const targets = [5, 9, 3, 10];
  let frame = buildFrame(0, []);
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    if (stage % 3 === 0) frame = applyLift(frame, targets[(stage / 3) - 1], 'timeline-lift');
    else frame = buildFrameFrom(stage, frame.memory, 'timeline');
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({ fragments: frame.fragments.map(({ id, x, y, width, height, angle, removed, settle, slide, dry }) => ({ id, x, y, width, height, angle, removed, settle, slide, dry })) });
}
