const SEED = '0x4e413238';
const MEMORY_WINDOW = 4;
const MARK_COUNT = 15;
const MIN_LOOK_MS = 420;

const LAYOUT = [
  { row: 0, col: 0, glyph: '○', tone: 'ochre' },
  { row: 0, col: 1, glyph: '△', tone: 'clay' },
  { row: 0, col: 2, glyph: '▣', tone: 'lichen' },
  { row: 0, col: 3, glyph: '╱', tone: 'ink' },
  { row: 0, col: 4, glyph: '⌁', tone: 'rust' },
  { row: 1, col: 0, glyph: '＋', tone: 'ink' },
  { row: 1, col: 1, glyph: '□', tone: 'lichen' },
  { row: 1, col: 2, glyph: '◌', tone: 'ochre' },
  { row: 1, col: 3, glyph: '∴', tone: 'clay' },
  { row: 1, col: 4, glyph: '∨', tone: 'rust' },
  { row: 2, col: 0, glyph: '◇', tone: 'rust' },
  { row: 2, col: 1, glyph: '＝', tone: 'ink' },
  { row: 2, col: 2, glyph: '∩', tone: 'ochre' },
  { row: 2, col: 3, glyph: '⋮', tone: 'clay' },
  { row: 2, col: 4, glyph: '·', tone: 'lichen' }
];

const ECHO_GLYPHS = ['≈', '∿', '⋰', '⌇', '∽', '≋'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10000) / 10000;

function baseMark(index) {
  const source = LAYOUT[index];
  return {
    id: index,
    row: source.row,
    col: source.col,
    glyph: source.glyph,
    tone: source.tone,
    role: 'quiet',
    turn: round((index % 5 - 2) * 0.8),
    span: 1,
    nudge: 0,
    weight: 1
  };
}

function applyEvent(mark, event) {
  if (mark.id === event.source) {
    mark.role = 'vacated';
    mark.glyph = ' ';
    mark.span = 0.72;
    mark.turn += event.turn * 0.4;
    mark.nudge -= event.nudge * 0.6;
    mark.weight = 0.64;
  }
  if (mark.id === event.wrong) {
    mark.role = 'misheard';
    mark.glyph = event.sourceGlyph;
    mark.span = 1.3;
    mark.turn -= event.turn;
    mark.nudge += event.nudge;
    mark.weight = 1.32;
  }
  if (mark.id === event.echo) {
    mark.role = 'echo';
    mark.glyph = event.echoGlyph;
    mark.span = 0.82;
    mark.turn += event.turn * 1.4;
    mark.nudge -= event.nudge * 0.85;
    mark.weight = 0.82;
  }
  if (mark.id === event.gap) {
    mark.role = 'gap';
    mark.glyph = ' ';
    mark.span = 1.7;
    mark.nudge += event.nudge * 0.5;
    mark.weight = 0.42;
  }
}

function buildScene(stage, memory) {
  const marks = Array.from({ length: MARK_COUNT }, (_, index) => baseMark(index));
  memory.slice(-MEMORY_WINDOW).forEach((event) => marks.forEach((mark) => applyEvent(mark, event)));
  const changed = marks.filter((mark) => mark.role !== 'quiet');
  return {
    stage,
    marks,
    trace: {
      changedMarkCount: changed.length,
      roles: changed.map((mark) => mark.role),
      gapIndex: marks.find((mark) => mark.role === 'gap')?.id ?? null,
      memoryCount: memory.length
    }
  };
}

function makeState(stage, memory, active = 0, interaction = 'idle') {
  const bounded = memory.slice(-MEMORY_WINDOW);
  return {
    seed: SEED,
    stage,
    active: clamp(Math.trunc(active), 0, MARK_COUNT - 1),
    memory: bounded,
    scene: buildScene(stage, bounded),
    interaction
  };
}

export function buildFrame(stage = 0, memory = [], active = 0) {
  return makeState(stage, memory, active, 'idle');
}

export function observe(state, index) {
  return makeState(state.stage, state.memory, index, 'observation-armed');
}

export function lookIsValid(event) {
  return Boolean(event?.departed) && Number(event?.duration) >= MIN_LOOK_MS;
}

export function commitObservation(state, event = {}) {
  const index = clamp(Math.trunc(Number(event.index ?? state.active)), 0, MARK_COUNT - 1);
  if (!lookIsValid(event)) return makeState(state.stage, state.memory, index, 'observation-refused-short');
  const current = state.scene.marks[index];
  const memoryLength = state.memory.length;
  const wrong = (index + 7 + memoryLength) % MARK_COUNT;
  const echo = (index + 4 + memoryLength * 2) % MARK_COUNT;
  const gap = (index + 10 + memoryLength) % MARK_COUNT;
  const commit = {
    source: index,
    wrong,
    echo,
    gap,
    sourceGlyph: current.glyph,
    echoGlyph: ECHO_GLYPHS[(index + memoryLength) % ECHO_GLYPHS.length],
    duration: Math.min(2400, Math.max(MIN_LOOK_MS, Math.round(Number(event.duration)))),
    turn: round(2.2 + ((index + memoryLength) % 3) * 0.55),
    nudge: round(0.12 + ((index * 2 + memoryLength) % 4) * 0.035)
  };
  return makeState(state.stage + 1, [...state.memory, commit], index, 'observation-committed');
}

export function liftLatestObservation(state) {
  if (!state.memory.length) return makeState(state.stage, [], state.active, 'observation-lifted');
  return makeState(Math.max(0, state.stage - 1), state.memory.slice(0, -1), state.active, 'observation-lifted');
}

export function releaseMemory(state = buildFrame()) {
  return makeState(0, [], state.active, 'memory-released');
}

export function geometrySignature(state) {
  return state.scene.marks.map((mark) => [
    mark.id, mark.glyph, mark.role, round(mark.turn), round(mark.span), round(mark.nudge), round(mark.weight)
  ].join(':')).join('|');
}

export function buildTimeline() {
  return {
    observations: [
      { index: 2, duration: 760, departed: true },
      { index: 9, duration: 920, departed: true },
      { index: 6, duration: 540, departed: true },
      { index: 13, duration: 1180, departed: true }
    ]
  };
}

export { MARK_COUNT, MEMORY_WINDOW, MIN_LOOK_MS, SEED };
