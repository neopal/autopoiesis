export const MEMORY_LIMIT = 4;
export const STAGES = 13;
export const BASIN_COUNT = 8;
export const CONTOUR_COUNT = 16;
export const CHANNEL_COUNT = 6;

const SEED = 0x42523939;
const round = (value) => Number(value.toFixed(5));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;
const clampIndex = (value, count) => ((Math.floor(Number(value) || 0) % count) + count) % count;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const average = (points) => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length
});

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0.02, 0.98)),
    y: round(clamp(Number(point.y) || 0, 0.02, 0.98))
  };
}

function normalizeLoop(points = []) {
  return points.map(normalizePoint).slice(0, 96);
}

function polygonArea(points) {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total) / 2;
}

function baseSurface() {
  const anchors = [
    [0.08, 0.30], [0.16, 0.12], [0.39, 0.08], [0.62, 0.12], [0.88, 0.22],
    [0.92, 0.50], [0.81, 0.78], [0.57, 0.91], [0.31, 0.88], [0.11, 0.72]
  ];
  return anchors.map(([x, y], index) => ({
    x: round(x + (seeded(index, 1) - 0.5) * 0.035),
    y: round(y + (seeded(index, 2) - 0.5) * 0.035)
  }));
}

const BASIN_SEEDS = [
  [0.22, 0.25, 0.095, 0.075, -18], [0.45, 0.18, 0.12, 0.085, 14],
  [0.70, 0.23, 0.105, 0.078, -28], [0.79, 0.45, 0.12, 0.095, 34],
  [0.69, 0.69, 0.13, 0.085, -7], [0.44, 0.79, 0.12, 0.08, 19],
  [0.23, 0.66, 0.11, 0.095, -34], [0.39, 0.47, 0.105, 0.09, 58]
];

function basinPoints(index, x, y, width, height, angle) {
  const radians = angle * Math.PI / 180;
  return Array.from({ length: 10 }, (_, pointIndex) => {
    const theta = (Math.PI * 2 * pointIndex) / 10;
    const wobble = 0.84 + seeded(index * 11 + pointIndex, 7) * 0.25;
    const localX = Math.cos(theta) * width * wobble;
    const localY = Math.sin(theta) * height * (0.86 + seeded(index * 13 + pointIndex, 8) * 0.18);
    return {
      x: round(clamp(x + localX * Math.cos(radians) - localY * Math.sin(radians), 0.03, 0.97)),
      y: round(clamp(y + localX * Math.sin(radians) + localY * Math.cos(radians), 0.03, 0.97))
    };
  });
}

function baseBasins() {
  return BASIN_SEEDS.map(([x, y, width, height, angle], id) => ({
    id,
    x,
    y,
    width,
    height,
    angle,
    points: basinPoints(id, x, y, width, height, angle),
    removed: false,
    wound: 0,
    depth: 0,
    shore: 0,
    tone: id % 4
  }));
}

function baseContours() {
  return Array.from({ length: CONTOUR_COUNT }, (_, id) => {
    const centerX = 0.50 + Math.sin(id * 1.51) * 0.026;
    const centerY = 0.51 + Math.cos(id * 1.13) * 0.028;
    const radiusX = 0.46 - id * 0.021;
    const radiusY = 0.40 - id * 0.018;
    const twist = -0.36 + id * 0.046;
    const points = Array.from({ length: 22 }, (_, pointIndex) => {
      const theta = (Math.PI * 2 * pointIndex) / 22;
      const jitter = (seeded(id * 23 + pointIndex, 11) - 0.5) * 0.022;
      const r = 1 + jitter + Math.sin(theta * 3 + id) * 0.022;
      return {
        x: round(clamp(centerX + Math.cos(theta + twist) * radiusX * r, 0.02, 0.98)),
        y: round(clamp(centerY + Math.sin(theta + twist) * radiusY * r, 0.02, 0.98))
      };
    });
    return { id, points, width: round(0.65 + (id % 4) * 0.28), wound: 0, tone: id % 5 };
  });
}

