const BASE_SEED = 0x53564737;
export const CELL_COUNT = 11;
export const MEMORY_WINDOW = 4;
export const MIN_TOUR_POINTS = 3;
export const MAX_TOUR_POINTS = 22;
export const MIN_TOUR_LENGTH = 0.16;
export const MAX_TOUR_LENGTH = 1.18;

const CELL_LAYOUT = [
  { x: 0.14, y: 0.22, scale: 0.84, angle: -18, phase: 0.11 },
  { x: 0.29, y: 0.17, scale: 0.72, angle: 24, phase: 0.23 },
  { x: 0.44, y: 0.25, scale: 1.04, angle: 8, phase: 0.37 },
  { x: 0.61, y: 0.16, scale: 0.76, angle: -31, phase: 0.49 },
  { x: 0.80, y: 0.25, scale: 0.95, angle: 17, phase: 0.62 },
  { x: 0.19, y: 0.48, scale: 1.06, angle: 34, phase: 0.74 },
  { x: 0.39, y: 0.56, scale: 0.79, angle: -11, phase: 0.86 },
  { x: 0.59, y: 0.46, scale: 1.12, angle: 19, phase: 0.98 },
  { x: 0.80, y: 0.55, scale: 0.82, angle: -27, phase: 1.12 },
  { x: 0.31, y: 0.78, scale: 0.88, angle: -8, phase: 1.27 },
  { x: 0.67, y: 0.78, scale: 1.02, angle: 29, phase: 1.39 }
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

function normalizePoints(points) {
  return Array.isArray(points) ? points.slice(0, MAX_TOUR_POINTS).map(normalizedPoint) : [];
}

function tourMetrics(points) {
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

function cellPosition(cell, state) {
  const drift = (cell.id % 2 ? -1 : 1) * state.driftX;
  return {
    x: clamp(cell.x + cell.shiftX + drift * 0.62, 0.08, 0.92),
    y: clamp(cell.y + cell.shiftY + state.driftY * (cell.id % 3 === 0 ? 0.8 : -0.35), 0.09, 0.91)
  };
}

function cellPath(cell, state) {
  const center = cellPosition(cell, state);
  const scale = cell.scale * (1 + state.breath * ((cell.id % 3) - 1) * 0.018);
  const angle = cell.angle + cell.turn + state.tilt * (cell.id % 2 ? -0.45 : 0.35);
  const shape = [
    [-0.075, -0.095],
    [0.018, -0.125],
    [0.096, -0.025],
    [0.068, 0.088],
    [-0.028, 0.116],
    [-0.105, 0.018]
  ];
  const aperture = clamp(cell.aperture, 0.18, 1.4);
  const hole = [
    [-0.018, -0.035 * aperture],
    [0.038 * aperture, -0.005],
    [0.012, 0.042 * aperture],
    [-0.04 * aperture, 0.012]
  ];
  const transform = ([x, y], multiplier = 1) => {
    const [rx, ry] = rotate(x * scale * multiplier, y * scale * multiplier, angle);
    return [(center.x + rx) * 1000, (center.y + ry) * 760];
  };
  return `${pathFrom(shape.map((point) => transform(point)))} ${pathFrom(hole.map((point) => transform(point, 1 + aperture * 0.35)))}`;
}

function baseCell(index) {
  const source = CELL_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    scale: source.scale,
    angle: source.angle,
    phase: source.phase,
    shiftX: 0,
    shiftY: 0,
    turn: 0,
    aperture: 0.62,
    role: 'quiet',
    pathSignature: ''
  };
}

function baseState() {
  return {
    driftX: 0,
    driftY: 0,
    tilt: 0,
    breath: 0,
    vacancyCount: 0,
    attention: Array(CELL_COUNT).fill(0)
  };
}

function applyEvent(cells, state, event) {
  cells.forEach((cell) => { cell.role = 'quiet'; });
  for (const id of event.route) state.attention[id] += 1;

  const witness = cells[event.witnessCell];
  const vacancy = cells[event.vacancyCell];
  const relay = cells[event.relayCell];
  const direction = event.direction;
  const pressure = 0.55 + event.route.length * 0.04;

  witness.shiftX -= direction * 0.014 * pressure;
  witness.shiftY += Math.sin(event.heading) * 0.012;
  witness.turn += direction * (5 + event.turn * 2);
  witness.aperture = clamp(witness.aperture + 0.14 * pressure, 0.18, 1.4);
  witness.scale = clamp(witness.scale * 0.93, 0.54, 1.3);
  witness.role = 'witnessed';

  vacancy.shiftX += direction * 0.018 * pressure;
  vacancy.shiftY -= Math.cos(event.heading) * 0.017;
  vacancy.turn -= direction * (7 + event.index * 1.5);
  vacancy.aperture = clamp(vacancy.aperture + 0.42 + event.turn * 0.04, 0.18, 1.4);
  vacancy.scale = clamp(vacancy.scale * 1.08, 0.54, 1.34);
  vacancy.role = 'vacancy';

  relay.shiftX -= direction * 0.012;
  relay.shiftY += direction * 0.014;
  relay.turn += event.turn * 7 - direction * 3;
  relay.aperture = clamp(relay.aperture - 0.08, 0.18, 1.4);
  relay.role = 'relay';

  state.driftX += direction * 0.014 + event.turn * 0.004;
  state.driftY += Math.sin(event.heading) * 0.012;
  state.tilt += direction * 1.8 + event.turn * 0.7;
  state.breath += 0.6;
  state.vacancyCount += 1;
}

function materialState(memory) {
  const cells = CELL_LAYOUT.map((_, index) => baseCell(index));
  const state = baseState();
  for (const event of memory) applyEvent(cells, state, event);
  for (const cell of cells) cell.pathSignature = cellPath(cell, state);
  return { cells, state };
}

function frameFrom(stage, memory, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const { cells, state } = materialState(safeMemory);
  const frame = {
    grammar: 'witness-vacancy',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    cells,
    state,
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

function nearestCell(cells, point) {
  let winner = 0;
  let score = Infinity;
  for (const cell of cells) {
    const center = cellPosition(cell, { driftX: 0, driftY: 0 });
    const distance = (center.x - point.x) ** 2 + (center.y - point.y) ** 2;
    if (distance < score) {
      score = distance;
      winner = cell.id;
    }
  }
  return winner;
}

function routeFor(points, cells) {
  const route = [];
  for (const point of points) {
    const id = nearestCell(cells, point);
    if (route.at(-1) !== id) route.push(id);
  }
  return route;
}

function leastAttendedCell(cells, attention, excluded) {
  return cells
    .filter((cell) => !excluded.has(cell.id))
    .sort((left, right) => attention[left.id] - attention[right.id] || left.id - right.id)[0].id;
}

function mostVisited(route) {
  const counts = new Map();
  route.forEach((id, index) => counts.set(id, (counts.get(id) ?? 0) + route.length - index));
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0][0];
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null);
}

export function geometrySignature(frame) {
  return `${frame.cells.map((cell) => `${cell.id}:${cell.role}:${cell.pathSignature || cellPath(cell, frame.state)}`).join('||')}||vacancies:${frame.state.vacancyCount}`;
}

export function applyTour(frame, rawTour) {
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'tour-memory-full', { committed: false, reason: 'memory-full' });
  }
  const points = normalizePoints(rawTour?.points);
  if (points.length < MIN_TOUR_POINTS) {
    return frameFrom(frame.stage, frame.memory, 'tour-refused-short', { committed: false, reason: 'too-few-points', pointCount: points.length });
  }
  const metrics = tourMetrics(points);
  const route = routeFor(points, frame.cells);
  if (route.length < 3 && points.length >= MIN_TOUR_POINTS) {
    return frameFrom(frame.stage, frame.memory, 'tour-refused-single-cell', { committed: false, reason: 'single-cell-route', route });
  }
  if (metrics.length < MIN_TOUR_LENGTH) {
    return frameFrom(frame.stage, frame.memory, 'tour-refused-short', { committed: false, reason: 'short-tour', length: Number(metrics.length.toFixed(3)) });
  }
  if (metrics.length > MAX_TOUR_LENGTH) {
    return frameFrom(frame.stage, frame.memory, 'tour-refused-sprawling', { committed: false, reason: 'sprawling-tour', length: Number(metrics.length.toFixed(3)) });
  }

  const witnessCell = mostVisited(route);
  const excluded = new Set([witnessCell, ...route]);
  const vacancyCell = leastAttendedCell(frame.cells, frame.state.attention, new Set([witnessCell]));
  const relayCandidates = frame.cells.filter((cell) => cell.id !== witnessCell && cell.id !== vacancyCell);
  const relayCell = relayCandidates[wrap(route.length + frame.memory.length * 2, relayCandidates.length)].id;
  const event = {
    committed: true,
    type: 'proximity-tour',
    index: frame.memory.length,
    route,
    heading: Number(metrics.heading.toFixed(3)),
    turn: Number(metrics.turn.toFixed(3)),
    length: Number(metrics.length.toFixed(3)),
    direction: metrics.dx >= 0 ? 1 : -1,
    witnessCell,
    vacancyCell,
    relayCell
  };
  return frameFrom(frame.stage + 1, [...frame.memory, event], 'tour-committed', event);
}

