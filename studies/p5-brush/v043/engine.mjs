export const MEMORY_LIMIT = 4;
export const STAGES = 9;
export const GATE_COUNT = 8;
export const MIN_REPLY_DISTANCE = 0.22;

const SEED = 0x42523433;
const GATE_BASE = [
  [0.18, 0.28],
  [0.34, 0.13],
  [0.63, 0.13],
  [0.82, 0.32],
  [0.82, 0.68],
  [0.62, 0.87],
  [0.34, 0.86],
  [0.18, 0.68]
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(5));
const clampIndex = (value, count) => ((Math.floor(Number(value) || 0) % count) + count) % count;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, amount) => a + (b - a) * amount;

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
    y: round(clamp(Number(point.y) || 0, 0.02, 0.98))
  };
}

function normalizeEvent(event = {}) {
  return {
    source: event.source || 'unknown',
    type: 'witness-fold',
    callGate: clampIndex(event.callGate, GATE_COUNT),
    replyGate: clampIndex(event.replyGate, GATE_COUNT),
    callPoint: normalizePoint(event.callPoint),
    replyPoint: normalizePoint(event.replyPoint),
    phase: round(clamp(Number(event.phase) || 0.58, 0.28, 1.2)),
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + Number(event.replyGate || 0) * 83)
  };
}

function gatePoint(id) {
  const [x, y] = GATE_BASE[clampIndex(id, GATE_COUNT)];
  return { x, y };
}

function baseShell() {
  const shell = [];
  for (let index = 0; index < 64; index += 1) {
    const angle = (Math.PI * 2 * index) / 64;
    const wave = Math.sin(angle * 5.0 + 0.7) * 0.045 + Math.sin(angle * 9.0 - 0.4) * 0.018;
    const radiusX = 0.275 + wave + Math.cos(angle * 3.0) * 0.018;
    const radiusY = 0.39 + Math.sin(angle * 4.0 + 0.2) * 0.025;
    shell.push({
      x: round(0.5 + Math.cos(angle) * radiusX),
      y: round(0.5 + Math.sin(angle) * radiusY),
      weight: round(0.72 + seeded(index, 4) * 0.22)
    });
  }
  return shell;
}

function baseVoids() {
  return [
    { x: 0.39, y: 0.33, rx: 0.062, ry: 0.105, tilt: -0.28, opening: 0.12 },
    { x: 0.61, y: 0.36, rx: 0.07, ry: 0.09, tilt: 0.42, opening: 0.16 },
    { x: 0.42, y: 0.66, rx: 0.07, ry: 0.092, tilt: 0.24, opening: 0.14 },
    { x: 0.6, y: 0.64, rx: 0.058, ry: 0.11, tilt: -0.38, opening: 0.18 }
  ];
}

function baseGates(memory) {
  return GATE_BASE.map(([x, y], id) => ({
    id,
    x,
    y,
    closed: false,
    attention: round(memory.reduce((sum, event) => sum + (event.callGate === id || event.replyGate === id ? 0.16 : 0), 0))
  }));
}

function makeFold(event, index) {
  const start = gatePoint(event.callGate);
  const end = gatePoint(event.replyGate);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const bow = (0.035 + index * 0.009) * (index % 2 ? -1 : 1) * event.phase;
  const points = [];
  for (let pointIndex = 0; pointIndex < 13; pointIndex += 1) {
    const t = pointIndex / 12;
    const curve = Math.sin(t * Math.PI) * bow;
    points.push({
      x: round(lerp(start.x, end.x, t) + nx * curve),
      y: round(lerp(start.y, end.y, t) + ny * curve),
      width: round(0.006 + Math.sin(t * Math.PI) * (0.012 + index * 0.002))
    });
  }
  return {
    id: index,
    callGate: event.callGate,
    replyGate: event.replyGate,
    points,
    depth: round(0.24 + index * 0.035),
    phase: event.phase
  };
}

