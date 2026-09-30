export const STAGES = 17;
export const MAX_MEMORY = 4;

export const ROOMS = [
  { id: 'north-west', x: 145, y: 126, w: 218, h: 158, tilt: -0.06, color: '#c96e58', points: [[0.08,0.86],[0.02,0.34],[0.28,0.06],[0.78,0.02],[0.98,0.34],[0.84,0.90],[0.42,0.98]] },
  { id: 'north', x: 386, y: 82, w: 230, h: 174, tilt: 0.03, color: '#d6a84c', points: [[0.02,0.30],[0.38,0.02],[0.86,0.08],[0.98,0.42],[0.77,0.97],[0.24,0.88],[0.06,0.62]] },
  { id: 'north-east', x: 650, y: 148, w: 205, h: 164, tilt: 0.08, color: '#6b9b90', points: [[0.16,0.03],[0.82,0.08],[0.98,0.46],[0.76,0.98],[0.30,0.88],[0.03,0.60],[0.04,0.24]] },
  { id: 'west', x: 92, y: 362, w: 214, h: 186, tilt: 0.04, color: '#7d8fa7', points: [[0.06,0.18],[0.46,0.02],[0.93,0.18],[0.97,0.70],[0.62,0.98],[0.15,0.88],[0.02,0.48]] },
  { id: 'middle', x: 382, y: 320, w: 238, h: 190, tilt: -0.02, color: '#b77ea0', points: [[0.18,0.03],[0.74,0.00],[0.99,0.36],[0.87,0.84],[0.48,0.99],[0.08,0.76],[0.02,0.28]] },
  { id: 'east', x: 676, y: 366, w: 224, h: 188, tilt: -0.07, color: '#c7a279', points: [[0.04,0.28],[0.32,0.02],[0.82,0.08],[0.98,0.40],[0.86,0.86],[0.42,0.98],[0.08,0.74]] },
  { id: 'south', x: 286, y: 586, w: 276, h: 134, tilt: 0.02, color: '#8d9b68', points: [[0.02,0.28],[0.26,0.04],[0.80,0.02],[0.98,0.36],[0.86,0.90],[0.30,0.98],[0.06,0.70]] }
];

const SIDES = ['north', 'east', 'south', 'west'];

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function cloneEvent(event) {
  return { ...event };
}

function normalizeMemory(memory) {
  return (Array.isArray(memory) ? memory : []).slice(-MAX_MEMORY).map(cloneEvent);
}

export function eventFor(roomIndex = 0, sequence = 0, direction = 1) {
  const sourceIndex = positiveModulo(Number.isInteger(roomIndex) ? roomIndex : 0, ROOMS.length);
  const sign = direction < 0 ? -1 : 1;
  const receiverOffset = sign < 0 ? 2 : 3;
  const receiverIndex = positiveModulo(sourceIndex + receiverOffset + sequence, ROOMS.length);
  const sourceSideIndex = positiveModulo(sourceIndex + sequence + (sign < 0 ? 3 : 0), SIDES.length);
  const receiverSideIndex = positiveModulo(sourceSideIndex + (sign < 0 ? 1 : 2), SIDES.length);
  return {
    source: 'situated-attention',
    roomIndex: sourceIndex,
    receiverIndex,
    sourceSide: SIDES[sourceSideIndex],
    receiverSide: SIDES[receiverSideIndex],
    sequence,
    direction: sign
  };
}

function baseScene() {
  return {
    rooms: ROOMS.map((room) => ({
      ...room,
      openings: [],
      closures: [],
      attention: 0,
      replies: 0
    })),
    trace: {
      topologyChanges: 0,
      pointerOnlyChanges: 0,
      attentionCount: 0,
      wrongReplies: 0
    }
  };
}

function applyEvent(scene, event, order) {
  const source = scene.rooms[event.roomIndex];
  const receiver = scene.rooms[event.receiverIndex];
  if (!source || !receiver) return;
  source.openings.push({ side: event.sourceSide, order });
  source.attention += 1;
  receiver.closures.push({ side: event.receiverSide, order });
  receiver.replies += 1;
  scene.trace.topologyChanges += 2;
  scene.trace.attentionCount += 1;
  scene.trace.wrongReplies += 1;
}

export function buildScene(memory = []) {
  const scene = baseScene();
  normalizeMemory(memory).forEach((event, index) => applyEvent(scene, event, index));
  return scene;
}

export function buildFrame(stage = 0, memory = []) {
  const boundedStage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(stage) || 0)));
  const boundedMemory = normalizeMemory(memory);
  return {
    stage: boundedStage,
    stages: STAGES,
    memory: boundedMemory,
    scene: buildScene(boundedMemory),
    interaction: 'sequence'
  };
}

export function commitAttention(frame, { roomIndex = null, direction = 1 } = {}) {
  const current = frame ?? buildFrame(0, []);
  const sequence = current.memory.length;
  const fallbackRoom = positiveModulo(sequence * 2 + 1, ROOMS.length);
  const selectedRoom = Number.isInteger(roomIndex) ? roomIndex : fallbackRoom;
  const event = eventFor(selectedRoom, sequence, direction);
  const nextMemory = normalizeMemory([...current.memory, event]);
  return {
    ...buildFrame(Math.min(STAGES - 1, current.stage + 1), nextMemory),
    interaction: 'attention-committed'
  };
}

export function liftLatestAttention(frame) {
  const current = frame ?? buildFrame(0, []);
  if (!current.memory.length) return { ...current, interaction: 'attention-lifted' };
  return {
    ...buildFrame(Math.max(0, current.stage - 1), current.memory.slice(0, -1)),
    interaction: 'attention-lifted'
  };
}

export function releaseAttention() {
  return { ...buildFrame(0, []), interaction: 'released' };
}

export function geometrySignature(frame) {
  const scene = frame?.scene ?? buildScene([]);
  return JSON.stringify({
    rooms: scene.rooms.map((room) => ({
      id: room.id,
      openings: room.openings.map((entry) => entry.side),
      closures: room.closures.map((entry) => entry.side),
      attention: room.attention,
      replies: room.replies
    })),
    trace: scene.trace
  });
}

export function buildTimeline() {
  return Array.from({ length: STAGES }, (_, stage) => {
    const eventCount = Math.min(MAX_MEMORY, Math.floor(stage / 4));
    const memory = Array.from({ length: eventCount }, (_, index) => eventFor((index * 2 + 1) % ROOMS.length, index, 1));
    return buildFrame(stage, memory);
  });
}

export function roomPolygon(room) {
  return room.points.map(([x, y]) => ({ x: room.x + room.w * x, y: room.y + room.h * y }));
}

export function roomGeometry(room, openingSides = [], closureSides = []) {
  return {
    room,
    openingSides: [...openingSides],
    closureSides: [...closureSides],
    signature: `${room.id}:${openingSides.join(',')}:${closureSides.join(',')}`
  };
}
