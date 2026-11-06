export const MEMORY_LIMIT = 4;
export const FOLD_COUNT = 8;
export const STAGES = MEMORY_LIMIT + 1;
export const HOLD_THRESHOLD = 720;

const SEED = 0x42523439;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;
const normalizeSide = (side) => side === 'right' ? 'right' : side === 'left' ? 'left' : null;

function baseFolds() {
  return Array.from({ length: FOLD_COUNT }, (_, index) => ({
    id: index,
    y: round(0.12 + index * 0.103),
    x: round(0.48 + (seeded(index, 3) - 0.5) * 0.08),
    width: round(0.28 + seeded(index, 5) * 0.1),
    height: round(0.085 + seeded(index, 7) * 0.025),
    lean: round((seeded(index, 11) - 0.5) * 0.22),
    opening: round(0.16 + seeded(index, 13) * 0.22),
    crease: round(0.22 + seeded(index, 17) * 0.46),
    notch: round(0.14 + seeded(index, 19) * 0.36),
    grain: round(seeded(index, 23))
  }));
}

function baseBody() {
  return {
    folds: baseFolds(),
    pressureSites: [
      { id: 'left', x: 0.12, y: 0.5, radius: 0.095 },
      { id: 'right', x: 0.88, y: 0.5, radius: 0.095 }
    ],
    seams: Array.from({ length: 7 }, (_, index) => ({
      id: index,
      bend: round((seeded(index, 29) - 0.5) * 0.18),
      weight: round(0.34 + seeded(index, 31) * 0.48)
    })),
    faults: []
  };
}

function buildBody(memory) {
  const body = baseBody();
  for (const [eventIndex, event] of memory.entries()) {
    const fold = body.folds[event.layer];
    const direction = event.lead === 'left' ? 1 : -1;
    const parity = eventIndex % 2 ? -1 : 1;
    fold.x = round(fold.x + direction * event.intensity * 0.055);
    fold.width = round(clamp(fold.width + event.intensity * 0.024, 0.2, 0.48));
    fold.lean = round(fold.lean + parity * direction * event.intensity * 0.18);
    fold.opening = round(clamp(fold.opening + event.intensity * 0.22, 0.12, 0.72));
    fold.crease = round(clamp(fold.crease + event.intensity * 0.31, 0.15, 1.45));
    fold.notch = round(clamp(fold.notch + (1 - event.intensity) * 0.08 + eventIndex * 0.012, 0.12, 0.86));
    const seam = body.seams[event.layer % body.seams.length];
    seam.bend = round(seam.bend + direction * parity * event.intensity * 0.075);
    seam.weight = round(clamp(seam.weight + event.intensity * 0.1, 0.25, 1.2));
    body.faults.push({
      id: eventIndex,
      layer: event.layer,
      lead: event.lead,
      opening: fold.opening,
      crease: fold.crease,
      direction
    });
  }
  return body;
}

const defaultPending = () => ({ active: false, sides: [], holdMs: 0, lead: null });

function buildFrameFrom(stage, memory, interaction = 'quiet', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT);
  return {
    grammar: 'held-chord-fold-sheet',
    renderer: 'deterministic p5.js 1.11.3 Canvas 2D held-chord fold sheet',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body: buildBody(boundedMemory),
    event: boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null,
    pending: { ...defaultPending(), ...pending },
    state: { foldCount: boundedMemory.length },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.body);
}

export function pressureSite(frame, side) {
  const normalized = normalizeSide(side);
  return frame.body.pressureSites.find((site) => site.id === normalized) || null;
}

export function armChord(frame, side) {
  const normalized = normalizeSide(side);
  if (!normalized) return buildFrameFrom(frame.stage, frame.memory, 'chord-refused-side', frame.pending);
  const sides = frame.pending.active ? [...frame.pending.sides] : [];
  if (sides.includes(normalized)) return buildFrameFrom(frame.stage, frame.memory, 'chord-refused-repeat', frame.pending);
  if (sides.length >= 2) return buildFrameFrom(frame.stage, frame.memory, 'chord-refused-full', frame.pending);
  sides.push(normalized);
  return buildFrameFrom(frame.stage, frame.memory, 'chord-armed', {
    active: true,
    sides,
    lead: frame.pending.active ? frame.pending.lead : normalized,
    holdMs: frame.pending.active ? frame.pending.holdMs : 0
  });
}

export function holdChord(frame, holdMs) {
  if (!frame.pending.active) return frame;
  return buildFrameFrom(frame.stage, frame.memory, 'chord-holding', {
    ...frame.pending,
    holdMs: Math.max(0, Number(holdMs) || 0)
  });
}

function makeEvent(frame, source) {
  const lead = frame.pending.lead;
  return {
    type: 'held-chord-fold',
    source,
    lead,
    sides: [...frame.pending.sides],
    holdMs: Math.round(frame.pending.holdMs),
    layer: frame.memory.length,
    intensity: round(Math.min(1, 0.66 + frame.memory.length * 0.075 + (lead === 'right' ? 0.035 : 0)))
  };
}

function commitChord(frame, source) {
  const event = makeEvent(frame, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'chord-committed');
}

export function releaseChord(frame, source = 'visitor-chord') {
  if (!frame.pending.active) return buildFrameFrom(frame.stage, frame.memory, 'chord-refused-empty', frame.pending);
  if (frame.pending.sides.length < 2) return buildFrameFrom(frame.stage, frame.memory, 'chord-refused-incomplete', { ...frame.pending, active: false });
  if (frame.pending.holdMs < HOLD_THRESHOLD) return buildFrameFrom(frame.stage, frame.memory, 'chord-refused-short', { ...frame.pending, active: false });
  const expected = frame.memory.length % 2 === 0 ? 'left' : 'right';
  if (frame.pending.lead !== expected) return buildFrameFrom(frame.stage, frame.memory, 'chord-refused-alternation', { ...frame.pending, active: false });
  return commitChord(frame, source);
}

export function applyChord(frame, lead = 'left', holdMs = HOLD_THRESHOLD + 120, source = 'control-chord') {
  let next = armChord(frame, lead);
  next = armChord(next, lead === 'left' ? 'right' : 'left');
  next = holdChord(next, holdMs);
  return releaseChord(next, source);
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused', frame.pending);
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  const leads = ['left', 'right', 'left', 'right'];
  for (const lead of leads) timeline.push(applyChord(timeline.at(-1), lead, HOLD_THRESHOLD + 120, 'timeline-chord'));
  return timeline;
}
