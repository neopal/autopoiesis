export const SEED = 0x48574922;
export const STAGES = 14;
export const MEMORY_LIMIT = 3;
export const PRIMITIVE_BUDGET = 72;

const PHRASE = 'MATTER MAKES MEANING';
const GLYPH_CHARS = [...PHRASE].filter((char) => char !== ' ');
const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const BASE_LAYOUT = [
  [0.14, 0.24], [0.26, 0.27], [0.38, 0.22], [0.50, 0.29], [0.62, 0.23], [0.74, 0.28],
  [0.20, 0.49], [0.33, 0.54], [0.46, 0.47], [0.59, 0.53], [0.72, 0.48],
  [0.10, 0.76], [0.22, 0.72], [0.34, 0.79], [0.46, 0.73], [0.58, 0.78], [0.70, 0.72], [0.82, 0.77]
];
const COUNTERTYPE = {
  A: 'E', E: 'A', G: 'Q', I: 'O', K: 'X', M: 'N', N: 'M', R: 'T', S: 'C', T: 'R'
};

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function copyGlyph(glyph) {
  return { ...glyph, stone: glyph.stone.map(([x, y]) => [x, y]) };
}

function copyPressure(pressure) {
  return { ...pressure, touchedIndices: [...pressure.touchedIndices], path: pressure.path.map((point) => ({ ...point })) };
}

function countertype(char, parity = 0) {
  const replacement = COUNTERTYPE[char] ?? char;
  return parity % 2 === 0 ? replacement : (COUNTERTYPE[replacement] ?? replacement);
}

function makeStone(random, index) {
  const sides = 6 + (index % 3);
  return Array.from({ length: sides }, (_, side) => {
    const theta = -Math.PI / 2 + (side / sides) * TAU;
    const radius = 0.78 + random() * 0.2;
    return [Math.cos(theta) * radius, Math.sin(theta) * radius];
  });
}

function makeGlyphs(stage) {
  const random = rng(SEED + stage * 1931);
  return GLYPH_CHARS.map((char, index) => {
    const [baseX, baseY] = BASE_LAYOUT[index];
    const wobble = (random() - 0.5) * 0.018;
    return {
      id: `stone-${String(index).padStart(2, '0')}`,
      index,
      char,
      originalChar: char,
      wordIndex: index < 6 ? 0 : index < 11 ? 1 : 2,
      x: baseX + wobble,
      y: baseY + (random() - 0.5) * 0.018,
      baseX,
      baseY,
      rotation: (random() - 0.5) * 0.11,
      scaleX: 0.92 + random() * 0.16,
      scaleY: 0.92 + random() * 0.16,
      ink: 0.64 + random() * 0.34,
      stone: makeStone(random, index),
      yielded: false,
      role: 'quiet',
      replyTo: null,
      pressureIndex: null
    };
  });
}

