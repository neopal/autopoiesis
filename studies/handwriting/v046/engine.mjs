export const TOKEN_COUNT = 24;
export const SELECT_MIN = 3;
export const SELECT_MAX = 6;
export const MEMORY_LIMIT = 4;
export const STAGES = 4;
export const MODE = 'counterform-reflow';

const TOKEN_TEXT = [
  'L', 'A', 'N', 'G', 'U', 'A', 'G', 'E',
  '·', 'M', 'O', 'V', 'E', 'S', '·', 'W',
  'H', 'E', 'N', '·', 'H', 'E', 'L', 'D'
];
const BASE_POSITIONS = TOKEN_TEXT.map((_, id) => {
  const column = id % 3;
  const row = Math.floor(id / 3);
  return [0.28 + column * 0.22 + (row % 2 ? 0.012 : -0.008), 0.105 + row * 0.105];
});

const BASE_TOKENS = TOKEN_TEXT.map((glyph, id) => ({
  id,
  glyph,
  x: Number(BASE_POSITIONS[id][0].toFixed(5)),
  y: Number(BASE_POSITIONS[id][1].toFixed(5)),
  scale: Number((0.86 + (id % 4) * 0.055).toFixed(5)),
  angle: Number((((id % 2 ? -1 : 1) * (1.5 + (id % 3) * 1.4))).toFixed(5)),
  width: Number((0.82 + (id % 5) * 0.045).toFixed(5)),
  writingMode: 'horizontal-tb',
  role: 'quiet'
}));

const BASE_FIELD = {
  tokens: BASE_TOKENS,
  layout: 'letter-inventory',
  counterforms: [],
  voids: [],
  signature: ''
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(5));
const baseField = () => withSignature(clone(BASE_FIELD));

const withSignature = (field) => ({
  ...field,
  signature: JSON.stringify({
    layout: field.layout,
    counterforms: field.counterforms,
    voids: field.voids,
    tokens: field.tokens.map(({ id, glyph, x, y, scale, angle, width, writingMode, role }) => ({
      id, glyph, x, y, scale, angle, width, writingMode, role
    }))
  })
});

const makeFrame = (
  field,
  memory = [],
  pending = null,
  history = memory,
  serial = 0,
  lastEvent = 'quiet / letters under pressure',
  changedTokenIds = []
) => ({
  field: withSignature(field),
  memory,
  history,
  pending,
  serial,
  lastEvent,
  changedTokenIds
});

const normalizedRange = (input) => {
  const start = Number(input?.start);
  const end = Number(input?.end);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  const range = { start: Math.min(start, end), end: Math.max(start, end) };
  if (range.start < 0 || range.end >= TOKEN_COUNT) return null;
  if (range.end - range.start + 1 < SELECT_MIN || range.end - range.start + 1 > SELECT_MAX) return null;
  return range;
};

const rangesOverlap = (left, right) => left.start <= right.end && right.start <= left.end;

export const buildFrame = () => makeFrame(baseField());

export const selectRange = (frame, input) => {
  const range = normalizedRange(input);
  if (!range) return { ...frame, pending: null, lastEvent: 'refused short or unknown range', changedTokenIds: [] };
  if (frame.pending && frame.pending.start === range.start && frame.pending.end === range.end) {
    return { ...frame, lastEvent: 'refused repeated pending range', changedTokenIds: [] };
  }
  if ((frame.history ?? []).some((event) => rangesOverlap(event.range, range))) {
    return { ...frame, pending: null, lastEvent: 'refused occupied pressure range', changedTokenIds: [] };
  }
  return { ...frame, pending: range, lastEvent: 'range held as pressure', changedTokenIds: [] };
};

