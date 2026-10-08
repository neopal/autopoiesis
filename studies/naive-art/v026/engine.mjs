const SEED = '0x4e413236';
const MEMORY_WINDOW = 4;
const WITNESS_COUNT = 9;

const LAYOUT = [
  { x: 0.16, y: 0.25, rotation: -0.22, scale: 0.88 },
  { x: 0.42, y: 0.14, rotation: 0.16, scale: 1.06 },
  { x: 0.73, y: 0.25, rotation: -0.08, scale: 0.82 },
  { x: 0.27, y: 0.45, rotation: 0.34, scale: 1.02 },
  { x: 0.57, y: 0.39, rotation: -0.28, scale: 1.18 },
  { x: 0.86, y: 0.51, rotation: 0.24, scale: 0.92 },
  { x: 0.13, y: 0.75, rotation: 0.18, scale: 1.04 },
  { x: 0.43, y: 0.69, rotation: -0.18, scale: 0.9 },
  { x: 0.75, y: 0.8, rotation: 0.12, scale: 1.1 }
];

const PALETTES = [
  { fill: '#d8c8a8', ink: '#18252b', accent: '#c65c3b' },
  { fill: '#b7c7bf', ink: '#20343a', accent: '#d07a4e' },
  { fill: '#e2c3a1', ink: '#1e2930', accent: '#7e8f61' },
  { fill: '#c5b9d5', ink: '#25222c', accent: '#bd614f' },
  { fill: '#d2d7c8', ink: '#1d2d30', accent: '#bf7145' },
  { fill: '#dfbcae', ink: '#2a2424', accent: '#6c8a7b' },
  { fill: '#bfc8dc', ink: '#202733', accent: '#ca7653' },
  { fill: '#d7c7bd', ink: '#2b2727', accent: '#7c8a67' },
  { fill: '#d7d0a8', ink: '#26302d', accent: '#bd5d46' }
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10000) / 10000;

