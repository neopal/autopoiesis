const SEED = '0x4e413432';
const BLOCK_COUNT = 9;
const MEMORY_WINDOW = 4;
const MIN_SCAN_DISTANCE = 0.42;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const validDirection = (value) => value === 1 || value === -1;
const validBlock = (value) => Number.isInteger(value) && value >= 0 && value < BLOCK_COUNT;

const LAYOUT = [
  [-1.12, -0.82, -0.32, 0.72, 0.38, 0.56, -8, 12, -5],
  [-0.16, -1.05, 0.18, 1.18, 0.28, 0.46, 4, -16, 3],
  [0.98, -0.68, -0.22, 0.66, 0.54, 0.62, -11, 8, 7],
  [-1.28, 0.02, 0.22, 0.48, 0.84, 0.44, 9, 14, -10],
  [-0.12, 0.02, 0.02, 0.92, 0.72, 0.74, -6, -4, 2],
  [1.12, 0.12, 0.28, 0.52, 0.82, 0.42, 13, -12, -6],
  [-0.88, 0.86, -0.16, 0.78, 0.38, 0.58, -5, 17, 9],
  [0.18, 0.98, 0.34, 0.96, 0.32, 0.48, 6, -10, -8],
  [1.08, 0.84, -0.04, 0.62, 0.48, 0.66, -14, 6, 12]
];

function baseBlock(index) {
  const [x, y, z, width, height, depth, rx, ry, rz] = LAYOUT[index];
  return {
    id: index,
    x,
    y,
    z,
    width,
    height,
    depth,
    rx,
    ry,
    rz,
    face: index % 5,
    role: 'quiet',
    opacity: 1
  };
}

const BASE_BLOCKS = Array.from({ length: BLOCK_COUNT }, (_, index) => baseBlock(index));

function blockSignature(block) {
  return [
    block.id,
    round(block.x),
    round(block.y),
    round(block.z),
    round(block.width),
    round(block.height),
    round(block.depth),
    round(block.rx),
    round(block.ry),
    round(block.rz),
    block.face,
    block.role,
    round(block.opacity)
  ].join(':');
}

function geometrySignature(state) {
  return state.scene.blocks.map(blockSignature).join('|');
}

function eventFor(direction, memoryIndex) {
  const source = (memoryIndex * 2 + (direction > 0 ? 1 : 4)) % BLOCK_COUNT;
  const swap = (source + 3 + memoryIndex) % BLOCK_COUNT;
  const shear = (source + 5 + memoryIndex * 2) % BLOCK_COUNT;
  const hollow = (source + 7 + memoryIndex) % BLOCK_COUNT;
  return {
    kind: 'depth-misregistration',
    direction,
    source,
    swap,
    shear,
    hollow,
    distance: round(MIN_SCAN_DISTANCE + 0.18 + memoryIndex * 0.06),
    memoryIndex
  };
}

function applyEvent(blocks, event) {
  const source = blocks[event.source];
  const swap = blocks[event.swap];
  const shear = blocks[event.shear];
  const hollow = blocks[event.hollow];
  const sign = event.direction > 0 ? 1 : -1;

  // The observed solid stays exact; the naive reconstruction spends its scan elsewhere.
  swap.role = 'misregistered';
  swap.z = round(clamp(swap.z + sign * (0.3 + event.memoryIndex * 0.05), -1.2, 1.2));
  swap.ry = round(swap.ry + sign * (13 + event.memoryIndex * 2));
  swap.depth = round(clamp(swap.depth * (0.82 - event.memoryIndex * 0.025), 0.24, 0.9));
  swap.face = (source.face + 2 + event.memoryIndex) % 5;

  shear.role = 'sheared';
  shear.x = round(clamp(shear.x - sign * (0.12 + event.memoryIndex * 0.025), -1.45, 1.45));
  shear.y = round(clamp(shear.y + 0.11 + event.memoryIndex * 0.018, -1.3, 1.3));
  shear.rz = round(shear.rz - sign * (17 + event.memoryIndex * 1.6));
  shear.width = round(clamp(shear.width * (0.88 - event.memoryIndex * 0.018), 0.28, 1.2));
  shear.height = round(clamp(shear.height + sign * 0.08, 0.26, 1.1));
  shear.face = (source.face + 3 + event.memoryIndex) % 5;

  hollow.role = 'hollowed';
  hollow.x = round(clamp(hollow.x + sign * 0.09, -1.45, 1.45));
  hollow.z = round(clamp(hollow.z - sign * (0.18 + event.memoryIndex * 0.03), -1.2, 1.2));
  hollow.rx = round(hollow.rx + sign * (10 + event.memoryIndex * 1.4));
  hollow.height = round(clamp(hollow.height * (0.8 - event.memoryIndex * 0.02), 0.22, 1.1));
  hollow.opacity = round(Math.max(0.58, hollow.opacity - 0.08));
  hollow.face = (source.face + 4 + event.memoryIndex) % 5;
}

