export const NODE_COUNT = 12;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503035;

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(5));

function seeded(index) {
  const value = Math.sin((index + 1) * 17.173 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

export function buildFrame() {
  return {
    composition: 'attention-orbit',
    revision: 0,
    nodes: Array.from({ length: NODE_COUNT }, (_, index) => ({
      index,
      angle: rounded((Math.PI * 2 * index) / NODE_COUNT + (seeded(index) - 0.5) * 0.08),
      radius: rounded(0.72 + seeded(index + 7) * 0.2),
      width: rounded(0.28 + seeded(index + 13) * 0.16),
      depth: rounded(0.5 + seeded(index + 19) * 0.35),
      skew: rounded((seeded(index + 23) - 0.5) * 0.3),
      aperture: rounded(0.18 + seeded(index + 29) * 0.24),
      state: 'quiet'
    })),
    attention: Array.from({ length: NODE_COUNT }, () => 0),
    memory: [],
    snapshots: [],
    lastObserved: null
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    composition: frame.composition,
    revision: frame.revision,
    nodes: frame.nodes.map((node) => [node.index, node.angle, node.radius, node.width, node.depth, node.skew, node.aperture, node.state])
  });
}

export function observeField(frame, { node, amount = 0.22 } = {}) {
  const next = clone(frame);
  next.attention[node] = rounded(next.attention[node] + amount);
  next.lastObserved = node;
  return next;
}

function isExcluded(index, excluded) {
  return Array.isArray(excluded) ? excluded.includes(index) : index === excluded;
}

function leastAttended(attention, excluded = -1) {
  let selected = -1;
  let value = Infinity;
  for (let index = 0; index < attention.length; index += 1) {
    if (isExcluded(index, excluded)) continue;
    if (attention[index] < value) {
      value = attention[index];
      selected = index;
    }
  }
  return selected === -1 ? 0 : selected;
}

function mostAttended(attention, excluded = -1) {
  let selected = -1;
  let value = -Infinity;
  for (let index = 0; index < attention.length; index += 1) {
    if (isExcluded(index, excluded)) continue;
    if (attention[index] > value) {
      value = attention[index];
      selected = index;
    }
  }
  return selected === -1 ? 0 : selected;
}

function mutateNode(node, role, revision) {
  const next = { ...node, state: 'quiet' };
  if (role === 'opened') {
    next.aperture = rounded(Math.min(0.84, node.aperture + 0.16 + revision * 0.015));
    next.width = rounded(Math.min(0.62, node.width + 0.045));
    next.radius = rounded(Math.max(0.56, node.radius - 0.045));
    next.state = 'opened';
  } else if (role === 'compressed') {
    next.aperture = rounded(Math.max(0.06, node.aperture - 0.08));
    next.width = rounded(Math.max(0.14, node.width - 0.07));
    next.radius = rounded(Math.min(1.15, node.radius + 0.06));
    next.skew = rounded(node.skew + (node.index % 2 ? -0.08 : 0.08));
    next.state = 'compressed';
  } else if (role === 'relay') {
    const direction = node.index % 2 ? -1 : 1;
    next.angle = rounded(node.angle + direction * (0.12 + revision * 0.012));
    next.depth = rounded(Math.min(0.98, node.depth + 0.08));
    next.skew = rounded(node.skew - direction * 0.09);
    next.state = 'relay';
  }
  return next;
}

export function auditVoid(frame) {
  const next = clone(frame);
  const observedNode = frame.lastObserved ?? mostAttended(frame.attention);
  const openedIndex = leastAttended(frame.attention, observedNode);
  const compressedIndex = mostAttended(frame.attention, [observedNode, openedIndex]);
  let relay = (openedIndex + compressedIndex + frame.revision * 2 + 5) % NODE_COUNT;
  while ([openedIndex, compressedIndex, observedNode].includes(relay)) relay = (relay + 1) % NODE_COUNT;
  const event = { kind: 'void-audit', observedNode, openedIndex, compressedIndex, relayIndex: relay, revision: frame.revision + 1 };
  next.revision = frame.revision + 1;
  next.nodes = frame.nodes.map((node) => {
    if (node.index === openedIndex) return mutateNode(node, 'opened', next.revision);
    if (node.index === compressedIndex) return mutateNode(node, 'compressed', next.revision);
    if (node.index === relay) return mutateNode(node, 'relay', next.revision);
    return { ...node, state: 'quiet' };
  });
  next.snapshots = [...frame.snapshots, clone(frame)].slice(-MEMORY_LIMIT);
  next.memory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  return { accepted: true, frame: next, event };
}

export function liftLatest(frame) {
  if (!frame.snapshots.length) return { ...clone(frame), interaction: 'lifted' };
  return { ...clone(frame.snapshots.at(-1)), interaction: 'lifted' };
}

export function releaseField() {
  return buildFrame();
}

export function buildTimeline() {
  let frame = buildFrame();
  const frames = [frame];
  const observations = [0, 3, 7, 10];
  for (const node of observations) {
    frame = observeField(frame, { node, amount: 0.8 });
    frame = auditVoid(frame).frame;
    frames.push(frame);
  }
  return frames;
}
