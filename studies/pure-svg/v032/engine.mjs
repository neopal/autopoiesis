const BASE_SEED = 0x53564732;
export const FACET_COUNT = 12;
export const MEMORY_WINDOW = 3;

const FACET_LAYOUT = [
  { x: 0.20, y: 0.23, w: 0.17, h: 0.24, angle: -24, phase: 0.08 },
  { x: 0.40, y: 0.17, w: 0.18, h: 0.22, angle: 10, phase: 0.19 },
  { x: 0.63, y: 0.18, w: 0.20, h: 0.24, angle: -13, phase: 0.31 },
  { x: 0.80, y: 0.31, w: 0.16, h: 0.23, angle: 25, phase: 0.45 },
  { x: 0.79, y: 0.54, w: 0.19, h: 0.25, angle: -9, phase: 0.57 },
  { x: 0.63, y: 0.74, w: 0.21, h: 0.18, angle: 14, phase: 0.68 },
  { x: 0.39, y: 0.78, w: 0.20, h: 0.18, angle: -18, phase: 0.79 },
  { x: 0.19, y: 0.63, w: 0.17, h: 0.24, angle: 28, phase: 0.89 },
  { x: 0.16, y: 0.42, w: 0.16, h: 0.19, angle: -8, phase: 0.98 },
  { x: 0.37, y: 0.37, w: 0.17, h: 0.16, angle: 12, phase: 0.26 },
  { x: 0.56, y: 0.38, w: 0.18, h: 0.17, angle: -22, phase: 0.52 },
  { x: 0.46, y: 0.58, w: 0.20, h: 0.18, angle: 7, phase: 0.74 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, limit) => ((value % limit) + limit) % limit;
const clone = (value) => JSON.parse(JSON.stringify(value));

function rotate(x, y, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine];
}

function pointPath(points) {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ')} Z`;
}

function baseFacet(index) {
  const source = FACET_LAYOUT[index];
  return {
    id: index,
    x: source.x,
    y: source.y,
    w: source.w,
    h: source.h,
    angle: source.angle,
    phase: source.phase,
    scale: 1,
    shear: 0,
    bite: 0,
    relay: 0,
    pathSignature: '',
    role: 'facet'
  };
}

function facetPath(facet) {
  const points = 7;
  const result = [];
  for (let index = 0; index < points; index += 1) {
    const theta = (Math.PI * 2 * index) / points;
    const wobble = 1 + 0.09 * Math.sin(theta * 3 + facet.phase * 17) + 0.045 * Math.cos(theta * 5 - facet.phase * 11);
    const notch = facet.bite * Math.max(0, Math.cos(theta - facet.phase * 5)) * 0.22;
    let localX = Math.cos(theta) * facet.w * 500 * (1 - notch) * facet.scale * wobble;
    let localY = Math.sin(theta) * facet.h * 340 * (1 - notch * 0.62) * facet.scale * wobble;
    localX += localY * facet.shear * 0.32;
    localY += Math.sin(theta * 2 + facet.phase) * facet.relay * 7;
    const [rotatedX, rotatedY] = rotate(localX, localY, facet.angle);
    result.push([facet.x * 1000 + rotatedX, facet.y * 680 + rotatedY]);
  }
  return pointPath(result);
}

function applyEvent(facets, event) {
  const direction = event.winding === 'clockwise' ? 1 : -1;
  const pivot = facets[event.pivot];
  pivot.scale = clamp(pivot.scale * 0.72, 0.48, 1.15);
  pivot.angle += direction * 11;
  pivot.shear += 0.8;
  pivot.bite += 0.8;

  event.affected.forEach((id, order) => {
    const facet = facets[id];
    facet.angle += direction * (order % 2 ? -8 : 6);
    facet.scale = clamp(facet.scale * (order === 0 ? 1.18 : 0.86), 0.48, 1.35);
    facet.shear += order % 2 ? -0.48 : 0.34;
    facet.relay += 0.42 + order * 0.12;
    facet.bite += order === 2 ? 0.7 : 0.18;
  });

  const silent = facets[event.silent];
  silent.scale = clamp(silent.scale * 0.62, 0.42, 1.15);
  silent.angle -= direction * 17;
  silent.shear -= direction * 0.68;
  silent.bite += 1.15;
}

function materialState(memory) {
  const facets = FACET_LAYOUT.map((_, index) => baseFacet(index));
  for (const event of memory) applyEvent(facets, event);
  return facets;
}

