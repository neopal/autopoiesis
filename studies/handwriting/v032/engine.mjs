const BASE_GLYPHS = ['A', 'R', 'C', 'H', 'I', 'V', 'E', 'S', 'L', 'A', 'T', 'E'];
const BASE_LAYOUT = [
  [0.16, 0.2, -6, 1.14], [0.17, 0.43, 4, 0.88], [0.15, 0.67, -3, 1.02], [0.2, 0.87, 7, 0.78],
  [0.49, 0.14, 5, 0.92], [0.5, 0.36, -4, 1.2], [0.53, 0.59, 3, 0.84], [0.48, 0.82, -7, 1.04],
  [0.83, 0.23, 8, 0.96], [0.8, 0.47, -2, 1.08], [0.84, 0.7, 5, 0.9], [0.79, 0.9, -5, 1.16]
];

export const GLYPH_COUNT = BASE_GLYPHS.length;
export const CADENCE_LENGTH = 3;
export const MEMORY_WINDOW = 4;
export const MAX_CADENCE_SPAN = 1400;

const round = (value, digits = 5) => Number(value.toFixed(digits));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function makeGlyph(index) {
  const [x, y, rotation, scale] = BASE_LAYOUT[index];
  return {
    id: index,
    glyph: BASE_GLYPHS[index],
    x,
    y,
    rotation,
    scale,
    weight: 0.5,
    counter: 0,
    baselineShift: 0,
    blank: false,
    role: 'quiet',
    inheritedFrom: null
  };
}

function cloneGlyph(glyph) {
  return { ...glyph };
}

function cloneEvent(event) {
  return {
    ...event,
    cadence: [...event.cadence],
    intervals: [...event.intervals],
    roles: { ...event.roles }
  };
}

function cloneHistory(history) {
  return history.map(cloneEvent);
}

function refresh(frame) {
  frame.memory = frame.history.slice(-MEMORY_WINDOW).map(cloneEvent);
  frame.changedGlyphIds = frame.history.at(-1)?.changedGlyphIds ? [...frame.history.at(-1).changedGlyphIds] : [];
  return frame;
}

function cadenceTempo(intervals) {
  const firstGap = intervals[1] - intervals[0];
  const secondGap = intervals[2] - intervals[1];
  if (firstGap <= 0 || secondGap <= 0) return 'broken';
  if (Math.abs(secondGap - firstGap) <= 80) return 'even';
  return secondGap > firstGap ? 'rising' : 'falling';
}

function chooseRemoteIds(frame, cadence, serial, tempo) {
  const used = new Set(cadence);
  const candidates = Array.from({ length: GLYPH_COUNT }, (_, index) => index).filter((index) => !used.has(index));
  const tempoOffset = tempo === 'rising' ? 1 : tempo === 'falling' ? 2 : 0;
  const source = cadence[0];
  const receiver = candidates[(source * 3 + cadence[1] + serial + tempoOffset) % candidates.length];
  const remaining = candidates.filter((index) => index !== receiver);
  const gap = remaining[(cadence[2] + serial * 2 + tempoOffset) % remaining.length];
  const drift = remaining.find((index) => index !== gap) ?? remaining[0];
  return { receiver, gap, drift };
}

function applyCommitted(frame, cadence, intervals, serial) {
  const tempo = cadenceTempo(intervals);
  const roles = chooseRemoteIds(frame, cadence, serial, tempo);
  const source = frame.glyphs[cadence[0]];
  const receiver = frame.glyphs[roles.receiver];
  const gap = frame.glyphs[roles.gap];
  const drift = frame.glyphs[roles.drift];
  const pressure = 0.12 + (serial * 0.025);

  receiver.glyph = source.glyph;
  receiver.inheritedFrom = source.id;
  receiver.scale = round(clamp(receiver.scale + pressure, 0.66, 1.42));
  receiver.weight = round(clamp(receiver.weight + 0.12 + serial * 0.018, 0.34, 0.96));
  receiver.counter = round(clamp(receiver.counter + 0.28 + serial * 0.04, 0, 1));
  receiver.role = 'echo';

  gap.glyph = '';
  gap.blank = true;
  gap.counter = round(clamp(gap.counter + 0.35 + serial * 0.03, 0, 1));
  gap.scale = round(clamp(gap.scale - 0.04, 0.58, 1.3));
  gap.role = 'silence';

  drift.y = round(clamp(drift.y + (cadence[1] < cadence[2] ? 0.028 : -0.028) * (1 + serial * 0.1), 0.08, 0.93));
  drift.rotation = round(drift.rotation + (cadence[0] < cadence[2] ? 4 : -4) * (1 + serial * 0.08));
  drift.baselineShift = round(drift.baselineShift + 0.3 + serial * 0.04);
  drift.role = 'afterbeat';

  source.role = 'quiet';
  const event = {
    cadence: [...cadence],
    intervals: [...intervals],
    tempo,
    serial,
    roles,
    changedGlyphIds: [roles.receiver, roles.gap, roles.drift]
  };
  frame.history.push(event);
  frame.beats = [];
  frame.beatTimes = [];
  frame.lastEvent = 'cadence';
  return refresh(frame);
}

