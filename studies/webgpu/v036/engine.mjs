export const SEED = 0x57473636;
export const STAGES = 9;
export const GATE_COUNT = 15;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 34;
export const MIN_DWELL = 160;
export const MAX_DWELL = 1600;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const wrap = (value, size = GATE_COUNT) => ((value % size) + size) % size;
const gateDistance = (a, b) => Math.min(Math.abs(a - b), GATE_COUNT - Math.abs(a - b));
const pseudo = (value) => {
  const raw = Math.sin(value * 13.731 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));

const normalizeEvent = (event = {}, index = 0) => {
  const dwell = clamp(finite(event.dwell, 360 + index * 90), MIN_DWELL, MAX_DWELL);
  const sourceGate = integer(event.sourceGate ?? (index * 4 + 2), 0, GATE_COUNT - 1);
  let answerGate = integer(event.answerGate ?? wrap(sourceGate + 5 + index), 0, GATE_COUNT - 1);
  if (answerGate === sourceGate) answerGate = wrap(sourceGate + 6);
  let relayGate = integer(event.relayGate ?? wrap(answerGate + 4 + index), 0, GATE_COUNT - 1);
  if (relayGate === sourceGate || relayGate === answerGate) relayGate = wrap(answerGate + 5);
  return {
    id: `attention-${index}`,
    mode: 'situated-reciprocity',
    dwell: round(dwell),
    sourceGate,
    answerGate,
    relayGate,
    serial: index
  };
};
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const baseGates = () => Array.from({ length: GATE_COUNT }, (_, id) => {
  const u = id / (GATE_COUNT - 1);
  return {
    id,
    u: round(u),
    width: round(0.038 + pseudo(id + 11) * 0.028),
    opening: round(0.16 + pseudo(id + 31) * 0.18),
    fold: round((pseudo(id + 51) - 0.5) * 0.16),
    lift: round(0.12 + pseudo(id + 71) * 0.16),
    warmth: round(0.22 + pseudo(id + 91) * 0.6),
    witness: 0
  };
});

const buildRibbon = (gates) => {
  const centerline = Array.from({ length: 19 }, (_, index) => {
    const u = index / 18;
    const nearest = gates[Math.min(GATE_COUNT - 1, Math.round(u * (GATE_COUNT - 1)))];
    const arc = Math.sin(u * Math.PI * 1.9 - 0.35) * 0.13;
    const counter = Math.sin(u * Math.PI * 4.2 + 0.6) * 0.025;
    return {
      x: round(0.08 + u * 0.84),
      y: round(0.5 + arc + counter + nearest.fold * 0.12),
      u: round(u)
    };
  });
  const widths = gates.map((gate) => round(0.105 + gate.opening * 0.08 + gate.lift * 0.025));
  return { kind: 'continuous-ribbon', centerline, widths };
};

