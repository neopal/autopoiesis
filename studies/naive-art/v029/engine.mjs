const SEED = '0x4e413239';
const MEMORY_WINDOW = 4;
const PATCH_COUNT = 12;
const MIN_CROSSINGS = 2;
const MIN_TRAVEL = 0.42;
const MIN_DURATION = 420;

const LAYOUT = [
  { x: 0.18, y: 0.23, w: 0.24, h: 0.20, tilt: -0.08, tone: 'ochre', weight: 1.00 },
  { x: 0.48, y: 0.18, w: 0.18, h: 0.25, tilt: 0.12, tone: 'clay', weight: 0.92 },
  { x: 0.73, y: 0.27, w: 0.20, h: 0.17, tilt: -0.18, tone: 'lichen', weight: 1.08 },
  { x: 0.25, y: 0.48, w: 0.20, h: 0.22, tilt: 0.15, tone: 'ink', weight: 0.84 },
  { x: 0.51, y: 0.48, w: 0.26, h: 0.18, tilt: -0.04, tone: 'rust', weight: 1.10 },
  { x: 0.78, y: 0.50, w: 0.14, h: 0.25, tilt: 0.18, tone: 'ochre', weight: 0.88 },
  { x: 0.13, y: 0.75, w: 0.18, h: 0.15, tilt: -0.18, tone: 'lichen', weight: 1.06 },
  { x: 0.38, y: 0.76, w: 0.20, h: 0.16, tilt: 0.08, tone: 'rust', weight: 0.94 },
  { x: 0.65, y: 0.76, w: 0.22, h: 0.14, tilt: -0.12, tone: 'clay', weight: 1.04 },
  { x: 0.88, y: 0.76, w: 0.10, h: 0.14, tilt: 0.20, tone: 'ink', weight: 0.80 },
  { x: 0.30, y: 0.34, w: 0.13, h: 0.10, tilt: 0.22, tone: 'rust', weight: 0.74 },
  { x: 0.63, y: 0.38, w: 0.12, h: 0.11, tilt: -0.20, tone: 'ochre', weight: 0.78 }
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10000) / 10000;
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

function basePatch(index) {
  const source = LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    width: source.w,
    height: source.h,
    tilt: source.tilt,
    tone: source.tone,
    weight: source.weight,
    role: 'quiet',
    shear: 0,
    notch: 0,
    scale: 1,
    stamp: 0
  };
}

function applyEvent(patch, event) {
  const phase = event.phase;
  if (patch.id === event.first) {
    patch.role = 'misjoined-source';
    patch.x -= event.drift * 0.7;
    patch.y += event.drift * 0.35;
    patch.tilt += event.turn * 0.8;
    patch.scale *= 0.82;
    patch.shear -= event.shear;
    patch.notch = round(0.08 + event.crossings * 0.018);
    patch.stamp = phase;
  }
  if (patch.id === event.second) {
    patch.role = 'relay';
    patch.x += event.drift * 0.55;
    patch.y -= event.drift * 0.25;
    patch.tilt -= event.turn * 0.62;
    patch.scale *= 1.18;
    patch.shear += event.shear * 0.72;
    patch.notch = round(0.05 + event.directionChanges * 0.025);
    patch.stamp = phase + 1;
  }
  if (patch.id === event.echo) {
    patch.role = 'echo';
    patch.x += event.drift * (event.memoryIndex % 2 ? -0.38 : 0.38);
    patch.y += event.drift * 0.48;
    patch.tilt += event.turn * 0.48;
    patch.scale *= 0.90;
    patch.shear -= event.shear * 0.46;
    patch.notch = round(0.03 + event.memoryIndex * 0.02);
    patch.stamp = phase + 2;
  }
}

function buildScene(stage, memory) {
  const patches = Array.from({ length: PATCH_COUNT }, (_, index) => basePatch(index));
  memory.slice(-MEMORY_WINDOW).forEach((event) => patches.forEach((patch) => applyEvent(patch, event)));
  const changed = patches.filter((patch) => patch.role !== 'quiet');
  return {
    stage,
    patches,
    trace: {
      changedPatchCount: changed.length,
      changedPatchIds: changed.map((patch) => patch.id),
      roles: changed.map((patch) => patch.role),
      memoryCount: memory.length,
      crossings: memory.reduce((sum, event) => sum + event.crossings, 0)
    }
  };
}

