export const SEED = 0x57473044;
export const PORTAL_COUNT = 11;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const HANDOFF_DISTANCE = 0.22;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 17.731 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};

const ringLayout = [
  { angle: -2.92, radius: 0.43 }, { angle: -2.42, radius: 0.67 },
  { angle: -1.96, radius: 0.46 }, { angle: -1.46, radius: 0.72 },
  { angle: -0.94, radius: 0.5 }, { angle: -0.42, radius: 0.68 },
  { angle: 0.06, radius: 0.46 }, { angle: 0.55, radius: 0.71 },
  { angle: 1.03, radius: 0.48 }, { angle: 1.57, radius: 0.68 },
  { angle: 2.1, radius: 0.5 }
];

const clonePortal = (portal) => ({ ...portal });
const cloneField = (field) => ({
  ...field,
  portals: field.portals.map(clonePortal),
  transfers: field.transfers.map((transfer) => ({ ...transfer }))
});
const cloneMemory = (memory) => memory.map((event) => ({ ...event }));

const basePortals = () => ringLayout.map((slot, id) => {
  const wobble = (pseudo(id + 4) - 0.5) * 0.045;
  return {
    id,
    x: round(Math.cos(slot.angle) * (slot.radius + wobble)),
    y: round(Math.sin(slot.angle) * (slot.radius + wobble)),
    radius: round(0.075 + pseudo(id + 18) * 0.018),
    opening: round(0.26 + pseudo(id + 31) * 0.14),
    twist: round((pseudo(id + 47) - 0.5) * 0.4),
    depth: round(0.16 + pseudo(id + 61) * 0.1),
    pulse: round(pseudo(id + 79) * Math.PI * 2),
    relayCount: 0,
    aperture: 0,
    echo: 0
  };
});

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nearestPortal = (point = {}) => {
  const candidate = { x: clamp(finite(point.x, 0), -1, 1), y: clamp(finite(point.y, 0), -1, 1) };
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  basePortals().forEach((portal, index) => {
    const next = (candidate.x - portal.x) ** 2 + (candidate.y - portal.y) ** 2;
    if (next < nearestDistance) {
      nearest = index;
      nearestDistance = next;
    }
  });
  return nearest;
};

const normalizeIndex = (value, fallback = 0) => integer(value, fallback, 0, PORTAL_COUNT - 1);
const receiverFor = (sourceIndex, observerIndex, serial) => {
  const step = serial % 2 === 0 ? 4 + serial : -(3 + serial);
  let receiver = wrap(sourceIndex + step, PORTAL_COUNT);
  if (receiver === sourceIndex || receiver === observerIndex) receiver = wrap(receiver + 2, PORTAL_COUNT);
  return receiver;
};
const directionFor = (sourceIndex, observerIndex) => sourceIndex === observerIndex ? 1 : (observerIndex > sourceIndex ? 1 : -1);

const normalizeEvent = (event = {}, serial = 0) => {
  const sourceIndex = normalizeIndex(event.sourceIndex, serial % PORTAL_COUNT);
  const observerIndex = normalizeIndex(event.observerIndex, wrap(sourceIndex + 1, PORTAL_COUNT));
  const receiverIndex = normalizeIndex(event.receiverIndex, receiverFor(sourceIndex, observerIndex, serial));
  const direction = finite(event.direction, directionFor(sourceIndex, observerIndex)) < 0 ? -1 : 1;
  return {
    id: `reciprocal-handoff-${serial + 1}`,
    type: 'reciprocal-handoff',
    sourceIndex,
    observerIndex,
    receiverIndex: receiverIndex === sourceIndex || receiverIndex === observerIndex ? receiverFor(sourceIndex, observerIndex, serial) : receiverIndex,
    direction,
    serial,
    apertureDelta: round(clamp(finite(event.apertureDelta, 0.13 + serial * 0.025), 0.1, 0.28)),
    depthDelta: round(clamp(finite(event.depthDelta, 0.06 + serial * 0.018), 0.04, 0.16))
  };
};
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : []).slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const buildField = (memory) => {
  const field = {
    kind: 'reciprocal-orbit',
    portals: basePortals(),
    transfers: [],
    sourceIndex: null,
    observerIndex: null,
    receiverIndex: null,
    signature: ''
  };
  normalizeMemory(memory).forEach((event) => {
    const next = field.portals.map(clonePortal);
    const receiver = next[event.receiverIndex];
    receiver.opening = round(clamp(receiver.opening + event.apertureDelta, 0.18, 0.82));
    receiver.aperture = round(clamp(receiver.aperture + event.apertureDelta, 0, 1));
    receiver.depth = round(clamp(receiver.depth + event.depthDelta, 0.1, 0.84));
    receiver.twist = round(receiver.twist + event.direction * (0.12 + event.serial * 0.03));
    receiver.echo = round(clamp(receiver.echo + 0.22 + event.serial * 0.04, 0, 1));
    receiver.relayCount += 1;
    field.portals = next;
    field.transfers.push({ ...event });
    field.sourceIndex = event.sourceIndex;
    field.observerIndex = event.observerIndex;
    field.receiverIndex = event.receiverIndex;
  });
  field.signature = JSON.stringify({ portals: field.portals, transfers: field.transfers });
  return field;
};