export function liftLatestTour(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false });
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'tour-lifted', { committed: false, lifted: true });
}

export function releaseField() {
  return frameFrom(0, [], 'released', { committed: false, released: true });
}

export function buildTimeline() {
  const tours = [
    { points: [{ x: 0.14, y: 0.22 }, { x: 0.29, y: 0.17 }, { x: 0.44, y: 0.25 }, { x: 0.61, y: 0.16 }] },
    { points: [{ x: 0.80, y: 0.25 }, { x: 0.59, y: 0.46 }, { x: 0.39, y: 0.56 }, { x: 0.19, y: 0.48 }] },
    { points: [{ x: 0.31, y: 0.78 }, { x: 0.39, y: 0.56 }, { x: 0.59, y: 0.46 }, { x: 0.67, y: 0.78 }] },
    { points: [{ x: 0.14, y: 0.22 }, { x: 0.19, y: 0.48 }, { x: 0.31, y: 0.78 }, { x: 0.67, y: 0.78 }] }
  ];
  let frame = buildFrame();
  const frames = [frame];
  for (const tour of tours) {
    frame = applyTour(frame, tour);
    frames.push(frame);
  }
  return frames;
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'witness-vacancy',
  rule: 'a proximity tour is not drawn; it makes a witnessed cell contract, a remote vacancy open, and a third cell relay the debt',
  memoryWindow: MEMORY_WINDOW
};
