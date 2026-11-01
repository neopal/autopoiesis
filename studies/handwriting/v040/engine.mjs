const CHAMBER_COUNT = 9;
export const MEMORY_WINDOW = 4;
export const HOLD_THRESHOLD = 640;
export const MAX_HOLD = 2400;

const BASE_CHAMBERS = [
  { id: 0, glyph: 'A', x: 0.16, y: 0.21, angle: -8, scale: 1.18, width: 0.86, slant: -0.04, counter: 0.44, ink: 0.72, phase: 0.08, mode: 'quiet' },
  { id: 1, glyph: 'E', x: 0.38, y: 0.16, angle: 5, scale: 0.92, width: 0.70, slant: 0.06, counter: 0.28, ink: 0.62, phase: 0.24, mode: 'quiet' },
  { id: 2, glyph: 'I', x: 0.63, y: 0.20, angle: -3, scale: 1.08, width: 0.58, slant: -0.02, counter: 0.18, ink: 0.74, phase: 0.39, mode: 'quiet' },
  { id: 3, glyph: 'O', x: 0.82, y: 0.36, angle: 12, scale: 1.24, width: 0.82, slant: 0.03, counter: 0.66, ink: 0.68, phase: 0.53, mode: 'quiet' },
  { id: 4, glyph: 'U', x: 0.68, y: 0.66, angle: -10, scale: 1.03, width: 0.78, slant: -0.07, counter: 0.48, ink: 0.66, phase: 0.67, mode: 'quiet' },
  { id: 5, glyph: 'Y', x: 0.43, y: 0.78, angle: 7, scale: 1.14, width: 0.64, slant: 0.09, counter: 0.31, ink: 0.78, phase: 0.79, mode: 'quiet' },
  { id: 6, glyph: 'N', x: 0.18, y: 0.68, angle: -14, scale: 0.96, width: 0.76, slant: -0.05, counter: 0.34, ink: 0.64, phase: 0.88, mode: 'quiet' },
  { id: 7, glyph: 'M', x: 0.33, y: 0.46, angle: 18, scale: 0.88, width: 0.92, slant: 0.04, counter: 0.52, ink: 0.58, phase: 0.14, mode: 'quiet' },
  { id: 8, glyph: '?', x: 0.56, y: 0.47, angle: -19, scale: 1.00, width: 0.68, slant: -0.08, counter: 0.25, ink: 0.70, phase: 0.31, mode: 'quiet' }
];

const round = (value) => Number(Number(value).toFixed(5));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalizeTime = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const hashPressure = (sourceId, duration, serial) => {
  let hash = (2166136261 ^ sourceId ^ serial) >>> 0;
  const token = `${sourceId}:${Math.round(duration)}:${serial}`;
  for (const character of token) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash >>> 0;
};
const pickDistinct = (start, used) => {
  let id = ((start % CHAMBER_COUNT) + CHAMBER_COUNT) % CHAMBER_COUNT;
  while (used.includes(id)) id = (id + 1) % CHAMBER_COUNT;
  return id;
};

const baseField = () => ({ chambers: clone(BASE_CHAMBERS) });
const signatureFor = (field) => JSON.stringify(field.chambers.map((chamber) => [
  chamber.id,
  chamber.glyph,
  round(chamber.x),
  round(chamber.y),
  round(chamber.angle),
  round(chamber.scale),
  round(chamber.width),
  round(chamber.slant),
  round(chamber.counter),
  round(chamber.ink),
  round(chamber.phase),
  chamber.mode
]));
const withSignature = (field) => ({ ...field, signature: signatureFor(field) });
const makeFrame = (field, memory = [], pending = null, serial = 0, lastEvent = 'quiet', changedChamberIds = [], history = memory) => ({
  field: withSignature(field),
  memory,
  history,
  pending,
  serial,
  lastEvent,
  changedChamberIds
});

export const buildFrame = () => makeFrame(baseField());

export const beginPressure = (frame, chamberId, at = 0) => {
  const id = Number(chamberId);
  if (!Number.isInteger(id) || id < 0 || id >= CHAMBER_COUNT) {
    return { ...frame, pending: null, lastEvent: 'refused chamber', changedChamberIds: [] };
  }
  return {
    ...frame,
    pending: { sourceId: id, startedAt: normalizeTime(at), currentAt: normalizeTime(at) },
    lastEvent: 'pressure armed',
    changedChamberIds: []
  };
};

