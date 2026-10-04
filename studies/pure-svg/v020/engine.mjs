export const SEED = 0x5356474a;
export const STAGES = 17;
export const PRIMITIVE_BUDGET = 9;
export const MEMORY_LIMIT = 4;
export const CLAUSE_COUNT = 6;

const AUTO_CLAUSES = [1, 4, 0, 5, 2, 3, 4, 1];
const CLAUSE_NAMES = ['shoulder', 'hinge', 'throat', 'heel', 'crown', 'tail'];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyMemory(memory) {
  return memory.map((event) => ({ ...event }));
}

function copyContour(contour) {
  return {
    ...contour,
    points: contour.points.map(copyPoint)
  };
}

function copyClause(clause) {
  return { ...clause };
}

function pointSignature(point) {
  return `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
}

function contourPathSignature(contour) {
  return contour.points.map(pointSignature).join('|');
}

function pocketSignature(pocket) {
  return `${pocket.sourceClause}:${pocket.points.map(pointSignature).join('|')}`;
}

function baseContour(stage) {
  const random = rng(SEED + stage * 877);
  const template = [
    [0.42, 0.12], [0.58, 0.14], [0.67, 0.24], [0.61, 0.35],
    [0.74, 0.47], [0.63, 0.57], [0.69, 0.75], [0.51, 0.88],
    [0.37, 0.76], [0.43, 0.60], [0.27, 0.52], [0.38, 0.40],
    [0.24, 0.26]
  ];
  const phase = stage * 0.013;
  return template.map(([x, y], index) => ({
    x: clamp(x + Math.sin(index * 1.7 + phase) * 0.006 + (random() - 0.5) * 0.008, 0.12, 0.86),
    y: clamp(y + Math.cos(index * 1.3 + phase) * 0.006 + (random() - 0.5) * 0.008, 0.08, 0.92)
  }));
}

function baseClauses() {
  return CLAUSE_NAMES.map((name, index) => ({
    index,
    name,
    role: 'quiet',
    weight: 0
  }));
}

function makePocket(clauseIndex, level) {
  const centers = [
    [0.38, 0.30], [0.57, 0.28], [0.48, 0.40],
    [0.56, 0.62], [0.42, 0.68], [0.60, 0.76]
  ];
  const [cx, cy] = centers[clauseIndex % centers.length];
  const width = 0.034 + level * 0.004;
  const height = 0.052 + level * 0.003;
  const lean = (clauseIndex % 2 ? 1 : -1) * (0.006 + level * 0.003);
  const points = [
    { x: cx - width, y: cy },
    { x: cx - width * 0.45 + lean, y: cy - height },
    { x: cx + width * 0.56, y: cy - height * 0.58 },
    { x: cx + width, y: cy + height * 0.14 },
    { x: cx + width * 0.18, y: cy + height },
    { x: cx - width * 0.72, y: cy + height * 0.55 }
  ];
  return { sourceClause: clauseIndex, level, points };
}

function makeConstraint(stage, memory, source = 'auto-constraint', requestedIndex = null) {
  const clauseIndex = Number.isInteger(requestedIndex)
    ? ((requestedIndex % CLAUSE_COUNT) + CLAUSE_COUNT) % CLAUSE_COUNT
    : (AUTO_CLAUSES[(memory.length + stage) % AUTO_CLAUSES.length] + memory.length) % CLAUSE_COUNT;
  return {
    kind: 'constraint',
    mode: 'contour-reply',
    source,
    stage,
    clauseIndex,
    ordinal: memory.length
  };
}

function applyMemory(points, clauses, memory) {
  const contour = points.map(copyPoint);
  const nextClauses = clauses.map(copyClause);
  const pockets = [];

  for (const [memoryIndex, event] of memory.entries()) {
    const clauseIndex = event.clauseIndex % CLAUSE_COUNT;
    const primaryIndex = (clauseIndex * 2 + 1) % contour.length;
    const remoteIndex = (primaryIndex + 5 + memoryIndex) % contour.length;
    const primary = contour[primaryIndex];
    const remote = contour[remoteIndex];
    const amount = 0.035 + memoryIndex * 0.008;
    const remoteAmount = 0.018 + memoryIndex * 0.006;

    primary.x += (0.5 - primary.x) * amount * 2.8;
    primary.y += (0.5 - primary.y) * amount;
    remote.x += (remote.x - 0.5) * remoteAmount;
    remote.y += (remote.y - 0.5) * remoteAmount * 1.6;

    nextClauses[clauseIndex].role = 'contour-reply';
    nextClauses[clauseIndex].weight = Number((amount + remoteAmount).toFixed(4));
    nextClauses[(clauseIndex + 2) % CLAUSE_COUNT].role = 'negative-pocket';
    pockets.push(makePocket(clauseIndex, memoryIndex));
  }

  return {
    contour: {
      points: contour,
      closed: true,
      pathSignature: contourPathSignature({ points: contour })
    },
    clauses: nextClauses,
    pockets
  };
}

function boundedStage(stage) {
  return clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
}

export function buildFrame(stage, memory = []) {
  const safeStage = boundedStage(stage);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const { contour, clauses, pockets } = applyMemory(baseContour(safeStage), baseClauses(), inherited);
  const latest = inherited.at(-1);
  const frame = {
    stage: safeStage,
    grammar: 'single-contour-constraint',
    contour,
    clauses,
    pockets,
    memory: inherited,
    ruleCursor: latest?.clauseIndex ?? null,
    constraintCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage % 2 === 1) {
      const constraint = makeConstraint(stage, memory, 'timeline-constraint');
      memory = [...memory, constraint].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function applyConstraint(frame, requestedIndex = null) {
  const constraint = makeConstraint(frame.stage, frame.memory, 'visitor-constraint', requestedIndex);
  const priorMemory = copyMemory(frame.memory.length >= MEMORY_LIMIT ? frame.memory.slice(0, -1) : frame.memory);
  const next = buildFrame(frame.stage, [...frame.memory, constraint].slice(-MEMORY_LIMIT));
  return { ...next, constraint, priorMemory, interaction: 'contour-reply' };
}

export function removeLatestConstraint(frame) {
  if (Array.isArray(frame.priorMemory)) return buildFrame(frame.stage, frame.priorMemory);
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseConstraint() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  if (!frame?.contour) return '';
  const contour = frame.contour.points.map(pointSignature).join('|');
  const pockets = (frame.pockets ?? []).map(pocketSignature).join('||');
  const clauses = (frame.clauses ?? []).map((clause) => `${clause.index}:${clause.role}:${clause.weight}`).join('|');
  return `${contour}::${pockets}::${clauses}`;
}
