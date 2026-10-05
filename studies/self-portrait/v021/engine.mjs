export const SEED = 0x53504641;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const FACET_COUNT = 11;
export const PRIMITIVE_BUDGET = 66;

const clone = (value) => JSON.parse(JSON.stringify(value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function makeFacet(stage, index, random) {
  const center = (FACET_COUNT - 1) / 2;
  const normalized = (index - center) / center;
  return {
    index,
    x: normalized * 0.16 + (random() - 0.5) * 0.025,
    y: Math.sin(index * 1.23 + stage * 0.13) * 0.12 + (random() - 0.5) * 0.04,
    z: 0.18 + (random() - 0.5) * 0.16,
    width: 0.16 + random() * 0.06,
    height: 0.34 + random() * 0.12,
    depth: 0.08 + random() * 0.14,
    tilt: normalized * 0.22 + (random() - 0.5) * 0.12,
    twist: (random() - 0.5) * 0.18,
    shadowShift: 0,
    attention: 0,
    status: 'quiet'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0)));
  const random = rng(SEED + safeStage * 9973);
  let frame = {
    composition: 'webgl-blind-side-mobile',
    stage: safeStage,
    facets: Array.from({ length: FACET_COUNT }, (_, index) => makeFacet(safeStage, index, random)),
    memory: [],
    armed: false,
    pendingFacet: null,
    interaction: 'sequence'
  };
  for (const event of clone(memory).slice(-MEMORY_LIMIT)) frame = commitDeparture(frame, event);
  frame.interaction = 'sequence';
  return frame;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    facets: frame.facets.map((facet) => [
      facet.index,
      Number(facet.x.toFixed(5)),
      Number(facet.y.toFixed(5)),
      Number(facet.z.toFixed(5)),
      Number(facet.width.toFixed(5)),
      Number(facet.height.toFixed(5)),
      Number(facet.depth.toFixed(5)),
      Number(facet.tilt.toFixed(5)),
      Number(facet.twist.toFixed(5)),
      Number(facet.shadowShift.toFixed(5)),
      Number(facet.attention.toFixed(5)),
      facet.status
    ])
  });
}

function safeIndex(value, fallback = 0) {
  const index = Number(value);
  return Number.isInteger(index) ? Math.max(0, Math.min(FACET_COUNT - 1, index)) : fallback;
}

function nearestFacet(frame, point) {
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  return frame.facets
    .map((facet) => ({ index: facet.index, distance: Math.hypot(facet.x - x, facet.y - y) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)[0]?.index ?? 0;
}

export function armAttention(frame, point = {}) {
  const next = clone(frame);
  next.armed = true;
  next.pendingFacet = nearestFacet(frame, point);
  next.interaction = 'attention-armed';
  return next;
}

export function commitDeparture(frame, input = {}) {
  const next = clone(frame);
  const facetIndex = safeIndex(input.facetIndex, frame.pendingFacet ?? nearestFacet(frame, input));
  const previousReply = frame.memory.at(-1)?.replyIndex;
  const computedReply = (facetIndex + 4 + frame.memory.length * 2 + (previousReply === facetIndex ? 1 : 0)) % FACET_COUNT;
  const replyIndex = safeIndex(input.replyIndex, computedReply);
  const direction = facetIndex % 2 === 0 ? 1 : -1;
  const local = next.facets[facetIndex];
  const remote = next.facets[replyIndex];
  local.tilt += direction * 0.38;
  local.twist -= direction * 0.22;
  local.z -= 0.08;
  local.attention = 1;
  local.status = 'averted';
  remote.z += 0.12 + frame.memory.length * 0.015;
  remote.twist += direction * 0.24;
  remote.shadowShift += 0.18 + frame.memory.length * 0.04;
  remote.attention = 0.7;
  remote.status = 'answered';
  const event = {
    id: input.id ?? `visitor-blind-turn-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'measured-departure',
    kind: 'blind-side-turn',
    facetIndex,
    replyIndex,
    approach: { x: Number(input.x) || 0, y: Number(input.y) || 0 },
    reason: 'departure makes the approached facet avert and a distant facet answer'
  };
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.armed = false;
  next.pendingFacet = null;
  next.interaction = 'departure-committed';
  return next;
}

export function liftLatestDeparture(frame) {
  if (!frame.memory.length) return clone(frame);
  let restored = buildFrame(frame.stage, []);
  for (const event of frame.memory.slice(0, -1)) restored = commitDeparture(restored, event);
  restored.interaction = 'departure-lifted';
  return restored;
}

export function releaseAttention(stage = 0) {
  const released = buildFrame(stage, []);
  released.interaction = 'attention-released';
  return released;
}

const CUES = [
  { x: -0.42, y: -0.06, facetIndex: 1 },
  { x: -0.08, y: 0.17, facetIndex: 2 },
  { x: 0.21, y: -0.13, facetIndex: 6 },
  { x: 0.43, y: 0.08, facetIndex: 10 }
];

export function defaultCue(index = 0) {
  return { ...CUES[index % CUES.length] };
}

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[3, 0], [7, 1], [11, 2], [15, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = commitDeparture(frame, defaultCue(eventStages.get(stage)));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(frame);
  }
  return timeline;
}
