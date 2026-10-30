export const MEMORY_LIMIT = 4;
export const STAGES = 9;
export const GRID_COLS = 72;
export const GRID_ROWS = 48;
export const WELL_COUNT = 9;
export const MIN_DWELL_MS = 820;
export const MAX_DWELL_MS = 2600;

const SEED = 0x42523432;
const WELL_RADIUS = 0.16;
const WELL_BASE = [
  [0.18, 0.28],
  [0.43, 0.18],
  [0.76, 0.24],
  [0.82, 0.54],
  [0.63, 0.79],
  [0.31, 0.81],
  [0.17, 0.58],
  [0.48, 0.48],
  [0.55, 0.28]
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(5));
const clampIndex = (value, count) => ((Math.floor(Number(value) || 0) % count) + count) % count;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function normalizePoint(point = {}) {
  return {
    x: round(clamp(Number(point.x) || 0, 0.02, 0.98)),
    y: round(clamp(Number(point.y) || 0, 0.02, 0.98))
  };
}

function normalizeEvent(event = {}) {
  return {
    source: event.source || 'unknown',
    type: 'remote-cure',
    well: clampIndex(event.well, WELL_COUNT),
    sealZone: clampIndex(event.sealZone, WELL_COUNT),
    crackZone: clampIndex(event.crackZone, WELL_COUNT),
    bleedZone: clampIndex(event.bleedZone, WELL_COUNT),
    point: normalizePoint(event.point),
    elapsed: Math.round(clamp(Number(event.elapsed) || MIN_DWELL_MS + 180, MIN_DWELL_MS, MAX_DWELL_MS)),
    force: round(clamp(Number(event.force) || 0.72, 0.42, 1.15)),
    field: Number.isFinite(event.field) ? event.field >>> 0 : hash(SEED + Number(event.bleedZone || 0) * 83)
  };
}

function wellPoint(id) {
  const [x, y] = WELL_BASE[clampIndex(id, WELL_COUNT)];
  return { x, y };
}

function baseZones(memory) {
  return WELL_BASE.map(([x, y], id) => ({
    id,
    x,
    y,
    load: 0,
    seal: 0,
    crack: 0,
    bleed: 0,
    memory: memory.filter((event) => event.well === id).length
  }));
}

function baseCells() {
  const cells = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    const y = row / (GRID_ROWS - 1);
    for (let column = 0; column < GRID_COLS; column += 1) {
      const x = column / (GRID_COLS - 1);
      const dx = x - 0.5 + Math.sin(y * 7.4 + 0.4) * 0.018;
      const dy = y - 0.5 + Math.sin(x * 5.3) * 0.014;
      const edge = Math.sin(x * 19.0 + y * 7.0) * 0.032 + Math.cos(x * 6.0 - y * 17.0) * 0.024;
      const ellipse = (dx * dx) / 0.145 + (dy * dy) / 0.185;
      const mask = ellipse < 1 + edge;
      const ridge = Math.exp(-Math.pow((y - (0.3 + x * 0.31 + Math.sin(x * 5.8) * 0.035)), 2) / 0.006);
      const dryFront = Math.exp(-Math.pow((x - (0.29 + y * 0.42 + Math.sin(y * 8.2) * 0.028)), 2) / 0.005);
      const grain = seeded(row * GRID_COLS + column, 3);
      const crack = mask ? clamp(0.035 + ridge * 0.16 + Math.max(0, Math.sin(x * 27 - y * 13)) * 0.045, 0, 0.32) : 0;
      cells.push({
        x: round(x),
        y: round(y),
        mask,
        mass: mask ? round(0.56 + ridge * 0.18 + grain * 0.16) : 0,
        dry: mask ? round(0.16 + dryFront * 0.3 + grain * 0.12) : 0,
        crack: round(crack),
        bleed: mask ? round(dryFront * 0.04) : 0,
        grain: round(grain)
      });
    }
  }
  return cells;
}

function roleIndex(well, offset) {
  return (well + offset) % WELL_COUNT;
}

function applyCureToCells(cells, event) {
  const seal = wellPoint(event.sealZone);
  const crack = wellPoint(event.crackZone);
  const bleed = wellPoint(event.bleedZone);
  const held = wellPoint(event.well);
  return cells.map((cell) => {
    if (!cell.mask || distance(cell, held) < 0.12) return { ...cell };
    const sealDistance = distance(cell, seal);
    const crackDistance = distance(cell, crack);
    const bleedDistance = distance(cell, bleed);
    const sealField = Math.exp(-(sealDistance * sealDistance) / 0.018) * event.force;
    const crackField = Math.exp(-(crackDistance * crackDistance) / 0.022) * event.force;
    const bleedField = Math.exp(-(bleedDistance * bleedDistance) / 0.028) * event.force;
    const fracture = crackField * (0.48 + Math.abs(Math.sin((cell.x * 31 + cell.y * 17) + event.field * 0.000001)) * 0.52);
    const capillary = bleedField * (0.54 + Math.sin(cell.x * 21 - cell.y * 18 + event.field * 0.000002) * 0.16);
    return {
      ...cell,
      mass: round(clamp(cell.mass + sealField * 0.22 + capillary * 0.025, 0, 1.45)),
      dry: round(clamp(cell.dry + sealField * 0.3 + fracture * 0.055, 0, 1.3)),
      crack: round(clamp(cell.crack + fracture * 0.46, 0, 1.4)),
      bleed: round(clamp(cell.bleed + capillary * 0.34, 0, 1.2))
    };
  });
}

