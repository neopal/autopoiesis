export const SEED = 0x53564752;
export const STAGES = 17;
export const PRIMITIVE_BUDGET = 6;
export const MEMORY_LIMIT = 4;
export const FACET_COUNT = 6;

const AUTO_FACETS = [1, 4, 0, 5, 2, 3, 1, 4];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BASE_POINTS = [
  [[260, 304], [402, 210], [476, 270], [325, 362]],
  [[402, 210], [560, 174], [626, 244], [476, 270]],
  [[325, 362], [476, 270], [541, 355], [390, 448]],
  [[476, 270], [626, 244], [760, 300], [541, 355]],
  [[390, 448], [541, 355], [611, 470], [445, 538]],
  [[541, 355], [760, 300], [821, 415], [611, 470]]
];

function copyPoints(points) {
  return points.map(([x, y]) => [x, y]);
}

function copyMemory(memory) {
  return memory.map((event) => ({ ...event }));
}

function boundedStage(stage) {
  return clamp(Number.isFinite(Number(stage)) ? Math.floor(Number(stage)) : 0, 0, STAGES - 1);
}

function safeFacet(index) {
  const numeric = Number.isFinite(Number(index)) ? Math.floor(Number(index)) : 0;
  return ((numeric % FACET_COUNT) + FACET_COUNT) % FACET_COUNT;
}

function pointSignature([x, y]) {
  return `${x.toFixed(3)},${y.toFixed(3)}`;
}

function pointsSignature(points) {
  return points.map(pointSignature).join('|');
}

function pathData(points) {
  return `M ${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`;
}

function centroid(points) {
  return points.reduce(([x, y], [px, py]) => [x + px / points.length, y + py / points.length], [0, 0]);
}

function transformFacet(points, { dx = 0, dy = 0, skew = 0, scale = 1, turn = 0 }) {
  const [cx, cy] = centroid(points);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return points.map(([x, y], index) => {
    const localX = (x - cx) * scale;
    const localY = (y - cy) * scale;
    const rotatedX = localX * cos - localY * sin;
    const rotatedY = localX * sin + localY * cos;
    const edgeBias = (index - 1.5) * skew;
    return [
      Number((cx + rotatedX + dx + edgeBias).toFixed(3)),
      Number((cy + rotatedY + dy + edgeBias * 0.38).toFixed(3))
    ];
  });
}

function baseFacets(stage) {
  const phase = boundedStage(stage) * 0.07;
  return BASE_POINTS.map((points, index) => {
    const driftX = Math.sin(phase + index * 0.8) * 1.8;
    const driftY = Math.cos(phase * 0.9 + index) * 1.3;
    const nextPoints = points.map(([x, y], pointIndex) => [
      Number((x + driftX + (pointIndex - 1.5) * 0.18).toFixed(3)),
      Number((y + driftY).toFixed(3))
    ]);
    return {
      index,
      points: nextPoints,
      role: 'quiet',
      pressure: 0,
      pathSignature: pointsSignature(nextPoints)
    };
  });
}

