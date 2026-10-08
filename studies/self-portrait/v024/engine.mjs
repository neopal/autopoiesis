export const SEED = 0x53504644;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const RING_COUNT = 9;
export const PRIMITIVE_BUDGET = 72;

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function point(value, fallback) {
  if (!Array.isArray(value) || value.length < 2) return fallback.slice();
  return [
    Number.isFinite(Number(value[0])) ? clamp(Number(value[0]), -1, 1) : fallback[0],
    Number.isFinite(Number(value[1])) ? clamp(Number(value[1]), -1, 1) : fallback[1]
  ];
}

function metrics(input = {}) {
  const start = point(input.start, [-0.55, 0]);
  const end = point(input.end, [0.55, 0]);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  return { start, end, dx, dy, length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
}

function baseFrame(stage) {
  const random = rng(SEED + stage * 9973);
  return {
    composition: 'self-measuring-membrane',
    stage: Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0))),
    rings: Array.from({ length: RING_COUNT }, (_, index) => ({
      index,
      radius: 0.16 + index * 0.082 + random() * 0.018,
      eccentricity: 0.78 + random() * 0.14,
      phase: random() * Math.PI * 2,
      resistance: 0.26 + random() * 0.68 + index * 0.008,
      notch: 0,
      drift: 0,
      relay: 0,
      tension: 0,
      state: 'quiet'
    })),
    memory: [],
    fieldBias: { x: 0, y: 0 },
    interaction: 'sequence'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    fieldBias: [Number(frame.fieldBias.x.toFixed(5)), Number(frame.fieldBias.y.toFixed(5))],
    rings: frame.rings.map((ring) => [
      ring.index,
      Number(ring.radius.toFixed(5)),
      Number(ring.eccentricity.toFixed(5)),
      Number(ring.phase.toFixed(5)),
      Number(ring.resistance.toFixed(5)),
      Number(ring.notch.toFixed(5)),
      Number(ring.drift.toFixed(5)),
      Number(ring.relay.toFixed(5)),
      Number(ring.tension.toFixed(5)),
      ring.state
    ])
  });
}

function ruptureFor(frame, stroke) {
  return frame.rings
    .map((ring) => ({
      index: ring.index,
      score: ring.resistance + ring.notch * 0.82 + ring.tension * 0.31
        + Math.abs(Math.sin(stroke.angle - ring.phase)) * 0.22
        + Math.abs(frame.fieldBias.x * Math.cos(ring.phase) + frame.fieldBias.y * Math.sin(ring.phase)) * 0.18
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)[0].index;
}

function relayFor(rupturedRing, stroke, memoryLength) {
  let relay = (rupturedRing + 2 + Math.floor(Math.abs(stroke.dx * 7 + stroke.dy * 5)) + memoryLength) % RING_COUNT;
  if (relay === rupturedRing) relay = (relay + 2) % RING_COUNT;
  return relay;
}

function commit(frame, stroke) {
  const next = clone(frame);
  const rupturedRing = ruptureFor(frame, stroke);
  const relayRing = relayFor(rupturedRing, stroke, frame.memory.length);
  const energy = clamp(stroke.length * 0.82 + Math.abs(stroke.dy) * 0.18, 0.08, 1);
  const rupture = next.rings[rupturedRing];
  const relay = next.rings[relayRing];

  rupture.notch = clamp(rupture.notch + 0.18 + energy * 0.22, 0, 0.94);
  rupture.drift += stroke.angle * (0.08 + energy * 0.08);
  rupture.eccentricity = clamp(rupture.eccentricity + 0.04 + energy * 0.03, 0.5, 1.2);
  rupture.tension += energy;
  rupture.state = 'ruptured';

  relay.relay = clamp(relay.relay + 0.22 + energy * 0.25, 0, 1.2);
  relay.phase -= stroke.angle * (0.05 + energy * 0.04);
  relay.drift += (stroke.dx >= 0 ? 1 : -1) * (0.05 + energy * 0.06);
  relay.tension += energy * 0.34;
  relay.state = 'relayed';

  next.fieldBias = {
    x: clamp(frame.fieldBias.x * 0.72 + Math.cos(stroke.angle) * energy * 0.42, -1, 1),
    y: clamp(frame.fieldBias.y * 0.72 + Math.sin(stroke.angle) * energy * 0.42, -1, 1)
  };
  next.memory = [...frame.memory, {
    id: `visitor-strain-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'measured-stroke',
    kind: 'resistance-rupture',
    start: stroke.start,
    end: stroke.end,
    length: Number(stroke.length.toFixed(6)),
    angle: Number(stroke.angle.toFixed(6)),
    energy: Number(energy.toFixed(6)),
    rupturedRing,
    relayRing,
    reason: 'the visitor supplies strain; the membrane chooses the weakest contour and relays the remainder'
  }].slice(-MEMORY_LIMIT);
  next.interaction = 'stroke-committed';
  return next;
}

export function buildFrame(stage = 0, memory = []) {
  let frame = baseFrame(stage);
  for (const event of clone(memory).slice(-MEMORY_LIMIT)) {
    const stroke = metrics(event);
    if (stroke.length >= 0.08) frame = commit(frame, stroke);
  }
  frame.interaction = 'sequence';
  return frame;
}

export function geometryStroke(input = {}) {
  return metrics(input);
}

export function submitStroke(frame, input = {}) {
  const stroke = metrics(input);
  if (stroke.length < 0.08) {
    const refused = clone(frame);
    refused.interaction = 'stroke-refused';
    return refused;
  }
  return commit(frame, stroke);
}

export function liftLatestStroke(frame) {
  if (!frame.memory.length) {
    const untouched = clone(frame);
    untouched.interaction = 'stroke-lifted';
    return untouched;
  }
  const restored = buildFrame(frame.stage, frame.memory.slice(0, -1));
  restored.interaction = 'stroke-lifted';
  return restored;
}

export function releaseStrain(stage = 0) {
  const released = buildFrame(stage, []);
  released.interaction = 'strain-released';
  return released;
}

const CUES = [
  { start: [-0.78, -0.14], end: [0.58, 0.3] },
  { start: [-0.62, 0.42], end: [0.7, -0.34] },
  { start: [-0.7, -0.48], end: [0.48, 0.52] },
  { start: [-0.42, 0.66], end: [0.76, 0.02] }
];

function defaultStroke(index = 0) {
  return clone(CUES[index % CUES.length]);
}

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[3, 0], [7, 1], [11, 2], [15, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = submitStroke(frame, defaultStroke(eventStages.get(stage)));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(frame);
  }
  return timeline;
}
