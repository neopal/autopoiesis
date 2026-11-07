export const LOOP_SEGMENTS = 36;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503045;

const MODES = ['hinge', 'coil', 'fork', 'return'];
const TAU = Math.PI * 2;
const round = (value) => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

function seeded(index) {
  const value = Math.sin((index + 1) * 23.417 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function createForm() {
  return {
    revision: 0,
    segments: LOOP_SEGMENTS,
    mode: 'quiet',
    twist: 0.19,
    aperture: 0.42,
    waist: 0.58,
    depth: 0.72,
    shear: -0.06,
    phase: 0.16,
    facetBias: 0.34,
    closure: 0,
    seedDrift: round(seeded(41) * 0.08)
  };
}

export function buildField() {
  return {
    composition: 'loop-compiler',
    renderer: 'p5-webgl',
    form: createForm(),
    stroke: null,
    memory: [],
    snapshots: [],
    interaction: 'quiet compiler'
  };
}

export function geometrySignature(field) {
  return JSON.stringify({
    composition: field.composition,
    form: field.form,
    memory: field.memory.map((event) => ({
      kind: event.kind,
      relation: event.relation,
      winding: event.winding,
      mode: event.mode,
      revision: event.revision
    }))
  });
}

function safePoint(point) {
  return {
    x: round(clamp(Number(point?.x) || 0, -1.5, 1.5)),
    y: round(clamp(Number(point?.y) || 0, -1.5, 1.5))
  };
}

export function traceLoop(field, points = []) {
  const next = clone(field);
  next.stroke = points.map(safePoint).slice(-240);
  next.interaction = next.stroke.length > 1 ? `tracing / ${next.stroke.length}` : 'trace armed';
  return next;
}

export function validLoop(direction = 1) {
  const sign = direction < 0 ? -1 : 1;
  const points = [];
  for (let index = 0; index < LOOP_SEGMENTS; index += 1) {
    const angle = sign * index / LOOP_SEGMENTS * TAU;
    const radiusX = 0.62 + 0.08 * Math.sin(angle * 3 + 0.4);
    const radiusY = 0.48 + 0.06 * Math.cos(angle * 2 - 0.7);
    points.push({
      x: round(Math.cos(angle) * radiusX),
      y: round(Math.sin(angle) * radiusY)
    });
  }
  points.push({ ...points[0] });
  return points;
}

function loopAnalysis(points) {
  if (!Array.isArray(points) || points.length < 8) return null;
  const first = points[0];
  const last = points.at(-1);
  const closure = Math.hypot(last.x - first.x, last.y - first.y);
  let area = 0;
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    area += previous.x * current.y - current.x * previous.y;
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  const magnitude = Math.abs(area) / 2;
  if (closure > 0.2 || magnitude < 0.08 || length < 1.2) return null;
  return {
    closure: round(closure),
    area: round(area / 2),
    magnitude: round(magnitude),
    length: round(length),
    winding: area >= 0 ? 1 : -1
  };
}

function compileForm(form, analysis, revision) {
  const direction = analysis.winding;
  const magnitude = clamp(analysis.magnitude, 0.08, 1.4);
  const modeIndex = (revision - 1 + (direction < 0 ? 1 : 0)) % MODES.length;
  return {
    ...form,
    revision,
    mode: MODES[modeIndex],
    twist: round(form.twist + direction * (0.19 + magnitude * 0.12) + revision * 0.011),
    aperture: round(clamp(form.aperture + direction * (0.06 + magnitude * 0.025), 0.16, 0.78)),
    waist: round(clamp(form.waist - 0.025 + magnitude * 0.035, 0.3, 0.82)),
    depth: round(clamp(form.depth + 0.045 + direction * 0.018, 0.44, 0.98)),
    shear: round(form.shear + direction * (0.08 + magnitude * 0.04)),
    phase: round((form.phase + 0.13 + magnitude * 0.2) % 1),
    facetBias: round((form.facetBias + direction * 0.11 + magnitude * 0.06 + 1) % 1),
    closure: analysis.closure
  };
}

export function compileLoop(field) {
  const next = clone(field);
  const analysis = loopAnalysis(next.stroke);
  if (!analysis) {
    next.stroke = null;
    next.interaction = 'refused / open loop';
    return { accepted: false, field: next, event: null };
  }

  const revision = field.form.revision + 1;
  const event = {
    kind: 'closed-loop-compile',
    relation: 'trace-rewrites-own-form',
    winding: analysis.winding,
    area: analysis.magnitude,
    length: analysis.length,
    closure: analysis.closure,
    mode: MODES[(revision - 1 + (analysis.winding < 0 ? 1 : 0)) % MODES.length],
    revision
  };
  next.form = compileForm(field.form, analysis, revision);
  next.snapshots = [...field.snapshots, clone(field)].slice(-MEMORY_LIMIT);
  next.memory = [...field.memory, event].slice(-MEMORY_LIMIT);
  next.stroke = null;
  next.interaction = `compiled / ${next.form.mode}`;
  return { accepted: true, field: next, event };
}

export function liftLatest(field) {
  if (!field.snapshots.length) return { ...clone(field), interaction: 'lifted / exact' };
  return { ...clone(field.snapshots.at(-1)), interaction: 'lifted / exact' };
}

export function releaseField() {
  return buildField();
}

export function buildTimeline() {
  let field = buildField();
  const directions = [1, -1, 1, -1];
  const timeline = [field];
  for (const direction of directions) {
    field = traceLoop(field, validLoop(direction));
    field = compileLoop(field).field;
    timeline.push(field);
  }
  return timeline;
}