function makeState(stage, memory, active = 0, interaction = 'idle') {
  const bounded = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    stage,
    active: clamp(integer(active), 0, PATCH_COUNT - 1),
    memory: bounded,
    scene: buildScene(stage, bounded),
    interaction
  };
}

export function buildFrame(stage = 0, memory = [], active = 0) {
  return makeState(stage, memory, active, 'idle');
}

export function armPatch(state, index) {
  return makeState(state.stage, state.memory, index, 'gesture-armed');
}

export function gestureIsValid(gesture = {}) {
  const first = integer(gesture.first, -1);
  const second = integer(gesture.second, -1);
  return first >= 0 && first < PATCH_COUNT
    && second >= 0 && second < PATCH_COUNT
    && first !== second
    && integer(gesture.crossings) >= MIN_CROSSINGS
    && Number(gesture.travel) >= MIN_TRAVEL
    && integer(gesture.directionChanges) >= 1
    && Number(gesture.duration) >= MIN_DURATION;
}

export function commitGesture(state, gesture = {}) {
  const first = clamp(integer(gesture.first ?? state.active), 0, PATCH_COUNT - 1);
  const second = clamp(integer(gesture.second ?? ((first + 5) % PATCH_COUNT)), 0, PATCH_COUNT - 1);
  if (!gestureIsValid({ ...gesture, first, second })) {
    return makeState(state.stage, state.memory, second, 'gesture-refused-shallow');
  }
  const memoryIndex = state.memory.length;
  const echoCandidate = (first + second + memoryIndex * 3 + integer(gesture.crossings)) % PATCH_COUNT;
  const echo = echoCandidate === first || echoCandidate === second ? (echoCandidate + 4) % PATCH_COUNT : echoCandidate;
  const event = {
    kind: 'hesitation-relay',
    first,
    second,
    echo,
    crossings: integer(gesture.crossings),
    travel: round(Number(gesture.travel)),
    directionChanges: integer(gesture.directionChanges),
    duration: Math.min(2600, Math.max(MIN_DURATION, Math.round(Number(gesture.duration)))),
    memoryIndex,
    phase: round(0.22 + ((first + second + memoryIndex) % 5) * 0.17),
    drift: round(0.018 + ((first * 2 + second + memoryIndex) % 4) * 0.009),
    turn: round(0.06 + ((second + memoryIndex) % 3) * 0.035),
    shear: round(0.10 + ((first + second) % 4) * 0.025)
  };
  return makeState(state.stage + 1, [...state.memory, event], second, 'gesture-committed');
}

export function liftLatestGesture(state) {
  if (!state.memory.length) return makeState(state.stage, [], state.active, 'gesture-lifted');
  return makeState(Math.max(0, state.stage - 1), state.memory.slice(0, -1), state.active, 'gesture-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], state.active, 'memory-released');
}

export function geometrySignature(state) {
  return state.scene.patches.map((patch) => [
    patch.id,
    patch.role,
    round(patch.x),
    round(patch.y),
    round(patch.width),
    round(patch.height),
    round(patch.tilt),
    round(patch.shear),
    round(patch.notch),
    round(patch.scale),
    patch.stamp
  ].join(':')).join('|');
}

export function changedPatchIds(state) {
  const baseline = buildFrame();
  return state.scene.patches
    .filter((patch, index) => geometrySignature({ scene: { patches: [patch] } }) !== geometrySignature({ scene: { patches: [baseline.scene.patches[index]] } }))
    .map((patch) => patch.id);
}

export function buildTimeline() {
  return {
    gestures: [
      { first: 1, second: 9, crossings: 3, travel: 0.78, directionChanges: 2, duration: 820 },
      { first: 6, second: 2, crossings: 4, travel: 0.68, directionChanges: 3, duration: 940 },
      { first: 4, second: 10, crossings: 2, travel: 0.56, directionChanges: 1, duration: 620 },
      { first: 8, second: 0, crossings: 5, travel: 0.88, directionChanges: 4, duration: 1120 }
    ]
  };
}

export { PATCH_COUNT, MEMORY_WINDOW, MIN_CROSSINGS, MIN_TRAVEL, MIN_DURATION, SEED };
