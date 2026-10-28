const BASE_SEED = 0x53564738;
export const FOLD_COUNT = 12;
export const MEMORY_WINDOW = 4;
export const MIN_EDGE_SEPARATION = 0.28;
export const MAX_EDGE_SEPARATION = 1.08;
export const MAX_ACCORD_MEMORY = MEMORY_WINDOW;

const FOLD_LAYOUT = [
  { x: 0.14, y: 0.18, scale: 0.84, angle: -28, phase: 0.11 },
  { x: 0.24, y: 0.34, scale: 0.72, angle: 18, phase: 0.22 },
  { x: 0.13, y: 0.51, scale: 0.98, angle: 8, phase: 0.35 },
  { x: 0.25, y: 0.69, scale: 0.74, angle: -16, phase: 0.48 },
  { x: 0.15, y: 0.84, scale: 0.86, angle: 23, phase: 0.61 },
  { x: 0.39, y: 0.24, scale: 0.78, angle: -8, phase: 0.74 },
  { x: 0.45, y: 0.49, scale: 0.92, angle: 20, phase: 0.87 },
  { x: 0.39, y: 0.75, scale: 0.71, angle: -23, phase: 0.99 },
  { x: 0.63, y: 0.21, scale: 0.86, angle: 14, phase: 1.12 },
  { x: 0.56, y: 0.50, scale: 0.73, angle: -18, phase: 1.25 },
  { x: 0.76, y: 0.34, scale: 0.96, angle: 8, phase: 1.38 },
  { x: 0.83, y: 0.70, scale: 0.88, angle: -25, phase: 1.51 }
];

const OUTER = [
  [-0.125, -0.055], [-0.028, -0.14], [0.122, -0.058], [0.065, 0.008],
  [0.118, 0.102], [-0.018, 0.074], [-0.112, 0.14], [-0.064, 0.008]
];
const INNER = [
  [-0.035, -0.045], [0.038, -0.058], [0.064, 0.004],
  [0.012, 0.053], [-0.046, 0.029]
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));

function rotate(x, y, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine];
}

function pathFrom(points) {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')} Z`;
}

function normalizedPoint(point) {
  return {
    x: clamp(Number(point?.x ?? 0.5), 0, 1),
    y: clamp(Number(point?.y ?? 0.5), 0, 1)
  };
}

function normalizePointPair(raw) {
  return {
    start: normalizedPoint(raw?.start),
    end: normalizedPoint(raw?.end)
  };
}

function pairMetrics(pair) {
  const dx = pair.end.x - pair.start.x;
  const dy = pair.end.y - pair.start.y;
  return {
    dx,
    dy,
    separation: Math.hypot(dx, dy),
    heading: Math.atan2(dy, dx),
    direction: dx - dy >= 0 ? 1 : -1
  };
}

function foldCenter(fold, state) {
  return {
    x: clamp(fold.x + fold.offsetX, 0.07, 0.93),
    y: clamp(fold.y + fold.offsetY, 0.08, 0.92)
  };
}

function foldPath(fold, state) {
  const center = foldCenter(fold, state);
  const scale = fold.scale;
  const angle = fold.angle + fold.turn;
  const notch = clamp(fold.notch, 0.22, 1.55);
  const transform = (point, multiplier = 1) => {
    const [rx, ry] = rotate(point[0] * scale * multiplier, point[1] * scale * multiplier, angle);
    return [(center.x + rx) * 1000, (center.y + ry) * 760];
  };
  const hole = INNER.map(([x, y]) => [x * (0.74 + notch * 0.26), y * (0.74 + notch * 0.26)]);
  return `${pathFrom(OUTER.map((point) => transform(point)))} ${pathFrom(hole.map((point) => transform(point, 1 + notch * 0.34)))}`;
}

