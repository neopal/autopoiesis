const BASE_SEED = 0x53564740;
export const MEMORY_WINDOW = 4;
export const PORTAL_COUNT = 7;
export const MASS_COUNT = 1;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));
const fixed = (value) => Number(value).toFixed(2);

const PORTAL_SEED = [
  { id: 0, x: 0.235, y: 0.255, rx: 0.054, ry: 0.083, angle: -0.34 },
  { id: 1, x: 0.488, y: 0.205, rx: 0.074, ry: 0.049, angle: 0.16 },
  { id: 2, x: 0.724, y: 0.296, rx: 0.047, ry: 0.074, angle: 0.62 },
  { id: 3, x: 0.300, y: 0.495, rx: 0.068, ry: 0.044, angle: -0.58 },
  { id: 4, x: 0.555, y: 0.445, rx: 0.048, ry: 0.077, angle: 0.22 },
  { id: 5, x: 0.746, y: 0.558, rx: 0.079, ry: 0.047, angle: -0.21 },
  { id: 6, x: 0.466, y: 0.704, rx: 0.058, ry: 0.036, angle: 0.48 }
];

const OUTER = [
  [120, 178], [270, 94], [548, 82], [796, 154], [890, 322],
  [824, 548], [616, 666], [330, 636], [144, 522], [92, 332]
];

function normalizedIndex(value) {
  return wrap(Math.round(Number(value) || 0), PORTAL_COUNT);
}

function pointPath(points) {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${fixed(x)} ${fixed(y)}`).join(' ')} Z`;
}

function portalPath(portal) {
  const points = [];
  const cx = portal.x * 1000;
  const cy = portal.y * 760;
  const rx = Math.max(12, portal.rx * 1000);
  const ry = Math.max(10, portal.ry * 760);
  for (let index = 0; index < 18; index += 1) {
    const angle = index * TAU / 18;
    const wobble = 1 + 0.06 * Math.sin(angle * 3 + portal.id * 0.7 + portal.angle);
    const localX = Math.cos(angle) * rx * wobble;
    const localY = Math.sin(angle) * ry * (1 + 0.04 * Math.cos(angle * 5 - portal.angle));
    points.push([
      cx + localX * Math.cos(portal.angle) - localY * Math.sin(portal.angle),
      cy + localX * Math.sin(portal.angle) + localY * Math.cos(portal.angle)
    ]);
  }
  return pointPath(points);
}

function basePortal(seed) {
  const portal = { ...seed, role: 'quiet' };
  portal.signature = portalPath(portal);
  return portal;
}

function baseState() {
  return { responseCount: 0, echoPhase: 0, withheldPhase: 0 };
}

function basePortals() {
  return PORTAL_SEED.map(basePortal);
}

function remoteIndices(sourceIndex, eventIndex) {
  const target = wrap(sourceIndex + 2 + eventIndex, PORTAL_COUNT);
  const withheld = wrap(sourceIndex + 4 + eventIndex * 2, PORTAL_COUNT);
  const echo = wrap(sourceIndex + 1 + eventIndex * 3, PORTAL_COUNT);
  return [target, withheld, echo].filter((index, position, all) => index !== sourceIndex && all.indexOf(index) === position);
}

function mutatePortal(portal, role, eventIndex) {
  const next = { ...portal, role };
  if (role === 'answer') {
    next.rx = clamp(next.rx + 0.012 + eventIndex * 0.002, 0.035, 0.112);
    next.ry = clamp(next.ry + 0.018, 0.028, 0.12);
    next.angle += 0.12 + eventIndex * 0.025;
  } else if (role === 'withheld') {
    next.rx = clamp(next.rx * (0.78 - eventIndex * 0.015), 0.025, 0.1);
    next.ry = clamp(next.ry * 0.82, 0.022, 0.1);
    next.angle -= 0.08;
  } else if (role === 'echo') {
    next.x = clamp(next.x + 0.012 * (eventIndex % 2 ? -1 : 1), 0.18, 0.79);
    next.y = clamp(next.y - 0.009, 0.16, 0.76);
    next.angle += 0.26;
  }
  next.signature = portalPath(next);
  return next;
}

function materialState(memory) {
  const state = baseState();
  let portals = basePortals();
  for (const event of memory) {
    const [target, withheld, echo] = event.remoteIndices;
    portals[target] = mutatePortal(portals[target], 'answer', event.index);
    portals[withheld] = mutatePortal(portals[withheld], 'withheld', event.index);
    portals[echo] = mutatePortal(portals[echo], 'echo', event.index);
    state.responseCount += 1;
    state.echoPhase += 0.19 + event.index * 0.03;
    state.withheldPhase += 0.12;
  }
  const pathSignature = `${pointPath(OUTER)} ${portals.map((portal) => portal.signature).join(' ')}`;
  return {
    state,
    portals,
    mass: { portalCount: PORTAL_COUNT, pathSignature, role: state.responseCount ? 'answering' : 'quiet' }
  };
}

function frameFrom(stage, memory, selectedIndex, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const material = materialState(safeMemory);
  const frame = {
    grammar: 'reciprocal-aperture',
    stage: clamp(Number(stage) || 0, 0, 16),
    memory: safeMemory,
    portals: material.portals,
    mass: material.mass,
    state: material.state,
    selectedIndex: selectedIndex === null || selectedIndex === undefined ? null : normalizedIndex(selectedIndex),
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, null, 'still', null);
}

export function geometrySignature(frame) {
  return `${frame.mass.pathSignature}||responses:${frame.state.responseCount}`;
}

export function armWitness(frame, rawIndex) {
  const index = normalizedIndex(rawIndex);
  return frameFrom(frame.stage, frame.memory, index, 'witness-armed', { committed: false, type: 'witness', sourceIndex: index });
}

export function commitResponse(frame) {
  if (frame.selectedIndex === null || frame.selectedIndex === undefined) {
    return frameFrom(frame.stage, frame.memory, null, 'response-refused-unarmed', { committed: false, reason: 'witness-required' });
  }
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, null, 'response-refused-memory-full', { committed: false, reason: 'memory-full' });
  }
  const sourceIndex = frame.selectedIndex;
  const remote = remoteIndices(sourceIndex, frame.memory.length);
  const event = {
    committed: true,
    type: 'reciprocal-response',
    index: frame.memory.length,
    sourceIndex,
    remoteIndices: remote,
    roles: ['answer', 'withheld', 'echo']
  };
  return frameFrom(frame.stage + 1, [...frame.memory, event], null, 'response-committed', event);
}

export function liftLatestResponse(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], null, 'lift-empty', { committed: false });
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'response-lifted', { committed: false, lifted: true });
}

export function releaseMass() {
  return frameFrom(0, [], null, 'released', { committed: false, released: true });
}

export function buildTimeline() {
  const witnesses = [1, 5, 0, 4];
  let frame = buildFrame();
  const frames = [frame];
  for (const index of witnesses) {
    frame = commitResponse(armWitness(frame, index));
    frames.push(frame);
  }
  return frames;
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'reciprocal-aperture',
  rule: 'a witnessed aperture is geometry-neutral; an explicit answer changes three remote apertures in one solid mass',
  memoryWindow: MEMORY_WINDOW,
  portalCount: PORTAL_COUNT
};
