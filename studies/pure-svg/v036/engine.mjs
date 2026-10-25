const BASE_SEED = 0x53564736;
export const FILAMENT_COUNT = 7;
export const MEMORY_WINDOW = 4;
export const MIN_STROKE_POINTS = 3;
export const MAX_STROKE_POINTS = 24;
export const MIN_STROKE_LENGTH = 0.12;
export const MAX_STROKE_LENGTH = 0.78;

const FILAMENT_LAYOUT = [
  { anchor: 0.12, offset: -0.22, reach: 0.20, phase: 0.08 },
  { anchor: 0.25, offset: -0.10, reach: 0.25, phase: 0.21 },
  { anchor: 0.37, offset: 0.16, reach: 0.18, phase: 0.36 },
  { anchor: 0.49, offset: -0.18, reach: 0.28, phase: 0.51 },
  { anchor: 0.62, offset: 0.12, reach: 0.24, phase: 0.67 },
  { anchor: 0.75, offset: -0.08, reach: 0.22, phase: 0.81 },
  { anchor: 0.88, offset: 0.18, reach: 0.16, phase: 0.95 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));

function pathFrom(points, close = false) {
  const path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  return close ? `${path} Z` : path;
}

function normalizedPoint(point) {
  return {
    x: clamp(Number(point?.x ?? 0.5), 0, 1),
    y: clamp(Number(point?.y ?? 0.5), 0, 1)
  };
}

function normalizePoints(points) {
  return Array.isArray(points) ? points.slice(0, MAX_STROKE_POINTS).map(normalizedPoint) : [];
}

function strokeMetrics(points) {
  let length = 0;
  let turn = 0;
  let previous = null;
  let previousVector = null;
  for (const point of points) {
    if (previous) {
      const vector = { x: point.x - previous.x, y: point.y - previous.y };
      const segment = Math.hypot(vector.x, vector.y);
      length += segment;
      if (previousVector && segment > 0.0001) {
        turn += Math.atan2(previousVector.x * vector.y - previousVector.y * vector.x, previousVector.x * vector.x + previousVector.y * vector.y);
      }
      if (segment > 0.0001) previousVector = vector;
    }
    previous = point;
  }
  const first = points[0] ?? { x: 0.5, y: 0.5 };
  const last = points.at(-1) ?? first;
  return {
    length,
    turn,
    dx: last.x - first.x,
    dy: last.y - first.y,
    heading: Math.atan2(last.y - first.y, last.x - first.x)
  };
}

function spinePath(state) {
  const points = [];
  for (let index = 0; index < 17; index += 1) {
    const t = index / 16;
    const x = 110 + t * 780 + Math.sin(t * Math.PI * 2 + state.sway) * 18 + state.reach * (t - 0.5) * 42;
    const y = 405 + Math.sin(t * Math.PI * 1.45 + state.curl) * 78 + Math.cos(t * Math.PI * 3.1 + state.sway) * 23 + state.curl * (t - 0.5) * 44;
    points.push([x, y]);
  }
  return pathFrom(points);
}

function filamentPath(filament, state) {
  const local = FILAMENT_LAYOUT[filament.id];
  const startX = local.anchor * 1000;
  const startY = 405 + local.offset * 240;
  const reach = (local.reach + filament.reach + state.reach * (filament.id % 2 ? -0.4 : 0.5)) * 1000;
  const bend = (local.offset * 140) + filament.bend * 85 + Math.sin(local.phase * 19 + state.sway) * 22;
  const direction = filament.id % 2 ? -1 : 1;
  const points = [
    [startX, startY],
    [clamp(startX + reach * 0.24, 24, 976), startY + bend * 0.35 + filament.lift * 40],
    [clamp(startX + reach * 0.56, 24, 976), startY - bend * 0.62 + filament.lift * 72],
    [clamp(startX + reach, 24, 976), startY + bend * 0.18 + direction * state.curl * 34]
  ];
  return pathFrom(points);
}

function baseFilament(index) {
  const source = FILAMENT_LAYOUT[index];
  return {
    id: index,
    anchor: source.anchor,
    offset: source.offset,
    reach: source.reach,
    phase: source.phase,
    bend: 0,
    lift: 0,
    thickness: 1,
    role: 'quiet',
    pathSignature: ''
  };
}

function baseState() {
  return { sway: 0, curl: 0, reach: 0, growth: 0 };
}

