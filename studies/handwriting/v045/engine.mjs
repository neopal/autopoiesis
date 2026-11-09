export const LETTER_COUNT = 16;
export const WITNESS_COUNT = 3;
export const MEMORY_LIMIT = 4;
export const STAGES = 4;
export const MODE = 'collective-reading-axis';

const TOKEN_TEXT = ['A', 'T', 'T', 'E', 'N', 'D', '·', 'T', 'H', 'E', '·', 'W', 'O', 'R', 'D', '·'];
const BASE_POSITIONS = [
  [0.18, 0.30], [0.30, 0.30], [0.42, 0.30], [0.54, 0.30], [0.66, 0.30], [0.78, 0.30],
  [0.23, 0.52], [0.39, 0.52], [0.55, 0.52], [0.71, 0.52], [0.82, 0.52],
  [0.24, 0.74], [0.38, 0.74], [0.52, 0.74], [0.66, 0.74], [0.78, 0.74]
];

const BASE_LETTERS = TOKEN_TEXT.map((glyph, id) => ({
  id,
  glyph,
  x: BASE_POSITIONS[id][0],
  y: BASE_POSITIONS[id][1],
  angle: Number((((id % 2 ? -1 : 1) * (2 + (id % 4) * 0.8))).toFixed(5)),
  scale: Number((0.88 + (id % 3) * 0.055).toFixed(5)),
  width: Number((0.82 + (id % 4) * 0.055).toFixed(5)),
  weight: id % 3 === 0 ? 'heavy' : id % 3 === 1 ? 'medium' : 'light',
  role: 'quiet'
}));

const BASE_FIELD = {
  letters: BASE_LETTERS,
  readingPath: BASE_LETTERS.map((letter) => letter.id),
  layout: 'stacked-phrase',
  axis: 'quiet',
  signature: ''
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(5));

const withFieldSignature = (field) => ({
  ...field,
  signature: JSON.stringify({
    letters: field.letters,
    readingPath: field.readingPath,
    layout: field.layout,
    axis: field.axis
  })
});

const makeFrame = (
  field,
  memory = [],
  pending = [],
  history = memory,
  serial = 0,
  lastEvent = 'quiet / phrase waiting',
  changedLetterIds = []
) => ({
  field: withFieldSignature(field),
  memory,
  history,
  pending,
  serial,
  lastEvent,
  changedLetterIds
});

const baseField = () => withFieldSignature(clone(BASE_FIELD));
const classifyAxis = (witnesses) => {
  if (witnesses[0] < witnesses[1] && witnesses[1] < witnesses[2]) return 'ascending-axis';
  if (witnesses[0] > witnesses[1] && witnesses[1] > witnesses[2]) return 'descending-axis';
  return 'hinged-axis';
};

const witnessCentroid = (witnesses) => witnesses.reduce((total, id) => {
  total.x += BASE_POSITIONS[id][0];
  total.y += BASE_POSITIONS[id][1];
  return total;
}, { x: 0, y: 0 });

const buildReadingPath = (field, witnesses, axis) => {
  const centroid = witnessCentroid(witnesses);
  centroid.x /= witnesses.length;
  centroid.y /= witnesses.length;
  const candidates = field.readingPath.filter((id) => !witnesses.includes(id));
  const direction = axis === 'descending-axis' ? -1 : 1;
  candidates.sort((left, right) => {
    const leftPosition = field.letters.find((letter) => letter.id === left);
    const rightPosition = field.letters.find((letter) => letter.id === right);
    const leftProjection = (leftPosition.x - centroid.x) * direction + (leftPosition.y - centroid.y) * 0.34;
    const rightProjection = (rightPosition.x - centroid.x) * direction + (rightPosition.y - centroid.y) * 0.34;
    return leftProjection - rightProjection || left - right;
  });
  return [...witnesses, ...candidates];
};

export const buildFrame = () => makeFrame(baseField());

