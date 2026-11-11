const VIEWBOX = { width: 1200, height: 760 };

const PAIR_LAYOUT = [
  { index: 0, a: { x: 220, y: 408 }, b: { x: 328, y: 408 }, entry: { x: 274, y: 326 }, exit: { x: 274, y: 490 } },
  { index: 1, a: { x: 508, y: 204 }, b: { x: 614, y: 248 }, entry: { x: 486, y: 130 }, exit: { x: 636, y: 322 } },
  { index: 2, a: { x: 828, y: 364 }, b: { x: 936, y: 316 }, entry: { x: 882, y: 266 }, exit: { x: 882, y: 438 } },
  { index: 3, a: { x: 402, y: 612 }, b: { x: 510, y: 612 }, entry: { x: 456, y: 532 }, exit: { x: 456, y: 692 } }
];

const BASE_MARKS = PAIR_LAYOUT.flatMap((pair) => [
  { x: pair.a.x, y: pair.a.y, width: 56, height: 32, rotation: -16 },
  { x: pair.b.x, y: pair.b.y, width: 56, height: 32, rotation: 16 }
]);

export const VIEWBOX_SIZE = VIEWBOX;
export const PAIR_COUNT = PAIR_LAYOUT.length;
export const MARK_COUNT = BASE_MARKS.length;
export const MEMORY_WINDOW = 4;
export const CORRIDOR_WIDTH = 42;

const round = (value) => Math.round(value * 1000) / 1000;
const clampPair = (value) => Math.max(0, Math.min(PAIR_COUNT - 1, value));
const clampSide = (value) => (value < 0 ? -1 : 1);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const formatPoint = ({ x, y }) => `${round(x)} ${round(y)}`;

function normalizedEvent(event, index) {
  const pair = Number.isInteger(event?.pair) ? clampPair(event.pair) : index % PAIR_COUNT;
  const fromSide = event?.fromSide === 1 ? 1 : -1;
  const toSide = event?.toSide === -1 ? -1 : 1;
  return {
    type: 'gap-spent',
    pair,
    fromSide,
    toSide,
    direction: fromSide === -1 ? 1 : -1,
    order: Number.isInteger(event?.order) ? event.order : index + 1
  };
}

function normalizeMemory(memory) {
  if (!Array.isArray(memory)) return [];
  return memory.slice(-MEMORY_WINDOW).map(normalizedEvent);
}

function fieldDrift(memory) {
  return memory.reduce((drift, event) => ({
    x: drift.x + event.direction * (event.order * 2 + event.pair + 1),
    y: drift.y + event.direction * ((event.pair % 2 === 0 ? 1 : -1) * event.order)
  }), { x: 0, y: 0 });
}

function markSignature(mark) {
  return [mark.index, mark.x, mark.y, mark.width, mark.height, mark.rotation, mark.notchDepth, mark.notchSide].join(':');
}

function notchPathFor(mark) {
  if (!mark.notchDepth) return '';
  const inward = mark.index % 2 === 0 ? 1 : -1;
  const x = mark.x + inward * (mark.width / 2 - mark.notchDepth / 2);
  const y = mark.y;
  return `M ${round(x - mark.notchDepth / 2)} ${round(y - mark.height / 2 - 3)} L ${round(x + mark.notchDepth / 2)} ${round(y - mark.height / 2 - 3)} L ${round(x + mark.notchDepth / 2 - 7 * inward)} ${round(y + mark.height / 2 + 3)} L ${round(x - mark.notchDepth / 2 + 7 * inward)} ${round(y + mark.height / 2 + 3)} Z`;
}

function buildMarks(memory) {
  const drift = fieldDrift(memory);
  return BASE_MARKS.map((base, index) => {
    const pair = Math.floor(index / 2);
    const localEvent = [...memory].reverse().find((event) => event.pair === pair) ?? null;
    const side = index % 2 === 0 ? -1 : 1;
    const mark = {
      index,
      pair,
      x: round(base.x + drift.x * (index % 2 === 0 ? 0.42 : -0.28) + drift.y * side * 0.6),
      y: round(base.y + drift.y * (index % 2 === 0 ? 0.34 : -0.22) + drift.x * side * 0.18),
      width: base.width + (localEvent ? localEvent.order * 3 : 0),
      height: base.height + (localEvent ? localEvent.order * 2 : 0),
      rotation: round(base.rotation + drift.x * 0.08 + (localEvent ? localEvent.direction * 7 : 0)),
      notchDepth: localEvent ? 10 + localEvent.order * 7 : 0,
      notchSide: localEvent ? localEvent.direction : 0
    };
    mark.notchPath = notchPathFor(mark);
    mark.signature = markSignature(mark);
    return mark;
  });
}

function buildCuts(memory) {
  return memory.map((event) => {
    const layout = PAIR_LAYOUT[event.pair];
    const mid = { x: (layout.entry.x + layout.exit.x) / 2, y: (layout.entry.y + layout.exit.y) / 2 };
    const width = 12 + event.order * 5;
    const dx = layout.exit.x - layout.entry.x;
    const dy = layout.exit.y - layout.entry.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const half = 22 + event.order * 4;
    const points = [
      { x: mid.x - nx * width - dx / length * half, y: mid.y - ny * width - dy / length * half },
      { x: mid.x + nx * width - dx / length * half, y: mid.y + ny * width - dy / length * half },
      { x: mid.x + nx * width + dx / length * half, y: mid.y + ny * width + dy / length * half },
      { x: mid.x - nx * width + dx / length * half, y: mid.y - ny * width + dy / length * half }
    ];
    return {
      ...event,
      path: `M ${points.map(formatPoint).join(' L ')} Z`,
      signature: `${event.pair}:${event.order}:${event.direction}:${points.map(formatPoint).join('|')}`
    };
  });
}

