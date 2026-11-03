const SEED = '0x4e413433';
export const WITNESS_COUNT = 12;
export const GROUP_SIZE = 3;
export const MEMORY_WINDOW = 4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const validWitness = (value) => Number.isInteger(value) && value >= 0 && value < WITNESS_COUNT;

// A broken orbit: the empty centre is deliberately more important than the agents.
const LAYOUT = [
  [-0.78, -0.58, 0.17, -18, 0],
  [-0.36, -0.83, 0.13, 12, 1],
  [0.12, -0.78, 0.19, -7, 2],
  [0.66, -0.57, 0.14, 24, 3],
  [0.88, -0.12, 0.18, -12, 4],
  [0.72, 0.42, 0.12, 31, 5],
  [0.28, 0.78, 0.16, -20, 6],
  [-0.18, 0.82, 0.12, 8, 7],
  [-0.68, 0.56, 0.18, 27, 8],
  [-0.9, 0.14, 0.13, -29, 9],
  [-0.48, -0.04, 0.1, 16, 10],
  [0.03, 0.14, 0.11, -34, 11]
];

function baseWitness(index) {
  const [x, y, radius, rotation, kind] = LAYOUT[index];
  return {
    id: index,
    x,
    y,
    radius,
    rotation,
    kind,
    role: 'witness',
    attention: 0
  };
}

const BASE_WITNESSES = Array.from({ length: WITNESS_COUNT }, (_, index) => baseWitness(index));

export function witnessSignature(witness) {
  return [
    witness.id,
    round(witness.x),
    round(witness.y),
    round(witness.radius),
    round(witness.rotation),
    witness.kind,
    witness.role,
    round(witness.attention)
  ].join(':');
}

function consensusSignature(consensus) {
  return [
    consensus.id,
    round(consensus.x),
    round(consensus.y),
    round(consensus.scale),
    round(consensus.rotation),
    consensus.bias,
    consensus.witnesses.join(','),
    consensus.loops.map((loop) => loop.map((point) => `${round(point.x)},${round(point.y)}`).join(';')).join('|')
  ].join(':');
}

export function geometrySignature(state) {
  return [
    ...state.scene.witnesses.map(witnessSignature),
    ...state.scene.consensus.map(consensusSignature)
  ].join('|');
}

function eventFor(witnesses, memoryIndex) {
  const sum = witnesses.reduce((total, value) => total + value, 0);
  const bias = ['overlap', 'echo', 'splice', 'hollow'][memoryIndex % 4];
  return {
    kind: 'false-consensus',
    witnesses: [...witnesses],
    memoryIndex,
    bias,
    seed: sum * 17 + memoryIndex * 29
  };
}

function consensusFor(event) {
  const [a, b, c] = event.witnesses;
  const first = BASE_WITNESSES[a];
  const second = BASE_WITNESSES[b];
  const third = BASE_WITNESSES[c];
  const cx = round((first.x + second.x + third.x) / 3);
  const cy = round((first.y + second.y + third.y) / 3);
  const scale = round(clamp(0.46 + event.memoryIndex * 0.055 + ((a + c) % 3) * 0.025, 0.42, 0.72));
  const rotation = round((first.rotation + second.rotation + third.rotation) / 3 + (event.memoryIndex % 2 ? 13 : -9));
  const biasShift = { overlap: 0.02, echo: -0.035, splice: 0.06, hollow: -0.07 }[event.bias];
  const loops = [0, 1, 2].map((loopIndex) => {
    const points = [];
    const count = 7 + loopIndex;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + rotation * Math.PI / 180 + loopIndex * 0.31;
      const uneven = 1 + Math.sin((index + 1) * (event.seed + 3) * 0.17) * (0.1 + loopIndex * 0.025);
      const radial = scale * (0.58 + loopIndex * 0.13) * uneven;
      points.push({
        x: round(cx + Math.cos(angle) * radial + biasShift * loopIndex),
        y: round(cy + Math.sin(angle) * radial * 0.74 - biasShift * (loopIndex + 1))
      });
    }
    return points;
  });
  return {
    id: event.memoryIndex,
    x: cx,
    y: cy,
    scale,
    rotation,
    bias: event.bias,
    witnesses: [...event.witnesses],
    loops
  };
}

function materialise(memory) {
  const witnesses = BASE_WITNESSES.map((witness) => ({ ...witness }));
  const consensus = memory.slice(-MEMORY_WINDOW).map(consensusFor);
  return {
    witnesses,
    consensus,
    trace: {
      memoryCount: memory.length,
      consensusCount: consensus.length,
      changedWitnessCount: witnesses.reduce((count, witness, index) => count + (witnessSignature(witness) === witnessSignature(BASE_WITNESSES[index]) ? 0 : 1), 0),
      lastWitnesses: memory.at(-1)?.witnesses ?? []
    },
    witnessCount: WITNESS_COUNT
  };
}

function stateFrom(memory, interaction = 'idle', pending = [], focus = 0) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'false-consensus-contours',
    surface: 'canvas-attention-field',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    pending: [...pending],
    focus,
    interaction,
    scene: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }

export function beginSelection(state) {
  return stateFrom(state.memory, 'selection-started', [], state.focus ?? 0);
}

export function selectWitness(state, id) {
  if (!validWitness(id)) return stateFrom(state.memory, 'witness-refused-invalid', state.pending, state.focus ?? 0);
  if (state.pending.includes(id)) return stateFrom(state.memory, 'witness-refused-repeated', state.pending, id);
  if (state.pending.length >= GROUP_SIZE) return stateFrom(state.memory, 'witness-refused-full', state.pending, id);
  const pending = [...state.pending, id];
  return stateFrom(state.memory, pending.length === GROUP_SIZE ? 'quorum-ready' : 'witness-selected', pending, id);
}

export function commitSelection(state) {
  if (state.pending.length !== GROUP_SIZE) return stateFrom(state.memory, 'quorum-refused-incomplete', state.pending, state.focus ?? 0);
  const event = eventFor(state.pending, state.memory.length);
  return stateFrom([...state.memory, event], 'quorum-committed', [], state.focus ?? 0);
}

export function liftLatestSelection(state) {
  return stateFrom(state.memory.slice(0, -1), 'selection-lifted', [], state.focus ?? 0);
}

export function releaseMemory() { return stateFrom([], 'memory-released'); }

export function buildTimeline() {
  return [[1, 6, 10], [3, 7, 11], [0, 5, 8], [2, 4, 9]];
}

export { SEED };
