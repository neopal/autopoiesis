const SEED = '0x4e413439';
export const CELL_COUNT = 12;
export const MEMORY_LIMIT = 4;
export const PRESSURE_THRESHOLD = 0.56;
export const OPPOSITION_THRESHOLD = 0.62;
export const RESISTANCE_THRESHOLD = 0.58;

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clone = (value) => JSON.parse(JSON.stringify(value));

const CELL_LAYOUT = [
  [-0.68, -0.54, 0.28, 0.25, -0.12, 0.22],
  [-0.31, -0.61, 0.31, 0.23, 0.08, 0.31],
  [0.08, -0.56, 0.29, 0.27, -0.06, 0.18],
  [0.47, -0.61, 0.3, 0.23, 0.11, 0.27],
  [-0.76, -0.18, 0.31, 0.28, 0.1, 0.34],
  [-0.37, -0.2, 0.28, 0.3, -0.11, 0.2],
  [0.0, -0.19, 0.33, 0.29, 0.07, 0.3],
  [0.42, -0.2, 0.31, 0.28, -0.08, 0.21],
  [-0.67, 0.24, 0.29, 0.27, -0.08, 0.26],
  [-0.29, 0.29, 0.32, 0.25, 0.12, 0.18],
  [0.1, 0.27, 0.3, 0.28, -0.09, 0.33],
  [0.47, 0.28, 0.28, 0.25, 0.06, 0.23]
];

function baseCell(index) {
  const [x, y, width, height, angle, notch] = CELL_LAYOUT[index];
  return {
    id: index,
    x,
    y,
    width,
    height,
    angle,
    scale: 1,
    notch,
    phase: round(((index * 11) % 23) / 23),
    role: 'unread-cell',
    pressureDepth: 0
  };
}

const BASE_CELLS = Array.from({ length: CELL_COUNT }, (_, index) => baseCell(index));
const BASE_APERTURES = [
  { id: 0, x: -0.12, y: -0.12, width: 0.16, height: 0.1, angle: -0.28, depth: 0.08 },
  { id: 1, x: 0.3, y: 0.1, width: 0.12, height: 0.17, angle: 0.42, depth: 0.06 },
  { id: 2, x: -0.47, y: 0.12, width: 0.11, height: 0.13, angle: -0.65, depth: 0.07 }
];

