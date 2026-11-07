export const SEED = 0x57473046;
export const VOICE_COUNT = 27;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const BEAT_WINDOW_MS = 1800;
export const MIN_BEAT_INTERVAL_MS = 80;
export const IRREGULARITY_RATIO = 0.78;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value, fallback, min, max) => Math.round(clamp(finite(value, fallback), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 17.271 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizeIndex = (value, fallback = 0) => integer(value, fallback, 0, VOICE_COUNT - 1);
const cloneVoice = (voice) => ({ ...voice });
const cloneMemory = (memory) => memory.map((event) => ({ ...event, beats: [...event.beats], intervals: [...event.intervals] }));
const normalizeBeats = (beats, serial = 0) => {
  const fallback = [0, 220 + serial * 40, 760 + serial * 20];
  const values = Array.isArray(beats) ? beats : fallback;
  return values.slice(0, 3).map((value, index) => round(Math.max(0, finite(value, fallback[index]))));
};
const intervalsFor = (beats) => beats.length < 3 ? [] : [round(beats[1] - beats[0]), round(beats[2] - beats[1])];
const cadenceShapeFor = (intervals) => intervals[0] < intervals[1] ? 'late-break' : 'early-break';
const cadenceIsIrregular = (intervals) => {
  if (intervals.length !== 2 || intervals.some((interval) => interval < MIN_BEAT_INTERVAL_MS || interval > BEAT_WINDOW_MS)) return false;
  const ratio = Math.min(intervals[0], intervals[1]) / Math.max(intervals[0], intervals[1]);
  return ratio <= IRREGULARITY_RATIO;
};

const baseVoices = () => Array.from({ length: VOICE_COUNT }, (_, index) => {
  const t = index / (VOICE_COUNT - 1);
  const lane = index % 3;
  const laneOffset = (lane - 1) * 0.18;
  return {
    id: index,
    x: round((t - 0.5) * 2.72),
    y: round((t - 0.5) * -0.86 + laneOffset + Math.sin(t * Math.PI * 2.2 + lane) * 0.055),
    z: round(Math.sin(t * Math.PI * 1.35) * 0.18 + (lane - 1) * 0.095),
    width: round(0.18 + pseudo(index + 2) * 0.07),
    height: round(0.44 + pseudo(index + 19) * 0.22),
    fold: round((pseudo(index + 37) - 0.5) * 0.18),
    lean: round((pseudo(index + 61) - 0.5) * 0.2),
    opened: round(0.12 + pseudo(index + 83) * 0.2),
    crease: 0,
    phase: round(pseudo(index + 101) * Math.PI * 2),
    tone: round(pseudo(index + 127)),
    ink: 0
  };
});

const normalizeEvent = (event = {}, serial = 0) => {
  const beats = normalizeBeats(event.beats, serial);
  const intervals = intervalsFor(beats);
  return {
    id: `cadence-crease-${serial + 1}`,
    type: 'cadence-crease',
    beats,
    intervals,
    cadenceShape: event.cadenceShape ?? cadenceShapeFor(intervals),
    anchorIndex: normalizeIndex(event.anchorIndex, wrap(4 + serial * 7, VOICE_COUNT)),
    direction: finite(event.direction, serial % 2 === 0 ? 1 : -1) < 0 ? -1 : 1,
    serial,
    reason: event.reason ?? 'uneven-release'
  };
};

const cloneCreases = (creases) => creases.map((event) => ({ ...event, beats: [...event.beats], intervals: [...event.intervals] }));

const applyCrease = (voices, event) => voices.map((voice, index) => {
  const distance = Math.abs(index - event.anchorIndex);
  const wave = Math.exp(-distance / 4.8);
  const side = index < event.anchorIndex ? -1 : 1;
  const amplitude = 0.15 + event.serial * 0.025;
  const rhythm = event.cadenceShape === 'late-break' ? 1 : -1;
  const foldDelta = amplitude * (0.22 + wave * 0.88) * side * event.direction + amplitude * rhythm * 0.06;
  const leanDelta = amplitude * (0.18 + wave * 0.58) * event.direction * (index % 2 === 0 ? 1 : -1);
  const heightDelta = amplitude * (0.06 + wave * 0.24) * (0.58 + rhythm * 0.08);
  return {
    ...voice,
    fold: round(clamp(voice.fold + foldDelta, -1.3, 1.3)),
    lean: round(clamp(voice.lean + leanDelta, -1.2, 1.2)),
    height: round(clamp(voice.height + heightDelta, 0.22, 1.35)),
    opened: round(clamp(voice.opened + amplitude * (0.12 + (1 - wave) * 0.22), 0.06, 1)),
    crease: round(clamp(voice.crease + 0.2 + wave * 0.56, 0, 1)),
    ink: round(clamp(voice.ink + amplitude * (0.16 + wave * 0.32), 0, 1))
  };
});

const buildField = (memory) => {
  let voices = baseVoices();
  const creases = [];
  normalizeMemory(memory).forEach((event) => {
    voices = applyCrease(voices, event);
    creases.push({ ...event });
  });
  const field = {
    kind: 'folded-chorus',
    voices,
    creases,
    signature: ''
  };
  field.signature = JSON.stringify({ voices: field.voices, creases: field.creases });
  return field;
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : []).slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const frameFrom = (memory, lastAction = 'quiet', gesture = null, event = null) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'folded-chorus',
    renderer: 'deterministic p5.js 1.11.3 WEBGL folded ledger',
    stage: normalizedMemory.length,
    memory: normalizedMemory,
    field: buildField(normalizedMemory),
    gesture,
    event,
    lastAction
  };
};

