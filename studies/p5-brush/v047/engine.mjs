export const MEMORY_LIMIT = 4;
export const CELL_COUNT = 16;
export const STAGES = 5;

const SEED = 0x42523437;
const round = (value) => Number(value.toFixed(5));

function hash(value) {
  let state = (value >>> 0) + 0x9e3779b9;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
  return (state ^ (state >>> 16)) >>> 0;
}

const seeded = (index, salt) => (hash(SEED + index * 977 + salt * 389) >>> 0) / 4294967296;

function baseCells() {
  return Array.from({ length: CELL_COUNT }, (_, index) => {
    const angle = (index / CELL_COUNT) * Math.PI * 2;
    const radius = 0.26 + seeded(index, 2) * 0.08;
    return {
      id: index,
      x: round(0.5 + Math.cos(angle) * radius),
      y: round(0.5 + Math.sin(angle) * radius * 0.82),
      radius: round(0.085 + seeded(index, 3) * 0.035),
      mass: round(0.58 + seeded(index, 4) * 0.32),
      notch: round(0.18 + seeded(index, 5) * 0.42),
      tilt: round((seeded(index, 6) - 0.5) * 0.36),
      skin: round(0.28 + seeded(index, 7) * 0.62),
      responseCount: 0
    };
  });
}

function baseBody() {
  return {
    cells: baseCells(),
    seams: Array.from({ length: 12 }, (_, index) => ({
      id: index,
      a: index,
      b: (index + 1) % CELL_COUNT,
      tension: round(0.22 + seeded(index, 9) * 0.44),
      gap: round(0.12 + seeded(index, 10) * 0.18)
    })),
    responses: []
  };
}

const normalizePoint = (point = {}) => ({
  x: round(Math.min(0.98, Math.max(0.02, Number(point.x) || 0.5))),
  y: round(Math.min(0.96, Math.max(0.04, Number(point.y) || 0.5)))
});

function buildBody(memory) {
  const body = baseBody();
  for (const [eventIndex, event] of memory.entries()) {
    const respondent = body.cells[event.responseCell];
    const polarity = eventIndex % 2 ? -1 : 1;
    const intensity = event.intensity;
    respondent.mass = round(Math.min(1.25, respondent.mass + intensity * 0.16));
    respondent.notch = round(Math.min(1.2, respondent.notch + intensity * 0.28));
    respondent.tilt = round(respondent.tilt + polarity * intensity * 0.22);
    respondent.skin = round(Math.min(1.2, respondent.skin + intensity * 0.12));
    respondent.responseCount += 1;
    body.responses.push({
      id: eventIndex,
      sourceCell: event.sourceCell,
      responseCell: event.responseCell,
      intensity: event.intensity,
      polarity
    });
    const seam = body.seams[(event.sourceCell + event.responseCell + eventIndex) % body.seams.length];
    seam.tension = round(Math.min(1.2, seam.tension + intensity * 0.18));
    seam.gap = round(Math.max(0.035, seam.gap - intensity * 0.06));
  }
  return body;
}

function buildFrameFrom(stage, memory, interaction = 'baseline', pending = {}) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT);
  return {
    grammar: 'reciprocal-drying-field',
    renderer: 'deterministic p5.js 1.11.3 Canvas 2D reciprocal drying field',
    stage,
    memory: boundedMemory,
    memoryLimit: MEMORY_LIMIT,
    body: buildBody(boundedMemory),
    event: boundedMemory.length ? { ...boundedMemory.at(-1), committed: true, index: boundedMemory.length - 1 } : null,
    pending,
    state: { responseCount: boundedMemory.length },
    interaction
  };
}

export function buildFrame(stage = 0, memory = []) {
  return buildFrameFrom(stage, memory);
}

function nearestCell(frame, point) {
  const normalized = normalizePoint(point);
  let best = null;
  for (const cell of frame.body.cells) {
    const dx = normalized.x - cell.x;
    const dy = normalized.y - cell.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (!best || distance < best.distance) best = { cell, distance };
  }
  return best;
}

export function focusAt(frame, point) {
  const normalized = normalizePoint(point);
  const nearest = nearestCell(frame, normalized);
  if (!nearest || nearest.distance > nearest.cell.radius * 1.5) {
    return buildFrameFrom(frame.stage, frame.memory, 'attention-refused-empty', { active: false, point: normalized });
  }
  return buildFrameFrom(frame.stage, frame.memory, 'attention-preview', {
    active: true,
    point: normalized,
    sourceCell: nearest.cell.id,
    affinity: round(Math.max(0, 1 - nearest.distance / (nearest.cell.radius * 1.9)))
  });
}

function createEvent(frame, sourceCell, source) {
  const responseCell = (sourceCell + 5 + frame.memory.length * 3) % CELL_COUNT;
  return {
    source: source || 'unknown',
    type: 'reciprocal-drying',
    sourceCell,
    responseCell,
    intensity: round(Math.min(1, 0.62 + frame.memory.length * 0.07 + (sourceCell % 3) * 0.04))
  };
}

export function commitAttention(frame, source = 'visitor-attention') {
  if (!frame.pending.active || !Number.isInteger(frame.pending.sourceCell)) {
    return buildFrameFrom(frame.stage, frame.memory, 'attention-refused-unfocused', frame.pending);
  }
  const event = createEvent(frame, frame.pending.sourceCell, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'attention-committed');
}

export function applyAttention(frame, sourceCell, source = 'control-attention') {
  const normalized = ((Math.floor(Number(sourceCell) || 0) % CELL_COUNT) + CELL_COUNT) % CELL_COUNT;
  const event = createEvent(frame, normalized, source);
  return buildFrameFrom(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], 'attention-committed');
}

export function liftLatest(frame) {
  if (!frame.memory.length) return buildFrameFrom(frame.stage, frame.memory, 'lift-refused', frame.pending);
  return buildFrameFrom(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), 'lifted', frame.pending);
}

export function releaseField(frame) {
  return buildFrameFrom(0, [], 'released');
}

export function buildTimeline(stageCount = STAGES) {
  const sources = [0, 4, 8, 12];
  let frame = buildFrame();
  const timeline = [frame];
  for (let stage = 1; stage < stageCount; stage += 1) {
    frame = applyAttention(frame, sources[(stage - 1) % sources.length], 'timeline-attention');
    timeline.push(frame);
  }
  return timeline;
}

export function geometrySignature(frame) {
  return JSON.stringify(frame.body);
}
