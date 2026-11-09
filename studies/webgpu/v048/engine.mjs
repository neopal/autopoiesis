export const SEED = 0x57473048;
export const PORT_COUNT = 5;
export const MEMORY_LIMIT = 4;
export const SURFACE_ROWS = 15;
export const SURFACE_COLS = 24;
export const MIN_ROUTE_SPAN = 0.18;

const PORT_LAYOUT = [
  { nx: 0.14, ny: 0.18 },
  { nx: 0.72, ny: 0.12 },
  { nx: 0.9, ny: 0.52 },
  { nx: 0.66, ny: 0.88 },
  { nx: 0.12, ny: 0.72 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 17.271 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};
const cloneGesture = (gesture) => gesture ? { ...gesture } : null;
const cloneMemory = (memory) => memory.map((event) => ({ ...event }));
const normalizePort = (value, fallback = 0) => integer(value, fallback, 0, PORT_COUNT - 1);

const portParam = (index) => {
  const port = PORT_LAYOUT[normalizePort(index)];
  return { x: port.nx * 2 - 1, y: port.ny * 2 - 1 };
};

const distanceToSegment = (x, y, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / lengthSq, 0, 1);
  const px = a.x + dx * t;
  const py = a.y + dy * t;
  return Math.hypot(x - px, y - py);
};

const baseVertices = () => {
  const vertices = [];
  for (let row = 0; row < SURFACE_ROWS; row += 1) {
    const v = row / (SURFACE_ROWS - 1) * 2 - 1;
    for (let column = 0; column < SURFACE_COLS; column += 1) {
      const u = column / (SURFACE_COLS - 1) * 2.3 - 1.15;
      const bowl = Math.cos(v * Math.PI * 0.72) * 0.12;
      vertices.push({
        u: round(u),
        v: round(v),
        x: round(u * 1.55),
        y: round(v * 0.98 + Math.sin(u * 2.3 + v * 0.8) * 0.07),
        z: round(Math.sin(u * 2.15) * 0.16 + bowl + Math.cos(v * 3.1) * 0.05),
        pressure: 0,
        torsion: 0
      });
    }
  }
  return vertices;
};

const buildFaces = () => {
  const faces = [];
  for (let row = 0; row < SURFACE_ROWS - 1; row += 1) {
    for (let column = 0; column < SURFACE_COLS - 1; column += 1) {
      const a = row * SURFACE_COLS + column;
      const b = a + 1;
      const c = a + SURFACE_COLS;
      const d = c + 1;
      if ((row + column) % 2 === 0) {
        faces.push([a, b, d], [a, d, c]);
      } else {
        faces.push([a, b, c], [b, d, c]);
      }
    }
  }
  return faces;
};

const normalizeEvent = (event = {}, serial = 0) => {
  const entry = normalizePort(event.entry, serial === 0 ? 0 : 0);
  const exit = normalizePort(event.exit, expectedExitFor(entry, serial));
  return {
    id: `pressure-route-${serial + 1}`,
    type: 'pressure-route',
    entry,
    exit,
    direction: finite(event.direction, ((exit - entry + PORT_COUNT) % PORT_COUNT) <= 2 ? 1 : -1) < 0 ? -1 : 1,
    serial,
    reason: event.reason ?? 'material-route'
  };
};

export const expectedExitFor = (entry, serial = 0) => wrap(normalizePort(entry) + 2 + (serial % 3), PORT_COUNT);

const applyRoute = (vertices, event) => {
  const start = portParam(event.entry);
  const end = portParam(event.exit);
  return vertices.map((vertex) => {
    const distance = distanceToSegment(vertex.u, vertex.v, start, end);
    const band = Math.exp(-(distance * distance) / (0.18 + event.serial * 0.022));
    const global = 0.025 + event.serial * 0.008;
    const wave = Math.sin(vertex.u * 3.4 + vertex.v * 2.6 + event.serial * 0.9) * global;
    const direction = event.direction;
    return {
      ...vertex,
      x: round(vertex.x + direction * band * (0.08 + Math.abs(vertex.v) * 0.06) + wave * 0.55),
      y: round(vertex.y + direction * band * (0.17 + Math.abs(vertex.u) * 0.08) + wave),
      z: round(vertex.z + band * (0.34 + event.serial * 0.045) + Math.cos(vertex.u * 2.2 - vertex.v * 2.8) * global),
      pressure: round(clamp(vertex.pressure + band * (0.48 + event.serial * 0.05) + global, 0, 1)),
      torsion: round(vertex.torsion + direction * band * (0.22 + event.serial * 0.03) + wave)
    };
  });
};

