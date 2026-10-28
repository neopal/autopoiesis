export const SEED = '0x48574936';
export const SLOT_COUNT = 15;
export const MEMORY_WINDOW = 4;
export const MODE = 'phoneme-ecology';

const TEXT = [
  'un', 'heard', 'margin', 'the', 'mouth', 'keeps', 'a', 'small',
  'weather', 'of', 'letters', 'near', 'the', 'quiet', 'edge'
];
const FAMILIES = ['vowel', 'fricative', 'pause', 'vowel', 'plosive', 'liquid', 'pause', 'fricative', 'liquid', 'vowel', 'plosive', 'pause', 'liquid', 'fricative', 'vowel'];
const INITIAL_LAYOUT = [
  { x: -0.78, y: -0.62, rotation: -0.18, size: 1.28, tracking: 0.08 },
  { x: -0.38, y: -0.72, rotation: 0.06, size: 0.94, tracking: -0.02 },
  { x: 0.08, y: -0.58, rotation: -0.08, size: 1.56, tracking: 0.12 },
  { x: 0.58, y: -0.68, rotation: 0.13, size: 0.82, tracking: 0.02 },
  { x: 0.82, y: -0.28, rotation: -0.18, size: 1.18, tracking: 0.1 },
  { x: 0.34, y: -0.18, rotation: 0.08, size: 0.88, tracking: -0.04 },
  { x: -0.16, y: -0.22, rotation: -0.12, size: 1.08, tracking: 0.02 },
  { x: -0.72, y: -0.16, rotation: 0.1, size: 0.78, tracking: -0.02 },
  { x: -0.82, y: 0.3, rotation: -0.08, size: 1.46, tracking: 0.06 },
  { x: -0.34, y: 0.38, rotation: 0.14, size: 0.9, tracking: 0.02 },
  { x: 0.14, y: 0.27, rotation: -0.04, size: 1.22, tracking: 0.09 },
  { x: 0.68, y: 0.3, rotation: 0.11, size: 0.82, tracking: -0.04 },
  { x: 0.8, y: 0.68, rotation: -0.13, size: 1.36, tracking: 0.06 },
  { x: 0.22, y: 0.7, rotation: 0.06, size: 0.9, tracking: -0.02 },
  { x: -0.38, y: 0.68, rotation: -0.1, size: 1.12, tracking: 0.04 }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(value * 10000) / 10000;
const cleanPhrase = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 16);

function baseSlots() {
  return INITIAL_LAYOUT.map((layout, id) => ({
    id,
    text: TEXT[id],
    family: FAMILIES[id],
    ...layout,
    opacity: 1,
    visible: true,
    role: 'settled',
    event: 0
  }));
}

function baselineFrame() {
  return {
    mode: MODE,
    slots: baseSlots(),
    history: [],
    memory: [],
    attention: Array.from({ length: SLOT_COUNT }, () => 0),
    active: null,
    draft: '',
    changedSlotIds: [],
    lastEvent: 'quiet'
  };
}

function leastHeard(frame) {
  return [...Array(SLOT_COUNT).keys()].sort((a, b) => frame.attention[a] - frame.attention[b] || a - b);
}

function mutateText(phrase, slotId, eventIndex) {
  const letters = phrase.toLowerCase().replace(/[^a-z]/g, '') || 'echo';
  const start = (slotId + eventIndex * 2) % letters.length;
  const span = Math.min(5, letters.length);
  return Array.from({ length: span }, (_, index) => letters[(start + index * 2) % letters.length]).join('');
}