const applyEvent = (field, event) => {
  const next = clone(field);
  const counterforms = [...(field.counterforms ?? []), {
    start: event.range.start,
    end: event.range.end,
    serial: event.serial
  }];
  const cutById = new Map();
  counterforms.forEach((range, group) => {
    for (let id = range.start; id <= range.end; id += 1) cutById.set(id, { group, rank: id - range.start, count: range.end - range.start + 1 });
  });
  const survivors = BASE_TOKENS.filter((token) => !cutById.has(token.id));
  const sideCount = Math.ceil(survivors.length / 2);
  const changedTokenIds = [];
  next.voids = counterforms.map((range, group) => ({
    x: round(clamp(0.235 + group * 0.155, 0.12, 0.88)),
    y: round(0.21 + (group % 2) * 0.025),
    width: round(0.075 + (range.end - range.start + 1) * 0.006),
    height: round(0.55 + (group % 3) * 0.035),
    serial: range.serial
  }));

  next.tokens = BASE_TOKENS.map((baseToken) => {
    const cut = cutById.get(baseToken.id);
    changedTokenIds.push(baseToken.id);
    if (cut) {
      const groupSpan = Math.max(0.1, 0.72 / Math.max(1, cut.count - 1));
      const x = clamp(0.27 + cut.group * 0.155 + Math.sin((cut.rank + 1) * 1.7 + event.serial) * 0.012, 0.18, 0.82);
      const y = clamp(0.14 + cut.rank * groupSpan, 0.1, 0.9);
      return {
        ...baseToken,
        x: round(x),
        y: round(y),
        scale: round(clamp(0.72 + (cut.group % 2) * 0.045 + (cut.rank % 2) * 0.025, 0.62, 0.92)),
        angle: round((cut.group % 2 ? 90 : -90) + (cut.rank % 2 ? 4 : -4)),
        width: round(0.78 + (cut.rank % 3) * 0.045),
        writingMode: 'vertical-rl',
        role: 'pressure-fibre'
      };
    }
    const slot = survivors.findIndex((token) => token.id === baseToken.id);
    const side = slot % 2 === 0 ? 0 : 1;
    const row = Math.floor(slot / 2);
    const y = sideCount <= 1 ? 0.5 : 0.13 + row * (0.74 / Math.max(1, sideCount - 1));
    const x = side === 0 ? 0.10 + (row % 2) * 0.022 : 0.90 - (row % 2) * 0.022;
    return {
      ...baseToken,
      x: round(x),
      y: round(clamp(y + Math.sin((row + event.serial) * 0.8) * 0.012, 0.08, 0.92)),
      scale: round(clamp(0.78 + ((slot + event.serial) % 4) * 0.045, 0.62, 1.08)),
      angle: round((side === 0 ? -1 : 1) * (5 + ((row + event.serial) % 3) * 4)),
      width: round(0.8 + ((slot + event.serial) % 5) * 0.04),
      writingMode: 'horizontal-tb',
      role: 'repacked'
    };
  });
  next.layout = 'counterform-reflow';
  next.counterforms = counterforms;
  return { field: next, changedTokenIds };
};

const replay = (history) => {
  let field = baseField();
  let changedTokenIds = [];
  for (const event of history) {
    const applied = applyEvent(field, event);
    field = applied.field;
    changedTokenIds = applied.changedTokenIds;
  }
  return { field, changedTokenIds };
};

export const commitSelection = (frame) => {
  if (!frame.pending) return { ...frame, lastEvent: 'refused empty pressure cut', changedTokenIds: [] };
  const event = {
    type: 'counterform-cut',
    range: { ...frame.pending },
    serial: frame.serial + 1,
    mode: MODE
  };
  const history = [...(frame.history ?? frame.memory), event];
  const replayed = replay(history);
  return makeFrame(
    replayed.field,
    history.slice(-MEMORY_LIMIT),
    null,
    history,
    event.serial,
    `counterform ${event.range.start}–${event.range.end} / phrase reflowed`,
    replayed.changedTokenIds
  );
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest pressure cut' };
  const replayed = replay(history);
  return makeFrame(
    replayed.field,
    history.slice(-MEMORY_LIMIT),
    null,
    history,
    frame.serial,
    'lifted latest pressure cut',
    replayed.changedTokenIds
  );
};

export const releaseArchive = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });

export const buildTimeline = () => {
  const ranges = [{ start: 1, end: 4 }, { start: 7, end: 10 }, { start: 13, end: 16 }, { start: 19, end: 22 }];
  let frame = buildFrame();
  return ranges.map((range) => {
    frame = selectRange(frame, range);
    frame = commitSelection(frame);
    return frame;
  });
};
