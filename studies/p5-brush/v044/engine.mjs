export const MEMORY_LIMIT = 4;
export const STAGES = 9;
export const BAND_COUNT = 7;
export const THRESHOLD_COUNT = 5;

const SEED = 0x42523434;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(5));
const clampIndex = (value, count) => ((Math.floor(Number(value) || 0) % count) + count) % count;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0.02, 0.98)),
    y: round(clamp(Number(point.y) || 0, 0.06, 0.94))
  };
}

function normalizePath(path = []) {
  return path.map(normalizePoint).slice(0, 32);
}

function normalizeEvent(event = {}) {
  return {
    source: event.source || 'unknown',
    type: 'counterfield-etch',
    direction: event.direction === 'right-to-left' ? 'right-to-left' : 'left-to-right',
    mode: event.mode === 'powder' ? 'powder' : 'shear',
    pressure: round(clamp(Number(event.pressure) || 0.64, 0.2, 1)),
    thresholdCrossed: event.thresholdCrossed !== false,
    start: normalizePoint(event.start),
    end: normalizePoint(event.end),
    path: normalizePath(event.path),
    targetBand: clampIndex(event.targetBand, BAND_COUNT),
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + 101)
  };
}

function thresholdY(index) {
  return round(0.29 + index * 0.1 + Math.sin(index * 1.7 + 0.4) * 0.035);
}

function basePressureThresholds() {
  return Array.from({ length: THRESHOLD_COUNT }, (_, index) => ({
    id: index,
    x: round(0.22 + index * 0.14),
    y: thresholdY(index),
    width: round(0.022 + (index % 2) * 0.008),
    bias: index % 2 ? 'up' : 'down'
  }));
}

function baseStrata() {
  return Array.from({ length: BAND_COUNT }, (_, band) => {
    const top = [];
    const bottom = [];
    const baseY = 0.16 + band * 0.105;
    const thickness = 0.064 + (band % 3) * 0.009;
    for (let sample = 0; sample < 18; sample += 1) {
      const x = 0.075 + sample * (0.85 / 17);
      const wave = Math.sin(sample * 0.72 + band * 0.81) * 0.012 + (seeded(sample + band * 18, 2) - 0.5) * 0.018;
      const edge = Math.sin((x - 0.075) * Math.PI / 0.85) * (0.012 + band * 0.001);
      top.push({ x: round(x), y: round(baseY + wave + edge), weight: round(0.55 + seeded(sample + band * 21, 3) * 0.4) });
      bottom.push({ x: round(x), y: round(baseY + thickness + wave - edge), weight: round(0.5 + seeded(sample + band * 21, 4) * 0.45) });
    }
    return {
      id: band,
      top,
      bottom,
      tone: round(0.23 + band * 0.047),
      memory: 0
    };
  });
}

function baseBody() {
  return {
    strata: baseStrata(),
    pressureThresholds: basePressureThresholds(),
    cuts: [],
    deposits: []
  };
}

function clonePoint(point) {
  return { x: point.x, y: point.y };
}

