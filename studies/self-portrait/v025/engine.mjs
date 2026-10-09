export const SEED = 0x53504645;
export const STAGES = 17;
export const MEMORY_LIMIT = 4;
export const SEGMENT_COUNT = 13;
export const PRIMITIVE_BUDGET = 78;

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

function number(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function point(value, fallback = [0, 0]) {
  if (!Array.isArray(value) || value.length < 2) return fallback.slice();
  return [clamp(number(value[0], fallback[0]), -1, 1), clamp(number(value[1], fallback[1]), -1, 1)];
}

function routeMetrics(input = {}) {
  const raw = Array.isArray(input.points) ? input.points : [];
  const points = raw.length ? raw.map((value, index) => point(value, index ? [0, 0] : [-0.7, 0])) : [];
  let length = 0;
  let turn = 0;
  let previousDirection = null;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index][0] - points[index - 1][0];
    const dy = points[index][1] - points[index - 1][1];
    const direction = Math.atan2(dy, dx);
    length += Math.hypot(dx, dy);
    if (previousDirection !== null) {
      turn += Math.abs(Math.atan2(Math.sin(direction - previousDirection), Math.cos(direction - previousDirection)));
    }
    previousDirection = direction;
  }
  const start = points[0] ?? [-0.7, 0];
  const end = points.at(-1) ?? start;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  return {
    points: points.map(([x, y]) => [x, y]),
    start,
    end,
    length,
    angle: Math.atan2(dy, dx),
    turn,
    travel: Math.abs(dx) + Math.abs(dy)
  };
}

function baseFrame(stage) {
  const random = rng(SEED + stage * 9973);
  const safeStage = clamp(Math.floor(number(stage)), 0, STAGES - 1);
  return {
    composition: 'decision-ribbon',
    stage: safeStage,
    segments: Array.from({ length: SEGMENT_COUNT }, (_, index) => ({
      index,
      x: -0.94 + index * 0.148,
      y: -0.09 + (index % 2 ? 0.08 : -0.04) + (random() - 0.5) * 0.05,
      width: 0.105 + random() * 0.035,
      height: 0.36 + random() * 0.2,
      lean: (random() - 0.5) * 0.32,
      phase: random() * Math.PI * 2,
      attention: 0,
      gap: 0,
      bend: 0,
      fold: 0,
      tension: 0,
      state: 'quiet'
    })),
    memory: [],
    route: [],
    interaction: 'sequence'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    segments: frame.segments.map((segment) => [
      segment.index,
      Number(segment.x.toFixed(5)),
      Number(segment.y.toFixed(5)),
      Number(segment.width.toFixed(5)),
      Number(segment.height.toFixed(5)),
      Number(segment.lean.toFixed(5)),
      Number(segment.phase.toFixed(5)),
      Number(segment.gap.toFixed(5)),
      Number(segment.bend.toFixed(5)),
      Number(segment.fold.toFixed(5)),
      Number(segment.tension.toFixed(5)),
      segment.state
    ])
  });
}

function nearestSegment(frame, route) {
  return frame.segments.map((segment) => {
    const score = route.points.reduce((total, [x, y]) => {
      const dx = x - segment.x;
      const dy = y - segment.y;
      return total + Math.exp(-(dx * dx * 28 + dy * dy * 10));
    }, 0) / Math.max(1, route.points.length);
    return { index: segment.index, score: score + segment.attention * 0.26 };
  }).sort((a, b) => b.score - a.score || a.index - b.index)[0]?.index ?? 0;
}

function chooseDetour(frame, observed, route) {
  const candidates = frame.segments.map((segment) => {
    const distance = Math.min(Math.abs(segment.index - observed), SEGMENT_COUNT - Math.abs(segment.index - observed));
    const fatigue = segment.gap * 0.8 + segment.tension * 0.22 + segment.attention * 0.2;
    const routeBias = Math.sin(route.angle + segment.phase) * 0.08;
    return { index: segment.index, score: distance < 3 ? 9 : fatigue + routeBias - distance * 0.035 };
  });
  return candidates.sort((a, b) => a.score - b.score || a.index - b.index)[0].index;
}

function chooseReply(detour, observed, route, memoryLength) {
  let reply = (detour + 4 + Math.floor(route.turn * 3) + memoryLength) % SEGMENT_COUNT;
  if (reply === observed || reply === detour) reply = (reply + 3) % SEGMENT_COUNT;
  return reply;
}

