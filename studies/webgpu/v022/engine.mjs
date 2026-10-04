export const SEED = 0x57473232;
export const STAGES = 19;
export const CELL_COUNT = 20;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 56;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clampInt = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const wrap = (value, max) => ((value % max) + max) % max;
const copy = (value) => JSON.parse(JSON.stringify(value));
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};

const LAYOUT = [
  [-0.80, -0.68], [-0.47, -0.77], [-0.12, -0.69], [0.25, -0.78], [0.62, -0.61],
  [-0.88, -0.26], [-0.55, -0.18], [-0.19, -0.28], [0.20, -0.16], [0.56, -0.27], [0.86, -0.08],
  [-0.71, 0.22], [-0.36, 0.34], [0.02, 0.23], [0.39, 0.38], [0.76, 0.28],
  [-0.56, 0.67], [-0.17, 0.61], [0.22, 0.70], [0.59, 0.60]
];

const AUTO_SWEEPS = [
  { start: [-0.78, -0.58], end: [0.58, 0.30], force: 0.78 },
  { start: [0.74, -0.62], end: [-0.38, 0.66], force: 0.68 },
  { start: [-0.74, 0.46], end: [0.78, -0.16], force: 0.82 },
  { start: [-0.20, -0.78], end: [0.76, 0.56], force: 0.74 }
];

const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  const x = ax + dx * t;
  const y = ay + dy * t;
  return { distance: Math.hypot(px - x, py - y), t, x, y };
};

const normalizePoint = (point, fallback) => [
  Number(clamp(finite(point?.[0], fallback[0]), -1, 1).toFixed(5)),
  Number(clamp(finite(point?.[1], fallback[1]), -1, 1).toFixed(5))
];

const normalizeSweep = (raw = {}, serial = 0) => {
  const start = normalizePoint(raw.start, [-0.72, -0.42]);
  const end = normalizePoint(raw.end, [0.66, 0.38]);
  const force = Number(clamp(finite(raw.force, 0.7), 0.12, 1).toFixed(5));
  return {
    id: `sweep-${serial}`,
    source: raw.source || 'replayed-sweep',
    mode: 'field-sweep',
    start,
    end,
    force,
    sweep: { start, end, force },
    serial
  };
};

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeSweep(event, index));

const baseCells = () => LAYOUT.map(([x, y], id) => ({
  id,
  x,
  y,
  radius: Number((0.14 + pseudo(id + 2) * 0.035).toFixed(5)),
  angle: Number(((pseudo(id + 19) - 0.5) * 0.22).toFixed(5)),
  bend: 0,
  open: 0,
  swell: 1,
  pressure: 0,
  mode: 'quiet',
  phase: Number((pseudo(id + 41) * Math.PI * 2).toFixed(5))
}));

