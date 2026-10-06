export const SEED = 0x53564754;
export const STAGES = 17;
export const PRIMITIVE_BUDGET = 1;
export const MEMORY_LIMIT = 4;
export const PORT_COUNT = 7;
export const WITNESS_THRESHOLD = 2;

export const PORT_CENTERS = [
  [212, 262], [338, 184], [506, 192], [720, 246], [764, 402], [548, 484], [278, 448]
];

const AUTO_PAIRS = [
  [1, 5], [4, 0], [6, 2], [3, 6], [0, 4], [5, 1]
];

const OUTER_POINTS = [
  [112, 282], [158, 188], [278, 116], [414, 144], [500, 108], [640, 132],
  [786, 188], [884, 286], [842, 372], [908, 474], [824, 558], [686, 542],
  [566, 598], [430, 556], [312, 592], [180, 520], [104, 420], [158, 348]
];

const CORE_VOID = [
  [358, 286], [426, 232], [520, 246], [598, 298], [616, 382],
  [558, 444], [468, 438], [388, 404], [340, 346]
];

const PORT_ANGLES = [0.22, 1.12, 1.78, 2.52, -2.72, -1.84, -0.92];
const PORT_SIZES = [26, 28, 24, 31, 26, 29, 25];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function copyPoints(points) {
  return points.map(([x, y]) => [x, y]);
}

function copyMemory(memory) {
  return memory.map((event) => ({ ...event }));
}

function boundedStage(stage) {
  return clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
}

function safePort(index) {
  const numeric = Number.isFinite(Number(index)) ? Math.floor(Number(index)) : 0;
  return ((numeric % PORT_COUNT) + PORT_COUNT) % PORT_COUNT;
}

function pointSignature([x, y]) {
  return `${x.toFixed(3)},${y.toFixed(3)}`;
}

function pointsSignature(points) {
  return points.map(pointSignature).join('|');
}

function pathData(points) {
  return `M ${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`;
}

function centroid(points) {
  return points.reduce(([x, y], [px, py]) => [x + px / points.length, y + py / points.length], [0, 0]);
}

function transformPolygon(points, { dx = 0, dy = 0, scale = 1, turn = 0, shear = 0 }) {
  const [cx, cy] = centroid(points);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return points.map(([x, y], index) => {
    const localX = (x - cx) * scale;
    const localY = (y - cy) * scale;
    const rotatedX = localX * cos - localY * sin;
    const rotatedY = localX * sin + localY * cos;
    const bias = (index - (points.length - 1) / 2) * shear;
    return [
      Number((cx + rotatedX + dx + bias).toFixed(3)),
      Number((cy + rotatedY + dy + bias * 0.24).toFixed(3))
    ];
  });
}

function basePortPoints(index, stage) {
  const [cx, cy] = PORT_CENTERS[index];
  const angle = PORT_ANGLES[index];
  const size = PORT_SIZES[index];
  const phase = boundedStage(stage) * 0.055 + index * 0.37;
  const points = [
    [cx - size * 1.1, cy - size * 0.22],
    [cx - size * 0.48, cy - size * 0.86],
    [cx + size * 0.42, cy - size * 0.76],
    [cx + size * 1.1, cy - size * 0.08],
    [cx + size * 0.56, cy + size * 0.78],
    [cx - size * 0.28, cy + size * 0.92],
    [cx - size * 0.98, cy + size * 0.36]
  ];
  return transformPolygon(points, {
    turn: angle + Math.sin(phase) * 0.03,
    shear: Math.cos(phase) * 0.12
  });
}

function basePorts(stage) {
  return PORT_CENTERS.map((_, index) => ({
    index,
    center: [...PORT_CENTERS[index]],
    points: basePortPoints(index, stage),
    role: 'quiet',
    pressure: 0
  }));
}

function eventFor(stage, memory, source, remote, origin = 'auto-witness') {
  const safeSource = safePort(source);
  const safeRemote = safePort(remote);
  let bridge = safePort(safeSource + 2 + memory.length);
  while (bridge === safeSource || bridge === safeRemote) bridge = safePort(bridge + 1);
  const force = Number((1 + ((boundedStage(stage) + memory.length) % 4) * 0.08).toFixed(4));
  return {
    kind: 'relation',
    mode: 'topological-splice',
    gesture: 'two-witness-click',
    origin,
    stage: boundedStage(stage),
    source: safeSource,
    remote: safeRemote,
    bridge,
    force,
    ordinal: memory.length
  };
}

