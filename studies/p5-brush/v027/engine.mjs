export const ISLAND_COUNT = 13;
export const MEMORY_LIMIT = 4;
export const STAGES = 15;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const rounded = (value) => Number(value.toFixed(5));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const BLUEPRINT = [
  [0.18, 0.70, 0.105], [0.31, 0.58, 0.078], [0.45, 0.70, 0.092],
  [0.60, 0.56, 0.115], [0.76, 0.68, 0.084], [0.23, 0.39, 0.088],
  [0.39, 0.31, 0.112], [0.55, 0.40, 0.072], [0.72, 0.30, 0.101],
  [0.13, 0.22, 0.074], [0.30, 0.16, 0.096], [0.52, 0.18, 0.082],
  [0.83, 0.20, 0.071]
];

function seededValue(index, channel = 0) {
  let value = Math.imul(index + 19, 374761393) ^ Math.imul(channel + 11, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function baselinePoints(index, x, y, radius) {
  const count = 11 + (index % 4);
  return Array.from({ length: count }, (_, pointIndex) => {
    const phase = (pointIndex / count) * Math.PI * 2;
    const wobble = 0.72 + seededValue(index * 31 + pointIndex, 3) * 0.54;
    const tilt = (seededValue(index, 4) - 0.5) * 0.8;
    const px = Math.cos(phase + tilt) * radius * wobble;
    const py = Math.sin(phase + tilt) * radius * (0.74 + seededValue(index + pointIndex, 5) * 0.34);
    return { x: rounded(x + px), y: rounded(y + py) };
  });
}

function baselineIslands() {
  return BLUEPRINT.map(([x, y, radius], index) => ({
    id: index,
    x,
    y,
    radius,
    angle: (seededValue(index, 6) - 0.5) * 0.8,
    mass: 0.64 + seededValue(index, 7) * 0.28,
    fracture: 0,
    returnMass: 0,
    grain: seededValue(index, 8),
    points: baselinePoints(index, x, y, radius)
  }));
}

function normalizeScrape(scrape) {
  const points = Array.isArray(scrape?.points) ? scrape.points : [];
  return {
    points: points.slice(0, 24).map((point) => ({
      x: rounded(clamp(Number(point.x) || 0)),
      y: rounded(clamp(Number(point.y) || 0))
    })),
    pressure: rounded(clamp(Number(scrape?.pressure) || 0.5))
  };
}

function pathMetrics(points) {
  const safePoints = points.length ? points : [{ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.5 }];
  let length = 0;
  for (let index = 1; index < safePoints.length; index += 1) length += distance(safePoints[index - 1], safePoints[index]);
  const first = safePoints[0];
  const last = safePoints.at(-1);
  const centroid = safePoints.reduce((sum, point) => ({ x: sum.x + point.x / safePoints.length, y: sum.y + point.y / safePoints.length }), { x: 0, y: 0 });
  const tangentLength = Math.max(distance(first, last), 0.001);
  const tangent = { x: (last.x - first.x) / tangentLength, y: (last.y - first.y) / tangentLength };
  return { length, centroid, tangent, count: safePoints.length };
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy || 1;
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator);
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function scrapeFingerprint(scrape) {
  const normalized = normalizeScrape(scrape);
  const metrics = pathMetrics(normalized.points);
  return [metrics.centroid.x, metrics.centroid.y, metrics.length, normalized.pressure].map((value) => value.toFixed(3)).join(':');
}

function safeEvent(event) {
  const scrape = normalizeScrape(event);
  return {
    kind: 'pigment-scrape',
    points: scrape.points,
    pressure: scrape.pressure,
    fingerprint: scrapeFingerprint(scrape),
    source: event?.source || 'unknown'
  };
}

function replay(events) {
  const islands = baselineIslands();
  let fractureLoad = 0;
  let lastScrape = null;

  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = safeEvent(events[eventIndex]);
    const metrics = pathMetrics(event.points);
    const first = event.points[0] || metrics.centroid;
    const last = event.points.at(-1) || metrics.centroid;
    const normal = { x: -metrics.tangent.y, y: metrics.tangent.x };
    const crossed = [];

    for (const island of islands) {
      const distanceToScrape = Math.min(
        pointToSegmentDistance({ x: island.x, y: island.y }, first, last),
        distance(island, metrics.centroid)
      );
      const influence = clamp(1 - distanceToScrape / (island.radius * 3.8 + 0.12));
      if (influence > 0.28) crossed.push({ island, influence });
    }

    if (!crossed.length) {
      const nearest = islands.reduce((best, island) => distance(island, metrics.centroid) < distance(best, metrics.centroid) ? island : best, islands[0]);
      crossed.push({ island: nearest, influence: 0.42 });
    }

    const crossedIds = new Set(crossed.map(({ island }) => island.id));
    const relaySeed = Math.floor((metrics.centroid.x * 97 + metrics.centroid.y * 193 + eventIndex * 17) * ISLAND_COUNT);
    let relay = islands[Math.abs(relaySeed) % islands.length];
    for (let attempt = 0; crossedIds.has(relay.id) && attempt < islands.length; attempt += 1) relay = islands[(relay.id + 1) % islands.length];

    for (const { island, influence } of crossed) {
      const severity = (0.16 + event.pressure * 0.36) * influence;
      const outward = Math.sign((island.x - metrics.centroid.x) * normal.x + (island.y - metrics.centroid.y) * normal.y) || (island.id % 2 ? 1 : -1);
      island.fracture = clamp(island.fracture + severity, 0, 1);
      island.mass = clamp(island.mass - severity * 0.16, 0.28, 1.18);
      island.angle += outward * (0.12 + severity * 0.34);
      island.x = clamp(island.x + normal.x * outward * severity * 0.045 + metrics.tangent.x * severity * 0.028, 0.08, 0.92);
      island.y = clamp(island.y + normal.y * outward * severity * 0.045 + metrics.tangent.y * severity * 0.028, 0.08, 0.88);
      island.points = island.points.map((point, pointIndex) => {
        const local = { x: point.x - island.x, y: point.y - island.y };
        const sign = pointIndex % 3 === 0 ? -1 : 1;
        return {
          x: rounded(clamp(island.x + local.x * (1 + severity * 0.42) + normal.x * sign * severity * 0.012)),
          y: rounded(clamp(island.y + local.y * (1 + severity * 0.42) + normal.y * sign * severity * 0.012))
        };
      });
    }

    relay.returnMass = clamp(relay.returnMass + 0.16 + event.pressure * 0.32, 0, 1.2);
    relay.mass = clamp(relay.mass + 0.11 + event.pressure * 0.1, 0.28, 1.35);
    relay.radius = clamp(relay.radius * (1 + 0.04 + event.pressure * 0.06), 0.045, 0.17);
    relay.angle += normal.x * 0.12 + normal.y * 0.08;
    relay.x = clamp(relay.x - normal.x * (0.018 + event.pressure * 0.026), 0.08, 0.92);
    relay.y = clamp(relay.y - normal.y * (0.018 + event.pressure * 0.026), 0.08, 0.88);
    relay.points = relay.points.map((point, pointIndex) => ({
      x: rounded(clamp(relay.x + (point.x - relay.x) * (1.08 + relay.returnMass * 0.06) + normal.x * (pointIndex % 2 ? 1 : -1) * 0.006)),
      y: rounded(clamp(relay.y + (point.y - relay.y) * (1.08 + relay.returnMass * 0.06) + normal.y * (pointIndex % 2 ? 1 : -1) * 0.006))
    }));

    fractureLoad += event.pressure * (0.7 + crossed.length * 0.1);
    lastScrape = { ...event, crossed: crossed.map(({ island }) => island.id), relay: relay.id, length: rounded(metrics.length) };
  }

  return { islands, fractureLoad, lastScrape };
}

function frameFrom(stage, events, interaction = 'baseline') {
  const safeEvents = events.slice(-MEMORY_LIMIT).map((event) => safeEvent(event));
  const result = replay(safeEvents);
  return {
    grammar: 'fracture-return',
    stage,
    memory: safeEvents,
    events: safeEvents,
    fractureLoad: rounded(result.fractureLoad),
    lastScrape: result.lastScrape,
    islands: result.islands,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory);
}

export function applyScrape(frame, scrape, source = 'pointer-scrape') {
  const normalized = normalizeScrape(scrape);
  const metrics = pathMetrics(normalized.points);
  if (metrics.length < 0.11 || normalized.points.length < 2) return { ...frame, interaction: 'scrape-refused' };
  const fingerprint = scrapeFingerprint(normalized);
  const last = frame.memory.at(-1);
  if (last?.fingerprint === fingerprint) return { ...frame, interaction: 'scrape-refused' };
  return frameFrom(frame.stage, [...frame.memory, { ...normalized, source }], 'scrape-committed');
}

export function liftLatestScrape(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'scrape-refused' };
  return frameFrom(frame.stage, frame.memory.slice(0, -1), 'scrape-lifted');
}

