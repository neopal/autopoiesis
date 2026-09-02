export const SEED = 0x42525532;
export const STAGES = 8;
export const STROKE_COUNT = 4;
export const PRIMITIVE_BUDGET = 24;
export const ERASURE_RATIO = 0.28;

export function stageIndexAt(now, started, stageMs = 3900, stageCount = STAGES) {
  const elapsed = Math.max(0, now - started);
  return Math.floor((elapsed % (stageMs * stageCount)) / stageMs);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function woundForStage(stage) {
  const random = rng(SEED + stage * 733);
  const direction = stage % 2 === 0 ? 1 : -1;
  return {
    stage,
    x: clamp(0.32 + random() * 0.38 + direction * 0.035, 0.18, 0.82),
    y: clamp(0.30 + random() * 0.34, 0.20, 0.72),
    radius: 0.038 + random() * 0.024,
    turn: direction * (0.035 + random() * 0.028),
    label: stage % 3 === 0 ? 'return cut too deep' : 'return missed the centre'
  };
}

function memoryInfluence(memory, key) {
  return memory.reduce((sum, wound, index) => {
    const decay = 1 - Math.min(index, 6) * 0.08;
    return sum + wound[key] * decay;
  }, 0);
}

function makeStroke(stage, index, memory) {
  const random = rng(SEED + stage * 911 + index * 37);
  const inheritedTurn = memoryInfluence(memory, 'turn');
  const inheritedX = memory.reduce((sum, wound, memoryIndex) => {
    const decay = 1 - Math.min(memoryIndex, 6) * 0.08;
    return sum + (wound.x - 0.5) * 0.16 * decay;
  }, 0);
  const points = [];
  const startX = 0.08 + index * 0.016 + (random() - 0.5) * 0.018;
  const baseY = 0.22 + index * 0.14 + (random() - 0.5) * 0.026;
  const travel = 0.80 - index * 0.022;
  const amplitude = 0.042 + random() * 0.024;
  const phase = random() * Math.PI * 2;
  for (let pointIndex = 0; pointIndex < 22; pointIndex += 1) {
    const t = pointIndex / 21;
    const x = clamp(startX + t * travel + inheritedX * Math.sin(t * Math.PI), 0.03, 0.97);
    const localDetour = memory.reduce((sum, wound, memoryIndex) => {
      const woundT = clamp((wound.x - startX) / travel, 0.12, 0.88);
      const envelope = Math.exp(-Math.pow((t - woundT) / 0.055, 2));
      const side = baseY < wound.y ? -1 : 1;
      const decay = 1 - Math.min(memoryIndex, 6) * 0.08;
      return sum + side * (0.045 + wound.radius * 0.30) * envelope * decay;
    }, 0);
    const y = clamp(baseY + Math.sin(phase + t * (Math.PI * 1.4 + index * 0.24)) * amplitude + inheritedTurn * (t * t) * (index % 2 === 0 ? 1 : -1) + localDetour, 0.08, 0.88);
    points.push({ x, y });
  }
  return {
    index,
    width: 0.012 + random() * 0.009,
    opacity: 0.54 + random() * 0.22,
    points
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map((wound) => ({ ...wound })) : [];
  const draftStrokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, []));
  const strokes = Array.from({ length: STROKE_COUNT }, (_, index) => makeStroke(safeStage, index, inherited));
  const wound = woundForStage(safeStage);
  return {
    stage: safeStage,
    memory: inherited,
    wound,
    draftStrokes,
    strokes,
    primitiveCount: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(count = STAGES) {
  const timeline = [];
  let memory = [];
  for (let stage = 0; stage < Math.min(count, STAGES); stage += 1) {
    const frame = buildFrame(stage, memory);
    timeline.push(frame);
    memory = [...memory, frame.wound];
  }
  return timeline;
}
