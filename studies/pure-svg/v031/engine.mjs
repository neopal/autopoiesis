const BASE_SEED = 0x53564731;
export const JOINT_COUNT = 9;
export const MEMORY_WINDOW = 4;

const JOINT_LAYOUT = [
  { x: 0.18, y: 0.32, angle: -22, phase: 0.08 },
  { x: 0.31, y: 0.22, angle: 18, phase: 0.21 },
  { x: 0.47, y: 0.28, angle: -8, phase: 0.37 },
  { x: 0.64, y: 0.18, angle: 25, phase: 0.52 },
  { x: 0.79, y: 0.32, angle: 6, phase: 0.68 },
  { x: 0.72, y: 0.52, angle: -31, phase: 0.77 },
  { x: 0.58, y: 0.69, angle: 12, phase: 0.89 },
  { x: 0.35, y: 0.62, angle: -14, phase: 0.97 },
  { x: 0.19, y: 0.50, angle: 38, phase: 0.14 }
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

function baseJoint(index) {
  const source = JOINT_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    angle: source.angle,
    phase: source.phase,
    tension: 0,
    witnessLoad: 0,
    drift: 0,
    pathSignature: ''
  };
}

function jointPath(joint) {
  const radius = 10 + joint.tension * 2.5 + joint.witnessLoad * 2;
  const narrow = 0.64 + Math.sin(joint.phase * 13) * 0.08;
  const points = [];
  for (let index = 0; index < 7; index += 1) {
    const theta = (Math.PI * 2 * index) / 7;
    const ripple = 1 + 0.13 * Math.sin(theta * 3 + joint.phase * 17);
    const localX = Math.cos(theta) * radius * ripple;
    const localY = Math.sin(theta) * radius * narrow * ripple;
    const [rotatedX, rotatedY] = rotate(localX, localY, joint.angle + joint.drift * 9);
    points.push([joint.x * 1000 + rotatedX, joint.y * 680 + rotatedY]);
  }
  return pointPath(points);
}

function routeFor(memory) {
  const route = Array.from({ length: JOINT_COUNT }, (_, index) => index);
  for (const event of memory) {
    const witnessIndex = route.indexOf(event.witness);
    const counterIndex = route.indexOf(event.counter);
    if (witnessIndex < 0 || counterIndex < 0 || witnessIndex === counterIndex) continue;
    const [witness] = route.splice(witnessIndex, 1);
    const insertionIndex = route.indexOf(event.counter) + 1;
    route.splice(insertionIndex, 0, witness);
  }
  return route;
}

function materialState(memory) {
  const joints = JOINT_LAYOUT.map((_, index) => baseJoint(index));
  for (const event of memory) applyEvent(joints, event);
  return joints;
}

function applyEvent(joints, event) {
  const observer = joints[event.observer];
  const counter = joints[event.counter];
  const witness = joints[event.witness];
  observer.tension = clamp(observer.tension + 0.72, 0, 3.2);
  observer.angle -= event.index % 2 ? 4.5 : -3.2;
  observer.drift += 0.22;
  counter.tension = clamp(counter.tension + 0.54, 0, 2.8);
  counter.angle += event.index % 2 ? 5.2 : -4.1;
  counter.drift -= 0.16;
  witness.witnessLoad = clamp(witness.witnessLoad + 1, 0, 4);
  witness.drift += event.index % 2 ? -0.48 : 0.62;
  witness.angle += event.index % 2 ? 8 : -7;
}

function nearestJoint(joints, point) {
  const x = clamp(Number(point?.x ?? 0.5), 0, 1);
  const y = clamp(Number(point?.y ?? 0.5), 0, 1);
  let winner = 0;
  let score = Infinity;
  for (const joint of joints) {
    const distance = (joint.x - x) ** 2 + (joint.y - y) ** 2;
    if (distance < score) {
      score = distance;
      winner = joint.id;
    }
  }
  return winner;
}

function jointDistance(route, first, second) {
  return Math.abs(route.indexOf(first) - route.indexOf(second));
}

function chooseWitness(route, observer, counter, memoryLength) {
  const candidates = route.filter((joint) => joint !== observer && joint !== counter);
  return candidates.reduce((winner, candidate) => {
    const candidateScore = Math.min(jointDistance(route, candidate, observer), jointDistance(route, candidate, counter));
    const winnerScore = Math.min(jointDistance(route, winner, observer), jointDistance(route, winner, counter));
    if (candidateScore > winnerScore) return candidate;
    if (candidateScore === winnerScore && (candidate + memoryLength) % JOINT_COUNT < (winner + memoryLength) % JOINT_COUNT) return candidate;
    return winner;
  }, candidates[0]);
}