function applyEvent(filaments, state, event) {
  filaments.forEach((filament) => { filament.role = 'quiet'; });
  const source = filaments[event.sourceFilament];
  const remote = filaments[event.remoteFilament];
  const counter = filaments[event.counterFilament];
  const direction = event.direction;

  source.bend += event.turn * 0.72;
  source.reach = clamp(source.reach - 0.035, 0.08, 0.42);
  source.thickness = clamp(source.thickness + 0.18, 1, 2.2);
  source.role = 'absorbed';

  remote.reach = clamp(remote.reach + 0.1 + event.length * 0.08, 0.08, 0.52);
  remote.bend += direction * (0.42 + event.index * 0.12);
  remote.lift += event.turn * 0.32;
  remote.role = 'grown';

  counter.bend -= direction * (0.32 + event.index * 0.08);
  counter.lift += direction * 0.28;
  counter.thickness = clamp(counter.thickness + 0.12, 1, 2.2);
  counter.role = 'unthreaded';

  state.sway += direction * 0.22 + event.turn * 0.14;
  state.curl += event.turn * 0.32 + direction * 0.12;
  state.reach += direction * 0.26;
  state.growth += 1;
}

function materialState(memory) {
  const filaments = FILAMENT_LAYOUT.map((_, index) => baseFilament(index));
  const state = baseState();
  for (const event of memory) applyEvent(filaments, state, event);
  return { filaments, state };
}

function frameFrom(stage, memory, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const { filaments, state } = materialState(safeMemory);
  const frame = {
    grammar: 'field-grown-filament',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    filaments,
    state,
    spinePath: spinePath(state),
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
  for (const filament of frame.filaments) filament.pathSignature = filamentPath(filament, frame.state);
  frame.signature = geometrySignature(frame);
  return frame;
}

function nearestFilament(filaments, point) {
  const x = clamp(Number(point?.x ?? 0.5), 0, 1);
  let winner = 0;
  let score = Infinity;
  for (const filament of filaments) {
    const distance = Math.abs(filament.anchor - x);
    if (distance < score) {
      score = distance;
      winner = filament.id;
    }
  }
  return winner;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null);
}

export function geometrySignature(frame) {
  return `${frame.spinePath}||${frame.filaments.map((filament) => `${filament.id}:${filament.role}:${filament.pathSignature || filamentPath(filament, frame.state)}`).join('||')}`;
}

export function applyStroke(frame, rawStroke) {
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'growth-memory-full', { committed: false, reason: 'memory-full' });
  }
  const points = normalizePoints(rawStroke?.points);
  if (points.length < MIN_STROKE_POINTS) {
    return frameFrom(frame.stage, frame.memory, 'stroke-refused-short', { committed: false, reason: 'too-few-points', pointCount: points.length });
  }
  const metrics = strokeMetrics(points);
  if (metrics.length < MIN_STROKE_LENGTH) {
    return frameFrom(frame.stage, frame.memory, 'stroke-refused-short', { committed: false, reason: 'short-stroke', length: Number(metrics.length.toFixed(3)) });
  }
  if (metrics.length > MAX_STROKE_LENGTH) {
    return frameFrom(frame.stage, frame.memory, 'stroke-refused-sprawling', { committed: false, reason: 'sprawling-stroke', length: Number(metrics.length.toFixed(3)) });
  }
  const sourceFilament = nearestFilament(frame.filaments, points[0]);
  const remoteFilament = wrap(sourceFilament + 3 + frame.memory.length, FILAMENT_COUNT);
  const counterFilament = wrap(sourceFilament + 5 + (frame.memory.length % 2), FILAMENT_COUNT);
  const event = {
    committed: true,
    type: 'material-stroke',
    index: frame.memory.length,
    pointCount: points.length,
    length: Number(metrics.length.toFixed(3)),
    turn: Number(metrics.turn.toFixed(3)),
    heading: Number(metrics.heading.toFixed(3)),
    direction: metrics.dx >= 0 ? 1 : -1,
    sourceFilament,
    remoteFilament,
    counterFilament
  };
  return frameFrom(frame.stage + 1, [...frame.memory, event], 'stroke-grown', event);
}

export function liftLatestStroke(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false });
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'stroke-lifted', { committed: false, lifted: true });
}

export function releaseGrowth() {
  return frameFrom(0, [], 'released', { committed: false, released: true });
}

export function buildTimeline() {
  const strokes = [
    { points: [{ x: 0.12, y: 0.7 }, { x: 0.23, y: 0.62 }, { x: 0.34, y: 0.5 }] },
    { points: [{ x: 0.38, y: 0.28 }, { x: 0.47, y: 0.36 }, { x: 0.59, y: 0.52 }, { x: 0.68, y: 0.6 }] },
    { points: [{ x: 0.72, y: 0.72 }, { x: 0.78, y: 0.58 }, { x: 0.86, y: 0.46 }] },
    { points: [{ x: 0.48, y: 0.74 }, { x: 0.39, y: 0.62 }, { x: 0.31, y: 0.48 }] }
  ];
  let frame = buildFrame();
  const frames = [frame];
  for (const stroke of strokes) {
    frame = applyStroke(frame, stroke);
    frames.push(frame);
  }
  return frames;
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'field-grown-filament',
  rule: 'a drawn path becomes a material field that grows one remote filament and unthreads another without copying the gesture',
  memoryWindow: MEMORY_WINDOW
};