function creasePath(fold, state) {
  const center = foldCenter(fold, state);
  const scale = fold.scale;
  const angle = fold.angle + fold.turn;
  const points = [[-0.073, 0.018], [0.004, -0.021], [0.081, 0.038]].map(([x, y]) => {
    const [rx, ry] = rotate(x * scale, y * scale, angle);
    return [(center.x + rx) * 1000, (center.y + ry) * 760];
  });
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
}

function baseFold(index) {
  const source = FOLD_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    scale: source.scale,
    angle: source.angle,
    phase: source.phase,
    offsetX: 0,
    offsetY: 0,
    turn: 0,
    notch: 0.62,
    role: 'quiet',
    pathSignature: '',
    creaseSignature: ''
  };
}

function baseState() {
  return {
    swayX: 0,
    swayY: 0,
    lean: 0,
    breathe: 0,
    counterfoldCount: 0,
    attention: Array(FOLD_COUNT).fill(0)
  };
}

function applyEvent(folds, state, event) {
  folds.forEach((fold) => { fold.role = 'quiet'; });
  state.attention[event.startFold] += 1;
  state.attention[event.endFold] += 1;

  const counter = folds[event.counterFold];
  const hinge = folds[event.hingeFold];
  const echo = folds[event.echoFold];
  const direction = event.direction;
  const force = 0.56 + event.separation * 0.34;

  counter.offsetX += direction * 0.018 * force;
  counter.offsetY -= Math.cos(event.heading) * 0.016;
  counter.turn -= direction * (7 + event.index * 1.7);
  counter.notch = clamp(counter.notch + 0.32 + event.turn * 0.05, 0.22, 1.55);
  counter.scale = clamp(counter.scale * 1.08, 0.52, 1.34);
  counter.role = 'counterfold';

  hinge.offsetX -= direction * 0.015;
  hinge.offsetY += Math.sin(event.heading) * 0.019;
  hinge.turn += direction * (5 + Math.abs(event.turn) * 1.4);
  hinge.notch = clamp(hinge.notch - 0.18, 0.22, 1.55);
  hinge.scale = clamp(hinge.scale * 0.91, 0.52, 1.26);
  hinge.role = 'hinge';

  echo.offsetX += direction * 0.011;
  echo.offsetY += direction * 0.012;
  echo.turn -= event.turn * 5 + direction * 2;
  echo.notch = clamp(echo.notch + 0.12, 0.22, 1.55);
  echo.role = 'echo';

  folds[event.startFold].role = 'refused';
  folds[event.endFold].role = 'refused';
  state.swayX += direction * 0.012 + event.turn * 0.003;
  state.swayY += Math.sin(event.heading) * 0.01;
  state.lean += direction * 1.6 + event.turn * 0.45;
  state.breathe += 0.5;
  state.counterfoldCount += 1;
}

function materialState(memory) {
  const folds = FOLD_LAYOUT.map((_, index) => baseFold(index));
  const state = baseState();
  for (const event of memory) applyEvent(folds, state, event);
  for (const fold of folds) {
    fold.pathSignature = foldPath(fold, state);
    fold.creaseSignature = creasePath(fold, state);
  }
  return { folds, state };
}