function applyMemory(ports, memory) {
  const nextPorts = ports.map((port) => ({ ...port, center: [...port.center], points: copyPoints(port.points) }));
  const changes = [];

  for (const [memoryIndex, event] of memory.entries()) {
    const source = safePort(event.source);
    const remote = safePort(event.remote);
    const bridge = safePort(event.bridge ?? source + 2 + memoryIndex);
    const force = clamp(event.force ?? 1, 1, 1.32);
    const direction = memoryIndex % 2 === 0 ? 1 : -1;

    const sourcePort = nextPorts[source];
    sourcePort.points = transformPolygon(sourcePort.points, {
      dx: direction * (7 + force * 4),
      dy: -direction * (5 + force * 3),
      scale: 0.52 - memoryIndex * 0.025,
      turn: direction * (0.12 + force * 0.015),
      shear: direction * 0.8
    });
    sourcePort.pressure = Number((sourcePort.pressure + force).toFixed(4));
    sourcePort.role = 'sealed';

    const remotePort = nextPorts[remote];
    remotePort.points = transformPolygon(remotePort.points, {
      dx: -direction * (8 + force * 5),
      dy: direction * (6 + force * 4),
      scale: 1.62 + memoryIndex * 0.035,
      turn: -direction * (0.14 + force * 0.02),
      shear: -direction * 1.1
    });
    remotePort.pressure = Number((remotePort.pressure + force * 0.88).toFixed(4));
    remotePort.role = 'opened';

    const bridgePort = nextPorts[bridge];
    bridgePort.points = transformPolygon(bridgePort.points, {
      dx: direction * 4.5,
      dy: direction * 2.5,
      scale: 1.08,
      turn: direction * 0.05,
      shear: direction * 0.4
    });
    bridgePort.pressure = Number((bridgePort.pressure + force * 0.22).toFixed(4));
    if (bridgePort.role === 'quiet') bridgePort.role = 'bridged';

    changes.push({ source, remote, bridge, force, direction, memoryIndex });
  }

  return { ports: nextPorts, changes };
}

function knotPathSignature(ports) {
  return [pathData(OUTER_POINTS), pathData(CORE_VOID), ...ports.map((port) => pathData(port.points))].join(' ');
}

export function buildFrame(stage, memory = [], armed = null) {
  const safeStage = boundedStage(stage);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const { ports, changes } = applyMemory(basePorts(safeStage), inherited);
  const pathSignature = knotPathSignature(ports);
  const frame = {
    stage: safeStage,
    grammar: 'witness-knot',
    knot: {
      closed: true,
      fillRule: 'evenodd',
      pathCount: 1,
      outerPath: pathData(OUTER_POINTS),
      corePath: pathData(CORE_VOID),
      pathSignature
    },
    ports: ports.map((port) => ({ ...port, pathSignature: pointsSignature(port.points) })),
    changes,
    memory: inherited,
    spliceCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET,
    ruleCursor: inherited.at(-1)?.remote ?? null,
    armed: Number.isInteger(armed) ? safePort(armed) : null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    if (stage > 0 && stage % 3 === 0) {
      const pair = AUTO_PAIRS[(stage / 3 - 1) % AUTO_PAIRS.length];
      memory = [...memory, eventFor(stage, memory, pair[0], pair[1])].slice(-MEMORY_LIMIT);
    }
    return buildFrame(stage, memory);
  });
}

export function armWitness(frame, requestedPort) {
  return {
    ...frame,
    armed: safePort(requestedPort),
    signature: geometrySignature(frame)
  };
}

export function applyWitnessPair(frame, firstPort, secondPort) {
  const source = safePort(firstPort);
  const remote = safePort(secondPort);
  if (source === remote || frame.memory.length >= MEMORY_LIMIT) {
    return {
      ...frame,
      witness: {
        gesture: 'two-witness-click',
        mode: 'topological-splice',
        source,
        remote,
        committed: false,
        origin: 'visitor-witness'
      },
      interaction: source === remote ? 'same-witness-refused' : 'memory-limit-refused'
    };
  }
  const event = eventFor(frame.stage, frame.memory, source, remote, 'visitor-witness');
  const nextMemory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  const next = buildFrame(frame.stage, nextMemory);
  return {
    ...next,
    witness: { ...event, committed: true },
    priorMemory: copyMemory(frame.memory),
    interaction: 'topological-splice'
  };
}

export function liftLatestWitness(frame) {
  if (Array.isArray(frame.priorMemory)) return buildFrame(frame.stage, frame.priorMemory);
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseWitness() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  if (!frame?.knot) return '';
  const ports = frame.ports.map((port) => `${port.index}:${port.pathSignature}:${port.role}`).join('|');
  const changes = frame.changes.map((change) => `${change.source}:${change.remote}:${change.bridge}:${change.force}:${change.direction}`).join('|');
  return `${frame.knot.pathSignature}::${ports}::${changes}`;
}