const frameFrom = (memory, lastAction = 'quiet', gesture = null, pending = null, event = null) => {
  const normalizedMemory = normalizeMemory(memory);
  const field = buildField(normalizedMemory);
  return {
    grammar: 'reciprocal-orbit',
    renderer: 'deterministic p5.js 1.11.3 WEBGL reciprocal orbit field',
    stage: normalizedMemory.length,
    memory: normalizedMemory,
    field,
    gesture,
    pending,
    event,
    lastAction
  };
};

export const buildFrame = (memory = []) => frameFrom(memory);
export const geometrySignature = (frame) => frame?.field?.signature ?? '';

export const beginApproach = (frame, point = {}) => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'handoff-refused-memory-limit');
  const sourceIndex = point.index === undefined ? nearestPortal(point) : normalizeIndex(point.index);
  const gesture = { sourceIndex, observerIndex: null, startedAt: finite(point.time, 0), path: [sourceIndex] };
  return frameFrom(frame.memory, 'approach-started', gesture, { sourceIndex, observerIndex: null });
};

export const updateApproach = (frame, point = {}) => {
  if (!frame?.gesture) return frame;
  const observerIndex = point.index === undefined ? nearestPortal(point) : normalizeIndex(point.index);
  const path = frame.gesture.path.includes(observerIndex) ? frame.gesture.path : [...frame.gesture.path, observerIndex];
  const pending = { sourceIndex: frame.gesture.sourceIndex, observerIndex };
  const gesture = { ...frame.gesture, observerIndex, path };
  return frameFrom(frame.memory, observerIndex === frame.gesture.sourceIndex ? 'approach-returned' : 'approach-open', gesture, pending);
};

export const finishApproach = (frame, input = {}) => {
  if (!frame?.gesture) return frameFrom(frame?.memory ?? [], 'handoff-refused-no-approach');
  const observerIndex = input.observerIndex === undefined ? frame.gesture.observerIndex : normalizeIndex(input.observerIndex);
  const sourceIndex = frame.gesture.sourceIndex;
  if (!input.confirmed || observerIndex === null || observerIndex === undefined || observerIndex === sourceIndex) {
    return frameFrom(frame.memory, 'handoff-refused-incomplete');
  }
  return commitHandoff(frame, sourceIndex, observerIndex, 'pointer-handoff');
};

export const commitHandoff = (frame, sourceIndex, observerIndex, reason = 'handoff') => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'handoff-refused-memory-limit');
  const source = normalizeIndex(sourceIndex);
  const observer = normalizeIndex(observerIndex, wrap(source + 1, PORTAL_COUNT));
  if (source === observer) return frameFrom(frame.memory, 'handoff-refused-incomplete');
  const serial = frame.memory.length;
  const event = normalizeEvent({ sourceIndex: source, observerIndex: observer }, serial);
  return frameFrom([...frame.memory, { ...event, reason }], 'handoff-committed', null, null, event);
};

export const defaultHandoff = (frame) => {
  const serial = frame?.memory?.length ?? 0;
  return {
    sourceIndex: wrap(1 + serial * 2, PORTAL_COUNT),
    observerIndex: wrap(6 + serial, PORTAL_COUNT)
  };
};

export const liftLatestHandoff = (frame) => frameFrom((frame?.memory ?? []).slice(0, -1), 'handoff-lifted', null, null, { type: 'handoff-lifted' });
export const releaseArchive = () => frameFrom([], 'archive-released');

export const buildTimeline = () => {
  const timeline = [buildFrame()];
  for (let serial = 0; serial < MEMORY_LIMIT; serial += 1) {
    const previous = timeline.at(-1);
    const choice = defaultHandoff(previous);
    timeline.push(commitHandoff(previous, choice.sourceIndex, choice.observerIndex, 'timeline'));
  }
  return timeline;
};
