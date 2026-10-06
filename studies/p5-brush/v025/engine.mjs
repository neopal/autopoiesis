export const SEED = 0x42525545;
export const STAGES = 16;
export const MEMORY_LIMIT = 3;
export const ROW_COUNT = 9;
export const COLUMN_COUNT = 17;
export const PRIMITIVE_BUDGET = 36;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function baseNodes(stage) {
  const random = rng(SEED + stage * 16007);
  return Array.from({ length: ROW_COUNT }, (_, row) => {
    const v = row / (ROW_COUNT - 1);
    const sag = Math.sin(v * Math.PI * 1.12 - 0.2) * 0.07;
    return Array.from({ length: COLUMN_COUNT }, (_, column) => {
      const u = column / (COLUMN_COUNT - 1);
      const arch = Math.sin(u * Math.PI * 1.08 + row * 0.19) * 0.035;
      return {
        row,
        column,
        x: u,
        y: clamp(0.08 + v * 0.84 + sag + (random() - 0.5) * 0.008, 0.03, 0.97),
        z: arch + (random() - 0.5) * 0.012,
        grain: 0.2 + random() * 0.8,
        fold: 0,
        load: 0
      };
    });
  });
}

const normalizeRow = (value) => clamp(Math.round(Number(value) || 0), 0, ROW_COUNT - 2);
const normalizeSide = (value) => value === 'right' ? 'right' : 'left';
const copyEvent = (event) => ({ ...event });

function applyEvent(nodes, event, eventIndex) {
  const row = normalizeRow(event.row);
  const side = normalizeSide(event.side);
  const direction = side === 'left' ? -1 : 1;
  const load = clamp(Number(event.load) || 0.5, 0.35, 1);
  return nodes.map((rowNodes, rowIndex) => rowNodes.map((node) => {
    const below = rowIndex > row ? clamp((rowIndex - row) / Math.max(1, ROW_COUNT - 1 - row), 0, 1) : 0;
    if (!below) return { ...node };
    const across = node.column / (COLUMN_COUNT - 1);
    const edgeBias = side === 'left' ? 1 - across : across;
    const crease = Math.sin((node.column + 1) * 0.72 + eventIndex * 1.37) * 0.018 * below * load;
    const fold = below * load * (0.12 + edgeBias * 0.16);
    return {
      ...node,
      x: clamp(node.x + direction * fold * 0.055 + crease * 0.35, 0.01, 0.99),
      y: clamp(node.y + below * (0.012 + edgeBias * 0.02) + crease * 0.22, 0.01, 0.99),
      z: node.z + direction * fold + crease,
      fold: clamp(node.fold + fold, 0, 1),
      load: clamp(node.load + below * load * (0.48 + edgeBias * 0.18), 0, 1)
    };
  }));
}

function makeEvent(frame, row, side, source = 'visitor-hinge') {
  return {
    id: `${source}-${frame.stage}-${frame.memory.length}-${row}-${side}`,
    stage: frame.stage,
    source,
    kind: 'weight-hinge',
    row: normalizeRow(row),
    side: normalizeSide(side),
    load: clamp(0.58 + frame.memory.length * 0.1, 0.58, 0.86),
    rule: 'lower-membrane-folds-through-depth'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let nodes = baseNodes(safeStage);
  inherited.forEach((event, index) => {
    nodes = applyEvent(nodes, event, index);
  });
  return {
    stage: safeStage,
    memory: inherited,
    grammar: 'hanging-membrane',
    nodes,
    hinges: inherited.map(({ row, side }) => ({ row, side })),
    primitiveBudget: PRIMITIVE_BUDGET,
    pending: null
  };
}

export function applyHinge(frame, row, side, source = 'visitor-hinge') {
  const baseline = buildFrame(frame.stage, frame.memory);
  const normalizedRow = normalizeRow(row);
  const normalizedSide = normalizeSide(side);
  const previous = baseline.memory.at(-1);
  if (previous && previous.row === normalizedRow && previous.side === normalizedSide) {
    return { ...baseline, interaction: 'hinge-refused' };
  }
  const event = makeEvent(baseline, normalizedRow, normalizedSide, source);
  const nextMemory = [...baseline.memory, event].slice(-MEMORY_LIMIT);
  return {
    ...buildFrame(baseline.stage, nextMemory),
    interaction: 'hinge-committed',
    restoreMemory: baseline.memory.map(copyEvent)
  };
}

export function liftLatestHinge(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'hinge-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'hinge-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'hinge-lifted' };
}

export function releaseHinges(frame) {
  return { ...buildFrame(0, []), interaction: 'field-released' };
}

function automaticHinge(stage) {
  const random = rng(SEED + stage * 3907);
  return {
    row: 1 + Math.floor(random() * (ROW_COUNT - 2)),
    side: random() < 0.5 ? 'left' : 'right'
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1) {
      const hinge = automaticHinge(stage);
      memory = [...memory, makeEvent(frame, hinge.row, hinge.side, 'autonomous-hinge')].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.nodes.map((row) => row.map(({ row: rowIndex, column, x, y, z, fold, load }) => ({
    row: rowIndex,
    column,
    x: Number(x.toFixed(7)),
    y: Number(y.toFixed(7)),
    z: Number(z.toFixed(7)),
    fold: Number(fold.toFixed(7)),
    load: Number(load.toFixed(7))
  }))));
}
