export const SEED = 0x53564725;
export const STAGES = 15;
export const PRIMITIVE_BUDGET = 1;
export const MEMORY_LIMIT = 3;
export const STATION_COUNT = 6;
export const RUPTURE_THRESHOLD = 'continuous pointer span';

const BASE_POINTS = [
  [258, 142], [168, 132], [96, 232], [108, 368], [194, 486], [346, 554],
  [524, 566], [694, 526], [832, 436], [898, 318], [870, 226], [806, 162],
  [710, 138], [602, 154], [446, 144], [350, 130]
];
const STATION_POINT_INDICES = [1, 4, 7, 10, 12, 14];
const AUTO_SPANS = [[0, 3], [2, 5], [4, 1], [3, 0], [5, 2], [1, 4]];
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

function safeStation(index) {
  const numeric = Number.isFinite(Number(index)) ? Math.floor(Number(index)) : 0;
  return ((numeric % STATION_COUNT) + STATION_COUNT) % STATION_COUNT;
}

function pointSignature([x, y]) {
  return `${Number(x).toFixed(3)},${Number(y).toFixed(3)}`;
}

function pointsSignature(points) {
  return points.map(pointSignature).join('|');
}

function stagePoints(stage) {
  const phase = boundedStage(stage) * 0.065;
  return BASE_POINTS.map(([x, y], index) => [
    Number((x + Math.sin(phase + index * 0.61) * 3.2).toFixed(3)),
    Number((y + Math.cos(phase * 0.87 + index * 0.47) * 2.4).toFixed(3))
  ]);
}

function pathData(points, gapAt = 0) {
  const start = (safeStation(gapAt) * 0 + ((gapAt % points.length) + points.length) % points.length + 1) % points.length;
  const ordered = Array.from({ length: points.length - 1 }, (_, index) => points[(start + index) % points.length]);
  if (!ordered.length) return '';
  const commands = [`M ${pointSignature(ordered[0]).replace(',', ' ')}`];
  for (let index = 1; index < ordered.length; index += 1) {
    const [x0, y0] = ordered[index - 1];
    const [x1, y1] = ordered[index];
    const cx = (x0 * 2 + x1) / 3;
    const cy = (y0 * 2 + y1) / 3;
    commands.push(`Q ${cx.toFixed(3)} ${cy.toFixed(3)} ${x1.toFixed(3)} ${y1.toFixed(3)}`);
  }
  return commands.join(' ');
}

function transformPoint(point, dx, dy, scale = 1, centre = point) {
  return [
    Number((centre[0] + (point[0] - centre[0]) * scale + dx).toFixed(3)),
    Number((centre[1] + (point[1] - centre[1]) * scale + dy).toFixed(3))
  ];
}

function stationSignature(points, stationIndex) {
  const pointIndex = STATION_POINT_INDICES[stationIndex];
  const local = [
    points[(pointIndex - 1 + points.length) % points.length],
    points[pointIndex],
    points[(pointIndex + 1) % points.length]
  ];
  return pointsSignature(local);
}

function roleForStation(memory, index) {
  const latest = memory.at(-1);
  if (!latest) return 'quiet';
  if (latest.source === index) return 'source';
  if (latest.target === index) return 'target';
  if (latest.relay === index) return 'relay';
  return 'quiet';
}

function applyMemory(points, memory) {
  const nextPoints = copyPoints(points);
  let gapAt = 0;
  const changes = [];

  for (const [memoryIndex, event] of memory.entries()) {
    const source = safeStation(event.source);
    const target = safeStation(event.target);
    const relay = safeStation(event.relay ?? (source * 2 + target + memoryIndex + 2));
    const force = clamp(Number(event.force) || 1, 1, 1.35);
    const direction = memoryIndex % 2 === 0 ? 1 : -1;
    const sourcePoint = STATION_POINT_INDICES[source];
    const targetPoint = STATION_POINT_INDICES[target];
    const relayPoint = STATION_POINT_INDICES[relay];
    const sourceCentre = [...nextPoints[sourcePoint]];
    const targetCentre = [...nextPoints[targetPoint]];
    const relayCentre = [...nextPoints[relayPoint]];

    nextPoints[sourcePoint] = transformPoint(nextPoints[sourcePoint], direction * (18 + force * 5), -direction * (11 + force * 4), 0.76, sourceCentre);
    nextPoints[targetPoint] = transformPoint(nextPoints[targetPoint], -direction * (23 + force * 6), direction * (14 + force * 5), 1.16, targetCentre);
    nextPoints[relayPoint] = transformPoint(nextPoints[relayPoint], direction * 7, direction * (18 + force * 4), 0.88, relayCentre);

    const neighbour = (sourcePoint + direction + nextPoints.length) % nextPoints.length;
    nextPoints[neighbour] = transformPoint(nextPoints[neighbour], direction * 5, -direction * 4, 0.94, sourceCentre);
    gapAt = relay;
    changes.push({ source, target, relay, force: Number(force.toFixed(4)), direction, memoryIndex });
  }

  return { points: nextPoints, gapAt, changes };
}