export function buildFrame(events = []) {
  const frame = {
    glyphs: Array.from({ length: GLYPH_COUNT }, (_, index) => makeGlyph(index)),
    beats: [],
    beatTimes: [],
    history: [],
    memory: [],
    changedGlyphIds: [],
    lastEvent: 'quiet'
  };
  refresh(frame);
  for (const rawEvent of events) {
    const event = Array.isArray(rawEvent) ? { cadence: rawEvent, intervals: [0, 1, 2] } : rawEvent;
    const cadence = event?.cadence;
    if (!Array.isArray(cadence) || cadence.length !== CADENCE_LENGTH || new Set(cadence).size !== CADENCE_LENGTH) continue;
    applyCommitted(frame, cadence, Array.isArray(event.intervals) ? event.intervals : [0, 1, 2], frame.history.length + 1);
  }
  frame.beats = [];
  frame.beatTimes = [];
  frame.lastEvent = events.length ? 'cadence' : 'quiet';
  return refresh(frame);
}

export function recordBeat(frame, glyphId, at = frame.beatTimes.at(-1) ?? 0) {
  if (!Number.isInteger(glyphId) || glyphId < 0 || glyphId >= GLYPH_COUNT || frame.beats.includes(glyphId) || frame.beats.length >= CADENCE_LENGTH) {
    return { ...frame, beats: [...frame.beats], beatTimes: [...frame.beatTimes], lastEvent: 'refused' };
  }
  return {
    ...frame,
    beats: [...frame.beats, glyphId],
    beatTimes: [...frame.beatTimes, Number.isFinite(at) ? at : 0],
    lastEvent: 'beating'
  };
}

export function commitCadence(frame) {
  if (frame.beats.length !== CADENCE_LENGTH || new Set(frame.beats).size !== CADENCE_LENGTH) {
    return { ...frame, beats: [], beatTimes: [], lastEvent: 'refused' };
  }
  const origin = frame.beatTimes[0] ?? 0;
  const intervals = frame.beatTimes.map((time) => round(time - origin, 4));
  if (intervals.length !== CADENCE_LENGTH || intervals.at(-1) > MAX_CADENCE_SPAN || cadenceTempo(intervals) === 'broken') {
    return { ...frame, beats: [], beatTimes: [], lastEvent: 'refused' };
  }
  const next = {
    ...frame,
    glyphs: frame.glyphs.map(cloneGlyph),
    history: cloneHistory(frame.history),
    beats: [...frame.beats],
    beatTimes: [...frame.beatTimes]
  };
  return applyCommitted(next, next.beats, intervals, next.history.length + 1);
}

export function liftLatestCadence(frame) {
  if (frame.history.length === 0) return { ...frame, beats: [], beatTimes: [], lastEvent: 'lifted' };
  const prior = buildFrame(frame.history.slice(0, -1));
  prior.lastEvent = 'lifted';
  return prior;
}

export function releaseCadence() {
  const frame = buildFrame([]);
  frame.lastEvent = 'released';
  return frame;
}

export function nearestGlyph(points, point, maxDistance) {
  let nearest = -1;
  let distance = Number.POSITIVE_INFINITY;
  for (const candidate of points) {
    const next = ((point.x - candidate.x) ** 2) + ((point.y - candidate.y) ** 2);
    if (next < distance) {
      distance = next;
      nearest = candidate.id;
    }
  }
  return distance <= maxDistance ** 2 ? nearest : -1;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    glyphs: frame.glyphs.map((glyph) => [
      glyph.id,
      glyph.glyph,
      round(glyph.x),
      round(glyph.y),
      round(glyph.rotation),
      round(glyph.scale),
      round(glyph.weight),
      round(glyph.counter),
      round(glyph.baselineShift),
      glyph.blank,
      glyph.role,
      glyph.inheritedFrom
    ])
  });
}
