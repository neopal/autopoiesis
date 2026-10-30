export const SEED = 0x57475039;
export const RESERVOIR_COUNT = 17;
export const MEMORY_LIMIT = 4;
export const STAGES = MEMORY_LIMIT + 1;
export const MIN_PRESSURE = 0.35;
export const MAX_PRESSURE = 0.94;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const wrap = (value, size) => ((value % size) + size) % size;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.731 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};

const clampPoint = (point = {}, fallbackX = 0.5, fallbackY = 0.5) => ({
  x: clamp(finite(point.x, fallbackX), 0, 1),
  y: clamp(finite(point.y, fallbackY), 0, 1)
});

const anchors = [
  [0.19, 0.22, 0.105, -0.22], [0.39, 0.16, 0.085, 0.42], [0.63, 0.2, 0.12, -0.12], [0.83, 0.29, 0.095, 0.66],
  [0.12, 0.43, 0.11, 0.31], [0.34, 0.36, 0.135, -0.48], [0.55, 0.35, 0.115, 0.24], [0.76, 0.43, 0.14, -0.58],
  [0.91, 0.54, 0.085, 0.18], [0.2, 0.62, 0.13, 0.54], [0.43, 0.57, 0.105, -0.31], [0.63, 0.6, 0.125, 0.46],
  [0.82, 0.69, 0.11, -0.26], [0.12, 0.82, 0.09, -0.52], [0.34, 0.79, 0.12, 0.17], [0.59, 0.83, 0.1, 0.62],
  [0.84, 0.86, 0.125, -0.08]
];

const pointIndex = (point) => {
  const normalized = clampPoint(point);
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  anchors.forEach(([x, y], index) => {
    const candidate = (normalized.x - x) ** 2 + (normalized.y - y) ** 2;
    if (candidate < distance) {
      distance = candidate;
      nearest = index;
    }
  });
  return nearest;
};

const bodyPoints = (body) => {
  const points = [];
  const count = body.vertexCount ?? 9;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + body.rotation;
    const wobble = 0.86 + pseudo(body.id * 31 + index * 7 + 3) * 0.22;
    const pinch = 1 - body.notch * Math.max(0, Math.cos(angle - body.notchAngle)) ** 6;
    const radius = body.size * wobble * pinch;
    const x = body.x + Math.cos(angle) * radius * body.aspect;
    const y = body.y + Math.sin(angle) * radius / body.aspect;
    points.push({ x: round(clamp(x, 0.015, 0.985)), y: round(clamp(y, 0.015, 0.985)) });
  }
  return points;
};

const makeBody = (id, values = {}) => {
  const [x, y, size, rotation] = anchors[id];
  const body = {
    id,
    x: round(x),
    y: round(y),
    size: round(finite(values.size, size)),
    scale: round(finite(values.scale, 1)),
    aspect: round(finite(values.aspect, 0.82 + pseudo(id + 41) * 0.42)),
    rotation: round(finite(values.rotation, rotation)),
    notch: round(clamp(finite(values.notch, 0.12 + pseudo(id + 53) * 0.34), 0, 0.82)),
    notchAngle: round(finite(values.notchAngle, -1.4 + pseudo(id + 67) * 2.8)),
    pressure: round(clamp(finite(values.pressure, 0.28 + pseudo(id + 79) * 0.42), 0.08, 0.98)),
    vertexCount: 9,
    hue: round(18 + pseudo(id + 97) * 48)
  };
  body.vertices = bodyPoints(body);
  return body;
};

const baseBodies = () => anchors.map((_, id) => makeBody(id));

const baseVoid = () => {
  const points = [];
  const center = { x: 0.52, y: 0.51 };
  for (let index = 0; index < 11; index += 1) {
    const angle = (index / 11) * Math.PI * 2 - 0.16;
    const radius = 0.115 + pseudo(index * 19 + 11) * 0.045;
    points.push({
      x: round(center.x + Math.cos(angle) * radius * 1.05),
      y: round(center.y + Math.sin(angle) * radius * 0.76)
    });
  }
  return {
    center,
    aperture: 0.82,
    twist: -0.16,
    points,
    signature: JSON.stringify(points)
  };
};

const voidPoints = (voidState) => {
  const points = [];
  for (let index = 0; index < 11; index += 1) {
    const angle = (index / 11) * Math.PI * 2 - 0.16 + voidState.twist;
    const baseRadius = 0.115 + pseudo(index * 19 + 11) * 0.045;
    const radius = baseRadius * (0.7 + voidState.aperture * 0.44);
    points.push({
      x: round(clamp(voidState.center.x + Math.cos(angle) * radius * 1.08, 0.02, 0.98)),
      y: round(clamp(voidState.center.y + Math.sin(angle) * radius * 0.74, 0.02, 0.98))
    });
  }
  return points;
};

const bodyDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const chooseReceiver = (sourceIndex, targetIndex, serial) => {
  const source = anchors[sourceIndex];
  const target = anchors[targetIndex];
  const axis = { x: target[0] - source[0], y: target[1] - source[1] };
  let receiver = wrap(sourceIndex * 7 + targetIndex * 11 + (serial + 1) * 5 + 3, RESERVOIR_COUNT);
  for (let attempt = 0; attempt < RESERVOIR_COUNT; attempt += 1) {
    const candidate = (receiver + attempt * 3) % RESERVOIR_COUNT;
    if (candidate === sourceIndex || candidate === targetIndex) continue;
    const candidateAnchor = anchors[candidate];
    const side = axis.x * (candidateAnchor[1] - source[1]) - axis.y * (candidateAnchor[0] - source[0]);
    if (Math.abs(side) > 0.07) return candidate;
  }
  return receiver === sourceIndex || receiver === targetIndex ? wrap(receiver + 4, RESERVOIR_COUNT) : receiver;
};

const normalizeEvent = (event = {}, serial = 0) => {
  const source = clampPoint(event.source, anchors[(serial * 3) % RESERVOIR_COUNT][0], anchors[(serial * 3) % RESERVOIR_COUNT][1]);
  const target = clampPoint(event.target, anchors[(serial * 5 + 4) % RESERVOIR_COUNT][0], anchors[(serial * 5 + 4) % RESERVOIR_COUNT][1]);
  const sourceIndex = integer(event.sourceIndex, pointIndex(source), 0, RESERVOIR_COUNT - 1);
  const targetIndex = integer(event.targetIndex, pointIndex(target), 0, RESERVOIR_COUNT - 1);
  const safeTargetIndex = targetIndex === sourceIndex ? wrap(targetIndex + 5 + serial, RESERVOIR_COUNT) : targetIndex;
  const pressure = round(clamp(finite(event.pressure, 0.68), MIN_PRESSURE, MAX_PRESSURE));
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  return {
    id: `pressure-pair-${serial + 1}`,
    mode: 'pressure-pair',
    source,
    target,
    sourceIndex,
    targetIndex: safeTargetIndex,
    receiverIndex: chooseReceiver(sourceIndex, safeTargetIndex, serial),
    polarity: dx * 0.8 + dy * 1.2 >= 0 ? 1 : -1,
    reach: round(clamp(Math.hypot(dx, dy), 0.12, 1.4)),
    pressure,
    serial
  };
};

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const cloneBody = (body) => ({ ...body, vertices: body.vertices.map((point) => ({ ...point })) });

const buildField = (memory) => {
  let bodies = baseBodies();
  let voidState = baseVoid();
  const relays = [];

  normalizeMemory(memory).forEach((event, serial) => {
    const previous = bodies.map(cloneBody);
    const receiver = previous[event.receiverIndex];
    const polarity = event.polarity;

    bodies = previous.map((body, index) => {
      if (index === event.sourceIndex || index === event.targetIndex) return cloneBody(body);
      const distance = bodyDistance(body, receiver);
      const influence = Math.exp(-(distance * distance) / (0.035 + serial * 0.011));
      const remote = index === event.receiverIndex ? 1 : influence * 0.25;
      const neighbour = Math.sin((body.id + 1) * 1.7 + serial * 1.3 + event.reach * 4) * influence;
      const next = {
        ...body,
        scale: round(clamp(body.scale + polarity * remote * (0.12 + event.pressure * 0.1) + neighbour * 0.03, 0.66, 1.46)),
        aspect: round(clamp(body.aspect + polarity * remote * 0.11 + neighbour * 0.02, 0.56, 1.54)),
        rotation: round(body.rotation + polarity * remote * 0.26 + neighbour * 0.07),
        notch: round(clamp(body.notch + remote * (0.1 + serial * 0.012) - polarity * neighbour * 0.04, 0.03, 0.82)),
        notchAngle: round(body.notchAngle + polarity * remote * 0.23),
        pressure: round(clamp(body.pressure + polarity * remote * event.pressure * 0.22, 0.05, 0.98))
      };
      next.vertices = bodyPoints({ ...next, size: body.size * next.scale });
      return next;
    });

    const voidDrift = polarity * (0.018 + event.pressure * 0.024) * (serial + 1);
    voidState = {
      ...voidState,
      center: {
        x: round(clamp(voidState.center.x + voidDrift * (event.target.x - 0.5), 0.34, 0.68)),
        y: round(clamp(voidState.center.y + voidDrift * (event.source.y - 0.5), 0.3, 0.7))
      },
      aperture: round(clamp(voidState.aperture + polarity * (0.09 + event.pressure * 0.06), 0.4, 1.42)),
      twist: round(voidState.twist + polarity * 0.1 + event.reach * 0.06)
    };
    voidState.points = voidPoints(voidState);
    voidState.signature = JSON.stringify(voidState.points);
    relays.push(`${event.sourceIndex}>${event.targetIndex}>${event.receiverIndex}:${event.pressure.toFixed(3)}:${event.polarity}`);
  });

  const voidSignature = JSON.stringify({ center: voidState.center, aperture: voidState.aperture, twist: voidState.twist, points: voidState.points });
  const signature = JSON.stringify({ relays: relays.join('|') || 'quiet', bodies: bodies.map((body) => ({ id: body.id, scale: body.scale, aspect: body.aspect, rotation: body.rotation, notch: body.notch, pressure: body.pressure, vertices: body.vertices })) , voidSignature });
  return {
    kind: 'pressure-reservoir',
    bodies,
    void: voidState,
    voidSignature,
    relays: relays.join('|') || 'quiet',
    signature
  };
};