function commit(frame, route) {
  const next = clone(frame);
  const observedSegment = nearestSegment(frame, route);
  const detourSegment = chooseDetour(frame, observedSegment, route);
  const replySegment = chooseReply(detourSegment, observedSegment, route, frame.memory.length);
  const energy = clamp(route.length * 0.52 + route.turn * 0.08 + route.travel * 0.12, 0.1, 1);
  const observed = next.segments[observedSegment];
  const detour = next.segments[detourSegment];
  const reply = next.segments[replySegment];

  observed.attention = clamp(observed.attention + 0.32 + energy * 0.18, 0, 1.4);
  observed.state = 'witnessed';
  detour.gap = clamp(detour.gap + 0.18 + energy * 0.2, 0, 0.88);
  detour.lean += route.angle * (0.06 + energy * 0.06);
  detour.height = clamp(detour.height - 0.035 - energy * 0.03, 0.2, 0.75);
  detour.tension += energy;
  detour.state = 'detoured';
  reply.bend += (route.end[1] - route.start[1]) * (0.24 + energy * 0.14) + Math.sin(route.angle + reply.phase) * 0.08;
  reply.fold = clamp(reply.fold + 0.2 + energy * 0.12, -0.9, 0.9);
  reply.width = clamp(reply.width + 0.018 + energy * 0.012, 0.08, 0.21);
  reply.tension += energy * 0.4;
  reply.state = 'replied';

  next.segments.forEach((segment, index) => {
    if (index !== observedSegment && index !== detourSegment && index !== replySegment) {
      segment.attention = clamp(segment.attention * 0.78, 0, 1.4);
      segment.bend += Math.sin(index + route.angle) * energy * 0.006;
    }
  });
  next.memory = [...frame.memory, {
    id: `visitor-detour-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'situated-traverse',
    kind: 'detour-departure',
    points: route.points,
    length: Number(route.length.toFixed(6)),
    angle: Number(route.angle.toFixed(6)),
    turn: Number(route.turn.toFixed(6)),
    energy: Number(energy.toFixed(6)),
    observedSegment,
    detourSegment,
    replySegment,
    reason: 'the visitor is situated in the ribbon; departure makes an unaddressed segment detour and a remote segment reply'
  }].slice(-MEMORY_LIMIT);
  next.route = [];
  next.interaction = 'departure-committed';
  return next;
}

export function buildFrame(stage = 0, memory = []) {
  let frame = baseFrame(stage);
  for (const event of clone(memory).slice(-MEMORY_LIMIT)) {
    const route = routeMetrics({ points: event.points });
    if (route.length >= 0.22) frame = commit(frame, route);
  }
  frame.interaction = 'sequence';
  return frame;
}

export function traverse(frame, input = {}) {
  const route = routeMetrics(input);
  const next = clone(frame);
  next.route = route.points;
  next.segments.forEach((segment) => {
    const proximity = route.points.reduce((total, [x, y]) => total + Math.exp(-((x - segment.x) ** 2 * 28 + (y - segment.y) ** 2 * 10)), 0);
    segment.attention = clamp(segment.attention * 0.92 + proximity * 0.08, 0, 1.4);
  });
  next.interaction = route.length >= 0.22 ? 'route-armed' : 'route-short';
  return next;
}

export function commitDeparture(frame) {
  const route = routeMetrics({ points: frame.route });
  if (route.length < 0.22) {
    const refused = clone(frame);
    refused.route = [];
    refused.interaction = 'route-refused';
    return refused;
  }
  return commit(frame, route);
}

export function liftLatestDeparture(frame) {
  if (!frame.memory.length) {
    const untouched = clone(frame);
    untouched.interaction = 'departure-lifted';
    return untouched;
  }
  const restored = buildFrame(frame.stage, frame.memory.slice(0, -1));
  restored.interaction = 'departure-lifted';
  return restored;
}

export function releaseAttention(stage = 0) {
  const released = buildFrame(stage, []);
  released.interaction = 'attention-released';
  return released;
}

const CUES = [
  [[-0.82, -0.22], [-0.26, 0.18], [0.16, -0.06], [0.76, 0.26]],
  [[-0.76, 0.36], [-0.24, -0.18], [0.12, 0.34], [0.7, -0.3]],
  [[-0.82, -0.4], [-0.32, -0.08], [0.18, 0.22], [0.78, 0.44]],
  [[-0.72, 0.2], [-0.16, 0.4], [0.26, -0.22], [0.82, -0.12]]
];

export function buildTimeline() {
  const timeline = [];
  let frame = buildFrame(0, []);
  const eventStages = new Map([[3, 0], [7, 1], [11, 2], [15, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    frame = buildFrame(stage, frame.memory);
    if (eventStages.has(stage)) {
      frame = commitDeparture(traverse(frame, { points: CUES[eventStages.get(stage)] }));
    }
    frame.stage = stage;
    timeline.push(frame);
  }
  return timeline;
}
