export const SEED = 0x503033;
export const MEMORY_LIMIT = 4;
export const ZONE_COUNT = 8;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(5));

function seeded(index, stage = 0) {
  const value = Math.sin((index + 1) * 19.173 + (stage + 1) * 27.411 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function baseZone(index, stage) {
  const side = index < ZONE_COUNT / 2 ? 'left' : 'right';
  const local = index % (ZONE_COUNT / 2);
  return {
    index,
    side,
    local,
    y: rounded(0.12 + local * 0.205 + (seeded(index, stage) - 0.5) * 0.035),
    width: rounded(0.24 + seeded(index + 17, stage) * 0.12),
    height: rounded(0.135 + seeded(index + 31, stage) * 0.055),
    slant: rounded((seeded(index + 43, stage) - 0.5) * 0.32),
    gap: rounded(0.025 + seeded(index + 59, stage) * 0.04),
    aperture: rounded(0.045 + seeded(index + 71, stage) * 0.06),
    drift: rounded((seeded(index + 89, stage) - 0.5) * 0.08),
    rotation: rounded((seeded(index + 103, stage) - 0.5) * 0.12),
    state: 'quiet'
  };
}

export function buildFrame(stage = 0) {
  const safeStage = clamp(integer(stage), 0, 7);
  return {
    composition: 'reciprocal-absence',
    stage: safeStage,
    revision: 0,
    mirror: { seam: 0.5, tension: 0.18, offset: 0, opening: 0.12 },
    zones: Array.from({ length: ZONE_COUNT }, (_, index) => baseZone(index, safeStage)),
    attention: Array.from({ length: ZONE_COUNT }, () => 0),
    armedZone: null,
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
    mirror: Object.values(frame.mirror).map(rounded),
    zones: frame.zones.map((zone) => [
      zone.index,
      rounded(zone.y),
      rounded(zone.width),
      rounded(zone.height),
      rounded(zone.slant),
      rounded(zone.gap),
      rounded(zone.aperture),
      rounded(zone.drift),
      rounded(zone.rotation),
      zone.state
    ])
  });
}

export function decisionSignature(frame) {
  return JSON.stringify({
    attention: frame.attention,
    armedZone: frame.armedZone,
    memory: frame.memory
  });
}

function safeZone(value) {
  const candidate = integer(value, -1);
  return candidate >= 0 && candidate < ZONE_COUNT ? candidate : null;
}

function leastAttended(frame, excluded) {
  return frame.attention
    .map((count, index) => ({ count, index, distance: (index - excluded + ZONE_COUNT) % ZONE_COUNT }))
    .filter((entry) => entry.index !== excluded)
    .sort((a, b) => a.count - b.count || b.distance - a.distance || a.index - b.index)[0].index;
}

function remoteEcho(receiver, seen, revision) {
  const preferred = (receiver + 3 + revision) % ZONE_COUNT;
  if (preferred !== seen && preferred !== receiver) return preferred;
  return (preferred + 1) % ZONE_COUNT;
}

function mutateZone(zone, role, revision, seen, receiver, echo) {
  const next = { ...zone };
  if (role === 'answer') {
    next.width = rounded(clamp(zone.width + 0.065 + revision * 0.004, 0.2, 0.48));
    next.height = rounded(clamp(zone.height + 0.024, 0.11, 0.26));
    next.aperture = rounded(clamp(zone.aperture + 0.105, 0.04, 0.29));
    next.slant = rounded(clamp(zone.slant + (zone.side === 'left' ? -0.095 : 0.095), -0.48, 0.48));
    next.drift = rounded(clamp(zone.drift + (zone.side === 'left' ? 0.04 : -0.04), -0.2, 0.2));
    next.state = 'answer';
  } else if (role === 'echo') {
    next.y = rounded(clamp(zone.y + (zone.side === 'left' ? -0.035 : 0.035), 0.08, 0.86));
    next.width = rounded(clamp(zone.width - 0.028, 0.18, 0.42));
    next.gap = rounded(clamp(zone.gap + 0.022, 0.02, 0.12));
    next.rotation = rounded(clamp(zone.rotation + (zone.side === 'left' ? 0.08 : -0.08), -0.3, 0.3));
    next.state = 'echo';
  } else if (role === 'witnessed') {
    next.state = 'witnessed';
  }
  if (zone.index !== seen && zone.index !== receiver && zone.index !== echo) {
    next.drift = rounded(clamp(zone.drift + (zone.index % 2 ? 0.008 : -0.008), -0.2, 0.2));
    next.state = 'quiet';
  }
  return next;
}

export function attend(frame, zone) {
  const nextZone = safeZone(zone);
  if (nextZone === null) {
    const refused = clone(frame);
    refused.interaction = 'refused';
    return { accepted: false, frame: refused, reason: 'invalid-zone' };
  }
  if (frame.armedZone !== null) {
    const refused = clone(frame);
    refused.interaction = 'refused';
    return { accepted: false, frame: refused, reason: 'attention-already-held' };
  }
  const held = clone(frame);
  held.armedZone = nextZone;
  held.attention[nextZone] += 1;
  held.interaction = 'attending';
  return { accepted: false, frame: held, reason: 'attention-held' };
}

export function withdraw(frame) {
  if (frame.armedZone === null) {
    const refused = clone(frame);
    refused.interaction = 'refused';
    return { accepted: false, frame: refused, reason: 'no-attention-held' };
  }
  const seen = frame.armedZone;
  const receiver = leastAttended(frame, seen);
  const echo = remoteEcho(receiver, seen, frame.revision);
  const next = clone(frame);
  const snapshot = clone(frame);
  snapshot.armedZone = null;
  snapshot.attention[seen] = Math.max(0, snapshot.attention[seen] - 1);
  snapshot.interaction = 'waiting';
  next.snapshots = [...frame.snapshots, snapshot].slice(-MEMORY_LIMIT);
  next.armedZone = null;
  next.revision = frame.revision + 1;
  next.stage = (frame.stage + 1) % 8;
  next.mirror = {
    seam: rounded(clamp(frame.mirror.seam + (receiver < ZONE_COUNT / 2 ? -0.022 : 0.022), 0.38, 0.62)),
    tension: rounded(clamp(frame.mirror.tension + 0.09, 0.12, 0.72)),
    offset: rounded(clamp(frame.mirror.offset + (echo < ZONE_COUNT / 2 ? -0.075 : 0.075), -0.34, 0.34)),
    opening: rounded(clamp(frame.mirror.opening + 0.07, 0.1, 0.62))
  };
  next.zones = frame.zones.map((zone) => {
    const role = zone.index === seen ? 'witnessed' : zone.index === receiver ? 'answer' : zone.index === echo ? 'echo' : 'quiet';
    return mutateZone(zone, role, next.revision, seen, receiver, echo);
  });
  next.memory = [...frame.memory, {
    kind: 'reciprocal-absence',
    seenIndex: seen,
    receiverIndex: receiver,
    echoIndex: echo,
    revision: next.revision,
    attention: frame.attention[seen]
  }].slice(-MEMORY_LIMIT);
  next.interaction = 'withdrawn';
  return { accepted: true, frame: next, event: next.memory.at(-1) };
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
  for (const zone of [0, 5, 2, 7]) {
    frame = attend(frame, zone).frame;
    frame = withdraw(frame).frame;
    frames.push(frame);
  }
  return frames;
}
