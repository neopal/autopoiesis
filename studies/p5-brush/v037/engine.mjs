export const MEMORY_LIMIT = 4;
export const STAGES = 13;
export const MIN_STROKE_LENGTH = 0.18;
export const MIN_STROKE_POINTS = 3;
export const MAX_STROKE_DURATION = 1600;

const SEED = 0x42523737;
const BODY_COUNT = 32;
const CHAMBER_COUNT = 18;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const CONTROL_STROKES = [
  [{ x: 0.25, y: 0.43 }, { x: 0.34, y: 0.45 }, { x: 0.44, y: 0.49 }, { x: 0.55, y: 0.54 }, { x: 0.65, y: 0.58 }],
  [{ x: 0.68, y: 0.32 }, { x: 0.61, y: 0.38 }, { x: 0.54, y: 0.47 }, { x: 0.46, y: 0.57 }, { x: 0.38, y: 0.68 }],
  [{ x: 0.19, y: 0.62 }, { x: 0.30, y: 0.59 }, { x: 0.42, y: 0.56 }, { x: 0.56, y: 0.53 }, { x: 0.72, y: 0.49 }],
  [{ x: 0.29, y: 0.29 }, { x: 0.39, y: 0.36 }, { x: 0.51, y: 0.41 }, { x: 0.63, y: 0.42 }, { x: 0.76, y: 0.38 }]
];

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, amount) => a + (b - a) * amount;

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0.05, 0.95)),
    y: round(clamp(Number(point.y) || 0, 0.10, 0.90))
  };
}

function normalizeStroke(points = []) {
  return points.slice(0, 18).map(normalizePoint);
}

function strokeLength(points) {
  return points.slice(1).reduce((total, point, index) => total + distance(point, points[index]), 0);
}

function segmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return distance(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

function distanceToStroke(point, stroke) {
  let nearest = Infinity;
  for (let index = 1; index < stroke.length; index += 1) nearest = Math.min(nearest, segmentDistance(point, stroke[index - 1], stroke[index]));
  return nearest;
}

function baseBody() {
  return Array.from({ length: BODY_COUNT }, (_, index) => {
    const angle = (index / BODY_COUNT) * Math.PI * 2;
    const wobble = (seeded(index, 1) - 0.5) * 0.045;
    const radiusX = 0.37 + Math.sin(angle * 3 + 0.4) * 0.028 + wobble;
    const radiusY = 0.30 + Math.cos(angle * 2 - 0.8) * 0.022 + wobble * 0.6;
    return {
      x: round(0.50 + Math.cos(angle) * radiusX),
      y: round(0.51 + Math.sin(angle) * radiusY),
      depth: 0,
      fold: 0
    };
  });
}

function baseChambers() {
  return Array.from({ length: CHAMBER_COUNT }, (_, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    return {
      id: index,
      x: round(0.22 + column * 0.115 + (seeded(index, 2) - 0.5) * 0.045),
      y: round(0.29 + row * 0.16 + (seeded(index, 3) - 0.5) * 0.050),
      rx: round(0.055 + seeded(index, 4) * 0.027),
      ry: round(0.040 + seeded(index, 5) * 0.024),
      tilt: round((seeded(index, 6) - 0.5) * 1.6),
      dent: 0,
      opening: 0,
      dry: 0
    };
  });
}

function normalizeEvent(event = {}) {
  return {
    source: event.source || 'unknown',
    local: true,
    duration: clamp(Number(event.duration) || 420, 1, MAX_STROKE_DURATION),
    path: normalizeStroke(event.path || []),
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED),
    length: round(Number(event.length) || strokeLength(event.path || []))
  };
}

