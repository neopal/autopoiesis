const VIEWBOX = { width: 1200, height: 760 };

const PORT_LAYOUT = [
  { index: 0, x: 210, y: 480, rotation: -32 },
  { index: 1, x: 410, y: 260, rotation: 12 },
  { index: 2, x: 600, y: 520, rotation: -16 },
  { index: 3, x: 790, y: 250, rotation: 18 },
  { index: 4, x: 990, y: 470, rotation: -28 }
];

export const VIEWBOX_SIZE = VIEWBOX;
export const PORT_COUNT = PORT_LAYOUT.length;
export const MEMORY_WINDOW = 4;
export const LOOK_THRESHOLD = 560;

const round = (value) => Math.round(value * 1000) / 1000;
const rotate = (x, y, radians) => ({
  x: round(x * Math.cos(radians) - y * Math.sin(radians)),
  y: round(x * Math.sin(radians) + y * Math.cos(radians))
});
const point = (layout, x, y) => {
  const rotated = rotate(x, y, (layout.rotation * Math.PI) / 180);
  return { x: round(layout.x + rotated.x), y: round(layout.y + rotated.y) };
};
const pathFromPoints = (points) => `M ${points.map(({ x, y }) => `${round(x)} ${round(y)}`).join(' L ')}`;
const formatPoint = ({ x, y }) => `${round(x)} ${round(y)}`;

function normalizeMemory(memory) {
  if (!Array.isArray(memory)) return [];
  return memory.slice(-MEMORY_WINDOW).map((event, index) => ({
    type: 'reciprocal-reply',
    sourcePort: Number.isInteger(event.sourcePort) ? Math.max(0, Math.min(PORT_COUNT - 1, event.sourcePort)) : 0,
    replyPort: Number.isInteger(event.replyPort) ? Math.max(0, Math.min(PORT_COUNT - 1, event.replyPort)) : 1,
    segmentIndex: Number.isInteger(event.segmentIndex) ? Math.max(0, Math.min(PORT_COUNT - 2, event.segmentIndex)) : index % (PORT_COUNT - 1),
    depth: Number.isFinite(event.depth) ? event.depth : 42 + index * 10,
    polarity: event.polarity === -1 ? -1 : 1,
    order: Number.isInteger(event.order) ? event.order : index + 1
  }));
}

function replyPortFor(sourcePort, memoryLength) {
  let replyPort = (sourcePort * 3 + memoryLength + 1) % PORT_COUNT;
  if (replyPort === sourcePort) replyPort = (replyPort + 1) % PORT_COUNT;
  return replyPort;
}

function eventFor(sourcePort, memoryLength) {
  const replyPort = replyPortFor(sourcePort, memoryLength);
  const segmentIndex = (sourcePort + replyPort + memoryLength) % (PORT_COUNT - 1);
  return {
    type: 'reciprocal-reply',
    sourcePort,
    replyPort,
    segmentIndex,
    depth: 42 + memoryLength * 13,
    polarity: sourcePort < replyPort ? 1 : -1,
    order: memoryLength + 1
  };
}

function latestReplyFor(portIndex, memory) {
  return [...memory].reverse().find((event) => event.replyPort === portIndex) ?? null;
}

function buildPort(layout, memory) {
  const reply = latestReplyFor(layout.index, memory);
  const sign = reply?.polarity ?? 1;
  const reach = 32 + (reply ? reply.depth * 0.52 : 0);
  const branch = reply ? 22 + reply.depth * 0.22 : 0;
  const left = point(layout, -32, -16);
  const tip = point(layout, 0, 0);
  const right = point(layout, -32, 16);
  const tail = point(layout, reach, 0);
  const paths = [
    `M ${formatPoint(left)} L ${formatPoint(tip)} L ${formatPoint(right)}`,
    `M ${formatPoint(tip)} L ${formatPoint(tail)}`
  ];
  if (reply) paths.push(`M ${formatPoint(tip)} L ${formatPoint(point(layout, sign * branch, 28 + reply.depth * 0.08))}`);
  return {
    ...layout,
    state: reply ? 'replying' : 'quiet',
    path: paths.join(' '),
    signature: `${layout.index}:${reply ? `reply:${reply.order}:${reply.depth}:${reply.polarity}` : 'quiet'}:${paths.join('|')}`
  };
}