export const attendLetter = (frame, input) => {
  const id = Number(input?.id);
  if (!Number.isInteger(id) || id < 0 || id >= LETTER_COUNT) {
    return { ...frame, lastEvent: 'refused unknown letter', changedLetterIds: [] };
  }
  if (frame.pending.includes(id)) {
    return { ...frame, lastEvent: 'refused repeated letter', changedLetterIds: [] };
  }
  if (frame.pending.length >= WITNESS_COUNT) {
    return { ...frame, lastEvent: 'refused full attention', changedLetterIds: [] };
  }
  return {
    ...frame,
    pending: [...frame.pending, id],
    lastEvent: 'letter held in attention',
    changedLetterIds: []
  };
};

const applyEvent = (field, event) => {
  const next = clone(field);
  const axis = event.axis;
  const path = buildReadingPath(field, event.witnesses, axis);
  const direction = axis === 'descending-axis' ? -1 : axis === 'ascending-axis' ? 1 : (event.serial % 2 ? -1 : 1);
  const witnessSet = new Set(event.witnesses);
  const phase = event.serial * 0.62 + event.witnesses[1] * 0.08;
  const changedLetterIds = [];
  const sourceById = new Map(field.letters.map((letter) => [letter.id, letter]));

  next.letters = path.map((id, slot) => {
    const source = sourceById.get(id);
    const t = slot / (LETTER_COUNT - 1);
    const wave = Math.sin(t * Math.PI * 2.1 + phase) * 0.115;
    const fold = Math.cos(t * Math.PI * 3 + phase * 0.7) * (axis === 'hinged-axis' ? 0.06 : 0.028);
    const lane = ((slot + event.serial) % 3 - 1) * 0.038;
    const x = clamp(0.11 + t * 0.78 + direction * wave * 0.42 + fold * 0.16, 0.065, 0.935);
    const y = clamp(0.49 + wave + lane + (axis === 'hinged-axis' ? fold : 0), 0.18, 0.82);
    const turn = direction * (8 + Math.sin((slot + event.serial) * 0.7) * 5) + fold * 42;
    const result = {
      ...source,
      x: round(x),
      y: round(y),
      angle: round(source.angle + turn),
      scale: round(clamp(source.scale + 0.035 * direction + (witnessSet.has(id) ? 0.08 : -0.012), 0.62, 1.34)),
      width: round(clamp(source.width + 0.05 * Math.sin(slot * 0.8 + phase) + (witnessSet.has(id) ? 0.08 : 0), 0.55, 1.24)),
      role: witnessSet.has(id) ? 'witness' : 're-ordered'
    };
    changedLetterIds.push(id);
    return result;
  });
  next.readingPath = path;
  next.layout = 'collective-axis';
  next.axis = axis;
  return { field: next, changedLetterIds };
};

const replay = (history) => {
  let field = baseField();
  let changedLetterIds = [];
  for (const event of history) {
    const applied = applyEvent(field, event);
    field = applied.field;
    changedLetterIds = applied.changedLetterIds;
  }
  return { field, changedLetterIds };
};

export const commitAttention = (frame) => {
  if (!frame.pending || frame.pending.length !== WITNESS_COUNT) {
    return { ...frame, pending: [], lastEvent: 'refused incomplete attention', changedLetterIds: [] };
  }
  const event = {
    type: 'attention-assembly',
    witnesses: [...frame.pending],
    axis: classifyAxis(frame.pending),
    serial: frame.serial + 1,
    mode: MODE
  };
  const history = [...(frame.history ?? frame.memory), event];
  const replayed = replay(history);
  return makeFrame(
    replayed.field,
    history.slice(-MEMORY_LIMIT),
    [],
    history,
    event.serial,
    `${event.axis} / phrase re-ordered`,
    replayed.changedLetterIds
  );
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest assembly' };
  const replayed = replay(history);
  return makeFrame(
    replayed.field,
    history.slice(-MEMORY_LIMIT),
    [],
    history,
    frame.serial,
    'lifted latest assembly',
    replayed.changedLetterIds
  );
};

export const releaseArchive = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });

export const buildTimeline = () => {
  const sequences = [[0, 6, 15], [14, 5, 9], [3, 11, 1], [13, 7, 2]];
  let frame = buildFrame();
  return sequences.map((ids) => {
    for (const id of ids) frame = attendLetter(frame, { id });
    frame = commitAttention(frame);
    return frame;
  });
};
