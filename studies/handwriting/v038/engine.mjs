const BASE_WORDS = [
  'MARGIN',
  'THROAT',
  'LISTEN',
  'SILENCE',
  'RETURN',
  'VOWELS',
  'ELSEWHERE'
];

export const MEMORY_WINDOW = 4;
export const MIN_TOKEN_LENGTH = 3;
export const MAX_TOKEN_LENGTH = 3;

const POSITIONS = [
  { x: 0.09, y: 0.18, rotate: -4.8, scale: 1.08 },
  { x: 0.36, y: 0.11, rotate: 2.2, scale: 0.88 },
  { x: 0.58, y: 0.26, rotate: -1.6, scale: 1.17 },
  { x: 0.16, y: 0.48, rotate: 3.6, scale: 0.76 },
  { x: 0.43, y: 0.58, rotate: -2.8, scale: 1.02 },
  { x: 0.72, y: 0.54, rotate: 4.4, scale: 0.83 },
  { x: 0.28, y: 0.80, rotate: -1.2, scale: 0.92 }
];

const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hashToken = (token, serial = 0) => {
  let hash = 2166136261 ^ serial;
  for (const character of token) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
};
const normalizeToken = (token) => String(token ?? '').toUpperCase().replace(/[^A-Z]/g, '');
const replaceAt = (value, index, character) => `${value.slice(0, index)}${character}${value.slice(index + 1)}`;
const removeAt = (value, index) => `${value.slice(0, index)}·${value.slice(index + 1)}`;

const baseSlots = () => BASE_WORDS.map((text, index) => ({
  id: `slot-${index + 1}`,
  text,
  baseText: text,
  x: POSITIONS[index].x,
  y: POSITIONS[index].y,
  rotate: POSITIONS[index].rotate,
  scale: POSITIONS[index].scale,
  tracking: round(0.06 + (index % 3) * 0.018),
  notch: 0,
  echo: 0,
  weight: 1,
  quiet: false,
  remote: false
}));

const signatureFor = (slots) => JSON.stringify(slots.map((slot) => [
  slot.id,
  slot.text,
  round(slot.x),
  round(slot.y),
  round(slot.rotate),
  round(slot.scale),
  round(slot.tracking),
  round(slot.notch),
  round(slot.echo),
  round(slot.weight),
  slot.quiet,
  slot.remote
]));

const makeField = (slots) => ({ slots, signature: signatureFor(slots) });
const makeFrame = (slots, memory = [], pending = [], serial = 0, lastEvent = 'quiet', changedSlotIds = [], history = memory) => ({
  field: makeField(slots),
  memory,
  history,
  pending,
  serial,
  lastEvent,
  changedSlotIds
});

export const buildFrame = () => makeFrame(baseSlots());

export const beginToken = (frame, character) => {
  const token = normalizeToken(character).slice(0, 1);
  if (!token) return { ...frame, lastEvent: 'refused empty token' };
  return {
    ...frame,
    pending: [token],
    lastEvent: 'token armed',
    changedSlotIds: []
  };
};

export const appendToken = (frame, character) => {
  const token = normalizeToken(character).slice(0, 1);
  if (!token || frame.pending.length >= MAX_TOKEN_LENGTH) {
    return { ...frame, lastEvent: 'refused token length', changedSlotIds: [] };
  }
  return {
    ...frame,
    pending: [...frame.pending, token],
    lastEvent: 'token listening',
    changedSlotIds: []
  };
};

const pickDistinct = (start, used, length) => {
  let index = start % length;
  while (used.includes(index)) index = (index + 1) % length;
  return index;
};