function materialise(memory) {
  const blocks = BASE_BLOCKS.map((block) => ({ ...block }));
  for (const event of memory.slice(-MEMORY_WINDOW)) applyEvent(blocks, event);
  const changedBlockCount = blocks.reduce((count, block, index) => count + (blockSignature(block) === blockSignature(BASE_BLOCKS[index]) ? 0 : 1), 0);
  return {
    blocks,
    trace: {
      memoryCount: memory.length,
      changedBlockCount,
      lastSource: memory.at(-1)?.source ?? null,
      lastDirection: memory.at(-1)?.direction ?? null,
      generation: memory.length
    },
    blockCount: BLOCK_COUNT
  };
}

function stateFrom(memory, interaction = 'idle', scan = null) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'volumetric-misregistration',
    surface: 'webgl-wrong-volume',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    scan: scan ? clone(scan) : null,
    interaction,
    scene: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }

export function beginScan(state, { direction } = {}) {
  if (!validDirection(direction)) return stateFrom(state.memory, 'scan-refused-invalid', state.scan);
  return stateFrom(state.memory, 'scan-started', {
    direction,
    distance: 0,
    reversed: false,
    reverseDistance: 0
  });
}

export function advanceScan(state, { direction, distance = 0 } = {}) {
  if (!state.scan || !validDirection(direction) || !Number.isFinite(distance) || distance <= 0) {
    return stateFrom(state.memory, 'scan-refused-invalid', state.scan);
  }
  const scan = { ...state.scan };
  const amount = round(Math.abs(distance));
  if (!scan.reversed && direction === scan.direction) {
    scan.distance = round(scan.distance + amount);
  } else if (!scan.reversed && direction === -scan.direction && (scan.distance >= MIN_SCAN_DISTANCE || scan.distance === 0)) {
    scan.reversed = true;
    scan.reverseDistance = round(scan.reverseDistance + amount);
    scan.distance = round(scan.distance + amount);
  } else if (scan.reversed && direction === -scan.direction) {
    scan.reverseDistance = round(scan.reverseDistance + amount);
    scan.distance = round(scan.distance + amount);
  }
  return stateFrom(state.memory, scan.reversed ? 'scan-reversed' : 'scan-advanced', scan);
}

export function commitScan(state) {
  const scan = state.scan;
  if (!scan || !scan.reversed || scan.distance < MIN_SCAN_DISTANCE || scan.reverseDistance <= 0) {
    return stateFrom(state.memory, 'scan-refused-incomplete', scan);
  }
  const event = eventFor(scan.direction, state.memory.length);
  return stateFrom([...state.memory, event], 'scan-committed');
}

export function liftLatestScan(state) {
  if (!state.memory.length) return stateFrom([], 'scan-lifted');
  return stateFrom(state.memory.slice(0, -1), 'scan-lifted');
}

export function releaseMemory() { return stateFrom([], 'memory-released'); }

export function buildTimeline() { return [1, -1, 1, -1]; }

export {
  BASE_BLOCKS,
  BLOCK_COUNT,
  blockSignature,
  geometrySignature,
  MEMORY_WINDOW,
  MIN_SCAN_DISTANCE,
  SEED
};