function linePath(joints, route) {
  if (!route.length) return '';
  const first = joints[route[0]];
  let path = `M ${first.x * 1000} ${first.y * 680}`;
  for (let index = 1; index < route.length; index += 1) {
    const previous = joints[route[index - 1]];
    const current = joints[route[index]];
    const midX = (previous.x + current.x) * 500;
    const midY = (previous.y + current.y) * 340;
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const bend = 16 + (previous.witnessLoad + current.witnessLoad) * 7 + ((index % 2) ? -5 : 4);
    const controlX = midX * 1000 + normalX * bend;
    const controlY = midY * 680 + normalY * bend;
    path += ` Q ${controlX.toFixed(3)} ${controlY.toFixed(3)} ${(current.x * 1000).toFixed(3)} ${(current.y * 680).toFixed(3)}`;
  }
  return path;
}

function frameFrom(stage, memory, interaction, event, armedJoint) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const joints = materialState(safeMemory);
  const route = routeFor(safeMemory);
  for (const joint of joints) joint.pathSignature = jointPath(joint);
  const frame = {
    grammar: 'misheard-line',
    stage: clamp(Number(stage) || 0, 0, 12),
    memory: safeMemory,
    joints,
    route,
    linePath: linePath(joints, route),
    interaction,
    event: event ?? { committed: false },
    armedJoint: armedJoint ?? null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null, null);
}

export function geometrySignature(frame) {
  return `${frame.linePath ?? ''}||${frame.route.join(',')}||${frame.joints.map((joint) => `${joint.id}:${joint.pathSignature ?? jointPath(joint)}`).join('||')}`;
}

export function attendJoint(frame, point) {
  const joint = nearestJoint(frame.joints, point);
  return frameFrom(frame.stage, frame.memory, 'attention-held', { committed: false, observer: joint }, joint);
}

export function applyMishearing(frame, point) {
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'mishearing-memory-full', { committed: false, reason: 'memory-full' }, frame.armedJoint);
  }
  const joints = materialState(frame.memory);
  const route = routeFor(frame.memory);
  const observer = frame.armedJoint ?? nearestJoint(joints, point);
  const counter = nearestJoint(joints, point);
  if (observer === counter) {
    return frameFrom(frame.stage, frame.memory, 'mishearing-refused-same-joint', { committed: false, reason: 'same-joint', observer }, observer);
  }
  if (jointDistance(route, observer, counter) <= 1) {
    return frameFrom(frame.stage, frame.memory, 'mishearing-refused-adjacent', { committed: false, reason: 'adjacent', observer, counter }, observer);
  }
  const witness = chooseWitness(route, observer, counter, frame.memory.length);
  const event = {
    observer,
    counter,
    witness,
    index: frame.memory.length,
    committed: true,
    type: 'unoffered-witness'
  };
  return frameFrom(frame.stage + 1, [...frame.memory, event], 'line-misheard', event, null);
}

export function liftLatestMishearing(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false }, null);
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'mishearing-lifted', { committed: false, lifted: true }, null);
}

export function releaseLine() {
  return frameFrom(0, [], 'released', { committed: false, released: true }, null);
}

export function buildTimeline() {
  let frame = buildFrame(0, []);
  const pairs = [
    [{ x: 0.18, y: 0.32 }, { x: 0.79, y: 0.32 }],
    [{ x: 0.64, y: 0.18 }, { x: 0.19, y: 0.50 }],
    [{ x: 0.58, y: 0.69 }, { x: 0.31, y: 0.22 }],
    [{ x: 0.35, y: 0.62 }, { x: 0.64, y: 0.18 }]
  ];
  const frames = [buildFrame(0, [])];
  for (const [first, second] of pairs) {
    frame = applyMishearing(attendJoint(frame, first), second);
    if (frame.event.committed) frames.push(frame);
  }
  return frames;
}

export function jointPoint(frame, id) {
  const joint = frame.joints[id];
  return joint ? { x: joint.x, y: joint.y } : { x: 0.5, y: 0.5 };
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'misheard-line',
  rule: 'the first attention is inert; a distant second attention makes the line reroute through an unoffered witness joint',
  memoryWindow: MEMORY_WINDOW
};