const buildField = (memory) => {
  const cells = baseCells();
  const wakes = [];
  const returns = [];
  const cuts = [];
  const routeHistory = [];
  let residue = 0;

  memory.forEach((rawEvent, serial) => {
    const event = normalizeSweep(rawEvent, serial);
    const [ax, ay] = event.start;
    const [bx, by] = event.end;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const effective = event.force / (1 + residue * 0.17 + serial * 0.08);
    const routeIndex = wrap(Math.floor(Math.abs((ax * 7.2 + by * 11.4 + residue * 2.1 + serial * 3.7) * 10)), CELL_COUNT);
    const targetId = wrap(routeIndex + serial * 2, CELL_COUNT);
    const target = cells[targetId];
    const localWakes = [];

    cells.forEach((cell, index) => {
      const near = distanceToSegment(cell.x, cell.y, ax, ay, bx, by);
      const proximity = clamp(1 - near.distance / 0.34, 0, 1);
      const directional = 0.55 + near.t * 0.45;
      const fieldForce = proximity * effective * directional;
      const signed = ((index + serial + Math.floor(residue * 3)) % 2 === 0 ? 1 : -1);
      const fieldDrift = (0.006 + fieldForce * 0.055) * (1 + serial * 0.08);

      if (fieldForce > 0.04) {
        cell.x = Number((cell.x + nx * fieldDrift * signed).toFixed(5));
        cell.y = Number((cell.y + ny * fieldDrift * signed).toFixed(5));
        cell.bend = Number((cell.bend + signed * (0.11 + fieldForce * 0.76)).toFixed(5));
        cell.open = Number(clamp(cell.open + fieldForce * 0.56, 0, 1).toFixed(5));
        cell.swell = Number((cell.swell + fieldForce * 0.18).toFixed(5));
        cell.pressure = Number((cell.pressure + fieldForce).toFixed(5));
        cell.mode = 'wake';
        localWakes.push({ cell: index, t: Number(near.t.toFixed(5)), force: Number(fieldForce.toFixed(5)) });
      } else {
        const memoryTug = (0.004 + residue * 0.003) * Math.sin(cell.phase + serial * 1.31);
        cell.x = Number((cell.x + dx / length * memoryTug).toFixed(5));
        cell.y = Number((cell.y + dy / length * memoryTug).toFixed(5));
        cell.angle = Number((cell.angle + memoryTug * signed).toFixed(5));
      }
    });

    const returnId = wrap(targetId + 7 + serial * 3, CELL_COUNT);
    const returnCell = cells[returnId];
    const cutId = wrap(targetId + 3 + Math.floor(residue), CELL_COUNT);
    const cutCell = cells[cutId];
    target.mode = 'source';
    target.bend = Number((target.bend + 0.24 + effective * 0.55).toFixed(5));
    target.swell = Number((target.swell + 0.12).toFixed(5));
    returnCell.mode = 'return';
    returnCell.x = Number((returnCell.x + nx * (0.06 + effective * 0.12)).toFixed(5));
    returnCell.y = Number((returnCell.y + ny * (0.06 + effective * 0.12)).toFixed(5));
    returnCell.bend = Number((returnCell.bend - effective * 0.48).toFixed(5));
    returnCell.open = Number(clamp(returnCell.open + 0.18 + effective * 0.26, 0, 1).toFixed(5));
    cutCell.mode = 'cut';
    cutCell.open = Number(clamp(cutCell.open + 0.36 + effective * 0.24, 0, 1).toFixed(5));
    cutCell.swell = Number(Math.max(0.72, cutCell.swell - effective * 0.18).toFixed(5));

    wakes.push(...localWakes);
    returns.push({ from: targetId, to: returnId, bend: returnCell.bend, serial });
    cuts.push({ cell: cutId, open: cutCell.open, serial });
    routeHistory.push({ source: targetId, return: returnId, cut: cutId, serial });
    residue = Number((residue + 0.45 + effective * 0.72 + localWakes.length * 0.012).toFixed(5));
  });

  const route = routeHistory.map(({ source, return: remote, cut }) => `${source}>${remote}>${cut}`).join('|') || 'quiet';
  const signature = JSON.stringify({
    residue: Number(residue.toFixed(5)),
    route,
    cells: cells.map((cell) => [
      cell.id,
      Number(cell.x.toFixed(5)),
      Number(cell.y.toFixed(5)),
      Number(cell.angle.toFixed(5)),
      Number(cell.bend.toFixed(5)),
      Number(cell.open.toFixed(5)),
      Number(cell.swell.toFixed(5)),
      cell.mode
    ])
  });

  return {
    cells,
    wakes,
    returns,
    cuts,
    route,
    residue: Number(residue.toFixed(5)),
    signature
  };
};

export const buildFrame = (stage = 0, memory = [], armed = { start: [-0.72, -0.42], end: [0.66, 0.38] }) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armed: {
      start: normalizePoint(armed?.start, [-0.72, -0.42]),
      end: normalizePoint(armed?.end, [0.66, 0.38])
    },
    field: buildField(normalizedMemory),
    archive: normalizedMemory.map((event, index) => ({ index, id: event.id, mode: event.mode, start: event.start, end: event.end, force: event.force }))
  };
};

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const memory = AUTO_SWEEPS.slice(0, Math.min(MEMORY_LIMIT, Math.floor(stage / 4.5)));
  const latest = memory.at(-1) || AUTO_SWEEPS[0];
  return buildFrame(stage, memory, latest);
});

export const armSweep = (frame, cue = frame.armed) => ({
  ...frame,
  armed: {
    start: normalizePoint(cue?.start, frame.armed.start),
    end: normalizePoint(cue?.end, frame.armed.end)
  }
});

export const releaseSweep = (frame, cue = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return frame;
  const event = normalizeSweep({ ...cue, start: cue.start || frame.armed.start, end: cue.end || frame.armed.end, source: 'visitor-sweep' }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], { start: event.start, end: event.end });
};

export const liftLatestSweep = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), frame.armed);
export const releaseField = () => buildFrame(0, []);
export const defaultSweep = () => copy(AUTO_SWEEPS[0]);
export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, cells: frame.field.cells, wakes: frame.field.wakes, returns: frame.field.returns, cuts: frame.field.cuts });
