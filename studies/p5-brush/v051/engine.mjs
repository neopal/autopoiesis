export const PULSE_MIN_MS = 240;
export const PULSE_WINDOW_START = 0.34;
export const PULSE_WINDOW_END = 0.49;

const SEGMENT_COUNT = 12;
const SITE_COUNT = 4;
const MEMORY_LIMIT = 4;

const round = (value) => Number(value.toFixed(5));
const hash = (value) => {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
};
const seeded = (index, salt) => (hash(0x42523531 + index * 977 + salt * 389) >>> 0) / 4294967296;

function baseSegments() {
  return Array.from({ length: SEGMENT_COUNT }, (_, index) => ({
    id: index,
    angle: round(-Math.PI / 2 + index * Math.PI * 2 / SEGMENT_COUNT),
    inner: round(0.19 + seeded(index, 3) * 0.035),
    outer: round(0.48 + seeded(index, 5) * 0.08),
    width: round(0.22 + seeded(index, 7) * 0.055),
    skew: round((seeded(index, 11) - 0.5) * 0.22),
    grain: round(seeded(index, 13))
  }));
}

function baseBody() {
  return {
    segments: baseSegments(),
    pulseSites: Array.from({ length: SITE_COUNT }, (_, index) => ({
      id: index,
      angle: round(-Math.PI / 2 + index * Math.PI / 2),
      radius: 0.43
    })),
    core: { radius: 0.16, skew: 0, aperture: 0.12 }
  };
}

const circularDistance = (a, b) => {
  const distance = Math.abs(a - b);
  return Math.min(distance, SEGMENT_COUNT - distance);
};

function buildBody(memory) {
  const body = baseBody();
  for (const [eventIndex, event] of memory.entries()) {
    const anchor = event.site * 3;
    const direction = eventIndex % 2 === 0 ? 1 : -1;
    body.segments = body.segments.map((segment) => {
      const influence = Math.max(0, 1 - circularDistance(segment.id, anchor) / 3.2);
      const pressure = event.pressure * influence;
      return {
        ...segment,
        inner: round(segment.inner + pressure * 0.012),
        outer: round(segment.outer + direction * pressure * 0.045 + pressure * 0.014),
        width: round(Math.max(0.14, segment.width + pressure * 0.028)),
        skew: round(segment.skew + direction * pressure * 0.12)
      };
    });
    body.core = {
      radius: round(body.core.radius + direction * event.pressure * 0.009),
      skew: round(body.core.skew + direction * event.pressure * 0.045),
      aperture: round(Math.min(0.26, body.core.aperture + event.pressure * 0.018))
    };
  }
  return body;
}

function buildFrameFrom(memory, interaction = 'quiet', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT);
  return {
    grammar: 'phase-locked-material-ring',
    memory: boundedMemory,
    stage: boundedMemory.length + 1,
    body: buildBody(boundedMemory),
    pending: { active: false, site: null, elapsed: 0, phase: 0, ...pending },
    state: { pulseCount: boundedMemory.length },
    interaction
  };
}

export function buildFrame() {
  return buildFrameFrom([]);
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.body);
}

const PULSE_CYCLE_MS = 1000;

export function armPulse(frame, site) {
  const normalized = Number.isInteger(site) && site >= 0 && site < SITE_COUNT ? site : null;
  if (normalized === null) return buildFrameFrom(frame.memory, 'pulse-refused-site');
  return buildFrameFrom(frame.memory, 'pulse-armed', { active: true, site: normalized, elapsed: 0, phase: 0 });
}

export function tickPulse(frame, elapsed) {
  if (!frame.pending.active) return frame;
  const bounded = Math.max(0, Number(elapsed) || 0);
  return {
    ...frame,
    pending: {
      ...frame.pending,
      elapsed: bounded,
      phase: (bounded % PULSE_CYCLE_MS) / PULSE_CYCLE_MS
    },
    interaction: 'pulse-held'
  };
}

export function releasePulse(frame, source = 'visitor-pulse') {
  if (!frame.pending.active) return buildFrameFrom(frame.memory, 'pulse-refused-empty');
  if (frame.pending.elapsed < PULSE_MIN_MS) {
    return buildFrameFrom(frame.memory, 'pulse-refused-short');
  }
  if (frame.pending.phase < PULSE_WINDOW_START || frame.pending.phase > PULSE_WINDOW_END) {
    return buildFrameFrom(frame.memory, 'pulse-refused-phase');
  }
  const event = {
    type: 'phase-slip',
    source,
    site: frame.pending.site,
    elapsed: round(frame.pending.elapsed),
    phase: round(frame.pending.phase),
    pressure: round(0.72 + frame.memory.length * 0.06),
    layer: frame.memory.length
  };
  return buildFrameFrom([...frame.memory, event], 'pulse-committed');
}

export function applyPulse(frame, site = 0, elapsed = 420, source = 'control-pulse') {
  return releasePulse(tickPulse(armPulse(frame, site), elapsed), source);
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.memory, 'lift-refused');
  return buildFrameFrom(frame.memory.slice(0, -1), 'lifted');
}

export function releaseField() {
  return buildFrameFrom([], 'quiet');
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  for (const site of [0, 2, 1, 3]) timeline.push(applyPulse(timeline.at(-1), site));
  return timeline;
}
