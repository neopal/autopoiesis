const BASE_SEED = 0x53564741;
export const MEMORY_WINDOW = 4;
export const NODE_COUNT = 9;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));
const fixed = (value) => Number(value).toFixed(2);

const NODE_SEED = [
  { id: 0, x: 0.19, y: 0.28, length: 0.105, thickness: 0.038, gap: 0.026, angle: -0.46, lean: 0 },
  { id: 1, x: 0.40, y: 0.18, length: 0.145, thickness: 0.030, gap: 0.022, angle: 0.24, lean: 0 },
  { id: 2, x: 0.74, y: 0.23, length: 0.112, thickness: 0.044, gap: 0.030, angle: 0.63, lean: 0 },
  { id: 3, x: 0.27, y: 0.49, length: 0.116, thickness: 0.033, gap: 0.020, angle: -0.10, lean: 0 },
  { id: 4, x: 0.53, y: 0.42, length: 0.152, thickness: 0.030, gap: 0.026, angle: 0.32, lean: 0 },
  { id: 5, x: 0.80, y: 0.50, length: 0.112, thickness: 0.040, gap: 0.025, angle: -0.42, lean: 0 },
  { id: 6, x: 0.17, y: 0.74, length: 0.135, thickness: 0.031, gap: 0.022, angle: 0.48, lean: 0 },
  { id: 7, x: 0.47, y: 0.72, length: 0.170, thickness: 0.027, gap: 0.028, angle: -0.24, lean: 0 },
  { id: 8, x: 0.77, y: 0.76, length: 0.120, thickness: 0.043, gap: 0.024, angle: 0.16, lean: 0 }
];

function rotated(x, y, angle, originX, originY) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [originX + x * cos - y * sin, originY + x * sin + y * cos];
}

function bladePoints(node, side) {
  const cx = node.x * 1000;
  const cy = node.y * 760;
  const length = node.length * 1000;
  const thickness = node.thickness * 760;
  const gap = node.gap * 1000;
  const sideSign = side === 'left' ? -1 : 1;
  const skew = node.lean * sideSign;
  const local = [
    [sideSign * gap * 0.5, -thickness * 0.52],
    [sideSign * (gap * 0.5 + length), -thickness * (0.32 + skew)],
    [sideSign * (gap * 0.5 + length * 0.82), thickness * (0.66 - skew)],
    [sideSign * gap * 0.5, thickness * 0.52]
  ];
  return local.map(([x, y]) => rotated(x, y, node.angle, cx, cy));
}

function pointPath(points) {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${fixed(x)} ${fixed(y)}`).join(' ')} Z`;
}

function hingePath(node) {
  return `${pointPath(bladePoints(node, 'left'))} ${pointPath(bladePoints(node, 'right'))}`;
}

function baseNode(seed) {
  const node = { ...seed, role: 'quiet' };
  node.signature = hingePath(node);
  return node;
}

function baseState() {
  return { routeCount: 0, turnPhase: 0, pinPhase: 0, registerPhase: 0 };
}

function baseNodes() {
  return NODE_SEED.map(baseNode);
}

function remoteIndices(sourceIndices, eventIndex) {
  const anchor = sourceIndices.reduce((total, index) => total + index, 0) + eventIndex * 2;
  const preferred = [anchor + 1, anchor + 3, anchor + 6].map((value) => wrap(value, NODE_COUNT));
  const result = preferred.filter((index, position, all) => !sourceIndices.includes(index) && all.indexOf(index) === position);
  for (let index = 0; result.length < 3 && index < NODE_COUNT; index += 1) {
    if (!sourceIndices.includes(index) && !result.includes(index)) result.push(index);
  }
  return result;
}

