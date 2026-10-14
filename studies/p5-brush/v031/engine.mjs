export const SEGMENT_COUNT = 18;
export const STAGES = 13;

const TAU = Math.PI * 2;
const round = (value) => Number(value.toFixed(5));
const hash = (value) => {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
};
const seeded = (index, salt) => (hash(0x42525531 + index * 997 + salt * 317) >>> 0) / 4294967296;

function baselineSegment(index) {
  const angle = -Math.PI / 2 + (index / SEGMENT_COUNT) * TAU;
  return {
    id: index,
    angle: round(angle),
    radius: round(1 + (seeded(index, 1) - 0.5) * 0.12),
    width: round(0.078 + seeded(index, 2) * 0.034),
    points: []
  };
}

function pointAt(segment, offset = 0) {
  const angle = segment.angle + offset;
  return {
    x: 0.5 + Math.cos(angle) * 0.32 * segment.radius,
    y: 0.5 + Math.sin(angle) * 0.36 * segment.radius
  };
}

function segmentPoints(segment, next) {
  const a = pointAt(segment);
  const b = pointAt(next);
  const radialA = { x: Math.cos(segment.angle), y: Math.sin(segment.angle) };
  const radialB = { x: Math.cos(next.angle), y: Math.sin(next.angle) };
  const outerWidth = segment.width;
  const innerWidth = segment.width * 0.52;
  return [
    { x: a.x + radialA.x * outerWidth, y: a.y + radialA.y * outerWidth },
    { x: b.x + radialB.x * outerWidth, y: b.y + radialB.y * outerWidth },
    { x: b.x - radialB.x * innerWidth, y: b.y - radialB.y * innerWidth },
    { x: a.x - radialA.x * innerWidth, y: a.y - radialA.y * innerWidth }
  ].map((point) => ({ x: round(point.x), y: round(point.y) }));
}

const polygonPath = (points) => `${points.map((point, index) => `${index ? 'L' : 'M'} ${round(point.x * 1000)} ${round(point.y * 700)}`).join(' ')} Z`;

export const MEMORY_LIMIT = 4;
export const MIN_STROKE_MS = 140;
export const MAX_STROKE_MS = 1100;
export const MIN_TRAVEL = 0.08;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function normalizePoint(point, fallback = 0.5) {
  return {
    x: round(clamp(Number(point?.x) || fallback, 0.06, 0.94)),
    y: round(clamp(Number(point?.y) || fallback, 0.08, 0.92))
  };
}

function normalizeStroke(stroke) {
  const start = normalizePoint(stroke?.start);
  const end = normalizePoint(stroke?.end, start.x);
  return { start, end, duration: Math.round(clamp(Number(stroke?.duration) || 0, 0, 5000)) };
}

function strokeKey(stroke) {
  const normalized = normalizeStroke(stroke);
  return `${normalized.start.x}:${normalized.start.y}>${normalized.end.x}:${normalized.end.y}@${normalized.duration}`;
}

function eventInfluence(stroke, eventIndex) {
  const normalized = normalizeStroke(stroke);
  const travel = Math.hypot(normalized.end.x - normalized.start.x, normalized.end.y - normalized.start.y);
  const field = hash(Math.round((normalized.start.x * 211 + normalized.end.y * 379 + normalized.duration * 0.031 + travel * 997) * 1000) + eventIndex * 1013 + 0x42525531);
  const entryIndex = field % SEGMENT_COUNT;
  const cutIndex = (entryIndex + 5 + (field % 5)) % SEGMENT_COUNT;
  const swellIndex = (cutIndex + 6 + eventIndex) % SEGMENT_COUNT;
  const scarIndex = (cutIndex + 11 + eventIndex) % SEGMENT_COUNT;
  const energy = clamp((normalized.duration - MIN_STROKE_MS) / (MAX_STROKE_MS - MIN_STROKE_MS), 0.08, 1) * clamp(travel / 0.36, 0.35, 1);
  return { entryIndex, cutIndex, swellIndex, scarIndex, energy: round(energy), travel: round(travel) };
}

