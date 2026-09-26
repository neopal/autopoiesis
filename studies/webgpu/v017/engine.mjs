export const SEED = 0x57473137;
export const STAGES = 17;
export const BANDS = 8;
export const SEGMENTS = 9;
export const SEGMENT_COUNT = BANDS * SEGMENTS;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 46;

const AUTO_CUES = [
  { band: 1, slot: 2, lag: 0.44 },
  { band: 5, slot: 6, lag: 0.72 },
  { band: 2, slot: 4, lag: 1.08 },
  { band: 6, slot: 1, lag: 1.36 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampInt = (value, min, max) => Math.round(clamp(Number.isFinite(Number(value)) ? Number(value) : min, min, max));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const copy = (value) => JSON.parse(JSON.stringify(value));
const segmentId = (band, slot) => band * SEGMENTS + slot;

const baseSegments = () => Array.from({ length: SEGMENT_COUNT }, (_, id) => {
  const homeBand = Math.floor(id / SEGMENTS);
  const homeSlot = id % SEGMENTS;
  return {
    id,
    homeBand,
    homeSlot,
    band: homeBand,
    slot: homeSlot,
    phase: (homeSlot - 4) * 0.06 + homeBand * 0.025,
    tension: 0,
    delay: 0,
    relay: 0
  };
});

const normalizeCue = (cue = {}, serial = 0) => {
  const band = clampInt(cue.band, 0, BANDS - 1);
  const slot = clampInt(cue.slot, 0, SEGMENTS - 1);
  const lag = clamp(finite(cue.lag, 0.8), 0.2, 1.6);
  const targetBand = Math.min(BANDS - 1, band + Math.max(1, Math.round(lag * 1.35)));
  const targetSlot = (slot + 2 + serial * 2) % SEGMENTS;
  return {
    mode: 'temporal-deferral',
    band,
    slot,
    lag,
    targetBand,
    targetSlot
  };
};

const normalizeEvent = (event = {}, serial = 0) => {
  const cue = normalizeCue(event.cue || event, serial);
  return {
    id: `turn-${serial}`,
    source: event.source || 'replayed-turn',
    mode: 'temporal-deferral',
    cue,
    segmentId: segmentId(cue.band, cue.slot)
  };
};

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const buildScore = (memory) => {
  const segments = baseSegments();
  const events = [];
  const removedSegments = [];
  const delayedSegments = [];

  memory.forEach((event, serial) => {
    const normalized = normalizeEvent(event, serial);
    const candidate = segments.find((segment) => segment.id === normalized.segmentId) || segments[serial % segments.length];
    const from = { band: candidate.band, slot: candidate.slot };
    const to = { band: normalized.cue.targetBand, slot: normalized.cue.targetSlot };

    candidate.band = to.band;
    candidate.slot = to.slot;
    candidate.delay = Number((normalized.cue.lag * (serial + 1)).toFixed(4));
    candidate.relay = serial + 1;
    candidate.phase += 0.12 + normalized.cue.lag * 0.08;
    candidate.tension += 0.4 + serial * 0.11;

    segments.forEach((segment) => {
      if (segment.id !== candidate.id && segment.band === from.band) {
        segment.phase += 0.012 + serial * 0.004;
        segment.tension += 0.08;
      }
      if (segment.id !== candidate.id && segment.band === to.band) {
        segment.phase -= 0.008;
        segment.tension += 0.05;
      }
    });

    const committed = {
      ...normalized,
      segmentId: candidate.id,
      from,
      to,
      cohort: `cohort-${candidate.homeBand}-${candidate.homeSlot}`
    };
    events.push(committed);
    removedSegments.push({ id: candidate.id, ...from });
    delayedSegments.push({ id: candidate.id, ...to, lag: normalized.cue.lag });
  });

  const occupancy = Array.from({ length: BANDS }, () => 0);
  segments.forEach((segment) => { occupancy[segment.band] += 1; });
  const signature = JSON.stringify(segments.map((segment) => [
    segment.id,
    segment.band,
    segment.slot,
    Number(segment.phase.toFixed(5)),
    Number(segment.tension.toFixed(5)),
    Number(segment.delay.toFixed(5)),
    segment.relay
  ]));

  return {
    segments,
    events,
    removedSegments,
    delayedSegments,
    occupancy,
    gapCount: memory.length,
    delayedCohorts: memory.length,
    signature
  };
};

export const buildFrame = (stage = 0, memory = []) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    score: buildScore(normalizedMemory),
    archive: normalizedMemory.map((event, index) => ({
      index,
      id: event.id,
      mode: event.mode,
      cue: copy(event.cue),
      segmentId: event.segmentId
    }))
  };
};

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const memory = AUTO_CUES.filter((_, index) => stage >= (index + 1) * 4 - 1)
    .map((cue, index) => ({ cue, source: 'auto-turn', index }));
  return buildFrame(stage, memory);
});

export const advanceTurn = (frame, cue = defaultCue()) => {
  if (frame.memory.length >= MEMORY_LIMIT) return frame;
  const event = normalizeEvent({ cue, source: 'visitor-turn' }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event]);
};

export const liftLatestTurn = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1));
export const releaseTurns = () => buildFrame(0, []);
export const defaultCue = () => copy(AUTO_CUES[0]);
export const geometrySignature = (frame) => JSON.stringify({
  score: frame.score.signature,
  removed: frame.score.removedSegments,
  delayed: frame.score.delayedSegments
});
