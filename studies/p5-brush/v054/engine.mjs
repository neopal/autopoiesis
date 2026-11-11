export const SEED = 0x42523534;
export const DEPOSIT_COUNT = 9;
export const RELAY_LIMIT = 4;

const BASE_LAYOUT = [
  [0.20, 0.22, 0.15, 0.23, -0.18],
  [0.43, 0.17, 0.13, 0.26, 0.12],
  [0.69, 0.25, 0.16, 0.22, 0.28],
  [0.80, 0.46, 0.14, 0.25, -0.08],
  [0.58, 0.49, 0.18, 0.23, 0.19],
  [0.32, 0.45, 0.15, 0.24, -0.24],
  [0.18, 0.68, 0.17, 0.22, 0.16],
  [0.45, 0.77, 0.14, 0.24, -0.12],
  [0.72, 0.70, 0.17, 0.21, 0.24]
];

const SHAPE = [
  [-0.50, -0.34], [-0.20, -0.54], [0.28, -0.48], [0.53, -0.08],
  [0.42, 0.36], [0.06, 0.54], [-0.44, 0.38], [-0.56, -0.06]
];

function makeDeposit(index, [x, y, width, height, rotation]) {
  const points = SHAPE.map(([px, py], pointIndex) => ({
    x: x + px * width + Math.sin((index + 1) * 2.17 + pointIndex) * 0.004,
    y: y + py * height + Math.cos((index + 2) * 1.43 + pointIndex) * 0.004
  }));
  return { index, x, y, width, height, rotation, points };
}

const BASE_DEPOSITS = BASE_LAYOUT.map((layout, index) => makeDeposit(index, layout));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const STATIONS = {
  north: [0.50, 0.035],
  east: [0.965, 0.50],
  south: [0.50, 0.965],
  west: [0.035, 0.50]
};

function stationPoint(name) {
  return STATIONS[name];
}

function normalizeEvent(event, order) {
  return {
    kind: 'pressure-relay',
    source: event.source,
    receiver: event.receiver,
    order,
    pressure: Number(Math.max(0, Math.min(1, Number(event.pressure))).toFixed(5)),
    counterpressure: Number(Math.max(0, Math.min(1, Number(event.counterpressure))).toFixed(5)),
    shear: Number(Math.max(-1, Math.min(1, Number(event.shear))).toFixed(5))
  };
}

function validEvent(event) {
  return Boolean(
    event
    && Object.hasOwn(STATIONS, event.source)
    && Object.hasOwn(STATIONS, event.receiver)
    && event.source !== event.receiver
    && Number(event.pressure) >= 0.45
    && Number(event.counterpressure) >= 0.55
    && Math.abs(Number(event.shear)) >= 0.08
  );
}

function warpDeposit(deposit, event, order) {
  const source = stationPoint(event.source);
  const receiver = stationPoint(event.receiver);
  const dx = receiver[0] - source[0];
  const dy = receiver[1] - source[1];
  const distance = Math.hypot(dx, dy) || 1;
  const tangentX = dx / distance;
  const tangentY = dy / distance;
  const normalX = -tangentY;
  const normalY = tangentX;
  const factor = 0.72 + deposit.index * 0.041;
  const shift = (0.008 + event.pressure * 0.016) * factor;
  const counter = (0.004 + event.counterpressure * 0.009) * Math.sin((deposit.index + 1) * 1.7 + order * 0.83);
  const nextX = deposit.x + tangentX * shift + normalX * counter;
  const nextY = deposit.y + tangentY * shift + normalY * counter;
  const rotationDelta = event.shear * (0.025 + deposit.index * 0.002) * (order + 1);
  const scaleX = 1 + event.counterpressure * 0.018 * Math.cos(deposit.index * 0.9 + order);
  const scaleY = 1 + event.pressure * 0.014 * Math.sin(deposit.index * 0.67 + order + 0.4);
  const cos = Math.cos(rotationDelta);
  const sin = Math.sin(rotationDelta);
  const points = deposit.points.map((point) => {
    const localX = (point.x - deposit.x) * scaleX;
    const localY = (point.y - deposit.y) * scaleY;
    return {
      x: nextX + localX * cos - localY * sin,
      y: nextY + localX * sin + localY * cos
    };
  });
  return {
    ...deposit,
    x: nextX,
    y: nextY,
    width: deposit.width * scaleX,
    height: deposit.height * scaleY,
    rotation: deposit.rotation + rotationDelta,
    points
  };
}