export const buildFrame = (memory = []) => frameFrom(memory);
export const geometrySignature = (frame) => frame?.field?.signature ?? '';

export const beginCadence = (frame, point = {}) => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'cadence-refused-memory-limit');
  const time = finite(point.time, 0);
  const anchorIndex = normalizeIndex(point.index, wrap(4 + frame.memory.length * 7, VOICE_COUNT));
  const gesture = { beats: [time], anchorIndex, startedAt: time, updatedAt: time };
  return frameFrom(frame.memory, 'beat-armed', gesture);
};

export const recordBeat = (frame, point = {}) => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'cadence-refused-memory-limit');
  if (!frame.gesture) return beginCadence(frame, point);
  const time = finite(point.time, frame.gesture.updatedAt);
  if (time < frame.gesture.updatedAt + MIN_BEAT_INTERVAL_MS) return frame;
  const beats = [...frame.gesture.beats, time].slice(0, 3);
  const gesture = { ...frame.gesture, beats, updatedAt: time };
  if (beats.length < 3) return frameFrom(frame.memory, 'cadence-building', gesture);
  return finishCadence(frameFrom(frame.memory, 'cadence-ready', gesture), { confirmed: true });
};

export const cancelCadence = (frame) => frameFrom(frame?.memory ?? [], 'cadence-cancelled');

export const finishCadence = (frame, input = {}) => {
  if (!frame?.gesture) return frameFrom(frame?.memory ?? [], 'cadence-refused-no-gesture');
  const beats = normalizeBeats(input.beats ?? frame.gesture.beats, frame.memory.length);
  const intervals = intervalsFor(beats);
  if (!input.confirmed || beats.length !== 3) return frameFrom(frame.memory, 'cadence-refused-incomplete', null, { type: 'cadence-refused', beats, intervals });
  if (!cadenceIsIrregular(intervals)) return frameFrom(frame.memory, 'cadence-refused-regular', null, { type: 'cadence-refused', beats, intervals });
  return commitCadence(frame, beats, frame.gesture.anchorIndex, input.direction, input.reason ?? 'uneven-pointer-release');
};

export const commitCadence = (frame, beats, anchorIndex, direction = 1, reason = 'uneven-release') => {
  if (!frame || frame.memory.length >= MEMORY_LIMIT) return frameFrom(frame?.memory ?? [], 'cadence-refused-memory-limit');
  const event = normalizeEvent({ beats, anchorIndex, direction, reason }, frame.memory.length);
  return frameFrom([...frame.memory, event], 'cadence-committed', null, event);
};

export const defaultCadence = (frame) => {
  const serial = frame?.memory?.length ?? 0;
  const beats = serial % 2 === 0 ? [0, 220 + serial * 24, 760 + serial * 34] : [0, 620 + serial * 18, 820 + serial * 22];
  return { beats, anchorIndex: wrap(4 + serial * 7, VOICE_COUNT), direction: serial % 2 === 0 ? 1 : -1 };
};

export const commitDefaultCadence = (frame) => {
  const choice = defaultCadence(frame);
  return commitCadence(frame, choice.beats, choice.anchorIndex, choice.direction, 'default-cadence');
};

export const liftLatestCadence = (frame) => frameFrom((frame?.memory ?? []).slice(0, -1), 'cadence-lifted', null, { type: 'cadence-lifted' });
export const releaseArchive = () => frameFrom([], 'archive-released');

export const buildTimeline = () => {
  const timeline = [buildFrame()];
  for (let serial = 0; serial < MEMORY_LIMIT; serial += 1) {
    timeline.push(commitDefaultCadence(timeline.at(-1)));
  }
  return timeline;
};
