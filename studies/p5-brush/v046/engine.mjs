export const MEMORY_LIMIT = 4;
export const STAGES = 9;
export const MASS_COUNT = 9;
export const VOID_COUNT = 5;
export const BANK_THRESHOLD = 0.18;

const SEED = 0x42523436;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(5));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0.02, 0.98)),
    y: round(clamp(Number(point.y) || 0, 0.04, 0.96))
  };
}

function baseMass() {
  return Array.from({ length: MASS_COUNT }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return {
      id: index,
      x: round(0.28 + column * 0.22 + (row % 2) * 0.025),
      y: round(0.25 + row * 0.25),
      z: round(-0.08 + (column - 1) * 0.055 + (row - 1) * 0.035),
      width: round(0.2 + seeded(index, 3) * 0.045),
      height: round(0.19 + seeded(index, 4) * 0.04),
      depth: round(0.18 + seeded(index, 5) * 0.08),
      angle: round((seeded(index, 6) - 0.5) * 0.18),
      cut: 0,
      tone: round(0.2 + seeded(index, 7) * 0.65)
    };
  });
}

function baseVoids() {
  return [
    { id: 0, x: 0.49, y: 0.27, z: 0.11, width: 0.09, height: 0.14, depth: 0.16, opening: 0.5, tilt: -0.2 },
    { id: 1, x: 0.61, y: 0.41, z: 0.09, width: 0.1, height: 0.12, depth: 0.2, opening: 0.42, tilt: 0.34 },
    { id: 2, x: 0.39, y: 0.49, z: 0.12, width: 0.11, height: 0.1, depth: 0.18, opening: 0.56, tilt: 0.12 },
    { id: 3, x: 0.58, y: 0.62, z: 0.1, width: 0.085, height: 0.13, depth: 0.17, opening: 0.46, tilt: -0.29 },
    { id: 4, x: 0.42, y: 0.74, z: 0.08, width: 0.095, height: 0.11, depth: 0.21, opening: 0.38, tilt: 0.22 }
  ];
}

function baseBody() {
  return {
    mass: baseMass(),
    voids: baseVoids(),
    seams: Array.from({ length: 8 }, (_, index) => ({
      id: index,
      a: round(0.2 + index * 0.073),
      b: round(0.8 - index * 0.061),
      bend: round((index % 2 ? -1 : 1) * (0.018 + seeded(index, 12) * 0.014)),
      weight: round(0.45 + seeded(index, 13) * 0.35)
    })),
    cuts: [],
    core: { x: 0.5, y: 0.5, z: 0, pressure: 0 }
  };
}

function normalizeEvent(event = {}) {
  return {
    source: event.source || 'unknown',
    type: 'through-void-cut',
    entry: normalizePoint(event.entry),
    exit: normalizePoint(event.exit),
    pressure: round(clamp(Number(event.pressure) || 0.7, 0.34, 1)),
    depth: round(clamp(Number(event.depth) || 0.58, 0.3, 1.25)),
    remotePiece: ((Math.floor(Number(event.remotePiece) || 0) % MASS_COUNT) + MASS_COUNT) % MASS_COUNT,
    remoteVoid: ((Math.floor(Number(event.remoteVoid) || 0) % VOID_COUNT) + VOID_COUNT) % VOID_COUNT,
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + 101)
  };
}

