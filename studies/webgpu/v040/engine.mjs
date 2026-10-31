export const SEED = 0x57475040;
export const WITNESS_COUNT = 9;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const MIN_PRESSURE = 0.3;
export const MAX_PRESSURE = 0.96;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.731 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};

const witnesses = [
  { x: 0.18, y: 0.21 }, { x: 0.42, y: 0.16 }, { x: 0.72, y: 0.22 },
  { x: 0.82, y: 0.49 }, { x: 0.67, y: 0.78 }, { x: 0.41, y: 0.84 },
  { x: 0.15, y: 0.7 }, { x: 0.11, y: 0.45 }, { x: 0.49, y: 0.49 }
];

const point = (value = {}, fallback = witnesses[8]) => ({
  x: clamp(finite(value.x, fallback.x), 0, 1),
  y: clamp(finite(value.y, fallback.y), 0, 1)
});

const pointIndex = (value = {}) => {
  const candidate = point(value);
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  witnesses.forEach((entry, index) => {
    const distance = (candidate.x - entry.x) ** 2 + (candidate.y - entry.y) ** 2;
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
};

const baseBands = () => Array.from({ length: WITNESS_COUNT }, (_, id) => ({
  id,
  radius: round(0.16 + id * 0.047 + pseudo(id + 13) * 0.014),
  width: round(0.012 + pseudo(id + 27) * 0.015),
  depth: round(0.16 + id * 0.071 + pseudo(id + 41) * 0.1),
  twist: round((pseudo(id + 59) - 0.5) * 0.42),
  phase: round(pseudo(id + 71) * Math.PI * 2),
  aperture: round(0.42 + pseudo(id + 83) * 0.42),
  weight: round(0.4 + pseudo(id + 97) * 0.46),
  tone: round(pseudo(id + 109))
}));

const baseField = () => ({
  kind: 'depth-accord',
  bands: baseBands(),
  aperture: 0.58,
  shear: -0.08,
  horizon: 0.5,
  relays: [],
  depthOrder: Array.from({ length: WITNESS_COUNT }, (_, index) => index),
  signature: ''
});

const cloneBand = (band) => ({ ...band });

const chooseReceiver = (selected, serial) => {
  const blocked = new Set(selected);
  let candidate = wrap(selected[0] * 5 + selected[1] * 7 + selected[2] * 11 + serial * 13 + 4, WITNESS_COUNT);
  for (let attempt = 0; attempt < WITNESS_COUNT; attempt += 1) {
    if (!blocked.has(candidate)) return candidate;
    candidate = wrap(candidate + 2 + attempt, WITNESS_COUNT);
  }
  return witnesses.findIndex((_, index) => !blocked.has(index));
};

const normalizeEvent = (event = {}, serial = 0) => {
  const rawWitnesses = Array.isArray(event.witnesses) ? event.witnesses : [];
  const selected = [...new Set(rawWitnesses.map((value, index) => integer(value, (serial + index) % WITNESS_COUNT, 0, WITNESS_COUNT - 1)))];
  while (selected.length < 3) {
    const fallback = wrap(serial * 2 + selected.length * 3 + 1, WITNESS_COUNT);
    if (!selected.includes(fallback)) selected.push(fallback);
  }
  const witnessesForEvent = selected.slice(0, 3);
  const pressure = round(clamp(finite(event.pressure, 0.68), MIN_PRESSURE, MAX_PRESSURE));
  const polarity = finite(event.polarity, witnessesForEvent[0] + witnessesForEvent[2] >= witnessesForEvent[1] * 2 ? 1 : -1) >= 0 ? 1 : -1;
  return {
    id: `depth-accord-${serial + 1}`,
    mode: 'depth-accord',
    witnesses: witnessesForEvent,
    receiverIndex: chooseReceiver(witnessesForEvent, serial),
    pressure,
    polarity,
    serial
  };
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const buildField = (memory) => {
  let field = baseField();
  const relays = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const previous = field.bands.map(cloneBand);
    const selected = new Set(event.witnesses);
    const receiver = previous[event.receiverIndex];
    const nextBands = previous.map((band, index) => {
      if (selected.has(index)) return cloneBand(band);
      const distance = Math.abs(index - event.receiverIndex);
      const influence = Math.exp(-(distance * distance) / (2.2 + serial * 0.7));
      const remote = index === event.receiverIndex ? 1 : influence * 0.18;
      const ripple = Math.sin((band.id + 1) * 1.17 + serial * 1.8 + event.pressure * 4.3);
      return {
        ...band,
        radius: round(clamp(band.radius + remote * event.polarity * 0.008 + ripple * influence * 0.002, 0.1, 0.82)),
        width: round(clamp(band.width + remote * (0.006 + event.pressure * 0.008), 0.006, 0.052)),
        depth: round(clamp(band.depth + remote * event.polarity * (0.1 + event.pressure * 0.08) + ripple * influence * 0.025, 0.02, 1.16)),
        twist: round(band.twist + remote * event.polarity * 0.18 + ripple * influence * 0.035),
        phase: round(band.phase + remote * (0.38 + serial * 0.09) + ripple * influence * 0.06),
        aperture: round(clamp(band.aperture + remote * event.polarity * 0.13, 0.12, 0.98)),
        weight: round(clamp(band.weight + remote * event.pressure * 0.2, 0.16, 1)),
        tone: round((band.tone + remote * 0.13 + (ripple + 1) * 0.01) % 1)
      };
    });
    field = {
      ...field,
      bands: nextBands,
      depthOrder: nextBands
        .map((band) => band.id)
        .sort((a, b) => nextBands[b].depth - nextBands[a].depth),
      aperture: round(clamp(field.aperture + event.polarity * (0.065 + event.pressure * 0.045), 0.18, 0.94)),
      shear: round(clamp(field.shear + event.polarity * 0.055 + Math.sin(event.receiverIndex + serial) * 0.012, -0.44, 0.44)),
      horizon: round(clamp(field.horizon + event.polarity * 0.035 * (serial + 1), 0.28, 0.72))
    };
    relays.push(`${event.witnesses.join('-')}>${event.receiverIndex}:${event.pressure.toFixed(3)}:${event.polarity}`);
  });
  field.relays = relays;
  field.signature = JSON.stringify({
    relays,
    aperture: field.aperture,
    shear: field.shear,
    horizon: field.horizon,
    depthOrder: field.depthOrder,
    bands: field.bands.map(({ id, radius, width, depth, twist, phase, aperture, weight, tone }) => ({ id, radius, width, depth, twist, phase, aperture, weight, tone }))
  });
  return field;
};

const normalizeAttention = (attention) => {
  if (!attention) return null;
  const selected = [...new Set((attention.witnesses ?? []).map((value) => integer(value, 0, 0, WITNESS_COUNT - 1)))].slice(0, 3);
  return {
    witnesses: selected,
    points: selected.map((index) => point(attention.points?.[selected.indexOf(index)], witnesses[index])),
    current: point(attention.current, witnesses[selected.at(-1) ?? 8])
  };
};

export const buildFrame = (stage = 0, memory = [], attention = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, 0, STAGES - 1),
    memory: normalizedMemory,
    attention: normalizeAttention(attention),
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const beginWitness = (frame, input = {}) => {
  const index = Number.isInteger(input.index) ? integer(input.index, 0, 0, WITNESS_COUNT - 1) : pointIndex(input);
  const current = point(input, witnesses[index]);
  const existing = frame.attention?.witnesses ?? [];
  if (existing.includes(index)) return { ...frame, lastAction: 'witness-refused-repeat' };
  if (existing.length >= 3) return { ...frame, lastAction: 'witness-refused-full' };
  return {
    ...frame,
    attention: { witnesses: [...existing, index], points: [...(frame.attention?.points ?? []), current], current },
    lastAction: existing.length === 2 ? 'witness-third-held' : 'witness-held'
  };
};

export const aimWitness = (frame, input = {}) => {
  if (!frame.attention) return frame;
  return { ...frame, attention: { ...frame.attention, current: point(input, frame.attention.current) }, lastAction: 'witness-aimed' };
};

export const finishAccord = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, attention: null, lastAction: 'accord-refused-memory-limit' };
  if (!frame.attention || frame.attention.witnesses.length < 3) return { ...frame, attention: null, lastAction: 'accord-refused-incomplete' };
  if (input.confirmed === false) return { ...frame, attention: null, lastAction: 'accord-refused-unconfirmed' };
  const witnessesForEvent = frame.attention.witnesses.slice(0, 3);
  const event = normalizeEvent({
    witnesses: witnessesForEvent,
    pressure: input.pressure,
    polarity: input.polarity
  }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'accord-committed');
};

export const liftLatestAccord = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'accord-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultAccord = (frame) => {
  const presets = [
    [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 7]
  ];
  return { witnesses: presets[frame.memory.length % presets.length].map((index) => ({ ...witnesses[index] })), pressure: [0.62, 0.78, 0.53, 0.87][frame.memory.length % 4] };
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    const preset = defaultAccord(frame);
    let working = frame;
    preset.witnesses.forEach((entry) => { working = beginWitness(working, entry); });
    frame = finishAccord(working, { confirmed: true, pressure: preset.pressure });
    timeline.push(buildFrame(stage, frame.memory, null, 'settled-accord'));
  }
  return timeline;
};

export const geometrySignature = (frame) => frame.field.signature;
export const witnessPoints = () => witnesses.map((entry, id) => ({ id, ...entry }));
