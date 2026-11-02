export const SEED = 0x57475042;
export const WITNESS_COUNT = 18;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const LOOP_THRESHOLD = 0.78;
export const MAX_ARC = 1.45;
export const CLOSURE_LIMIT = 0.18;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 17.917 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};

const anchors = [
  { x: 0.14, y: 0.22 }, { x: 0.28, y: 0.17 }, { x: 0.43, y: 0.21 },
  { x: 0.58, y: 0.15 }, { x: 0.75, y: 0.23 }, { x: 0.86, y: 0.36 },
  { x: 0.73, y: 0.47 }, { x: 0.88, y: 0.62 }, { x: 0.69, y: 0.72 },
  { x: 0.82, y: 0.85 }, { x: 0.58, y: 0.79 }, { x: 0.46, y: 0.91 },
  { x: 0.31, y: 0.77 }, { x: 0.16, y: 0.84 }, { x: 0.23, y: 0.62 },
  { x: 0.11, y: 0.49 }, { x: 0.34, y: 0.46 }, { x: 0.54, y: 0.57 }
];

const point = (value = {}, fallback = anchors[0]) => ({
  x: clamp(finite(value.x, fallback.x), 0, 1),
  y: clamp(finite(value.y, fallback.y), 0, 1)
});

const pointIndex = (value = {}) => {
  const candidate = point(value);
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  anchors.forEach((entry, index) => {
    const next = (candidate.x - entry.x) ** 2 + (candidate.y - entry.y) ** 2;
    if (next < distance) {
      nearest = index;
      distance = next;
    }
  });
  return nearest;
};

const circularDistance = (a, b) => {
  const direct = Math.abs(a - b);
  return Math.min(direct, WITNESS_COUNT - direct);
};

const baseWitnesses = () => anchors.map((anchor, id) => ({
  id,
  x: round(anchor.x),
  y: round(anchor.y),
  size: round(0.036 + pseudo(id + 9) * 0.026),
  angle: round((pseudo(id + 19) - 0.5) * 0.9),
  phase: round(pseudo(id + 29) * Math.PI * 2),
  mass: round(0.32 + pseudo(id + 39) * 0.54),
  opacity: round(0.48 + pseudo(id + 49) * 0.45),
  echo: 0,
  wake: 0
}));

const baseField = () => ({
  kind: 'shadow-quorum',
  witnesses: baseWitnesses(),
  sourceIndex: null,
  receiverIndex: null,
  direction: 0,
  shadows: [],
  signature: ''
});

const cloneWitness = (witness) => ({ ...witness });

const receiverFor = (sourceIndex, serial, direction) => {
  const step = direction >= 0 ? 6 + serial * 3 : -(7 + serial * 2);
  let receiver = wrap(sourceIndex + step, WITNESS_COUNT);
  if (receiver === sourceIndex) receiver = wrap(receiver + (direction >= 0 ? 5 : -5), WITNESS_COUNT);
  return receiver;
};

const normalizeDirection = (value, fallback = 1) => finite(value, fallback) < 0 ? -1 : 1;

const normalizeEvent = (event = {}, serial = 0) => {
  const sourceIndex = integer(event.sourceIndex, 0, 0, WITNESS_COUNT - 1);
  const direction = normalizeDirection(event.direction, serial % 2 === 0 ? 1 : -1);
  const arc = round(clamp(finite(event.arc, LOOP_THRESHOLD + 0.12), LOOP_THRESHOLD, MAX_ARC));
  const closure = round(clamp(finite(event.closure, 0.08), 0, CLOSURE_LIMIT));
  const tension = round(clamp((arc - LOOP_THRESHOLD) / (MAX_ARC - LOOP_THRESHOLD), 0.06, 1));
  return {
    id: `shadow-quorum-${serial + 1}`,
    mode: 'shadow-quorum',
    sourceIndex,
    receiverIndex: receiverFor(sourceIndex, serial, direction),
    direction,
    arc,
    closure,
    tension,
    serial
  };
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const buildField = (memory) => {
  let field = baseField();
  const shadows = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const previous = field.witnesses.map(cloneWitness);
    const receiver = event.receiverIndex;
    const source = event.sourceIndex;
    const next = previous.map((witness, index) => {
      if (index === source) return cloneWitness(witness);
      const distance = circularDistance(index, receiver);
      const influence = Math.exp(-(distance * distance) / (2.7 + serial * 0.8));
      const remote = index === receiver ? 1 : influence * 0.19;
      const sign = event.direction * (serial % 2 === 0 ? 1 : -1);
      return {
        ...witness,
        x: round(clamp(witness.x + sign * remote * event.tension * 0.028, 0.05, 0.95)),
        y: round(clamp(witness.y + remote * event.tension * (serial % 2 ? 0.021 : -0.017), 0.05, 0.95)),
        size: round(clamp(witness.size + remote * event.tension * (index === receiver ? 0.024 : 0.008), 0.016, 0.11)),
        angle: round(witness.angle + sign * remote * event.tension * 0.34),
        phase: round(witness.phase + remote * event.tension * (0.42 + pseudo(index + serial * 13) * 0.22)),
        mass: round(clamp(witness.mass + remote * event.tension * 0.18, 0.12, 1)),
        opacity: round(clamp(witness.opacity + remote * event.tension * (index === receiver ? 0.14 : 0.035), 0.18, 1)),
        echo: round(clamp(witness.echo + remote * event.tension * (index === receiver ? 1 : 0.12), 0, 1)),
        wake: round(clamp(witness.wake + remote * event.tension * (index === receiver ? 0.9 : 0.08), 0, 1))
      };
    });
    const shadow = {
      sourceIndex: source,
      receiverIndex: receiver,
      direction: event.direction,
      tension: event.tension,
      arc: event.arc,
      serial
    };
    field = { ...field, witnesses: next, sourceIndex: source, receiverIndex: receiver, direction: event.direction };
    shadows.push(shadow);
  });
  field.shadows = shadows;
  field.signature = JSON.stringify({
    kind: field.kind,
    sourceIndex: field.sourceIndex,
    receiverIndex: field.receiverIndex,
    direction: field.direction,
    shadows,
    witnesses: field.witnesses.map(({ id, x, y, size, angle, phase, mass, opacity, echo, wake }) => ({ id, x, y, size, angle, phase, mass, opacity, echo, wake }))
  });
  return field;
};

