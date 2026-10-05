export const SEED = 0x57473233;
export const STAGES = 21;
export const ROWS = 10;
export const COLUMNS = 14;
export const VERTEX_COUNT = ROWS * COLUMNS;
export const MEMORY_LIMIT = 3;
export const PRIMITIVE_BUDGET = 84;
export const SEQUENCE = ['A', 'C', 'B'];
export const TOKENS = ['A', 'B', 'C', 'D'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clampInt = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const wrap = (value, max) => ((value % max) + max) % max;
const copy = (value) => JSON.parse(JSON.stringify(value));
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};

const clampToken = (token) => {
  const value = String(token ?? '').trim().toUpperCase();
  return TOKENS.includes(value) ? value : null;
};

const normalizeDraft = (draft = []) => draft.map(clampToken).filter(Boolean).slice(-SEQUENCE.length);
const normalizeSequence = (sequence = SEQUENCE) => normalizeDraft(sequence).length === SEQUENCE.length
  ? normalizeDraft(sequence)
  : [...SEQUENCE];

const normalizeWitness = (raw = {}, serial = 0) => {
  const sequence = normalizeSequence(raw.sequence || raw.tokens);
  return {
    id: `witness-${serial}`,
    mode: 'membrane-witness',
    source: raw.source || 'replayed-witness',
    sequence,
    tokens: sequence,
    force: Number(clamp(finite(raw.force, 0.72), 0.24, 1).toFixed(5)),
    serial
  };
};

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeWitness(event, index));
const vertexId = (row, column) => row * COLUMNS + wrap(column, COLUMNS);

const baseVertices = () => Array.from({ length: VERTEX_COUNT }, (_, id) => {
  const row = Math.floor(id / COLUMNS);
  const column = id % COLUMNS;
  const u = (column / COLUMNS) * Math.PI * 2;
  const v = row / (ROWS - 1) * 2 - 1;
  const waviness = Math.sin(u * 3 + v * 2.4) * 0.035 + Math.cos(u * 5 - v) * 0.018;
  return {
    id,
    row,
    column,
    x: Number(((0.72 + v * 0.10 + waviness) * Math.cos(u)).toFixed(5)),
    y: Number(((0.48 + v * 0.055 + waviness) * Math.sin(u)).toFixed(5)),
    z: Number((0.20 * Math.sin(u * 2.0 + v * 0.7) + 0.06 * Math.cos(u * 5 - v * 2)).toFixed(5)),
    twist: 0,
    aperture: 0,
    phase: Number((pseudo(id + 17) * Math.PI * 2).toFixed(5))
  };
});

const baseTriangles = () => {
  const triangles = [];
  for (let row = 0; row < ROWS - 1; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const a = vertexId(row, column);
      const b = vertexId(row, column + 1);
      const c = vertexId(row + 1, column);
      const d = vertexId(row + 1, column + 1);
      triangles.push({ id: triangles.length, a, b, c, open: false, aperture: 0, phase: pseudo(triangles.length + 81) });
      triangles.push({ id: triangles.length, a: b, b: d, c, open: false, aperture: 0, phase: pseudo(triangles.length + 81) });
    }
  }
  return triangles;
};

const tokenHash = (tokens) => tokens.reduce((value, token, index) => value + token.charCodeAt(0) * (index + 3) * 17, 0);
const openTriangleWindow = (triangles, vertices, column, row, amount, serial, side) => {
  const opened = [];
  const safeRow = clampInt(row, 1, ROWS - 3);
  const safeColumn = wrap(column, COLUMNS);
  for (let rowOffset = 0; rowOffset < 2; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
      const block = (safeRow + rowOffset - 1) * COLUMNS + wrap(safeColumn + columnOffset, COLUMNS);
      const first = block * 2;
      for (const index of [first, first + 1]) {
        const triangle = triangles[index];
        if (!triangle) continue;
        triangle.open = true;
        triangle.aperture = Number(clamp(triangle.aperture + amount, 0, 1).toFixed(5));
        opened.push(triangle.id);
      }
    }
  }

  vertices.forEach((vertex) => {
    const columnDistance = Math.min(Math.abs(vertex.column - safeColumn), COLUMNS - Math.abs(vertex.column - safeColumn));
    const rowDistance = Math.abs(vertex.row - safeRow);
    const proximity = clamp(1 - (columnDistance * 0.22 + rowDistance * 0.18), 0, 1);
    if (proximity <= 0) return;
    const sign = side === 'local' ? 1 : -1;
    vertex.z = Number((vertex.z + sign * proximity * amount * 0.42).toFixed(5));
    vertex.twist = Number((vertex.twist + sign * proximity * (0.11 + amount * 0.32)).toFixed(5));
    vertex.aperture = Number(clamp(vertex.aperture + proximity * amount, 0, 1).toFixed(5));
  });
  return opened;
};

