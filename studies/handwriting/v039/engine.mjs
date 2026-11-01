const JUNCTION_COUNT = 12;
export const ROUTE_LENGTH = 4;
export const MEMORY_WINDOW = 4;

const BASE_JUNCTIONS = [
  { x: 0.10, y: 0.19, angle: -18, spread: 0.42, weight: 0.84, phase: 0.12 },
  { x: 0.28, y: 0.13, angle: 9, spread: 0.38, weight: 0.66, phase: 0.28 },
  { x: 0.49, y: 0.19, angle: 24, spread: 0.46, weight: 0.94, phase: 0.44 },
  { x: 0.73, y: 0.12, angle: -10, spread: 0.34, weight: 0.72, phase: 0.61 },
  { x: 0.89, y: 0.30, angle: 38, spread: 0.52, weight: 0.88, phase: 0.76 },
  { x: 0.68, y: 0.43, angle: -28, spread: 0.48, weight: 0.58, phase: 0.89 },
  { x: 0.86, y: 0.70, angle: 17, spread: 0.40, weight: 0.78, phase: 0.07 },
  { x: 0.58, y: 0.80, angle: -8, spread: 0.55, weight: 0.98, phase: 0.21 },
  { x: 0.34, y: 0.88, angle: 31, spread: 0.37, weight: 0.61, phase: 0.36 },
  { x: 0.12, y: 0.70, angle: -34, spread: 0.49, weight: 0.83, phase: 0.53 },
  { x: 0.22, y: 0.47, angle: 14, spread: 0.43, weight: 0.69, phase: 0.67 },
  { x: 0.46, y: 0.51, angle: -22, spread: 0.50, weight: 0.90, phase: 0.82 }
].map((junction, index) => ({ id: index, ...junction, mode: 'quiet' }));

const BASE_EDGES = [
  [0, 1, 0.08, 0.78], [1, 2, -0.12, 0.54], [2, 3, 0.10, 0.82],
  [3, 4, -0.16, 0.62], [4, 5, 0.14, 0.92], [5, 6, -0.11, 0.56],
  [6, 7, 0.17, 0.76], [7, 8, -0.13, 0.98], [8, 9, 0.09, 0.64],
  [9, 10, -0.18, 0.86], [10, 11, 0.12, 0.70], [11, 0, -0.15, 0.90],
  [0, 10, 0.23, 0.48], [10, 5, -0.24, 0.74], [5, 2, 0.18, 0.63],
  [2, 7, -0.20, 0.82], [7, 11, 0.16, 0.58], [11, 4, -0.19, 0.72],
  [4, 8, 0.21, 0.54], [8, 0, -0.22, 0.68]
].map(([a, b, bend, weight], id) => ({ id, a, b, bend, weight, phase: (id * 0.17) % 1, mode: 'quiet' }));

const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hashRoute = (route, serial = 0) => {
  let hash = 2166136261 ^ serial;
  for (const id of route) hash = Math.imul(hash ^ (id + 31), 16777619);
  return hash >>> 0;
};
const pickDistinct = (start, used) => {
  let index = start % JUNCTION_COUNT;
  while (used.includes(index)) index = (index + 1) % JUNCTION_COUNT;
  return index;
};
const clone = (value) => JSON.parse(JSON.stringify(value));

const baseField = () => ({ junctions: clone(BASE_JUNCTIONS), edges: clone(BASE_EDGES) });
const signatureFor = (field) => JSON.stringify({
  junctions: field.junctions.map(({ id, x, y, angle, spread, weight, phase, mode }) => [id, round(x), round(y), round(angle), round(spread), round(weight), round(phase), mode]),
  edges: field.edges.map(({ id, a, b, bend, weight, phase, mode }) => [id, a, b, round(bend), round(weight), round(phase), mode])
});
const makeField = (field) => ({ ...field, signature: signatureFor(field) });
const makeFrame = (field, memory = [], pending = [], serial = 0, lastEvent = 'quiet', changedJunctionIds = [], changedEdgeIds = [], history = memory) => ({
  field: makeField(field),
  memory,
  history,
  pending,
  serial,
  lastEvent,
  changedJunctionIds,
  changedEdgeIds
});

export const buildFrame = () => makeFrame(baseField());

export const beginRoute = (frame, junctionId) => {
  const id = Number(junctionId);
  if (!Number.isInteger(id) || id < 0 || id >= JUNCTION_COUNT) return { ...frame, lastEvent: 'refused junction', changedJunctionIds: [], changedEdgeIds: [] };
  return { ...frame, pending: [id], lastEvent: 'route armed', changedJunctionIds: [], changedEdgeIds: [] };
};

