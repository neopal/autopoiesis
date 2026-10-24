export const SEED = 0x435032;
export const MEMORY_LIMIT = 4;
export const DIRECTION_COUNT = 4;
export const FACET_COUNT = 18;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(5));

function seeded(index, stage = 0) {
  const value = Math.sin((index + 1) * 17.913 + (stage + 1) * 31.771 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function baseFacet(index, stage) {
  const ring = index % 3;
  const spoke = Math.floor(index / 3);
  return {
    index,
    ring,
    spoke,
    radius: rounded(0.42 + seeded(index, stage) * 0.36),
    height: rounded(0.16 + seeded(index + 19, stage) * 0.46),
    lean: rounded((seeded(index + 37, stage) - 0.5) * 0.38),
    cut: rounded(0.12 + seeded(index + 53, stage) * 0.48),
    lift: rounded((seeded(index + 71, stage) - 0.5) * 0.15),
    state: 'quiet'
  };
}

export function buildFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, 7);
  return {
    composition: 'hinge-of-refusal',
    stage: safeStage,
    revision: 0,
    hinge: {
      axis: 0,
      angle: 0,
      fold: 0.18,
      voidScale: 0.82,
      offset: 0
    },
    facets: Array.from({ length: FACET_COUNT }, (_, index) => baseFacet(index, safeStage)),
    pendingDirection: null,
    memory: [],
    snapshots: [],
    interaction: 'waiting'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    stage: frame.stage,
    revision: frame.revision,
    hinge: Object.values(frame.hinge).map(rounded),
    facets: frame.facets.map((facet) => [
      facet.index,
      rounded(facet.radius),
      rounded(facet.height),
      rounded(facet.lean),
      rounded(facet.cut),
      rounded(facet.lift),
      facet.state
    ])
  });
}

function safeDirection(value) {
  const candidate = integer(value, -1);
  return candidate >= 0 && candidate < DIRECTION_COUNT ? candidate : null;
}

function mutateFacet(facet, index, delta, firstDirection, secondDirection, revision) {
  const distance = (index - firstDirection * 3 - secondDirection * 5 + revision * 2 + FACET_COUNT) % FACET_COUNT;
  const influence = distance === 0 ? 0.14 : distance === 3 ? -0.09 : distance === 7 ? 0.08 : 0;
  const next = { ...facet };
  next.radius = rounded(clamp(facet.radius + influence * delta, 0.28, 0.92));
  next.height = rounded(clamp(facet.height + influence * 0.9 + (index % 3 === delta ? 0.035 : 0), 0.08, 0.78));
  next.lean = rounded(clamp(facet.lean + (distance === 0 ? 0.11 : distance === 7 ? -0.075 : 0), -0.48, 0.48));
  next.cut = rounded(clamp(facet.cut + (distance === 3 ? 0.15 : distance === 0 ? -0.08 : 0), 0.04, 0.86));
  next.lift = rounded(clamp(facet.lift + (distance === 7 ? 0.12 : distance === 0 ? -0.04 : 0), -0.24, 0.24));
  next.state = distance === 0 ? 'hinged' : distance === 3 ? 'refused' : distance === 7 ? 'witness' : 'quiet';
  return next;
}

export function propose(frame, direction) {
  const nextDirection = safeDirection(direction);
  if (nextDirection === null) {
    const refused = clone(frame);
    refused.interaction = 'refused';
    return { accepted: false, frame: refused, reason: 'invalid-direction' };
  }

  if (frame.pendingDirection === null) {
    const held = clone(frame);
    held.pendingDirection = nextDirection;
    held.interaction = 'pending';
    return { accepted: false, frame: held, reason: 'awaiting-contradiction' };
  }

  if (frame.pendingDirection === nextDirection) {
    const refused = clone(frame);
    refused.interaction = 'refused';
    return { accepted: false, frame: refused, reason: 'duplicate-proposal' };
  }

  const firstDirection = frame.pendingDirection;
  const delta = (nextDirection - firstDirection + DIRECTION_COUNT) % DIRECTION_COUNT;
  const turn = delta === 2 ? -1 : 1;
  const next = clone(frame);
  const snapshot = clone(frame);
  next.snapshots = [...frame.snapshots, snapshot].slice(-MEMORY_LIMIT);
  next.pendingDirection = null;
  next.revision = frame.revision + 1;
  next.stage = (frame.stage + 1) % 8;
  next.hinge = {
    axis: (frame.hinge.axis + (delta === 2 ? 2 : 1)) % 4,
    angle: rounded(clamp(frame.hinge.angle + turn * (0.34 + delta * 0.12), -1.38, 1.38)),
    fold: rounded(clamp(frame.hinge.fold + 0.12 + delta * 0.035, 0.12, 0.86)),
    voidScale: rounded(clamp(frame.hinge.voidScale + (delta === 2 ? 0.18 : -0.09), 0.48, 1.32)),
    offset: rounded(clamp(frame.hinge.offset + turn * 0.16, -0.62, 0.62))
  };
  next.facets = frame.facets.map((facet, index) => mutateFacet(facet, index, delta, firstDirection, nextDirection, next.revision));
  const event = {
    kind: 'contradiction-hinge',
    firstDirection,
    secondDirection: nextDirection,
    turn,
    delta,
    revision: next.revision,
    axis: next.hinge.axis,
    angle: next.hinge.angle
  };
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  next.interaction = 'committed';
  return { accepted: true, frame: next, event };
}

export function liftLatest(frame) {
  if (!frame.snapshots.length) return clone(frame);
  const restored = clone(frame.snapshots.at(-1));
  restored.interaction = 'lifted';
  return restored;
}

export function releaseField(seed = 0) {
  return buildFrame(seed);
}

export function buildTimeline() {
  let frame = buildFrame(0);
  const frames = [frame];
  const proposals = [[0, 2], [1, 3], [2, 1], [3, 0]];
  for (const [first, second] of proposals) {
    frame = propose(frame, first).frame;
    frame = propose(frame, second).frame;
    frames.push(frame);
  }
  return frames;
}
