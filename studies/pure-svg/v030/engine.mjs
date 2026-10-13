const BASE_SEED = 0x53564730;
export const GATE_COUNT = 8;
export const MEMORY_WINDOW = 4;

const GATE_LAYOUT = [
  { x: 0.19, y: 0.26, angle: 26, phase: 0.08 },
  { x: 0.42, y: 0.17, angle: 4, phase: 0.24 },
  { x: 0.72, y: 0.22, angle: -28, phase: 0.4 },
  { x: 0.84, y: 0.47, angle: -58, phase: 0.56 },
  { x: 0.76, y: 0.75, angle: -144, phase: 0.7 },
  { x: 0.55, y: 0.83, angle: 174, phase: 0.84 },
  { x: 0.29, y: 0.77, angle: 142, phase: 0.96 },
  { x: 0.14, y: 0.52, angle: 72, phase: 0.16 }
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

function pointPath(points) {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ')} Z`;
}

function baseGate(index) {
  const source = GATE_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    angle: source.angle,
    phase: source.phase,
    aperture: 1,
    fold: 0,
    reply: 0,
    pathSignature: ''
  };
}

function gatePath(gate) {
  const radiusX = 31 + gate.aperture * 24;
  const radiusY = 16 + gate.aperture * 15;
  const points = [];
  for (let index = 0; index < 14; index += 1) {
    const theta = (Math.PI * 2 * index) / 14;
    const ripple = 1 + 0.13 * Math.sin(theta * 3 + gate.phase * 17) + 0.06 * Math.cos(theta * 5 - gate.phase * 11);
    const pinch = gate.reply * 2.7 * Math.sin(theta * 2 + gate.phase * 9);
    const localX = Math.cos(theta) * (radiusX + pinch) * ripple;
    const localY = Math.sin(theta) * (radiusY - pinch * 0.45) * ripple;
    const [rotatedX, rotatedY] = rotate(localX, localY, gate.angle + gate.fold * 4.2);
    points.push([gate.x * 1000 + rotatedX, gate.y * 680 + rotatedY]);
  }
  return pointPath(points);
}

function outerContour() {
  return 'M 142 342 C 128 180 264 82 430 106 C 556 52 792 108 862 278 C 938 462 794 600 614 570 C 476 632 252 586 160 458 C 136 424 128 380 142 342 Z';
}

function centralSilence(memory) {
  const radius = 72 - memory.length * 5;
  return `M ${500 - radius} 340 C ${500 - radius * 0.8} ${340 - radius * 1.05} ${500 + radius * 0.7} ${340 - radius * 1.08} ${500 + radius} 340 C ${500 + radius * 0.75} ${340 + radius * 1.04} ${500 - radius * 0.72} ${340 + radius * 1.03} ${500 - radius} 340 Z`;
}

function materialState(memory) {
  const gates = GATE_LAYOUT.map((_, index) => baseGate(index));
  for (const event of memory) applyEvent(gates, event);
  return gates;
}

function applyEvent(gates, event) {
  const source = gates[event.source];
  const target = gates[event.target];
  const relay = gates[event.relay];
  const direction = event.source < event.target ? 1 : -1;

  source.aperture = clamp(source.aperture * 0.64, 0.22, 1.2);
  source.fold += 1;
  source.reply += 0.5;
  source.angle += direction * 4.8;

  target.aperture = clamp(target.aperture + 0.2 + event.index * 0.025, 0.82, 1.85);
  target.fold += 1;
  target.reply += 0.85;
  target.angle -= direction * 6.4;

  relay.aperture = clamp(relay.aperture + 0.08, 0.65, 1.45);
  relay.fold += 1;
  relay.reply += 0.38;
  relay.angle += (event.index % 2 ? -1 : 1) * 4.1;
}

function nearestGate(gates, point) {
  const x = clamp(Number(point?.x ?? 0.5), 0, 1);
  const y = clamp(Number(point?.y ?? 0.5), 0, 1);
  let winner = 0;
  let score = Infinity;
  for (const gate of gates) {
    const distance = (gate.x - x) ** 2 + (gate.y - y) ** 2;
    if (distance < score) {
      score = distance;
      winner = gate.id;
    }
  }
  return winner;
}

function frameFrom(stage, memory, interaction, event, armedGate) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const gates = materialState(safeMemory);
  for (const gate of gates) gate.pathSignature = gatePath(gate);
  const frame = {
    grammar: 'negative-reply',
    stage: clamp(Number(stage) || 0, 0, 12),
    memory: safeMemory,
    gates,
    contourPath: `${outerContour()} ${centralSilence(safeMemory)} ${gates.map((gate) => gate.pathSignature).join(' ')}`,
    interaction,
    event: event ?? { committed: false },
    armedGate: armedGate ?? null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null, null);
}

export function geometrySignature(frame) {
  return `${frame.contourPath ?? ''}||${frame.gates.map((gate) => `${gate.id}:${gate.pathSignature ?? gatePath(gate)}`).join('||')}`;
}

export function armGate(frame, point) {
  const source = nearestGate(frame.gates, point);
  return frameFrom(frame.stage, frame.memory, 'crossing-armed', { committed: false, source }, source);
}

export function applyReply(frame, point) {
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'reply-memory-full', { committed: false, reason: 'memory-full' }, frame.armedGate);
  }
  const baseGates = materialState(frame.memory);
  const source = frame.armedGate ?? nearestGate(baseGates, point);
  const target = nearestGate(baseGates, point);
  if (source === target) {
    return frameFrom(frame.stage, frame.memory, 'reply-refused-same-gate', { committed: false, reason: 'same-gate', source }, source);
  }
  let relay = wrap(target + 3 + (frame.memory.length % 2), GATE_COUNT);
  if (relay === source || relay === target) relay = wrap(relay + 1, GATE_COUNT);
  const event = { source, target, relay, index: frame.memory.length, committed: true, type: 'remote-reply' };
  return frameFrom(frame.stage + 1, [...frame.memory, event], 'remote-reply', event, null);
}

export function liftLatestReply(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false }, null);
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'reply-lifted', { committed: false, lifted: true }, null);
}

export function releaseContour() {
  return frameFrom(0, [], 'released', { committed: false, released: true }, null);
}

export function replyPath(frame, event) {
  if (!event?.committed) return '';
  const source = frame.gates[event.source];
  const target = frame.gates[event.target];
  const relay = frame.gates[event.relay];
  return `M ${source.x * 1000} ${source.y * 680} C 340 102 660 582 ${target.x * 1000} ${target.y * 680} M ${target.x * 1000} ${target.y * 680} C 824 206 230 490 ${relay.x * 1000} ${relay.y * 680}`;
}

export function buildTimeline() {
  let frame = buildFrame(0, []);
  const pairs = [
    [{ x: 0.19, y: 0.26 }, { x: 0.81, y: 0.73 }],
    [{ x: 0.72, y: 0.2 }, { x: 0.27, y: 0.78 }],
    [{ x: 0.84, y: 0.47 }, { x: 0.19, y: 0.26 }],
    [{ x: 0.55, y: 0.83 }, { x: 0.42, y: 0.17 }]
  ];
  for (const [first, second] of pairs) frame = applyReply(armGate(frame, first), second);
  return [buildFrame(0, []), ...frame.memory.map((_, index) => frameFrom(index + 1, frame.memory.slice(0, index + 1), 'remote-reply', frame.memory[index], null))];
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'negative-reply',
  rule: 'a local crossing only arms a gate; a distant gate replies by changing three actual cavities and a shared contour',
  memoryWindow: MEMORY_WINDOW
};
