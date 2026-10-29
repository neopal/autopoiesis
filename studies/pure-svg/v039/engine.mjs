const BASE_SEED = 0x53564739;
export const MEMORY_WINDOW = 4;
export const MIN_SWEEP = 0.18;
export const MAX_SWEEP = 0.96;
export const GATE_COUNT = 6;
export const CONTOUR_COUNT = 1;

const SEGMENT_COUNT = 28;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixed(value) {
  return Number(value).toFixed(2);
}

function normalizedPoint(point) {
  return {
    x: clamp(Number(point?.x ?? 0.5), 0, 1),
    y: clamp(Number(point?.y ?? 0.5), 0, 1)
  };
}

function normalizeSweep(raw) {
  const points = Array.isArray(raw?.points)
    ? raw.points.map(normalizedPoint)
    : [normalizedPoint(raw?.start), normalizedPoint(raw?.end)];
  return { points, start: points[0], end: points.at(-1) };
}

function sweepMetrics(sweep) {
  const dx = sweep.end.x - sweep.start.x;
  const dy = sweep.end.y - sweep.start.y;
  const separation = Math.hypot(dx, dy);
  let pathLength = 0;
  const headings = [];
  for (let index = 1; index < sweep.points.length; index += 1) {
    const previous = sweep.points[index - 1];
    const current = sweep.points[index];
    const segmentX = current.x - previous.x;
    const segmentY = current.y - previous.y;
    pathLength += Math.hypot(segmentX, segmentY);
    headings.push(Math.atan2(segmentY, segmentX));
  }
  let turns = 0;
  for (let index = 1; index < headings.length; index += 1) {
    let delta = Math.abs(headings[index] - headings[index - 1]);
    if (delta > Math.PI) delta = TAU - delta;
    turns += delta;
  }
  return {
    dx,
    dy,
    separation,
    pathLength,
    turns,
    heading: Math.atan2(dy, dx),
    direction: dx - dy >= 0 ? 1 : -1
  };
}

function pathFrom(points, reverse = false) {
  const ordered = reverse ? [...points].reverse() : points;
  return `${ordered.map(([x, y], index) => `${index ? 'L' : 'M'}${fixed(x)} ${fixed(y)}`).join(' ')} Z`;
}

function angularDistance(a, b) {
  const delta = Math.abs(a - b) % TAU;
  return Math.min(delta, TAU - delta);
}

function gateFor(point) {
  const angle = Math.atan2(point.y - 0.5, point.x - 0.5);
  return wrap(Math.floor(((angle + Math.PI) / TAU) * GATE_COUNT), GATE_COUNT);
}

function baseState() {
  return {
    winding: 0,
    gapIndex: 0,
    tension: 0,
    crease: 0,
    aperture: 0,
    closureCount: 0
  };
}

function baseContour() {
  return {
    id: 0,
    pathSignature: '',
    role: 'quiet'
  };
}

function contourPath(state) {
  const outer = [];
  const inner = [];
  const gapAngle = -Math.PI / 2 + state.gapIndex * TAU / GATE_COUNT;
  const drift = state.winding * 0.08 + state.crease * 0.045;
  const centerX = 500 + Math.sin(state.winding * 0.6 + state.crease) * 32;
  const centerY = 380 + Math.cos(state.winding * 0.45 - state.crease) * 22;

  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    const angle = -Math.PI / 2 + index * TAU / SEGMENT_COUNT;
    const distanceToGap = angularDistance(angle, gapAngle);
    const gateInfluence = Math.max(0, 1 - distanceToGap / 0.78);
    const wave = Math.sin(angle * 3 + drift) * 18 + Math.cos(angle * 5 - state.crease) * 8;
    const outerRadiusX = 272 + wave + gateInfluence * (34 + state.tension * 22);
    const outerRadiusY = 214 + Math.cos(angle * 2 + drift) * 16 + gateInfluence * state.aperture * 18;
    const twist = state.winding * Math.sin(angle * 2 + 0.4) * 13;
    outer.push([
      centerX + Math.cos(angle) * outerRadiusX + Math.sin(angle) * twist,
      centerY + Math.sin(angle) * outerRadiusY + Math.cos(angle) * twist
    ]);

    const innerWave = Math.sin(angle * 4 - drift) * 9 + Math.cos(angle * 2 + state.crease) * 7;
    const innerRadiusX = 128 + innerWave - gateInfluence * (22 + state.aperture * 22);
    const innerRadiusY = 91 + Math.cos(angle * 3 + drift) * 8 - gateInfluence * state.aperture * 13;
    inner.push([
      centerX + Math.cos(angle) * innerRadiusX + Math.sin(angle + state.crease) * state.tension * 12,
      centerY + Math.sin(angle) * innerRadiusY + Math.cos(angle - state.crease) * state.tension * 12
    ]);
  }

  return `${pathFrom(outer)} ${pathFrom(inner, true)}`;
}

