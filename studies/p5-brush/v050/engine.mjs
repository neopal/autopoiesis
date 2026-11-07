export const MEMORY_LIMIT = 4;
export const RIB_COUNT = 11;
export const STAGES = MEMORY_LIMIT + 1;
export const ERASE_THRESHOLD = 0.62;

const SEED = 0x42523430;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;
const normalizeSite = (site) => Number.isInteger(site) && site >= 0 && site < 3 ? site : null;

function baseRibs() {
  return Array.from({ length: RIB_COUNT }, (_, index) => ({
    id: index,
    y: round(0.18 + index * 0.062),
    x: round(0.5 + (seeded(index, 3) - 0.5) * 0.07),
    width: round(0.5 + seeded(index, 5) * 0.16),
    height: round(0.045 + seeded(index, 7) * 0.025),
    lean: round((seeded(index, 11) - 0.5) * 0.2),
    notch: round(0.16 + seeded(index, 13) * 0.3),
    fold: round(0.24 + seeded(index, 17) * 0.55),
    grain: round(seeded(index, 19))
  }));
}

function baseBody() {
  return {
    ribs: baseRibs(),
    liftSites: [
      { id: 0, x: 0.26, y: 0.16, radius: 0.065, axis: 1 },
      { id: 1, x: 0.5, y: 0.13, radius: 0.065, axis: 1 },
      { id: 2, x: 0.74, y: 0.16, radius: 0.065, axis: 1 }
    ],
    cutouts: []
  };
}

function cutoutFor(event, index) {
  const side = event.site === 0 ? -1 : event.site === 2 ? 1 : 0;
  const x = 0.33 + event.site * 0.17 + side * index * 0.012;
  return {
    id: index,
    site: event.site,
    x: round(x),
    y: round(0.28 + ((index * 0.17 + event.site * 0.07) % 0.42)),
    width: round(0.095 + event.intensity * 0.035 + index * 0.006),
    height: round(0.07 + event.intensity * 0.022),
    lean: round((event.site - 1) * 0.18 + (index % 2 ? -0.08 : 0.06)),
    depth: round(0.2 + event.intensity * 0.55)
  };
}

function buildBody(memory) {
  const body = baseBody();
  for (const [eventIndex, event] of memory.entries()) {
    const lane = (event.site * 3 + eventIndex * 2 + 1) % RIB_COUNT;
    const direction = event.site === 0 ? -1 : event.site === 2 ? 1 : (eventIndex % 2 ? 1 : -1);
    for (const offset of [-1, 0, 1]) {
      const rib = body.ribs[(lane + offset + RIB_COUNT) % RIB_COUNT];
      const weight = offset === 0 ? 1 : 0.42;
      rib.x = round(rib.x + direction * event.intensity * 0.035 * weight);
      rib.width = round(clamp(rib.width - event.intensity * 0.05 * weight, 0.34, 0.72));
      rib.notch = round(clamp(rib.notch + event.intensity * (offset === 0 ? 0.3 : 0.12), 0.12, 0.9));
      rib.lean = round(rib.lean + direction * event.intensity * 0.08 * weight);
      rib.fold = round(clamp(rib.fold + event.intensity * 0.16 * weight, 0.12, 1.35));
    }
    body.cutouts.push(cutoutFor(event, eventIndex));
  }
  return body;
}

const defaultPending = () => ({ active: false, site: null, travel: 0, reversed: false });

function buildFrameFrom(stage, memory, interaction = 'quiet', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT);
  return {
    grammar: 'subtractive-closure-relief',
    renderer: 'deterministic p5.js 1.11.3 Canvas 2D subtractive closure relief',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body: buildBody(boundedMemory),
    event: boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null,
    pending: { ...defaultPending(), ...pending },
    state: { cutoutCount: boundedMemory.length },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.body);
}

export function liftSite(frame, site) {
  const normalized = normalizeSite(site);
  return frame.body.liftSites.find((entry) => entry.id === normalized) || null;
}

export function armErase(frame, site) {
  const normalized = normalizeSite(site);
  if (normalized === null) return buildFrameFrom(frame.stage, frame.memory, 'erase-refused-site', frame.pending);
  if (frame.pending.active) return buildFrameFrom(frame.stage, frame.memory, 'erase-refused-active', frame.pending);
  return buildFrameFrom(frame.stage, frame.memory, 'erase-armed', {
    active: true,
    site: normalized,
    travel: 0,
    reversed: false
  });
}

export function traceErase(frame, travel, reversed = false) {
  if (!frame.pending.active) return frame;
  return buildFrameFrom(frame.stage, frame.memory, 'erase-tracing', {
    ...frame.pending,
    travel: Math.max(0, Number(travel) || 0),
    reversed: Boolean(reversed)
  });
}

function makeEvent(frame, source) {
  return {
    type: 'subtractive-cut',
    source,
    site: frame.pending.site,
    travel: round(frame.pending.travel),
    reversed: true,
    layer: frame.memory.length,
    intensity: round(Math.min(1, 0.62 + frame.memory.length * 0.08 + frame.pending.travel * 0.12))
  };
}

function commitErase(frame, source) {
  const event = makeEvent(frame, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'erase-committed');
}

export function releaseErase(frame, source = 'visitor-lift') {
  if (!frame.pending.active) return buildFrameFrom(frame.stage, frame.memory, 'erase-refused-empty', frame.pending);
  if (frame.pending.travel < ERASE_THRESHOLD) return buildFrameFrom(frame.stage, frame.memory, 'erase-refused-short', { ...frame.pending, active: false });
  if (!frame.pending.reversed) return buildFrameFrom(frame.stage, frame.memory, 'erase-refused-direction', { ...frame.pending, active: false });
  return commitErase(frame, source);
}

export function applyErase(frame, site = 0, travel = ERASE_THRESHOLD + 0.12, source = 'control-erase') {
  let next = armErase(frame, site);
  next = traceErase(next, travel, true);
  return releaseErase(next, source);
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
  const sites = [0, 1, 2, 0];
  for (const site of sites) timeline.push(applyErase(timeline.at(-1), site, ERASE_THRESHOLD + 0.12, 'timeline-erase'));
  return timeline;
}
