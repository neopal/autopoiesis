export const SEED = 0x57473043;
export const CELL_COUNT = 12;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const RESISTANCE_THRESHOLD = 0.62;
export const SPAN_THRESHOLD = 0.58;
export const MAX_SPAN = 1.25;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 13.173 + SEED * 0.000013) * 43758.5453;
  return raw - Math.floor(raw);
};

const membraneAnchors = [
  { x: -0.88, y: 0.34, z: -0.12 }, { x: -0.7, y: 0.14, z: 0.03 },
  { x: -0.49, y: 0.28, z: 0.16 }, { x: -0.26, y: 0.04, z: -0.04 },
  { x: -0.04, y: 0.2, z: 0.12 }, { x: 0.19, y: -0.04, z: -0.08 },
  { x: 0.42, y: 0.16, z: 0.11 }, { x: 0.65, y: -0.04, z: -0.06 },
  { x: 0.88, y: 0.18, z: 0.13 }, { x: 0.58, y: -0.28, z: -0.12 },
  { x: 0.04, y: -0.24, z: 0.08 }, { x: -0.55, y: -0.23, z: -0.07 }
];

const point = (value = {}, fallback = membraneAnchors[0]) => ({
  x: clamp(finite(value.x, fallback.x), -1, 1),
  y: clamp(finite(value.y, fallback.y), -1, 1)
});

const nearestCell = (value = {}) => {
  const candidate = point(value, { x: 0, y: 0 });
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  membraneAnchors.forEach((anchor, index) => {
    const next = (candidate.x - anchor.x) ** 2 + (candidate.y - anchor.y) ** 2;
    if (next < distance) {
      nearest = index;
      distance = next;
    }
  });
  return nearest;
};

const baseCells = () => membraneAnchors.map((anchor, id) => ({
  id,
  x: round(anchor.x),
  y: round(anchor.y),
  z: round(anchor.z),
  width: round(0.3 + pseudo(id + 2) * 0.07),
  height: round(0.25 + pseudo(id + 12) * 0.08),
  twist: round((pseudo(id + 22) - 0.5) * 0.52),
  phase: round(pseudo(id + 32) * Math.PI * 2),
  facetCount: 4,
  resistance: 0,
  ridge: 0,
  warp: 0
}));

const cloneCell = (cell) => ({ ...cell });
const circularDistance = (a, b) => {
  const direct = Math.abs(a - b);
  return Math.min(direct, CELL_COUNT - direct);
};
const receiverFor = (sourceIndex, serial, direction) => {
  const step = direction >= 0 ? 4 + serial * 2 : -(5 + serial * 2);
  let receiver = wrap(sourceIndex + step, CELL_COUNT);
  if (receiver === sourceIndex) receiver = wrap(receiver + (direction >= 0 ? 3 : -3), CELL_COUNT);
  return receiver;
};
const normalizeDirection = (value, fallback = 1) => finite(value, fallback) < 0 ? -1 : 1;

const normalizeEvent = (event = {}, serial = 0) => {
  const sourceIndex = integer(event.sourceIndex, 0, 0, CELL_COUNT - 1);
  const direction = normalizeDirection(event.direction, serial % 2 === 0 ? 1 : -1);
  const span = round(clamp(finite(event.span, SPAN_THRESHOLD + 0.14), SPAN_THRESHOLD, MAX_SPAN));
  const alignment = round(clamp(finite(event.alignment, RESISTANCE_THRESHOLD + 0.12), RESISTANCE_THRESHOLD, 1));
  const resistance = round(clamp(
    ((span - SPAN_THRESHOLD) / (MAX_SPAN - SPAN_THRESHOLD)) * 0.45 +
      ((alignment - RESISTANCE_THRESHOLD) / (1 - RESISTANCE_THRESHOLD)) * 0.55,
    0.08,
    1
  ));
  return {
    id: `resistance-transfer-${serial + 1}`,
    mode: 'resistance-transfer',
    sourceIndex,
    receiverIndex: receiverFor(sourceIndex, serial, direction),
    direction,
    span,
    alignment,
    resistance,
    serial
  };
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const baseField = () => ({
  kind: 'resistance-membrane',
  cells: baseCells(),
  transfers: [],
  sourceIndex: null,
  receiverIndex: null,
  signature: ''
});

const buildField = (memory) => {
  let field = baseField();
  const transfers = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const previous = field.cells.map(cloneCell);
    const receiver = event.receiverIndex;
    const source = event.sourceIndex;
    const next = previous.map((cell, index) => {
      if (index === source) return cloneCell(cell);
      const distance = circularDistance(index, receiver);
      const influence = Math.exp(-(distance * distance) / (2.2 + serial * 0.7));
      const remote = index === receiver ? 1 : influence * 0.12;
      const sign = event.direction * (serial % 2 === 0 ? 1 : -1);
      return {
        ...cell,
        x: round(clamp(cell.x + sign * remote * event.resistance * 0.065, -1, 1)),
        y: round(clamp(cell.y + remote * event.resistance * (serial % 2 ? 0.045 : -0.035), -0.8, 0.8)),
        z: round(clamp(cell.z + remote * event.resistance * (index === receiver ? 0.22 : 0.025), -0.6, 0.6)),
        width: round(clamp(cell.width + remote * event.resistance * (index === receiver ? 0.08 : 0.012), 0.18, 0.6)),
        height: round(clamp(cell.height + remote * event.resistance * (index === receiver ? 0.1 : 0.014), 0.16, 0.6)),
        twist: round(cell.twist + sign * remote * event.resistance * (index === receiver ? 0.32 : 0.04)),
        phase: round(cell.phase + remote * event.resistance * 0.44),
        facetCount: cell.facetCount + (index === receiver ? 2 + serial : 0),
        resistance: round(clamp(cell.resistance + remote * event.resistance * (index === receiver ? 1 : 0.08), 0, 1)),
        ridge: round(clamp(cell.ridge + remote * event.resistance * (index === receiver ? 0.9 : 0.06), 0, 1)),
        warp: round(clamp(cell.warp + remote * event.resistance * (index === receiver ? sign : 0.08 * sign), -1, 1))
      };
    });
    const transfer = {
      sourceIndex: source,
      receiverIndex: receiver,
      direction: event.direction,
      resistance: event.resistance,
      span: event.span,
      alignment: event.alignment,
      serial
    };
    field = { ...field, cells: next, sourceIndex: source, receiverIndex: receiver };
    transfers.push(transfer);
  });
  field.transfers = transfers;
  field.signature = JSON.stringify({
    kind: field.kind,
    sourceIndex: field.sourceIndex,
    receiverIndex: field.receiverIndex,
    transfers,
    cells: field.cells.map(({ id, x, y, z, width, height, twist, phase, facetCount, resistance, ridge, warp }) => ({
      id, x, y, z, width, height, twist, phase, facetCount, resistance, ridge, warp
    }))
  });
  return field;
};