function buildBody(memory) {
  const shell = baseShell();
  const voids = baseVoids();
  const folds = memory.map(makeFold);
  for (const [index, event] of memory.entries()) {
    const voidIndex = (event.callGate + event.replyGate + index) % voids.length;
    const hole = voids[voidIndex];
    hole.opening = round(clamp(hole.opening + 0.23 + event.phase * 0.06, 0, 0.92));
    hole.rx = round(hole.rx + event.phase * 0.006);
    hole.ry = round(hole.ry + event.phase * 0.009);
    const influence = 0.0028 + event.phase * 0.0012;
    for (let shellIndex = 0; shellIndex < shell.length; shellIndex += 1) {
      const sample = shell[shellIndex];
      const angle = (Math.PI * 2 * shellIndex) / shell.length;
      const polarity = shellIndex % 2 === index % 2 ? 1 : -1;
      sample.x = round(sample.x + Math.cos(angle + event.callGate) * influence * polarity);
      sample.y = round(sample.y + Math.sin(angle + event.replyGate) * influence * polarity);
    }
  }
  return { shell, voids, folds };
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  const event = boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null;
  return {
    grammar: 'witness-chord',
    renderer: 'deterministic p5.js Canvas 2D monolithic ink body',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body: buildBody(boundedMemory),
    gates: baseGates(boundedMemory),
    event,
    pending: {
      gate: Number.isInteger(pending.gate) ? pending.gate : null,
      point: pending.point ? normalizePoint(pending.point) : null,
      latent: pending.latent === true,
      previewGate: Number.isInteger(pending.previewGate) ? pending.previewGate : null,
      previewPoint: pending.previewPoint ? normalizePoint(pending.previewPoint) : null
    },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

function nearestGate(point) {
  const normalized = normalizePoint(point);
  return GATE_BASE.reduce((best, [x, y], id) => {
    const score = distance(normalized, { x, y });
    return score < best.score ? { id, score } : best;
  }, { id: null, score: Infinity });
}

export function previewTouch(frame, point) {
  const normalized = normalizePoint(point);
  const nearest = nearestGate(normalized);
  const latent = frame.pending.latent === true;
  return buildFrameFrom(frame.stage, frame.memory, 'call-preview', {
    gate: latent ? frame.pending.gate : nearest.score <= 0.14 ? nearest.id : null,
    point: latent ? frame.pending.point : normalized,
    latent,
    previewGate: nearest.score <= 0.14 ? nearest.id : null,
    previewPoint: normalized
  });
}

export function commitTouch(frame, point, source = 'visitor-attention') {
  const normalized = normalizePoint(point);
  const nearest = nearestGate(normalized);
  if (nearest.score > 0.14) return buildFrameFrom(frame.stage, frame.memory, 'call-refused-miss', { point: normalized });
  if (frame.pending.latent !== true) {
    return buildFrameFrom(frame.stage, frame.memory, 'call-armed', { gate: nearest.id, point: normalized, latent: true });
  }
  if (nearest.id === frame.pending.gate) {
    const movedWithinGate = frame.pending.point && distance(normalized, frame.pending.point) > 0.01;
    return buildFrameFrom(frame.stage, frame.memory, movedWithinGate ? 'reply-refused-near' : 'reply-refused-self', frame.pending);
  }
  if (distance(gatePoint(frame.pending.gate), gatePoint(nearest.id)) < MIN_REPLY_DISTANCE) {
    return buildFrameFrom(frame.stage, frame.memory, 'reply-refused-near', frame.pending);
  }
  return applyExchange(frame, frame.pending.gate, nearest.id, source, frame.pending.point, normalized);
}

export function applyExchange(frame, callGate, replyGate, source = 'control-exchange', callPoint = null, replyPoint = null) {
  const call = clampIndex(callGate, GATE_COUNT);
  const reply = clampIndex(replyGate, GATE_COUNT);
  if (call === reply) return buildFrameFrom(frame.stage, frame.memory, 'reply-refused-self', { gate: call, point: callPoint || gatePoint(call) });
  const event = {
    source,
    type: 'witness-fold',
    callGate: call,
    replyGate: reply,
    callPoint: callPoint || gatePoint(call),
    replyPoint: replyPoint || gatePoint(reply),
    phase: 0.58 + ((frame.memory.length * 7 + call + reply) % 5) * 0.1,
    field: hash(SEED + frame.memory.length * 7919 + reply * 83)
  };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'exchange-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const pairs = [[0, 4], [2, 6], [1, 5], [3, 7]];
  let frame = buildFrame(0, []);
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    if (stage % 2 === 1) {
      frame = applyExchange(frame, ...pairs[(stage - 1) / 2], 'timeline-exchange');
    } else {
      frame = buildFrameFrom(stage, frame.memory, 'timeline');
    }
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    shell: frame.body.shell,
    voids: frame.body.voids,
    folds: frame.body.folds,
    gates: frame.gates.map(({ id, x, y, closed }) => ({ id, x, y, closed }))
  });
}