function buildSpine(memory) {
  const segments = [];
  for (let index = 0; index < PORT_LAYOUT.length - 1; index += 1) {
    const start = PORT_LAYOUT[index];
    const end = PORT_LAYOUT[index + 1];
    const reply = memory.filter((event) => event.segmentIndex === index).at(-1);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const base = index % 2 === 0 ? 0.22 : -0.2;
    const bend = (reply ? reply.depth * reply.polarity : 0) + base * length;
    const c1 = {
      x: start.x + dx * 0.32 + normalX * bend,
      y: start.y + dy * 0.32 + normalY * bend
    };
    const c2 = {
      x: start.x + dx * 0.74 - normalX * bend * 0.76,
      y: start.y + dy * 0.74 - normalY * bend * 0.76
    };
    const endPoint = { x: end.x, y: end.y };
    segments.push(index === 0
      ? `M ${formatPoint(start)} C ${formatPoint(c1)} ${formatPoint(c2)} ${formatPoint(endPoint)}`
      : `C ${formatPoint(c1)} ${formatPoint(c2)} ${formatPoint(endPoint)}`);
  }
  return segments.join(' ');
}

function buildFrameFromMemory(memory, interaction = null, event = null) {
  const normalizedMemory = normalizeMemory(memory);
  return {
    grammar: 'reciprocal-glyph',
    spinePath: buildSpine(normalizedMemory),
    ports: PORT_LAYOUT.map((layout) => buildPort(layout, normalizedMemory)),
    memory: normalizedMemory,
    pending: null,
    interaction: interaction ?? (normalizedMemory.length ? 'settled' : 'quiet'),
    event,
    state: {
      replyCount: normalizedMemory.length,
      lastSource: normalizedMemory.at(-1)?.sourcePort ?? null,
      lastReply: normalizedMemory.at(-1)?.replyPort ?? null,
      threshold: LOOK_THRESHOLD
    }
  };
}

export function buildFrame(memory = []) {
  return buildFrameFromMemory(memory);
}

export function geometrySignature(frame) {
  return [frame.spinePath, ...frame.ports.map((port) => port.signature)].join('|');
}

export function portAtPoint(frame, position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const port of frame.ports) {
    const dx = position.x - port.x;
    const dy = position.y - port.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 76 && distance < nearestDistance) {
      nearest = port.index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function beginLook(frame, sourcePort) {
  if (!Number.isInteger(sourcePort) || sourcePort < 0 || sourcePort >= PORT_COUNT) {
    return { ...frame, interaction: 'look-refused-miss', event: { type: 'look-refused-miss' } };
  }
  return {
    ...frame,
    pending: { sourcePort, elapsed: 0, armed: false },
    interaction: 'look-started',
    event: null
  };
}

export function advanceLook(frame, elapsedMs) {
  if (!frame.pending) return { ...frame, interaction: 'look-refused-unarmed' };
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const armed = elapsed >= LOOK_THRESHOLD;
  return {
    ...frame,
    pending: { ...frame.pending, elapsed, armed },
    interaction: armed ? 'look-armed' : 'look-waiting',
    event: null
  };
}

export function leaveLook(frame, sourcePort) {
  if (!frame.pending) return { ...frame, interaction: 'look-refused-unarmed', event: { type: 'look-refused-unarmed' } };
  if (frame.pending.sourcePort !== sourcePort) {
    return { ...frame, pending: null, interaction: 'look-refused-crossed', event: { type: 'look-refused-crossed' } };
  }
  if (!frame.pending.armed) {
    return { ...frame, pending: null, interaction: 'look-refused-short', event: { type: 'look-refused-short', sourcePort } };
  }
  if (frame.memory.at(-1)?.sourcePort === sourcePort) {
    return { ...frame, pending: null, interaction: 'look-refused-repeat', event: { type: 'look-refused-repeat', sourcePort } };
  }
  const event = eventFor(sourcePort, frame.memory.length);
  const next = buildFrameFromMemory([...frame.memory, event], 'look-committed', event);
  return next;
}

export function completeLook(frame, sourcePort, elapsedMs, departed = true) {
  const started = beginLook(frame, sourcePort);
  const advanced = advanceLook(started, elapsedMs);
  if (!departed) {
    return { ...advanced, pending: null, interaction: 'look-refused-no-departure', event: { type: 'look-refused-no-departure', sourcePort } };
  }
  return leaveLook(advanced, sourcePort);
}

export function commitLook(frame, sourcePort) {
  return completeLook(frame, sourcePort, LOOK_THRESHOLD, true);
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  for (const sourcePort of [0, 2, 4, 1]) timeline.push(commitLook(timeline.at(-1), sourcePort));
  return timeline;
}

export function liftLatestReply(frame) {
  if (!frame.memory.length) return frame;
  return buildFrameFromMemory(frame.memory.slice(0, -1), 'reply-lifted');
}

export function releaseGlyph() {
  return buildFrame();
}
