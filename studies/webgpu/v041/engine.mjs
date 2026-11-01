export const SEED = 0x57475041;
export const APERTURE_COUNT = 13;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const HOLD_THRESHOLD_MS = 640;
export const MAX_HOLD_MS = 1800;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 19.173 + SEED * 0.000013) * 43758.5453;
  return raw - Math.floor(raw);
};

const anchors = [
  { x: 0.18, y: 0.16 }, { x: 0.39, y: 0.12 }, { x: 0.61, y: 0.15 },
  { x: 0.82, y: 0.24 }, { x: 0.79, y: 0.46 }, { x: 0.84, y: 0.72 },
  { x: 0.62, y: 0.85 }, { x: 0.4, y: 0.9 }, { x: 0.18, y: 0.8 },
  { x: 0.13, y: 0.58 }, { x: 0.2, y: 0.38 }, { x: 0.47, y: 0.3 },
  { x: 0.55, y: 0.66 }
];

const point = (value = {}, fallback = anchors[0]) => ({
  x: clamp(finite(value.x, fallback.x), 0, 1),
  y: clamp(finite(value.y, fallback.y), 0, 1)
});

const pointIndex = (value = {}) => {
  const candidate = point(value);
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  anchors.forEach((entry, index) => {
    const next = (candidate.x - entry.x) ** 2 + (candidate.y - entry.y) ** 2;
    if (next < distance) {
      nearest = index;
      distance = next;
    }
  });
  return nearest;
};

const baseApertures = () => anchors.map((anchor, id) => ({
  id,
  x: round(anchor.x),
  y: round(anchor.y),
  width: round(0.075 + pseudo(id + 11) * 0.055),
  height: round(0.095 + pseudo(id + 23) * 0.07),
  tilt: round((pseudo(id + 31) - 0.5) * 0.66),
  notch: round(0.12 + pseudo(id + 47) * 0.6),
  edge: round(0.22 + pseudo(id + 59) * 0.62),
  density: round(0.3 + pseudo(id + 71) * 0.58)
}));

const baseField = () => ({
  kind: 'pressure-fossil',
  apertures: baseApertures(),
  spine: { x: 0.5, width: 0.034, tension: 0 },
  remoteIndex: null,
  hardening: 0,
  strata: [],
  signature: ''
});

const cloneAperture = (aperture) => ({ ...aperture });

const receiverFor = (sourceIndex, serial) => {
  let receiver = wrap(sourceIndex * 5 + serial * 3 + 7, APERTURE_COUNT);
  if (receiver === sourceIndex) receiver = wrap(receiver + 4, APERTURE_COUNT);
  return receiver;
};

const normalizeEvent = (event = {}, serial = 0) => {
  const sourceIndex = integer(event.sourceIndex, pointIndex(event), 0, APERTURE_COUNT - 1);
  const durationMs = Math.round(clamp(finite(event.durationMs, HOLD_THRESHOLD_MS + 220), HOLD_THRESHOLD_MS, MAX_HOLD_MS));
  const hardness = round(clamp((durationMs - HOLD_THRESHOLD_MS) / (MAX_HOLD_MS - HOLD_THRESHOLD_MS), 0.08, 1));
  return {
    id: `fossil-hardening-${serial + 1}`,
    mode: 'fossil-hardening',
    sourceIndex,
    receiverIndex: receiverFor(sourceIndex, serial),
    durationMs,
    hardness,
    serial
  };
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const buildField = (memory) => {
  let field = baseField();
  const strata = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const previous = field.apertures.map(cloneAperture);
    const receiver = event.receiverIndex;
    const source = event.sourceIndex;
    const next = previous.map((aperture, index) => {
      if (index === source) return cloneAperture(aperture);
      const distance = Math.abs(index - receiver);
      const influence = Math.exp(-(distance * distance) / (3.2 + serial));
      const remote = index === receiver ? 1 : influence * 0.16;
      const sign = (serial + source) % 2 === 0 ? 1 : -1;
      return {
        ...aperture,
        x: round(clamp(aperture.x + sign * remote * event.hardness * 0.019, 0.08, 0.92)),
        y: round(clamp(aperture.y + remote * event.hardness * (serial % 2 ? -0.014 : 0.016), 0.08, 0.92)),
        width: round(clamp(aperture.width + remote * event.hardness * 0.038, 0.035, 0.2)),
        height: round(clamp(aperture.height + remote * event.hardness * (index === receiver ? 0.06 : 0.018), 0.04, 0.23)),
        tilt: round(aperture.tilt + sign * remote * event.hardness * 0.15),
        notch: round((aperture.notch + remote * event.hardness * (0.24 + pseudo(index + serial * 17) * 0.28)) % 1),
        edge: round(clamp(aperture.edge + remote * event.hardness * 0.12, 0.12, 1)),
        density: round(clamp(aperture.density + remote * event.hardness * 0.19, 0.15, 1))
      };
    });
    const spine = {
      x: round(clamp(field.spine.x + (source % 2 ? -1 : 1) * event.hardness * 0.012, 0.44, 0.56)),
      width: round(clamp(field.spine.width + event.hardness * 0.009, 0.018, 0.09)),
      tension: round(clamp(field.spine.tension + ((serial % 2 ? -1 : 1) * event.hardness * 0.17), -0.8, 0.8))
    };
    field = { ...field, apertures: next, spine, remoteIndex: receiver, hardening: round(Math.max(field.hardening, event.hardness)) };
    strata.push(`${source}>${receiver}:${event.durationMs}:${event.hardness.toFixed(3)}`);
  });
  field.strata = strata;
  field.signature = JSON.stringify({
    kind: field.kind,
    spine: field.spine,
    remoteIndex: field.remoteIndex,
    hardening: field.hardening,
    strata,
    apertures: field.apertures.map(({ id, x, y, width, height, tilt, notch, edge, density }) => ({ id, x, y, width, height, tilt, notch, edge, density }))
  });
  return field;
};