const normalizeGesture = (gesture) => {
  if (!gesture) return null;
  return {
    x: clamp(finite(gesture.x, 0.5), 0, 1),
    y: clamp(finite(gesture.y, 0.5), 0, 1),
    sourceIndex: integer(gesture.sourceIndex, 0, 0, WITNESS_COUNT - 1),
    startedAt: finite(gesture.startedAt, 0),
    arc: clamp(finite(gesture.arc, 0), 0, MAX_ARC),
    closure: clamp(finite(gesture.closure, 1), 0, 1),
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

export const beginCircuit = (frame, input = {}) => {
  const sourceIndex = Number.isInteger(input.index) ? integer(input.index, 0, 0, WITNESS_COUNT - 1) : pointIndex(input);
  const nextPoint = point(input, anchors[sourceIndex]);
  const gesture = {
    x: nextPoint.x,
    y: nextPoint.y,
    sourceIndex,
    startedAt: finite(input.time, 0),
    arc: 0,
    closure: 1,
    direction: normalizeDirection(input.direction, 1)
  };
  return { ...frame, gesture, lastAction: 'circuit-started' };
};

export const updateCircuit = (frame, input = {}) => {
  if (!frame.gesture) return frame;
  const arc = clamp(finite(input.arc, frame.gesture.arc), 0, MAX_ARC);
  const closure = clamp(finite(input.closure, frame.gesture.closure), 0, 1);
  const direction = normalizeDirection(input.direction, frame.gesture.direction);
  const nextPoint = point(input, frame.gesture);
  return {
    ...frame,
    gesture: { ...frame.gesture, x: nextPoint.x, y: nextPoint.y, arc, closure, direction },
    lastAction: arc >= LOOP_THRESHOLD && closure <= CLOSURE_LIMIT ? 'circuit-armed' : 'circuit-open'
  };
};

export const finishCircuit = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, gesture: null, lastAction: 'circuit-refused-memory-limit' };
  if (!frame.gesture) return { ...frame, lastAction: 'circuit-refused-missing' };
  const arc = clamp(finite(input.arc, frame.gesture.arc), 0, MAX_ARC);
  const closure = clamp(finite(input.closure, frame.gesture.closure), 0, 1);
  const direction = normalizeDirection(input.direction, frame.gesture.direction);
  if (arc < LOOP_THRESHOLD || closure > CLOSURE_LIMIT) return { ...frame, gesture: null, lastAction: 'circuit-refused-open' };
  if (input.confirmed === false) return { ...frame, gesture: null, lastAction: 'circuit-refused-unconfirmed' };
  const event = normalizeEvent({ sourceIndex: frame.gesture.sourceIndex, direction, arc, closure }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'circuit-committed');
};

export const liftLatestCircuit = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'circuit-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultCircuit = (frame) => {
  const presets = [
    { x: 0.84, y: 0.5, arc: LOOP_THRESHOLD + 0.08, closure: 0.08, direction: 1 },
    { x: 0.16, y: 0.84, arc: LOOP_THRESHOLD + 0.21, closure: 0.06, direction: -1 },
    { x: 0.28, y: 0.17, arc: LOOP_THRESHOLD + 0.38, closure: 0.1, direction: 1 },
    { x: 0.73, y: 0.72, arc: LOOP_THRESHOLD + 0.55, closure: 0.05, direction: -1 }
  ];
  return presets[frame.memory.length % presets.length];
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    const preset = defaultCircuit(frame);
    frame = finishCircuit(beginCircuit(frame, { x: preset.x, y: preset.y, time: 0, direction: preset.direction }), preset);
    timeline.push(buildFrame(stage, frame.memory, null, 'settled-quorum'));
  }
  return timeline;
};

export const geometrySignature = (frame) => frame.field.signature;
export const witnessAnchors = () => anchors.map((entry, id) => ({ id, ...entry }));
