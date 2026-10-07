export const SEED = 0x4e413235;
export const STAGES = 17;
export const MEMORY_WINDOW = 4;
export const PRIMITIVE_BUDGET = 46;
export const PIECE_COUNT = 12;

const PALETTE = ['#e7c98c', '#d95f45', '#477f83', '#e0a74f', '#9f6f7c', '#f0d9b2'];
const POINTS = [
  [0.22, 0.19], [0.43, 0.17], [0.64, 0.20], [0.78, 0.28],
  [0.20, 0.41], [0.42, 0.39], [0.64, 0.42], [0.80, 0.48],
  [0.24, 0.64], [0.45, 0.63], [0.65, 0.65], [0.76, 0.72]
];

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const clampCenter = (value) => Math.max(0.2, Math.min(0.8, Number(value) || 0.5));
const clampStage = (stage) => Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0)));
const round = (value) => Number(value.toFixed(6));

function clonePoint(point) {
  return [point[0], point[1]];
}

function clonePiece(piece) {
  return { ...piece, points: piece.points.map(clonePoint) };
}

function cloneAperture(aperture) {
  return { ...aperture };
}

function normalizeMemory(memory) {
  return (Array.isArray(memory) ? memory : []).slice(-MEMORY_WINDOW).map((event) => ({
    ...event,
    beforeAperture: cloneAperture(event.beforeAperture),
    afterAperture: cloneAperture(event.afterAperture)
  }));
}

function basePieces() {
  return POINTS.map(([cx, cy], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const w = 0.225 - (row % 2) * 0.012;
    const h = 0.245 + (col % 2) * 0.014;
    const wobble = ((index * 7) % 5 - 2) * 0.006;
    return {
      id: `piece-${String(index).padStart(2, '0')}`,
      cx,
      cy,
      width: w,
      height: h,
      tone: PALETTE[index % PALETTE.length],
      layer: row + (col % 3) * 0.04,
      crease: 0,
      points: [
        [cx - w * 0.48, cy - h * (0.43 + wobble)],
        [cx + w * 0.43, cy - h * 0.36],
        [cx + w * 0.49, cy + h * 0.37],
        [cx + w * 0.10, cy + h * 0.51],
        [cx - w * 0.48, cy + h * 0.40],
        [cx - w * 0.56, cy - h * 0.05]
      ]
    };
  });
}

function baseScene() {
  return {
    pieces: basePieces(),
    aperture: { x: 0.52, y: 0.49, radius: 0.105, width: 0.17, rotation: -0.12 },
    cutLine: { x: 0.31, y: 0.17, length: 0.56, angle: 0.08 },
    trace: {
      grammar: 'pressure → global cut → displaced body → inherited aperture',
      pressureCount: 0,
      changedPieceCount: 0,
      pointerOnlyChanges: 0,
      globalCut: 0,
      apertureShiftCount: 0,
      nextRule: 'press-the-sheet'
    }
  };
}

function copyAperture(aperture) {
  return { ...aperture };
}

function eventFor(frame, input = {}) {
  const sequence = frame.memory.length;
  const fallback = [
    [0.68, 0.34], [0.28, 0.64], [0.78, 0.72], [0.43, 0.24]
  ][sequence % 4];
  const x = clamp01(input.x ?? fallback[0]);
  const y = clamp01(input.y ?? fallback[1]);
  const duration = Math.max(120, Math.min(900, Math.floor(Number(input.duration) || 180)));
  const pressure = round(Math.max(0.2, Math.min(1, duration / 420)));
  const beforeAperture = copyAperture(frame.scene.aperture);
  const direction = sequence % 2 === 0 ? 1 : -1;
  const afterAperture = {
    x: round(clampCenter(beforeAperture.x + (x - 0.5) * 0.20 + direction * 0.035)),
    y: round(clampCenter(beforeAperture.y + (y - 0.5) * 0.18 - direction * 0.028)),
    radius: round(Math.min(0.25, beforeAperture.radius + 0.018 + pressure * 0.032)),
    width: round(Math.min(0.34, beforeAperture.width + 0.022 + pressure * 0.026)),
    rotation: round(beforeAperture.rotation + direction * (0.14 + pressure * 0.08))
  };
  return {
    source: 'global-pressure-cut',
    sequence,
    x,
    y,
    duration,
    pressure,
    beforeAperture,
    afterAperture,
    reason: 'pressure changes the cut that rebuilds the whole sheet'
  };
}

