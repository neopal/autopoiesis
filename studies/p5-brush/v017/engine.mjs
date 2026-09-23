export const SEED = 0x42525537;
export const STAGES = 16;
export const ISLAND_COUNT = 13;
export const MEMORY_LIMIT = 5;
export const PRIMITIVE_BUDGET = 52;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const gaussian = (distance, spread) => Math.exp(-((distance / Math.max(spread, 0.0001)) ** 2));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyEvent = (event) => ({ ...event, point: copyPoint(event.point) });

const LAYOUT = [
  { x: .17, y: .2, radius: .095, aspect: 1.16 },
  { x: .37, y: .16, radius: .076, aspect: .82 },
  { x: .62, y: .19, radius: .102, aspect: 1.08 },
  { x: .83, y: .25, radius: .069, aspect: .86 },
  { x: .22, y: .43, radius: .081, aspect: .9 },
  { x: .47, y: .38, radius: .108, aspect: 1.18 },
  { x: .76, y: .43, radius: .088, aspect: .82 },
  { x: .12, y: .66, radius: .07, aspect: 1.1 },
  { x: .34, y: .71, radius: .098, aspect: .86 },
  { x: .59, y: .67, radius: .079, aspect: 1.12 },
  { x: .85, y: .69, radius: .104, aspect: .9 },
  { x: .42, y: .88, radius: .071, aspect: 1.08 },
  { x: .7, y: .88, radius: .087, aspect: .84 }
];

function nearestIsland(point, islands) {
  return islands.reduce((best, island, index) => {
    const distance = Math.hypot(point.x - island.x, point.y - island.y);
    return distance < best.distance ? { index, distance } : best;
  }, { index: 0, distance: Infinity });
}

function makeEvent(stage, point, sourceIndex, receiverIndex, vacancyIndex, pressure, source) {
  const boundedPoint = {
    x: clamp(Number.isFinite(Number(point?.x)) ? Number(point.x) : .5, .08, .92),
    y: clamp(Number.isFinite(Number(point?.y)) ? Number(point.y) : .5, .1, .9)
  };
  const boundedPressure = clamp(Number.isFinite(Number(pressure)) ? Number(pressure) : .62, .22, .98);
  return {
    id: `${source}-encounter-${stage}-${sourceIndex}-${receiverIndex}-${vacancyIndex}`,
    stage,
    source,
    kind: 'proximity-transfer',
    point: boundedPoint,
    sourceIndex,
    receiverIndex,
    vacancyIndex,
    pressure: boundedPressure,
    transfer: .18 + boundedPressure * .26,
    radius: .12 + boundedPressure * .035,
    turn: (boundedPressure - .5) * .72,
    rule: 'proximity-transfer-vacancy'
  };
}

function automaticEncounter(stage) {
  const random = rng(SEED + stage * 7919);
  const sourceIndex = (stage * 5 + 2) % ISLAND_COUNT;
  const receiverIndex = (sourceIndex + 6 + (stage % 3)) % ISLAND_COUNT;
  const vacancyIndex = (sourceIndex + 3 + (stage % 2)) % ISLAND_COUNT;
  return makeEvent(
    stage,
    { x: .18 + random() * .62, y: .18 + random() * .64 },
    sourceIndex,
    receiverIndex,
    vacancyIndex,
    .38 + random() * .42,
    'autonomous-proximity'
  );
}

function makeBaseIsland(stage, index) {
  const layout = LAYOUT[index];
  const random = rng(SEED + stage * 104729 + index * 977);
  return {
    id: `island-${index}`,
    index,
    x: clamp(layout.x + (random() - .5) * .012, .06, .94),
    y: clamp(layout.y + (random() - .5) * .012, .08, .92),
    radius: layout.radius * (.93 + random() * .14),
    aspect: layout.aspect * (.92 + random() * .15),
    angle: (random() - .5) * .42,
    mass: .58 + random() * .28,
    porosity: .06 + random() * .11,
    grain: .22 + random() * .34,
    edge: .24 + random() * .25,
    sediment: .26 + random() * .42,
    opacity: .62 + random() * .25,
    notch: .02,
    tilt: 0,
    sourceLoad: 0,
    receiveLoad: 0
  };
}

