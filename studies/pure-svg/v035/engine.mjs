const BASE_SEED = 0x53564735;
export const PORT_COUNT = 8;
export const MEMORY_WINDOW = 4;
export const MIN_DWELL_MS = 240;
export const MAX_DWELL_MS = 1320;

const PORT_LAYOUT = [
  { angle: -90, radius: 0.31, phase: 0.08 },
  { angle: -45, radius: 0.32, phase: 0.19 },
  { angle: 0, radius: 0.33, phase: 0.31 },
  { angle: 45, radius: 0.31, phase: 0.43 },
  { angle: 90, radius: 0.32, phase: 0.57 },
  { angle: 135, radius: 0.31, phase: 0.68 },
  { angle: 180, radius: 0.33, phase: 0.81 },
  { angle: 225, radius: 0.31, phase: 0.94 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));

function rotate(x, y, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine];
}

function pathFrom(points, close = true) {
  const path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  return close ? `${path} Z` : path;
}

function ellipsePath(cx, cy, rx, ry, rotation = 0, points = 18) {
  const vertices = [];
  for (let index = 0; index < points; index += 1) {
    const theta = Math.PI * 2 * index / points;
    const [x, y] = rotate(Math.cos(theta) * rx, Math.sin(theta) * ry, rotation);
    vertices.push([(cx + x) * 1000, (cy + y) * 760]);
  }
  return pathFrom(vertices);
}

function portCenter(port) {
  const radians = port.angle * Math.PI / 180;
  const wobble = Math.sin(port.phase * 17 + port.bend) * 0.008;
  return [
    0.5 + Math.cos(radians) * (port.radius + wobble),
    0.5 + Math.sin(radians) * (port.radius + wobble) * 0.78
  ];
}

function outerPath(state) {
  const points = [];
  for (let index = 0; index < 24; index += 1) {
    const theta = Math.PI * 2 * index / 24;
    const pulse = Math.sin(theta * 3 + state.drift) * 0.012;
    const lobe = Math.cos(theta * 5 + state.twist) * 0.009;
    const [x, y] = rotate(
      Math.cos(theta) * (0.39 + pulse + lobe),
      Math.sin(theta) * (0.29 + pulse * 0.5),
      state.twist * 5
    );
    points.push([(0.5 + x) * 1000, (0.5 + y) * 760]);
  }
  return pathFrom(points);
}

function centralVoid(state) {
  const points = [];
  for (let index = 0; index < 18; index += 1) {
    const theta = Math.PI * 2 * index / 18;
    const ripple = Math.sin(theta * 3 + state.twist) * 0.012;
    const [x, y] = rotate(
      Math.cos(theta) * (0.155 + ripple),
      Math.sin(theta) * (0.11 + ripple * 0.4),
      -12 + state.twist * 4
    );
    points.push([(0.5 + x) * 1000, (0.5 + y) * 760]);
  }
  return pathFrom(points);
}

function portVoid(port) {
  const [x, y] = portCenter(port);
  const radius = 0.018 + port.aperture * 0.032;
  const width = radius * (1.55 + port.attention * 0.08);
  const height = radius * (0.72 + port.aperture * 0.24);
  return ellipsePath(x, y, width, height, port.angle + port.bend, 12);
}

function channelPath(port) {
  const [cx, cy] = portCenter(port);
  const radians = port.angle * Math.PI / 180;
  const tangent = [-Math.sin(radians), Math.cos(radians)];
  const radial = [Math.cos(radians), Math.sin(radians)];
  const inner = [cx + radial[0] * 0.025, cy + radial[1] * 0.025];
  const outer = [cx + radial[0] * 0.14, cy + radial[1] * 0.14];
  const half = 0.008 + port.aperture * 0.006;
  const points = [
    [(inner[0] + tangent[0] * half) * 1000, (inner[1] + tangent[1] * half) * 760],
    [(outer[0] + tangent[0] * half * 1.8) * 1000, (outer[1] + tangent[1] * half * 1.8) * 760],
    [(outer[0] - tangent[0] * half * 1.8) * 1000, (outer[1] - tangent[1] * half * 1.8) * 760],
    [(inner[0] - tangent[0] * half) * 1000, (inner[1] - tangent[1] * half) * 760]
  ];
  return pathFrom(points);
}

function basePort(index) {
  const source = PORT_LAYOUT[index];
  return {
    id: index,
    angle: source.angle,
    radius: source.radius,
    phase: source.phase,
    bend: 0,
    aperture: 0.24,
    attention: 0,
    role: 'quiet',
    pathSignature: ''
  };
}

function baseState() {
  return { drift: 0, twist: 0, cuts: [] };
}