export function releaseScrapes(frame) {
  return frameFrom(frame.stage, [], 'memory-released');
}

export function buildTimeline(stages = STAGES) {
  const scrapes = [
    { points: [{ x: 0.12, y: 0.76 }, { x: 0.34, y: 0.55 }, { x: 0.62, y: 0.36 }], pressure: 0.68, source: 'timeline' },
    { points: [{ x: 0.82, y: 0.76 }, { x: 0.62, y: 0.58 }, { x: 0.40, y: 0.48 }], pressure: 0.52, source: 'timeline' },
    { points: [{ x: 0.17, y: 0.22 }, { x: 0.42, y: 0.34 }, { x: 0.70, y: 0.22 }], pressure: 0.76, source: 'timeline' },
    { points: [{ x: 0.74, y: 0.30 }, { x: 0.56, y: 0.42 }, { x: 0.28, y: 0.22 }], pressure: 0.61, source: 'timeline' }
  ];
  let memory = [];
  const timeline = [];
  for (let stage = 0; stage < stages; stage += 1) {
    const eventIndex = Math.floor((stage - 1) / 3);
    if (stage > 0 && stage % 3 === 0 && scrapes[eventIndex]) memory = [...memory, scrapes[eventIndex]].slice(-MEMORY_LIMIT);
    timeline.push(frameFrom(stage, memory, stage === 0 ? 'baseline' : 'timeline'));
  }
  return timeline;
}

export function geometrySignature(frame) {
  return frame.islands.flatMap((island) => [
    island.id, rounded(island.x), rounded(island.y), rounded(island.radius), rounded(island.angle),
    rounded(island.mass), rounded(island.fracture), rounded(island.returnMass),
    ...island.points.flatMap((point) => [rounded(point.x), rounded(point.y)])
  ]).join('|');
}