function applyEventToIsland(island, event, index) {
  const result = { ...island };
  const isSource = index === event.sourceIndex;
  const isReceiver = index === event.receiverIndex;
  const isVacancy = index === event.vacancyIndex;
  const distance = Math.hypot(island.x - event.point.x, island.y - event.point.y);
  const proximity = smoothstep(1 - distance / event.radius);
  const transfer = event.transfer;

  if (isSource) {
    result.mass = clamp(result.mass - transfer * .56, .08, 1.3);
    result.radius = clamp(result.radius - transfer * .085, .032, .17);
    result.porosity = clamp(result.porosity + transfer * .52, .02, .95);
    result.grain = clamp(result.grain + transfer * .34, .05, 1);
    result.edge = clamp(result.edge + transfer * .42, .05, 1);
    result.sediment = clamp(result.sediment - transfer * .34, .03, 1);
    result.notch = clamp(result.notch + transfer * .9, .01, .92);
    result.angle += event.turn;
    result.tilt -= transfer * .48;
    result.sourceLoad += transfer;
  } else if (isReceiver) {
    result.mass = clamp(result.mass + transfer * .68, .08, 1.55);
    result.radius = clamp(result.radius + transfer * .1, .032, .2);
    result.porosity = clamp(result.porosity - transfer * .18, .02, .86);
    result.grain = clamp(result.grain + transfer * .18, .05, 1);
    result.edge = clamp(result.edge + transfer * .24, .05, 1);
    result.sediment = clamp(result.sediment + transfer * .42, .03, 1);
    result.angle -= event.turn * .58;
    result.tilt += transfer * .42;
    result.receiveLoad += transfer;
  } else if (isVacancy) {
    result.mass = clamp(result.mass - transfer * .34, .06, 1.2);
    result.radius = clamp(result.radius - transfer * .045, .028, .18);
    result.porosity = clamp(result.porosity + transfer * .98, .02, .98);
    result.grain = clamp(result.grain + transfer * .16, .05, 1);
    result.edge = clamp(result.edge + transfer * .54, .05, 1);
    result.sediment = clamp(result.sediment - transfer * .2, .03, 1);
    result.notch = clamp(result.notch + transfer * .55, .01, .95);
    result.tilt += (index % 2 ? -1 : 1) * transfer * .3;
  } else if (proximity > .03) {
    const side = index % 2 ? 1 : -1;
    result.angle += side * proximity * transfer * .08;
    result.grain = clamp(result.grain + proximity * transfer * .09, .05, 1);
    result.edge = clamp(result.edge + proximity * transfer * .06, .05, 1);
  }
  return result;
}

function buildIslands(stage, memory) {
  let islands = Array.from({ length: ISLAND_COUNT }, (_, index) => makeBaseIsland(stage, index));
  memory.forEach((event) => {
    islands = islands.map((island, index) => applyEventToIsland(island, event, index));
  });
  return islands;
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_LIMIT) : [];
  const islands = buildIslands(safeStage, inherited);
  const transferMass = inherited.reduce((sum, event) => sum + event.transfer, 0);
  const vacancies = islands.filter((island) => island.porosity > .34).length;
  const active = inherited.at(-1) ?? null;
  return {
    stage: safeStage,
    memory: inherited,
    islands,
    activeEncounter: active,
    transferMass,
    vacancies,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'porous-archipelago'
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, automaticEncounter(stage)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function applyEncounter(frame, point) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const source = nearestIsland(point ?? { x: .5, y: .5 }, baseline.islands).index;
  const receiver = (source + 6 + (baseline.stage % 3)) % ISLAND_COUNT;
  const vacancy = (source + 3 + (baseline.stage % 2)) % ISLAND_COUNT;
  const normalized = {
    x: clamp(Number(point?.x) || .5, .08, .92),
    y: clamp(Number(point?.y) || .5, .1, .9)
  };
  const pressure = clamp(.36 + Math.hypot(normalized.x - baseline.islands[source].x, normalized.y - baseline.islands[source].y) * 1.8, .26, .92);
  const encounter = makeEvent(baseline.stage, normalized, source, receiver, vacancy, pressure, 'visitor-proximity');
  return { ...buildFrame(baseline.stage, [...baseline.memory, encounter]), interaction: 'visitor-proximity-transfer', restoreMemory: baseline.memory.map(copyEvent) };
}

export function removeLatestEncounter(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'encounter-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'encounter-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'encounter-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    islands: frame.islands.map((island) => [
      island.x, island.y, island.radius, island.aspect, island.angle, island.mass,
      island.porosity, island.grain, island.edge, island.sediment, island.notch,
      island.tilt, island.sourceLoad, island.receiveLoad
    ])
  });
}
