export const SEED = 0x42525544;
export const STAGES = 18;
export const MEMORY_LIMIT = 4;
export const SEGMENT_COUNT = 11;
export const PRIMITIVE_BUDGET = 44;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const wrapSegment = (value) => ((Math.round(Number(value) || 0) % SEGMENT_COUNT) + SEGMENT_COUNT) % SEGMENT_COUNT;
const copyEvent = (event) => ({ ...event });
const copySegment = (segment) => ({ ...segment });

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function baseSegments(stage) {
  const random = rng(SEED + stage * 13007);
  return Array.from({ length: SEGMENT_COUNT }, (_, index) => {
    const amount = index / (SEGMENT_COUNT - 1);
    const bow = Math.sin(amount * Math.PI * 1.18 + 0.36) * 0.105;
    const lift = Math.cos(amount * Math.PI * 2.2 - 0.4) * 0.035;
    return {
      id: index,
      x: clamp(0.105 + amount * 0.79 + (random() - 0.5) * 0.014, 0.04, 0.96),
      y: clamp(0.48 - bow + lift + (random() - 0.5) * 0.016, 0.18, 0.82),
      width: 0.092 + random() * 0.014,
      height: 0.31 + random() * 0.05,
      tilt: (random() - 0.5) * 0.22 + Math.cos(amount * Math.PI * 1.4) * 0.16,
      depth: 0.32 + random() * 0.62,
      grain: 0.18 + random() * 0.82,
      removed: false,
      cut: 0,
      stress: 0,
      endpoint: 0
    };
  });
}

function normalizePair(from, to) {
  return { from: wrapSegment(from), to: wrapSegment(to) };
}

function makeEvent(frame, pair, source = 'visitor-pair') {
  const normalized = normalizePair(pair.from, pair.to);
  return {
    id: `${source}-${frame.stage}-${frame.memory.length}-${normalized.from}-${normalized.to}`,
    stage: frame.stage,
    source,
    kind: 'reciprocal-span-removal',
    from: normalized.from,
    to: normalized.to,
    load: clamp(0.48 + frame.memory.length * 0.1, 0.48, 0.86),
    rule: 'endpoints-keep-middle-lifts'
  };
}

function between(from, to, index) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  return index > start && index < end;
}

function applyEvent(segments, event, eventIndex) {
  const { from, to } = normalizePair(event.from, event.to);
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const load = clamp(Number(event.load) || 0.5);
  return segments.map((segment, index) => {
    const interior = between(from, to, index);
    const leftEndpoint = index === from;
    const rightEndpoint = index === to;
    const downstream = index > end ? clamp(1 - (index - end) / (SEGMENT_COUNT - end + 0.5), 0, 1) : 0;
    const upstream = index < start ? clamp(1 - (start - index) / (start + 0.5), 0, 1) : 0;
    const inherited = Math.sin((index + 1) * 1.41 + eventIndex * 0.83) * load * 0.018;

    if (interior) {
      return {
        ...segment,
        x: clamp(segment.x + Math.sin(index * 1.7 + eventIndex) * 0.014, 0.03, 0.97),
        y: clamp(segment.y + inherited, 0.12, 0.88),
        width: 0,
        height: 0,
        removed: true,
        cut: clamp(segment.cut + 0.72 + load * 0.18, 0, 1),
        stress: clamp(segment.stress + load * 0.54, 0, 1),
        endpoint: 0
      };
    }

    const endpoint = leftEndpoint || rightEndpoint;
    const sign = leftEndpoint ? -1 : rightEndpoint ? 1 : 0;
    return {
      ...segment,
      x: clamp(segment.x + sign * load * 0.025 + downstream * load * 0.018 - upstream * load * 0.008, 0.03, 0.97),
      y: clamp(segment.y + sign * load * 0.046 + downstream * inherited - upstream * load * 0.012, 0.1, 0.9),
      width: clamp(segment.width * (endpoint ? 0.86 : 1 + downstream * load * 0.035), 0.045, 0.18),
      height: clamp(segment.height * (endpoint ? 1.08 : 1 + upstream * load * 0.02), 0.12, 0.48),
      tilt: segment.tilt + sign * (0.24 + load * 0.22) + downstream * load * 0.12 - upstream * load * 0.02,
      depth: clamp(segment.depth + (endpoint ? 0.16 : downstream * load * 0.12) - upstream * load * 0.035, 0.08, 1),
      cut: clamp(segment.cut + (endpoint ? 0.32 : 0), 0, 1),
      stress: clamp(segment.stress + (endpoint ? 0.42 : downstream * load * 0.2), 0, 1),
      endpoint: endpoint ? 1 : 0
    };
  });
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  let segments = baseSegments(safeStage);
  inherited.forEach((event, index) => {
    segments = applyEvent(segments, event, index);
  });
  return {
    stage: safeStage,
    memory: inherited,
    segments,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'pigment-span-bridge',
    pendingAnchor: null
  };
}

