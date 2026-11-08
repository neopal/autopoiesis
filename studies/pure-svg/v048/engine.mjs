const VIEWBOX = { width: 1200, height: 760 };
const GATE_POINTS = [
  { index: 0, x: 246, y: 548 },
  { index: 1, x: 596, y: 166 },
  { index: 2, x: 956, y: 512 }
];
const OUTER_POINTS = [
  { x: 238, y: 260 },
  { x: 408, y: 150 },
  { x: 574, y: 214 },
  { x: 744, y: 130 },
  { x: 966, y: 264 },
  { x: 882, y: 408 },
  { x: 1002, y: 548 },
  { x: 720, y: 616 },
  { x: 562, y: 542 },
  { x: 384, y: 634 },
  { x: 198, y: 510 },
  { x: 300, y: 392 }
];
const APERTURE_POINTS = [
  [
    { x: 344, y: 300 }, { x: 430, y: 248 }, { x: 492, y: 292 },
    { x: 452, y: 382 }, { x: 362, y: 394 }
  ],
  [
    { x: 574, y: 270 }, { x: 654, y: 236 }, { x: 712, y: 300 },
    { x: 672, y: 382 }, { x: 590, y: 366 }
  ],
  [
    { x: 712, y: 450 }, { x: 790, y: 418 }, { x: 850, y: 468 },
    { x: 812, y: 548 }, { x: 732, y: 530 }
  ]
];

export const VIEWBOX_SIZE = VIEWBOX;
export const GATE_COUNT = GATE_POINTS.length;
export const MEMORY_WINDOW = 4;
export const DRAG_THRESHOLD = 180;

const round = (value) => Math.round(value * 1000) / 1000;
const clampGate = (value) => Math.max(0, Math.min(GATE_COUNT - 1, value));
const formatPoint = ({ x, y }) => `${round(x)} ${round(y)}`;
const polygonPath = (points) => `M ${points.map(formatPoint).join(' L ')} Z`;
const reversePoints = (points) => [...points].reverse();
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function normalizedEvent(event, index) {
  const sourceGate = Number.isInteger(event?.sourceGate) ? clampGate(event.sourceGate) : index % GATE_COUNT;
  const targetGate = Number.isInteger(event?.targetGate) ? clampGate(event.targetGate) : (sourceGate + 1) % GATE_COUNT;
  return {
    type: 'winding-inversion',
    sourceGate,
    targetGate,
    aperture: Number.isInteger(event?.aperture) ? Math.max(0, Math.min(2, event.aperture)) : index % 3,
    order: Number.isInteger(event?.order) ? event.order : index + 1,
    route: `${sourceGate}→${targetGate}`
  };
}

function normalizeMemory(memory) {
  if (!Array.isArray(memory)) return [];
  return memory.slice(-MEMORY_WINDOW).map(normalizedEvent);
}

function outerPointsFor(memory) {
  const points = OUTER_POINTS.map((point) => ({ ...point }));
  for (const event of memory) {
    const sign = event.targetGate > event.sourceGate ? 1 : -1;
    const start = event.aperture * 3;
    const amount = 8 + event.order * 3;
    for (const offset of [0, 1, 2]) {
      const index = (start + offset + event.order) % points.length;
      points[index].x += sign * amount * (offset === 1 ? 1.3 : 0.55);
      points[index].y += (sign * (offset - 1) * amount * 0.62);
    }
  }
  return points.map((point) => ({ x: round(point.x), y: round(point.y) }));
}

function buildApertures(memory) {
  return APERTURE_POINTS.map((points, index) => {
    const flipCount = memory.filter((event) => event.aperture === index).length;
    const winding = flipCount % 2 === 0 ? -1 : 1;
    const transformed = points.map((point, pointIndex) => ({
      x: round(point.x + (winding === 1 ? (pointIndex - 2) * 2.4 : 0)),
      y: round(point.y + (winding === 1 ? (index - 1) * 4 : 0))
    }));
    const path = polygonPath(winding === -1 ? reversePoints(transformed) : transformed);
    return {
      index,
      winding,
      flipCount,
      path,
      signature: `${index}:${winding}:${flipCount}:${path}`
    };
  });
}

function buildFrameFromMemory(memory, interaction = null, event = null) {
  const normalizedMemory = normalizeMemory(memory);
  const outerPath = polygonPath(outerPointsFor(normalizedMemory));
  const apertures = buildApertures(normalizedMemory);
  const compoundPath = `${outerPath} ${apertures.map((aperture) => aperture.path).join(' ')}`;
  const latest = normalizedMemory.at(-1) ?? null;
  return {
    grammar: 'winding-seal',
    outerPath,
    compoundPath,
    apertures,
    memory: normalizedMemory,
    pending: null,
    interaction: interaction ?? (normalizedMemory.length ? 'settled' : 'quiet'),
    event,
    state: {
      inversionCount: normalizedMemory.length,
      openApertures: apertures.filter((aperture) => aperture.winding === -1).map((aperture) => aperture.index),
      filledApertures: apertures.filter((aperture) => aperture.winding === 1).map((aperture) => aperture.index),
      lastRoute: latest?.route ?? null,
      lastAperture: latest?.aperture ?? null
    }
  };
}