function buildFrameFrom(stage, memory, interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  let body = baseBody();
  let chambers = baseChambers();
  const creases = [];
  let event = null;

  boundedMemory.forEach((stored, eventIndex) => {
    const stroke = stored.path;
    const center = stroke[Math.floor(stroke.length / 2)] || { x: 0.5, y: 0.5 };
    const sign = eventIndex % 2 === 0 ? 1 : -1;
    const localRadius = 0.145 + (stored.length * 0.06);

    chambers = chambers.map((chamber) => {
      const influence = clamp(1 - distanceToStroke(chamber, stroke) / localRadius, 0, 1);
      if (!influence) return chamber;
      const grain = 0.86 + seeded(chamber.id + eventIndex * 17, 9) * 0.22;
      return {
        ...chamber,
        x: round(clamp(chamber.x + (chamber.x - center.x) * influence * 0.018, 0.08, 0.92)),
        y: round(clamp(chamber.y + (chamber.y - center.y) * influence * 0.018, 0.14, 0.86)),
        rx: round(clamp(chamber.rx + influence * 0.012, 0.035, 0.12)),
        ry: round(clamp(chamber.ry + influence * 0.018, 0.025, 0.12)),
        tilt: round(chamber.tilt + sign * influence * 0.24),
        dent: round(clamp(chamber.dent + influence * 0.72 * grain, 0, 1.8)),
        opening: round(clamp(chamber.opening + influence * 0.98 * grain, 0, 1.8)),
        dry: round(clamp(chamber.dry + 0.26 + influence * 0.64, 0, 1.8))
      };
    });

    body = body.map((vertex, index) => {
      const distanceFromCenter = distance(vertex, center);
      const influence = clamp(1 - distanceFromCenter / 0.55, 0, 1) * (0.18 + (stored.length * 0.18));
      const tangent = stroke.length > 1 ? { x: stroke.at(-1).x - stroke[0].x, y: stroke.at(-1).y - stroke[0].y } : { x: 1, y: 0 };
      return {
        ...vertex,
        x: round(clamp(vertex.x + tangent.y * influence * 0.025, 0.05, 0.95)),
        y: round(clamp(vertex.y - tangent.x * influence * 0.025, 0.10, 0.90)),
        depth: round(vertex.depth + influence * 0.42),
        fold: round(vertex.fold + sign * influence * 0.32)
      };
    });

    creases.push({
      id: eventIndex,
      path: stroke,
      depth: round(0.48 + stored.duration / MAX_STROKE_DURATION * 0.34 + eventIndex * 0.06),
      width: round(0.012 + stored.length * 0.016),
      dry: round(0.42 + eventIndex * 0.16)
    });
    event = {
      ...stored,
      index: eventIndex,
      center,
      local: true,
      committed: true,
      priorCreaseCount: eventIndex,
      inheritedDryness: round(eventIndex * 0.42)
    };
  });

  return {
    grammar: 'crease-sheet',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body,
    chambers,
    creases,
    creaseCount: creases.length,
    openingCount: chambers.filter((chamber) => chamber.opening > 0.08).length,
    dryCount: chambers.filter((chamber) => chamber.dry > 0.12).length,
    event,
    drying: {
      phase: !event ? 'wet' : interaction === 'timeline' ? 'dry' : 'fresh',
      frontier: event?.path || [],
      age: event ? boundedMemory.length - 1 : 0
    },
    pending: { points: [], length: 0 },
    interaction,
    renderer: 'deterministic p5.js Canvas 2D crease sheet'
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function previewStroke(frame, points) {
  const normalized = normalizeStroke(points);
  const preview = buildFrameFrom(frame.stage, frame.memory, 'stroke-preview');
  return {
    ...preview,
    pending: {
      points: normalized,
      length: round(strokeLength(normalized))
    }
  };
}

export function applyStroke(frame, points, duration = 420, source = 'visitor-crease') {
  const normalized = normalizeStroke(points);
  const length = strokeLength(normalized);
  if (normalized.length < MIN_STROKE_POINTS || length < MIN_STROKE_LENGTH) return buildFrameFrom(frame.stage, frame.memory, 'stroke-refused-short');
  if (duration > MAX_STROKE_DURATION) return buildFrameFrom(frame.stage, frame.memory, 'stroke-refused-overheld');
  const event = {
    source,
    duration,
    path: normalized,
    length,
    field: hash(SEED + frame.memory.length * 7919 + Math.round(length * 1000))
  };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'crease-committed');
}

export function applyControlStroke(frame, index = 0) {
  return applyStroke(frame, CONTROL_STROKES[index % CONTROL_STROKES.length], 420, 'control-crease');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseMaterial() {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  let frame = buildFrame(0, []);
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % 3 === 0) frame = applyControlStroke(frame, stage / 3 - 1);
    const nextInteraction = frame.interaction === 'crease-committed' ? 'timeline' : frame.interaction;
    timeline.push({
      ...frame,
      stage,
      interaction: stage === 0 ? 'baseline' : nextInteraction,
      drying: {
        ...frame.drying,
        phase: stage === 0 ? 'wet' : nextInteraction === 'timeline' ? 'dry' : frame.drying.phase
      }
    });
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({ body: frame.body, chambers: frame.chambers, creases: frame.creases });
}