function applyMemory(facets, memory) {
  const nextFacets = facets.map((facet) => ({ ...facet, points: copyPoints(facet.points) }));
  const exchanges = [];

  for (const [memoryIndex, event] of memory.entries()) {
    const source = safeFacet(event.source);
    const remote = (source + 3 + memoryIndex * 2) % FACET_COUNT;
    const hinge = (source + 1 + memoryIndex) % FACET_COUNT;
    const force = clamp(event.force ?? 0.82, 0.35, 1);
    const direction = memoryIndex % 2 === 0 ? 1 : -1;
    const sourceFacet = nextFacets[source];
    const remoteFacet = nextFacets[remote];
    const hingeFacet = nextFacets[hinge];

    sourceFacet.points = transformFacet(sourceFacet.points, {
      dx: direction * (16 + force * 17),
      dy: -direction * (10 + force * 15),
      skew: direction * (4 + force * 5),
      scale: 0.94 - memoryIndex * 0.012,
      turn: direction * (0.045 + force * 0.045)
    });
    sourceFacet.pressure = Number((sourceFacet.pressure + force).toFixed(4));
    sourceFacet.role = 'turning-away';

    remoteFacet.points = transformFacet(remoteFacet.points, {
      dx: -direction * (11 + force * 14),
      dy: direction * (13 + force * 17),
      skew: -direction * (3 + force * 4),
      scale: 1.04 + memoryIndex * 0.014,
      turn: -direction * (0.028 + force * 0.034)
    });
    remoteFacet.pressure = Number((remoteFacet.pressure + force * 0.72).toFixed(4));
    remoteFacet.role = 'answering';

    hingeFacet.points = transformFacet(hingeFacet.points, {
      dx: direction * 5,
      dy: direction * 4,
      skew: direction * 1.6,
      scale: 1,
      turn: direction * 0.012
    });
    hingeFacet.pressure = Number((hingeFacet.pressure + force * 0.18).toFixed(4));
    if (hingeFacet.role === 'quiet') hingeFacet.role = 'hinge-shifted';

    exchanges.push({ source, remote, hinge, force: Number(force.toFixed(4)), direction, memoryIndex });
  }

  return { facets: nextFacets, exchanges };
}

function eventFor(stage, memory, source = null, force = null, origin = 'auto-attention') {
  const facet = Number.isInteger(source) ? safeFacet(source) : AUTO_FACETS[(boundedStage(stage) + memory.length) % AUTO_FACETS.length];
  const amount = force == null ? 0.76 + ((boundedStage(stage) + memory.length) % 3) * 0.06 : clamp(force, 0.35, 1);
  return {
    kind: 'attention',
    mode: 'edge-exchange',
    gesture: 'approach-departure',
    origin,
    stage: boundedStage(stage),
    source: facet,
    force: Number(amount.toFixed(4)),
    ordinal: memory.length
  };
}

export function buildFrame(stage, memory = []) {
  const safeStage = boundedStage(stage);
  const inherited = copyMemory(memory).slice(-MEMORY_LIMIT);
  const { facets, exchanges } = applyMemory(baseFacets(safeStage), inherited);
  const normalised = facets.map((facet) => ({
    ...facet,
    pathSignature: pointsSignature(facet.points)
  }));
  const objectPath = normalised.map((facet) => pathData(facet.points)).join(' ');
  const frame = {
    stage: safeStage,
    grammar: 'folding-object',
    object: { closed: true, pathSignature: objectPath },
    facets: normalised,
    exchanges,
    memory: inherited,
    attentionCount: inherited.length,
    primitiveBudget: PRIMITIVE_BUDGET,
    ruleCursor: inherited.at(-1)?.source ?? null
  };
  frame.signature = geometrySignature(frame);
  return frame;
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    if (stage > 0 && stage % 4 === 0) {
      memory = [...memory, eventFor(stage, memory, null, null, 'timeline-attention')].slice(-MEMORY_LIMIT);
    }
    return buildFrame(stage, memory);
  });
}

export function applyAttention(frame, requestedSource = null, requestedForce = 0.84) {
  const event = eventFor(frame.stage, frame.memory, requestedSource, requestedForce, 'visitor-attention');
  const nextMemory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  const next = buildFrame(frame.stage, nextMemory);
  return { ...next, attention: event, priorMemory: copyMemory(frame.memory), interaction: 'edge-exchange' };
}

export function removeLatestAttention(frame) {
  if (Array.isArray(frame.priorMemory)) return buildFrame(frame.stage, frame.priorMemory);
  return buildFrame(frame.stage, frame.memory.slice(0, -1));
}

export function releaseAttention() {
  return buildFrame(0, []);
}

export function geometrySignature(frame) {
  if (!frame?.object) return '';
  const facets = frame.facets.map((facet) => `${facet.index}:${facet.pathSignature}:${facet.role}`).join('|');
  const exchanges = frame.exchanges.map((exchange) => `${exchange.source}:${exchange.remote}:${exchange.hinge}:${exchange.force}:${exchange.direction}`).join('|');
  return `${frame.object.pathSignature}::${facets}::${exchanges}`;
}
