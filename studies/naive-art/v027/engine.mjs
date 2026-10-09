const SEED = '0x4e413237';
const MEMORY_WINDOW = 4;
const PLATE_COUNT = 8;

const PALETTE = [
  { ink: '#e9e0cb', edge: '#f4ecd9' },
  { ink: '#c75c3e', edge: '#e47b58' },
  { ink: '#789a92', edge: '#a8c1b5' },
  { ink: '#d5a85b', edge: '#f0c87e' },
  { ink: '#293a3f', edge: '#536a6d' },
  { ink: '#a698a7', edge: '#c3b5c4' },
  { ink: '#c9c1a3', edge: '#eee4bd' },
  { ink: '#a84a37', edge: '#dd7355' }
];

const BASE_CONTOUR = [
  [20, 10], [76, 10], [82, 18], [78, 29], [84, 39], [77, 50], [85, 62],
  [79, 75], [84, 89], [59, 85], [50, 91], [41, 85], [18, 90], [23, 76],
  [16, 65], [22, 52], [15, 40], [23, 29], [17, 18]
];

const BASE_VOID = [
  [43, 27], [56, 23], [67, 29], [70, 39], [62, 47], [52, 44],
  [44, 51], [33, 43], [35, 34]
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10000) / 10000;
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

function polygon(points) {
  return `polygon(${points.map(([x, y]) => `${round(x)}% ${round(y)}%`).join(', ')})`;
}

function transformedPoints(points, plate, kind = 'body') {
  const scale = kind === 'void' ? plate.voidScale : plate.bodyScale;
  const shear = kind === 'void' ? plate.voidShear : plate.bodyShear;
  return points.map(([x, y], index) => {
    const wobble = 1 + Math.sin((index + 1) * 1.37 + plate.id * 0.71 + plate.seed) * 0.012;
    const centeredX = (x - 50) * scale * wobble;
    const centeredY = (y - 50) * (scale + shear * 0.04);
    const driftX = Math.sin((y + plate.id * 13) * 0.08) * plate.slip * 3.4;
    const driftY = Math.cos((x + plate.id * 11) * 0.06) * plate.slip * 2.8;
    return [50 + centeredX + driftX, 50 + centeredY + driftY];
  });
}

function updateGeometry(plate) {
  plate.clipPath = polygon(transformedPoints(BASE_CONTOUR, plate, 'body'));
  plate.voidPath = polygon(transformedPoints(BASE_VOID, plate, 'void'));
  plate.transform = `translate(${round(plate.offsetX)}% ${round(plate.offsetY)}%) rotate(${round(plate.rotation)}deg)`;
}

function basePlate(index) {
  const plate = {
    id: index,
    ink: PALETTE[index].ink,
    edge: PALETTE[index].edge,
    offsetX: (index - 3.5) * 0.72,
    offsetY: ((index % 3) - 1) * 0.48,
    rotation: (index - 3.5) * 0.34,
    slip: 0,
    bodyScale: 1 + (index % 2 ? 0.008 : -0.005),
    voidScale: 1 + (index % 3) * 0.012,
    bodyShear: (index - 3.5) * 0.004,
    voidShear: 0,
    seed: index * 0.73,
    changed: false,
    clipPath: '',
    voidPath: '',
    transform: ''
  };
  updateGeometry(plate);
  return plate;
}

function applyCorrection(plate, event) {
  const distanceFromSeam = Math.abs(plate.id - event.seam);
  const distanceFromRemote = Math.abs(plate.id - event.remote);
  const stackDrift = event.compression * (plate.id - 3.5) * 0.28;
  plate.offsetX += stackDrift;
  plate.offsetY += Math.sin((plate.id + 1) * 1.17 + event.phase) * event.compression * 0.18;
  plate.rotation += (plate.id - event.seam) * event.compression * 0.035;
  plate.slip += event.compression * (0.42 + ((plate.id + event.seam) % 3) * 0.08);
  plate.bodyShear += Math.sin(plate.id * 0.8 + event.phase) * event.compression * 0.012;
  if (plate.id === event.seam) {
    plate.offsetX += event.seamShift;
    plate.rotation += event.seamTurn;
    plate.bodyScale *= 1 - event.seamCompression;
    plate.changed = true;
  }
  if (plate.id === event.remote) {
    plate.offsetX -= event.remoteShift;
    plate.offsetY += event.remoteLift;
    plate.rotation -= event.remoteTurn;
    plate.voidScale *= 1 + event.remoteVoid;
    plate.voidShear += event.remoteVoid * 0.22;
    plate.changed = true;
  }
  if (distanceFromSeam <= 2 || distanceFromRemote <= 2) plate.changed = true;
  updateGeometry(plate);
}