function pointString(points) {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${round(x)},${round(y)}`).join(' ') + ' Z';
}

function rotatePoint(x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos];
}

function polygonFor(index, scale, rotation, seedOffset, inner = false) {
  const count = inner ? 6 : 9;
  const points = [];
  const baseRadius = inner ? 0.052 : 0.118;
  for (let point = 0; point < count; point += 1) {
    const angle = (Math.PI * 2 * point) / count + rotation;
    const wobble = 1 + 0.13 * Math.sin((index + 2) * 1.77 + point * 2.19 + seedOffset);
    const x = Math.cos(angle) * baseRadius * scale * wobble * (inner ? 1.08 : 1);
    const y = Math.sin(angle) * baseRadius * scale * wobble * (inner ? 0.82 : 1.05);
    points.push(rotatePoint(x, y, rotation * 0.31 + seedOffset * 0.018));
  }
  return points;
}

function witnessPath(witness) {
  const outer = polygonFor(witness.id, witness.scale, witness.rotation, witness.seedOffset);
  const inner = polygonFor(witness.id, witness.notch, -witness.rotation * 0.7, witness.seedOffset + 0.8, true);
  const outerTranslated = outer.map(([x, y]) => [round(witness.x + x), round(witness.y + y)]);
  const innerTranslated = inner.map(([x, y]) => [round(witness.x + x), round(witness.y + y)]).reverse();
  return `${pointString(outerTranslated)} ${pointString(innerTranslated)}`;
}

function baseWitness(index) {
  const layout = LAYOUT[index];
  const palette = PALETTES[index];
  const witness = {
    id: index,
    x: layout.x,
    y: layout.y,
    rotation: layout.rotation,
    scale: layout.scale,
    notch: 1,
    seedOffset: index * 0.73,
    fill: palette.fill,
    ink: palette.ink,
    accent: palette.accent,
    role: 'quiet',
    path: ''
  };
  witness.path = witnessPath(witness);
  return witness;
}

function applyEvent(witness, event) {
  let role = 'quiet';
  if (witness.id === event.selected) {
    role = 'attended';
    witness.rotation += event.rotationDelta;
    witness.scale *= 1 - event.scaleDelta;
    witness.notch *= 1 + event.notchDelta;
    witness.x += event.selectedShift;
  } else if (witness.id === event.counted) {
    role = 'miscounted';
    witness.rotation -= event.rotationDelta * 0.7;
    witness.scale *= 1 + event.scaleDelta * 1.4;
    witness.notch *= 1 + event.notchDelta * 1.8;
    witness.x -= event.remoteShift;
    witness.y += event.remoteShift * 0.72;
  } else if (witness.id === event.echo) {
    role = 'echo';
    witness.rotation += event.rotationDelta * 1.45;
    witness.scale *= 1 - event.scaleDelta * 0.52;
    witness.y -= event.remoteShift * 0.48;
  }
  witness.role = role;
  witness.path = witnessPath(witness);
}

function buildScene(stage, memory) {
  const witnesses = Array.from({ length: WITNESS_COUNT }, (_, index) => baseWitness(index));
  const bounded = memory.slice(-MEMORY_WINDOW);
  bounded.forEach((event) => {
    witnesses.forEach((witness) => applyEvent(witness, event));
  });
  return {
    stage,
    witnesses,
    trace: {
      changedWitnessCount: witnesses.filter((witness) => witness.role !== 'quiet').length,
      miscountCount: bounded.length,
      occupiedRoles: witnesses.filter((witness) => witness.role !== 'quiet').map((witness) => witness.role)
    }
  };
}

function makeState(stage, memory, selected = 0, interaction = 'idle') {
  const bounded = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    stage,
    selected: clamp(Math.trunc(selected), 0, WITNESS_COUNT - 1),
    memory: bounded,
    scene: buildScene(stage, bounded),
    interaction
  };
}

export function buildFrame(stage = 0, memory = [], selected = 0) {
  return makeState(stage, memory, selected, 'idle');
}

export function selectWitness(state, index) {
  return makeState(state.stage, state.memory, index, 'witness-selected');
}

export function commitMiscount(state, requestedIndex = state.selected) {
  const selected = clamp(Math.trunc(requestedIndex), 0, WITNESS_COUNT - 1);
  const counted = (selected + 4) % WITNESS_COUNT;
  const echo = (selected + 5) % WITNESS_COUNT;
  const event = {
    source: 'miscounted-attention',
    selected,
    counted,
    echo,
    notchDelta: 0.21 + ((state.memory.length + selected) % 3) * 0.035,
    rotationDelta: 0.12 + ((selected * 2 + state.memory.length) % 4) * 0.028,
    scaleDelta: 0.065 + ((selected + state.memory.length) % 2) * 0.018,
    selectedShift: 0.012 + selected * 0.001,
    remoteShift: 0.018 + ((selected + 1) % 3) * 0.006,
    changedWitnesses: [selected, counted, echo]
  };
  const nextMemory = [...state.memory, event].slice(-MEMORY_WINDOW);
  return makeState(state.stage + 1, nextMemory, selected, 'miscount-committed');
}

export function liftLatestMiscount(state) {
  if (!state.memory.length) return makeState(state.stage, [], state.selected, 'miscount-lifted');
  return makeState(Math.max(0, state.stage - 1), state.memory.slice(0, -1), state.selected, 'miscount-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], state.selected, 'memory-released');
}

export function geometrySignature(state) {
  return state.scene.witnesses.map(({ id, x, y, rotation, scale, notch, path }) => [
    id, round(x), round(y), round(rotation), round(scale), round(notch), path
  ]).map((entry) => entry.join(':')).join('|');
}

export function buildTimeline() {
  const states = [buildFrame(0, [])];
  for (const index of [2, 6, 1, 7]) states.push(commitMiscount(selectWitness(states.at(-1), index)));
  return states;
}

export { MEMORY_WINDOW, SEED, WITNESS_COUNT };
