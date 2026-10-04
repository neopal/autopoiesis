export const SEED = 0x48574920;
export const STAGES = 15;
export const MEMORY_LIMIT = 3;
export const PRIMITIVE_BUDGET = 72;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const WORD_LAYOUT = [
  { word: 'PRESSURE', x: 0.12, y: 0.33, size: 0.205, step: 0.102, tilt: -0.038 },
  { word: 'MAKES', x: 0.30, y: 0.55, size: 0.27, step: 0.135, tilt: 0.026 },
  { word: 'LANGUAGE', x: 0.10, y: 0.78, size: 0.18, step: 0.105, tilt: -0.026 }
];

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyStroke(stroke) {
  return { ...stroke, points: stroke.points.map(copyPoint) };
}

function makeGlyphs(stage) {
  const random = rng(SEED + stage * 1013);
  const glyphs = [];
  WORD_LAYOUT.forEach((layout, line) => {
    const step = layout.step;
    [...layout.word].forEach((char, index) => {
      glyphs.push({
        id: `${line}-${index}`,
        char,
        line,
        index,
        baseX: layout.x + index * step,
        baseY: layout.y,
        x: layout.x + index * step,
        y: layout.y + (random() - 0.5) * 0.018,
        size: layout.size,
        scaleX: 0.94 + random() * 0.12,
        scaleY: 0.96 + random() * 0.08,
        angle: layout.tilt + (random() - 0.5) * 0.025,
        pressure: 0,
        grain: 0.22 + random() * 0.78,
        downstream: 0
      });
    });
  });
  return glyphs;
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return pointDistance(point, start);
  const amount = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared);
  return pointDistance(point, { x: start.x + dx * amount, y: start.y + dy * amount });
}

function strokeInfluence(glyph, stroke) {
  let nearest = 1;
  for (let index = 1; index < stroke.points.length; index += 1) {
    nearest = Math.min(nearest, segmentDistance(
      { x: glyph.baseX, y: glyph.baseY },
      stroke.points[index - 1],
      stroke.points[index]
    ));
  }
  return clamp(1 - nearest / (0.075 + stroke.load * 0.045));
}

function applyStrokeToGlyphs(glyphs, stroke, strokeIndex) {
  const resistance = 1 + stroke.resistance * 0.22;
  return glyphs.map((glyph) => {
    const local = strokeInfluence(glyph, stroke);
    const lineBias = (glyph.line - 1) * 0.012;
    const downstream = clamp((glyph.baseX - 0.28) * 1.4, -0.32, 0.68);
    const inherited = clamp(Math.max(0, downstream) * stroke.load * 0.34, 0, 0.32);
    const force = clamp(local * stroke.load * resistance + inherited, 0, 1.55);
    const side = stroke.direction >= 0 ? 1 : -1;
    return {
      ...glyph,
      x: clamp(glyph.x + side * force * 0.024 + lineBias * force, 0.05, 0.95),
      y: clamp(glyph.y + Math.sin((glyph.index + 1) * 1.7 + strokeIndex) * force * 0.013 + force * 0.012 * (glyph.line - 1), 0.08, 0.92),
      scaleX: clamp(glyph.scaleX * (1 - force * 0.23 + inherited * 0.07), 0.46, 1.22),
      scaleY: clamp(glyph.scaleY * (1 + force * 0.2), 0.68, 1.42),
      angle: glyph.angle + side * force * (0.13 + glyph.grain * 0.06),
      pressure: clamp(glyph.pressure + force * 0.9),
      downstream: clamp(glyph.downstream + inherited)
    };
  });
}

function baseFrame(stage) {
  return {
    stage,
    memory: [],
    glyphs: makeGlyphs(stage),
    materialResistance: 0,
    pressureDebt: 0,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'canvas-typographic-pressure-slab'
  };
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyStroke).slice(-MEMORY_LIMIT) : [];
  let glyphs = makeGlyphs(safeStage);
  let materialResistance = 0;
  let pressureDebt = 0;
  inherited.forEach((stroke, index) => {
    materialResistance += stroke.load * 0.42 + 0.08;
    pressureDebt += stroke.load * (1 + index * 0.16);
    glyphs = applyStrokeToGlyphs(glyphs, { ...stroke, resistance: materialResistance }, index);
  });
  return {
    stage: safeStage,
    memory: inherited,
    glyphs,
    materialResistance,
    pressureDebt,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'canvas-typographic-pressure-slab'
  };
}

function normalizePoints(points) {
  return (Array.isArray(points) ? points : [])
    .map((point) => ({ x: clamp(Number(point?.x) || 0.5), y: clamp(Number(point?.y) || 0.5) }));
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += pointDistance(points[index - 1], points[index]);
  return total;
}

function makeStroke(frame, points, duration, source = 'visitor-drag') {
  const safeDuration = clamp(Number(duration) || 0, 0, 4000);
  const length = pathLength(points);
  const direction = points.at(-1).x >= points[0].x ? 1 : -1;
  return {
    id: `${source}-${frame.stage}-${frame.memory.length}-${Math.round(points[0].x * 1000)}-${Math.round(points.at(-1).y * 1000)}`,
    kind: 'pressure-stroke',
    source,
    points: points.map(copyPoint),
    duration: safeDuration,
    length,
    direction,
    load: clamp(0.34 + safeDuration / 1800 + length * 0.65 + frame.materialResistance * 0.08, 0.34, 1.4),
    resistance: frame.materialResistance
  };
}

export function applyPressureStroke(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const points = normalizePoints(input.points);
  if (points.length < 2 || pathLength(points) < 0.08) return { ...baseline, interaction: 'pressure-refused' };
  const stroke = makeStroke(baseline, points, input.duration);
  return {
    ...buildFrame(baseline.stage, [...baseline.memory, stroke]),
    interaction: 'pressure-committed',
    restoreMemory: baseline.memory.map(copyStroke)
  };
}

function automaticStroke(stage, frame) {
  const random = rng(SEED + stage * 3011);
  const y = 0.3 + random() * 0.42;
  const startX = 0.12 + random() * 0.18;
  const endX = 0.72 + random() * 0.16;
  return makeStroke(frame, [{ x: startX, y }, { x: (startX + endX) / 2, y: y + (random() - 0.5) * 0.08 }, { x: endX, y: y + (random() - 0.5) * 0.06 }], 420 + random() * 600, 'autonomous-pressure');
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1) memory = [...memory, automaticStroke(stage, frame)].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function liftLatestStroke(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'pressure-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'pressure-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'pressure-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    glyphs: frame.glyphs.map(({ id, char, x, y, scaleX, scaleY, angle, pressure, downstream }) => ({ id, char, x, y, scaleX, scaleY, angle, pressure, downstream })),
    materialResistance: frame.materialResistance,
    pressureDebt: frame.pressureDebt
  });
}

export const GLYPH_COUNT = WORD_LAYOUT.reduce((total, layout) => total + layout.word.length, 0);
export const WORDS = WORD_LAYOUT.map(({ word }) => word);