function buildFrameFromMemory(memory, interaction = null, event = null) {
  const normalizedMemory = normalizeMemory(memory);
  const marks = buildMarks(normalizedMemory);
  const cuts = buildCuts(normalizedMemory);
  return {
    grammar: 'paired-gaps',
    marks,
    pairs: PAIR_LAYOUT.map((pair) => ({ ...pair })),
    cuts,
    memory: normalizedMemory,
    pending: null,
    interaction: interaction ?? (normalizedMemory.length ? 'settled' : 'quiet'),
    event,
    state: {
      cutCount: cuts.length,
      lastPair: normalizedMemory.at(-1)?.pair ?? null,
      lastDirection: normalizedMemory.at(-1)?.direction ?? null,
      openCorridors: PAIR_LAYOUT.map((pair) => pair.index).filter((index) => !normalizedMemory.some((item) => item.pair === index))
    }
  };
}

export function buildFrame(memory = []) {
  return buildFrameFromMemory(memory);
}

export function geometrySignature(frame) {
  return [...frame.marks.map((mark) => mark.signature), ...frame.cuts.map((cut) => cut.signature)].join('|');
}

export function markPoint(index) {
  if (!Number.isInteger(index) || index < 0 || index >= MARK_COUNT) return null;
  const mark = BASE_MARKS[index];
  return { x: mark.x, y: mark.y };
}

export function corridorPoint(pairIndex, side) {
  if (!Number.isInteger(pairIndex) || pairIndex < 0 || pairIndex >= PAIR_COUNT) return null;
  const layout = PAIR_LAYOUT[pairIndex];
  return side < 0 ? { ...layout.entry } : { ...layout.exit };
}

export function corridorAtPoint(frame, position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  for (const layout of PAIR_LAYOUT) {
    if (distance(position, layout.a) < 30 || distance(position, layout.b) < 30) continue;
    const dx = layout.exit.x - layout.entry.x;
    const dy = layout.exit.y - layout.entry.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const t = ((position.x - layout.entry.x) * dx + (position.y - layout.entry.y) * dy) / (length * length);
    const perpendicular = Math.abs((position.x - layout.entry.x) * dy - (position.y - layout.entry.y) * dx) / length;
    if (t >= 0 && t <= 1 && perpendicular <= CORRIDOR_WIDTH) return layout.index;
  }
  return null;
}

export function beginPass(frame, pairIndex, fromSide = -1) {
  if (!Number.isInteger(pairIndex) || pairIndex < 0 || pairIndex >= PAIR_COUNT) {
    return { ...frame, interaction: 'pass-refused-miss', event: { type: 'pass-refused-miss' } };
  }
  const side = clampSide(fromSide);
  return {
    ...frame,
    pending: { pair: pairIndex, fromSide: side, lastPoint: corridorPoint(pairIndex, side), crossed: false },
    interaction: 'pass-entered',
    event: null
  };
}

export function movePass(frame, position) {
  if (!frame.pending) return { ...frame, interaction: 'pass-refused-unarmed', event: { type: 'pass-refused-unarmed' } };
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return { ...frame, pending: null, interaction: 'pass-refused-invalid', event: { type: 'pass-refused-invalid' } };
  }
  if (frame.marks.some((mark) => distance(mark, position) < 32)) {
    return { ...frame, pending: null, interaction: 'pass-refused-mark', event: { type: 'pass-refused-mark' } };
  }
  const pair = corridorAtPoint(frame, position);
  if (pair !== frame.pending.pair) {
    return { ...frame, pending: null, interaction: 'pass-refused-outside', event: { type: 'pass-refused-outside' } };
  }
  const from = corridorPoint(pair, frame.pending.fromSide);
  const to = corridorPoint(pair, -frame.pending.fromSide);
  const crossed = frame.pending.crossed || distance(position, to) < distance(position, from);
  return {
    ...frame,
    pending: { ...frame.pending, lastPoint: { ...position }, crossed },
    interaction: crossed ? 'pass-crossed' : 'pass-entered',
    event: null
  };
}

export function commitPass(frame) {
  if (!frame.pending) return { ...frame, interaction: 'pass-refused-unarmed', event: { type: 'pass-refused-unarmed' } };
  const { pair, fromSide, crossed } = frame.pending;
  if (!crossed) {
    return { ...frame, pending: null, interaction: 'pass-refused-short', event: { type: 'pass-refused-short', pair } };
  }
  if (frame.memory.at(-1)?.pair === pair) {
    return { ...frame, pending: null, interaction: 'pass-refused-repeat', event: { type: 'pass-refused-repeat', pair } };
  }
  const event = { type: 'gap-spent', pair, fromSide, toSide: -fromSide, order: frame.memory.length + 1 };
  return buildFrameFromMemory([...frame.memory, event], 'pass-committed', event);
}

export function completePass(frame, pairIndex, fromSide = -1, toSide = 1) {
  const started = beginPass(frame, pairIndex, fromSide);
  if (toSide === fromSide) return { ...started, pending: null, interaction: 'pass-refused-same-side', event: { type: 'pass-refused-same-side', pair: pairIndex } };
  const crossed = movePass(started, corridorPoint(pairIndex, toSide));
  return commitPass(crossed);
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  for (let index = 0; index < MEMORY_WINDOW; index += 1) {
    timeline.push(completePass(timeline.at(-1), index, index % 2 === 0 ? -1 : 1, index % 2 === 0 ? 1 : -1));
  }
  return timeline;
}

export function liftLatest(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'lift-refused-empty', event: { type: 'lift-refused-empty' } };
  return buildFrameFromMemory(frame.memory.slice(0, -1), 'lifted', { type: 'lift-latest' });
}

export function releaseField() {
  return buildFrame();
}