function buildBody(memory) {
  const body = baseBody();
  for (const [eventIndex, rawEvent] of memory.entries()) {
    const event = normalizeEvent(rawEvent);
    const target = event.targetBand;
    const sign = event.direction === 'left-to-right' ? 1 : -1;
    const fieldStrength = 0.006 + event.pressure * 0.004;
    for (const stratum of body.strata) {
      const bandDistance = Math.abs(stratum.id - target);
      const influence = Math.max(0.08, 1 - bandDistance * 0.19);
      stratum.memory = round(stratum.memory + influence * event.pressure);
      for (const point of [...stratum.top, ...stratum.bottom]) {
        const proximity = Math.exp(-Math.pow((point.x - (0.45 + sign * 0.06)) / 0.22, 2));
        const lift = fieldStrength * influence * proximity * (stratum.id <= target ? 1 : -0.68);
        point.y = round(clamp(point.y + lift * (event.mode === 'shear' ? sign : -sign), 0.05, 0.95));
        if (event.mode === 'shear') point.x = round(clamp(point.x + sign * lift * 0.34, 0.03, 0.97));
      }
    }
    const cutBand = clampIndex(target + eventIndex + (event.mode === 'powder' ? 2 : 0), BAND_COUNT);
    const cutX = round(0.25 + ((event.field % 1000) / 1000) * 0.5);
    body.cuts.push({
      id: eventIndex,
      band: cutBand,
      x: cutX,
      y: round(0.16 + cutBand * 0.105),
      width: round(0.045 + event.pressure * 0.035),
      height: round(0.035 + event.pressure * 0.026),
      tilt: round(sign * (0.22 + eventIndex * 0.07)),
      depth: round(0.45 + event.pressure * 0.4)
    });
    const depositBand = clampIndex(target + 3 + eventIndex, BAND_COUNT);
    const depositX = round(0.2 + ((event.field >>> 8) % 1000) / 1000 * 0.6);
    body.deposits.push({
      id: eventIndex,
      band: depositBand,
      x: depositX,
      y: round(0.16 + depositBand * 0.105 + 0.04),
      width: round(0.05 + event.pressure * 0.04),
      height: round(0.012 + (event.mode === 'shear' ? 0.028 : 0.018)),
      tilt: round(-sign * (0.15 + eventIndex * 0.04)),
      mode: event.mode
    });
  }
  return body;
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  return {
    grammar: 'counterfield-etch',
    renderer: 'deterministic p5.js Canvas 2D pressure-field strata',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body: buildBody(boundedMemory),
    event: boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null,
    pending: {
      active: pending.active === true,
      side: pending.side || null,
      path: normalizePath(pending.path || []),
      thresholdCrossed: pending.thresholdCrossed === true,
      distance: round(Number(pending.distance) || 0)
    },
    state: { scrapeCount: boundedMemory.length, fieldPhase: boundedMemory.reduce((sum, event) => sum + event.pressure, 0) },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

function pendingFrame(frame, path, interaction = 'scrape-preview') {
  const nextPath = normalizePath(path);
  const previous = nextPath.at(-2) || nextPath[0] || { x: 0, y: 0 };
  const current = nextPath.at(-1) || previous;
  const segmentDistance = distance(previous, current);
  const crossed = nextPath.some((point, index) => {
    if (index === 0) return false;
    const prior = nextPath[index - 1];
    return (prior.x < 0.5 && point.x >= 0.5) || (prior.x > 0.5 && point.x <= 0.5);
  });
  return buildFrameFrom(frame.stage, frame.memory, interaction, {
    active: true,
    side: frame.pending.side,
    path: nextPath,
    thresholdCrossed: frame.pending.thresholdCrossed || crossed,
    distance: frame.pending.distance + segmentDistance
  });
}

export function beginScrape(frame, point) {
  const normalized = normalizePoint(point);
  const side = normalized.x <= 0.16 ? 'left' : normalized.x >= 0.84 ? 'right' : null;
  if (!side) return buildFrameFrom(frame.stage, frame.memory, 'scrape-refused-edge');
  return buildFrameFrom(frame.stage, frame.memory, 'scrape-armed', {
    active: true,
    side,
    path: [normalized],
    thresholdCrossed: false,
    distance: 0
  });
}

export function continueScrape(frame, point) {
  if (!frame.pending.active) return frame;
  return pendingFrame(frame, [...frame.pending.path, normalizePoint(point)]);
}

export function previewScrape(frame, point) {
  return continueScrape(frame, point);
}

function pathPressure(path) {
  if (path.length < 2) return 0.2;
  const total = path.slice(1).reduce((sum, point, index) => sum + distance(path[index], point), 0);
  const vertical = Math.abs(path.at(-1).y - path[0].y);
  return clamp(0.24 + total * 0.48 + vertical * 0.4, 0.2, 1);
}

function pathCrossesThreshold(path) {
  return path.some((point, index) => {
    if (index === 0) return false;
    const prior = path[index - 1];
    return prior.x < 0.5 && point.x >= 0.5 && Math.abs((prior.y + point.y) * 0.5 - 0.5) < 0.24;
  });
}

function createEvent(frame, path, source) {
  const normalizedPath = normalizePath(path);
  const pressure = pathPressure(normalizedPath);
  const mode = pressure >= 0.58 ? 'shear' : 'powder';
  const start = normalizedPath[0];
  const end = normalizedPath.at(-1);
  const targetBand = clampIndex(Math.floor((start.y * BAND_COUNT) + frame.memory.length), BAND_COUNT);
  return {
    source,
    type: 'counterfield-etch',
    direction: 'left-to-right',
    mode,
    pressure,
    thresholdCrossed: true,
    start,
    end,
    path: normalizedPath,
    targetBand,
    field: hash(SEED + frame.memory.length * 7919 + targetBand * 83 + Math.floor(pressure * 100))
  };
}

export function commitScrape(frame, point, source = 'visitor-scrape') {
  if (!frame.pending.active) return buildFrameFrom(frame.stage, frame.memory, 'scrape-refused-no-start');
  const path = normalizePath([...frame.pending.path, normalizePoint(point)]);
  const end = path.at(-1);
  if (frame.pending.side !== 'left') return buildFrameFrom(frame.stage, frame.memory, 'scrape-refused-direction', { ...frame.pending, path });
  if (end.x < 0.84 || !pathCrossesThreshold(path) || path.length < 2) {
    return buildFrameFrom(frame.stage, frame.memory, 'scrape-refused-incomplete', { ...frame.pending, path });
  }
  return applyScrape(frame, path, source);
}

export function applyScrape(frame, path, source = 'control-traverse') {
  const normalizedPath = normalizePath(path);
  const event = createEvent(frame, normalizedPath, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'scrape-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const paths = [
    [{ x: 0.08, y: 0.34 }, { x: 0.28, y: 0.38 }, { x: 0.51, y: 0.43 }, { x: 0.75, y: 0.48 }, { x: 0.92, y: 0.51 }],
    [{ x: 0.08, y: 0.49 }, { x: 0.3, y: 0.45 }, { x: 0.51, y: 0.5 }, { x: 0.74, y: 0.56 }, { x: 0.92, y: 0.6 }],
    [{ x: 0.08, y: 0.64 }, { x: 0.3, y: 0.59 }, { x: 0.52, y: 0.55 }, { x: 0.75, y: 0.5 }, { x: 0.92, y: 0.46 }],
    [{ x: 0.08, y: 0.77 }, { x: 0.3, y: 0.7 }, { x: 0.51, y: 0.62 }, { x: 0.75, y: 0.59 }, { x: 0.92, y: 0.64 }]
  ];
  let frame = buildFrame();
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    if (stage % 2 === 1) frame = applyScrape(frame, paths[(stage - 1) / 2], 'timeline-traverse');
    else frame = buildFrameFrom(stage, frame.memory, 'timeline');
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.body);
}