function buildBody(memory) {
  const body = baseBody();
  for (const [eventIndex, event] of memory.entries()) {
    const piece = body.mass[event.remotePiece];
    const voidCell = body.voids[event.remoteVoid];
    const pressure = event.pressure;
    const signedDepth = eventIndex % 2 ? -1 : 1;
    piece.z = round(piece.z + signedDepth * event.depth * 0.16);
    piece.width = round(clamp(piece.width * (1 + pressure * 0.07), 0.14, 0.34));
    piece.height = round(clamp(piece.height * (1 - pressure * 0.035), 0.13, 0.3));
    piece.depth = round(clamp(piece.depth + pressure * 0.06, 0.12, 0.42));
    piece.angle = round(piece.angle + signedDepth * pressure * 0.16);
    piece.cut = round(piece.cut + pressure);
    voidCell.depth = round(clamp(voidCell.depth + event.depth * 0.17, 0.1, 0.52));
    voidCell.opening = round(clamp(voidCell.opening + pressure * 0.19, 0.2, 1));
    voidCell.width = round(clamp(voidCell.width + pressure * 0.012, 0.06, 0.18));
    voidCell.tilt = round(voidCell.tilt + signedDepth * pressure * 0.13);
    for (const seam of body.seams) {
      const influence = Math.max(0.08, 1 - Math.abs(seam.id - event.remotePiece) * 0.12);
      seam.bend = round(seam.bend + signedDepth * influence * pressure * 0.025);
      seam.weight = round(clamp(seam.weight + influence * pressure * 0.05, 0.35, 1.2));
    }
    body.core.pressure = round(body.core.pressure + pressure * 0.18);
    body.cuts.push({ id: eventIndex, entry: event.entry, exit: event.exit, remotePiece: event.remotePiece, remoteVoid: event.remoteVoid, depth: event.depth, pressure: event.pressure, field: event.field });
  }
  return body;
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  return {
    grammar: 'depth-cut-monolith',
    renderer: 'deterministic p5.js 1.11.3 WebGL depth-cut monolith',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body: buildBody(boundedMemory),
    event: boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null,
    pending,
    state: { cutCount: boundedMemory.length },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

function bankSide(point) {
  if (point.x <= BANK_THRESHOLD) return 'left';
  if (point.x >= 1 - BANK_THRESHOLD) return 'right';
  if (point.y <= BANK_THRESHOLD) return 'top';
  if (point.y >= 1 - BANK_THRESHOLD) return 'bottom';
  return null;
}

function oppositeSide(a, b) {
  return (a === 'left' && b === 'right') || (a === 'right' && b === 'left') || (a === 'top' && b === 'bottom') || (a === 'bottom' && b === 'top');
}

function pathCrossesVoid(path) {
  return path.some((point) => point.x >= 0.4 && point.x <= 0.6 && point.y >= 0.35 && point.y <= 0.65);
}

function pendingWith(frame, patch, interaction) {
  return buildFrameFrom(frame.stage, frame.memory, interaction, { ...frame.pending, ...patch });
}

export function beginCut(frame, point) {
  const normalized = normalizePoint(point);
  const side = bankSide(normalized);
  if (!side) return buildFrameFrom(frame.stage, frame.memory, 'cut-refused-interior', frame.pending);
  return pendingWith(frame, { active: true, side, path: [normalized], entry: normalized, exit: null, throughVoid: false }, `cut-armed-${side}`);
}

export function continueCut(frame, point) {
  if (!frame.pending.active) return frame;
  const normalized = normalizePoint(point);
  const path = [...frame.pending.path, normalized].slice(-32);
  return pendingWith(frame, { path, throughVoid: frame.pending.throughVoid || pathCrossesVoid(path) }, 'cut-preview');
}

export function previewCut(frame, point) {
  return continueCut(frame, point);
}

function createEvent(frame, entry, exit, source) {
  const pressure = clamp(0.48 + Math.abs(exit.x - entry.x) * 0.42 + Math.abs(exit.y - entry.y) * 0.18 + frame.memory.length * 0.035, 0.34, 1);
  const remotePiece = ((frame.memory.length * 2 + Math.floor((entry.y + exit.y) * MASS_COUNT)) % MASS_COUNT + MASS_COUNT) % MASS_COUNT;
  const remoteVoid = ((frame.memory.length + Math.floor((entry.x + exit.x) * VOID_COUNT)) % VOID_COUNT + VOID_COUNT) % VOID_COUNT;
  return { source, type: 'through-void-cut', entry, exit, pressure, depth: 0.52 + pressure * 0.48, remotePiece, remoteVoid, field: hash(SEED + frame.memory.length * 7919 + remotePiece * 83 + remoteVoid * 17) };
}

export function commitCut(frame, point, source = 'visitor-through-void') {
  if (!frame.pending.active || !frame.pending.side) return buildFrameFrom(frame.stage, frame.memory, 'cut-refused-no-bank', frame.pending);
  const exit = normalizePoint(point);
  const exitSide = bankSide(exit);
  const path = [...frame.pending.path, exit];
  if (!exitSide || !oppositeSide(frame.pending.side, exitSide)) return pendingWith(frame, { active: false, exit, path }, 'cut-refused-exit');
  if (!pathCrossesVoid(path)) return pendingWith(frame, { active: false, exit, path }, 'cut-refused-bypass');
  const event = createEvent(frame, frame.pending.entry, exit, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'cut-committed');
}

export function applyCut(frame, entry, exit, path = [entry, { x: 0.5, y: 0.5 }, exit], source = 'control-through-void') {
  const start = normalizePoint(entry);
  const end = normalizePoint(exit);
  const startSide = bankSide(start);
  const endSide = bankSide(end);
  if (!startSide || !endSide || !oppositeSide(startSide, endSide) || !pathCrossesVoid(path.map(normalizePoint))) return buildFrameFrom(frame.stage, frame.memory, 'cut-refused-route', frame.pending);
  const event = createEvent(frame, start, end, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'cut-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused', frame.pending);
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const routes = [
    [{ x: 0.08, y: 0.42 }, { x: 0.5, y: 0.5 }, { x: 0.92, y: 0.58 }],
    [{ x: 0.92, y: 0.38 }, { x: 0.5, y: 0.5 }, { x: 0.08, y: 0.62 }],
    [{ x: 0.44, y: 0.08 }, { x: 0.5, y: 0.5 }, { x: 0.56, y: 0.92 }],
    [{ x: 0.56, y: 0.92 }, { x: 0.5, y: 0.5 }, { x: 0.44, y: 0.08 }]
  ];
  let frame = buildFrame();
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    const route = routes[(stage - 1) % routes.length];
    frame = applyCut(frame, route[0], route.at(-1), route, 'timeline-through-void');
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.body);
}