function applyEvent(ports, state, event) {
  ports.forEach((port) => { port.role = 'quiet'; });
  const watched = ports[event.watchedPort];
  const unobserved = ports[event.unobservedPort];
  const seam = ports[event.seamPort];

  watched.attention = clamp(watched.attention + 1, 0, 4);
  watched.aperture = clamp(watched.aperture - 0.045, 0.08, 0.5);
  watched.bend += event.direction * 5;
  watched.role = 'watched';

  unobserved.attention = clamp(unobserved.attention + 1, 0, 4);
  unobserved.aperture = clamp(unobserved.aperture + 0.25, 0.24, 1.4);
  unobserved.radius = clamp(unobserved.radius + event.direction * 0.022, 0.27, 0.39);
  unobserved.bend -= event.direction * (9 + event.index * 2);
  unobserved.role = 'unobserved';

  seam.bend += event.direction * 7;
  seam.radius = clamp(seam.radius - event.direction * 0.012, 0.27, 0.39);
  seam.role = 'seam';

  state.drift += event.direction * 0.48;
  state.twist += event.direction * 0.64;
  if (!state.cuts.includes(event.unobservedPort)) state.cuts.push(event.unobservedPort);
}

function topologyState(memory) {
  const ports = PORT_LAYOUT.map((_, index) => basePort(index));
  const state = baseState();
  for (const event of memory) applyEvent(ports, state, event);
  for (const port of ports) port.pathSignature = portVoid(port);
  const bodyPath = [outerPath(state), centralVoid(state), ...ports.map(portVoid), ...state.cuts.map((index) => channelPath(ports[index]))].join(' ');
  return { ports, state, bodyPath };
}

function frameFrom(stage, memory, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const { ports, state, bodyPath } = topologyState(safeMemory);
  return {
    grammar: 'attention-topology',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    ports,
    state,
    bodyPath,
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
}

function nearestPort(ports, point) {
  const x = clamp(Number(point?.x ?? 0.5), 0, 1);
  const y = clamp(Number(point?.y ?? 0.5), 0, 1);
  let winner = 0;
  let score = Infinity;
  ports.forEach((port) => {
    const [px, py] = portCenter(port);
    const distance = (px - x) ** 2 + (py - y) ** 2;
    if (distance < score) {
      score = distance;
      winner = port.id;
    }
  });
  return winner;
}

function leastAttendedPort(ports, exclude) {
  return ports
    .filter((port) => port.id !== exclude)
    .sort((left, right) => left.attention - right.attention || left.id - right.id)[0].id;
}

export function buildFrame(stage = 0, memory = []) {
  const frame = frameFrom(stage, memory, 'still', null);
  frame.signature = geometrySignature(frame);
  return frame;
}

export function geometrySignature(frame) {
  return `${frame.bodyPath}||${frame.ports.map((port) => `${port.id}:${port.role}:${port.pathSignature || portVoid(port)}`).join('||')}`;
}

export function applyAttention(frame, rawOffer) {
  const duration = Number(rawOffer?.duration ?? 0);
  if (frame.memory.length >= MEMORY_WINDOW) {
    const full = frameFrom(frame.stage, frame.memory, 'attention-memory-full', { committed: false, reason: 'memory-full' });
    full.signature = geometrySignature(full);
    return full;
  }
  if (duration < MIN_DWELL_MS) {
    const refused = frameFrom(frame.stage, frame.memory, 'attention-refused-flicker', { committed: false, reason: 'flicker', duration });
    refused.signature = geometrySignature(refused);
    return refused;
  }
  if (duration > MAX_DWELL_MS) {
    const refused = frameFrom(frame.stage, frame.memory, 'attention-refused-overheld', { committed: false, reason: 'overheld', duration });
    refused.signature = geometrySignature(refused);
    return refused;
  }

  const watchedPort = nearestPort(frame.ports, rawOffer?.point ?? rawOffer);
  const unobservedPort = leastAttendedPort(frame.ports, watchedPort);
  const seamPort = wrap(watchedPort + 3 + frame.memory.length, PORT_COUNT);
  const band = duration < 520 ? 'near' : duration < 900 ? 'middle' : 'far';
  const event = {
    committed: true,
    type: 'attention-rewire',
    index: frame.memory.length,
    duration,
    band,
    watchedPort,
    unobservedPort,
    seamPort,
    direction: duration >= 680 ? 1 : -1,
    resistance: Number((duration / MAX_DWELL_MS).toFixed(3))
  };
  const next = frameFrom(frame.stage + 1, [...frame.memory, event], 'attention-rewired', event);
  next.signature = geometrySignature(next);
  return next;
}

export function liftLatestAttention(frame) {
  const next = frame.memory.length
    ? frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'attention-lifted', { committed: false, lifted: true })
    : frameFrom(frame.stage, [], 'lift-empty', { committed: false });
  next.signature = geometrySignature(next);
  return next;
}

export function releaseTopology() {
  const frame = frameFrom(0, [], 'released', { committed: false, released: true });
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline() {
  const offers = [
    { point: { x: 0.5, y: 0.18 }, duration: 420 },
    { point: { x: 0.8, y: 0.42 }, duration: 760 },
    { point: { x: 0.52, y: 0.8 }, duration: 540 },
    { point: { x: 0.18, y: 0.46 }, duration: 980 }
  ];
  let frame = buildFrame();
  const frames = [frame];
  for (const offer of offers) {
    frame = applyAttention(frame, offer);
    frames.push(frame);
  }
  return frames;
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'attention-topology',
  rule: 'situated attention opens the least-observed threshold and rewires one closed SVG body',
  memoryWindow: MEMORY_WINDOW
};