function applyPressure(scene, event) {
  const aperture = event.afterAperture;
  const angle = aperture.rotation + event.sequence * 0.21;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const horizon = event.pressure * (0.022 + event.sequence * 0.004);

  scene.pieces = scene.pieces.map((piece, index) => {
    const radialX = piece.cx - aperture.x;
    const radialY = piece.cy - aperture.y;
    const radialDistance = Math.max(0.001, Math.hypot(radialX, radialY));
    const influence = Math.max(0, 1 - radialDistance / (0.58 + event.sequence * 0.02));
    const along = radialX * cos + radialY * sin;
    const side = radialX * -sin + radialY * cos;
    const sign = along >= 0 ? 1 : -1;
    const crease = round(piece.crease + sign * horizon * (0.55 + influence));
    const drift = round((sign * horizon * (0.45 + influence) + side * event.pressure * 0.035));
    const bend = round((event.pressure * 0.018 + influence * 0.025) * (index % 2 === 0 ? 1 : -1));
    const points = piece.points.map(([px, py]) => {
      const localX = px - piece.cx;
      const localY = py - piece.cy;
      const x = px + drift * cos - bend * localY;
      const y = py + drift * sin + bend * localX;
      const holeDistance = Math.hypot(x - aperture.x, y - aperture.y);
      const repel = Math.max(0, aperture.radius * 1.35 - holeDistance) * 0.34;
      const safeX = holeDistance > 0.001 ? (x - aperture.x) / holeDistance : 0;
      const safeY = holeDistance > 0.001 ? (y - aperture.y) / holeDistance : 0;
      return [round(x + safeX * repel), round(y + safeY * repel)];
    });
    return {
      ...piece,
      cx: round(piece.cx + drift * cos),
      cy: round(piece.cy + drift * sin),
      crease,
      layer: round(piece.layer + sign * event.pressure * 0.05),
      points
    };
  });

  scene.aperture = aperture;
  scene.cutLine = {
    x: round(clamp01(aperture.x - cos * 0.30)),
    y: round(clamp01(aperture.y - sin * 0.30)),
    length: round(Math.min(0.84, 0.56 + event.pressure * 0.12 + event.sequence * 0.025)),
    angle: round(angle)
  };
  scene.trace.pressureCount += 1;
  scene.trace.changedPieceCount += scene.pieces.length;
  scene.trace.globalCut = round(scene.trace.globalCut + event.pressure * (0.9 + event.sequence * 0.12));
  scene.trace.apertureShiftCount += 1;
  scene.trace.nextRule = 'inherit-the-cut';
}

export function buildScene(memory = []) {
  const scene = baseScene();
  normalizeMemory(memory).forEach((event) => applyPressure(scene, event));
  return scene;
}

export function buildFrame(stage = 0, memory = []) {
  const boundedMemory = normalizeMemory(memory);
  return {
    stage: clampStage(stage),
    stages: STAGES,
    memory: boundedMemory,
    primitiveCount: PRIMITIVE_BUDGET,
    scene: buildScene(boundedMemory),
    interaction: 'sequence'
  };
}

export function pressAt(frame, input = {}) {
  const current = frame ?? buildFrame(0, []);
  const event = eventFor(current, input);
  const nextMemory = normalizeMemory([...current.memory, event]);
  return {
    ...buildFrame(Math.min(STAGES - 1, current.stage + 1), nextMemory),
    interaction: 'pressure-committed'
  };
}

export function liftLatestPressure(frame) {
  const current = frame ?? buildFrame(0, []);
  if (!current.memory.length) return { ...current, interaction: 'pressure-lifted' };
  return {
    ...buildFrame(Math.max(0, current.stage - 1), current.memory.slice(0, -1)),
    interaction: 'pressure-lifted'
  };
}

export function releasePressure() {
  return { ...buildFrame(0, []), interaction: 'released' };
}

export function geometrySignature(frame) {
  const scene = frame?.scene ?? buildScene([]);
  return JSON.stringify({
    aperture: scene.aperture,
    cutLine: scene.cutLine,
    pieces: scene.pieces.map((piece) => ({ id: piece.id, cx: piece.cx, cy: piece.cy, crease: piece.crease, points: piece.points })),
    trace: scene.trace
  });
}

export function buildTimeline() {
  const timeline = [];
  let frame = buildFrame(0, []);
  for (let stage = 0; stage < STAGES; stage += 1) {
    timeline.push({ ...frame, stage });
    if (stage < STAGES - 1) frame = pressAt(frame);
  }
  return timeline;
}

export function pieceAt(frame, index) {
  const piece = frame?.scene?.pieces?.[index];
  return piece ? clonePiece(piece) : null;
}