const seamFor = (event) => {
  const start = portParam(event.entry);
  const end = portParam(event.exit);
  return {
    id: event.id,
    entry: event.entry,
    exit: event.exit,
    points: Array.from({ length: 9 }, (_, index) => {
      const t = index / 8;
      return {
        u: round(start.x + (end.x - start.x) * t),
        v: round(start.y + (end.y - start.y) * t + Math.sin(t * Math.PI) * 0.12 * event.direction),
        lift: round(0.12 + Math.sin(t * Math.PI) * (0.15 + event.serial * 0.03))
      };
    })
  };
};

const buildPorts = (nextEntry) => PORT_LAYOUT.map((port, index) => ({
  id: index,
  nx: port.nx,
  ny: port.ny,
  param: portParam(index),
  role: index === nextEntry ? 'source' : 'quiet'
}));

const buildField = (memory) => {
  let vertices = baseVertices();
  const seams = [];
  cloneMemory(memory).forEach((event) => {
    const normalized = normalizeEvent(event, seams.length);
    vertices = applyRoute(vertices, normalized);
    seams.push(seamFor(normalized));
  });
  const nextEntry = seams.at(-1)?.exit ?? 0;
  const field = {
    kind: 'pressure-shell',
    surface: { vertices, faces: buildFaces() },
    seams,
    ports: buildPorts(nextEntry),
    nextEntry,
    signature: ''
  };
  field.signature = JSON.stringify({ surface: field.surface.vertices, seams: field.seams, nextEntry });
  return field;
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : []).slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const frameFrom = (memory, lastAction = 'quiet', gesture = null, event = null) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'pressure-shell',
    renderer: 'deterministic p5.js 1.11.3 WEBGL pressure shell',
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

export const pressPort = (frame, port) => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'route-refused-memory-limit');
  const normalizedPort = normalizePort(port, 0);
  if (frame.gesture?.entry === normalizedPort) return frameFrom(frame.memory, 'route-refused-repeat');
  if (frame.gesture) return frameFrom(frame.memory, 'route-refused-active-route');
  if (normalizedPort !== frame.field.nextEntry) return frameFrom(frame.memory, 'route-refused-origin');
  return frameFrom(frame.memory, 'pressure-armed', { entry: normalizedPort });
};

export const commitRoute = (frame, entry, exit, reason = 'material-route') => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'route-refused-memory-limit');
  const normalizedEntry = normalizePort(entry, frame.field.nextEntry);
  const normalizedExit = normalizePort(exit, expectedExitFor(normalizedEntry, frame.memory.length));
  if (normalizedEntry !== frame.field.nextEntry) return frameFrom(frame.memory, 'route-refused-origin');
  if (normalizedExit === normalizedEntry || normalizedExit !== expectedExitFor(normalizedEntry, frame.memory.length)) return frameFrom(frame.memory, 'route-refused-exit');
  const event = normalizeEvent({ entry: normalizedEntry, exit: normalizedExit, reason }, frame.memory.length);
  return frameFrom([...frame.memory, event], 'pressure-committed', null, event);
};

export const releaseAtPort = (frame, exit) => {
  if (!frame?.gesture) return frameFrom(frame?.memory ?? [], 'route-refused-no-pressure');
  const normalizedExit = normalizePort(exit, 0);
  if (normalizedExit === frame.gesture.entry) return frameFrom(frame.memory, 'route-refused-short');
  return commitRoute(frame, frame.gesture.entry, normalizedExit, 'pointer-pressure-route');
};

export const defaultRoute = (frame) => {
  const entry = frame?.field?.nextEntry ?? 0;
  return { entry, exit: expectedExitFor(entry, frame?.memory?.length ?? 0) };
};

export const commitDefaultRoute = (frame) => {
  const route = defaultRoute(frame);
  return commitRoute(frame, route.entry, route.exit, 'deterministic-pressure-route');
};

export const liftLatest = (frame) => frameFrom((frame?.memory ?? []).slice(0, -1), 'pressure-lifted', null, { type: 'pressure-lifted' });
export const releaseMaterial = () => frameFrom([], 'material-released');

export const buildTimeline = () => {
  const timeline = [buildFrame()];
  for (let serial = 0; serial < MEMORY_LIMIT; serial += 1) timeline.push(commitDefaultRoute(timeline.at(-1)));
  return timeline;
};