export const appendRoute = (frame, junctionId) => {
  const id = Number(junctionId);
  if (!Number.isInteger(id) || id < 0 || id >= JUNCTION_COUNT || frame.pending.length >= ROUTE_LENGTH || frame.pending.includes(id)) {
    return { ...frame, lastEvent: 'refused route', changedJunctionIds: [], changedEdgeIds: [] };
  }
  const pending = [...frame.pending, id];
  return { ...frame, pending, lastEvent: pending.length === ROUTE_LENGTH ? 'route complete' : 'route tracing', changedJunctionIds: [], changedEdgeIds: [] };
};

const applyEvent = (field, route, serial) => {
  const next = clone(field);
  const hash = hashRoute(route, serial);
  const remote = [];
  let cursor = (hash >>> 3) % JUNCTION_COUNT;
  while (remote.length < 3) {
    cursor = pickDistinct(cursor, [...route, ...remote]);
    remote.push(cursor);
    cursor += 2 + (hash % 3);
  }
  const modes = ['turn', 'splice', 'stutter'];
  remote.forEach((id, index) => {
    const junction = next.junctions[id];
    const direction = ((hash >>> (index * 5)) & 1) ? 1 : -1;
    junction.x = round(clamp(junction.x + direction * (0.012 + ((hash >>> (index + 2)) % 9) * 0.002), 0.05, 0.95));
    junction.y = round(clamp(junction.y + (index === 1 ? -direction : direction) * (0.010 + ((hash >>> (index + 7)) % 7) * 0.002), 0.08, 0.92));
    junction.angle = round(junction.angle + direction * (8 + index * 4 + (hash % 5)));
    junction.spread = round(clamp(junction.spread + direction * (0.05 + index * 0.018), 0.22, 0.78));
    junction.weight = round(clamp(junction.weight + (index === 1 ? -0.13 : 0.11), 0.35, 1.28));
    junction.phase = round((junction.phase + 0.13 + index * 0.07) % 1);
    junction.mode = modes[index];
  });

  const changedEdges = [];
  next.edges.forEach((edge) => {
    const remoteIndex = remote.findIndex((id) => edge.a === id || edge.b === id);
    if (remoteIndex === -1) return;
    const direction = ((hash >>> (remoteIndex + 11)) & 1) ? 1 : -1;
    edge.bend = round(clamp(edge.bend + direction * (0.08 + remoteIndex * 0.025), -0.48, 0.48));
    edge.weight = round(clamp(edge.weight + (remoteIndex === 2 ? -0.16 : 0.10), 0.22, 1.24));
    edge.phase = round((edge.phase + 0.17 + remoteIndex * 0.09) % 1);
    edge.mode = modes[remoteIndex];
    changedEdges.push(edge.id);
  });
  return { field: next, changedJunctionIds: remote, changedEdgeIds: changedEdges, route: [...route] };
};

const replay = (history) => {
  let field = baseField();
  let changedJunctionIds = [];
  let changedEdgeIds = [];
  for (const event of history) {
    const applied = applyEvent(field, event.route, event.serial);
    field = applied.field;
    changedJunctionIds = applied.changedJunctionIds;
    changedEdgeIds = applied.changedEdgeIds;
  }
  return { field, changedJunctionIds, changedEdgeIds };
};

const decorateEvents = (events) => events.map((event) => {
  const applied = applyEvent(baseField(), event.route, event.serial);
  return { ...event, changedJunctionIds: applied.changedJunctionIds, changedEdgeIds: applied.changedEdgeIds };
});

export const commitRoute = (frame, explicitRoute = frame.pending) => {
  const route = [...(explicitRoute ?? [])].map(Number);
  const valid = route.length === ROUTE_LENGTH && route.every((id) => Number.isInteger(id) && id >= 0 && id < JUNCTION_COUNT) && new Set(route).size === ROUTE_LENGTH;
  if (!valid) return { ...frame, pending: [], lastEvent: 'refused route', changedJunctionIds: [], changedEdgeIds: [] };
  const serial = frame.serial + 1;
  const history = [...(frame.history ?? frame.memory), { route, serial, mode: 'remote-rewire' }];
  const memory = history.slice(-MEMORY_WINDOW);
  const applied = replay(history);
  const events = decorateEvents(memory);
  return makeFrame(applied.field, events, [], serial, 'route rewired remotely', applied.changedJunctionIds, applied.changedEdgeIds, history);
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest' };
  const memory = history.slice(-MEMORY_WINDOW);
  const replayed = replay(history);
  const events = decorateEvents(memory);
  return makeFrame(replayed.field, events, [], frame.serial, 'lifted latest', replayed.changedJunctionIds, replayed.changedEdgeIds, history);
};

export const release = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });
export const getFrame = (frame) => frame;
export const getJunctionCount = () => JUNCTION_COUNT;
