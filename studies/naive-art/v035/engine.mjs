const SEED = '0x4e413335';
const ANCHOR_COUNT = 12;
const MEMORY_WINDOW = 4;
const MIN_STROKE_POINTS = 3;
const MIN_STROKE_LENGTH = 0.14;
const MAX_STROKE_LENGTH = 0.72;

const BASE_ANCHORS = Array.from({ length: ANCHOR_COUNT }, (_, id) => {
  const angle = -Math.PI * 0.92 + id * (Math.PI * 2 / ANCHOR_COUNT);
  const radius = 0.66 + [0.04, -0.03, 0.06, -0.02, 0.03, -0.05, 0.02, 0.05, -0.02, 0.03, -0.04, 0.01][id];
  return {
    id,
    angle,
    radius,
    weight: 0.56 + [0.08, -0.04, 0.02, 0.1, -0.03, 0.04, -0.06, 0.07, -0.02, 0.05, -0.04, 0.03][id],
    crease: 0.12 + (id % 4) * 0.035,
    fold: (id % 3 - 1) * 0.08
  };
});

const BASE_APERTURE = { x: 0.17, y: -0.08, rx: 0.14, ry: 0.22, rotation: -0.26, bite: 0.12 };

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function finitePoint(point) {
  return Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]));
}

function normalisePoint(point) {
  return [clamp(Number(point[0]), 0, 1), clamp(Number(point[1]), 0, 1)];
}

function strokeLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = Number(points[index][0]) - Number(points[index - 1][0]);
    const dy = Number(points[index][1]) - Number(points[index - 1][1]);
    total += Math.hypot(dx, dy);
  }
  return total;
}

function strokeTurning(points) {
  let turning = 0;
  for (let index = 2; index < points.length; index += 1) {
    const a = points[index - 2];
    const b = points[index - 1];
    const c = points[index];
    const first = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const second = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let delta = second - first;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    turning += Math.abs(delta);
  }
  return turning;
}

function pointFor(anchor) {
  return {
    x: round(Math.cos(anchor.angle) * anchor.radius),
    y: round(Math.sin(anchor.angle) * anchor.radius),
  };
}

function anchorSignature(anchor) {
  return [
    anchor.id, anchor.state, round(anchor.angle), round(anchor.radius), round(anchor.weight),
    round(anchor.crease), round(anchor.fold), pointFor(anchor).x, pointFor(anchor).y
  ].join(':');
}

function apertureSignature(aperture) {
  return [aperture.x, aperture.y, aperture.rx, aperture.ry, aperture.rotation, aperture.bite].map(round).join(':');
}

function materialiseAnchors(memory) {
  const anchors = BASE_ANCHORS.map((base) => {
    const anchor = { ...base, state: 'quiet' };
    Object.assign(anchor, pointFor(anchor));
    anchor.signature = anchorSignature(anchor);
    return anchor;
  });
  const aperture = { ...BASE_APERTURE };
  memory.slice(-MEMORY_WINDOW).forEach((event) => applyMisread(anchors, aperture, event));
  anchors.forEach((anchor) => {
    Object.assign(anchor, pointFor(anchor));
    anchor.signature = anchorSignature(anchor);
  });
  aperture.signature = apertureSignature(aperture);
  return { anchors, aperture };
}

function applyMisread(anchors, aperture, event) {
  const pressure = clamp(0.12 + event.length * 0.34 + event.turning * 0.025 + event.memoryIndex * 0.025, 0.12, 0.44);
  const source = anchors[event.source];
  const transfer = anchors[event.transfer];
  const absence = anchors[event.absence];
  const shadow = anchors[event.shadow];

  source.state = 'pressed';
  source.radius = clamp(source.radius - pressure * 0.12, 0.38, 0.92);
  source.weight = clamp(source.weight + pressure * 0.55, 0.1, 1.4);
  source.crease += pressure * 0.88;
  source.fold += event.direction * pressure * 0.45;

  transfer.state = 'false-contour';
  transfer.radius = clamp(transfer.radius + pressure * 0.17, 0.38, 1.02);
  transfer.weight = clamp(source.weight + 0.16 + event.memoryIndex * 0.02, 0.1, 1.45);
  transfer.crease = source.crease * 0.52 + pressure * 0.3;
  transfer.fold = source.fold - event.direction * 0.32;

  absence.state = 'absence';
  absence.radius = clamp(absence.radius - pressure * 0.43, 0.1, 0.92);
  absence.weight = clamp(absence.weight - 0.62, 0.03, 1.3);
  absence.crease += pressure * 1.25;
  absence.fold -= event.direction * 0.2;

  shadow.state = 'remembering';
  shadow.radius = clamp(shadow.radius + pressure * 0.1, 0.38, 1.02);
  shadow.weight = clamp(shadow.weight + pressure * 0.35, 0.1, 1.4);
  shadow.crease += pressure * 0.65;
  shadow.fold += event.direction * 0.22;

  const remote = pointFor(transfer);
  const lost = pointFor(absence);
  aperture.x = clamp(remote.x * 0.52 + lost.x * 0.34 + event.end[0] - 0.5, -0.42, 0.42);
  aperture.y = clamp(remote.y * 0.48 + lost.y * 0.28 + event.end[1] - 0.5, -0.38, 0.38);
  aperture.rx = clamp(0.14 + pressure * 0.17 + event.memoryIndex * 0.012, 0.12, 0.32);
  aperture.ry = clamp(0.22 + pressure * 0.24, 0.18, 0.4);
  aperture.rotation = clamp(BASE_APERTURE.rotation + event.direction * 0.48 + event.memoryIndex * 0.06, -1.1, 1.1);
  aperture.bite = clamp(0.12 + pressure * 1.4, 0.12, 0.82);
}

