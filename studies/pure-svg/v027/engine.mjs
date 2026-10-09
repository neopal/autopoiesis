export const SEED = 0x53564727;
export const STAGES = 13;
export const ROW_COUNT = 11;
export const SEGMENT_COUNT = 9;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = ROW_COUNT;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const BASE_Y = Array.from({ length: ROW_COUNT }, (_, index) => 72 + index * 53);
const BASE_X = Array.from({ length: SEGMENT_COUNT + 1 }, (_, index) => 74 + index * 94);
const THICKNESS = [18, 21, 16, 23, 19, 25, 17, 22, 18, 24, 20];
const SEAM_RESISTANCE = [0.42, 0.66, 0.51, 0.73, 0.38, 0.59, 0.48, 0.71, 0.45];

function boundedStage(stage) {
  return clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
}

function safeLoad(load = {}) {
  const x = Number.isFinite(Number(load.x)) ? Number(load.x) : 0.5;
  const y = Number.isFinite(Number(load.y)) ? Number(load.y) : 0.5;
  return { x: Number(clamp(x, 0, 1).toFixed(4)), y: Number(clamp(y, 0, 1).toFixed(4)) };
}

function pointSignature([x, y]) {
  return `${Number(x).toFixed(3)},${Number(y).toFixed(3)}`;
}

function pointsSignature(points) {
  return points.map(pointSignature).join('|');
}

function baseRow(rowIndex, stage) {
  const stageValue = boundedStage(stage);
  return BASE_X.map((x, segment) => [
    Number((x + Math.sin(rowIndex * 1.43 + segment * 0.71 + stageValue * 0.06) * 10).toFixed(3)),
    Number((BASE_Y[rowIndex] + Math.sin(segment * 0.91 + rowIndex * 0.63 + stageValue * 0.08) * 8).toFixed(3))
  ]);
}

function chooseSeam(stage, memory, load) {
  let selected = 0;
  let lowest = Number.POSITIVE_INFINITY;
  const normalizedStage = boundedStage(stage) / STAGES;
  for (let seam = 0; seam < SEGMENT_COUNT; seam += 1) {
    let resistance = SEAM_RESISTANCE[seam] + normalizedStage * 0.025;
    const seamPosition = seam / (SEGMENT_COUNT - 1);
    resistance += Math.abs(load.x - seamPosition) * 0.11;
    resistance += Math.abs(load.y - 0.5) * (0.015 + seam * 0.001);
    for (const event of memory) {
      if (event.seam === seam) resistance += 0.24;
      if (Math.abs(event.seam - seam) === 1) resistance -= 0.035;
    }
    if (resistance < lowest) {
      lowest = resistance;
      selected = seam;
    }
  }
  return selected;
}

function eventFor(stage, memory, loadInput, origin = 'visitor-puncture') {
  const load = safeLoad(loadInput);
  const seam = chooseSeam(stage, memory, load);
  const focusRow = clamp(Math.round(load.y * (ROW_COUNT - 1)), 0, ROW_COUNT - 1);
  const force = Number((0.82 + load.x * 0.18 + ((memory.length + boundedStage(stage)) % 4) * 0.06).toFixed(4));
  return {
    kind: 'material-slip',
    mode: 'weakest-seam',
    gesture: 'pressure-puncture',
    origin,
    stage: boundedStage(stage),
    seam,
    focusRow,
    force,
    pressure: load,
    ordinal: memory.length
  };
}

function materializeRow(rowIndex, stage, memory) {
  const centre = baseRow(rowIndex, stage);
  const thickness = THICKNESS[rowIndex];
  const top = centre.map(([x, y], index) => [x, y - thickness / 2 - (index % 2) * 2]);
  const bottom = centre.map(([x, y], index) => [x, y + thickness / 2 + (index % 3) * 1.5]);

  memory.forEach((event, memoryIndex) => {
    const direction = memoryIndex % 2 === 0 ? 1 : -1;
    const rowDistance = Math.abs(rowIndex - event.focusRow) / Math.max(1, ROW_COUNT - 1);
    const rowInfluence = 0.36 + (1 - rowDistance) * 0.64;
    const seam = event.seam;
    const slip = (7.5 + event.force * 7) * rowInfluence * direction;
    const crease = Math.sin((rowIndex + 1) * 0.7 + memoryIndex) * 2.8 * rowInfluence;
    for (let point = 0; point < top.length; point += 1) {
      if (point > seam) {
        const distance = point - seam;
        const offset = slip * Math.min(1, distance / 2);
        top[point][0] += offset;
        bottom[point][0] += offset;
        top[point][1] += crease + direction * distance * 0.95 * rowInfluence;
        bottom[point][1] += crease + direction * distance * 0.95 * rowInfluence;
      }
      if (point === seam || point === seam + 1) {
        top[point][1] -= direction * (3.5 + event.force * 2) * rowInfluence;
        bottom[point][1] += direction * (3.5 + event.force * 2) * rowInfluence;
      }
    }
    if (rowIndex === event.focusRow) {
      top[seam][1] -= 5.5 * direction;
      bottom[seam][1] += 5.5 * direction;
    }
  });

  const roundPoints = (points) => points.map(([x, y]) => [Number(x.toFixed(3)), Number(y.toFixed(3))]);
  const roundedTop = roundPoints(top);
  const roundedBottom = roundPoints(bottom);
  return {
    index: rowIndex,
    top: roundedTop,
    bottom: roundedBottom,
    pathSignature: `${pointsSignature(roundedTop)}//${pointsSignature(roundedBottom)}`
  };
}

export function buildFrame(stage, memory = []) {
  const safeStage = boundedStage(stage);
  const inherited = memory.map((event) => ({ ...event, pressure: event.pressure ? { ...event.pressure } : undefined })).slice(-MEMORY_LIMIT);
  const rows = Array.from({ length: ROW_COUNT }, (_, rowIndex) => materializeRow(rowIndex, safeStage, inherited));
  const frame = {
    stage: safeStage,
    grammar: 'slip-strata',
    rows,
    memory: inherited,
    primitiveBudget: PRIMITIVE_BUDGET,
    armed: null,
    interaction: 'quiet'
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    if (stage > 0 && stage % 3 === 0) {
      memory = [...memory, eventFor(stage, memory, { x: 0.18 + (stage % 5) * 0.16, y: 0.16 + (stage % 4) * 0.21 }, 'timeline-puncture')].slice(-MEMORY_LIMIT);
    }
    return buildFrame(stage, memory);
  });
}

export function armLoad(frame, loadInput = {}) {
  return { ...frame, armed: safeLoad(loadInput), interaction: 'pressure-armed', signature: geometrySignature(frame) };
}

export function applyLoad(frame, loadInput = {}) {
  if (frame.memory.length >= MEMORY_LIMIT) {
    return {
      ...frame,
      event: { kind: 'material-slip', committed: false, origin: 'visitor-puncture' },
      interaction: 'material-memory-full',
      signature: geometrySignature(frame)
    };
  }
  const load = frame.armed ?? safeLoad(loadInput);
  const event = eventFor(frame.stage, frame.memory, load);
  const next = buildFrame(frame.stage, [...frame.memory, event]);
  return { ...next, event: { ...event, committed: true }, priorMemory: frame.memory.map((entry) => ({ ...entry })), interaction: 'material-slip' };
}

export function liftLatestSlip(frame) {
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'lifted' };
}

export function releaseStrata() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  return JSON.stringify({ stage: frame.stage, rows: frame.rows.map((row) => row.pathSignature), memory: frame.memory });
}