function buildScene(stage, memory) {
  const plates = Array.from({ length: PLATE_COUNT }, (_, index) => basePlate(index));
  memory.slice(-MEMORY_WINDOW).forEach((event) => plates.forEach((plate) => applyCorrection(plate, event)));
  const changed = plates.filter((plate) => plate.changed).map((plate) => plate.id);
  return {
    stage,
    plates,
    trace: {
      changedLayerCount: changed.length,
      changedLayerIds: changed,
      correctionCount: memory.length,
      seamCount: new Set(memory.map((event) => event.seam)).size
    }
  };
}

function makeState(stage, memory, interaction = 'idle') {
  const bounded = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    stage,
    memory: bounded,
    scene: buildScene(stage, bounded),
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return makeState(stage, memory, 'idle');
}

export function loopIsClosed(loop) {
  const dx = Number(loop.endX) - Number(loop.startX);
  const dy = Number(loop.endY) - Number(loop.startY);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Number.isFinite(distance) && distance <= 0.14 && Number(loop.length) >= 0.62;
}

export function commitCorrection(state, loop) {
  if (!loopIsClosed(loop)) return makeState(state.stage, state.memory, 'correction-refused-open');
  const memoryLength = state.memory.length;
  const seam = Math.floor(mod(Number(loop.startX) * 17 + Number(loop.startY) * 31 + memoryLength * 7, PLATE_COUNT));
  const remote = mod(seam + 3 + memoryLength, PLATE_COUNT);
  const compression = 0.34 + clamp(Number(loop.length), 0.62, 1.8) * 0.19 + (Number(loop.closure) || 0) * 0.12;
  const event = {
    source: 'closed-correction',
    closed: true,
    seam,
    remote,
    phase: round(Number(loop.startX) * 4.1 + Number(loop.startY) * 2.7 + memoryLength * 0.33),
    compression: round(compression),
    seamShift: round(0.9 + (seam % 3) * 0.22),
    seamTurn: round(0.5 + (memoryLength % 2) * 0.18),
    seamCompression: round(0.018 + (seam % 2) * 0.008),
    remoteShift: round(1.2 + (remote % 3) * 0.24),
    remoteLift: round(0.55 + (memoryLength % 3) * 0.16),
    remoteTurn: round(0.42 + ((seam + remote) % 2) * 0.17),
    remoteVoid: round(0.06 + ((seam + memoryLength) % 3) * 0.018),
    changedLayers: Array.from({ length: PLATE_COUNT }, (_, index) => index).filter((index) => Math.abs(index - seam) <= 2 || Math.abs(index - remote) <= 2)
  };
  return makeState(state.stage + 1, [...state.memory, event], 'correction-committed');
}

export function liftLatestCorrection(state) {
  if (!state.memory.length) return makeState(state.stage, [], 'correction-lifted');
  return makeState(Math.max(0, state.stage - 1), state.memory.slice(0, -1), 'correction-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], 'memory-released');
}

export function geometrySignature(state) {
  return state.scene.plates.map((plate) => [
    plate.id, plate.transform, plate.clipPath, plate.voidPath
  ].join(':')).join('|');
}

export function changedLayerIds(state) {
  return state.scene.plates.filter((plate) => plate.changed).map((plate) => plate.id);
}

export function buildTimeline() {
  return {
    loops: [
      { startX: 0.18, startY: 0.78, endX: 0.22, endY: 0.75, length: 0.94, closure: 0.06 },
      { startX: 0.82, startY: 0.72, endX: 0.78, endY: 0.69, length: 0.88, closure: 0.05 },
      { startX: 0.66, startY: 0.24, endX: 0.63, endY: 0.27, length: 1.12, closure: 0.04 },
      { startX: 0.27, startY: 0.22, endX: 0.3, endY: 0.25, length: 0.76, closure: 0.045 }
    ]
  };
}

export { MEMORY_WINDOW, PLATE_COUNT, SEED };