function automaticPair(stage) {
  const random = rng(SEED + stage * 3907);
  const from = 1 + Math.floor(random() * 4);
  const span = 4 + Math.floor(random() * 4);
  return { from, to: Math.min(SEGMENT_COUNT - 1, from + span) };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1) {
      const pair = automaticPair(stage);
      const event = makeEvent(frame, pair, 'autonomous-pair');
      memory = [...memory, event].slice(-MEMORY_LIMIT);
    }
    return frame;
  });
}

export function armPair(frame, anchor) {
  const baseline = buildFrame(frame.stage, frame.memory);
  return { ...baseline, pendingAnchor: wrapSegment(anchor), interaction: 'pair-armed' };
}

export function completePair(frame, target) {
  if (frame.pendingAnchor === null || frame.pendingAnchor === undefined) {
    return { ...frame, interaction: 'pair-refused' };
  }
  return applyPair(frame, {
    from: frame.pendingAnchor,
    to: target,
    source: 'visitor-pair'
  });
}

export function applyPair(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const pair = normalizePair(input.from, input.to);
  if (pair.from === pair.to) return { ...baseline, interaction: 'pair-refused' };
  const previous = baseline.memory.at(-1);
  if (previous && previous.from === pair.from && previous.to === pair.to) {
    return { ...baseline, interaction: 'pair-refused' };
  }
  const event = makeEvent(baseline, pair, input.source || 'visitor-pair');
  return {
    ...buildFrame(baseline.stage, [...baseline.memory, event]),
    interaction: 'pair-committed',
    restoreMemory: baseline.memory.map(copyEvent)
  };
}

export function liftLatestPair(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'pair-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'pair-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'pair-lifted' };
}

export function releasePairs(frame) {
  return { ...buildFrame(0, []), interaction: 'field-released' };
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.segments.map(({ id, x, y, width, height, tilt, depth, removed, cut, stress, endpoint }) => ({
    id,
    x: Number(x.toFixed(7)),
    y: Number(y.toFixed(7)),
    width: Number(width.toFixed(7)),
    height: Number(height.toFixed(7)),
    tilt: Number(tilt.toFixed(7)),
    depth: Number(depth.toFixed(7)),
    removed,
    cut: Number(cut.toFixed(7)),
    stress: Number(stress.toFixed(7)),
    endpoint
  })));
}

export function segmentPoints(segment) {
  if (!segment || segment.removed || segment.width <= 0 || segment.height <= 0) return [];
  const hw = segment.width / 2;
  const hh = segment.height / 2;
  const cos = Math.cos(segment.tilt);
  const sin = Math.sin(segment.tilt);
  return [
    [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]
  ].map(([x, y]) => ({
    x: clamp(segment.x + x * cos - y * sin, 0.01, 0.99),
    y: clamp(segment.y + x * sin + y * cos, 0.01, 0.99)
  }));
}