function pathLength(path) {
  return path.reduce((total, point, index) => index === 0 ? 0 : total + Math.hypot(point.x - path[index - 1].x, point.y - path[index - 1].y), 0);
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function distanceToPath(point, path) {
  let nearest = Infinity;
  for (let index = 1; index < path.length; index += 1) nearest = Math.min(nearest, distanceToSegment(point, path[index - 1], path[index]));
  return Math.min(nearest, ...path.map((candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y)));
}

function indicesForPath(glyphs, path) {
  return glyphs
    .map((glyph, index) => ({ index, distance: distanceToPath({ x: glyph.x, y: glyph.y }, path) }))
    .filter(({ distance }) => distance < 0.105)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map(({ index }) => index)
    .sort((a, b) => a - b);
}

function chooseReplyIndex(touchedIndices, memory, resistance, glyphCount) {
  const touched = new Set(touchedIndices);
  const anchor = touchedIndices.reduce((sum, index) => sum + index, 0);
  let candidate = (anchor + memory.length * 5 + Math.floor(resistance * 11) + 3) % glyphCount;
  for (let attempts = 0; attempts < glyphCount; attempts += 1) {
    if (!touched.has(candidate)) return candidate;
    candidate = (candidate + 1) % glyphCount;
  }
  return (touchedIndices[0] + 1) % glyphCount;
}

function applyPressure(glyphs, pressure, pressureIndex) {
  const touched = new Set(pressure.touchedIndices);
  const firstTouched = pressure.touchedIndices[0] ?? 0;
  const reply = pressure.replyIndex;
  const load = pressure.load;
  return glyphs.map((glyph, index) => {
    if (touched.has(index)) {
      const side = index % 2 === 0 ? 1 : -1;
      return {
        ...glyph,
        char: countertype(glyph.char, pressureIndex),
        x: glyph.x + side * (0.014 + load * 0.014) * (1 + (index % 3) * 0.14),
        y: glyph.y + (index % 3 - 1) * (0.011 + load * 0.009),
        rotation: glyph.rotation + side * (0.12 + load * 0.12),
        scaleX: clamp(glyph.scaleX * (1 - load * 0.08), 0.72, 1.22),
        scaleY: clamp(glyph.scaleY * (1 + load * 0.1), 0.72, 1.34),
        yielded: true,
        role: 'yielded',
        replyTo: reply,
        pressureIndex
      };
    }
    if (index === reply) {
      return {
        ...glyph,
        char: countertype(glyph.char, pressureIndex + 1),
        x: glyph.x - 0.018 * load,
        y: glyph.y + 0.022 * load,
        rotation: glyph.rotation - 0.17 * load,
        scaleX: clamp(glyph.scaleX * (1 + load * 0.15), 0.72, 1.34),
        scaleY: clamp(glyph.scaleY * (1 - load * 0.06), 0.72, 1.34),
        yielded: false,
        role: 'reply',
        replyTo: firstTouched,
        pressureIndex
      };
    }
    const nearestTouched = Math.min(...pressure.touchedIndices.map((touchedIndex) => Math.abs(index - touchedIndex)));
    if (nearestTouched <= 1) {
      const shear = (index < firstTouched ? -1 : 1) * (0.004 + load * 0.007);
      return { ...glyph, x: glyph.x + shear, rotation: glyph.rotation + shear * 2.2, role: glyph.role === 'quiet' ? 'sheared' : glyph.role, pressureIndex };
    }
    return glyph;
  });
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
  const inherited = Array.isArray(memory) ? memory.map(copyPressure).slice(-MEMORY_LIMIT) : [];
  let glyphs = makeGlyphs(safeStage);
  let resistance = 0;
  inherited.forEach((pressure, index) => {
    resistance += pressure.load * (0.76 + index * 0.12);
    glyphs = applyPressure(glyphs, pressure, index);
  });
  return {
    stage: safeStage,
    memory: inherited,
    glyphs,
    resistance,
    primitiveBudget: PRIMITIVE_BUDGET,
    composition: 'countertype-quarry',
    interaction: 'sequence',
    restoreMemory: null
  };
}

export function commitPressure(frame, input = {}) {
  const baseline = buildFrame(frame.stage, frame.memory);
  const path = Array.isArray(input.path) ? input.path.map((point) => ({ x: clamp(Number(point.x) || 0), y: clamp(Number(point.y) || 0) })) : [];
  const traveled = pathLength(path);
  if (traveled < 0.12 || path.length < 2) return { ...baseline, interaction: 'pressure-refused', refusal: 'path-too-short' };
  const touchedIndices = Array.isArray(input.touchedIndices) && input.touchedIndices.length
    ? [...new Set(input.touchedIndices.map((index) => clamp(Math.floor(Number(index) || 0), 0, baseline.glyphs.length - 1)))]
    : indicesForPath(baseline.glyphs, path);
  if (!touchedIndices.length) return { ...baseline, interaction: 'pressure-refused', refusal: 'missed-type' };
  const force = clamp(Number(input.force) || 0.6, 0.2, 1.4);
  const load = clamp(0.34 + traveled * 0.5 + force * 0.38 + baseline.resistance * 0.04, 0.34, 1.55);
  const pressure = {
    kind: 'countertype-pressure',
    touchedIndices,
    replyIndex: chooseReplyIndex(touchedIndices, baseline.memory, baseline.resistance, baseline.glyphs.length),
    load,
    force,
    pathLength: traveled,
    path
  };
  const next = buildFrame(baseline.stage, [...baseline.memory, pressure]);
  return { ...next, interaction: 'pressure-committed', restoreMemory: baseline.memory.map(copyPressure) };
}

export function liftLatestPressure(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'pressure-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'pressure-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'pressure-lifted' };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    memory: frame.memory,
    resistance: frame.resistance,
    glyphs: frame.glyphs.map(({ id, char, x, y, rotation, scaleX, scaleY, yielded, role, replyTo, pressureIndex }) => ({ id, char, x, y, rotation, scaleX, scaleY, yielded, role, replyTo, pressureIndex }))
  });
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(STAGES, Math.max(1, Math.floor(stageCount))) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (stage < STAGES - 1 && stage % 4 !== 0) {
      const start = 0.08 + (stage % 3) * 0.12;
      const next = commitPressure(frame, {
        path: [{ x: start, y: 0.18 + stage * 0.01 }, { x: 0.86 - (stage % 2) * 0.08, y: 0.72 - (stage % 3) * 0.04 }],
        touchedIndices: [(stage * 3 + 1) % GLYPH_CHARS.length, (stage * 3 + 7) % GLYPH_CHARS.length],
        force: 0.56 + stage * 0.035
      });
      memory = next.memory;
    }
    return frame;
  });
}

export const GLYPH_COUNT = GLYPH_CHARS.length;
export const PHRASE_WORDS = PHRASE.split(' ');
