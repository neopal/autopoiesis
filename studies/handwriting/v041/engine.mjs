export const GLYPH_COUNT = 12;
export const GAP_COUNT = 9;
export const SILENCE_LENGTH = 3;
export const MEMORY_WINDOW = 4;
export const MODE = 'negative-syntax';

const BASE_GLYPHS = [
  { id: 0, char: 'A', x: 0.18, y: 0.18, angle: -8, scale: 1.16, width: 0.84, weight: 0.72, aperture: 0.34, phase: 0.08, role: 'quiet' },
  { id: 1, char: 'E', x: 0.39, y: 0.13, angle: 7, scale: 0.92, width: 0.68, weight: 0.58, aperture: 0.24, phase: 0.21, role: 'quiet' },
  { id: 2, char: 'I', x: 0.64, y: 0.2, angle: -4, scale: 1.04, width: 0.46, weight: 0.78, aperture: 0.18, phase: 0.36, role: 'quiet' },
  { id: 3, char: 'O', x: 0.82, y: 0.36, angle: 13, scale: 1.22, width: 0.76, weight: 0.64, aperture: 0.6, phase: 0.49, role: 'quiet' },
  { id: 4, char: 'U', x: 0.7, y: 0.64, angle: -11, scale: 1.02, width: 0.78, weight: 0.62, aperture: 0.42, phase: 0.63, role: 'quiet' },
  { id: 5, char: 'R', x: 0.47, y: 0.78, angle: 8, scale: 1.1, width: 0.72, weight: 0.7, aperture: 0.36, phase: 0.76, role: 'quiet' },
  { id: 6, char: 'N', x: 0.21, y: 0.7, angle: -15, scale: 0.94, width: 0.82, weight: 0.56, aperture: 0.28, phase: 0.9, role: 'quiet' },
  { id: 7, char: 'M', x: 0.31, y: 0.46, angle: 18, scale: 0.9, width: 0.92, weight: 0.52, aperture: 0.46, phase: 0.13, role: 'quiet' },
  { id: 8, char: 'S', x: 0.55, y: 0.46, angle: -17, scale: 1.08, width: 0.72, weight: 0.68, aperture: 0.31, phase: 0.29, role: 'quiet' },
  { id: 9, char: 'T', x: 0.06, y: 0.42, angle: -24, scale: 0.78, width: 0.68, weight: 0.5, aperture: 0.22, phase: 0.42, role: 'quiet' },
  { id: 10, char: 'V', x: 0.93, y: 0.58, angle: 21, scale: 0.82, width: 0.68, weight: 0.6, aperture: 0.26, phase: 0.57, role: 'quiet' },
  { id: 11, char: 'Y', x: 0.48, y: 0.93, angle: 5, scale: 0.72, width: 0.64, weight: 0.46, aperture: 0.2, phase: 0.71, role: 'quiet' }
];

const BASE_GAPS = [
  { id: 0, x: 0.27, y: 0.15, angle: -10 },
  { id: 1, x: 0.52, y: 0.16, angle: 3 },
  { id: 2, x: 0.74, y: 0.27, angle: 12 },
  { id: 3, x: 0.79, y: 0.5, angle: 9 },
  { id: 4, x: 0.59, y: 0.72, angle: -6 },
  { id: 5, x: 0.34, y: 0.76, angle: 8 },
  { id: 6, x: 0.17, y: 0.56, angle: -12 },
  { id: 7, x: 0.42, y: 0.46, angle: 15 },
  { id: 8, x: 0.67, y: 0.48, angle: -14 }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(5));
const baseField = () => ({ glyphs: clone(BASE_GLYPHS), gaps: clone(BASE_GAPS) });
const withSignature = (field) => ({
  ...field,
  signature: JSON.stringify({
    glyphs: field.glyphs.map(({ id, char, x, y, angle, scale, width, weight, aperture, phase, role }) => ({ id, char, x, y, angle, scale, width, weight, aperture, phase, role })),
    gaps: field.gaps.map(({ id, x, y, angle }) => ({ id, x, y, angle }))
  })
});
const makeFrame = (field, memory = [], pending = [], history = memory, serial = 0, lastEvent = 'quiet', changedGlyphIds = []) => ({
  field: withSignature(field),
  memory,
  history,
  pending,
  serial,
  lastEvent,
  changedGlyphIds
});
const eventHash = (sequence, serial) => {
  let hash = 2166136261 ^ serial;
  for (const value of sequence) hash = Math.imul(hash ^ (value + 17), 16777619) >>> 0;
  return hash >>> 0;
};
const pickRemote = (sequence, serial) => {
  const blocked = new Set(sequence);
  const result = [];
  let cursor = eventHash(sequence, serial) % GLYPH_COUNT;
  while (result.length < 3) {
    if (!blocked.has(cursor) && !result.includes(cursor)) result.push(cursor);
    cursor = (cursor + 3 + result.length) % GLYPH_COUNT;
  }
  return result;
};

