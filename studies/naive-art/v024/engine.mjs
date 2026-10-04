export const SEED = 0x4e413234;
export const STAGES = 19;
export const MEMORY_WINDOW = 4;
export const PRIMITIVE_BUDGET = 48;
export const PLANE_COUNT = 9;

const BASE_PLANES = [
  { x: -0.62, y: -0.38, depth: -0.22, hinge: -0.18, scale: 0.76, tone: '#e6a34c', shape: 'kite' },
  { x: -0.20, y: -0.53, depth: 0.08, hinge: 0.26, scale: 0.68, tone: '#d66d57', shape: 'window' },
  { x: 0.29, y: -0.43, depth: -0.08, hinge: -0.31, scale: 0.84, tone: '#7d9e7b', shape: 'flag' },
  { x: 0.62, y: -0.12, depth: 0.18, hinge: 0.12, scale: 0.72, tone: '#587b98', shape: 'stairs' },
  { x: 0.30, y: 0.32, depth: -0.16, hinge: -0.22, scale: 0.92, tone: '#a56f8f', shape: 'moon' },
  { x: -0.13, y: 0.48, depth: 0.14, hinge: 0.34, scale: 0.70, tone: '#d78557', shape: 'house' },
  { x: -0.58, y: 0.30, depth: -0.05, hinge: -0.12, scale: 0.80, tone: '#8f9d67', shape: 'river' },
  { x: -0.38, y: -0.02, depth: 0.24, hinge: 0.21, scale: 0.57, tone: '#c97773', shape: 'sun' },
  { x: 0.02, y: -0.02, depth: -0.30, hinge: -0.08, scale: 0.49, tone: '#d7c16f', shape: 'hole' }
];

const SHAPES = {
  kite: [[-0.72, -0.34], [0.10, -0.68], [0.78, -0.12], [0.32, 0.62], [-0.58, 0.48]],
  window: [[-0.54, -0.56], [0.52, -0.46], [0.64, 0.42], [-0.20, 0.62], [-0.62, 0.18]],
  flag: [[-0.62, -0.44], [0.54, -0.56], [0.72, 0.08], [0.30, 0.62], [-0.48, 0.48]],
  stairs: [[-0.66, -0.54], [0.08, -0.54], [0.08, -0.12], [0.62, -0.12], [0.62, 0.54], [-0.66, 0.54]],
  moon: [[-0.54, -0.50], [0.20, -0.66], [0.68, -0.05], [0.22, 0.62], [-0.60, 0.36]],
  house: [[-0.68, 0.02], [-0.16, -0.62], [0.67, -0.04], [0.44, 0.60], [-0.52, 0.48]],
  river: [[-0.72, -0.42], [-0.32, -0.62], [0.58, -0.28], [0.70, 0.44], [-0.06, 0.64], [-0.66, 0.30]],
  sun: [[-0.48, -0.48], [0.48, -0.52], [0.68, 0.28], [0.04, 0.68], [-0.62, 0.22]],
  hole: [[-0.52, -0.26], [-0.20, -0.58], [0.48, -0.42], [0.60, 0.34], [-0.10, 0.62], [-0.60, 0.30]]
};

function clampStage(stage) {
  return Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0)));
}

function cloneEvent(event) {
  return { ...event };
}

function normalizeMemory(memory) {
  return (Array.isArray(memory) ? memory : []).slice(-MEMORY_WINDOW).map(cloneEvent);
}

function copyPlane(plane) {
  return { ...plane, outline: plane.outline.map((point) => [...point]) };
}

function baseScene() {
  return {
    planes: BASE_PLANES.map((base, index) => ({
      id: `plane-${String(index).padStart(2, '0')}`,
      x: base.x,
      y: base.y,
      baseDepth: base.depth,
      depth: base.depth,
      baseHinge: base.hinge,
      hinge: base.hinge,
      scale: base.scale,
      tone: base.tone,
      shape: base.shape,
      shadowOffset: 0,
      shadowAngle: 0,
      outline: SHAPES[base.shape].map((point) => [...point])
    })),
    trace: {
      grammar: 'approach → departure → shadow misread → reconstruction',
      shadowMisreadCount: 0,
      changedPlaneCount: 0,
      pointerOnlyChanges: 0,
      shadowOffsetTotal: 0,
      nextRule: 'situated-approach'
    }
  };
}

function applyMisread(scene, event) {
  const focus = scene.planes[event.focusIndex];
  const reply = scene.planes[event.replyIndex];
  if (!focus || !reply) return;
  focus.depth = event.afterDepth;
  focus.hinge = event.afterHinge;
  focus.shadowOffset = Number((event.shadowOffset * 0.62).toFixed(5));
  focus.shadowAngle = Number((event.afterHinge * 0.7).toFixed(5));
  reply.depth = Number((reply.baseDepth + event.sequence * 0.045 - event.shadowOffset * 0.18).toFixed(5));
  reply.hinge = Number((reply.baseHinge - event.afterHinge * 0.32).toFixed(5));
  reply.shadowOffset = Number((reply.shadowOffset + event.shadowOffset).toFixed(5));
  reply.shadowAngle = Number((reply.shadowAngle + event.afterHinge * 0.45).toFixed(5));
  scene.trace.shadowMisreadCount += 1;
  scene.trace.changedPlaneCount += 2;
  scene.trace.shadowOffsetTotal = Number((scene.trace.shadowOffsetTotal + event.shadowOffset).toFixed(5));
  scene.trace.nextRule = 'reconstruct-from-wrong-shadow';
}

export function buildScene(memory = []) {
  const scene = baseScene();
  normalizeMemory(memory).forEach((event) => applyMisread(scene, event));
  return scene;
}

export function buildFrame(stage = 0, memory = []) {
  const boundedMemory = normalizeMemory(memory);
  return {
    stage: clampStage(stage),
    stages: STAGES,
    memory: boundedMemory,
    primitiveCount: PRIMITIVE_BUDGET,
    scene: buildScene(boundedMemory),
    interaction: 'sequence'
  };
}

function chooseFocus(scene, requested) {
  if (Number.isInteger(requested) && requested >= 0 && requested < PLANE_COUNT) return requested;
  const fallback = [2, 6, 1, 7, 4, 0, 5, 3, 8];
  const occupied = new Set((scene?.planes ?? []).filter((plane) => plane.shadowOffset !== 0).map((plane) => Number(plane.id.slice(-2))));
  return fallback.find((index) => !occupied.has(index)) ?? fallback[0];
}

function chooseReply(focusIndex, sequence) {
  let reply = (focusIndex + 3 + sequence * 2) % PLANE_COUNT;
  if (reply === focusIndex) reply = (reply + 1) % PLANE_COUNT;
  return reply;
}

function eventFor(frame, requestedFocus) {
  const focusIndex = chooseFocus(frame.scene, requestedFocus);
  const sequence = frame.memory.length;
  const focus = frame.scene.planes[focusIndex];
  const replyIndex = chooseReply(focusIndex, sequence);
  const direction = sequence % 2 === 0 ? 1 : -1;
  const afterDepth = Number((focus.depth + direction * (0.19 + sequence * 0.025)).toFixed(5));
  const afterHinge = Number((focus.hinge + direction * (0.26 + sequence * 0.035)).toFixed(5));
  return {
    source: 'approach-departure-shadow',
    sequence,
    focusIndex,
    replyIndex,
    beforeDepth: focus.depth,
    afterDepth,
    beforeHinge: focus.hinge,
    afterHinge,
    shadowOffset: Number((0.17 + sequence * 0.035).toFixed(5)),
    reason: 'the distant plane reconstructs from the wrong shadow'
  };
}

export function commitMisread(frame, { focusIndex = null } = {}) {
  const current = frame ?? buildFrame(0, []);
  const event = eventFor(current, focusIndex);
  const nextMemory = normalizeMemory([...current.memory, event]);
  return {
    ...buildFrame(Math.min(STAGES - 1, current.stage + 1), nextMemory),
    interaction: 'misread-committed'
  };
}

export function liftLatestMisread(frame) {
  const current = frame ?? buildFrame(0, []);
  if (!current.memory.length) return { ...current, interaction: 'misread-lifted' };
  return {
    ...buildFrame(Math.max(0, current.stage - 1), current.memory.slice(0, -1)),
    interaction: 'misread-lifted'
  };
}

export function releaseMisread() {
  return { ...buildFrame(0, []), interaction: 'released' };
}

export function geometrySignature(frame) {
  const scene = frame?.scene ?? buildScene([]);
  return JSON.stringify({
    planes: scene.planes.map((plane) => ({
      id: plane.id,
      x: plane.x,
      y: plane.y,
      depth: plane.depth,
      hinge: plane.hinge,
      shadowOffset: plane.shadowOffset,
      shadowAngle: plane.shadowAngle
    })),
    trace: scene.trace
  });
}

export function buildTimeline() {
  const timeline = [];
  let frame = buildFrame(0, []);
  for (let stage = 0; stage < STAGES; stage += 1) {
    timeline.push({ ...frame, stage });
    if (stage < STAGES - 1) frame = commitMisread(frame);
  }
  return timeline;
}

export function planeAt(frame, index) {
  return frame?.scene?.planes?.[index] ? copyPlane(frame.scene.planes[index]) : null;
}