const buildField = (memory) => {
  let gates = baseGates();
  const ledger = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const previous = gates.map((gate) => ({ ...gate }));
    const dwellForce = (event.dwell - MIN_DWELL) / (MAX_DWELL - MIN_DWELL);
    gates = previous.map((gate, index) => {
      const source = 1 - gateDistance(index, event.sourceGate) / (GATE_COUNT * 0.5);
      const answer = 1 - gateDistance(index, event.answerGate) / (GATE_COUNT * 0.5);
      const relay = 1 - gateDistance(index, event.relayGate) / (GATE_COUNT * 0.5);
      return {
        ...gate,
        opening: round(clamp(gate.opening + (answer - source) * (0.04 + dwellForce * 0.09), 0.05, 0.94)),
        fold: round(gate.fold + (relay - source) * (0.045 + dwellForce * 0.07)),
        lift: round(clamp(gate.lift + (answer - relay) * 0.045 + source * 0.012, 0.04, 0.9)),
        warmth: round(clamp(gate.warmth + (answer - source) * 0.14 + relay * 0.025, 0.08, 0.98)),
        witness: gate.witness + (index === event.sourceGate ? 1 : 0)
      };
    });
    gates = gates.map((gate, index) => {
      if (index === event.sourceGate) return {
        ...gate,
        opening: round(clamp(gate.opening - 0.09 - dwellForce * 0.1, 0.04, 0.94)),
        fold: round(gate.fold + 0.11 + dwellForce * 0.08),
        lift: round(clamp(gate.lift - 0.035, 0.04, 0.9))
      };
      if (index === event.answerGate) return {
        ...gate,
        opening: round(clamp(gate.opening + 0.24 + dwellForce * 0.22, 0.05, 0.94)),
        fold: round(gate.fold - 0.12 - dwellForce * 0.08),
        lift: round(clamp(gate.lift + 0.18 + serial * 0.015, 0.04, 0.9))
      };
      if (index === event.relayGate) return {
        ...gate,
        opening: round(clamp(gate.opening + 0.08, 0.05, 0.94)),
        fold: round(gate.fold + (serial % 2 ? -0.18 : 0.18)),
        lift: round(clamp(gate.lift + 0.11, 0.04, 0.9))
      };
      return gate;
    });
    ledger.push(`${event.sourceGate}>${event.answerGate}>${event.relayGate}:${event.dwell.toFixed(1)}`);
  });
  const signature = JSON.stringify({
    ledger: ledger.join('|') || 'quiet',
    ribbon: buildRibbon(gates),
    gates: gates.map((gate) => [gate.id, gate.opening, gate.fold, gate.lift, gate.warmth, gate.witness])
  });
  return { gates, ribbon: buildRibbon(gates), ledger: ledger.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], attention = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    attention: attention ? {
      sourceGate: integer(attention.sourceGate ?? attention.gate, 0, GATE_COUNT - 1),
      currentGate: integer(attention.currentGate ?? attention.gate, 0, GATE_COUNT - 1),
      startedAt: finite(attention.startedAt, 0),
      currentAt: finite(attention.currentAt, attention.startedAt ?? 0)
    } : null,
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const attendGate = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, attention: null, lastAction: 'memory-limit' };
  const gate = integer(input.gate, 0, GATE_COUNT - 1);
  const at = finite(input.at, 0);
  return {
    ...frame,
    attention: { sourceGate: gate, currentGate: gate, startedAt: at, currentAt: at },
    lastAction: 'attention-armed'
  };
};

export const moveAttention = (frame, input = {}) => {
  if (!frame.attention) return frame;
  return {
    ...frame,
    attention: { ...frame.attention, currentGate: integer(input.gate, frame.attention.currentGate, GATE_COUNT - 1), currentAt: finite(input.at, frame.attention.currentAt) },
    lastAction: 'attention-moving'
  };
};

const chooseReply = (memory, sourceGate, serial) => {
  const seen = new Map(Array.from({ length: GATE_COUNT }, (_, gate) => [gate, 0]));
  memory.forEach((event) => {
    seen.set(event.sourceGate, seen.get(event.sourceGate) + 1);
    seen.set(event.answerGate, seen.get(event.answerGate) + 1);
  });
  return [...seen.keys()]
    .filter((gate) => gate !== sourceGate)
    .sort((a, b) => seen.get(a) - seen.get(b) || gateDistance(b, sourceGate) - gateDistance(a, sourceGate) || a - b)[serial % (GATE_COUNT - 1)];
};

export const releaseAttention = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, attention: null, lastAction: 'memory-limit' };
  if (!frame.attention) return { ...frame, lastAction: 'attention-refused-no-arm' };
  const releasedAt = finite(input.releasedAt, frame.attention.currentAt);
  const dwell = releasedAt - frame.attention.startedAt;
  if (dwell < MIN_DWELL || dwell > MAX_DWELL) return { ...frame, attention: null, lastAction: 'attention-refused-bounds' };
  const sourceGate = frame.attention.sourceGate;
  const answerGate = chooseReply(frame.memory, sourceGate, frame.memory.length);
  const relayGate = wrap(answerGate + 4 + frame.memory.length * 2);
  const event = { mode: 'situated-reciprocity', dwell, sourceGate, answerGate, relayGate };
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'attention-released');
};

export const liftLatestAttention = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'attention-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');
export const defaultDwell = (frame) => [260, 540, 880, 420][frame.memory.length % 4];
export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    if (frame.memory.length < MEMORY_LIMIT) {
      frame = releaseAttention(attendGate(frame, { gate: (stage * 3 + 1) % GATE_COUNT, at: 0 }), { releasedAt: defaultDwell(frame) });
    } else {
      frame = buildFrame(stage, frame.memory, null, 'settled-preview');
    }
    timeline.push(buildFrame(stage, frame.memory, null, frame.memory.length ? 'settled-preview' : 'quiet'));
  }
  return timeline;
};
export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, gates: frame.field.gates });
export const gatePoints = () => baseGates().map((gate) => ({ id: gate.id, u: gate.u }));
