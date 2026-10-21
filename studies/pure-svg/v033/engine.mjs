const BASE_SEED = 0x53564733;
export const FAULT_COUNT = 7;
export const MEMORY_WINDOW = 4;
export const MIN_PRESSURE_MS = 140;
export const MAX_PRESSURE_MS = 720;

const FAULT_LAYOUT = [
  { x: 0.22, y: 0.34, angle: -28, phase: 0.08 },
  { x: 0.36, y: 0.24, angle: 18, phase: 0.21 },
  { x: 0.53, y: 0.29, angle: -12, phase: 0.37 },
  { x: 0.70, y: 0.22, angle: 24, phase: 0.52 },
  { x: 0.79, y: 0.41, angle: 8, phase: 0.68 },
  { x: 0.63, y: 0.60, angle: -31, phase: 0.79 },
  { x: 0.38, y: 0.68, angle: 14, phase: 0.94 }
];

const SHEET_BOUNDARY = [
  [0.14, 0.34], [0.25, 0.17], [0.47, 0.13], [0.72, 0.16],
  [0.88, 0.31], [0.82, 0.48], [0.87, 0.67], [0.63, 0.82],
  [0.39, 0.78], [0.16, 0.84], [0.10, 0.62], [0.17, 0.48]
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

function pathFrom(points, close = true) {
  const path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ');
  return close ? `${path} Z` : path;
}

function normalizedPath(points) {
  return pathFrom(points.map(([x, y]) => [x * 1000, y * 680]));
}

function baseFault(index) {
  const source = FAULT_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    angle: source.angle,
    phase: source.phase,
    recede: 0,
    counterweight: 0,
    scar: 0,
    role: 'quiet',
    pathSignature: ''
  };
}

function baseSheet() {
  return {
    drift: 0,
    riftShift: 0,
    riftWidth: 1,
    fold: 0,
    seam: 0
  };
}

function innerRift(sheet) {
  const shift = sheet.riftShift;
  const width = sheet.riftWidth;
  const fold = sheet.fold;
  const points = [
    [0.26 + shift, 0.46 - fold * 0.02],
    [0.40 + shift * 0.35, 0.35 - width * 0.015],
    [0.59 + shift * 0.20, 0.40 + fold * 0.03],
    [0.69 + shift, 0.52 + width * 0.015],
    [0.53 + shift * 0.12, 0.57 + fold * 0.02],
    [0.36 + shift * 0.25, 0.54 - width * 0.01]
  ];
  return normalizedPath(points);
}

function sheetPath(sheet) {
  const outer = SHEET_BOUNDARY.map(([x, y], index) => {
    const wave = Math.sin(index * 1.7 + sheet.fold) * sheet.drift * 0.014;
    const bend = (index % 2 ? 1 : -1) * sheet.seam * 0.012;
    return [x + wave + bend, y + wave * 0.7 - bend];
  });
  return `${normalizedPath(outer)} ${innerRift(sheet)}`;
}

function faultPath(fault) {
  const scale = 1 - fault.recede * 0.18 + fault.counterweight * 0.12 + fault.scar * 0.04;
  const width = 0.066 * scale;
  const height = 0.018 + fault.scar * 0.008 + fault.counterweight * 0.004;
  const points = [];
  for (let index = 0; index < 6; index += 1) {
    const theta = Math.PI * 2 * index / 6;
    const ripple = 1 + Math.sin(theta * 3 + fault.phase * 13) * 0.08;
    const localX = Math.cos(theta) * width * 1000 * ripple;
    const localY = Math.sin(theta) * height * 680 * ripple;
    const [rotatedX, rotatedY] = rotate(localX, localY, fault.angle + fault.scar * 8 - fault.recede * 4);
    points.push([fault.x * 1000 + rotatedX, fault.y * 680 + rotatedY]);
  }
  return pathFrom(points);
}