function frameFrom(stage, memory, interaction, event) {
  const safeMemory = clone(memory).slice(-MEMORY_WINDOW);
  const facets = materialState(safeMemory);
  for (const facet of facets) facet.pathSignature = facetPath(facet);
  const frame = {
    grammar: 'enclosed-facets',
    stage: clamp(Number(stage) || 0, 0, 12),
    memory: safeMemory,
    facets,
    interaction,
    event: event ?? { committed: false },
    signature: ''
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

function normalizePoints(points) {
  return Array.isArray(points)
    ? points.map((point) => ({
      x: clamp(Number(point?.x ?? 0.5), 0, 1),
      y: clamp(Number(point?.y ?? 0.5), 0, 1)
    }))
    : [];
}

function polygonArea(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += points[index].x * points[index + 1].y - points[index + 1].x * points[index].y;
  }
  return total / 2;
}

function centroid(points) {
  const body = points.slice(0, -1);
  return body.reduce((result, point) => ({ x: result.x + point.x / body.length, y: result.y + point.y / body.length }), { x: 0, y: 0 });
}

function loopEvent(frame, points) {
  const area = polygonArea(points);
  const center = centroid(points);
  const winding = area < 0 ? 'clockwise' : 'counterclockwise';
  const direction = winding === 'clockwise' ? 1 : -1;
  const pivot = wrap(Math.floor(Math.abs(area) * 1000) + Math.round(center.x * 9) + frame.memory.length * 3, FACET_COUNT);
  const affected = [pivot, wrap(pivot + direction * 2, FACET_COUNT), wrap(pivot - direction * 3, FACET_COUNT), wrap(pivot + 5, FACET_COUNT)];
  const silent = wrap(pivot + direction * 4, FACET_COUNT);
  return {
    committed: true,
    type: 'enclosed-reorientation',
    index: frame.memory.length,
    winding,
    area: Number(area.toFixed(5)),
    centroid: { x: Number(center.x.toFixed(4)), y: Number(center.y.toFixed(4)) },
    pivot,
    affected: [...new Set(affected)],
    silent,
    closedGesture: true
  };
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory, 'still', null);
}

export function geometrySignature(frame) {
  return frame.facets.map((facet) => `${facet.id}:${facet.pathSignature ?? facetPath(facet)}`).join('||');
}

export function applyLoop(frame, rawPoints) {
  if (frame.memory.length >= MEMORY_WINDOW) {
    return frameFrom(frame.stage, frame.memory, 'loop-memory-full', { committed: false, reason: 'memory-full' });
  }
  const points = normalizePoints(rawPoints);
  if (points.length < 4) {
    return frameFrom(frame.stage, frame.memory, 'loop-refused-short', { committed: false, reason: 'short-loop' });
  }
  const first = points[0];
  const last = points.at(-1);
  const closure = Math.hypot(first.x - last.x, first.y - last.y);
  if (closure > 0.16) {
    return frameFrom(frame.stage, frame.memory, 'loop-refused-open', { committed: false, reason: 'open-loop' });
  }
  const area = Math.abs(polygonArea(points));
  if (area < 0.02) {
    return frameFrom(frame.stage, frame.memory, 'loop-refused-thin', { committed: false, reason: 'thin-loop' });
  }
  const event = loopEvent(frame, points);
  return frameFrom(frame.stage + 1, [...frame.memory, event], 'loop-enclosed', event);
}

export function liftLatestLoop(frame) {
  if (!frame.memory.length) return frameFrom(frame.stage, [], 'lift-empty', { committed: false });
  return frameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'loop-lifted', { committed: false, lifted: true });
}

export function releaseConstellation() {
  return frameFrom(0, [], 'released', { committed: false, released: true });
}

export function buildTimeline() {
  const loops = [
    [{ x: 0.25, y: 0.25 }, { x: 0.7, y: 0.27 }, { x: 0.7, y: 0.68 }, { x: 0.25, y: 0.68 }, { x: 0.25, y: 0.25 }],
    [{ x: 0.72, y: 0.22 }, { x: 0.82, y: 0.44 }, { x: 0.64, y: 0.62 }, { x: 0.56, y: 0.38 }, { x: 0.72, y: 0.22 }],
    [{ x: 0.18, y: 0.5 }, { x: 0.38, y: 0.26 }, { x: 0.54, y: 0.54 }, { x: 0.32, y: 0.76 }, { x: 0.18, y: 0.5 }]
  ];
  let frame = buildFrame(0, []);
  const frames = [frame];
  for (const loop of loops) {
    frame = applyLoop(frame, loop);
    frames.push(frame);
  }
  return frames;
}

export function facetPoint(frame, id) {
  const facet = frame.facets[id];
  return facet ? { x: facet.x, y: facet.y } : { x: 0.5, y: 0.5 };
}

export const META = {
  seed: `0x${BASE_SEED.toString(16).toUpperCase()}`,
  grammar: 'enclosed-facets',
  rule: 'a closed winding over the shared void reorients four facets and quiets a fifth; the loop itself is not retained',
  memoryWindow: MEMORY_WINDOW
};