const normalizePair = (pair) => {
  if (!pair) return null;
  return {
    source: clampPoint(pair.source),
    target: pair.target ? clampPoint(pair.target) : null,
    sourceIndex: integer(pair.sourceIndex, pointIndex(pair.source), 0, RESERVOIR_COUNT - 1),
    targetIndex: pair.target ? integer(pair.targetIndex, pointIndex(pair.target), 0, RESERVOIR_COUNT - 1) : null
  };
};

export const buildFrame = (stage = 0, memory = [], pair = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    pair: normalizePair(pair),
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const beginPair = (frame, input = {}) => {
  const point = clampPoint(input);
  const index = pointIndex(point);
  if (frame.pair?.sourceIndex != null && frame.pair.targetIndex == null) {
    if (index === frame.pair.sourceIndex) return { ...frame, lastAction: 'pair-refused-same-body' };
    return { ...frame, pair: { ...frame.pair, target: point, targetIndex: index }, lastAction: 'pair-target-chosen' };
  }
  return { ...frame, pair: { source: point, target: null, sourceIndex: index, targetIndex: null }, lastAction: 'pair-source-chosen' };
};

export const aimPair = (frame, input = {}) => {
  if (!frame.pair) return frame;
  const point = clampPoint(input, frame.pair.source.x, frame.pair.source.y);
  const targetIndex = pointIndex(point);
  if (targetIndex === frame.pair.sourceIndex) return { ...frame, lastAction: 'pair-refused-same-body' };
  return { ...frame, pair: { ...frame.pair, target: point, targetIndex }, lastAction: 'pair-target-aimed' };
};

export const finishPair = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, pair: null, lastAction: 'pair-refused-memory-limit' };
  if (!frame.pair?.target || frame.pair.targetIndex == null) return { ...frame, pair: null, lastAction: 'pair-refused-incomplete' };
  if (frame.pair.sourceIndex === frame.pair.targetIndex) return { ...frame, pair: null, lastAction: 'pair-refused-same-body' };
  if (input.confirmed === false) return { ...frame, pair: null, lastAction: 'pair-refused-unconfirmed' };
  const event = normalizeEvent({
    source: frame.pair.source,
    target: frame.pair.target,
    sourceIndex: frame.pair.sourceIndex,
    targetIndex: frame.pair.targetIndex,
    pressure: input.pressure
  }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'pair-compressed');
};

export const liftLatestPair = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'pair-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultPair = (frame) => {
  const pairs = [
    { source: { x: 0.19, y: 0.22 }, target: { x: 0.82, y: 0.69 }, pressure: 0.62 },
    { source: { x: 0.76, y: 0.43 }, target: { x: 0.34, y: 0.79 }, pressure: 0.79 },
    { source: { x: 0.39, y: 0.16 }, target: { x: 0.12, y: 0.43 }, pressure: 0.54 },
    { source: { x: 0.63, y: 0.6 }, target: { x: 0.2, y: 0.62 }, pressure: 0.88 }
  ];
  return pairs[frame.memory.length % pairs.length];
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    const pair = defaultPair(frame);
    frame = finishPair(aimPair(beginPair(frame, pair.source), pair.target), { confirmed: true, pressure: pair.pressure });
    timeline.push(buildFrame(stage, frame.memory, null, frame.memory.length ? 'settled-archive' : 'quiet'));
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, void: frame.field.voidSignature });
export const reservoirPoints = () => anchors.map(([x, y], id) => ({ id, x, y }));
