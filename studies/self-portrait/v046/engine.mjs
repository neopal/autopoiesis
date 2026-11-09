export const TOKEN_COUNT = 12;
export const BREAK_LIMIT = 3;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503046;

const WORDS = ['I', 'KEEP', 'THE', 'RULE', 'THAT', 'MADE', 'ME', 'VISIBLE', 'BY', 'MOVING', 'THE', 'MARGIN'];
const MODES = ['stagger', 'hinge', 'spill', 'vertical'];
const round = (value) => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createTokens() {
  return WORDS.map((text, index) => ({
    index,
    text,
    x: round((index % 3 - 1) * 0.38),
    y: round((Math.floor(index / 3) - 1.5) * 0.25),
    rotation: round((index % 3 - 1) * 0.012),
    scale: round(0.84 + (index % 4) * 0.025)
  }));
}

export function buildField() {
  return {
    composition: 'margin-compiler',
    renderer: 'dom-typography',
    document: {
      revision: 0,
      mode: 'quiet',
      measure: 0.58,
      margin: 0.18,
      lineGap: 0.16,
      phase: 0,
      writing: 'horizontal'
    },
    tokens: createTokens(),
    pending: [],
    memory: [],
    snapshots: [],
    interaction: 'quiet manuscript'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    document: field.document,
    tokens: field.tokens
  });
}

export function markToken(field, index, pressure = 0.7, side = 'inset') {
  const next = structuredClone(field);
  const tokenIndex = Math.max(0, Math.min(TOKEN_COUNT - 1, Math.trunc(Number(index) || 0)));
  const normalizedPressure = round(Math.max(0, Math.min(1, Number(pressure) || 0)));
  if (next.pending.some((mark) => mark.index === tokenIndex)) {
    next.interaction = 'refused / repeated mark';
    return next;
  }
  next.pending = [...next.pending, {
    index: tokenIndex,
    pressure: normalizedPressure,
    side: side === 'outset' ? 'outset' : 'inset'
  }].slice(-BREAK_LIMIT);
  next.interaction = `mark held / ${next.pending.length} of ${BREAK_LIMIT}`;
  return next;
}

export function compileMargin(field) {
  const next = structuredClone(field);
  const pressure = next.pending.reduce((total, mark) => total + mark.pressure, 0);
  if (next.pending.length < BREAK_LIMIT) {
    next.interaction = 'refused / incomplete lineation';
    return { accepted: false, field: next, event: null };
  }
  if (pressure < 1.7) {
    next.interaction = 'refused / insufficient pressure';
    return { accepted: false, field: next, event: null };
  }

  const marks = structuredClone(next.pending);
  const revision = field.document.revision + 1;
  const balance = marks.reduce((total, mark) => total + (mark.side === 'outset' ? 1 : -1) * mark.pressure, 0);
  const sequence = marks.reduce((total, mark, order) => total + (order + 1) * (mark.index + 1) * (mark.side === 'outset' ? 1 : -1), 0);
  const mode = MODES[(revision - 1 + (balance > 0 ? 1 : 0)) % MODES.length];
  const event = {
    kind: 'margin-rewrite',
    relation: 'pressure-rewrites-lineation',
    marks,
    pressure: round(pressure),
    balance: round(balance),
    sequence,
    mode,
    revision
  };
  next.snapshots = [...next.snapshots, structuredClone(field)].slice(-MEMORY_LIMIT);
  next.document = {
    revision,
    mode,
    measure: round(clamp(field.document.measure - 0.035 + pressure * 0.018, 0.42, 0.76)),
    margin: round(clamp(field.document.margin + balance * 0.05, 0.08, 0.34)),
    lineGap: round(clamp(field.document.lineGap + (mode === 'vertical' ? 0.04 : 0.012), 0.12, 0.32)),
    phase: round((field.document.phase + sequence * 0.017 + 1) % 1),
    writing: mode === 'vertical' ? 'vertical' : 'horizontal'
  };
  next.tokens = layoutTokens(next.document, marks);
  next.memory = [...next.memory, event].slice(-MEMORY_LIMIT);
  next.pending = [];
  next.interaction = `compiled / ${mode}`;
  return { accepted: true, field: next, event };
}

function layoutTokens(document, marks) {
  const markMap = new Map(marks.map((mark) => [mark.index, mark]));
  return WORDS.map((text, index) => {
    const mark = markMap.get(index);
    const phase = document.revision * 0.31 + document.phase * 2.4 + index * 0.47;
    let x;
    let y;
    let rotation;
    if (document.mode === 'vertical') {
      x = -0.22 + (index % 3) * 0.2 + Math.sin(phase) * 0.035;
      y = (index - 5.5) * 0.105 + Math.cos(phase) * 0.02;
      rotation = 1.56 + Math.sin(phase) * 0.05;
    } else if (document.mode === 'hinge') {
      x = (index - 5.5) * 0.095 + Math.sin(phase) * 0.08;
      y = Math.sin(index * 0.72 + document.revision) * 0.18;
      rotation = Math.sin(phase) * 0.18;
    } else if (document.mode === 'spill') {
      x = ((index % 4) - 1.5) * 0.24 + Math.cos(phase) * 0.1;
      y = (Math.floor(index / 4) - 1) * 0.25 + Math.sin(phase * 0.8) * 0.12;
      rotation = (index % 2 ? -1 : 1) * 0.11 + Math.sin(phase) * 0.08;
    } else {
      x = ((index % 3) - 1) * 0.28 + Math.sin(phase) * 0.04;
      y = (Math.floor(index / 3) - 1.5) * 0.2 + Math.cos(phase) * 0.04;
      rotation = Math.sin(phase) * 0.1;
    }
    return {
      index,
      text,
      x: round(x + (mark?.side === 'outset' ? 0.06 : mark ? -0.06 : 0)),
      y: round(y + (mark ? mark.pressure * 0.03 : 0)),
      rotation: round(rotation),
      scale: round(0.9 + ((index + document.revision) % 4) * 0.035)
    };
  });
}

export function liftLatest(field) {
  if (!field.snapshots.length) return { ...structuredClone(field), interaction: 'lifted / exact' };
  return { ...structuredClone(field.snapshots.at(-1)), interaction: 'lifted / exact' };
}

export function releaseField() {
  return buildField();
}

export function buildTimeline() {
  const sequences = [
    [1, 6, 10],
    [8, 3, 11],
    [0, 5, 9],
    [2, 7, 4]
  ];
  let field = buildField();
  const timeline = [field];
  for (const sequence of sequences) {
    for (const index of sequence) field = markToken(field, index, 0.82, index % 2 ? 'outset' : 'inset');
    field = compileMargin(field).field;
    timeline.push(field);
  }
  return timeline;
}