function buildZones(memory) {
  const zones = baseZones(memory);
  for (const event of memory) {
    zones[event.sealZone].seal = round(zones[event.sealZone].seal + event.force);
    zones[event.crackZone].crack = round(zones[event.crackZone].crack + event.force);
    zones[event.bleedZone].bleed = round(zones[event.bleedZone].bleed + event.force);
    zones[event.well].load = round(zones[event.well].load + event.force * 0.1);
    for (const zone of zones) {
      const radius = distance(zone, wellPoint(event.bleedZone));
      zone.memory += zone.id === event.bleedZone ? 0 : 0;
      zone.load = round(zone.load + clamp(1 - radius / 0.9, 0, 1) * event.force * 0.02);
    }
  }
  return zones;
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map(normalizeEvent);
  let cells = baseCells();
  for (const event of boundedMemory) cells = applyCureToCells(cells, event);
  const zones = buildZones(boundedMemory);
  const event = boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null;
  return {
    grammar: 'dwell-cure-plate',
    renderer: 'deterministic p5.js Canvas 2D raster cure plate',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    cells,
    zones,
    event,
    pending: {
      point: pending.point ? normalizePoint(pending.point) : null,
      well: Number.isInteger(pending.well) ? pending.well : null,
      elapsed: Math.max(0, Math.round(Number(pending.elapsed) || 0))
    },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

function nearestWell(point) {
  const normalized = normalizePoint(point);
  return WELL_BASE.reduce((best, [x, y], id) => {
    const score = distance(normalized, { x, y });
    return score < best.score ? { id, score } : best;
  }, { id: null, score: Infinity });
}

export function previewDwell(frame, point, elapsed = 0) {
  const normalized = normalizePoint(point);
  const nearest = nearestWell(normalized);
  return buildFrameFrom(frame.stage, frame.memory, 'dwell-preview', {
    point: normalized,
    well: nearest.score <= WELL_RADIUS ? nearest.id : null,
    elapsed
  });
}

export function commitDwell(frame, point, elapsed, source = 'visitor-timed-dwell') {
  const normalized = normalizePoint(point);
  const nearest = nearestWell(normalized);
  if (nearest.score > WELL_RADIUS) return buildFrameFrom(frame.stage, frame.memory, 'dwell-refused-miss', { point: normalized, elapsed });
  if (Number(elapsed) < MIN_DWELL_MS) return buildFrameFrom(frame.stage, frame.memory, 'dwell-refused-short', { point: normalized, well: nearest.id, elapsed });
  if (Number(elapsed) > MAX_DWELL_MS) return buildFrameFrom(frame.stage, frame.memory, 'dwell-refused-overcured', { point: normalized, well: nearest.id, elapsed });
  return applyDwell(frame, nearest.id, elapsed, source, normalized);
}

export function applyDwell(frame, well, elapsed = MIN_DWELL_MS + 220, source = 'control-cure', point = null) {
  const held = clampIndex(well, WELL_COUNT);
  const duration = Math.round(clamp(Number(elapsed) || MIN_DWELL_MS + 220, MIN_DWELL_MS, MAX_DWELL_MS));
  const sealZone = roleIndex(held, 3);
  const crackZone = roleIndex(held, 5);
  const bleedZone = roleIndex(held, 7);
  const event = {
    source,
    type: 'remote-cure',
    well: held,
    sealZone,
    crackZone,
    bleedZone,
    point: point || wellPoint(held),
    elapsed: duration,
    force: 0.52 + ((duration - MIN_DWELL_MS) / (MAX_DWELL_MS - MIN_DWELL_MS)) * 0.48,
    field: hash(SEED + frame.memory.length * 7919 + bleedZone * 83)
  };
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'dwell-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused');
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted');
}

export function releasePlate(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const targets = [0, 4, 7, 2];
  let frame = buildFrame(0, []);
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    if (stage % 2 === 0) frame = applyDwell(frame, targets[(stage / 2) - 1], MIN_DWELL_MS + 220, 'timeline-dwell');
    else frame = buildFrameFrom(stage, frame.memory, 'timeline');
    frame = { ...frame, stage };
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify({
    cells: frame.cells.map(({ x, y, mask, mass, dry, crack, bleed }) => ({ x, y, mask, mass, dry, crack, bleed })),
    zones: frame.zones.map(({ id, load, seal, crack, bleed, memory }) => ({ id, load, seal, crack, bleed, memory }))
  });
}
