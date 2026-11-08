export const SEED = 0x57473047;
export const AGENT_COUNT = 26;
export const MEMORY_LIMIT = 4;
export const MIN_GAZE_DWELL_MS = 420;
export const GAZE_CHAIN_LENGTH = 3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 17.271 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizeSlot = (value, fallback = 0) => integer(value, fallback, 0, AGENT_COUNT - 1);
const cloneGesture = (gesture) => gesture ? { ...gesture, slots: [...gesture.slots] } : null;
const cloneMemory = (memory) => memory.map((event) => ({ ...event, witnesses: [...event.witnesses] }));

const baseAgents = () => Array.from({ length: AGENT_COUNT }, (_, slot) => {
  const t = slot / (AGENT_COUNT - 1);
  const x = (t - 0.5) * 2.8;
  const y = 0.48 - Math.sin(t * Math.PI) * 1.02 + Math.sin(t * Math.PI * 2.7 + 0.6) * 0.055;
  const dx = 2.8 / (AGENT_COUNT - 1);
  const dy = -1.02 * Math.PI * Math.cos(t * Math.PI) / (AGENT_COUNT - 1);
  return {
    slot,
    x: round(x),
    y: round(y),
    tangent: round(Math.atan2(dy, dx)),
    width: round(0.15 + pseudo(slot + 2) * 0.08),
    height: round(0.36 + pseudo(slot + 19) * 0.24),
    lean: round((pseudo(slot + 37) - 0.5) * 0.18),
    tilt: round((pseudo(slot + 61) - 0.5) * 0.16),
    depth: round(0.25 + pseudo(slot + 83) * 0.4),
    tone: round(pseudo(slot + 101)),
    attention: 0,
    scar: 0,
    present: true
  };
});

const chooseAbsentSlot = (witnesses, memory, serial) => {
  const used = new Set(memory.map((event) => event.absentSlot));
  const weighted = witnesses.reduce((sum, slot, index) => sum + slot * (index * 2 + 3), serial * 7 + 5);
  for (let offset = 0; offset < AGENT_COUNT; offset += 1) {
    const candidate = wrap(weighted + offset, AGENT_COUNT);
    if (!witnesses.includes(candidate) && !used.has(candidate)) return candidate;
  }
  return wrap(weighted, AGENT_COUNT);
};

const normalizeWitnesses = (slots, serial = 0) => {
  const fallback = [wrap(2 + serial * 5, AGENT_COUNT), wrap(10 + serial * 3, AGENT_COUNT), wrap(18 + serial * 7, AGENT_COUNT)];
  const values = Array.isArray(slots) ? slots : fallback;
  const unique = [];
  values.forEach((value, index) => {
    const slot = normalizeSlot(value, fallback[index] ?? 0);
    if (!unique.includes(slot) && unique.length < GAZE_CHAIN_LENGTH) unique.push(slot);
  });
  fallback.forEach((slot) => {
    if (unique.length < GAZE_CHAIN_LENGTH && !unique.includes(slot)) unique.push(slot);
  });
  return unique;
};

const normalizeEvent = (event = {}, serial = 0, memory = []) => {
  const witnesses = normalizeWitnesses(event.witnesses ?? event.slots, serial);
  const absentSlot = witnesses.includes(event.absentSlot)
    ? chooseAbsentSlot(witnesses, memory, serial)
    : normalizeSlot(event.absentSlot, chooseAbsentSlot(witnesses, memory, serial));
  return {
    id: `attention-defection-${serial + 1}`,
    type: 'attention-defection',
    witnesses,
    absentSlot,
    serial,
    direction: finite(event.direction, serial % 2 === 0 ? 1 : -1) < 0 ? -1 : 1,
    reason: event.reason ?? 'three-witness-chain'
  };
};

const normalizeMemory = (memory = []) => {
  const source = Array.isArray(memory) ? memory.slice(-MEMORY_LIMIT) : [];
  const normalized = [];
  source.forEach((event, index) => normalized.push(normalizeEvent(event, index, normalized)));
  return normalized;
};

const applyDefection = (agents, event) => agents.map((agent) => {
  const witnessIndex = event.witnesses.indexOf(agent.slot);
  const distance = Math.abs(agent.slot - event.absentSlot);
  const wave = Math.exp(-distance / 4.4);
  const side = agent.slot < event.absentSlot ? -1 : 1;
  if (agent.slot === event.absentSlot) {
    return {
      ...agent,
      present: false,
      attention: 1,
      scar: round(Math.min(1, agent.scar + 0.78)),
      tilt: round(agent.tilt + event.direction * 0.22),
      lean: round(agent.lean + event.direction * 0.16)
    };
  }
  if (witnessIndex >= 0) {
    const turn = event.direction * (witnessIndex === 1 ? -1 : 1);
    return {
      ...agent,
      attention: round(clamp(agent.attention + 0.42 + event.serial * 0.04, 0, 1)),
      tilt: round(clamp(agent.tilt + turn * (0.2 + witnessIndex * 0.035), -1.2, 1.2)),
      lean: round(clamp(agent.lean - turn * 0.07, -1.2, 1.2)),
      scar: round(clamp(agent.scar + 0.12, 0, 1))
    };
  }
  if (distance <= 5) {
    return {
      ...agent,
      tilt: round(clamp(agent.tilt + side * event.direction * wave * 0.11, -1.2, 1.2)),
      lean: round(clamp(agent.lean + event.direction * wave * 0.05, -1.2, 1.2)),
      attention: round(clamp(agent.attention + wave * 0.16, 0, 1))
    };
  }
  return agent;
});