function baseChannels() {
  const paths = [
    [[0.06, 0.55], [0.20, 0.51], [0.36, 0.55], [0.51, 0.49], [0.68, 0.53], [0.94, 0.47]],
    [[0.18, 0.08], [0.24, 0.24], [0.33, 0.38], [0.47, 0.51], [0.52, 0.72], [0.61, 0.94]],
    [[0.87, 0.12], [0.78, 0.27], [0.69, 0.39], [0.58, 0.50], [0.45, 0.62], [0.31, 0.87]],
    [[0.08, 0.80], [0.24, 0.70], [0.41, 0.64], [0.57, 0.64], [0.76, 0.72], [0.91, 0.86]],
    [[0.11, 0.22], [0.27, 0.32], [0.45, 0.31], [0.62, 0.25], [0.79, 0.30], [0.91, 0.24]],
    [[0.13, 0.92], [0.27, 0.79], [0.42, 0.75], [0.59, 0.79], [0.77, 0.68], [0.91, 0.58]]
  ];
  return paths.map((path, id) => ({
    id,
    points: path.map(([x, y]) => ({ x, y })),
    suture: 0,
    width: round(0.55 + (id % 3) * 0.24)
  }));
}

function normalizeEvent(event = {}) {
  return {
    source: event.source || 'unknown',
    basin: clampIndex(event.basin, BASIN_COUNT),
    area: Number.isFinite(event.area) ? round(event.area) : 0.026,
    pressure: Number.isFinite(event.pressure) ? round(event.pressure) : 0.72,
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + Number(event.basin || 0) * 83),
    loop: Array.isArray(event.loop) ? normalizeLoop(event.loop) : []
  };
}

function mutatePoints(points, event, role, eventIndex) {
  const direction = role === 'shore' ? -1 : 1;
  return points.map((point, pointIndex) => {
    const wave = Math.sin(pointIndex * 1.31 + eventIndex * 0.82) * 0.007;
    const bias = (pointIndex % 2 ? -1 : 1) * (0.008 + event.pressure * 0.006);
    return {
      x: round(clamp(point.x + direction * (wave + bias), 0.02, 0.98)),
      y: round(clamp(point.y + direction * (wave * 0.8 - bias * 0.72), 0.02, 0.98))
    };
  });
}

function mutateContour(contour, event, eventIndex) {
  const center = BASIN_SEEDS[event.basin];
  const radius = 0.10 + (contour.id % 4) * 0.018;
  return {
    ...contour,
    wound: round(contour.wound + (contour.id % 3 === eventIndex % 3 ? 0.42 : 0.08)),
    width: round(contour.width + (contour.id % 3 === eventIndex % 3 ? 0.22 : -0.01)),
    points: contour.points.map((point, pointIndex) => {
      const dx = point.x - center[0];
      const dy = point.y - center[1];
      const distanceFromBasin = Math.hypot(dx, dy);
      if (Math.abs(distanceFromBasin - radius) > 0.09) return point;
      const force = (0.004 + event.pressure * 0.008) * (distanceFromBasin < radius ? -1 : 1);
      const wave = Math.sin(pointIndex * 0.81 + eventIndex) * 0.004;
      return {
        x: round(clamp(point.x + dx * force * 2.2 + wave, 0.02, 0.98)),
        y: round(clamp(point.y + dy * force * 2.2 - wave, 0.02, 0.98))
      };
    })
  };
}

function mutateChannel(channel, event, eventIndex) {
  const target = BASIN_SEEDS[event.basin];
  return {
    ...channel,
    suture: round(channel.suture + 0.54 + event.pressure * 0.12),
    width: round(channel.width + 0.18),
    points: channel.points.map((point, pointIndex) => {
      const pull = (0.004 + event.pressure * 0.004) * (pointIndex % 2 ? -1 : 1);
      return {
        x: round(clamp(point.x + (target[0] - point.x) * pull + Math.sin(eventIndex + pointIndex) * 0.003, 0.02, 0.98)),
        y: round(clamp(point.y + (target[1] - point.y) * pull + Math.cos(eventIndex + pointIndex) * 0.003, 0.02, 0.98))
      };
    })
  };
}