const applyEvent = (slots, token, serial) => {
  const next = slots.map((slot) => ({ ...slot }));
  const hash = hashToken(token, serial);
  const sourceIndex = hash % next.length;
  const receiverIndex = pickDistinct(sourceIndex + 2 + serial, [sourceIndex], next.length);
  const echoIndex = pickDistinct(receiverIndex + 2 + (hash % 3), [sourceIndex, receiverIndex], next.length);
  const witnessIndex = pickDistinct(echoIndex + 2, [sourceIndex, receiverIndex, echoIndex], next.length);

  const receiver = next[receiverIndex];
  const echo = next[echoIndex];
  const witness = next[witnessIndex];
  const receiverPosition = hash % Math.max(1, receiver.text.length);
  const echoPosition = (hash >>> 4) % Math.max(1, echo.text.length);
  const witnessPosition = (hash >>> 8) % Math.max(1, witness.text.length);
  const glyph = token[(hash >>> 12) % token.length];

  receiver.text = replaceAt(receiver.text, receiverPosition, glyph);
  receiver.x = round(clamp(receiver.x + (serial % 2 ? -1 : 1) * (0.018 + (hash % 7) * 0.002), 0.04, 0.82));
  receiver.y = round(clamp(receiver.y + ((hash >>> 5) % 2 ? 1 : -1) * 0.012, 0.08, 0.86));
  receiver.rotate = round(receiver.rotate + (serial % 2 ? -1 : 1) * (1.8 + (hash % 5) * 0.4));
  receiver.tracking = round(clamp(receiver.tracking + 0.016 + serial * 0.003, 0.04, 0.18));
  receiver.notch = round(clamp(receiver.notch + 0.16 + serial * 0.015, 0, 0.94));
  receiver.weight = round(clamp(receiver.weight + 0.12, 0.78, 1.36));
  receiver.remote = true;

  echo.text = removeAt(echo.text, echoPosition);
  echo.scale = round(clamp(echo.scale - 0.045 - serial * 0.006, 0.62, 1.25));
  echo.rotate = round(echo.rotate + (hash % 2 ? 2.6 : -2.6));
  echo.echo = round(clamp(echo.echo + 0.22, 0, 1));
  echo.remote = true;

  witness.text = replaceAt(witness.text, witnessPosition, token[(hash >>> 16) % token.length]);
  witness.y = round(clamp(witness.y + 0.018 + serial * 0.004, 0.08, 0.88));
  witness.tracking = round(clamp(witness.tracking - 0.012, 0.03, 0.16));
  witness.notch = round(clamp(witness.notch + 0.08, 0, 0.94));
  witness.remote = true;

  return {
    slots: next,
    sourceId: next[sourceIndex].id,
    changedSlotIds: [receiver.id, echo.id, witness.id],
    route: `${next[sourceIndex].id}>${receiver.id}>${echo.id}>${witness.id}`
  };
};

const replay = (memory) => {
  let slots = baseSlots();
  let changedSlotIds = [];
  for (const event of memory) {
    const applied = applyEvent(slots, event.token, event.serial);
    slots = applied.slots;
    changedSlotIds = applied.changedSlotIds;
  }
  return { slots, changedSlotIds };
};

const decorateEvents = (events) => events.map((event) => {
  const applied = applyEvent(baseSlots(), event.token, event.serial);
  return { ...event, sourceId: applied.sourceId, changedSlotIds: applied.changedSlotIds, route: applied.route };
});

export const commitToken = (frame, explicitToken = frame.pending.join('')) => {
  const token = normalizeToken(explicitToken);
  if (token.length !== MIN_TOKEN_LENGTH || token.length !== MAX_TOKEN_LENGTH) {
    return { ...frame, pending: [], lastEvent: 'refused token length', changedSlotIds: [] };
  }
  const serial = frame.serial + 1;
  const history = [...(frame.history ?? frame.memory), { token, serial, mode: 'remote-ratification' }];
  const memory = history.slice(-MEMORY_WINDOW);
  const applied = replay(history);
  const events = decorateEvents(memory);
  return makeFrame(applied.slots, events, [], serial, 'ratified remotely', applied.changedSlotIds, history);
};

export const liftLatest = (frame) => {
  const history = (frame.history ?? frame.memory).slice(0, -1);
  if (!history.length) return { ...buildFrame(), serial: frame.serial, lastEvent: 'lifted latest' };
  const memory = history.slice(-MEMORY_WINDOW);
  const replayed = replay(history);
  const events = decorateEvents(memory);
  return makeFrame(replayed.slots, events, [], frame.serial, 'lifted latest', replayed.changedSlotIds, history);
};

export const release = () => buildFrame();
export const geometrySignature = (frame) => frame.field.signature;
export const stateSignature = (frame) => JSON.stringify({ geometry: geometrySignature(frame), memory: frame.memory, pending: frame.pending });
export const getFrame = (frame) => frame;