export const previewPressure = (frame, at) => {
  if (!frame.pending) return { ...frame, lastEvent: 'refused pressure', changedChamberIds: [] };
  const currentAt = normalizeTime(at);
  return {
    ...frame,
    pending: { ...frame.pending, currentAt },
    lastEvent: currentAt - frame.pending.startedAt >= HOLD_THRESHOLD ? 'pressure ready' : 'pressure held',
    changedChamberIds: []
  };
};

const applyEvent = (field, event) => {
  const next = clone(field);
  const hash = hashPressure(event.sourceId, event.duration, event.serial);
  const remote = [];
  let cursor = hash % CHAMBER_COUNT;
  while (remote.length < 3) {
    cursor = pickDistinct(cursor + 1 + remote.length * 2, [event.sourceId, ...remote]);
    remote.push(cursor);
  }
  const pressure = clamp((event.duration - HOLD_THRESHOLD) / (MAX_HOLD - HOLD_THRESHOLD), 0, 1);
  const modes = ['opened', 'compressed', 'leaning'];
  remote.forEach((id, index) => {
    const chamber = next.chambers[id];
    const direction = ((hash >>> (index * 7)) & 1) ? 1 : -1;
    chamber.x = round(clamp(chamber.x + direction * (0.018 + pressure * 0.016), 0.08, 0.9));
    chamber.y = round(clamp(chamber.y + (index === 1 ? -direction : direction) * (0.014 + pressure * 0.018), 0.1, 0.88));
    chamber.angle = round(chamber.angle + direction * (6 + index * 5 + pressure * 7));
    chamber.scale = round(clamp(chamber.scale + (index === 1 ? -1 : 1) * (0.08 + pressure * 0.18), 0.68, 1.55));
    chamber.width = round(clamp(chamber.width + direction * (0.06 + pressure * 0.14), 0.34, 1.18));
    chamber.slant = round(clamp(chamber.slant + direction * (0.04 + pressure * 0.08), -0.28, 0.28));
    chamber.counter = round(clamp(chamber.counter + (index === 0 ? 1 : -1) * (0.08 + pressure * 0.2), 0.08, 0.9));
    chamber.ink = round(clamp(chamber.ink + (index === 2 ? -1 : 1) * (0.07 + pressure * 0.1), 0.24, 0.98));
    chamber.phase = round((chamber.phase + 0.17 + pressure * 0.21 + index * 0.05) % 1);
    chamber.mode = modes[index];
  });
  return { field: next, remote };
};

const replay = (history) => {
  let field = baseField();
  let changedChamberIds = [];
  for (const event of history) {
    const applied = applyEvent(field, event);
    field = applied.field;
    changedChamberIds = applied.remote;
  }
  return { field, changedChamberIds };
};

export const releasePressure = (frame, at) => {
  if (!frame.pending) return { ...frame, lastEvent: 'refused pressure', changedChamberIds: [] };
  const releasedAt = normalizeTime(at);
  const duration = releasedAt - frame.pending.startedAt;
  if (duration < HOLD_THRESHOLD) {
    return { ...frame, pending: null, lastEvent: 'refused pressure', changedChamberIds: [] };
  }
  const event = {
    sourceId: frame.pending.sourceId,
    duration: Math.min(duration, MAX_HOLD),
    serial: frame.serial + 1,
    mode: 'pressure-debt'
  };
  const history = [...(frame.history ?? frame.memory), event];
  const replayed = replay(history);
  return makeFrame(
    replayed.field,
    history.slice(-MEMORY_WINDOW),
    null,
    event.serial,
    'pressure debt transferred',
    replayed.changedChamberIds,
    history
  );
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest' };
  const replayed = replay(history);
  return makeFrame(replayed.field, history.slice(-MEMORY_WINDOW), null, frame.serial, 'lifted latest', replayed.changedChamberIds, history);
};

export const release = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });
export const getChamberCount = () => CHAMBER_COUNT;