function validGesture(gesture) {
  return gesture && Number.isFinite(Number(gesture.direction))
    && Number.isFinite(Number(gesture.opposition))
    && Number.isFinite(Number(gesture.pressure))
    && Number.isFinite(Number(gesture.resistance))
    && Number.isFinite(Number(gesture.turns));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function boundedMemory(memory) {
  return memory.slice(-MEMORY_LIMIT).map((event, index) => ({
    ...event,
    memoryIndex: index
  }));
}

function foldPair(event) {
  const directionIndex = Math.abs(Math.round((event.direction + Math.PI) * 3));
  const first = (directionIndex + event.memoryIndex * 3) % CELL_COUNT;
  const second = (first + 3 + event.memoryIndex * 2 + Math.round(event.opposition * 2)) % CELL_COUNT;
  return [first, second === first ? (second + 1) % CELL_COUNT : second];
}

function materialise(memory) {
  const cells = BASE_CELLS.map((cell) => ({ ...cell }));
  const apertures = BASE_APERTURES.map((aperture) => ({ ...aperture }));
  const joins = [];
  const folds = [];

  for (const event of memory) {
    const [first, second] = foldPair(event);
    const pair = new Set([first, second]);
    const drift = 0.012 + event.pressure * 0.014 + event.memoryIndex * 0.004;
    const axis = event.direction + event.memoryIndex * 0.19;

    cells.forEach((cell, index) => {
      const oppositionSign = index % 2 === 0 ? 1 : -1;
      const radial = ((index % 3) - 1) * 0.003;
      cell.x = round(cell.x + Math.cos(axis) * drift * (1 + (index % 4) * 0.22) + Math.sin(axis * 1.7 + index) * radial);
      cell.y = round(cell.y + Math.sin(axis) * drift * (1 + (index % 3) * 0.18) + Math.cos(axis + index) * radial);
      cell.angle = round(cell.angle + oppositionSign * (0.018 + event.opposition * 0.028) + event.memoryIndex * 0.006);
      cell.scale = round(cell.scale * (1 + event.pressure * 0.012 + (index % 3) * 0.002));
      cell.notch = round(clamp(cell.notch + (pair.has(index) ? 0.08 : -0.008) + event.resistance * 0.004, 0.08, 0.68));
      cell.pressureDepth = round(cell.pressureDepth + (pair.has(index) ? drift * 2.8 : drift * 0.42));
      cell.phase = round((cell.phase + event.opposition * 0.09 + index * 0.002) % 1);
      if (pair.has(index)) {
        cell.role = 'folded-cell';
        cell.x = round(cell.x + Math.cos(axis) * drift * (index === first ? 1.6 : -1.1));
        cell.y = round(cell.y + Math.sin(axis) * drift * (index === first ? 1.2 : -1.45));
        cell.scale = round(cell.scale * (1.04 + event.resistance * 0.03));
      }
    });

    apertures.forEach((aperture, index) => {
      const sign = index % 2 === 0 ? -1 : 1;
      aperture.x = round(aperture.x + Math.cos(axis + index) * drift * 0.8);
      aperture.y = round(aperture.y + Math.sin(axis - index * 0.4) * drift * 0.65);
      aperture.width = round(clamp(aperture.width * (1 + sign * event.pressure * 0.05), 0.06, 0.28));
      aperture.height = round(clamp(aperture.height * (1 - sign * event.opposition * 0.045), 0.06, 0.24));
      aperture.angle = round(aperture.angle + sign * event.direction * 0.08);
      aperture.depth = round(aperture.depth + drift * (0.8 + index * 0.12));
    });

    joins.push({
      a: first,
      b: second,
      axis: round(axis),
      depth: round(drift * 4.2),
      memoryIndex: event.memoryIndex
    });
    folds.push({
      id: event.memoryIndex,
      pair: [first, second],
      pressure: event.pressure,
      direction: event.direction
    });
  }

  return { cells, apertures, joins, folds };
}

function stateFrom(memory, interaction = 'idle') {
  const bounded = boundedMemory(memory);
  return {
    seed: SEED,
    composition: 'pressure-topology',
    renderer: 'svg',
    interaction,
    stage: bounded.length,
    memory: clone(bounded),
    memoryLimit: MEMORY_LIMIT,
    body: materialise(bounded)
  };
}

export function buildFrame() {
  return stateFrom([]);
}

export function geometrySignature(state) {
  return JSON.stringify({ cells: state.body.cells, apertures: state.body.apertures, joins: state.body.joins });
}

export function commitPressure(state, gesture) {
  if (!validGesture(gesture)) return { accepted: false, reason: 'invalid', field: stateFrom(state.memory, 'pressure-refused-invalid') };
  const pressure = clamp(Number(gesture.pressure), 0, 1);
  const opposition = clamp(Number(gesture.opposition), 0, 1);
  const resistance = clamp(Number(gesture.resistance), 0, 1);
  const turns = Math.max(0, Math.floor(Number(gesture.turns)));
  const reason = pressure < PRESSURE_THRESHOLD
    ? 'weak'
    : opposition < OPPOSITION_THRESHOLD
      ? 'unopposed'
      : resistance < RESISTANCE_THRESHOLD
        ? 'unsettled'
        : turns < 3 ? 'straight' : null;

  if (reason) return { accepted: false, reason, field: stateFrom(state.memory, `pressure-refused-${reason}`) };

  const event = {
    kind: 'pressure-fold',
    direction: round(Number(gesture.direction)),
    opposition: round(opposition),
    pressure: round(pressure),
    resistance: round(resistance),
    turns,
    memoryIndex: state.memory.length
  };
  const field = stateFrom([...state.memory, event], 'pressure-fold-committed');
  return { accepted: true, event: clone(field.memory.at(-1)), field };
}

export function liftLatest(state) {
  return stateFrom(state.memory.slice(0, -1), 'lifted / exact');
}

export function releaseMemory() {
  return stateFrom([], 'memory-released');
}

export function buildTimeline() {
  const gestures = [
    { direction: -0.92, opposition: 0.82, pressure: 0.78, resistance: 0.74, turns: 3 },
    { direction: 0.38, opposition: 0.75, pressure: 0.68, resistance: 0.8, turns: 4 },
    { direction: 1.42, opposition: 0.88, pressure: 0.73, resistance: 0.67, turns: 5 },
    { direction: -1.78, opposition: 0.7, pressure: 0.64, resistance: 0.84, turns: 3 }
  ];
  const frames = [buildFrame()];
  for (const gesture of gestures) frames.push(commitPressure(frames.at(-1), gesture).field);
  return frames;
}

export { SEED };
