const SEED = '0x4e413434';
export const SHUTTER_COUNT = 10;
export const VISIT_SIZE = 3;
export const MEMORY_WINDOW = 4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const validShutter = (value) => Number.isInteger(value) && value >= 0 && value < SHUTTER_COUNT;

// A wall, not an orbit: ten awkward shutters lean across a field with no privileged centre.
const LAYOUT = [
  [-0.77, -0.57, 0.24, 0.28, -11, 0],
  [-0.26, -0.66, 0.27, 0.22, 8, 1],
  [0.28, -0.58, 0.22, 0.31, -7, 2],
  [0.76, -0.42, 0.25, 0.25, 13, 3],
  [-0.63, -0.08, 0.3, 0.24, 7, 4],
  [-0.1, -0.03, 0.24, 0.32, -14, 5],
  [0.45, 0.05, 0.28, 0.22, 5, 6],
  [-0.76, 0.42, 0.22, 0.3, -8, 7],
  [-0.23, 0.5, 0.3, 0.24, 12, 8],
  [0.48, 0.46, 0.24, 0.3, -10, 9]
];

function baseShutter(index) {
  const [x, y, width, height, rotation, notch] = LAYOUT[index];
  return {
    id: index,
    x,
    y,
    width,
    height,
    rotation,
    notch,
    role: 'shutter'
  };
}

const BASE_SHUTTERS = Array.from({ length: SHUTTER_COUNT }, (_, index) => baseShutter(index));

export function shutterSignature(shutter) {
  return [
    shutter.id,
    round(shutter.x),
    round(shutter.y),
    round(shutter.width),
    round(shutter.height),
    round(shutter.rotation),
    shutter.notch,
    shutter.role
  ].join(':');
}

function absenceSignature(absence) {
  return [
    absence.id,
    round(absence.x),
    round(absence.y),
    round(absence.scale),
    round(absence.skew),
    absence.bias,
    absence.shutters.join(','),
    absence.rings.map((ring) => ring.map((point) => `${round(point.x)},${round(point.y)}`).join(';')).join('|')
  ].join(':');
}

export function geometrySignature(state) {
  return [
    ...state.scene.shutters.map(shutterSignature),
    ...state.scene.absences.map(absenceSignature)
  ].join('|');
}

function eventFor(shutters, memoryIndex) {
  const sum = shutters.reduce((total, value) => total + value, 0);
  const bias = ['late', 'sideways', 'hollow', 'borrowed'][memoryIndex % 4];
  return {
    kind: 'remote-absence',
    shutters: [...shutters],
    memoryIndex,
    bias,
    seed: sum * 31 + memoryIndex * 47
  };
}

function absenceFor(event) {
  const sum = event.shutters.reduce((total, value) => total + value, 0);
  const slot = (sum + event.memoryIndex * 3 + 2) % SHUTTER_COUNT;
  const x = round(-0.72 + ((slot * 37 + 11) % 145) / 100);
  const y = round(-0.58 + ((slot * 61 + 17) % 113) / 100);
  const scale = round(0.16 + (event.memoryIndex % 4) * 0.027 + (sum % 3) * 0.012);
  const skew = round(((sum % 5) - 2) * 0.11 + event.memoryIndex * 0.025);
  const rings = [0, 1, 2].map((ringIndex) => {
    const points = [];
    const count = 5 + ringIndex;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * index / count + (event.seed % 17) * 0.07 + ringIndex * 0.21;
      const radial = scale * (0.58 + ringIndex * 0.18) * (1 + Math.sin((index + 2) * (event.seed + 5) * 0.13) * (0.11 + ringIndex * 0.025));
      points.push({
        x: round(x + Math.cos(angle) * radial + skew * ringIndex * 0.22),
        y: round(y + Math.sin(angle) * radial * 0.72 - skew * (ringIndex + 1) * 0.15)
      });
    }
    return points;
  });
  return {
    id: event.memoryIndex,
    x,
    y,
    scale,
    skew,
    bias: event.bias,
    shutters: [...event.shutters],
    rings
  };
}

function materialise(memory) {
  const shutters = BASE_SHUTTERS.map((shutter) => ({ ...shutter }));
  const absences = memory.slice(-MEMORY_WINDOW).map(absenceFor);
  return {
    shutters,
    absences,
    trace: {
      memoryCount: memory.length,
      absenceCount: absences.length,
      changedShutterCount: shutters.reduce((count, shutter, index) => count + (shutterSignature(shutter) === shutterSignature(BASE_SHUTTERS[index]) ? 0 : 1), 0),
      lastShutters: memory.at(-1)?.shutters ?? []
    },
    shutterCount: SHUTTER_COUNT
  };
}

function stateFrom(memory, interaction = 'idle', pending = [], focus = 0) {
  const boundedMemory = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    grammar: 'departure-absence-wall',
    surface: 'canvas-shutter-wall',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    pending: [...pending],
    focus,
    interaction,
    scene: materialise(boundedMemory)
  };
}

export function buildFrame() { return stateFrom([]); }

export function beginVisit(state) {
  return stateFrom(state.memory, 'visit-started', [], state.focus ?? 0);
}

export function noticeShutter(state, id) {
  if (!validShutter(id)) return stateFrom(state.memory, 'shutter-refused-invalid', state.pending, state.focus ?? 0);
  if (state.pending.includes(id)) return stateFrom(state.memory, 'shutter-refused-repeated', state.pending, id);
  if (state.pending.length >= VISIT_SIZE) return stateFrom(state.memory, 'visit-refused-full', state.pending, id);
  const pending = [...state.pending, id];
  return stateFrom(state.memory, pending.length === VISIT_SIZE ? 'visit-ready' : 'shutter-noticed', pending, id);
}

export function commitDeparture(state) {
  if (state.pending.length !== VISIT_SIZE) return stateFrom(state.memory, 'departure-refused-incomplete', state.pending, state.focus ?? 0);
  const event = eventFor(state.pending, state.memory.length);
  return stateFrom([...state.memory, event], 'departure-committed', [], state.focus ?? 0);
}

export function liftLatestDeparture(state) {
  return stateFrom(state.memory.slice(0, -1), 'departure-lifted', [], state.focus ?? 0);
}

export function releaseMemory() { return stateFrom([], 'memory-released'); }

export function buildTimeline() {
  return [[1, 5, 8], [0, 4, 9], [2, 6, 7], [3, 5, 9]];
}

export { SEED };
