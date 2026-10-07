export const GRID_COLS = 18;
export const GRID_ROWS = 10;
export const MEMORY_LIMIT = 4;
export const STAGES = 14;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const rounded = (value) => Number(value.toFixed(5));

function seededValue(column, row, channel = 0) {
  let value = Math.imul(column + 17, 374761393) ^ Math.imul(row + 31, 668265263) ^ Math.imul(channel + 7, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function baselineCells() {
  return Array.from({ length: GRID_ROWS }, (_, row) => Array.from({ length: GRID_COLS }, (_, column) => ({
    column,
    row,
    x: (column + 0.5) / GRID_COLS,
    y: (row + 0.5) / GRID_ROWS,
    mass: 0.34 + seededValue(column, row, 1) * 0.56,
    dryness: 0.06 + seededValue(column, row, 2) * 0.14,
    shear: (seededValue(column, row, 3) - 0.5) * 0.018,
    lift: (seededValue(column, row, 4) - 0.5) * 0.022,
    grain: seededValue(column, row, 5)
  })));
}

function replay(events) {
  const cells = baselineCells();
  let threshold = 0.5;
  let fieldLoad = 0;
  let lastSample = 0.5;

  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    const sample = clamp(event.sample);
    const nextThreshold = 0.2 + sample * 0.6;
    const direction = sample >= threshold ? 1 : -1;
    const displacement = 0.045 + Math.abs(nextThreshold - threshold) * 0.24;
    const load = 0.12 + sample * 0.22 + eventIndex * 0.035;

    for (const row of cells) {
      for (const cell of row) {
        const cx = cell.x;
        const cy = cell.y;
        const distance = cx - nextThreshold;
        const diagonal = cy - (0.2 + sample * 0.6);
        const globalShear = direction * displacement * (0.72 + Math.abs(diagonal) * 0.9) * (1 + eventIndex * 0.18);
        const pressure = Math.max(0, 1 - Math.abs(distance) * 2.5);
        const farDrying = Math.abs(distance) * 0.16 + Math.abs(diagonal) * 0.08;
        cell.shear += globalShear + (cy - 0.5) * load * 0.18;
        cell.lift += direction * (0.018 + pressure * 0.055) + diagonal * load * 0.14;
        cell.mass = clamp(cell.mass + direction * (0.025 + pressure * 0.06) - farDrying * 0.18, 0.08, 1.18);
        cell.dryness = clamp(cell.dryness + 0.08 + pressure * 0.13 + farDrying + Math.abs(direction * diagonal) * 0.04, 0, 1);
      }
    }

    threshold = nextThreshold;
    fieldLoad += load;
    lastSample = sample;
  }

  return { cells, threshold, fieldLoad, lastSample };
}

function frameFrom(stage, events, interaction = 'baseline') {
  const safeEvents = events.slice(-MEMORY_LIMIT).map((event) => ({ ...event }));
  const result = replay(safeEvents);
  return {
    grammar: 'threshold-slab',
    stage,
    memory: safeEvents,
    events: safeEvents,
    threshold: rounded(result.threshold),
    fieldLoad: rounded(result.fieldLoad),
    lastSample: rounded(result.lastSample),
    cells: result.cells,
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return frameFrom(stage, memory);
}

export function applySqueeze(frame, sample, source = 'pointer-sample') {
  const normalized = rounded(clamp(sample));
  const last = frame.memory.at(-1);
  if (last && Math.abs(last.sample - normalized) < 0.015) {
    return { ...frame, interaction: 'squeeze-refused' };
  }
  const event = { kind: 'threshold-squeeze', sample: normalized, source };
  return frameFrom(frame.stage, [...frame.memory, event], 'squeeze-committed');
}

export function liftLatestSqueeze(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'squeeze-refused' };
  return frameFrom(frame.stage, frame.memory.slice(0, -1), 'squeeze-lifted');
}

export function releaseSqueezes(frame) {
  return frameFrom(frame.stage, [], 'field-released');
}

export function buildTimeline(stages = STAGES) {
  const samples = [0.18, 0.72, 0.34, 0.86];
  const timeline = [];
  let memory = [];
  for (let stage = 0; stage < stages; stage += 1) {
    const scheduleIndex = Math.floor(stage / 3) - 1;
    if (scheduleIndex >= 0 && scheduleIndex < samples.length && stage % 3 === 0) {
      memory = [...memory, { kind: 'threshold-squeeze', sample: samples[scheduleIndex], source: 'timeline' }].slice(-MEMORY_LIMIT);
    }
    timeline.push(frameFrom(stage, memory, stage === 0 ? 'baseline' : 'timeline'));
  }
  return timeline;
}

export function geometrySignature(frame) {
  return [frame.threshold, frame.fieldLoad, ...frame.cells.flatMap((row) => row.flatMap((cell) => [
    rounded(cell.mass), rounded(cell.dryness), rounded(cell.shear), rounded(cell.lift)
  ]))].join('|');
}