function buildFrameFrom(stage, memory, interaction = 'baseline', trace = []) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  let surface = baseSurface();
  let basins = baseBasins();
  let contours = baseContours();
  let channels = baseChannels();
  let event = null;

  boundedMemory.forEach((stored, eventIndex) => {
    const target = stored.basin;
    const sutureChannel = (target + eventIndex * 2 + 1) % CHANNEL_COUNT;
    basins = basins.map((basin) => {
      if (basin.id === target) {
        return {
          ...basin,
          removed: true,
          wound: round(basin.wound + 0.9 + stored.pressure * 0.25),
          depth: round(basin.depth + 0.28 + stored.area * 2.4),
          shore: round(basin.shore + 0.18),
          width: round(basin.width + 0.008),
          points: mutatePoints(basin.points, stored, 'wound', eventIndex)
        };
      }
      const distanceToTarget = Math.hypot(basin.x - BASIN_SEEDS[target][0], basin.y - BASIN_SEEDS[target][1]);
      if (distanceToTarget < 0.34) {
        return { ...basin, shore: round(basin.shore + 0.24), points: mutatePoints(basin.points, stored, 'shore', eventIndex) };
      }
      return basin;
    });
    contours = contours.map((contour) => mutateContour(contour, stored, eventIndex));
    channels = channels.map((channel, channelIndex) => channelIndex === sutureChannel ? mutateChannel(channel, stored, eventIndex) : channel);
    surface = surface.map((point, pointIndex) => {
      const targetPoint = BASIN_SEEDS[target];
      const sign = pointIndex % 2 ? -1 : 1;
      return {
        x: round(clamp(point.x + (targetPoint[0] - point.x) * stored.pressure * 0.004 * sign, 0.02, 0.98)),
        y: round(clamp(point.y + (targetPoint[1] - point.y) * stored.pressure * 0.003 * -sign, 0.02, 0.98))
      };
    });
    event = {
      ...stored,
      type: 'closed-wound',
      committed: true,
      index: eventIndex,
      basin: target,
      sutureChannel
    };
  });

  const pendingTrace = normalizeLoop(trace);
  return {
    grammar: 'closed-wound-field',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    surface,
    basins,
    contours,
    channels,
    event,
    removed: basins.filter((basin) => basin.removed).map((basin) => basin.id),
    holeCount: basins.filter((basin) => basin.removed).length,
    pending: { trace: pendingTrace },
    interaction,
    renderer: 'deterministic inline SVG topological wound field'
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

export function previewLoop(frame, points) {
  const trace = normalizeLoop(points);
  return buildFrameFrom(frame.stage, frame.memory, 'loop-preview', trace);
}

export function commitLoop(frame, points, source = 'visitor-closed-loop') {
  const loop = normalizeLoop(points);
  if (loop.length < 4) return buildFrameFrom(frame.stage, frame.memory, 'loop-refused-small');
  if (distance(loop[0], loop.at(-1)) > 0.12) return buildFrameFrom(frame.stage, frame.memory, 'loop-refused-open');
  const area = polygonArea(loop.slice(0, -1));
  if (area < 0.012) return buildFrameFrom(frame.stage, frame.memory, 'loop-refused-small');
  const centre = average(loop.slice(0, -1));
  const basin = BASIN_SEEDS.reduce((best, seed, index) => {
    const score = Math.hypot(centre.x - seed[0], centre.y - seed[1]);
    return score < best.score ? { index, score } : best;
  }, { index: 0, score: Infinity }).index;
  return applyRemoval(frame, basin, source, loop, area);
}

export function applyRemoval(frame, basinIndex, source = 'visitor-removal', loop = [], area = 0.026) {
  const basin = clampIndex(basinIndex, BASIN_COUNT);
  const event = {
    source,
    basin,
    area: round(clamp(Number(area) || 0.026, 0.012, 0.14)),
    pressure: round(clamp(0.58 + Number(area || 0.026) * 2.8, 0.58, 1.08)),
    field: hash(SEED + frame.memory.length * 7919 + basin * 83),
    loop: normalizeLoop(loop)
  };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'wound-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const targets = [2, 6, 3, 0];
  let frame = buildFrame(0, []);
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    if (stage % 3 === 0) {
      frame = applyRemoval(frame, targets[(stage / 3) - 1], 'timeline-removal');
    } else {
      frame = buildFrameFrom(stage, frame.memory, 'timeline');
    }
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({ surface: frame.surface, basins: frame.basins, contours: frame.contours, channels: frame.channels });
}

export function pathArea(points) {
  return polygonArea(normalizeLoop(points));
}