function buildRelay(event, order) {
  const start = stationPoint(event.source);
  const end = stationPoint(event.receiver);
  const bend = event.shear * (0.14 + event.counterpressure * 0.08) * (order % 2 ? -1 : 1);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  return {
    source: event.source,
    receiver: event.receiver,
    order,
    start: { x: start[0], y: start[1] },
    control: { x: (start[0] + end[0]) * 0.5 + normalX * bend, y: (start[1] + end[1]) * 0.5 + normalY * bend },
    end: { x: end[0], y: end[1] },
    width: 0.002 + event.pressure * 0.003
  };
}

function frameFromMemory(memory, interaction = 'quiet ledger') {
  const safeMemory = clone(memory);
  const deposits = clone(BASE_DEPOSITS);
  const relays = [];
  safeMemory.forEach((event, order) => {
    for (let index = 0; index < deposits.length; index += 1) {
      deposits[index] = warpDeposit(deposits[index], event, order);
    }
    relays.push(buildRelay(event, order));
  });
  return {
    composition: 'relay-ledger',
    renderer: 'inline-svg',
    seed: SEED,
    stage: safeMemory.length,
    interaction,
    memory: safeMemory,
    selectedSource: safeMemory.at(-1)?.source ?? 'west',
    selectedReceiver: safeMemory.at(-1)?.receiver ?? 'east',
    body: { deposits, relays }
  };
}

export function commitRelay(field, event) {
  const current = clone(field);
  if (!validEvent(event)) {
    current.interaction = 'refused / incomplete relay';
    return { accepted: false, event: null, field: current };
  }
  if (current.memory.length >= RELAY_LIMIT) {
    current.interaction = 'refused / ledger is full';
    return { accepted: false, event: null, field: current };
  }
  const committed = normalizeEvent(event, current.memory.length);
  const memory = [...current.memory, committed];
  return { accepted: true, event: committed, field: frameFromMemory(memory, 'relay committed') };
}

export function buildFrame() {
  return frameFromMemory([]);
}

export function liftLatest(field) {
  if (!field.memory.length) return frameFromMemory([], 'lift refused / ledger is quiet');
  return frameFromMemory(field.memory.slice(0, -1), 'lifted / exact');
}

export function releaseLedger() {
  return frameFromMemory([], 'dry ledger');
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  const plan = [
    { source: 'west', receiver: 'east', pressure: 0.76, counterpressure: 0.82, shear: 0.28 },
    { source: 'north', receiver: 'south', pressure: 0.64, counterpressure: 0.78, shear: -0.22 },
    { source: 'east', receiver: 'north', pressure: 0.71, counterpressure: 0.88, shear: 0.31 },
    { source: 'south', receiver: 'west', pressure: 0.83, counterpressure: 0.74, shear: -0.18 }
  ];
  let field = timeline[0];
  for (const event of plan) {
    const result = commitRelay(field, event);
    if (!result.accepted) throw new Error(`Unable to build v054 timeline at ${event.source}-${event.receiver}`);
    field = result.field;
    timeline.push(field);
  }
  return timeline;
}

export function geometrySignature(field) {
  return JSON.stringify({
    memory: field.memory,
    deposits: field.body.deposits.map((deposit) => ({
      index: deposit.index,
      x: Number(deposit.x.toFixed(7)),
      y: Number(deposit.y.toFixed(7)),
      width: Number(deposit.width.toFixed(7)),
      height: Number(deposit.height.toFixed(7)),
      rotation: Number(deposit.rotation.toFixed(7)),
      points: deposit.points.map((point) => ({ x: Number(point.x.toFixed(7)), y: Number(point.y.toFixed(7)) }))
    })),
    relays: field.body.relays
  });
}