function buildFrameFrom(stage, memory, interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map((stroke) => ({ kind: 'negative-stroke', ...normalizeStroke(stroke), source: stroke.source || 'unknown' }));
  const segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => baselineSegment(index));
  let lastStroke = null;
  boundedMemory.forEach((stroke, eventIndex) => {
    const influence = eventInfluence(stroke, eventIndex);
    const cut = segments[influence.cutIndex];
    const swell = segments[influence.swellIndex];
    const scar = segments[influence.scarIndex];
    cut.erosion = (cut.erosion || 0) + 0.8 + influence.energy * 0.75;
    cut.lean = (cut.lean || 0) - influence.energy * 0.035;
    swell.swelling = (swell.swelling || 0) + 0.55 + influence.energy * 0.8;
    swell.radius += 0.025 + influence.energy * 0.045;
    scar.scar = (scar.scar || 0) + 0.55 + influence.energy * 0.7;
    scar.lean = (scar.lean || 0) + (eventIndex % 2 ? -0.04 : 0.045);
    lastStroke = { ...stroke, ...influence };
  });
  segments.forEach((segment, index) => {
    segment.points = segmentPoints(segment, segments[(index + 1) % SEGMENT_COUNT]);
  });
  return {
    grammar: 'negative-ribbon',
    stage,
    memory: boundedMemory,
    strokes: boundedMemory,
    segments,
    segmentPaths: segments.map((segment) => polygonPath(segment.points)),
    erodedCount: segments.filter((segment) => segment.erosion > 0.01).length,
    swollenCount: segments.filter((segment) => segment.swelling > 0.01).length,
    scarredCount: segments.filter((segment) => segment.scar > 0.01).length,
    lastStroke,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function applyStroke(frame, stroke, source = 'pointer-stroke') {
  const normalized = normalizeStroke(stroke);
  const travel = Math.hypot(normalized.end.x - normalized.start.x, normalized.end.y - normalized.start.y);
  if (normalized.duration < MIN_STROKE_MS) return { ...frame, interaction: 'stroke-refused-weak' };
  if (normalized.duration > MAX_STROKE_MS) return { ...frame, interaction: 'stroke-refused-overheld' };
  if (travel < MIN_TRAVEL) return { ...frame, interaction: 'stroke-refused-still' };
  const previous = frame.memory.at(-1);
  if (previous && strokeKey(previous) === strokeKey(normalized)) return { ...frame, interaction: 'stroke-refused-repeat' };
  return buildFrameFrom(Math.min(12, frame.stage + 1), [...frame.memory, { ...normalized, source }], 'stroke-committed');
}

export function liftLatestStroke(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'stroke-lift-refused' };
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'stroke-lifted');
}

export function releaseStrokes(frame) {
  return buildFrameFrom(0, [], 'strokes-released');
}

export function buildTimeline(stageCount = 13) {
  const events = [
    { start: { x: 0.19, y: 0.72 }, end: { x: 0.41, y: 0.35 }, duration: 260 },
    { start: { x: 0.78, y: 0.31 }, end: { x: 0.53, y: 0.72 }, duration: 420 },
    { start: { x: 0.18, y: 0.28 }, end: { x: 0.45, y: 0.52 }, duration: 180 },
    { start: { x: 0.82, y: 0.66 }, end: { x: 0.57, y: 0.35 }, duration: 510 }
  ];
  let memory = [];
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % 3 === 0) memory = [...memory, { ...events[(stage / 3 - 1) % events.length], source: 'timeline' }].slice(-MEMORY_LIMIT);
    timeline.push(buildFrameFrom(stage, memory, stage === 0 ? 'baseline' : 'timeline'));
  }
  return timeline;
}

export function frameForMemory(memory) {
  return buildFrameFrom(memory.length, memory);
}

export { strokeKey };

export function geometrySignature(frame) {
  return JSON.stringify(frame.segments.map((segment) => ({ id: segment.id, points: segment.points, erosion: segment.erosion || 0, swelling: segment.swelling || 0, scar: segment.scar || 0 })));
}
