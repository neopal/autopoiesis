export const STAGES = 13;
export const MEMORY_WINDOW = 6;

const ROWS = 4;
const COLUMNS = 6;
const TILE_COUNT = ROWS * COLUMNS;
const X_MIN = 0.08;
const X_MAX = 0.92;
const Y_MIN = 0.12;
const Y_MAX = 0.88;
const GLYPHS = [...'WEIGHTMOVESTHENEXTWORDON'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function normalizeTap(entry, index = 0, stage = 0) {
  const rawX = Number(entry?.x);
  const rawY = Number(entry?.y);
  const x = Number.isFinite(rawX) ? rawX : 0.5;
  const y = Number.isFinite(rawY) ? rawY : 0.5;
  return {
    id: String(entry?.id ?? `impression-${stage}-${index}`),
    kind: 'tap-impression',
    stage: Math.max(0, Math.floor(Number(entry?.stage) || stage)),
    x: round(clamp(x, X_MIN, X_MAX), 4),
    y: round(clamp(y, Y_MIN, Y_MAX), 4),
    slot: Math.max(0, Math.min(TILE_COUNT - 1, Math.floor(Number(entry?.slot) || 0))),
    pressure: round(clamp(Number(entry?.pressure) || 0.72, 0.26, 1), 4),
    phase: round(Number(entry?.phase) || 0, 6)
  };
}

function copyTile(tile) {
  return { ...tile };
}

function copyShelf(shelf) {
  return { ...shelf };
}

function copyVacancy(vacancy) {
  return { ...vacancy };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeBaseShelves(stage) {
  return Array.from({ length: ROWS }, (_, row) => ({
    id: `shelf-${row}`,
    row,
    y: round(0.2 + row * 0.19 + Math.sin(stage * 0.22 + row) * 0.006),
    locked: false,
    lockDepth: 0,
    pressure: 0
  }));
}

function makeBaseTiles(stage) {
  const random = rng(0x48574417 + stage * 65537);
  return GLYPHS.map((glyph, index) => {
    const row = Math.floor(index / COLUMNS);
    const column = index % COLUMNS;
    const baseX = 0.14 + column * 0.145;
    const baseY = 0.2 + row * 0.19;
    return {
      id: `glyph-${index}`,
      glyph,
      index,
      row,
      column,
      slot: index,
      x: round(baseX + (random() - 0.5) * 0.028),
      y: round(baseY + (random() - 0.5) * 0.022 + Math.sin(stage * 0.2 + index) * 0.004),
      rotation: round((random() - 0.5) * 0.18),
      scale: round(0.88 + random() * 0.18),
      weight: 350 + Math.floor(random() * 260),
      stretch: round(0.86 + random() * 0.22),
      state: 'loose',
      sourceStage: stage
    };
  });
}

function nearestSlot(tiles, point) {
  return tiles.reduce((best, tile) => {
    const currentDistance = distance(tile, point);
    return currentDistance < best.distance ? { slot: tile.slot, distance: currentDistance } : best;
  }, { slot: 0, distance: Infinity }).slot;
}

function resolveTarget(tiles, requestedSlot) {
  const requested = tiles.find((tile) => tile.slot === requestedSlot && tile.state !== 'impressed');
  if (requested) return requested;
  return tiles.find((tile) => tile.state !== 'impressed') ?? tiles[0];
}

function applySetting(tiles, shelves, vacancies, impressions, event, eventIndex) {
  const target = resolveTarget(tiles, event.slot);
  const shelf = shelves[target.row];
  const pressure = event.pressure;
  const lockY = shelf.y + (eventIndex % 2 ? 0.008 : -0.006);

  shelf.locked = true;
  shelf.lockDepth += 1;
  shelf.pressure = round(clamp(shelf.pressure + pressure * 0.72, 0, 1));

  target.state = 'set';
  target.y = round(lerp(target.y, lockY, 0.78));
  target.rotation = round(target.rotation * 0.18 + Math.sin(event.phase) * 0.1);
  target.scale = round(target.scale * (1 + 0.14 * pressure));
  target.weight = Math.min(900, Math.round(target.weight + 190 * pressure));
  target.stretch = round(clamp(target.stretch - 0.11 * pressure, 0.62, 1.22));

  for (const tile of tiles) {
    if (tile.id === target.id || tile.row !== target.row || tile.state === 'impressed') continue;
    const direction = tile.column < target.column ? -1 : 1;
    const distanceFromTarget = Math.abs(tile.column - target.column);
    tile.x = round(clamp(tile.x + direction * 0.012 * pressure / distanceFromTarget, 0.08, 0.92));
    tile.rotation = round(tile.rotation + direction * 0.035 * pressure);
    tile.state = tile.state === 'set' ? 'set' : 'shifted';
  }

  const candidates = tiles
    .filter((tile) => tile.id !== target.id && tile.state !== 'impressed')
    .sort((a, b) => Math.abs(a.index - (target.index + 5 + eventIndex * 3)) - Math.abs(b.index - (target.index + 5 + eventIndex * 3)));
  const ejected = candidates[0] ?? target;
  ejected.state = 'impressed';
  ejected.x = round(0.17 + (eventIndex % COLUMNS) * 0.145);
  ejected.y = round(0.88 + (eventIndex % 2) * 0.026);
  ejected.rotation = round(-0.22 + eventIndex * 0.11);
  ejected.scale = round(0.72 + pressure * 0.12);
  ejected.weight = Math.max(280, Math.round(ejected.weight - 90));
  ejected.stretch = round(clamp(ejected.stretch + 0.14, 0.62, 1.3));

  vacancies.push({
    id: `vacancy-${event.id}`,
    slot: ejected.slot,
    row: ejected.row,
    column: ejected.column,
    x: round(0.14 + ejected.column * 0.145),
    y: round(0.2 + ejected.row * 0.19),
    depth: round(0.12 + pressure * 0.24)
  });

  impressions.push({
    id: `impression-${event.id}`,
    slot: target.slot,
    targetId: target.id,
    ejectedId: ejected.id,
    row: target.row,
    railIndex: eventIndex,
    pressure,
    baseline: lockY
  });
}

function makeStageImpression(stage) {
  if (stage <= 0) return null;
  const index = (stage * 5 + 2) % TILE_COUNT;
  const row = Math.floor(index / COLUMNS);
  const column = index % COLUMNS;
  return normalizeTap({
    id: `stage-${stage}-impression`,
    stage,
    slot: index,
    x: 0.14 + column * 0.145,
    y: 0.2 + row * 0.19,
    pressure: 0.54 + (stage % 4) * 0.08,
    phase: stage * 0.61
  }, 0, stage);
}

export function buildFrame(targetStage, memory = []) {
  const stage = Math.max(0, Math.min(STAGES - 1, Math.floor(Number(targetStage) || 0)));
  const tiles = makeBaseTiles(stage);
  const shelves = makeBaseShelves(stage);
  const stableMemory = memory.map((entry, index) => normalizeTap(entry, index, stage)).slice(-MEMORY_WINDOW);
  const vacancies = [];
  const impressions = [];

  stableMemory.forEach((event, index) => applySetting(tiles, shelves, vacancies, impressions, event, index));

  const nextImpression = makeStageImpression(stage);
  return {
    stage,
    tiles: tiles.map(copyTile),
    shelves: shelves.map(copyShelf),
    vacancies: vacancies.map(copyVacancy),
    impressions: impressions.map((impression) => ({ ...impression })),
    memory: stableMemory,
    accepted: true,
    previousMemory: null,
    newImpressions: nextImpression ? [nextImpression] : [],
    setCount: tiles.filter((tile) => tile.state === 'set').length,
    shiftedCount: tiles.filter((tile) => tile.state === 'shifted').length,
    impressionCount: impressions.length,
    openSlots: TILE_COUNT - vacancies.length
  };
}

export function buildTimeline(finalStage = STAGES - 1) {
  let memory = [];
  const frames = [];
  for (let stage = 0; stage <= Math.min(STAGES - 1, Math.max(0, Math.floor(finalStage))); stage += 1) {
    const frame = buildFrame(stage, memory);
    frames.push(frame);
    memory = [...memory, ...frame.newImpressions].slice(-MEMORY_WINDOW);
  }
  return frames;
}

export function applyImpression(frame, point) {
  const x = round(clamp(Number(point?.x) || 0.5, X_MIN, X_MAX), 4);
  const y = round(clamp(Number(point?.y) || 0.5, Y_MIN, Y_MAX), 4);
  const slot = nearestSlot(frame.tiles, { x, y });
  const event = normalizeTap({
    id: `visitor-impression-${frame.stage}-${frame.memory.length}`,
    stage: frame.stage,
    x,
    y,
    slot,
    pressure: 0.72 + (slot % 3) * 0.08,
    phase: x * 13.7 + y * 9.2
  }, frame.memory.length, frame.stage);
  const next = buildFrame(frame.stage, [...frame.memory, event]);
  next.previousMemory = frame.memory.map((entry) => ({ ...entry }));
  return next;
}

export function removeLatestImpression(frame) {
  const previousMemory = Array.isArray(frame.previousMemory)
    ? frame.previousMemory
    : frame.memory.slice(0, -1);
  return buildFrame(frame.stage, previousMemory);
}

export const constants = {
  tileCount: TILE_COUNT,
  rows: ROWS,
  columns: COLUMNS,
  memoryWindow: MEMORY_WINDOW,
  finalStage: STAGES - 1,
  bounds: { xMin: X_MIN, xMax: X_MAX, yMin: Y_MIN, yMax: Y_MAX },
  glyphs: GLYPHS.join('')
};