function applyEvent(faults, sheet, event) {
  faults.forEach((fault) => { fault.role = 'quiet'; });
  const source = faults[event.sourceFault];
  const counter = faults[event.counterFault];
  const scar = faults[event.scarFault];
  source.recede = clamp(source.recede + 1, 0, 4);
  source.angle -= event.direction * (7 + event.index * 0.8);
  source.role = 'receded';
  counter.counterweight = clamp(counter.counterweight + 1, 0, 4);
  counter.angle += event.direction * 9;
  counter.role = 'counterweight';
  scar.scar = clamp(scar.scar + 1, 0, 4);
  scar.angle -= event.direction * 12;
  scar.role = 'scarred';
  sheet.drift += event.direction * 0.8;
  sheet.riftShift = clamp(sheet.riftShift + event.direction * 0.018, -0.08, 0.08);
  sheet.riftWidth = clamp(sheet.riftWidth + 0.12, 0.78, 1.55);
  sheet.fold += event.direction * 0.7;
  sheet.seam += event.index % 2 ? -0.9 : 0.72;
}

function materialState(memory) {
  const faults = FAULT_LAYOUT.map((_, index) => baseFault(index));
  const sheet = baseSheet();
  for (const event of memory) applyEvent(faults, sheet, event);
  return { faults, sheet };
}

function frameFrom(stage, memory, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const { faults, sheet } = materialState(safeMemory);
  for (const fault of faults) fault.pathSignature = faultPath(fault);
  const frame = {
    grammar: 'resistant-crease',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    faults,
    sheet,
    sheetPath: sheetPath(sheet),
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

function nearestFault(faults, point) {
  const x = clamp(Number(point?.x ?? 0.5), 0, 1);
  const y = clamp(Number(point?.y ?? 0.5), 0, 1);
  let winner = 0;
  let score = Infinity;
  for (const fault of faults) {
    const distance = (fault.x - x) ** 2 + (fault.y - y) ** 2;
    if (distance < score) {
      score = distance;
      winner = fault.id;
    }
  }
  return winner;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null);
}

export function geometrySignature(frame) {
  return `${frame.sheetPath}||${frame.faults.map((fault) => `${fault.id}:${fault.role}:${fault.pathSignature || faultPath(fault)}`).join('||')}`;
}

export function applyPressure(frame, rawOffer) {
  const duration = Number(rawOffer?.duration ?? 0);
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'pressure-memory-full', { committed: false, reason: 'memory-full' });
  }
  if (duration < MIN_PRESSURE_MS) {
    return frameFrom(frame.stage, frame.memory, 'pressure-refused-weak', { committed: false, reason: 'weak-pressure', duration });
  }
  if (duration > MAX_PRESSURE_MS) {
    return frameFrom(frame.stage, frame.memory, 'pressure-refused-held', { committed: false, reason: 'held-pressure', duration });
  }
  const sourceFault = nearestFault(frame.faults, rawOffer?.point ?? rawOffer);
  const counterFault = wrap(sourceFault + 2 + frame.memory.length, FAULT_COUNT);
  const scarFault = wrap(sourceFault + 4 + frame.memory.length * 2, FAULT_COUNT);
  const direction = duration >= 420 ? 1 : -1;
  const event = {
    committed: true,
    type: 'pressure-redistribution',
    index: frame.memory.length,
    duration,
    sourceFault,
    counterFault,
    scarFault,
    direction,
    resistance: Number((duration / MAX_PRESSURE_MS).toFixed(3))
  };
  return frameFrom(frame.stage + 1, [...frame.memory, event], 'pressure-redistributed', event);
}

export function liftLatestPressure(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false });
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'pressure-lifted', { committed: false, lifted: true });
}

export function releaseSheet() {
  return frameFrom(0, [], 'released', { committed: false, released: true });
}

export function buildTimeline() {
  const offers = [
    { x: 0.21, y: 0.34, duration: 220 },
    { x: 0.73, y: 0.23, duration: 360 },
    { x: 0.62, y: 0.61, duration: 480 },
    { x: 0.36, y: 0.68, duration: 620 }
  ];
  let frame = buildFrame();
  const frames = [frame];
  for (const offer of offers) {
    frame = applyPressure(frame, offer);
    frames.push(frame);
  }
  return frames;
}

export function faultPoint(frame, id) {
  const fault = frame.faults[id];
  return fault ? { x: fault.x, y: fault.y } : { x: 0.5, y: 0.5 };
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'resistant-crease',
  rule: 'a bounded pressure offer is refused locally and redistributes into a receding fault, a remote counterweight, and a scar in one compound sheet',
  memoryWindow: MEMORY_WINDOW
};