function frameFrom(stage, memory, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const { folds, state } = materialState(safeMemory);
  const frame = {
    grammar: 'counterfold',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    folds,
    state,
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

function nearestFold(folds, point) {
  let winner = 0;
  let score = Infinity;
  for (const fold of folds) {
    const center = foldCenter(fold, baseState());
    const distance = (center.x - point.x) ** 2 + (center.y - point.y) ** 2;
    if (distance < score) {
      score = distance;
      winner = fold.id;
    }
  }
  return winner;
}

function leastAttendedFold(folds, attention, excluded) {
  return folds
    .filter((fold) => !excluded.has(fold.id))
    .sort((left, right) => attention[left.id] - attention[right.id] || left.id - right.id)[0].id;
}

function nextRemoteFold(folds, excluded, offset) {
  const candidates = folds.filter((fold) => !excluded.has(fold.id));
  return candidates[wrap(offset, candidates.length)].id;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null);
}

export function geometrySignature(frame) {
  return `${frame.folds.map((fold) => `${fold.id}:${fold.role}:${fold.pathSignature || foldPath(fold, frame.state)}:${fold.creaseSignature || creasePath(fold, frame.state)}`).join('||')}||counterfolds:${frame.state.counterfoldCount}`;
}

export function applyAccord(frame, rawAccord) {
  if (frame.memory.length >= MAX_ACCORD_MEMORY) {
    return frameFrom(frame.stage, frame.memory, 'accord-memory-full', { committed: false, reason: 'memory-full' });
  }
  const pair = normalizePointPair(rawAccord);
  if (!rawAccord || !rawAccord.start || !rawAccord.end) {
    return frameFrom(frame.stage, frame.memory, 'accord-refused-incomplete', { committed: false, reason: 'two-edges-required' });
  }
  const metrics = pairMetrics(pair);
  if (metrics.separation < MIN_EDGE_SEPARATION) {
    return frameFrom(frame.stage, frame.memory, 'accord-refused-near', { committed: false, reason: 'edges-too-near', separation: Number(metrics.separation.toFixed(3)) });
  }
  if (metrics.separation > MAX_EDGE_SEPARATION) {
    return frameFrom(frame.stage, frame.memory, 'accord-refused-sprawling', { committed: false, reason: 'edges-too-far', separation: Number(metrics.separation.toFixed(3)) });
  }

  const startFold = nearestFold(frame.folds, pair.start);
  const endFold = nearestFold(frame.folds, pair.end);
  if (startFold === endFold) {
    return frameFrom(frame.stage, frame.memory, 'accord-refused-same-edge', { committed: false, reason: 'same-fold-offer' });
  }
  const excluded = new Set([startFold, endFold]);
  const counterFold = leastAttendedFold(frame.folds, frame.state.attention, excluded);
  excluded.add(counterFold);
  const hingeFold = nextRemoteFold(frame.folds, excluded, frame.memory.length * 3 + 1);
  excluded.add(hingeFold);
  const echoFold = nextRemoteFold(frame.folds, excluded, frame.memory.length * 5 + 2);
  const turn = Math.atan2(metrics.dy, metrics.dx) * (metrics.dx >= 0 ? 1 : -1);
  const event = {
    committed: true,
    type: 'edge-accord',
    index: frame.memory.length,
    startFold,
    endFold,
    counterFold,
    hingeFold,
    echoFold,
    separation: Number(metrics.separation.toFixed(3)),
    heading: Number(metrics.heading.toFixed(3)),
    turn: Number(turn.toFixed(3)),
    direction: metrics.direction
  };
  return frameFrom(frame.stage + 1, [...frame.memory, event], 'accord-committed', event);
}

export function liftLatestAccord(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false });
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'accord-lifted', { committed: false, lifted: true });
}

export function releaseField() {
  return frameFrom(0, [], 'released', { committed: false, released: true });
}

export function buildTimeline() {
  const accords = [
    { start: { x: 0.14, y: 0.18 }, end: { x: 0.83, y: 0.70 } },
    { start: { x: 0.24, y: 0.34 }, end: { x: 0.76, y: 0.34 } },
    { start: { x: 0.13, y: 0.51 }, end: { x: 0.63, y: 0.21 } },
    { start: { x: 0.39, y: 0.75 }, end: { x: 0.83, y: 0.70 } }
  ];
  let frame = buildFrame();
  const frames = [frame];
  for (const accord of accords) {
    frame = applyAccord(frame, accord);
    frames.push(frame);
  }
  return frames;
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'counterfold',
  rule: 'a two-edge offer is refused locally; an unoffered counterfold, hinge, and echo carry the produced consequence',
  memoryWindow: MEMORY_WINDOW
};
