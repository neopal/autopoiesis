export const SLICE_COUNT = 31;
export const MEMORY_LIMIT = 4;
export const ARM_STREAK = 3;
export const STAGES = 13;

const SEED = 0x42523535;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function normalizeDirection(direction) {
  return Number(direction) >= 0 ? 1 : -1;
}

function normalizeEvent(event = {}) {
  const from = normalizeDirection(event.from);
  const to = normalizeDirection(event.to);
  return {
    kind: 'membrane-reversal',
    from,
    to: to === from ? -from : to,
    source: event.source || 'unknown',
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + from * 31 + to * 47)
  };
}

function baselineSlice(index) {
  const progress = index / (SLICE_COUNT - 1);
  const center = 0.50 + (seeded(index, 1) - 0.5) * 0.06 + Math.sin(progress * Math.PI * 1.7) * 0.028;
  const span = 0.30 + seeded(index, 2) * 0.09 + Math.sin(progress * Math.PI * 2.4 + 0.8) * 0.018;
  return {
    id: index,
    x: round(progress),
    top: round(clamp(center - span / 2, 0.08, 0.88)),
    bottom: round(clamp(center + span / 2, 0.12, 0.94)),
    lean: round((seeded(index, 3) - 0.5) * 0.035),
    void: 0,
    stain: 0,
    grain: round(0.35 + seeded(index, 4) * 0.65)
  };
}

function baseMembrane() {
  return Array.from({ length: SLICE_COUNT }, (_, index) => baselineSlice(index));
}

function eventField(event, eventIndex) {
  const normalized = normalizeEvent(event);
  return hash(normalized.field + eventIndex * 1459 + normalized.from * 211 + normalized.to * 317);
}

function bandWeight(index, pivot, width) {
  const distance = Math.abs(index - pivot);
  const wrapped = Math.min(distance, SLICE_COUNT - distance);
  return clamp(1 - wrapped / width, 0, 1);
}

function applyEvent(membrane, event, eventIndex) {
  const normalized = normalizeEvent(event);
  const field = eventField(normalized, eventIndex);
  const shearPivot = 4 + (field % (SLICE_COUNT - 8));
  const voidPivot = 5 + ((field >>> 8) % (SLICE_COUNT - 10));
  const stainPivot = 3 + ((field >>> 16) % (SLICE_COUNT - 6));
  const strength = 0.72 + ((field >>> 24) % 19) / 100;

  return membrane.map((slice, index) => {
    const shear = bandWeight(index, shearPivot, 7) * strength;
    const voidWeight = bandWeight(index, voidPivot, 4) * strength;
    const stainWeight = bandWeight(index, stainPivot, 5) * strength;
    const alternating = Math.sin((index + 1) * 0.67 + eventIndex * 1.71 + normalized.from * 0.8);
    const direction = normalized.to;
    const centerShift = direction * (0.014 * shear + 0.008 * alternating * voidWeight);
    const spanShift = direction * 0.024 * shear - 0.015 * voidWeight;
    return {
      ...slice,
      top: round(clamp(slice.top + centerShift - spanShift / 2, 0.04, 0.92)),
      bottom: round(clamp(slice.bottom + centerShift + spanShift / 2, 0.08, 0.98)),
      lean: round(slice.lean + direction * 0.018 * shear + alternating * 0.009 * stainWeight),
      void: round(clamp(slice.void + voidWeight, 0, 1.8)),
      stain: round(clamp(slice.stain + stainWeight, 0, 1.8))
    };
  });
}

function buildStrata(membrane, memory) {
  const strata = [];
  for (let layer = 0; layer < 5; layer += 1) {
    const points = membrane.map((slice, index) => ({
      x: round(slice.x),
      y: round(clamp(slice.top + 0.035 + layer * 0.045 + Math.sin(index * 0.43 + layer) * 0.009 + slice.lean * (layer + 1), 0.02, 0.98))
    }));
    strata.push({ id: layer, points });
  }
  return strata;
}

function buildFrameFrom(stage, memory, pending = { direction: 0, streak: 0 }, interaction = 'baseline') {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  let membrane = baseMembrane();
  boundedMemory.forEach((event, eventIndex) => {
    membrane = applyEvent(membrane, event, eventIndex);
  });
  return {
    grammar: 'reversal-membrane',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    pending: {
      direction: normalizeDirection(pending.direction || 1) * (pending.direction ? 1 : 0),
      streak: Math.max(0, Math.min(ARM_STREAK, Number(pending.streak) || 0))
    },
    membrane,
    strata: buildStrata(membrane, boundedMemory),
    shearedCount: membrane.filter((slice) => Math.abs(slice.lean) > 0.02 || slice.top !== baselineSlice(slice.id).top).length,
    voidCount: membrane.filter((slice) => slice.void > 0.04).length,
    stainedCount: membrane.filter((slice) => slice.stain > 0.04).length,
    event: boundedMemory.at(-1) || null,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function applyTick(frame, direction, source = 'visitor-scroll') {
  const nextDirection = normalizeDirection(direction);
  const current = frame.pending || { direction: 0, streak: 0 };
  if (!current.direction) {
    return buildFrameFrom(frame.stage, frame.memory, { direction: nextDirection, streak: 1 }, 'tension-held');
  }
  if (current.direction === nextDirection) {
    return buildFrameFrom(frame.stage, frame.memory, { direction: nextDirection, streak: current.streak + 1 }, current.streak + 1 >= ARM_STREAK ? 'tension-armed' : 'tension-held');
  }
  if (current.streak < ARM_STREAK) {
    return buildFrameFrom(frame.stage, frame.memory, { direction: nextDirection, streak: 1 }, 'tension-reset');
  }
  const event = {
    from: current.direction,
    to: nextDirection,
    source,
    field: hash(SEED + frame.memory.length * 7919 + current.direction * 113 + nextDirection * 127)
  };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], { direction: 0, streak: 0 }, 'reversal-committed');
}

export function nextControlSequence(index = 0) {
  const first = index % 2 === 0 ? 1 : -1;
  return [first, first, first, -first];
}

export function applyControlReversal(frame, index = 0) {
  return nextControlSequence(index).reduce((next, direction) => applyTick(next, direction, 'control-reversal'), frame);
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, { direction: 0, streak: 0 }, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), { direction: 0, streak: 0 }, 'lifted');
}

export function releaseMembrane() {
  return buildFrameFrom(0, [], { direction: 0, streak: 0 }, 'released');
}

export function buildTimeline(stageCount = STAGES) {
  let frame = buildFrame(0, []);
  const timeline = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    if (stage > 0 && stage % 3 === 0) frame = applyControlReversal(frame, stage / 3 - 1);
    frame = { ...frame, stage, interaction: stage === 0 ? 'baseline' : frame.interaction === 'reversal-committed' ? 'timeline' : frame.interaction };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    membrane: frame.membrane.map((slice) => ({ id: slice.id, top: slice.top, bottom: slice.bottom, lean: slice.lean, void: slice.void, stain: slice.stain })),
    strata: frame.strata
  });
}