function applySpeech(frame, event) {
  const slots = clone(frame.slots);
  const eventIndex = frame.history.length;
  const phrase = cleanPhrase(event.phrase);
  const order = leastHeard(frame);
  const receiver = event.receiver ?? order[0];
  const silence = event.silence ?? order.at(-1);
  const chorus = event.chorus ?? order.find((id) => id !== receiver && id !== silence) ?? ((receiver + 1) % SLOT_COUNT);
  const alphabetic = phrase.replace(/[^a-z]/gi, '').length;
  const stress = clamp((alphabetic + phrase.length) / 22, 0.18, 1);
  const direction = eventIndex % 2 === 0 ? 1 : -1;
  const receiverSlot = slots[receiver];
  const silenceSlot = slots[silence];
  const chorusSlot = slots[chorus];

  receiverSlot.text = mutateText(phrase, receiver, eventIndex);
  receiverSlot.x = round(clamp(receiverSlot.x + direction * (0.05 + stress * 0.08), -0.92, 0.92));
  receiverSlot.y = round(clamp(receiverSlot.y - (0.035 + stress * 0.05), -0.86, 0.86));
  receiverSlot.rotation = round(receiverSlot.rotation + direction * (0.08 + stress * 0.16));
  receiverSlot.size = round(clamp(receiverSlot.size * (1.05 + stress * 0.16), 0.55, 1.9));
  receiverSlot.tracking = round(receiverSlot.tracking + direction * (0.04 + stress * 0.07));
  receiverSlot.role = 'receiver';
  receiverSlot.event = eventIndex + 1;

  silenceSlot.visible = false;
  silenceSlot.opacity = round(clamp(silenceSlot.opacity - (0.22 + stress * 0.18), 0.18, 1));
  silenceSlot.x = round(clamp(silenceSlot.x - direction * 0.035, -0.92, 0.92));
  silenceSlot.role = 'silence';
  silenceSlot.event = eventIndex + 1;

  chorusSlot.visible = true;
  chorusSlot.text = mutateText(`${phrase}ae`, chorus + 1, eventIndex + 1);
  chorusSlot.x = round(clamp(chorusSlot.x - direction * (0.03 + stress * 0.04), -0.92, 0.92));
  chorusSlot.y = round(clamp(chorusSlot.y + direction * (0.03 + stress * 0.06), -0.86, 0.86));
  chorusSlot.rotation = round(chorusSlot.rotation - direction * (0.1 + stress * 0.09));
  chorusSlot.tracking = round(chorusSlot.tracking + 0.08 + stress * 0.04);
  chorusSlot.role = 'chorus';
  chorusSlot.event = eventIndex + 1;

  const history = [...frame.history, {
    phrase,
    receiver,
    silence,
    chorus,
    stress: round(stress),
    eventIndex
  }];
  const changedSlotIds = [receiver, silence, chorus].sort((a, b) => a - b);
  return {
    ...frame,
    slots,
    history,
    memory: history.slice(-MEMORY_WINDOW),
    draft: '',
    active: null,
    changedSlotIds,
    lastEvent: 'spoken'
  };
}

export function buildFrame(events = []) {
  let frame = baselineFrame();
  for (const event of events) {
    const phrase = typeof event === 'string' ? event : event.phrase;
    frame = applySpeech(frame, typeof event === 'string' ? { phrase } : event);
  }
  return frame;
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.slots.map(({ id, text, x, y, rotation, size, tracking, opacity, visible, role, event }) => ({ id, text, x, y, rotation, size, tracking, opacity, visible, role, event })));
}

export function attend(frame, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) return { ...frame, lastEvent: 'refused' };
  const attention = [...frame.attention];
  attention[slot] += 1;
  return { ...frame, attention, active: slot, lastEvent: 'attending' };
}

export function speak(frame, phrase) {
  return { ...frame, draft: cleanPhrase(phrase), lastEvent: 'drafting' };
}

export function commitSpeech(frame, phrase = frame.draft) {
  const cleaned = cleanPhrase(phrase);
  if (cleaned.replace(/[^a-z]/gi, '').length < 2) return { ...frame, lastEvent: 'refused' };
  return applySpeech({ ...frame, draft: cleaned }, { phrase: cleaned });
}

export function liftLatest(frame) {
  if (!frame.history.length) return { ...frame, lastEvent: 'refused' };
  return { ...buildFrame(frame.history.slice(0, -1)), lastEvent: 'lifted' };
}

export function release() {
  return baselineFrame();
}

export function geometryChanged(a, b) {
  return geometrySignature(a) !== geometrySignature(b);
}