const buildField = (memory) => {
  let agents = baseAgents();
  const absences = [];
  normalizeMemory(memory).forEach((event) => {
    agents = applyDefection(agents, event);
    absences.push({ slot: event.absentSlot, witnesses: [...event.witnesses], serial: event.serial });
  });
  const field = { kind: 'absence-arch', agents, absences, signature: '' };
  field.signature = JSON.stringify({ agents: field.agents, absences: field.absences });
  return field;
};

const frameFrom = (memory, lastAction = 'quiet', gesture = null, event = null) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'absence-arch',
    renderer: 'deterministic p5.js 1.11.3 Canvas 2D arch',
    stage: normalizedMemory.length,
    memory: normalizedMemory,
    field: buildField(normalizedMemory),
    gesture: cloneGesture(gesture),
    event,
    lastAction
  };
};

export const buildFrame = (memory = []) => frameFrom(memory);
export const geometrySignature = (frame) => frame?.field?.signature ?? '';

export const beginGaze = (frame, point = {}) => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'gaze-refused-memory-limit');
  const slot = normalizeSlot(point.slot, wrap(3 + frame.memory.length * 6, AGENT_COUNT));
  const time = finite(point.time, 0);
  return frameFrom(frame.memory, 'gaze-armed', { slots: [slot], startedAt: time, updatedAt: time });
};

export const registerGaze = (frame, point = {}) => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'gaze-refused-memory-limit');
  const slot = normalizeSlot(point.slot, 0);
  const dwell = finite(point.dwell, MIN_GAZE_DWELL_MS);
  if (dwell < MIN_GAZE_DWELL_MS) return frameFrom(frame.memory, 'gaze-refused-short', null, { type: 'gaze-refused', slot });
  if (!frame.gesture) return beginGaze(frame, { ...point, slot });
  if (frame.gesture.slots.includes(slot)) return frameFrom(frame.memory, 'gaze-refused-repeat', null, { type: 'gaze-refused', slot });
  const time = finite(point.time, frame.gesture.updatedAt + 640);
  const slots = [...frame.gesture.slots, slot];
  const gesture = { ...frame.gesture, slots, updatedAt: time };
  if (slots.length < GAZE_CHAIN_LENGTH) return frameFrom(frame.memory, 'gaze-building', gesture);
  return finishGaze(frameFrom(frame.memory, 'gaze-ready', gesture), { confirmed: true });
};

export const finishGaze = (frame, input = {}) => {
  if (!frame?.gesture) return frameFrom(frame?.memory ?? [], 'gaze-refused-no-chain');
  const witnesses = normalizeWitnesses(frame.gesture.slots, frame.memory.length);
  if (!input.confirmed || witnesses.length !== GAZE_CHAIN_LENGTH) {
    return frameFrom(frame.memory, 'gaze-refused-incomplete', null, { type: 'gaze-refused', witnesses });
  }
  return commitGaze(frame, witnesses, input.reason ?? 'three-witness-chain');
};

export const commitGaze = (frame, witnesses, reason = 'three-witness-chain') => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'gaze-refused-memory-limit');
  const normalizedWitnesses = normalizeWitnesses(witnesses, frame.memory.length);
  const absentSlot = chooseAbsentSlot(normalizedWitnesses, frame.memory, frame.memory.length);
  const event = normalizeEvent({ witnesses: normalizedWitnesses, absentSlot, reason, direction: frame.memory.length % 2 === 0 ? 1 : -1 }, frame.memory.length, frame.memory);
  return frameFrom([...frame.memory, event], 'absence-committed', null, event);
};

const DEFAULT_CHAINS = [
  [3, 11, 20],
  [6, 15, 23],
  [1, 14, 24],
  [8, 12, 21]
];

export const defaultGaze = (frame) => ({
  witnesses: DEFAULT_CHAINS[frame?.memory?.length ?? 0] ?? DEFAULT_CHAINS[0]
});

export const commitDefaultGaze = (frame) => {
  const choice = defaultGaze(frame);
  return commitGaze(frame, choice.witnesses, 'deterministic-gaze-chain');
};

export const liftLatest = (frame) => frameFrom((frame?.memory ?? []).slice(0, -1), 'absence-lifted', null, { type: 'absence-lifted' });
export const releaseField = () => frameFrom([], 'field-released');

export const buildTimeline = () => {
  const timeline = [buildFrame()];
  for (let serial = 0; serial < MEMORY_LIMIT; serial += 1) timeline.push(commitDefaultGaze(timeline.at(-1)));
  return timeline;
};