function applyEvent(state, event) {
  state.winding += event.direction;
  state.gapIndex = wrap(state.gapIndex + event.direction, GATE_COUNT);
  state.tension = clamp(state.tension + 0.16 + event.separation * 0.1, 0, 1.2);
  state.crease += event.direction * (0.22 + Math.abs(event.heading) * 0.04);
  state.aperture = clamp(state.aperture + 0.14 + event.separation * 0.08, 0, 1.2);
  state.closureCount += 1;
}

function materialState(memory) {
  const state = baseState();
  for (const event of memory) applyEvent(state, event);
  const contour = baseContour();
  contour.pathSignature = contourPath(state);
  contour.role = state.closureCount ? 'strained' : 'quiet';
  return { state, contours: [contour] };
}

function frameFrom(stage, memory, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const material = materialState(safeMemory);
  const frame = {
    grammar: 'winding-contour',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    contours: material.contours,
    state: material.state,
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null);
}

export function geometrySignature(frame) {
  return `${frame.contours.map((contour) => `${contour.id}:${contour.role}:${contour.pathSignature}`).join('||')}||winding:${frame.state.winding}|gap:${frame.state.gapIndex}|closures:${frame.state.closureCount}`;
}

export function applyClosureAttempt(frame, rawSweep) {
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'attempt-memory-full', { committed: false, reason: 'memory-full' });
  }
  if (!rawSweep || (Array.isArray(rawSweep.points) ? rawSweep.points.length < 3 : (!rawSweep.start || !rawSweep.end))) {
    return frameFrom(frame.stage, frame.memory, 'attempt-refused-incomplete', { committed: false, reason: 'sweep-required' });
  }
  const sweep = normalizeSweep(rawSweep);
  const metrics = sweepMetrics(sweep);
  if (metrics.pathLength < MIN_SWEEP) {
    return frameFrom(frame.stage, frame.memory, 'attempt-refused-short', { committed: false, reason: 'sweep-too-short', separation: Number(metrics.separation.toFixed(3)) });
  }
  if (metrics.pathLength > MAX_SWEEP) {
    return frameFrom(frame.stage, frame.memory, 'attempt-refused-long', { committed: false, reason: 'sweep-too-long', separation: Number(metrics.separation.toFixed(3)) });
  }
  if (metrics.turns < 0.22) {
    return frameFrom(frame.stage, frame.memory, 'attempt-refused-flat', { committed: false, reason: 'turn-required', turns: Number(metrics.turns.toFixed(3)) });
  }
  const event = {
    committed: true,
    type: 'closure-attempt',
    index: frame.memory.length,
    start: sweep.start,
    end: sweep.end,
    startGate: gateFor(sweep.start),
    endGate: gateFor(sweep.end),
    separation: Number(metrics.separation.toFixed(3)),
    pathLength: Number(metrics.pathLength.toFixed(3)),
    turns: Number(metrics.turns.toFixed(3)),
    heading: Number(metrics.heading.toFixed(3)),
    direction: metrics.direction
  };
  return frameFrom(frame.stage + 1, [...frame.memory, event], 'attempt-committed', event);
}

export function liftLatestAttempt(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false });
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'attempt-lifted', { committed: false, lifted: true });
}

export function releaseContour() {
  return frameFrom(0, [], 'released', { committed: false, released: true });
}

export function buildTimeline() {
  const sweeps = [
    {
      points: [
        { x: 0.22, y: 0.56 },
        { x: 0.30, y: 0.26 },
        { x: 0.62, y: 0.18 },
        { x: 0.78, y: 0.25 }
      ]
    },
    {
      points: [
        { x: 0.76, y: 0.50 },
        { x: 0.68, y: 0.22 },
        { x: 0.42, y: 0.16 },
        { x: 0.34, y: 0.21 }
      ]
    },
    {
      points: [
        { x: 0.27, y: 0.25 },
        { x: 0.33, y: 0.55 },
        { x: 0.62, y: 0.60 },
        { x: 0.73, y: 0.58 }
      ]
    },
    {
      points: [
        { x: 0.70, y: 0.22 },
        { x: 0.61, y: 0.48 },
        { x: 0.37, y: 0.58 },
        { x: 0.29, y: 0.56 }
      ]
    }
  ];
  let frame = buildFrame();
  const frames = [frame];
  for (const sweep of sweeps) {
    frame = applyClosureAttempt(frame, sweep);
    frames.push(frame);
  }
  return frames;
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'winding-contour',
  rule: 'a bounded closure attempt changes the winding and gap of one compound contour; the gesture itself is not copied',
  memoryWindow: MEMORY_WINDOW
};
