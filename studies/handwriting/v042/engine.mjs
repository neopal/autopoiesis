export const STROKE_COUNT = 8;
export const PORT_COUNT = 8;
export const LIGATURE_LENGTH = 2;
export const MEMORY_WINDOW = 4;
export const MODE = 'hinge-ligature';

const BASE_STROKES = [
  { id: 0, x: 0.22, y: 0.22, angle: -18, scale: 0.92, width: 0.76, bend: 0.18, phase: 0.08, role: 'quiet', fusion: 0, counter: 0 },
  { id: 1, x: 0.49, y: 0.16, angle: 8, scale: 0.88, width: 0.68, bend: -0.24, phase: 0.19, role: 'quiet', fusion: 0, counter: 0 },
  { id: 2, x: 0.77, y: 0.24, angle: 26, scale: 0.94, width: 0.82, bend: 0.3, phase: 0.31, role: 'quiet', fusion: 0, counter: 0 },
  { id: 3, x: 0.83, y: 0.58, angle: 74, scale: 0.9, width: 0.72, bend: -0.14, phase: 0.44, role: 'quiet', fusion: 0, counter: 0 },
  { id: 4, x: 0.62, y: 0.82, angle: 166, scale: 0.88, width: 0.8, bend: 0.27, phase: 0.56, role: 'quiet', fusion: 0, counter: 0 },
  { id: 5, x: 0.35, y: 0.8, angle: 194, scale: 0.94, width: 0.7, bend: -0.22, phase: 0.69, role: 'quiet', fusion: 0, counter: 0 },
  { id: 6, x: 0.16, y: 0.58, angle: 254, scale: 0.9, width: 0.84, bend: 0.16, phase: 0.81, role: 'quiet', fusion: 0, counter: 0 },
  { id: 7, x: 0.39, y: 0.48, angle: 322, scale: 0.74, width: 0.62, bend: -0.32, phase: 0.93, role: 'quiet', fusion: 0, counter: 0 }
];

const BASE_PORTS = [
  { id: 0, x: 0.12, y: 0.19, angle: 190, stroke: 0 },
  { id: 1, x: 0.42, y: 0.08, angle: 266, stroke: 1 },
  { id: 2, x: 0.86, y: 0.14, angle: 10, stroke: 2 },
  { id: 3, x: 0.94, y: 0.62, angle: 96, stroke: 3 },
  { id: 4, x: 0.68, y: 0.92, angle: 170, stroke: 4 },
  { id: 5, x: 0.27, y: 0.91, angle: 204, stroke: 5 },
  { id: 6, x: 0.06, y: 0.61, angle: 274, stroke: 6 },
  { id: 7, x: 0.32, y: 0.42, angle: 318, stroke: 7 }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(5));
const baseField = () => ({ strokes: clone(BASE_STROKES), ports: clone(BASE_PORTS) });
const withSignature = (field) => ({
  ...field,
  signature: JSON.stringify({
    strokes: field.strokes.map(({ id, x, y, angle, scale, width, bend, phase, role, fusion, counter }) => ({ id, x, y, angle, scale, width, bend, phase, role, fusion, counter })),
    ports: field.ports.map(({ id, x, y, angle, stroke }) => ({ id, x, y, angle, stroke }))
  })
});
const makeFrame = (field, memory = [], pending = [], history = memory, serial = 0, lastEvent = 'quiet', changedStrokeIds = []) => ({
  field: withSignature(field), memory, history, pending, serial, lastEvent, changedStrokeIds
});
const eventHash = (sequence, serial) => {
  let hash = 2166136261 ^ serial;
  for (const value of sequence) hash = Math.imul(hash ^ (value + 23), 16777619) >>> 0;
  return hash >>> 0;
};
const pickRemote = (sequence, serial) => {
  const blocked = new Set(sequence.map((portId) => BASE_PORTS[portId]?.stroke));
  const remote = [];
  let cursor = eventHash(sequence, serial) % STROKE_COUNT;
  while (remote.length < 2) {
    if (!blocked.has(cursor) && !remote.includes(cursor)) remote.push(cursor);
    cursor = (cursor + 3 + remote.length) % STROKE_COUNT;
  }
  return remote;
};

export const buildFrame = () => makeFrame(baseField());

export const beginLigature = (frame, portId) => {
  const id = Number(portId);
  if (!Number.isInteger(id) || id < 0 || id >= PORT_COUNT) return { ...frame, pending: [], lastEvent: 'refused mouth', changedStrokeIds: [] };
  return { ...frame, pending: [id], lastEvent: 'ligature armed', changedStrokeIds: [] };
};

export const finishLigature = (frame, portId) => {
  const id = Number(portId);
  if (!frame.pending?.length || !Number.isInteger(id) || id < 0 || id >= PORT_COUNT || frame.pending.includes(id) || frame.pending.length >= LIGATURE_LENGTH) {
    return { ...frame, lastEvent: 'refused ligature', changedStrokeIds: [] };
  }
  return { ...frame, pending: [...frame.pending, id], lastEvent: 'ligature complete', changedStrokeIds: [] };
};

const applyEvent = (field, event) => {
  const next = clone(field);
  const remote = pickRemote(event.sequence, event.serial);
  const polarity = event.sequence[0] < event.sequence[1] ? 1 : -1;
  remote.forEach((id, index) => {
    const stroke = next.strokes[id];
    const force = 0.045 + ((event.serial + index) % 3) * 0.018;
    stroke.x = round(clamp(stroke.x + polarity * (index === 0 ? force : -force * 0.72), 0.04, 0.96));
    stroke.y = round(clamp(stroke.y + (index === 0 ? -polarity : polarity) * force, 0.05, 0.95));
    stroke.angle = round(stroke.angle + polarity * (index === 0 ? 11 : -8));
    stroke.scale = round(clamp(stroke.scale + (index === 0 ? 0.08 : -0.045), 0.54, 1.3));
    stroke.width = round(clamp(stroke.width + (index === 0 ? 0.12 : 0.08), 0.4, 1.18));
    stroke.bend = round(clamp(stroke.bend + polarity * (index === 0 ? 0.18 : -0.13), -0.9, 0.9));
    stroke.phase = round((stroke.phase + 0.13 + event.sequence[index] * 0.017) % 1);
    stroke.fusion += 1;
    stroke.counter += index === 1 ? 1 : 0;
    stroke.role = index === 0 ? 'fused' : 'hinged';
  });
  return { field: next, remote };
};

const replay = (history) => {
  let field = baseField();
  let changedStrokeIds = [];
  for (const event of history) {
    const applied = applyEvent(field, event);
    field = applied.field;
    changedStrokeIds = applied.remote;
  }
  return { field, changedStrokeIds };
};

export const commitLigature = (frame) => {
  if (!frame.pending || frame.pending.length !== LIGATURE_LENGTH || new Set(frame.pending).size !== LIGATURE_LENGTH) {
    return { ...frame, pending: [], lastEvent: 'refused ligature', changedStrokeIds: [] };
  }
  const event = { sequence: [...frame.pending], serial: frame.serial + 1, mode: MODE };
  const history = [...(frame.history ?? frame.memory), event];
  const replayed = replay(history);
  return makeFrame(replayed.field, history.slice(-MEMORY_WINDOW), [], history, event.serial, 'remote hinge fused', replayed.changedStrokeIds);
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest' };
  const replayed = replay(history);
  return makeFrame(replayed.field, history.slice(-MEMORY_WINDOW), [], history, frame.serial, 'lifted latest', replayed.changedStrokeIds);
};

export const release = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });
