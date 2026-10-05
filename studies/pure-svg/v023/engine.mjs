export const SEED = 0x53564753;
export const STAGES = 16;
export const PRIMITIVE_BUDGET = 1;
export const MEMORY_LIMIT = 4;
export const CHAMBER_COUNT = 5;
export const HOLD_THRESHOLD = 520;

const AUTO_CHAMBERS = [2, 0, 4, 1, 3, 2];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const OUTER_POINTS = [
  [126, 198], [254, 132], [520, 112], [808, 148], [902, 294],
  [846, 480], [626, 568], [326, 554], [150, 442], [104, 294]
];

const BASE_CHAMBERS = [
  [[188, 234], [224, 202], [270, 204], [306, 236], [302, 278], [273, 308], [226, 304], [190, 274]],
  [[382, 168], [424, 144], [474, 152], [500, 188], [480, 224], [432, 236], [392, 214], [374, 188]],
  [[618, 174], [666, 158], [712, 178], [732, 220], [710, 256], [662, 264], [620, 238], [604, 204]],
  [[282, 356], [322, 324], [370, 330], [402, 370], [394, 414], [354, 438], [310, 424], [278, 392]],
  [[592, 356], [634, 326], [686, 338], [716, 378], [704, 424], [662, 450], [616, 432], [586, 394]]
];

function copyPoints(points) {
  return points.map(([x, y]) => [x, y]);
}

function copyMemory(memory) {
  return memory.map((event) => ({ ...event }));
}

function boundedStage(stage) {
  return clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
}

function safeChamber(index) {
  const numeric = Number.isFinite(Number(index)) ? Math.floor(Number(index)) : 0;
  return ((numeric % CHAMBER_COUNT) + CHAMBER_COUNT) % CHAMBER_COUNT;
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

function transformChamber(points, { dx = 0, dy = 0, skew = 0, scale = 1, turn = 0 }) {
  const [cx, cy] = centroid(points);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return points.map(([x, y], index) => {
    const localX = (x - cx) * scale;
    const localY = (y - cy) * scale;
    const rotatedX = localX * cos - localY * sin;
    const rotatedY = localX * sin + localY * cos;
    const edgeBias = (index - 3.5) * skew;
    return [
      Number((cx + rotatedX + dx + edgeBias).toFixed(3)),
      Number((cy + rotatedY + dy + edgeBias * 0.28).toFixed(3))
    ];
  });
}

function baseChambers(stage) {
  const phase = boundedStage(stage) * 0.045;
  return BASE_CHAMBERS.map((points, index) => ({
    index,
    points: points.map(([x, y], pointIndex) => [
      Number((x + Math.sin(phase + index * 0.72) * 1.7 + (pointIndex - 3.5) * 0.08).toFixed(3)),
      Number((y + Math.cos(phase * 0.8 + index) * 1.25).toFixed(3))
    ]),
    role: 'quiet',
    pressure: 0
  }));
}

function eventFor(stage, memory, source = null, dwell = HOLD_THRESHOLD, origin = 'auto-drying') {
  const chamber = Number.isInteger(source)
    ? safeChamber(source)
    : AUTO_CHAMBERS[(boundedStage(stage) + memory.length) % AUTO_CHAMBERS.length];
  const amount = clamp(Number(dwell) / HOLD_THRESHOLD, 1, 1.32);
  return {
    kind: 'material',
    mode: 'topology-threshold',
    gesture: 'press-and-hold',
    origin,
    stage: boundedStage(stage),
    source: chamber,
    remote: (chamber + 3 + memory.length) % CHAMBER_COUNT,
    bridge: (chamber + 1 + memory.length * 2) % CHAMBER_COUNT,
    dwell: Math.round(clamp(Number(dwell) || HOLD_THRESHOLD, HOLD_THRESHOLD, 690)),
    force: Number(amount.toFixed(4)),
    ordinal: memory.length
  };
}

function applyMemory(chambers, memory) {
  const nextChambers = chambers.map((chamber) => ({ ...chamber, points: copyPoints(chamber.points) }));
  const changes = [];

  for (const [memoryIndex, event] of memory.entries()) {
    const source = safeChamber(event.source);
    const remote = safeChamber(event.remote ?? (source + 3 + memoryIndex) % CHAMBER_COUNT);
    const bridge = safeChamber(event.bridge ?? (source + 1 + memoryIndex * 2) % CHAMBER_COUNT);
    const force = clamp(event.force ?? 1, 1, 1.32);
    const direction = memoryIndex % 2 === 0 ? 1 : -1;
    const sourceChamber = nextChambers[source];
    const remoteChamber = nextChambers[remote];
    const bridgeChamber = nextChambers[bridge];

    sourceChamber.points = transformChamber(sourceChamber.points, {
      dx: direction * (6 + force * 7),
      dy: -direction * (4 + force * 5),
      skew: direction * (1.1 + force * 1.4),
      scale: 0.76 - memoryIndex * 0.018,
      turn: direction * (0.045 + force * 0.025)
    });
    sourceChamber.pressure = Number((sourceChamber.pressure + force).toFixed(4));
    sourceChamber.role = 'sealed';

    remoteChamber.points = transformChamber(remoteChamber.points, {
      dx: -direction * (7 + force * 9),
      dy: direction * (6 + force * 7),
      skew: -direction * (1.5 + force * 1.8),
      scale: 1.22 + memoryIndex * 0.022,
      turn: -direction * (0.05 + force * 0.03)
    });
    remoteChamber.pressure = Number((remoteChamber.pressure + force * 0.82).toFixed(4));
    remoteChamber.role = 'opened';

    bridgeChamber.points = transformChamber(bridgeChamber.points, {
      dx: direction * 3.5,
      dy: direction * 2.7,
      skew: direction * 0.72,
      scale: 0.96,
      turn: direction * 0.018
    });
    bridgeChamber.pressure = Number((bridgeChamber.pressure + force * 0.2).toFixed(4));
    if (bridgeChamber.role === 'quiet') bridgeChamber.role = 'bridged';

    changes.push({ source, remote, bridge, force: Number(force.toFixed(4)), direction, memoryIndex });
  }

  return { chambers: nextChambers, changes };
}

export function buildFrame(stage, memory = []) {
  const safeStage = boundedStage(stage);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const { chambers, changes } = applyMemory(baseChambers(safeStage), inherited);
  const normalised = chambers.map((chamber) => ({
    ...chamber,
    pathSignature: pointsSignature(chamber.points)
  }));
  const outerPath = pathData(OUTER_POINTS);
  const sheetPath = `${outerPath} ${normalised.map((chamber) => pathData(chamber.points)).join(' ')}`;
  const frame = {
    stage: safeStage,
    grammar: 'drying-sheet',
    sheet: { closed: true, fillRule: 'evenodd', outerPath, pathSignature: sheetPath },
    chambers: normalised,
    changes,
    memory: inherited,
    dryingCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET,
    ruleCursor: inherited.at(-1)?.source ?? null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    if (stage > 0 && stage % 3 === 0) {
      memory = [...memory, eventFor(stage, memory)].slice(-MEMORY_LIMIT);
    }
    return buildFrame(stage, memory);
  });
}

export function applyDryingHold(frame, requestedSource = null, dwell = HOLD_THRESHOLD) {
  const source = safeChamber(requestedSource);
  const duration = Number.isFinite(Number(dwell)) ? Number(dwell) : 0;
  if (duration < HOLD_THRESHOLD || frame.memory.length >= MEMORY_LIMIT) {
    return {
      ...frame,
      drying: {
        gesture: 'press-and-hold',
        mode: 'topology-threshold',
        source,
        dwell: Math.max(0, Math.round(duration)),
        committed: false,
        origin: 'visitor-drying'
      },
      interaction: 'refused'
    };
  }
  const event = eventFor(frame.stage, frame.memory, source, duration, 'visitor-drying');
  const nextMemory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  const next = buildFrame(frame.stage, nextMemory);
  return {
    ...next,
    drying: { ...event, committed: true },
    priorMemory: copyMemory(frame.memory),
    interaction: 'topology-threshold'
  };
}

export function liftLatestDrying(frame) {
  if (Array.isArray(frame.priorMemory)) return buildFrame(frame.stage, frame.priorMemory);
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseDrying() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  if (!frame?.sheet) return '';
  const chambers = frame.chambers.map((chamber) => `${chamber.index}:${chamber.pathSignature}:${chamber.role}`).join('|');
  const changes = frame.changes.map((change) => `${change.source}:${change.remote}:${change.bridge}:${change.force}:${change.direction}`).join('|');
  return `${frame.sheet.pathSignature}::${chambers}::${changes}`;
}