function makeState(memory, interaction = 'idle', pending = [], previousMemory = null, previousStage = null) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  const material = materialiseAnchors(boundedMemory);
  return {
    seed: SEED,
    grammar: 'pressure-misread',
    surface: 'single-memory-plate',
    stage: boundedMemory.length,
    memory: boundedMemory,
    pending: pending.map(normalisePoint),
    previousMemory,
    previousStage,
    anchors: material.anchors,
    aperture: material.aperture,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return makeState(memory);
}

export function strokeIsValid(points = []) {
  if (!Array.isArray(points) || points.length < MIN_STROKE_POINTS || points.some((point) => !finitePoint(point))) return false;
  const normalised = points.map(normalisePoint);
  const length = strokeLength(normalised);
  return length >= MIN_STROKE_LENGTH && length <= MAX_STROKE_LENGTH;
}

function summaryFor(points) {
  const normalised = points.map(normalisePoint);
  return {
    points: normalised,
    start: normalised[0],
    end: normalised.at(-1),
    length: round(strokeLength(normalised)),
    turning: round(strokeTurning(normalised)),
    direction: Math.sign(normalised.at(-1)[0] - normalised[0][0]) || 1
  };
}

function eventFor(points, memoryIndex) {
  const summary = summaryFor(points);
  const source = clamp(Math.floor((summary.start[0] * 0.72 + summary.start[1] * 0.28) * ANCHOR_COUNT), 0, ANCHOR_COUNT - 1);
  const transfer = (source + 5 + memoryIndex) % ANCHOR_COUNT;
  const absence = (transfer + 4 + memoryIndex) % ANCHOR_COUNT;
  let shadow = (absence + 3) % ANCHOR_COUNT;
  while ([source, transfer, absence].includes(shadow)) shadow = (shadow + 1) % ANCHOR_COUNT;
  return {
    kind: 'pressure-misread',
    source,
    transfer,
    absence,
    shadow,
    start: summary.start,
    end: summary.end,
    length: summary.length,
    turning: summary.turning,
    direction: summary.direction,
    memoryIndex
  };
}

export function armStroke(state, input = {}) {
  const points = Array.isArray(input.points) ? input.points : [];
  if (!strokeIsValid(points) || state.pending.length) return makeState(state.memory, 'stroke-refused', []);
  return makeState(state.memory, 'stroke-armed', points, state.previousMemory, state.previousStage);
}

export function commitStroke(state, input = {}) {
  const points = Array.isArray(input.points) && input.points.length ? input.points : state.pending;
  if (!strokeIsValid(points)) return makeState(state.memory, 'stroke-refused', state.pending, state.previousMemory, state.previousStage);
  const event = eventFor(points, state.memory.length);
  return makeState([...state.memory, event], 'stroke-committed', [], state.memory, state.stage);
}

export function liftLatestStroke(state) {
  if (!state.memory.length) return makeState([], 'stroke-lifted');
  const previousMemory = state.previousMemory ?? state.memory.slice(0, -1);
  return makeState(previousMemory, 'stroke-lifted');
}

export function releaseMemory() {
  return makeState([], 'memory-released');
}

export function geometrySignature(value) {
  const anchors = value.anchors ?? [];
  const aperture = value.aperture ?? {};
  return `${anchors.map((anchor) => anchorSignature(anchor)).join('|')}::${apertureSignature(aperture)}`;
}

export function buildTimeline() {
  return [
    [[0.18, 0.62], [0.25, 0.54], [0.34, 0.49], [0.42, 0.43]],
    [[0.69, 0.31], [0.61, 0.38], [0.54, 0.45]],
    [[0.29, 0.28], [0.39, 0.34], [0.49, 0.39], [0.57, 0.46]],
    [[0.74, 0.68], [0.67, 0.59], [0.59, 0.53]]
  ];
}

export { SEED, ANCHOR_COUNT, MEMORY_WINDOW, MIN_STROKE_POINTS, MIN_STROKE_LENGTH, MAX_STROKE_LENGTH };