export const buildFrame = () => makeFrame(baseField());

export const beginSilence = (frame, gapId) => {
  const id = Number(gapId);
  if (!Number.isInteger(id) || id < 0 || id >= GAP_COUNT) {
    return { ...frame, pending: [], lastEvent: 'refused gap', changedGlyphIds: [] };
  }
  return { ...frame, pending: [id], lastEvent: 'silence begun', changedGlyphIds: [] };
};

export const appendSilence = (frame, gapId) => {
  const id = Number(gapId);
  if (!frame.pending?.length || !Number.isInteger(id) || id < 0 || id >= GAP_COUNT || frame.pending.includes(id) || frame.pending.length >= SILENCE_LENGTH) {
    return { ...frame, lastEvent: 'refused silence', changedGlyphIds: [] };
  }
  return { ...frame, pending: [...frame.pending, id], lastEvent: frame.pending.length + 1 === SILENCE_LENGTH ? 'silence complete' : 'silence gathering', changedGlyphIds: [] };
};

const applyEvent = (field, event) => {
  const next = clone(field);
  const remote = pickRemote(event.sequence, event.serial);
  const parity = event.sequence.reduce((sum, value, index) => sum + value * (index + 2), 0) % 2 ? 1 : -1;
  remote.forEach((id, index) => {
    const glyph = next.glyphs[id];
    const force = 0.04 + index * 0.025 + ((event.serial + event.sequence[index]) % 3) * 0.018;
    glyph.x = round(clamp(glyph.x + parity * (index === 1 ? -force : force * 0.8), 0.035, 0.965));
    glyph.y = round(clamp(glyph.y + (index === 1 ? parity : -parity) * force, 0.06, 0.95));
    glyph.angle = round(glyph.angle + parity * (7 + index * 4));
    glyph.scale = round(clamp(glyph.scale + (index === 1 ? -1 : 1) * (0.06 + index * 0.025), 0.55, 1.45));
    glyph.width = round(clamp(glyph.width + parity * (index === 2 ? -0.08 : 0.06), 0.35, 1.12));
    glyph.weight = round(clamp(glyph.weight + (index === 0 ? 0.1 : -0.07), 0.24, 0.96));
    glyph.aperture = round(clamp(glyph.aperture + (index === 1 ? 0.18 : -0.1), 0.08, 0.84));
    glyph.phase = round((glyph.phase + 0.16 + event.sequence[index] * 0.013) % 1);
    glyph.role = ['recruited', 'hollowed', 'tilted'][index];
  });
  return { field: next, remote };
};

const replay = (history) => {
  let field = baseField();
  let changedGlyphIds = [];
  for (const event of history) {
    const applied = applyEvent(field, event);
    field = applied.field;
    changedGlyphIds = applied.remote;
  }
  return { field, changedGlyphIds };
};

export const commitSilence = (frame) => {
  if (!frame.pending || frame.pending.length !== SILENCE_LENGTH || new Set(frame.pending).size !== SILENCE_LENGTH) {
    return { ...frame, pending: [], lastEvent: 'refused silence', changedGlyphIds: [] };
  }
  const event = { sequence: [...frame.pending], serial: frame.serial + 1, mode: MODE };
  const history = [...(frame.history ?? frame.memory), event];
  const replayed = replay(history);
  return makeFrame(replayed.field, history.slice(-MEMORY_WINDOW), [], history, event.serial, 'negative syntax recruited', replayed.changedGlyphIds);
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest' };
  const replayed = replay(history);
  return makeFrame(replayed.field, history.slice(-MEMORY_WINDOW), [], history, frame.serial, 'lifted latest', replayed.changedGlyphIds);
};

export const release = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });
