export const SEED = 0x4e413232;
export const STAGES = 18;
export const MEMORY_WINDOW = 4;
export const PRIMITIVE_BUDGET = 42;

export const SLOTS = [
  { id: 'upper-left', x: 0.10, y: 0.15, w: 0.21, h: 0.20, tone: '#d86f58', motif: 'sun' },
  { id: 'upper-centre', x: 0.36, y: 0.08, w: 0.20, h: 0.24, tone: '#e5ac4c', motif: 'flag' },
  { id: 'upper-right', x: 0.67, y: 0.16, w: 0.22, h: 0.19, tone: '#5d9388', motif: 'hill' },
  { id: 'middle-left', x: 0.06, y: 0.43, w: 0.23, h: 0.23, tone: '#7692ad', motif: 'ladder' },
  { id: 'middle', x: 0.38, y: 0.36, w: 0.23, h: 0.25, tone: '#a4779a', motif: 'moon' },
  { id: 'middle-right', x: 0.70, y: 0.42, w: 0.23, h: 0.23, tone: '#c49165', motif: 'house' },
  { id: 'lower-left', x: 0.17, y: 0.72, w: 0.22, h: 0.18, tone: '#8a9d70', motif: 'river' },
  { id: 'lower-centre', x: 0.46, y: 0.70, w: 0.19, h: 0.19, tone: '#cf7a65', motif: 'kite' },
  { id: 'lower-right', x: 0.72, y: 0.70, w: 0.21, h: 0.18, tone: '#657e9d', motif: 'star' }
];

function clampStage(stage) {
  return Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0)));
}

function cloneEvent(event) {
  return { ...event };
}

function normalizeMemory(memory) {
  return (Array.isArray(memory) ? memory : []).slice(-MEMORY_WINDOW).map(cloneEvent);
}

function copyPiece(piece) {
  return { ...piece };
}

function baseScene() {
  return {
    slots: SLOTS.map((slot) => `piece-${slot.id}`),
    pieces: SLOTS.map((slot, index) => ({
      id: `piece-${slot.id}`,
      slotIndex: index,
      railIndex: null,
      tone: slot.tone,
      motif: slot.motif,
      tilt: (index % 2 ? -1 : 1) * (2 + (index % 3) * 1.4)
    })),
    trace: {
      layoutChanges: 0,
      pointerOnlyChanges: 0,
      vacancyCount: 0,
      railCount: 0,
      wrongPlacements: 0,
      grammar: 'drag → wrong slot → displaced margin → reflow'
    }
  };
}

function applyMisread(scene, event, order) {
  const source = scene.pieces.find((piece) => piece.id === event.sourcePieceId);
  const targetIndex = Number(event.targetIndex);
  const displaced = scene.pieces.find((piece) => piece.id === scene.slots[targetIndex]);
  if (!source || !displaced || source === displaced || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= scene.slots.length) return;

  if (Number.isInteger(source.slotIndex)) scene.slots[source.slotIndex] = null;
  if (Number.isInteger(displaced.slotIndex)) scene.slots[displaced.slotIndex] = null;
  source.slotIndex = targetIndex;
  source.railIndex = null;
  displaced.slotIndex = null;
  displaced.railIndex = order;
  scene.slots[targetIndex] = source.id;
  scene.trace.layoutChanges += 3;
  scene.trace.wrongPlacements += 1;
}

export function buildScene(memory = []) {
  const scene = baseScene();
  normalizeMemory(memory).forEach((event, index) => applyMisread(scene, event, index));
  scene.trace.vacancyCount = scene.slots.filter((pieceId) => pieceId === null).length;
  scene.trace.railCount = scene.pieces.filter((piece) => piece.railIndex !== null).length;
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

function findSourceSlot(scene, requested) {
  if (Number.isInteger(requested) && requested >= 0 && requested < scene.slots.length && scene.slots[requested]) return requested;
  const fallback = [1, 4, 6, 3, 8, 0, 5, 2, 7];
  return fallback.find((index) => scene.slots[index]) ?? 0;
}

function findTargetSlot(scene, sourceIndex, requested) {
  if (Number.isInteger(requested) && requested >= 0 && requested < scene.slots.length && requested !== sourceIndex && scene.slots[requested]) return requested;
  const candidates = [7, 2, 8, 0, 6, 5, 3, 1, 4];
  return candidates.find((index) => index !== sourceIndex && scene.slots[index]) ?? ((sourceIndex + 1) % scene.slots.length);
}

function eventFor(scene, sourceIndex, targetIndex) {
  const sourceSlot = findSourceSlot(scene, sourceIndex);
  const targetSlot = findTargetSlot(scene, sourceSlot, targetIndex);
  return {
    source: 'dragged-misread',
    sourceIndex: sourceSlot,
    targetIndex: targetSlot,
    sourcePieceId: scene.slots[sourceSlot],
    displacedPieceId: scene.slots[targetSlot],
    sequence: scene.trace.wrongPlacements,
    reason: 'the picture learned the wrong slot'
  };
}

export function commitMisread(frame, { sourceIndex = null, targetIndex = null } = {}) {
  const current = frame ?? buildFrame(0, []);
  const event = eventFor(current.scene, sourceIndex, targetIndex);
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
    slots: scene.slots,
    pieces: scene.pieces.map((piece) => ({ id: piece.id, slotIndex: piece.slotIndex, railIndex: piece.railIndex })),
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

export function pieceAtSlot(frame, slotIndex) {
  const id = frame?.scene?.slots?.[slotIndex];
  return frame?.scene?.pieces?.find((piece) => piece.id === id) ?? null;
}