function mutateNode(node, role, eventIndex) {
  const next = { ...node, role };
  if (role === 'turn') {
    next.angle += 0.18 + eventIndex * 0.035;
    next.lean = clamp(next.lean + 0.11 + eventIndex * 0.01, -0.24, 0.24);
    next.length = clamp(next.length * (1.06 + eventIndex * 0.012), 0.075, 0.2);
  } else if (role === 'pin') {
    next.gap = clamp(next.gap * (0.62 - eventIndex * 0.018), 0.009, 0.05);
    next.thickness = clamp(next.thickness * (1.1 + eventIndex * 0.02), 0.018, 0.065);
    next.angle -= 0.12 + eventIndex * 0.02;
  } else if (role === 'register') {
    next.x = clamp(next.x + (eventIndex % 2 ? -0.014 : 0.016), 0.11, 0.87);
    next.y = clamp(next.y - 0.012 - eventIndex * 0.002, 0.12, 0.84);
    next.angle += 0.24;
    next.length = clamp(next.length * 0.94, 0.07, 0.19);
  }
  next.signature = hingePath(next);
  return next;
}

function materialState(memory) {
  const state = baseState();
  const nodes = baseNodes();
  for (const event of memory) {
    event.remoteIndices.forEach((index, position) => {
      nodes[index] = mutateNode(nodes[index], event.roles[position], event.index);
    });
    state.routeCount += 1;
    state.turnPhase += 0.21 + event.index * 0.04;
    state.pinPhase += 0.13;
    state.registerPhase += 0.17;
  }
  return { state, nodes };
}

function frameFrom(stage, memory, selection, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const material = materialState(safeMemory);
  const frame = {
    grammar: 'hinge-register',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    nodes: material.nodes,
    state: material.state,
    selection: clone(selection ?? []),
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, [], 'still', null);
}

function normalizedIndex(value) {
  return wrap(Math.round(Number(value) || 0), NODE_COUNT);
}

export function armNode(frame, rawIndex) {
  const index = normalizedIndex(rawIndex);
  if (frame.selection.includes(index) || frame.selection.length >= 3) {
    return frameFrom(frame.stage, frame.memory, frame.selection, 'route-neutral', { committed: false, type: 'route-selection-refused', index });
  }
  const selection = [...frame.selection, index];
  return frameFrom(frame.stage, frame.memory, selection, selection.length === 3 ? 'route-ready' : 'route-armed', { committed: false, type: 'route-selection', index, selection });
}

export function commitRoute(frame) {
  if (frame.selection.length !== 3) {
    return frameFrom(frame.stage, frame.memory, frame.selection, 'route-refused-incomplete', { committed: false, type: 'route-refused', reason: 'three-nodes-required' });
  }
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, [], 'route-refused-memory-full', { committed: false, type: 'route-refused', reason: 'memory-full' });
  }
  const sourceIndices = [...frame.selection];
  const event = {
    committed: true,
    type: 'route-verdict',
    index: frame.memory.length,
    sourceIndices,
    remoteIndices: remoteIndices(sourceIndices, frame.memory.length),
    roles: ['turn', 'pin', 'register']
  };
  return frameFrom(frame.stage + 1, [...frame.memory, event], [], 'route-committed', event);
}

export function liftLatestRoute(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], [], 'route-lift-empty', { committed: false, lifted: false });
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), [], 'route-lifted', { committed: false, lifted: true });
}

export function releaseRegister() {
  return frameFrom(0, [], [], 'released', { committed: false, released: true });
}

export function buildTimeline() {
  const routes = [[0, 4, 8], [1, 5, 7], [2, 6, 3], [4, 7, 1]];
  let frame = buildFrame();
  const frames = [frame];
  for (const route of routes) {
    frame = commitRoute(route.reduce((current, index) => armNode(current, index), frame));
    frames.push(frame);
  }
  return frames;
}

export function geometrySignature(frame) {
  return `${frame.nodes.map((node) => node.signature).join('||')}||routes:${frame.state.routeCount}`;
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'hinge-register',
  rule: 'a three-node route remains exact while its verdict is produced at three remote hinges',
  memoryWindow: MEMORY_WINDOW,
  nodeCount: NODE_COUNT
};
