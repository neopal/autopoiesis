const CHAMBER_LAYOUT = [
  [0.27, 0.30, 0.88, 0.96],
  [0.46, 0.22, 1.02, 0.98],
  [0.67, 0.28, 0.92, 1.04],
  [0.25, 0.52, 1.08, 0.90],
  [0.48, 0.48, 0.94, 1.08],
  [0.72, 0.53, 1.04, 0.92],
  [0.48, 0.75, 1.14, 0.88]
];

const GATE_LAYOUT = [
  [0.19, 0.31, 24],
  [0.38, 0.17, 22],
  [0.67, 0.18, 24],
  [0.82, 0.48, 23],
  [0.65, 0.76, 22],
  [0.30, 0.72, 24]
];

export const CHAMBER_COUNT = CHAMBER_LAYOUT.length;
export const GATE_COUNT = GATE_LAYOUT.length;
export const GATE_CHAMBERS = [0, 1, 2, 5, 6, 3];
export const MEMORY_WINDOW = 4;
export const VIEWBOX = { width: 1000, height: 760 };

const round = (value) => Math.round(value * 1000) / 1000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function chamberPolygon(index, memory) {
  const [nx, ny, scaleX, scaleY] = CHAMBER_LAYOUT[index];
  let x = nx * VIEWBOX.width;
  let y = ny * VIEWBOX.height;
  let sx = scaleX * 74;
  let sy = scaleY * 54;
  let rotation = (index % 2 ? -0.14 : 0.12) + (index - 3) * 0.018;
  let notch = 0;

  for (const [eventIndex, event] of memory.entries()) {
    const remote = event.remoteIndices.indexOf(index);
    if (remote === -1) continue;
    const role = event.roles[remote];
    const pulse = 1 + (eventIndex + 1) * 0.035;
    if (role === 'unseal') {
      x += 18 * pulse;
      sx *= 1.15;
      rotation -= 0.16;
      notch += 0.30;
    } else if (role === 'fold') {
      y -= 14 * pulse;
      sy *= 0.78;
      rotation += 0.24;
      notch -= 0.20;
    } else {
      x -= 12 * pulse;
      sx *= 0.86;
      rotation += 0.10;
      notch += 0.16;
    }
  }

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const shape = [
    [-1.00, -0.58], [0.34, -0.82], [1.00, -0.28],
    [0.72 + notch, 0.16], [0.92, 0.78], [-0.16, 0.98],
    [-0.88, 0.54], [-0.78, -0.04]
  ];
  const points = shape.map(([px, py]) => {
    const localX = px * sx;
    const localY = py * sy;
    return {
      x: round(clamp(x + localX * cos - localY * sin, 70, 930)),
      y: round(clamp(y + localX * sin + localY * cos, 70, 690))
    };
  });
  return {
    index,
    points,
    centroid: { x: round(x), y: round(y) },
    signature: points.map(({ x: px, y: py }) => `${px},${py}`).join(' ')
  };
}

function makeGates() {
  return GATE_LAYOUT.map(([nx, ny, radius], index) => ({
    index,
    x: round(nx * VIEWBOX.width),
    y: round(ny * VIEWBOX.height),
    radius,
    signature: `${index}:${round(nx * VIEWBOX.width)},${round(ny * VIEWBOX.height)},${radius}`
  }));
}

function normalizeMemory(memory) {
  return Array.isArray(memory) ? memory.slice(-MEMORY_WINDOW).map((event) => ({
    sourceIndices: [...event.sourceIndices],
    remoteIndices: [...event.remoteIndices],
    roles: [...event.roles]
  })) : [];
}

export function geometrySignature(frame) {
  return frame.chambers.map((chamber) => chamber.signature).join('|');
}

export function buildFrame(memory = []) {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'chamber-body',
    chambers: CHAMBER_LAYOUT.map((_, index) => chamberPolygon(index, normalizedMemory)),
    gates: makeGates(),
    memory: normalizedMemory,
    selection: [],
    pending: [],
    interaction: normalizedMemory.length ? 'settled' : 'quiet',
    event: null,
    state: { sweepCount: normalizedMemory.length }
  };
}

export function beginSweep(frame, gateIndex) {
  if (!Number.isInteger(gateIndex) || gateIndex < 0 || gateIndex >= GATE_COUNT) return frame;
  return {
    ...frame,
    pending: [gateIndex],
    selection: [gateIndex],
    interaction: 'sweep-started',
    event: null
  };
}

export function visitGate(frame, gateIndex) {
  if (!Number.isInteger(gateIndex) || gateIndex < 0 || gateIndex >= GATE_COUNT) return frame;
  if (!frame.pending?.length) return beginSweep(frame, gateIndex);
  if (frame.pending.includes(gateIndex) || frame.pending.length >= 2) return frame;
  const pending = [...frame.pending, gateIndex];
  return {
    ...frame,
    pending,
    selection: pending,
    interaction: 'sweep-ready',
    event: null
  };
}

function remoteChambers(sourceIndices, memoryLength) {
  const sourceChambers = new Set(sourceIndices.map((index) => GATE_CHAMBERS[index]));
  const start = (sourceIndices[0] * 3 + sourceIndices[1] * 5 + memoryLength + 1) % CHAMBER_COUNT;
  const remote = [];
  for (let offset = 0; offset < CHAMBER_COUNT && remote.length < 3; offset += 1) {
    const candidate = (start + offset) % CHAMBER_COUNT;
    if (!sourceChambers.has(candidate)) remote.push(candidate);
  }
  return remote;
}

export function commitSweep(frame) {
  if (!Array.isArray(frame.pending) || frame.pending.length !== 2) {
    return {
      ...frame,
      interaction: 'sweep-refused-incomplete',
      event: { type: 'sweep-refused', sourceIndices: [...(frame.pending ?? [])] }
    };
  }
  const sourceIndices = [...frame.pending];
  const remoteIndices = remoteChambers(sourceIndices, frame.memory.length);
  const event = {
    type: 'chamber-knot',
    sourceIndices,
    remoteIndices,
    roles: ['unseal', 'fold', 'seal']
  };
  const next = buildFrame([...frame.memory, event]);
  next.selection = sourceIndices;
  next.pending = [];
  next.interaction = 'sweep-committed';
  next.event = event;
  return next;
}

export function buildTimeline() {
  const pairs = [[0, 3], [1, 4], [2, 5], [0, 4]];
  const timeline = [buildFrame()];
  for (const [first, second] of pairs) {
    const ready = visitGate(beginSweep(timeline.at(-1), first), second);
    timeline.push(commitSweep(ready));
  }
  return timeline;
}

export function liftLatestSweep(frame) {
  if (!frame.memory.length) return frame;
  const lifted = buildFrame(frame.memory.slice(0, -1));
  lifted.interaction = 'sweep-lifted';
  return lifted;
}

export function releaseRegister() {
  return buildFrame();
}
