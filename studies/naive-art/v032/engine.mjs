const SEED = '0x4e413332';
const NODE_COUNT = 11;
const MEMORY_WINDOW = 4;
const PATH_LENGTH = 3;

const BASE_NODES = [
  { x: 0.00, y: -0.42, parent: null, lean: -0.04, notch: 0.18, span: 0.92, mark: 'root' },
  { x: -0.36, y: -0.16, parent: 0, lean: -0.18, notch: 0.26, span: 0.78, mark: 'left' },
  { x: 0.34, y: -0.13, parent: 0, lean: 0.16, notch: 0.22, span: 0.84, mark: 'right' },
  { x: -0.58, y: 0.10, parent: 1, lean: -0.24, notch: 0.34, span: 0.68, mark: 'low-left' },
  { x: -0.16, y: 0.13, parent: 1, lean: 0.12, notch: 0.22, span: 0.74, mark: 'left-middle' },
  { x: 0.12, y: 0.12, parent: 2, lean: -0.08, notch: 0.28, span: 0.7, mark: 'right-middle' },
  { x: 0.56, y: 0.08, parent: 2, lean: 0.2, notch: 0.3, span: 0.64, mark: 'low-right' },
  { x: -0.72, y: 0.38, parent: 3, lean: -0.12, notch: 0.38, span: 0.54, mark: 'far-left' },
  { x: -0.28, y: 0.41, parent: 4, lean: 0.2, notch: 0.24, span: 0.58, mark: 'near-left' },
  { x: 0.24, y: 0.38, parent: 5, lean: -0.16, notch: 0.32, span: 0.56, mark: 'near-right' },
  { x: 0.7, y: 0.34, parent: 6, lean: 0.1, notch: 0.36, span: 0.5, mark: 'far-right' }
];

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const boundedNode = (value, fallback = 0) => clamp(int(value, fallback), 0, NODE_COUNT - 1);

function makeNodes() {
  return BASE_NODES.map((base, id) => ({
    id,
    kind: 'branch-witness',
    state: 'quiet',
    ...base,
    lean: round(base.lean),
    notch: round(base.notch),
    span: round(base.span)
  }));
}

function remoteFor(path, memoryIndex) {
  let remote = (path[0] * 3 + path[1] * 5 + path[2] * 7 + memoryIndex * 2 + 4) % NODE_COUNT;
  while (path.includes(remote) || remote === 0) remote = (remote + 1) % NODE_COUNT;
  return remote;
}

function applyWrongParent(nodes, event) {
  const [sourceId, receiverId, witnessId] = event.path;
  const source = nodes[sourceId];
  const receiver = nodes[receiverId];
  const witness = nodes[witnessId];
  const remote = nodes[event.remote];
  const memoryIndex = event.memoryIndex;

  source.state = 'unparented';
  source.parent = null;
  source.lean = round(source.lean - 0.16 - memoryIndex * 0.02);
  source.notch = round(clamp(source.notch + 0.12, 0, 0.92));
  source.span = round(source.span * 0.9);

  receiver.state = 'misparented';
  receiver.parent = event.remote;
  receiver.mark = source.mark;
  receiver.lean = round(receiver.lean + 0.18 + memoryIndex * 0.02);
  receiver.notch = round(clamp(source.notch * 0.82, 0, 0.92));

  witness.state = 'remembering';
  witness.lean = round(witness.lean - 0.11);
  witness.span = round(witness.span * 1.07);
  witness.notch = round(clamp(witness.notch + 0.09, 0, 0.92));

  remote.state = 'orphan-gap';
  remote.parent = null;
  remote.notch = round(clamp(remote.notch + 0.28 + memoryIndex * 0.03, 0, 0.98));
  remote.lean = round(remote.lean + (remote.id % 2 ? -0.18 : 0.18));
  remote.span = round(remote.span * 0.72);
}

function buildSurface(memory) {
  const nodes = makeNodes();
  memory.slice(-MEMORY_WINDOW).forEach((event) => applyWrongParent(nodes, event));
  return { nodes };
}

function makeState(stage, memory, interaction = 'idle', previousMemory = null, previousStage = null) {
  const bounded = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'wrong-family-tree',
    stage: clamp(int(stage), 0, MEMORY_WINDOW),
    memory: bounded,
    previousMemory,
    previousStage,
    surface: 'recursive-branch-field',
    nodes: buildSurface(bounded).nodes,
    interaction
  };
}

function pathIsValid(path = []) {
  return Array.isArray(path)
    && path.length === PATH_LENGTH
    && path.every((value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < NODE_COUNT)
    && new Set(path.map(Number)).size === PATH_LENGTH;
}

export function buildFrame(stage = 0, memory = []) {
  return makeState(stage, memory, 'idle');
}

export function commitPath(state, input = {}) {
  const path = Array.isArray(input.path) ? input.path.map((value) => boundedNode(value, -1)) : [];
  if (!pathIsValid(path)) return makeState(state.stage, state.memory, 'path-refused');
  const event = {
    kind: 'wrong-parent',
    path,
    sourceMark: state.nodes[path[0]].mark,
    copiedMark: state.nodes[path[0]].mark,
    remote: remoteFor(path, state.memory.length),
    memoryIndex: state.memory.length
  };
  return makeState(state.stage + 1, [...state.memory, event], 'path-committed', state.memory, state.stage);
}

export function liftLatestPath(state) {
  if (!state.memory.length) return makeState(state.stage, [], 'path-lifted');
  const previousMemory = state.previousMemory ?? state.memory.slice(0, -1);
  const previousStage = state.previousStage ?? Math.max(0, state.stage - 1);
  return makeState(previousStage, previousMemory, 'path-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], 'memory-released');
}

export function geometrySignature(value) {
  const nodes = value.nodes ?? value.surface?.nodes ?? [];
  return nodes.map((node) => [
    node.id, node.state, node.parent ?? 'none', node.mark,
    round(node.x), round(node.y), round(node.lean), round(node.notch), round(node.span)
  ].join(':')).join('|');
}

export { pathIsValid };

export function buildTimeline() {
  return [
    [0, 1, 4],
    [2, 5, 9],
    [1, 3, 7],
    [4, 8, 10]
  ];
}

export { SEED, NODE_COUNT, MEMORY_WINDOW, PATH_LENGTH };