function eventFor(stage, memory, source, target, origin = 'auto-span') {
  const safeSource = safeStation(source);
  const safeTarget = safeStation(target);
  let relay = safeStation(safeSource * 2 + safeTarget + memory.length + 2);
  while (relay === safeSource || relay === safeTarget) relay = safeStation(relay + 1);
  return {
    kind: 'rupture',
    mode: 'rupture-transfer',
    gesture: 'drawn-span',
    origin,
    stage: boundedStage(stage),
    source: safeSource,
    target: safeTarget,
    relay,
    force: Number((1 + ((boundedStage(stage) + memory.length) % 4) * 0.07).toFixed(4)),
    ordinal: memory.length
  };
}

export function buildFrame(stage, memory = [], armed = null) {
  const safeStage = boundedStage(stage);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const { points, gapAt, changes } = applyMemory(stagePoints(safeStage), inherited);
  const boundaryPath = pathData(points, gapAt);
  const frame = {
    stage: safeStage,
    grammar: 'broken-contour',
    boundary: {
      closed: false,
      fill: 'none',
      pathCount: 1,
      subpathCount: 1,
      gapAt,
      endpoints: [points[(gapAt + 1) % points.length], points[gapAt]],
      pathSignature: boundaryPath
    },
    stations: STATION_POINT_INDICES.map((_, index) => ({
      index,
      position: [...points[STATION_POINT_INDICES[index]]],
      role: roleForStation(inherited, index),
      pathSignature: stationSignature(points, index)
    })),
    changes,
    memory: inherited,
    ruptureCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET,
    armed: Number.isInteger(armed) ? safeStation(armed) : null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    if (stage > 0 && stage % 3 === 0) {
      const pair = AUTO_SPANS[(stage / 3 - 1) % AUTO_SPANS.length];
      memory = [...memory, eventFor(stage, memory, pair[0], pair[1])].slice(-MEMORY_LIMIT);
    }
    return buildFrame(stage, memory);
  });
}

export function armStation(frame, requestedStation) {
  return {
    ...frame,
    armed: safeStation(requestedStation),
    signature: geometrySignature(frame)
  };
}

export function applyDrawnSpan(frame, requestedSource, requestedTarget) {
  const source = safeStation(requestedSource);
  const target = safeStation(requestedTarget);
  if (source === target || frame.memory.length >= MEMORY_LIMIT) {
    return {
      ...frame,
      span: {
        gesture: 'drawn-span',
        mode: 'rupture-transfer',
        source,
        target,
        committed: false,
        origin: 'visitor-drawn-span'
      },
      interaction: source === target ? 'same-station-refused' : 'memory-limit-refused',
      signature: geometrySignature(frame)
    };
  }
  const event = eventFor(frame.stage, frame.memory, source, target, 'visitor-drawn-span');
  const nextMemory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  const next = buildFrame(frame.stage, nextMemory, null);
  return {
    ...next,
    span: { ...event, committed: true },
    priorMemory: copyMemory(frame.memory),
    interaction: 'rupture-transfer'
  };
}

export function liftLatestCut(frame) {
  return buildFrame(frame.stage, frame.memory.slice(0, -1), null);
}

export function releaseBoundary() {
  return buildFrame(0, [], null);
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    path: frame.boundary.pathSignature,
    gapAt: frame.boundary.gapAt,
    stations: frame.stations.map((station) => station.pathSignature),
    memory: frame.memory
  });
}