const buildSurface = (memory) => {
  const vertices = baseVertices();
  const triangles = baseTriangles();
  const apertures = [];
  const routeHistory = [];
  let residue = 0;

  memory.forEach((rawEvent, serial) => {
    const event = normalizeWitness(rawEvent, serial);
    const hash = tokenHash(event.sequence);
    const effective = event.force / (1 + residue * 0.24 + serial * 0.13);
    const localColumn = wrap(hash + Math.floor(residue * 3.1) + serial * 2, COLUMNS);
    const remoteColumn = wrap(localColumn + 5 + serial * 3 + Math.floor(residue), COLUMNS);
    const localRow = 2 + wrap(hash + serial, ROWS - 4);
    const remoteRow = 3 + wrap(hash * 2 + serial, ROWS - 5);
    const local = openTriangleWindow(triangles, vertices, localColumn, localRow, effective, serial, 'local');
    const remote = openTriangleWindow(triangles, vertices, remoteColumn, remoteRow, effective * 0.72, serial, 'remote');
    apertures.push({ serial, kind: 'local', sequence: event.sequence, column: localColumn, row: localRow, triangles: local });
    apertures.push({ serial, kind: 'remote', sequence: event.sequence, column: remoteColumn, row: remoteRow, triangles: remote });
    routeHistory.push(`${localColumn}>${remoteColumn}>${localRow}:${remoteRow}`);
    residue = Number((residue + 0.58 + effective * 0.88 + local.length * 0.008).toFixed(5));
  });

  const route = routeHistory.join('|') || 'quiet';
  const signature = JSON.stringify({
    route,
    residue: Number(residue.toFixed(5)),
    apertures: apertures.map(({ serial, kind, column, row, triangles }) => [serial, kind, column, row, triangles.length]),
    vertices: vertices.map((vertex) => [vertex.id, vertex.x, vertex.y, vertex.z, vertex.twist, vertex.aperture]),
    triangles: triangles.map((triangle) => [triangle.id, triangle.open, Number(triangle.aperture.toFixed(5))])
  });

  return { vertices, triangles, apertures, route, residue, signature };
};

export const buildFrame = (stage = 0, memory = [], draft = [], lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  const normalizedDraft = normalizeDraft(draft);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    draft: normalizedDraft,
    lastAction,
    surface: buildSurface(normalizedMemory),
    archive: normalizedMemory.map((event, index) => ({ index, id: event.id, mode: event.mode, sequence: event.sequence, force: event.force }))
  };
};

const AUTO_SEQUENCES = [
  ['A', 'C', 'B'],
  ['D', 'A', 'C'],
  ['B', 'D', 'A']
];

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const count = Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 7));
  const memory = AUTO_SEQUENCES.slice(0, count).map((sequence, serial) => normalizeWitness({ sequence, force: 0.72 - serial * 0.06 }, serial));
  return buildFrame(stage, memory);
});

export const pressToken = (frame, token) => {
  const value = clampToken(token);
  if (!value) return { ...frame, lastAction: 'token-refused' };
  const draft = [...frame.draft, value].slice(-SEQUENCE.length);
  return { ...frame, draft, lastAction: 'token-drafted' };
};

export const commitWitness = (frame) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, lastAction: 'memory-limit' };
  if (frame.draft.length < SEQUENCE.length) return { ...frame, lastAction: 'incomplete-witness' };
  const event = normalizeWitness({ sequence: frame.draft, source: 'visitor-witness' }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], [], 'witness-committed');
};

export const liftLatestWitness = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), [], 'witness-lifted');
export const releaseMembrane = () => buildFrame(0, [], [], 'membrane-released');
export const defaultWitness = () => copy(SEQUENCE);
export const geometrySignature = (frame) => JSON.stringify({ surface: frame.surface.signature, vertices: frame.surface.vertices, triangles: frame.surface.triangles, apertures: frame.surface.apertures });