export function buildFrame(memory = []) {
  return buildFrameFromMemory(memory);
}

export function geometrySignature(frame) {
  return [frame.outerPath, ...frame.apertures.map((aperture) => aperture.signature)].join('|');
}

export function gatePoint(index) {
  if (!Number.isInteger(index) || index < 0 || index >= GATE_COUNT) return null;
  const gate = GATE_POINTS[index];
  return { x: gate.x, y: gate.y };
}

export function gateAtPoint(frame, position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const gate of GATE_POINTS) {
    const currentDistance = distance(gate, position);
    if (currentDistance <= 76 && currentDistance < nearestDistance) {
      nearest = gate.index;
      nearestDistance = currentDistance;
    }
  }
  return nearest;
}

export function beginDrag(frame, sourceGate) {
  if (!Number.isInteger(sourceGate) || sourceGate < 0 || sourceGate >= GATE_COUNT) {
    return { ...frame, interaction: 'draw-refused-miss', event: { type: 'draw-refused-miss' } };
  }
  return {
    ...frame,
    pending: {
      sourceGate,
      lastPoint: gatePoint(sourceGate),
      pathLength: 0,
      crossed: false
    },
    interaction: 'draw-started',
    event: null
  };
}

export function moveDrag(frame, position) {
  if (!frame.pending || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return { ...frame, interaction: 'draw-refused-unarmed' };
  }
  const lastPoint = frame.pending.lastPoint ?? gatePoint(frame.pending.sourceGate);
  const pathLength = frame.pending.pathLength + distance(lastPoint, position);
  const crossed = frame.pending.crossed || (lastPoint.x < 600 && position.x >= 600) || (lastPoint.x > 600 && position.x <= 600) || pathLength >= DRAG_THRESHOLD;
  return {
    ...frame,
    pending: { ...frame.pending, lastPoint: { x: position.x, y: position.y }, pathLength, crossed },
    interaction: crossed ? 'draw-crossed' : 'draw-tracing',
    event: null
  };
}

export function commitDrag(frame, targetGate) {
  if (!frame.pending) return { ...frame, interaction: 'draw-refused-unarmed', event: { type: 'draw-refused-unarmed' } };
  const { sourceGate, pathLength, crossed } = frame.pending;
  if (!Number.isInteger(targetGate) || targetGate < 0 || targetGate >= GATE_COUNT) {
    return { ...frame, pending: null, interaction: 'draw-refused-miss', event: { type: 'draw-refused-miss' } };
  }
  if (targetGate === sourceGate) {
    return { ...frame, pending: null, interaction: 'draw-refused-same-gate', event: { type: 'draw-refused-same-gate', sourceGate } };
  }
  if (!crossed || pathLength < DRAG_THRESHOLD) {
    return { ...frame, pending: null, interaction: 'draw-refused-short', event: { type: 'draw-refused-short', sourceGate, targetGate } };
  }
  const expectedTarget = (sourceGate + 1) % GATE_COUNT;
  if (targetGate !== expectedTarget) {
    return { ...frame, pending: null, interaction: 'draw-refused-order', event: { type: 'draw-refused-order', sourceGate, targetGate, expectedTarget } };
  }
  const event = {
    type: 'winding-inversion',
    sourceGate,
    targetGate,
    aperture: (sourceGate + frame.memory.length) % 3,
    order: frame.memory.length + 1,
    route: `${sourceGate}→${targetGate}`
  };
  return buildFrameFromMemory([...frame.memory, event], 'draw-committed', event);
}

export function completeDrag(frame, sourceGate, targetGate, pathLength = DRAG_THRESHOLD) {
  const started = beginDrag(frame, sourceGate);
  if (!started.pending) return started;
  return commitDrag({
    ...started,
    pending: {
      ...started.pending,
      pathLength,
      crossed: pathLength >= DRAG_THRESHOLD,
      lastPoint: gatePoint(targetGate) ?? started.pending.lastPoint
    }
  }, targetGate);
}

export function liftLatest(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'lift-refused-empty', event: { type: 'lift-refused-empty' } };
  return buildFrameFromMemory(frame.memory.slice(0, -1), 'lifted', { type: 'lift-latest' });
}

export function releaseSeal() {
  return buildFrame();
}

export function buildTimeline() {
  const timeline = [buildFrame()];
  for (let index = 0; index < MEMORY_WINDOW; index += 1) {
    const sourceGate = index % GATE_COUNT;
    timeline.push(completeDrag(timeline.at(-1), sourceGate, (sourceGate + 1) % GATE_COUNT, DRAG_THRESHOLD + 24 + index * 8));
  }
  return timeline;
}