const normalizeGesture = (gesture) => {
  if (!gesture) return null;
  const startedAt = finite(gesture.startedAt, 0);
  const elapsedMs = Math.max(0, finite(gesture.elapsedMs, 0));
  return {
    x: clamp(finite(gesture.x, 0.5), 0, 1),
    y: clamp(finite(gesture.y, 0.5), 0, 1),
    sourceIndex: integer(gesture.sourceIndex, 0, 0, APERTURE_COUNT - 1),
    startedAt,
    elapsedMs
  };
};

export const buildFrame = (stage = 0, memory = [], gesture = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, 0, STAGES - 1),
    memory: normalizedMemory,
    gesture: normalizeGesture(gesture),
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const beginHold = (frame, input = {}) => {
  const sourceIndex = Number.isInteger(input.index) ? integer(input.index, 0, 0, APERTURE_COUNT - 1) : pointIndex(input);
  const nextPoint = point(input, anchors[sourceIndex]);
  const gesture = { x: nextPoint.x, y: nextPoint.y, sourceIndex, startedAt: finite(input.time, 0), elapsedMs: 0 };
  return { ...frame, gesture, lastAction: 'hold-started' };
};

export const updateHold = (frame, input = {}) => {
  if (!frame.gesture) return frame;
  const elapsedMs = Math.max(0, finite(input.time, frame.gesture.startedAt) - frame.gesture.startedAt);
  const nextPoint = point(input, frame.gesture);
  return {
    ...frame,
    gesture: { ...frame.gesture, x: nextPoint.x, y: nextPoint.y, elapsedMs },
    lastAction: elapsedMs >= HOLD_THRESHOLD_MS ? 'hold-armed' : 'hold-short'
  };
};

export const finishHold = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, gesture: null, lastAction: 'hold-refused-memory-limit' };
  if (!frame.gesture) return { ...frame, lastAction: 'hold-refused-missing' };
  const elapsedMs = Math.max(0, finite(input.time, frame.gesture.startedAt + frame.gesture.elapsedMs) - frame.gesture.startedAt);
  if (elapsedMs < HOLD_THRESHOLD_MS) return { ...frame, gesture: null, lastAction: 'hold-refused-short' };
  if (input.confirmed === false) return { ...frame, gesture: null, lastAction: 'hold-refused-unconfirmed' };
  const event = normalizeEvent({ sourceIndex: frame.gesture.sourceIndex, durationMs: elapsedMs }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'hold-committed');
};

export const liftLatestHold = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'hold-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultHold = (frame) => {
  const presets = [
    { x: 0.18, y: 0.16, durationMs: HOLD_THRESHOLD_MS + 180 },
    { x: 0.82, y: 0.46, durationMs: HOLD_THRESHOLD_MS + 460 },
    { x: 0.4, y: 0.9, durationMs: HOLD_THRESHOLD_MS + 720 },
    { x: 0.55, y: 0.66, durationMs: HOLD_THRESHOLD_MS + 920 }
  ];
  return presets[frame.memory.length % presets.length];
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    const preset = defaultHold(frame);
    frame = finishHold(beginHold(frame, { x: preset.x, y: preset.y, time: 0 }), { x: preset.x, y: preset.y, time: preset.durationMs, confirmed: true });
    timeline.push(buildFrame(stage, frame.memory, null, 'settled-fossil'));
  }
  return timeline;
};

export const geometrySignature = (frame) => frame.field.signature;
export const apertureAnchors = () => anchors.map((entry, id) => ({ id, ...entry }));