const normalizeGesture = (gesture) => {
  if (!gesture) return null;
  return {
    x: clamp(finite(gesture.x, 0), -1, 1),
    y: clamp(finite(gesture.y, 0), -1, 1),
    sourceIndex: integer(gesture.sourceIndex, 0, 0, CELL_COUNT - 1),
    startedAt: finite(gesture.startedAt, 0),
    span: clamp(finite(gesture.span, 0), 0, MAX_SPAN),
    alignment: clamp(finite(gesture.alignment, 0), 0, 1),
    direction: normalizeDirection(gesture.direction, 1)
  };
};

export const buildFrame = (stage = 0, memory = [], gesture = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, 0, STAGES - 1),
    memory: normalizedMemory,
    gesture: normalizeGesture(gesture),
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const beginTrace = (frame, input = {}) => {
  const sourceIndex = Number.isInteger(input.index) ? integer(input.index, 0, 0, CELL_COUNT - 1) : nearestCell(input);
  const anchor = membraneAnchors[sourceIndex];
  const nextPoint = point(input, anchor);
  const gesture = {
    x: nextPoint.x,
    y: nextPoint.y,
    sourceIndex,
    startedAt: finite(input.time, 0),
    span: 0,
    alignment: 0,
    direction: normalizeDirection(input.direction, 1)
  };
  return { ...frame, gesture, lastAction: 'trace-started' };
};

export const updateTrace = (frame, input = {}) => {
  if (!frame.gesture) return frame;
  const span = clamp(finite(input.span, frame.gesture.span), 0, MAX_SPAN);
  const alignment = clamp(finite(input.alignment, frame.gesture.alignment), 0, 1);
  const direction = normalizeDirection(input.direction, frame.gesture.direction);
  const nextPoint = point(input, frame.gesture);
  return {
    ...frame,
    gesture: { ...frame.gesture, x: nextPoint.x, y: nextPoint.y, span, alignment, direction },
    lastAction: span >= SPAN_THRESHOLD && alignment >= RESISTANCE_THRESHOLD ? 'trace-armed' : 'trace-open'
  };
};

export const finishTrace = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, gesture: null, lastAction: 'trace-refused-memory-limit' };
  if (!frame.gesture) return { ...frame, lastAction: 'trace-refused-missing' };
  const span = clamp(finite(input.span, frame.gesture.span), 0, MAX_SPAN);
  const alignment = clamp(finite(input.alignment, frame.gesture.alignment), 0, 1);
  const direction = normalizeDirection(input.direction, frame.gesture.direction);
  if (span < SPAN_THRESHOLD || alignment < RESISTANCE_THRESHOLD) return { ...frame, gesture: null, lastAction: 'trace-refused-resistance' };
  if (input.confirmed === false) return { ...frame, gesture: null, lastAction: 'trace-refused-unconfirmed' };
  const event = normalizeEvent({ sourceIndex: frame.gesture.sourceIndex, direction, span, alignment }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'trace-committed');
};

export const liftLatestTrace = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'trace-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultTrace = (frame) => {
  const presets = [
    { index: 2, span: SPAN_THRESHOLD + 0.13, alignment: RESISTANCE_THRESHOLD + 0.12, direction: 1 },
    { index: 8, span: SPAN_THRESHOLD + 0.2, alignment: RESISTANCE_THRESHOLD + 0.2, direction: -1 },
    { index: 5, span: SPAN_THRESHOLD + 0.32, alignment: RESISTANCE_THRESHOLD + 0.26, direction: 1 },
    { index: 11, span: SPAN_THRESHOLD + 0.44, alignment: RESISTANCE_THRESHOLD + 0.32, direction: -1 }
  ];
  return presets[frame.memory.length % presets.length];
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    const preset = defaultTrace(frame);
    frame = finishTrace(beginTrace(frame, { index: preset.index, time: 0, direction: preset.direction }), preset);
    timeline.push(buildFrame(stage, frame.memory, null, 'settled-transfer'));
  }
  return timeline;
};

export const geometrySignature = (frame) => frame.field.signature;
export const cellAnchors = () => membraneAnchors.map((entry, id) => ({ id, ...entry }));
